import uuid
from typing import Literal

from pydantic import BaseModel, Field

SessionType = Literal[
    "wellness", "relief", "yoga", "meditation", "breathing", "acupressure"
]


class SaveTherapySessionRequest(BaseModel):
    group_id: uuid.UUID = Field(alias="groupId")
    video_id: uuid.UUID = Field(alias="videoId")
    type: SessionType
    duration_minutes: int = Field(alias="durationMinutes")
    status: str = Field(default="Completed", max_length=20)
    pain_before: int | None = Field(default=None, alias="painBefore", ge=0, le=10)
    pain_after: int | None = Field(default=None, alias="painAfter", ge=0, le=10)
    is_active: bool = Field(default=True, alias="isActive")
