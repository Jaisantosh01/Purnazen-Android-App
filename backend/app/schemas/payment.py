from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProcessPaymentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    amount: float = Field(gt=0)
    appointment_id: UUID | None = Field(default=None, alias="appointmentId")
    doctor_id: UUID | None = Field(default=None, alias="doctorId")
    method: str | None = Field(default=None, max_length=20)
    currency: str = Field(default="INR", max_length=10)


class VerifyPaymentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    order_id: str = Field(alias="orderId", min_length=1)
    payment_id: str = Field(alias="paymentId", min_length=1)
    signature: str = Field(min_length=1)
