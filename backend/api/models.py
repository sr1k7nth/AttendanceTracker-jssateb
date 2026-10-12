from .database import Base
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
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
    timestamp = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    leaderboard_opt = Column(Boolean, default=False)
    sem = Column(Integer)
    branch = Column(String)
    # Legacy column from the old daily-quota feature. Nothing reads or writes it
    # any more (there is no limit to count down); kept so the model still matches
    # the live table without needing a migration.
    request_left = Column(Integer, nullable=True)
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


class AttendanceHistory(Base):
    """One checkpoint per login — the attendance-progression graph.

    Only the overall percentage is tracked; the per-subject breakdown lives
    in `attendance.summary` and is overwritten on every scrape.
    """

    __tablename__ = "attendance_history"
    __table_args__ = (
        Index("ix_attendance_history_usn_recorded_at", "usn", "recorded_at"),
    )

    id = Column(Integer, primary_key=True)
    usn = Column(
        String, ForeignKey("attendance.usn", ondelete="CASCADE"), nullable=False
    )
    total_avg = Column(Float, nullable=False)
    recorded_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
