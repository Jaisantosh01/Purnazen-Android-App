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
    clinic_id = Column(GUID(), ForeignKey("clinics.id"), nullable=True)
    user_address_id = Column(GUID(), ForeignKey("user_addresses.id"), nullable=True)
    meeting_link = Column(Text, nullable=True)
    user_description = Column(Text, nullable=True)
    doctor_description = Column(Text, nullable=True)
    fee = Column(Numeric(10, 2))
    status = Column(String(20), nullable=False, default="pending")  # pending | booked | cancelled | completed
    payment_status = Column(
        String(20), nullable=False, default="pending", server_default="pending"
    )  # pending | unpaid | paid
    # Set when the pre-appointment reminder notification has been dispatched,
    # so the scheduler never reminds twice.
    reminder_sent_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    user = relationship("User",foreign_keys=[user_id],backref="appointments")
    doctor = relationship("Doctor", backref="appointments")
    consultation_type = relationship("ConsultationType")
    slot_timing = relationship("SlotTimings")
    clinic = relationship("Clinic")
    user_address = relationship("UserAddress")

    __table_args__ = (Index("ix_appointments_doctor_date", "doctor_id", "date"),)

    @property
    def reference(self):
        # id is a UUID; produce a short readable reference
        return f"APT-{str(self.id)[:8].upper()}"

    def to_dict(self):
        clinic = self.clinic
        user_addr = self.user_address
        return {
            "id": self.id,
            "reference": self.reference,
            "doctorId": str(self.doctor_id),
            "userId": str(self.user_id),
            "userName": self.user.full_name if self.user else None,
            "doctorName": f"Dr. {self.doctor.user.full_name}",
            "doctorAbout": self.doctor.about if self.doctor else None,
            "specialty": self.doctor.specialty.name,
            "expertise": [mapping.expertise.name for mapping in self.doctor.expertise_mappings],
            "consultationType": self.consultation_type.name if self.consultation_type else self.visit_type,
            "date": self.date.isoformat(),
            "day": self.date.strftime("%A") if self.date else None,
            "time": self.slot_timing.start_time.strftime("%I:%M %p") if self.slot_timing else None,
            "endTime": self.slot_timing.end_time.strftime("%I:%M %p") if self.slot_timing else None,
            "slotTimingId": str(self.slot_timing_id),
            "clinicId": str(self.clinic_id) if self.clinic_id else None,
            "clinicName": clinic.name if clinic else None,
            "clinicAddress": f"{clinic.address}, {clinic.city}" if clinic else None,
            "userAddressId": str(self.user_address_id) if self.user_address_id else None,
            "userAddress": user_addr.to_dict() if user_addr else None,
            "meetingLink": self.meeting_link,
            "fee": float(self.fee) if self.fee is not None else None,
            "status": self.status,
            "paymentStatus": self.payment_status,
            "userDescription": self.user_description,
            "doctorDescription": self.doctor_description,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
