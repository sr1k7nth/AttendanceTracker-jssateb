from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..schemas import UserLogin
from portal_client import scrapper, LoginError
from ..models import Attendance as AttendanceModel
from ..models import AttendanceHistory
from ..models import LoginAttempt
from ..database import get_db
from ..config import settings
from datetime import datetime, timedelta, timezone
from ..oauth import create_access_token
import logging
import secrets
import time
from sqlalchemy import func

router = APIRouter(prefix="/scraper", tags=["Scraper"])

logger = logging.getLogger("scraper.queue")

# Each login re-scrapes live; login() gates it (cooldown, daily cap, failure
# budget). No /scraper/refresh — the portal password is never stored.


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
            timestamp=datetime.now(timezone.utc),
            leaderboard_opt=leaderboard_opt,
            branch=data["branch"],
            sem=data["sem"],
        )
        db.add(new_user)

    # A login is the only moment fresh numbers exist, so it's also the only
    # honest point on the progression graph — record it even when the
    # percentage didn't move since the last check-in.
    db.add(AttendanceHistory(usn=usn, total_avg=data["total_avg"]))

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
        and settings.ADMIN_USN
        and secrets.compare_digest(user.usn.lower(), panel_user.lower())
        and secrets.compare_digest(user.password.get_secret_value(), panel_pass)
    ):
        return {
            "token": create_access_token(
                {"usn": settings.ADMIN_USN, "leaderboard_opt": False}
            ),
            "admin": True,
            "usn": settings.ADMIN_USN,
        }

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=settings.DAILY_SCRAPE_WINDOW_HOURS)
    key = user.usn.strip().lower()

    last = (
        db.query(AttendanceModel.timestamp)
        .filter(func.lower(AttendanceModel.usn) == key)
        .first()
    )
    if last is not None:
        age = now - last.timestamp
        if age < timedelta(minutes=settings.SCRAPE_COOLDOWN_MINUTES):
            remaining = max(
                1,
                int(
                    (
                        timedelta(minutes=settings.SCRAPE_COOLDOWN_MINUTES) - age
                    ).total_seconds()
                ),
            )
            raise HTTPException(
                status_code=429,
                detail="recently_scraped",
                headers={"Retry-After": str(remaining)},
            )

    used = (
        db.query(func.count(AttendanceHistory.id))
        .filter(
            func.lower(AttendanceHistory.usn) == key,
            AttendanceHistory.recorded_at > cutoff,
        )
        .scalar()
    )

    if used >= settings.DAILY_SCRAPE_LIMIT:
        oldest = (
            db.query(func.min(AttendanceHistory.recorded_at))
            .filter(
                func.lower(AttendanceHistory.usn) == key,
                AttendanceHistory.recorded_at > cutoff,
            )
            .scalar()
        )
        seconds = max(
            0,
            int(
                (
                    oldest + timedelta(hours=settings.DAILY_SCRAPE_WINDOW_HOURS) - now
                ).total_seconds()
            ),
        )
        raise HTTPException(
            status_code=429,
            detail=f"Daily fetch limit reached ({settings.DAILY_SCRAPE_LIMIT} per day). Try again later.",
            headers={"Retry-After": str(seconds)},
        )

    # Failure budget: rejected logins for this USN in a sliding window.
    fail_cutoff = now - timedelta(minutes=settings.FAILURE_WINDOW_MINUTES)
    fails = (
        db.query(func.count(LoginAttempt.id))
        .filter(LoginAttempt.key == key, LoginAttempt.created_at > fail_cutoff)
        .scalar()
    )
    if fails >= settings.FAILURE_LIMIT:
        oldest_fail = (
            db.query(func.min(LoginAttempt.created_at))
            .filter(LoginAttempt.key == key, LoginAttempt.created_at > fail_cutoff)
            .scalar()
        )
        seconds = max(
            0,
            int(
                (
                    oldest_fail
                    + timedelta(minutes=settings.FAILURE_WINDOW_MINUTES)
                    - now
                ).total_seconds()
            ),
        )
        logger.info("failure limit hit: key=%s", key)
        raise HTTPException(
            status_code=429,
            detail=(
                "Too many failed attempts "
                f"({settings.FAILURE_LIMIT} per {settings.FAILURE_WINDOW_MINUTES} min). "
                "Try again later."
            ),
            headers={"Retry-After": str(seconds)},
        )

    try:
        data = _scrape_and_cache(
            user.usn, user.password.get_secret_value(), db, user.leaderboard_opt, user.alias
        )
    except HTTPException as exc:
        if exc.status_code == 401:
            # The portal rejected the password — count it. 502 (portal down)
            # is deliberately not recorded: an outage must not throttle users.
            db.add(LoginAttempt(key=key, created_at=now))
            db.commit()
            logger.info("login rejected: key=%s", key)
        raise

    # A successful login forgives earlier typos for this USN.
    db.query(LoginAttempt).filter(LoginAttempt.key == key).delete(
        synchronize_session=False
    )
    db.commit()

    token = create_access_token(
        {"usn": user.usn, "leaderboard_opt": user.leaderboard_opt}
    )
    return {"token": token, "data": data}
