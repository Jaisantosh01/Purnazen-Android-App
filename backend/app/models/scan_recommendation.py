import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
from app.db.types import GUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class ScanRecommendation(Base):
    __tablename__ = "scan_recommendations"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    scan_id = Column(GUID(), ForeignKey("face_scans.id"), nullable=False)
    recommendation_type = Column(String(30), nullable=False)
    priority = Column(Integer, nullable=False, default=0)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    routine_key = Column(String(80), nullable=True)
    video_url = Column(String(500), nullable=True)
    tip_category = Column(String(50), nullable=True)
    extra_meta = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    scan = relationship("FaceScan", back_populates="recommendations")

    def to_dict(self):
        return {
            "id": str(self.id),
            "type": self.recommendation_type,
            "priority": self.priority,
            "title": self.title,
            "description": self.description,
            "routineKey": self.routine_key,
            "videoUrl": self.video_url,
            "tipCategory": self.tip_category,
        }
