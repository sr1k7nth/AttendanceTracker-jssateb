from .config import settings
from .database import Base
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    func,
    null,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB


class Attendance(Base):
    __tablename__ = "attendance"
    usn = Column(String, primary_key=True, nullable=False)
    alias = Column(String(30), nullable=True)
    summary = Column(JSONB)
    absent_periods = Column(JSONB)
    timetable = Column(JSONB)
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
    # Follows settings.FREE_REQUESTS_PER_DAY so a quota flip is .env-only
    request_left = Column(Integer, default=lambda: settings.FREE_REQUESTS_PER_DAY)
    is_supporter = Column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )


class Donation(Base):
    __tablename__ = "donations"

    id = Column(Integer, primary_key=True)
    usn = Column(String, ForeignKey("attendance.usn"), nullable=False)
    name = Column(String(30), nullable=False)
    message = Column(String(200), nullable=True)
    # Private note from the donor to the admin — never leaves the review
    # queue (the public wall's SupporterOut has no such field).
    admin_note = Column(String(200), nullable=True)
    amount = Column(Integer, nullable=False)
    anonymous = Column(Boolean, nullable=False, default=False)
    screenshot_file = Column(String, nullable=False)
    status = Column(String(16), nullable=False, default="pending")
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
