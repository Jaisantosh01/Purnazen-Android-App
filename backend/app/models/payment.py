from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
import uuid
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id"))
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), nullable=False, default="INR")
    provider = Column(String(30), nullable=False, default="razorpay")
    order_id = Column(String(100), nullable=False, unique=True)
    payment_id = Column(String(100))  # provider payment reference (set on verify)
    method = Column(String(20))  # card | upi | wallet
    status = Column(String(20), nullable=False, default="created")  # created | paid | failed
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    user = relationship("User", backref="payments")
    appointment = relationship("Appointment", backref="payments")

    def to_dict(self):
        return {
            "id": self.id,
            "appointmentId": self.appointment_id,
            "amount": float(self.amount),
            "currency": self.currency,
            "provider": self.provider,
            "orderId": self.order_id,
            "paymentId": self.payment_id,
            "method": self.method,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
