"""In-app feedback: five categories, optional/required screenshot, 3/day cap.

Mirrors the donations upload pattern: the image is validated by magic bytes,
capped at 5 MB while streaming, and stored in a private directory that is
never served statically — the admin reads it through routes/admin.py only.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Attendance as AttendanceModel
from ..models import Feedback
from ..oauth import get_current_user
from ..schemas import MyFeedbackOut
from .donations import _detect_image, _read_capped

router = APIRouter(tags=["Feedback"])

logger = logging.getLogger("feedback")

# Exported for routes/admin.py — the admin screenshot route must read from
# the exact same directory this module writes to (env override included).
UPLOAD_DIR = Path(
    os.environ.get("FEEDBACK_UPLOAD_DIR")
    or settings.FEEDBACK_UPLOAD_DIR
    or Path(__file__).resolve().parents[2] / "uploads" / "feedback"
)
MAX_MESSAGE = 1000

CATEGORIES = ("feedback", "error", "feature", "data_removal", "beta_screenshot")
NEEDS_SCREENSHOT = ("error", "data_removal", "beta_screenshot")
NEEDS_MESSAGE = ("feedback", "error", "feature", "beta_screenshot")

DAILY_LIMIT = 3
DAILY_WINDOW = timedelta(hours=24)

# beta check: how many screenshots per branch before the banner stops
BETA_TARGET = 3


class BetaStatusOut(BaseModel):
    branch: str | None
    screenshots: int
    target: int


def _valid_branches(db: Session) -> list[str]:
    return [
        b
        for (b,) in db.query(AttendanceModel.branch)
        .filter(
            AttendanceModel.branch.isnot(None),
            AttendanceModel.branch != "",
        )
        .distinct()
        .all()
        if b
    ]


@router.get("/feedback/beta-status", response_model=BetaStatusOut)
def beta_status(
    usn: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Beta banner state: the caller's branch and how many of its
    beta_screenshot submissions are in (banner shows while < target)."""
    user = db.query(AttendanceModel).filter(AttendanceModel.usn == usn).first()
    branch = user.branch if user is not None else None
    count = (
        db.query(func.count(Feedback.id))
        .filter(Feedback.category == "beta_screenshot", Feedback.message == branch)
        .scalar()
        if branch
        else 0
    )
    return BetaStatusOut(branch=branch, screenshots=count or 0, target=BETA_TARGET)


@router.get("/feedback/branches")
def list_branches(db: Session = Depends(get_db)):
    """Distinct known branch names — the allowed values for a
    beta_screenshot submission's branch field."""
    return {"branches": _valid_branches(db)}


@router.get("/feedback/mine", response_model=list[MyFeedbackOut])
def my_feedback(
    usn: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The user's own submissions — powers the summary-page reply banner."""
    rows = (
        db.query(Feedback)
        .filter(Feedback.usn == usn)
        .order_by(Feedback.created_at.desc())
        .limit(10)
        .all()
    )
    return [
        MyFeedbackOut(
            id=row.id,  # type: ignore
            category=row.category,  # type: ignore
            message=row.message,  # type: ignore
            reply=row.reply,  # type: ignore
            replied_at=row.replied_at,  # type: ignore
            status=row.status,  # type: ignore
            created_at=row.created_at,  # type: ignore
        )
        for row in rows
    ]


@router.post("/feedback", status_code=201)
async def submit_feedback(
    category: str = Form(...),
    message: str | None = Form(None, max_length=MAX_MESSAGE),
    screenshot: UploadFile | None = File(None),
    usn: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit feedback. Rate limit: 3 per user per sliding day (admin exempt)."""
    user = db.query(AttendanceModel).filter(AttendanceModel.usn == usn).first()
    if user is None:
        raise HTTPException(401, "Login first.")

    if category not in CATEGORIES:
        raise HTTPException(422, "Unknown feedback type.")

    # --- rate limit (admin USN never throttled) --------------------------
    if not (settings.ADMIN_USN and usn.strip().lower() == settings.ADMIN_USN.strip().lower()):
        window_start = datetime.now(timezone.utc) - DAILY_WINDOW
        used = (
            db.query(func.count(Feedback.id))
            .filter(Feedback.usn == usn, Feedback.created_at > window_start)
            .scalar()
        )
        if used >= DAILY_LIMIT:
            oldest = (
                db.query(func.min(Feedback.created_at))
                .filter(Feedback.usn == usn, Feedback.created_at > window_start)
                .scalar()
            )
            seconds = max(
                0,
                int((oldest + DAILY_WINDOW - datetime.now(timezone.utc)).total_seconds()),
            )
            raise HTTPException(
                status_code=429,
                detail=f"Feedback limit reached ({DAILY_LIMIT} per day). Try again later.",
                headers={"Retry-After": str(seconds)},
            )

    cleaned = (message or "").strip()
    if category in NEEDS_MESSAGE and not cleaned:
        raise HTTPException(422, "Message is required for this feedback type.")

    # beta_screenshot: the message IS the branch name — validate it so typos
    # don't silently fail to count toward the 3-per-branch target
    if category == "beta_screenshot":
        valid = {b.strip().lower() for b in _valid_branches(db)}
        if cleaned.strip().lower() not in valid:
            raise HTTPException(
                422,
                "Branch not recognized — check the spelling against the known branches.",
            )
        cleaned = next(
            b for b in _valid_branches(db) if b.strip().lower() == cleaned.strip().lower()
        )

    # --- screenshot: required for error / data_removal / beta, rejected otherwise
    last_scraped_at = None
    filename = None
    if screenshot is not None and screenshot.filename:
        if category not in NEEDS_SCREENSHOT:
            raise HTTPException(422, "Screenshots are not accepted for this feedback type.")
        raw = await _read_capped(screenshot)
        ext = _detect_image(raw)
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4().hex}.{ext}"  # server-generated name, never the client's
        (UPLOAD_DIR / filename).write_bytes(raw)
    elif category in NEEDS_SCREENSHOT:
        raise HTTPException(
            422,
            "A screenshot is required for this feedback type."
            + (
                " Attach one that shows the dashboard."
                if category == "data_removal"
                else " Attach one that shows how the site looks for your branch."
                if category == "beta_screenshot"
                else " Attach one that shows the error."
            ),
        )

    if category == "data_removal":
        # identity proof: the time of their last real scrape, stamped server-side
        last_scraped_at = user.timestamp

    db.add(
        Feedback(
            usn=usn,
            category=category,
            message=cleaned or None,
            screenshot_file=filename,
            last_scraped_at=last_scraped_at,
        )
    )
    db.commit()
    logger.info("feedback submitted: usn=%s category=%s", usn, category)

    return {
        "status": "received",
        "message": (
            "Thanks! Your submission is in — the admin will take a look."
            if category != "data_removal"
            else "Received. Your data removal request will be reviewed by the admin."
        ),
    }
