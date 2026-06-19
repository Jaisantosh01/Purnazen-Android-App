from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Time,
    Boolean,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
import uuid
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Appointment(Base):
    __tablename__ = "appointments" 

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False)
    consultation_type_id = Column(UUID(as_uuid=True), ForeignKey("consultation_types.id"))
    visit_type = Column(String(20), nullable=False)
    date = Column(Date, nullable=False)
    slot_start = Column(Time, nullable=False)
    slot_end = Column(Time, nullable=False)
    fee = Column(Numeric(10, 2))
    status = Column(String(20), nullable=False, default="booked")  # booked | cancelled | completed
    payment_status = Column(
        String(20), nullable=False, default="unpaid", server_default="unpaid"
    )  # unpaid | paid
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    user = relationship("User",foreign_keys=[user_id],backref="appointments")
    doctor = relationship("Doctor", backref="appointments")
    consultation_type = relationship("ConsultationType")

    __table_args__ = (Index("ix_appointments_doctor_date", "doctor_id", "date"),)

    @property
    def reference(self):
        # id is a UUID; produce a short readable reference
        return f"APT-{str(self.id)[:8].upper()}"

    def to_dict(self):
        return {
            "id": self.id,
            "reference": self.reference,
            "doctorId": str(self.doctor_id),
            "doctorName": f"Dr. {self.doctor.user.full_name}",
            "specialty": self.doctor.specialty.name,
            "visitType": self.visit_type,
            "date": self.date.isoformat(),
            "time": self.slot_start.strftime("%I:%M %p"),
            "slotStart": self.slot_start.strftime("%H:%M"),
            "slotEnd": self.slot_end.strftime("%H:%M"),
            "fee": float(self.fee) if self.fee is not None else None,
            "status": self.status,
            "paymentStatus": self.payment_status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
