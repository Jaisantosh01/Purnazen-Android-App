import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import relationship

from app.db.types import GUID
from app.db.base_class import Base


class ConsultationRecord(Base):
    """A clinical record a doctor attaches to an appointment.

    `record_type` is one of: doctor_note | diagnosis | prescription. Records are
    soft-deleted (`is_active=False`) so an audit trail is preserved.
    """

    __tablename__ = "consultation_records"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    appointment_id = Column(GUID(), ForeignKey("appointments.id"), nullable=False, index=True)
    doctor_id = Column(GUID(), ForeignKey("doctors.id"), nullable=False, index=True)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    record_type = Column(String(20), nullable=False)  # doctor_note | diagnosis | prescription
    content = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    appointment = relationship("Appointment", backref="consultation_records")
    doctor = relationship("Doctor", foreign_keys=[doctor_id])
    user = relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": str(self.id),
            "appointmentId": str(self.appointment_id),
            "recordType": self.record_type,
            "content": self.content,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
