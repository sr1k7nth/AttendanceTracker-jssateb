from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..schemas import UserScrapeRequest, UserLogin, AttendanceResponse
from scrapper import scrapper, LoginError
from ..models import Attendance as AttendanceModel
from ..oauth import get_current_user
from ..database import get_db
from ..config import settings
from datetime import datetime, timezone
from ..oauth import create_access_token
import logging
import secrets
import threading
import time

router = APIRouter(prefix="/scraper", tags=["Scraper"])

ADMIN_USN = "JS240955"

logger = logging.getLogger("scraper.queue")

# The scrape queue: at most N live browsers may run at once — each spawns a
# Chromium process hundreds of MB big, and a burst of concurrent ones would
# OOM the box. Everyone else blocks here (costs zero RAM) until a slot frees.
#
# N is decided ONCE at startup, before any request is served:
#   SCRAPE_CONCURRENCY > 0  -> manual, your .env value is used as-is
#   SCRAPE_CONCURRENCY = 0  -> auto: run one test scrape (memory_probe.py),
#                              divide free RAM by its measured cost
#   auto mode failed        -> stays at the safe default of 1
# It is never re-checked per-request, and it bounds BROWSERS, not users —
# cached or quota-expired requests never acquire this semaphore at all.
# Per-process too: with `--workers N` the real ceiling is N x the value here.
#
# BoundedSemaphore can't be resized, so this import-time value is a safe
# placeholder (or the manual value); api/main.py swaps in the calibrated
# object during the startup hook, which runs before uvicorn serves anyone.
SCRAPE_SLOTS = threading.BoundedSemaphore(1)

# Longest a request may WAIT IN LINE before we give up and answer
# 503 "try again". Budget: ~17s wait + ~7s own scrape ≈ 24s absolute max.
QUEUE_TIMEOUT_SECONDS = 17.0


def _reset_if_new_day(user):
    """Reset the user's daily scrape quota if their last scrape was yesterday.

    Free users get FREE_REQUESTS_PER_DAY, supporters get SUPPORTER_REQUESTS_PER_DAY.
    """
    ts = user.timestamp
    now = datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    if ts.date() != now.date():
        user.request_left = (
            settings.SUPPORTER_REQUESTS_PER_DAY
            if user.is_supporter
            else settings.FREE_REQUESTS_PER_DAY
        )


def _scrape_and_cache(
    usn: str,
    password: str,
    db: Session,
    leaderboard_opt: bool = False,
    alias: str | None = None,
):
    # -- queue for a scrape slot -----------------------------------------
    queued_at = time.perf_counter()
    if not SCRAPE_SLOTS.acquire(timeout=QUEUE_TIMEOUT_SECONDS):
        logger.warning(
            "queue full after %.1fs (usn=%s) -> 503",
            time.perf_counter() - queued_at,
            usn,
        )
        raise HTTPException(
            503, detail="Server is busy right now — try again in a moment."
        ) from None
    queue_wait = time.perf_counter() - queued_at
    try:
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
            "scrape ok (usn=%s): queued %.1fs, scraped %.1fs",
            usn,
            queue_wait,
            time.perf_counter() - scrape_started,
        )
    finally:
        SCRAPE_SLOTS.release()
    # -- end queue -------------------------------------------------------

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
    existing = db.query(AttendanceModel).filter(AttendanceModel.usn == user.usn).first()
    if existing and user.usn != ADMIN_USN:
        _reset_if_new_day(existing)
        # Out of requests → return cached data, no scrape
        if existing.request_left is not None and existing.request_left <= 0:  # type: ignore
            token = create_access_token(
                {"usn": user.usn, "leaderboard_opt": user.leaderboard_opt}
            )
            return {"token": token, "data": existing}
        # Cache still fresh (<2hrs) → return cached data, no scrape
        ts = existing.timestamp
        now = datetime.now(timezone.utc)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        age_minutes = (now - ts).total_seconds() / 60
        if age_minutes < 120:
            existing.leaderboard_opt = user.leaderboard_opt  # type: ignore
            if user.alias is not None:
                existing.alias = user.alias  # type: ignore
            db.commit()
            token = create_access_token(
                {"usn": user.usn, "leaderboard_opt": user.leaderboard_opt}
            )
            return {"token": token, "data": existing}
    data = _scrape_and_cache(
        user.usn, user.password.get_secret_value(), db, user.leaderboard_opt, user.alias
    )
    # Decrement request_left for non-admin users
    if user.usn != ADMIN_USN:
        user_obj = db.query(AttendanceModel).filter(AttendanceModel.usn == user.usn).first()
        if user_obj:
            _reset_if_new_day(user_obj)
            if user_obj.request_left is not None and user_obj.request_left > 0:  # type: ignore
                user_obj.request_left -= 1  # type: ignore
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
        _reset_if_new_day(user)
        # Handle both timezone-aware and naive timestamps from DB
        ts = user.timestamp
        now = datetime.now(timezone.utc)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        age_minutes = (now - ts).total_seconds() / 60
        if age_minutes < 120:
            return user
        if user.request_left <= 0:  # type: ignore
            raise HTTPException(
                429, detail="Daily scrape limit reached. Try again tomorrow."
            )
    data = _scrape_and_cache(current_user, user_data.password.get_secret_value(), db)
    if current_user != ADMIN_USN:
        # Re-query after _scrape_and_cache committed (old `user` is expired)
        user = db.query(AttendanceModel).filter(AttendanceModel.usn == current_user).first()
        if user:
            _reset_if_new_day(user)
            if user.request_left is not None and user.request_left > 0:  # type: ignore
                user.request_left -= 1  # type: ignore
                db.commit()
    db.refresh(user)
    return user
