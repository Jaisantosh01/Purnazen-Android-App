from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, String, Text, Time, func
from sqlalchemy.orm import relationship
from app.db.types import GUID
import uuid

from app.db.base_class import Base


class DoctorLeave(Base):
    __tablename__ = "doctor_leaves"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    doctor_id = Column(GUID(), ForeignKey("doctors.id"), nullable=False, index=True)
    

    # ── Legacy fields ─────────────────────────────────────────────────────────
    leave_date = Column(Date, nullable=True, index=True)

    # ── New fields for full leave management integration ──────────────────────
    # single | multiple | custom
    leave_type = Column(String(20), nullable=False, default="single")
    start_date = Column(Date, nullable=True, index=True)
    end_date = Column(Date, nullable=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    
    # ── Shared fields ─────────────────────────────────────────────────────────
    reason = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    admin_reason = Column(String(255), nullable=True)
    approved_by = Column(GUID(),ForeignKey("users.id"),nullable=True,)
    approved_at = Column(DateTime,nullable=True,)
    applied_at = Column(DateTime,server_default=func.now(),)
    status = Column(String(20), default="pending", index=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, nullable=True)
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    doctor = relationship("Doctor", backref="leaves", foreign_keys=[doctor_id])
    approver = relationship(
        "User",
        foreign_keys=[approved_by]
    )
    # Slots junction relationship for custom leave type
    slots = relationship(
        "DoctorLeaveSlot",
        back_populates="leave",
        cascade="all, delete-orphan",
    )
