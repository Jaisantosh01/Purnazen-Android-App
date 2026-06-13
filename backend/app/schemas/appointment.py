from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class BookAppointmentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    doctor_id: int = Field(alias="doctorId")
    visit_type: str = Field(alias="visitType", min_length=1, max_length=20)
    date: date
    time: str = Field(min_length=1)
    fee: float | None = None
