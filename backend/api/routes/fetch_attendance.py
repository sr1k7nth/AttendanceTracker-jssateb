from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..oauth import get_current_user
from ..database import get_db
from ..models import Attendance as AttendanceModel
from ..schemas import AttendanceResponse, UserPayload

router = APIRouter(prefix="/fetch_attendance", tags=["Fetch Attendance"])


class LoginError(Exception):
    pass


@router.get("/", response_model=AttendanceResponse)
def get_attendance(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = (
        db.query(AttendanceModel)
        .filter(AttendanceModel.usn == current_user)
        .first()
    )

    if user is None:
        raise HTTPException(status_code=401, detail="Register/Login first")

    return user
