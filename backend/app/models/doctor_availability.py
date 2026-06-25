from sqlalchemy import Boolean, Column, ForeignKey, Integer, DateTime, String, Time, func
from app.db.types import GUID
import uuid

from app.db.base_class import Base


class DoctorAvailability(Base):
    __tablename__ = "doctor_availability"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    doctor_id = Column(GUID(), ForeignKey("doctors.id"), nullable=False)
    slot_timing_id = Column(GUID(), ForeignKey("slot_timings.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, nullable=True)
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
        "id": self.id,
        "doctor_id": self.doctor_id,
        "slot_timing_id": str(self.slot_timing_id),
        "is_active": self.is_active,
        "created_at": (
            self.created_at.isoformat()
            if self.created_at
            else None
        ),
        "updated_at": (
            self.updated_at.isoformat()
            if self.updated_at
            else None
        ),
    }
