from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Canonical record types accepted by the API.
RECORD_TYPES = {"doctor_note", "diagnosis", "prescription"}


class CreateConsultationRecordRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    record_type: str = Field(alias="recordType", min_length=1, max_length=20)
    content: str = Field(min_length=1)

    @field_validator("record_type")
    @classmethod
    def _valid_type(cls, v: str) -> str:
        if v not in RECORD_TYPES:
            raise ValueError(f"record_type must be one of {sorted(RECORD_TYPES)}")
        return v

    @field_validator("content")
    @classmethod
    def _trim_content(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("content cannot be empty")
        return v


class UpdateConsultationRecordRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    content: Optional[str] = None

    @field_validator("content")
    @classmethod
    def _trim_content(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("content cannot be empty")
        return v
