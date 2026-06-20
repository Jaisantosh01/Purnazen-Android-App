import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from app.db.types import GUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class FaceScan(Base):
    __tablename__ = "face_scans"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    scan_type = Column(String(20), nullable=False, default="face")
    status = Column(String(20), nullable=False, default="queued")
    image_url = Column(String(500), nullable=True)
    processed_image_url = Column(String(500), nullable=True)
    image_public_id = Column(String(200), nullable=True)
    processed_image_public_id = Column(String(200), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    face_detected = Column(Boolean, nullable=True)
    face_confidence = Column(Numeric(5, 4), nullable=True)
    lighting_quality = Column(String(20), nullable=True)
    # Laplacian variance — ranges 0..1000s for in-focus photos, so needs room
    # well beyond the original Numeric(6,4) (which overflowed on every sharp image).
    blur_score = Column(Numeric(10, 2), nullable=True)
    error_message = Column(String(500), nullable=True)
    # Live analysis UX: current pipeline stage + serialized face-mesh landmarks
    progress_stage = Column(String(40), nullable=True)
    landmarks_json = Column(Text, nullable=True)
    processing_started_at = Column(DateTime, nullable=True)
    processing_completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="face_scans")
    result = relationship("ScanResult", back_populates="scan", uselist=False, cascade="all, delete-orphan")
    recommendations = relationship("ScanRecommendation", back_populates="scan", order_by="ScanRecommendation.priority", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "scanType": self.scan_type,
            "status": self.status,
            "imageUrl": self.image_url,
            "processedImageUrl": self.processed_image_url,
            "faceDetected": self.face_detected,
            "lightingQuality": self.lighting_quality,
            "progressStage": self.progress_stage,
            "errorMessage": self.error_message,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "processingCompletedAt": self.processing_completed_at.isoformat() if self.processing_completed_at else None,
        }
