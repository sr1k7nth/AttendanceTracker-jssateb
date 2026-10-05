import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Attendance as AttendanceModel
from ..models import Donation
from ..oauth import get_current_user
from ..schemas import ProgressOut, SupporterOut

router = APIRouter(tags=["Support"])

logger = logging.getLogger("donations")

# Private on-disk home for screenshots — never statically served; the only
# read path is the admin-only route in routes/admin.py. The env override lets
# the test suite wipe a scratch dir instead of the dev DB's real screenshots.
UPLOAD_DIR = Path(
    os.environ.get("DONATIONS_UPLOAD_DIR")
    or Path(__file__).resolve().parents[2] / "uploads" / "donations"
)
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_AMOUNT = 10000

_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_JPEG_MAGIC = b"\xff\xd8\xff"


async def _read_capped(file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(64 * 1024):
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "Screenshot too large (max 5 MB).")
        chunks.append(chunk)
    return b"".join(chunks)


def _detect_image(raw: bytes) -> str:
    """Trust magic bytes, not the filename/extension someone sends us."""
    if raw.startswith(_PNG_MAGIC):
        return "png"
    if raw.startswith(_JPEG_MAGIC):
        return "jpg"
    raise HTTPException(415, "Send a PNG or JPEG screenshot.")


@router.get("/supporters", response_model=list[SupporterOut])
def list_supporters(db: Session = Depends(get_db)):
    """Public wall — approved donations only, anonymity respected.

    Returns created_at so the frontend can group the list month-wise.
    """
    rows = (
        db.query(Donation)
        .filter(Donation.status == "approved")
        .order_by(Donation.created_at.desc())
        .all()
    )
    return [
        SupporterOut(
            name="Anonymous" if row.anonymous else row.name,  # type: ignore
            message=row.message,
            created_at=row.created_at,  # type: ignore
        )
        for row in rows
    ]


@router.get("/supporters/progress", response_model=ProgressOut)
def support_progress(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def _agg(extra_filter=None):
        q = db.query(
            func.coalesce(func.sum(Donation.amount), 0),
            func.count(Donation.id),
        ).filter(Donation.status == "approved")
        if extra_filter is not None:
            q = q.filter(extra_filter)
        raised, count = q.one()
        return int(raised), int(count)

    life_raised, life_count = _agg()
    month_raised, month_count = _agg(Donation.created_at >= month_start)

    return ProgressOut(
        month_raised=month_raised,
        goal=settings.DONATION_GOAL,
        month_count=month_count,
        lifetime_raised=life_raised,
        lifetime_count=life_count,
    )


@router.post("/donations", status_code=201)
async def submit_donation(
    name: str = Form(..., min_length=1, max_length=30),
    amount: int = Form(..., ge=1, le=MAX_AMOUNT),
    message: str | None = Form(None, max_length=200),
    admin_note: str | None = Form(None, max_length=200),
    anonymous: bool = Form(False),
    screenshot: UploadFile = File(...),
    usn: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Donor submits proof — lands as `pending` until the admin approves it."""
    user = db.query(AttendanceModel).filter(AttendanceModel.usn == usn).first()
    if user is None:
        raise HTTPException(401, "Login first.")

    # Name is mandatory even for anonymous donors — the admin review needs to
    # know who paid; the public wall masks it via the `anonymous` flag.
    cleaned = name.strip()
    if not cleaned:
        raise HTTPException(422, "Name is required.")

    raw = await _read_capped(screenshot)
    ext = _detect_image(raw)

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"  # server-generated — never trust the client's filename
    (UPLOAD_DIR / filename).write_bytes(raw)

    cleaned_msg = message.strip() if message and message.strip() else None
    cleaned_note = (
        admin_note.strip() if admin_note and admin_note.strip() else None
    )

    db.add(
        Donation(
            usn=usn,
            name=cleaned,
            message=cleaned_msg,
            admin_note=cleaned_note,
            amount=amount,
            anonymous=anonymous,
            screenshot_file=filename,
            status="pending",
        )
    )
    db.commit()
    logger.info("donation submitted: usn=%s amount=%d -> pending", usn, amount)

    return {
        "status": "pending",
        "message": (
            "Thanks! Once your payment is verified, "
            "your supporter perks activate."
        ),
    }
