import uuid

from sqlalchemy import Column, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.types import GUID


class DoctorLeaveSlot(Base):
    """
    Normalised junction table linking a DoctorLeave (request) to one or more
    SlotTimings (used only when leave_type = 'custom').
    """

    __tablename__ = "doctor_leave_slots"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)

    leave_id = Column(
        GUID(),
        ForeignKey("doctor_leaves.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slot_timing_id = Column(
        GUID(),
        ForeignKey("slot_timings.id"),
        nullable=False,
        index=True,
    )

    created_at = Column(DateTime, server_default=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    leave = relationship("DoctorLeave", back_populates="slots")
    slot_timing = relationship("SlotTimings", foreign_keys=[slot_timing_id])
