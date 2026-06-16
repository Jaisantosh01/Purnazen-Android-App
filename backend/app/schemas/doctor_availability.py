from pydantic import BaseModel


class DoctorAvailabilityCreate(BaseModel):
    doctor_id: int
    day_of_week: str
    start_time: str
    end_time: str
    slot_duration_minutes: int = 30


class DoctorAvailabilityUpdate(BaseModel):
    day_of_week: str
    start_time: str
    end_time: str
    slot_duration_minutes: int