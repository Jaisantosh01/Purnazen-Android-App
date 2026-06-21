from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import relationship
from app.db.types import GUID
import uuid

from app.db.base_class import Base


class DoctorLeave(Base):
    __tablename__ = "doctor_leaves"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    doctor_id = Column(GUID(), ForeignKey("doctors.id"), nullable=False, index=True)
    leave_date = Column(Date, nullable=False, index=True)
    slot_timing_id = Column(GUID(), ForeignKey("slot_timings.id"), nullable=True)
    doctor_reason = Column(String(255))
    admin_reason = Column(String(255))
    status = Column(String(20), default="pending")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, nullable=True)
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    doctor = relationship("Doctor", backref="leaves", foreign_keys=[doctor_id])
    slot_timing = relationship("SlotTimings", foreign_keys=[slot_timing_id])
