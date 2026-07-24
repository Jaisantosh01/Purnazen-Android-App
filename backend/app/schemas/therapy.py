import uuid
from typing import Literal, Optional

from pydantic import BaseModel, Field

SessionType = Literal[
    "wellness", "relief", "yoga", "meditation", "breathing", "acupressure"
]


class SaveTherapySessionRequest(BaseModel):
    group_id: uuid.UUID = Field(alias="groupId")
    video_id: uuid.UUID = Field(alias="videoId")
    type: SessionType
    session_group_id: Optional[uuid.UUID] = Field(default=None, alias="sessionGroupId")
    duration_minutes: int = Field(alias="durationMinutes")
    status: str = Field(default="Completed", max_length=20)
    is_active: bool = Field(default=True, alias="isActive")


class CreateTherapyFeedbackRequest(BaseModel):
    video_group_id: uuid.UUID = Field(alias="videoGroupId")
    session_type: SessionType = Field(alias="sessionType")
    session_group_id: Optional[uuid.UUID] = Field(default=None, alias="sessionGroupId")
    pain_before: int | None = Field(default=None, alias="painBefore", ge=0, le=10)
    user_pain_description: str | None = Field(default=None, alias="userPainDescription", max_length=500)


class UpdatePainAfterFeedbackRequest(BaseModel):
    pain_after: int | None = Field(default=None, alias="painAfter", ge=0, le=10)
    user_feedback: str | None = Field(default=None, alias="userFeedback", max_length=1000)


class UpdateDoctorFeedbackRequest(BaseModel):
    doctor_feedback: str = Field(alias="doctorFeedback", max_length=1000)


class UpdateAdminFeedbackRequest(BaseModel):
    admin_feedback: str = Field(alias="adminFeedback", max_length=1000)


class StartSessionRequest(BaseModel):
    group_id: uuid.UUID = Field(alias="groupId")
    session_type: SessionType = Field(alias="sessionType")


class CompleteSessionRequest(BaseModel):
    pain_after: int | None = Field(default=None, alias="painAfter", ge=0, le=10)
    user_feedback: str | None = Field(default=None, alias="userFeedback", max_length=1000)
