from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..schemas import UserScrapeRequest, UserLogin, AttendanceResponse
from scrapper import scrapper, LoginError
from ..models import Attendance as AttendanceModel
from ..oauth import get_current_user
from ..database import get_db
from datetime import datetime, timezone
from ..oauth import create_access_token

router = APIRouter(prefix="/scraper", tags=["Scraper"])

ADMIN_USN = "JS240955"


def _scrape_and_cache(
    usn: str,
    password: str,
    db: Session,
    leaderboard_opt: bool = False,
    alias: str | None = None,
):
    try:
        data = scrapper(usn, password)
    except LoginError:
        raise HTTPException(401, detail="Invalid credentials") from None
    except Exception:
        # Hide sensitive scraper errors
        raise HTTPException(
            502, detail="Portal unavailable. Try again later."
        ) from None

    if data.get("status") == "error":
        raise HTTPException(401, detail="Invalid credentials")
    if data.get("status") == "portal down":
        raise HTTPException(502, detail="Portal unavailable. Try again later.")

    existing = db.query(AttendanceModel).filter(AttendanceModel.usn == usn).first()
    if existing:
        existing.summary = data["summary"]  # type: ignore
        existing.absent_periods = data["absent_periods"]  # type: ignore
        existing.total_avg = data["total_avg"]  # type: ignore
        existing.can_miss75 = data["can_miss75"]  # type: ignore
        existing.can_miss85 = data["can_miss85"]  # type: ignore
        existing.need_to_attend75 = data["need_to_attend75"]  # type: ignore
        existing.need_to_attend85 = data["need_to_attend85"]  # type: ignore
        existing.timestamp = datetime.now(timezone.utc)  # type: ignore
        existing.branch = data["branch"]  # type: ignore
        existing.sem = data["sem"]  # type: ignore
        existing.leaderboard_opt = leaderboard_opt
        if alias is not None:
            existing.alias = alias
    else:
        new_user = AttendanceModel(
            usn=usn,
            alias=alias,
            summary=data["summary"],
            absent_periods=data["absent_periods"],
            total_avg=data["total_avg"],  # type: ignore
            can_miss75=data["can_miss75"],  # type: ignore
            can_miss85=data["can_miss85"],  # type: ignore
            need_to_attend75=data["need_to_attend75"],  # type: ignore
            need_to_attend85=data["need_to_attend85"],  # type: ignore
            timestamp=datetime.now(timezone.utc),
            leaderboard_opt=leaderboard_opt,
            branch=data["branch"],
            sem=data["sem"],
        )
        db.add(new_user)

    db.commit()
    return data


@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    existing = db.query(AttendanceModel).filter(AttendanceModel.usn == user.usn).first()
    if existing and user.usn != ADMIN_USN:
        age_minutes = (
            datetime.now(timezone.utc) - existing.timestamp
        ).total_seconds() / 60
        if age_minutes < 120:
            existing.leaderboard_opt = user.leaderboard_opt
            if user.alias is not None:
                existing.alias = user.alias
            db.commit()
            token = create_access_token(
                {"usn": user.usn, "leaderboard_opt": user.leaderboard_opt}
            )
            return {"token": token, "data": existing}
    data = _scrape_and_cache(
        user.usn, user.password.get_secret_value(), db, user.leaderboard_opt, user.alias
    )
    if existing and user.usn != ADMIN_USN:
        existing.request_left -= 1
        db.commit()
    token = create_access_token(
        {"usn": user.usn, "leaderboard_opt": user.leaderboard_opt}
    )
    return {"token": token, "data": data}


@router.post("/refresh", response_model=AttendanceResponse)
def refresh(
    user_data: UserScrapeRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(AttendanceModel).filter(AttendanceModel.usn == current_user).first()

    if user is None:
        raise HTTPException(status_code=401, detail="Register/Login first")
    # Admin bypass — no rate limit or TTL check
    if current_user != ADMIN_USN:
        if user.timestamp.date() != datetime.now(timezone.utc).date():
            user.request_left = 4  # type: ignore
        age_minutes = (datetime.now(timezone.utc) - user.timestamp).total_seconds() / 60
        if age_minutes < 120:
            return user
        if user.request_left <= 0:  # type: ignore
            raise HTTPException(
                429, detail="Daily scrape limit reached. Try again tomorrow."
            )
    data = _scrape_and_cache(current_user, user_data.password.get_secret_value(), db)
    if current_user != ADMIN_USN:
        user.request_left -= 1  # type: ignore
        db.commit()
    db.refresh(user)
    return user
