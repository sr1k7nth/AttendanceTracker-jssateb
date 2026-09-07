from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..schemas import UserScrapeRequest, UserLogin
from scrapper import scrapper, LoginError
from ..models import Attendance as AttendanceModel
from ..oauth import get_current_user
from ..database import get_db
from datetime import datetime, timezone
from ..oauth import create_access_token

router = APIRouter(prefix="/scraper", tags=["Scraper"])


def _scrape_and_cache(
    usn: str, password: str, db: Session, leaderboard_opt: bool = False
):
    try:
        data = scrapper(usn, password)
    except LoginError as e:
        raise HTTPException(401, detail=str(e))

    if data.get("status") == "error":
        raise HTTPException(401, detail=data["error"])

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
    else:
        new_user = AttendanceModel(
            usn=usn,
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
    data = _scrape_and_cache(user.usn, user.password, db, user.leaderboard_opt)
    token = create_access_token({"usn": user.usn, "leaderboard_opt": user.leaderboard_opt})
    return {"token": token, "data": data}


@router.post("/refresh")
def refresh(
    user_data: UserScrapeRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = _scrape_and_cache(current_user, user_data.password, db)
    return {"data": data}
