from sqlalchemy import Boolean, Column, ForeignKey, Integer, DateTime, String, Time, func

from app.db.base_class import Base


class DoctorAvailability(Base):
    __tablename__ = "doctor_availability"

    id = Column(Integer, primary_key=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    day_of_week = Column(String(10))
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    slot_duration_minutes = Column(Integer, default=30)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
        "id": self.id,
        "doctor_id": self.doctor_id,
        "day_of_week": self.day_of_week,
        "start_time": self.start_time.strftime("%H:%M"),
        "end_time": self.end_time.strftime("%H:%M"),
        "slot_duration_minutes": self.slot_duration_minutes,
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
