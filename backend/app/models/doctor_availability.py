from sqlalchemy import Column, ForeignKey, Boolean, DateTime, func
from sqlalchemy.orm import relationship
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

    slot_timing = relationship("SlotTimings", foreign_keys=[slot_timing_id])

    def to_dict(self):
        day_name = None
        day_of_week_id = None
        start_time_str = None
        end_time_str = None
        if self.slot_timing:
            start_time_str = self.slot_timing.start_time.strftime("%H:%M:%S") if self.slot_timing.start_time else None
            end_time_str = self.slot_timing.end_time.strftime("%H:%M:%S") if self.slot_timing.end_time else None
            if self.slot_timing.day_of_week:
                day_name = self.slot_timing.day_of_week.day
                day_of_week_id = str(self.slot_timing.day_of_week.id)

        return {
            "availability_id": str(self.id),
            "doctor_id": str(self.doctor_id),
            "slot_timing_id": str(self.slot_timing_id),
            "day": day_name,
            "day_of_week_id": day_of_week_id,
            "start_time": start_time_str,
            "end_time": end_time_str,
            "is_active": self.is_active,
        }
