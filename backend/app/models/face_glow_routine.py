import uuid
from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String, func
from app.db.types import GUID

from app.db.base_class import Base


# The app renders routine icons with MaterialCommunityIcons (<MCIcon name=.../>),
# not emoji. The legacy `icon` column stores emoji (and is only String(10), too
# short for icon names), so we map the stable `key` to an icon name at
# serialization time — this fixes every existing database without a migration.
FACE_GLOW_ICONS = {
    "MorningGlow": "weather-sunset-up",
    "FacialAcupressure": "spa-outline",
    "NightRepair": "weather-night",
    "GuaShaFlow": "shimmer",
}
FACE_GLOW_ICON_FALLBACK = "face-woman-shimmer"


class FaceGlowRoutine(Base):
    __tablename__ = "face_glow_routines"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
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
            "icon": FACE_GLOW_ICONS.get(self.key, FACE_GLOW_ICON_FALLBACK),
            "title": self.title,
            "duration": self.duration,
            "benefits": self.benefits or [],
            "category": self.category,
            "videoUrl": self.video_url,
        }
