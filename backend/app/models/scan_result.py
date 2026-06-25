import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Numeric, String, func
from app.db.types import GUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class ScanResult(Base):
    __tablename__ = "scan_results"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    scan_id = Column(GUID(), ForeignKey("face_scans.id"), nullable=False, unique=True)
    # Face metrics (0–100, NULL for tongue scans)
    hydration_score = Column(Numeric(5, 2), nullable=True)
    oiliness_score = Column(Numeric(5, 2), nullable=True)
    wrinkle_score = Column(Numeric(5, 2), nullable=True)
    pigmentation_score = Column(Numeric(5, 2), nullable=True)
    dark_circle_score = Column(Numeric(5, 2), nullable=True)
    pore_score = Column(Numeric(5, 2), nullable=True)
    elasticity_score = Column(Numeric(5, 2), nullable=True)
    muscle_tone_score = Column(Numeric(5, 2), nullable=True)
    inflammation_score = Column(Numeric(5, 2), nullable=True)
    glow_score = Column(Numeric(5, 2), nullable=True)
    toxin_indicator = Column(Numeric(5, 2), nullable=True)
    # Tongue metrics (NULL for face scans)
    tongue_body_color = Column(String(30), nullable=True)
    tongue_coat_color = Column(String(30), nullable=True)
    tongue_coat_thick = Column(String(20), nullable=True)
    tongue_moisture = Column(String(20), nullable=True)
    tongue_shape = Column(String(30), nullable=True)
    # Audit / AI retraining
    raw_metrics = Column(JSON, nullable=True)
    overall_wellness_score = Column(Numeric(5, 2), nullable=True)
    skin_age_estimate = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    scan = relationship("FaceScan", back_populates="result")

    def to_dict(self):
        def _f(v):
            return float(v) if v is not None else None

        return {
            "hydrationScore": _f(self.hydration_score),
            "oilinessScore": _f(self.oiliness_score),
            "wrinkleScore": _f(self.wrinkle_score),
            "pigmentationScore": _f(self.pigmentation_score),
            "darkCircleScore": _f(self.dark_circle_score),
            "poreScore": _f(self.pore_score),
            "elasticityScore": _f(self.elasticity_score),
            "muscleToneScore": _f(self.muscle_tone_score),
            "inflammationScore": _f(self.inflammation_score),
            "glowScore": _f(self.glow_score),
            "toxinIndicator": _f(self.toxin_indicator),
            "tongueBodyColor": self.tongue_body_color,
            "tongueCoatColor": self.tongue_coat_color,
            "tongueCoatThick": self.tongue_coat_thick,
            "tongueMoisture": self.tongue_moisture,
            "tongueShape": self.tongue_shape,
            "overallWellnessScore": _f(self.overall_wellness_score),
            "skinAgeEstimate": self.skin_age_estimate,
        }
