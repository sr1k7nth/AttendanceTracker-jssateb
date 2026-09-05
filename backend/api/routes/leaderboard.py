from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Attendance as AttendanceModel
from ..oauth import get_current_user
from ..schemas import AttendanceResponse
from sqlalchemy import desc, asc

router = APIRouter(tags=["Leaderboard"])


@router.get("/leaderboard", response_model=list[AttendanceResponse])
def leaderboard(
    db: Session = Depends(get_db),
    usn: str = Depends(get_current_user),
    sort: str = "desc",
    branch: str = "ALL",
):
    current_user = db.query(AttendanceModel).filter(AttendanceModel.usn == usn).first()

    if not current_user or not current_user.leaderboard_opt:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User hasn't opted for leaderboard",
        )

    query = db.query(AttendanceModel).filter(
        AttendanceModel.leaderboard_opt == True,
        AttendanceModel.sem == current_user.sem,
    )

    if sort == "desc":
        query = query.order_by(desc(AttendanceModel.total_avg))
    else:
        query = query.order_by(asc(AttendanceModel.total_avg))
    if branch != "ALL":
        query = query.filter(AttendanceModel.branch == branch)

    users = query.all()
    return users
