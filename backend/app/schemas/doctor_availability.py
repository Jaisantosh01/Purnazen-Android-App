from pydantic import BaseModel
from uuid import UUID


class DoctorAvailabilityCreate(BaseModel):
    doctor_id: int
    slot_timing_id: UUID


class DoctorAvailabilityUpdate(BaseModel):
    slot_timing_id: UUID