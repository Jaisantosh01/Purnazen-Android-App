from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String, func

from app.db.base_class import Base


class FaceGlowRoutine(Base):
    __tablename__ = "face_glow_routines"

    id = Column(Integer, primary_key=True)
    key = Column(String(80), nullable=False, unique=True)
    icon = Column(String(10), nullable=False)
    title = Column(String(150), nullable=False)
    duration = Column(String(30), nullable=False)
    benefits = Column(JSON, nullable=False, default=list)
    category = Column(String(50), nullable=False, default="acupressure")
    video_url = Column(String(500), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            "key": self.key,
            "icon": self.icon,
            "title": self.title,
            "duration": self.duration,
            "benefits": self.benefits or [],
            "category": self.category,
            "videoUrl": self.video_url,
        }
