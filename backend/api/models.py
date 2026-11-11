from .database import Base
from sqlalchemy import (
    Boolean,
    Column,
    Date,
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
    # ondelete CASCADE matches the live DB constraint (alembic check drift otherwise)
    usn = Column(
        String, ForeignKey("attendance.usn", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(30), nullable=False)
    message = Column(String(200), nullable=True)
    # Private note from the donor to the admin — never leaves the review
    # queue (the public wall's SupporterOut has no such field).
    admin_note = Column(String(200), nullable=True)
    amount = Column(Integer, nullable=False)
    anonymous = Column(Boolean, nullable=False, default=False)
    # Nullable: the file is deleted the moment the donation is reviewed —
    # the row itself stays as the audit trail.
    screenshot_file = Column(String, nullable=True)
    status = Column(String(16), nullable=False, default="pending")
    # Why a proof was bounced — shown to the donor on their summary page.
    reject_reason = Column(String(200), nullable=True)
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


class WeeklyTimetable(Base):
    """One stored week of the portal's period grid, per student.

    `week_start` is the Monday the portal page names (dd/mm/yyyy on the
    page, stored as a date). The current in-progress week upserts itself on
    every scrape; past weeks are captured once (first scrape: the previous
    four, then one more each time a new week begins) and stay frozen.
    """

    __tablename__ = "weekly_timetables"
    __table_args__ = (
        Index("ix_weekly_timetables_usn_week", "usn", "week_start", unique=True),
    )

    id = Column(Integer, primary_key=True)
    usn = Column(
        String, ForeignKey("attendance.usn", ondelete="CASCADE"), nullable=False
    )
    week_start = Column(Date, nullable=False)
    timetable = Column(JSONB, nullable=False)
    scraped_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Feedback(Base):
    """In-app feedback — one of four categories, optionally with a screenshot.

    `error` and `data_removal` submissions must carry a screenshot; for
    `data_removal` the user's last portal scrape time is stored alongside as
    the identity proof. Rate limit: 3 per user per sliding day.
    """

    __tablename__ = "feedback"
    __table_args__ = (
        Index("ix_feedback_usn_created_at", "usn", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    usn = Column(
        String, ForeignKey("attendance.usn", ondelete="CASCADE"), nullable=False
    )
    category = Column(String(16), nullable=False)  # feedback|error|feature|data_removal
    message = Column(String(1000), nullable=True)
    screenshot_file = Column(String, nullable=True)
    status = Column(String(16), nullable=False, default="new")
    # data_removal proof — the user's last scrape when they submitted
    last_scraped_at = Column(DateTime(timezone=True), nullable=True)
    # Admin's answer — shown to the user as a summary-page banner
    reply = Column(String(1000), nullable=True)
    replied_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class LoginAttempt(Base):
    """Rejected portal logins — the per-USN failure rate limit.

    Failures only: successful scrapes are already counted one-per-login by
    attendance_history (that count is the daily cap), so this table exists
    purely to answer "was this key rejected N times recently?". Written by
    routes/scrape.py on a 401, cleared for that key on the next success.
    """

    __tablename__ = "login_attempts"
    __table_args__ = (
        Index("ix_login_attempts_key_created_at", "key", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    key = Column(String, nullable=False)  # lowercased submitted USN
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
