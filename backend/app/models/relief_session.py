from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base_class import Base


class ReliefSession(Base):
    """Relief player content (acupressure routines), keyed by the frontend
    reliefKey (e.g. "Headache", "Neck Pain") — mirrors src/data/reliefSessionData.js."""

    __tablename__ = "relief_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    key = Column(String(100), nullable=False, unique=True)
    title = Column(String(150), nullable=False)
    duration = Column(String(30), nullable=False)
    icon = Column(String(20))
    video_url = Column(String(500))
    total_cycles = Column(Integer, nullable=False, default=1)
    steps = Column(JSON, nullable=False, default=list)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    def to_dict(self):
        # Shape consumed by ReliefSessionScreen (matches the old mock objects)
        return {
            "id": str(self.id),
            "key": self.key,
            "title": self.title,
            "duration": self.duration,
            "icon": self.icon,
            "videoUrl": self.video_url,
            "totalCycles": self.total_cycles,
            "steps": self.steps or [],

        }
