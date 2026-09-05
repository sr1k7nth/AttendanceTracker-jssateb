from pydantic import BaseModel, ConfigDict
from datetime import datetime


class UserPayload(BaseModel):
    usn: str


class UserScrapeRequest(BaseModel):
    password: str


class UserLogin(BaseModel):
    usn: str
    password: str
    leaderboard_opt: bool


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
