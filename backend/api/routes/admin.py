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
from ..models import Feedback
from ..oauth import get_current_user
from ..schemas import (
    ApproveRequest,
    DonationPendingOut,
    DonationReviewedOut,
    FeedbackOut,
    FeedbackReplyRequest,
    LatestLoginOut,
    RejectRequest,
)
from .donations import UPLOAD_DIR
from .feedback import UPLOAD_DIR as FEEDBACK_DIR

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
    if (
        not settings.ADMIN_PANEL_USERNAME
        or not settings.ADMIN_PANEL_PASSWORD
        or not settings.ADMIN_USN
    ):
        raise HTTPException(503, "Admin panel is not configured.")
    if usn != settings.ADMIN_USN:
        raise HTTPException(403, "Not authorized.")
    if not x_admin_auth:
        raise HTTPException(401, "Missing admin panel credentials.")
    try:
        decoded = base64.b64decode(x_admin_auth, validate=True).decode("utf-8")
        username, _, password = decoded.partition(":")
    except (binascii.Error, UnicodeDecodeError):
        raise HTTPException(401, "Invalid admin credentials.") from None
    # Username compares case-insensitively, matching the login gate in
    # routes/scrape.py: the login form normalises its input (uppercases on
    # keystroke, stores panel_creds lowercased), so a session carried over
    # from the login page must unlock the panel whatever the case. The
    # password stays exact.
    ok_user = secrets.compare_digest(
        username.lower(), settings.ADMIN_PANEL_USERNAME.lower()
    )
    ok_pass = secrets.compare_digest(password, settings.ADMIN_PANEL_PASSWORD)
    if not (ok_user and ok_pass):
        raise HTTPException(401, "Invalid admin credentials.")
    return usn


def _get_pending(donation_id: int, db: Session) -> Donation:
    row = db.query(Donation).filter(Donation.id == donation_id).first()
    if row is None:
        raise HTTPException(404, "Donation not found.")
    if row.status != "pending":  # type: ignore
        raise HTTPException(409, f"Already reviewed (status={row.status}).")
    return row


def _delete_screenshot(row: Donation, db: Session) -> None:
    """Free the proof file once a donation is reviewed — no worker needed,
    the endpoint itself does the cleanup. Best effort: if the unlink fails
    the row still says None and an orphan file is harmless (never served)."""
    if row.screenshot_file:  # type: ignore[truthy-function]
        try:
            (UPLOAD_DIR / row.screenshot_file).unlink(missing_ok=True)  # type: ignore[operator]
        except OSError:
            logger.warning("could not delete screenshot for donation %d", row.id)
    row.screenshot_file = None  # type: ignore[assignment]
    db.commit()


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
            message=row.message,  # type: ignore
            admin_note=row.admin_note,  # type: ignore
            amount=row.amount,  # type: ignore
            anonymous=row.anonymous,  # type: ignore
            created_at=row.created_at,  # type: ignore
            screenshot_url=f"/admin/donations/{row.id}/screenshot",  # type: ignore
        )
        for row in rows
    ]


@router.get("/feedback", response_model=list[FeedbackOut])
def list_feedback(
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin),
):
    """All feedback submissions, newest first — the review inbox."""
    rows = db.query(Feedback).order_by(Feedback.created_at.desc()).limit(200).all()
    return [
        FeedbackOut(
            id=row.id,  # type: ignore
            usn=row.usn,  # type: ignore
            category=row.category,  # type: ignore
            message=row.message,  # type: ignore
            status=row.status,  # type: ignore
            reply=row.reply,  # type: ignore
            replied_at=row.replied_at,  # type: ignore
            last_scraped_at=row.last_scraped_at,  # type: ignore
            created_at=row.created_at,  # type: ignore
            screenshot_url=(
                f"/admin/feedback/{row.id}/screenshot"
                if row.screenshot_file
                else None
            ),
        )
        for row in rows
    ]


@router.get("/feedback/{feedback_id}/screenshot")
def feedback_screenshot(
    feedback_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin),
):
    """The only path that ever serves a feedback screenshot."""
    row = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if row is None:
        raise HTTPException(404, "Feedback not found.")
    if not row.screenshot_file:  # type: ignore[truthy-function]
        raise HTTPException(404, "No screenshot attached.")
    path = FEEDBACK_DIR / row.screenshot_file  # type: ignore[operator]
    if not path.is_file():
        raise HTTPException(404, "Screenshot file missing.")
    media = "image/png" if path.suffix == ".png" else "image/jpeg"
    return FileResponse(path, media_type=media, filename=path.name)


@router.post("/feedback/{feedback_id}/reply")
def reply_feedback(
    feedback_id: int,
    body: FeedbackReplyRequest,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin),
):
    """Answer a submission — the user sees it as a summary-page banner.

    Empty reply clears an existing one (undo); any reply marks the row
    reviewed and stamps replied_at.
    """
    row = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if row is None:
        raise HTTPException(404, "Feedback not found.")
    cleaned = body.reply.strip()
    row.reply = cleaned or None  # type: ignore[assignment]
    row.replied_at = datetime.now(timezone.utc) if cleaned else None  # type: ignore[assignment]
    row.status = "reviewed"  # type: ignore[assignment]
    db.commit()
    logger.info("feedback %d replied: usn=%s", row.id, row.usn)
    return {"status": "replied", "id": row.id, "reply": row.reply}


@router.get("/latest", response_model=list[LatestLoginOut])
def latest_logins(
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin),
):
    """The whole attendance table — who re-scraped the portal, latest first.

    No row limit: the table is one row per user, so its size is bounded by
    the user base. Times are tz-aware ISO; the frontend renders them in IST.
    USNs are hashed so the raw portal ID isn't exposed in this panel.
    """
    rows = (
        db.query(AttendanceModel)
        .order_by(AttendanceModel.timestamp.desc())
        .all()
    )
    return [
        LatestLoginOut(
            usn="#" + hashlib.sha256(str(row.usn).encode("utf-8")).hexdigest()[:12],  # type: ignore
            alias=row.alias,
            total_avg=row.total_avg,
            branch=row.branch,
            sem=row.sem,
            is_supporter=bool(row.is_supporter),  # type: ignore[arg-type]
            timestamp=row.timestamp,  # type: ignore[arg-type]
        )
        for row in rows
    ]


@router.get("/donations/reviewed", response_model=list[DonationReviewedOut])
def reviewed_donations(
    status: str = "approved",
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin),
):
    """History tabs — approved and rejected donations, newest review first.

    The proof file is deleted at review time, so these are metadata rows only.
    """
    if status not in ("approved", "rejected"):
        raise HTTPException(422, "status must be 'approved' or 'rejected'.")
    rows = (
        db.query(Donation)
        .filter(Donation.status == status)
        .order_by(Donation.reviewed_at.desc().nullslast(), Donation.created_at.desc())
        .limit(200)
        .all()
    )
    return [
        DonationReviewedOut(
            id=row.id,  # type: ignore
            usn=row.usn,  # type: ignore
            name=row.name,  # type: ignore
            amount=row.amount,  # type: ignore
            anonymous=row.anonymous,  # type: ignore
            status=row.status,  # type: ignore
            reject_reason=row.reject_reason,  # type: ignore
            created_at=row.created_at,  # type: ignore
            reviewed_at=row.reviewed_at,  # type: ignore
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
    if row.screenshot_file is None:  # type: ignore[attr-defined]
        raise HTTPException(404, "Screenshot removed after review.")
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
    _delete_screenshot(row, db)
    logger.info("donation %d approved: usn=%s amount=%d", row.id, row.usn, row.amount)
    return {
        "status": "approved",
        "usn": row.usn,
        "amount": row.amount,
    }


@router.post("/donations/{donation_id}/reject")
def reject_donation(
    donation_id: int,
    body: RejectRequest | None = None,
    db: Session = Depends(get_db),
    _admin: str = Depends(require_admin),
):
    row = _get_pending(donation_id, db)
    reason = (body.reason.strip() if body and body.reason else "") or (
        "Payment could not be verified."
    )
    row.status = "rejected"
    row.reject_reason = reason[:200]
    row.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    _delete_screenshot(row, db)
    logger.info("donation %d rejected: usn=%s", row.id, row.usn)
    return {"status": "rejected", "id": row.id}
