from typing import Annotated
from pydantic import BaseModel, ConfigDict, SecretStr, StringConstraints, model_validator
from datetime import datetime


class UserPayload(BaseModel):
    usn: str


class UserScrapeRequest(BaseModel):
    password: SecretStr


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
    request_left: int


class LeaderboardResponse(BaseModel):
    alias: str | None = None
    total_avg: float
    timestamp: datetime
    branch: str | None = None
    rank: int
    is_me: bool
