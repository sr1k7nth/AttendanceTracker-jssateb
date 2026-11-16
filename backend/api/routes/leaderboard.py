from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Attendance as AttendanceModel
from ..oauth import get_current_user
from ..schemas import LeaderboardResponse

router = APIRouter(tags=["Leaderboard"])

# Check-ins are grouped into consecutive four-IST-day windows anchored on
# today: bucket 0 is today plus the previous three dates, bucket 1 is the
# four dates before that, and so on. Newest bucket first; inside a bucket
# rows are ranked by average attendance.
IST = ZoneInfo("Asia/Kolkata")
WINDOW_DAYS = 4


@router.get("/leaderboard", response_model=list[LeaderboardResponse])
def leaderboard(
    db: Session = Depends(get_db),
    usn: str = Depends(get_current_user),
    sort: str = "desc",
    branch: str = "ALL",
    year: str | None = None,
):
    current_user = db.query(AttendanceModel).filter(AttendanceModel.usn == usn).first()

    if not current_user or not current_user.leaderboard_opt:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User hasn't opted for leaderboard",
        )

    # A viewer may see all years, or only their own — nothing in between.
    own_year = (current_user.sem + 1) // 2 if current_user.sem else None
    selected_year = None
    if year is not None:
        if year == "me":
            selected_year = own_year
            if selected_year is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Your year is unknown — log in again to refresh it.",
                )
        else:
            try:
                selected_year = int(year)
            except (TypeError, ValueError):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="year must be 'me' or a year between 1 and 4",
                ) from None
            if selected_year not in (1, 2, 3, 4):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="year must be 'me' or a year between 1 and 4",
                )
        if selected_year != own_year:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can view all years or only your own year.",
            )

    # Everyone opted in, regardless of semester — the leaderboard is global.
    query = db.query(AttendanceModel).filter(
        AttendanceModel.leaderboard_opt == True,  # noqa: E712
        AttendanceModel.total_avg.isnot(None),
    )

    if branch != "ALL":
        query = query.filter(AttendanceModel.branch == branch)

    # sem 1–2 = first year, 3–4 = second year, and so on.
    if selected_year is not None:
        query = query.filter(
            AttendanceModel.sem.in_([selected_year * 2 - 1, selected_year * 2])
        )

    today = datetime.now(IST).date()
    rows = []
    for user in query.all():
        checked_in = user.timestamp.astimezone(IST).date()
        # Clamp future timestamps (clock skew) into the newest bucket.
        days_ago = max((today - checked_in).days, 0)
        bucket = days_ago // WINDOW_DAYS
        window_end = today - timedelta(days=bucket * WINDOW_DAYS)
        window_start = window_end - timedelta(days=WINDOW_DAYS - 1)
        rows.append((bucket, window_start, window_end, user))

    def sort_key(row):
        bucket, _, _, user = row
        avg = user.total_avg or 0
        # Highest first / lowest first, but always keep the newest bucket on top.
        avg_key = -avg if sort == "desc" else avg
        return (bucket, avg_key, -user.timestamp.timestamp())

    rows.sort(key=sort_key)

    result = []
    last_bucket = None
    rank = 0
    for bucket, window_start, window_end, user in rows:
        if bucket != last_bucket:
            rank = 1
            last_bucket = bucket
        else:
            rank += 1

        result.append(
            LeaderboardResponse(
                alias=user.alias,
                total_avg=user.total_avg,
                timestamp=user.timestamp,
                branch=user.branch,
                rank=rank,
                bucket=bucket,
                window_start=window_start,
                window_end=window_end,
                is_me=user.usn == usn,
                is_supporter=user.is_supporter,
            )
        )

    return result
