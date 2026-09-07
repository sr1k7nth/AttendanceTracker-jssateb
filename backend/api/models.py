from .database import Base
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    func,
    null,
)
from sqlalchemy.dialects.postgresql import JSONB


class Attendance(Base):
    __tablename__ = "attendance"
    usn = Column(String, primary_key=True, nullable=False)
    summary = Column(JSONB)
    absent_periods = Column(JSONB)
    total_avg = Column(Float)
    can_miss85 = Column(Integer)
    can_miss75 = Column(Integer)
    need_to_attend85 = Column(Integer)
    need_to_attend75 = Column(Integer)
    timestamp = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    leaderboard_opt = Column(Boolean, default=False)
    sem = Column(Integer)
    branch = Column(String)
    request_left = Column(Integer, default=4)
