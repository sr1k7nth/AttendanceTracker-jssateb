from typing import Annotated
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    SecretStr,
    StringConstraints,
    model_validator,
)
from datetime import datetime


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


class UserResponse(BaseModel):
    summary: list[SummarySchema]
    absent_periods: list[AbsentSchema]
    total_avg: float
    can_miss85: int
    can_miss75: int
    need_to_attend85: int
    need_to_attend75: int


class AttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    usn: str
    alias: str | None = None
    summary: list
    absent_periods: list
    total_avg: float
    can_miss85: int
    can_miss75: int
    need_to_attend85: int
    need_to_attend75: int
    timestamp: datetime
    leaderboard_opt: bool
    sem: int | None = None
    branch: str | None = None
    timetable: dict | None = None
    is_supporter: bool = False


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
