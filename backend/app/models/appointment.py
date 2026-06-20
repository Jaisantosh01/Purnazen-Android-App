import uuid

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Boolean,
    func,
)
from app.db.types import GUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Appointment(Base):
    __tablename__ = "appointments" 

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    doctor_id = Column(GUID(), ForeignKey("doctors.id"), nullable=False)
    consultation_type_id = Column(GUID(), ForeignKey("consultation_types.id"))
    visit_type = Column(String(20), nullable=False)
    date = Column(Date, nullable=False)
    slot_timing_id = Column(GUID(), ForeignKey("slot_timings.id"), nullable=False)
    user_description = Column(Text, nullable=True)
    doctor_description = Column(Text, nullable=True)
    fee = Column(Numeric(10, 2))
    status = Column(String(20), nullable=False, default="pending")  # pending | booked | cancelled | completed
    payment_status = Column(
        String(20), nullable=False, default="pending", server_default="pending"
    )  # pending | unpaid | paid
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    user = relationship("User",foreign_keys=[user_id],backref="appointments")
    doctor = relationship("Doctor", backref="appointments")
    consultation_type = relationship("ConsultationType")
    slot_timing = relationship("SlotTimings")

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
            "expertise": [mapping.expertise.name for mapping in self.doctor.expertise_mappings],
            "consultationType": self.visit_type,
            "date": self.date.isoformat(),
            "time": self.slot_timing.start_time.strftime("%I:%M %p") if self.slot_timing else None,
            "endTime": self.slot_timing.end_time.strftime("%I:%M %p") if self.slot_timing else None,
            "slotTimingId": str(self.slot_timing_id),
            "fee": float(self.fee) if self.fee is not None else None,
            "status": self.status,
            "paymentStatus": self.payment_status,
            "userDescription": self.user_description,
            "doctorDescription": self.doctor_description,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
