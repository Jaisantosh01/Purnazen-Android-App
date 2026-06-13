from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SessionType = Literal[
    "wellness", "relief", "yoga", "meditation", "breathing", "acupressure"
]


class SaveTherapySessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(min_length=1, max_length=150)
    type: SessionType
    date: datetime
    duration: str | int
    status: str = Field(default="Completed", max_length=20)
    pain_before: int | None = Field(default=None, alias="painBefore", ge=0, le=10)
    pain_after: int | None = Field(default=None, alias="painAfter", ge=0, le=10)
