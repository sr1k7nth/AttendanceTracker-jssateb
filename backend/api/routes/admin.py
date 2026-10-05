import base64
import binascii
import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Attendance as AttendanceModel
from ..models import Donation
from ..oauth import get_current_user
from ..schemas import ApproveRequest, DonationPendingOut
from .donations import UPLOAD_DIR
from .scrape import ADMIN_USN

router = APIRouter(prefix="/admin", tags=["Admin"])

logger = logging.getLogger("donations")


def require_admin(
    x_admin_auth: str | None = Header(default=None, alias="X-Admin-Auth"),
    usn: str = Depends(get_current_user),
) -> str:
    """Double gate: a normal admin JWT *and* the panel password.

    The panel credentials ride X-Admin-Auth (base64 "user:pass") because the
    Authorization header is already taken by the Bearer token — one header
    can't hold both schemes.
    """
    if not settings.ADMIN_PANEL_USERNAME or not settings.ADMIN_PANEL_PASSWORD:
        raise HTTPException(503, "Admin panel is not configured.")
    if usn != ADMIN_USN:
        raise HTTPException(403, "Not authorized.")
    if not x_admin_auth:
        raise HTTPException(401, "Missing admin panel credentials.")
    try:
        decoded = base64.b64decode(x_admin_auth, validate=True).decode("utf-8")
        username, _, password = decoded.partition(":")
    except (binascii.Error, UnicodeDecodeError):
        raise HTTPException(401, "Invalid admin credentials.") from None
    ok_user = secrets.compare_digest(username, settings.ADMIN_PANEL_USERNAME)
    ok_pass = secrets.compare_digest(password, settings.ADMIN_PANEL_PASSWORD)
    if not (ok_user and ok_pass):
        raise HTTPException(401, "Invalid admin credentials.")
    return usn


def _get_pending(donation_id: int, db: Session) -> Donation:
    row = db.query(Donation).filter(Donation.id == donation_id).first()
    if row is None:
        raise HTTPException(404, "Donation not found.")
    if row.status != "pending":
        raise HTTPException(409, f"Already reviewed (status={row.status}).")
    return row


@router.get("/donations/pending", response_model=list[DonationPendingOut])
def pending_donations(
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin),
):
    rows = (
        db.query(Donation)
        .filter(Donation.status == "pending")
        .order_by(Donation.created_at)
        .all()
    )
    return [
        DonationPendingOut(
            id=row.id,  # type: ignore
            usn=row.usn,  # type: ignore
            name=row.name,  # type: ignore
            message=row.message,
            admin_note=row.admin_note,
            amount=row.amount,  # type: ignore
            anonymous=row.anonymous,  # type: ignore
            created_at=row.created_at,  # type: ignore
            screenshot_url=f"/admin/donations/{row.id}/screenshot",  # type: ignore
        )
        for row in rows
    ]


@router.get("/donations/{donation_id}/screenshot")
def donation_screenshot(
    donation_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin),
):
    """The only path in the app that ever serves a screenshot."""
    row = db.query(Donation).filter(Donation.id == donation_id).first()
    if row is None:
        raise HTTPException(404, "Donation not found.")
    path = UPLOAD_DIR / row.screenshot_file  # type: ignore[operator]
    if not path.is_file():
        raise HTTPException(404, "Screenshot file missing.")
    media = "image/png" if path.suffix == ".png" else "image/jpeg"
    return FileResponse(path, media_type=media, filename=path.name)


@router.post("/donations/{donation_id}/approve")
def approve_donation(
    donation_id: int,
    body: ApproveRequest | None = None,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin),
):
    """One action = verified: donation approved and the supporter perk granted."""
    row = _get_pending(donation_id, db)
    user = db.query(AttendanceModel).filter(AttendanceModel.usn == row.usn).first()
    if user is None:
        raise HTTPException(409, "Linked account missing.")

    if body and body.amount is not None:
        row.amount = body.amount  # admin corrected a fat-fingered amount
    row.status = "approved"
    row.reviewed_at = datetime.now(timezone.utc)
    user.is_supporter = True  # type: ignore[assignment]
    db.commit()
    logger.info(
        "donation %d approved: usn=%s amount=%d", row.id, row.usn, row.amount
    )
    return {
        "status": "approved",
        "usn": row.usn,
        "amount": row.amount,
    }


@router.post("/donations/{donation_id}/reject")
def reject_donation(
    donation_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin),
):
    row = _get_pending(donation_id, db)
    row.status = "rejected"
    row.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "rejected", "id": row.id}
