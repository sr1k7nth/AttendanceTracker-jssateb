from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..schemas import UserLogin
from portal_client import scrapper, LoginError
from ..models import Attendance as AttendanceModel
from ..database import get_db
from ..config import settings
from datetime import datetime, timezone
from ..oauth import create_access_token
import logging
import secrets
import time

router = APIRouter(prefix="/scraper", tags=["Scraper"])

ADMIN_USN = "JS240955"

logger = logging.getLogger("scraper.queue")

# Each login re-scrapes live; no rate limit. No /scraper/refresh — the portal password is never stored.


def _scrape_and_cache(
    usn: str,
    password: str,
    db: Session,
    leaderboard_opt: bool = False,
    alias: str | None = None,
):
    scrape_started = time.perf_counter()
    try:
        data = scrapper(usn, password)
    except LoginError:
        raise HTTPException(401, detail="Invalid credentials") from None
    except Exception:
        # Hide sensitive scraper errors
        raise HTTPException(
            502, detail="Portal unavailable. Try again later."
        ) from None
    logger.info(
        "scrape ok (usn=%s): %.1fs",
        usn,
        time.perf_counter() - scrape_started,
    )

    if data.get("status") == "error":
        raise HTTPException(401, detail="Invalid credentials")
    if data.get("status") == "portal down":
        raise HTTPException(502, detail="Portal unavailable. Try again later.")

    existing = db.query(AttendanceModel).filter(AttendanceModel.usn == usn).first()
    if existing:
        existing.summary = data["summary"]  # type: ignore
        existing.absent_periods = data["absent_periods"]  # type: ignore
        existing.timetable = data["timetable"]  # type: ignore
        existing.total_avg = data["total_avg"]  # type: ignore
        existing.can_miss75 = data["can_miss75"]  # type: ignore
        existing.can_miss85 = data["can_miss85"]  # type: ignore
        existing.need_to_attend75 = data["need_to_attend75"]  # type: ignore
        existing.need_to_attend85 = data["need_to_attend85"]  # type: ignore
        existing.timestamp = datetime.now(timezone.utc)  # type: ignore
        existing.branch = data["branch"]  # type: ignore
        existing.sem = data["sem"]  # type: ignore
        existing.leaderboard_opt = leaderboard_opt  # type: ignore
        if alias is not None:
            existing.alias = alias  # type: ignore
    else:
        new_user = AttendanceModel(
            usn=usn,
            alias=alias,
            summary=data["summary"],
            absent_periods=data["absent_periods"],
            timetable=data["timetable"],
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
    # Panel creds typed on the normal login form open the review queue.
    panel_user = settings.ADMIN_PANEL_USERNAME
    panel_pass = settings.ADMIN_PANEL_PASSWORD
    if (
        panel_user
        and panel_pass
        and secrets.compare_digest(user.usn.lower(), panel_user.lower())
        and secrets.compare_digest(user.password.get_secret_value(), panel_pass)
    ):
        return {
            "token": create_access_token(
                {"usn": ADMIN_USN, "leaderboard_opt": False}
            ),
            "admin": True,
            "usn": ADMIN_USN,
        }
    data = _scrape_and_cache(
        user.usn, user.password.get_secret_value(), db, user.leaderboard_opt, user.alias
    )
    token = create_access_token(
        {"usn": user.usn, "leaderboard_opt": user.leaderboard_opt}
    )
    return {"token": token, "data": data}
