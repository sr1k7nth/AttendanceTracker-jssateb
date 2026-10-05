from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..schemas import UserScrapeRequest, UserLogin, AttendanceResponse
from portal_client import scrapper, LoginError
from ..models import Attendance as AttendanceModel
from ..oauth import get_current_user
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

# No concurrency limiter, no rate limit, no TTL: every login and every refresh
# performs a real scrape. Each one is four HTTP requests costing ~9 MB and ~1s,
# so a burst of them neither exhausts RAM nor needs a queue to arbitrate —
# requests that arrive together simply run together.


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
    # Hidden admin session: the panel credentials typed into the ordinary
    # login page open the review queue. There is no admin link anywhere
    # else, and nothing matches here while ADMIN_PANEL_* is unset.
    # (Case-insensitive because the USN field uppercases what you type.)
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


@router.post("/refresh", response_model=AttendanceResponse)
def refresh(
    user_data: UserScrapeRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(AttendanceModel).filter(AttendanceModel.usn == current_user).first()

    if user is None:
        raise HTTPException(status_code=401, detail="Register/Login first")
    # Always a fresh scrape — no TTL, no daily quota.
    _scrape_and_cache(current_user, user_data.password.get_secret_value(), db)
    db.refresh(user)
    return user
