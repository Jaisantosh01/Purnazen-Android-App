from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String, func

from app.db.base_class import Base


class WellnessSession(Base):
    """Wellness player content (yoga/meditation/breathing), keyed by the
    frontend sessionKey (e.g. "YogaSession") — mirrors src/data/yogaSessionData.js."""

    __tablename__ = "wellness_sessions"

    id = Column(Integer, primary_key=True)
    key = Column(String(100), nullable=False, unique=True)
    title = Column(String(150), nullable=False)
    duration_label = Column(String(30), nullable=False)
    icon = Column(String(20))
    video_url = Column(String(500))
    total_cycles = Column(Integer, nullable=False, default=1)
    steps = Column(JSON, nullable=False, default=list)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        # Shape consumed by YogaSessionScreen (matches the old mock objects)
        return {
            "key": self.key,
            "title": self.title,
            "duration": self.duration_label,
            "icon": self.icon,
            "videoUrl": self.video_url,
            "totalCycles": self.total_cycles,
            "steps": self.steps or [],
        }
