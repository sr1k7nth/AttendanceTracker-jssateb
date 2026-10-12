from typing import Annotated
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    SecretStr,
    StringConstraints,
    computed_field,
    model_validator,
)
from datetime import datetime

from .metrics import compute_metrics


class UserPayload(BaseModel):
    usn: str


class UserLogin(BaseModel):
    usn: str
    password: SecretStr
    alias: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)
    ] | None = None
    leaderboard_opt: bool

    @model_validator(mode="after")
    def check_alias_if_leaderboard(self):
        if self.leaderboard_opt and not self.alias:
            raise ValueError("Alias is required when joining the leaderboard")
        return self


class AbsentSchema(BaseModel):
    day: str
    date: str
    course: str
    attendance: str


class SummarySchema(BaseModel):
    no: str
    code: str
    name: str
    classes: str
    present: str
    percentage: str


class AttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    usn: str
    alias: str | None = None
    summary: list
    absent_periods: list
    total_avg: float
    timestamp: datetime
    leaderboard_opt: bool
    sem: int | None = None
    branch: str | None = None
    timetable: dict | None = None
    is_supporter: bool = False

    # Derived from `summary` at response time rather than stored in the DB —
    # `total_avg` above is the only metric that needs a column (leaderboard
    # ORDER BY). `summary or []` keeps legacy NULL rows returning zeros.
    @computed_field
    @property
    def can_miss85(self) -> int:
        return compute_metrics(self.summary or [])["can_miss85"]

    @computed_field
    @property
    def can_miss75(self) -> int:
        return compute_metrics(self.summary or [])["can_miss75"]

    @computed_field
    @property
    def need_to_attend85(self) -> int:
        return compute_metrics(self.summary or [])["need_to_attend85"]

    @computed_field
    @property
    def need_to_attend75(self) -> int:
        return compute_metrics(self.summary or [])["need_to_attend75"]


class LeaderboardResponse(BaseModel):
    alias: str | None = None
    total_avg: float
    timestamp: datetime
    branch: str | None = None
    rank: int
    is_me: bool
    is_supporter: bool = False


# --- donations / supporters -------------------------------------------------


class SupporterOut(BaseModel):
    """One row of the public supporters wall (never exposes usn/amount)."""

    name: str
    message: str | None = None
    created_at: datetime


class ProgressOut(BaseModel):
    month_raised: int
    goal: int
    month_count: int
    lifetime_raised: int
    lifetime_count: int


class DonationPendingOut(BaseModel):
    """Admin queue view — includes the account the perk will land on."""

    id: int
    usn: str
    name: str
    message: str | None = None
    admin_note: str | None = None
    amount: int
    anonymous: bool
    created_at: datetime
    screenshot_url: str


class ApproveRequest(BaseModel):
    # None = keep the donor-entered amount; set it to fix a typo before approving
    amount: int | None = Field(default=None, ge=1, le=10000)
