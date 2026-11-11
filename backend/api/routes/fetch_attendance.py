from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..oauth import get_current_user
from ..database import get_db
from ..models import Attendance as AttendanceModel
from ..models import AttendanceHistory
from ..models import WeeklyTimetable
from ..schemas import AttendanceResponse, HistoryPointOut, WeekOut

router = APIRouter(prefix="/fetch_attendance", tags=["Fetch Attendance"])


class LoginError(Exception):
    pass


@router.get("/", response_model=AttendanceResponse)
def get_attendance(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(AttendanceModel).filter(AttendanceModel.usn == current_user).first()

    if user is None:
        raise HTTPException(status_code=401, detail="Register/Login first")

    resp = AttendanceResponse.model_validate(user)
    # Stored weekly grids — newest first. The current week is in here too
    # (it upserts on every scrape), so the UI can flip between weeks.
    week_rows = (
        db.query(WeeklyTimetable)
        .filter(WeeklyTimetable.usn == current_user)
        .order_by(WeeklyTimetable.week_start.desc())
        .all()
    )
    resp.weeks = [
        WeekOut(week_start=row.week_start, timetable=row.timetable)
        for row in week_rows
    ]
    return resp


@router.get("/history", response_model=list[HistoryPointOut])
def get_attendance_history(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Chronological percentage checkpoints — one per login, oldest first.

    Each point is timestamped when the portal was actually re-scraped, so the
    graph reflects when the user fetched, not when the browser asked for it.
    """
    user = db.query(AttendanceModel).filter(AttendanceModel.usn == current_user).first()

    if user is None:
        raise HTTPException(status_code=401, detail="Register/Login first")

    rows = (
        db.query(AttendanceHistory)
        .filter(AttendanceHistory.usn == current_user)
        .order_by(AttendanceHistory.recorded_at.asc(), AttendanceHistory.id.asc())
        .all()
    )
    return [
        HistoryPointOut(recorded_at=row.recorded_at, total_avg=row.total_avg)
        for row in rows
    ]
