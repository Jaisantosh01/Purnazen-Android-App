from datetime import date, datetime, time
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ── Valid values ──────────────────────────────────────────────────────────────

LEAVE_TYPES = {"single", "multiple", "custom"}
LEAVE_STATUSES = {"pending", "approved", "rejected", "cancelled"}


# ── Sub-schemas ───────────────────────────────────────────────────────────────


class DoctorLeaveSlotResponse(BaseModel):
    """Slim representation of a linked slot timing returned inside a leave response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slot_timing_id: UUID


# ── Request schemas ───────────────────────────────────────────────────────────


class DoctorLeaveCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # Required
    leave_type: str = Field(alias="leaveType")
    start_date: date = Field(alias="startDate")
    end_date: date = Field(alias="endDate")
    reason: str = Field(min_length=1, max_length=255)

    # Optional
    start_time: Optional[time] = Field(alias="startTime", default=None)
    end_time: Optional[time] = Field(alias="endTime", default=None)
    notes: Optional[str] = None

    # Slot timing IDs — only used when leave_type == 'custom'
    slot_timing_ids: Optional[List[UUID]] = Field(alias="slotTimingIds", default=None)

    @field_validator("leave_type")
    @classmethod
    def _valid_leave_type(cls, v: str) -> str:
        if v not in LEAVE_TYPES:
            raise ValueError(f"leave_type must be one of {sorted(LEAVE_TYPES)}")
        return v

    @field_validator("reason")
    @classmethod
    def _trim_reason(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("reason cannot be empty or whitespace only")
        return v

    @field_validator("end_date")
    @classmethod
    def _end_not_before_start(cls, v: date, info) -> date:
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("end_date cannot be earlier than start_date")
        return v


class DoctorLeaveUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    start_date: Optional[date] = Field(alias="startDate", default=None)
    end_date: Optional[date] = Field(alias="endDate", default=None)
    start_time: Optional[time] = Field(alias="startTime", default=None)
    end_time: Optional[time] = Field(alias="endTime", default=None)
    reason: Optional[str] = None
    notes: Optional[str] = None
    slot_timing_ids: Optional[List[UUID]] = Field(alias="slotTimingIds", default=None)

    @field_validator("reason")
    @classmethod
    def _trim_reason(cls, v) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("reason cannot be empty or whitespace only")
        return v


class DoctorLeaveStatusUpdate(BaseModel):
    """Used by admin to approve / reject a leave request."""

    status: str
    admin_reason: Optional[str] = Field(alias="adminReason", default=None)

    @field_validator("status")
    @classmethod
    def _valid_status(cls, v: str) -> str:
        if v not in LEAVE_STATUSES:
            raise ValueError(f"status must be one of {sorted(LEAVE_STATUSES)}")
        return v


# ── Response schema ───────────────────────────────────────────────────────────


class DoctorLeaveResponse(BaseModel):
    """Full leave record returned to API callers."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    doctor_id: UUID = Field(serialization_alias="doctorId")

    leave_type: str = Field(serialization_alias="leaveType")
    start_date: date = Field(serialization_alias="startDate")
    end_date: date = Field(serialization_alias="endDate")
    start_time: Optional[time] = Field(serialization_alias="startTime")
    end_time: Optional[time] = Field(serialization_alias="endTime")

    reason: Optional[str] = None
    notes: Optional[str] = None
    admin_reason: Optional[str] = Field(serialization_alias="adminReason")

    status: str
    is_active: bool = Field(serialization_alias="isActive")

    approved_by: Optional[UUID] = Field(serialization_alias="approvedBy")
    approved_at: Optional[datetime] = Field(serialization_alias="approvedAt")
    applied_at: Optional[datetime] = Field(serialization_alias="appliedAt")

    created_at: Optional[datetime] = Field(serialization_alias="createdAt")
    updated_at: Optional[datetime] = Field(serialization_alias="updatedAt")

    # Linked slot timings (populated only for custom leave)
    slots: List[DoctorLeaveSlotResponse] = []
