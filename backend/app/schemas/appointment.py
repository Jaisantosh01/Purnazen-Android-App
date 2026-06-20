from datetime import date
from uuid import UUID
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class BookAppointmentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    doctor_id: UUID = Field(alias="doctorId")
    visit_type: str = Field(alias="visitType", min_length=1, max_length=20)
    date: date
    slot_timing_id: UUID = Field(alias="slotTimingId")
    fee: Optional[float] = None
    user_description: Optional[str] = Field(alias="userDescription", default=None)


class UpdateAppointmentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    visit_type: Optional[str] = Field(alias="visitType", min_length=1, max_length=20, default=None)
    date: Optional[date] = None
    slot_timing_id: Optional[UUID] = Field(alias="slotTimingId", default=None)
    status: Optional[str] = None
    payment_status: Optional[str] = Field(alias="paymentStatus", default=None)
