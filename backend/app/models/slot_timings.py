import uuid
from sqlalchemy import Column, Time, Boolean, ForeignKey, DateTime, func, Integer
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

class SlotTimings(Base):
    __tablename__ = "slot_timings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day_of_week_id = Column(UUID(as_uuid=True), ForeignKey("days_of_week.id"), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "day_of_week_id": str(self.day_of_week_id),
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
