from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class FaceScan(Base):
    __tablename__ = "face_scans"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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
    blur_score = Column(Numeric(6, 4), nullable=True)
    error_message = Column(String(500), nullable=True)
    processing_started_at = Column(DateTime, nullable=True)
    processing_completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="face_scans")
    result = relationship("ScanResult", back_populates="scan", uselist=False, cascade="all, delete-orphan")
    recommendations = relationship("ScanRecommendation", back_populates="scan", order_by="ScanRecommendation.priority", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "scanType": self.scan_type,
            "status": self.status,
            "imageUrl": self.image_url,
            "processedImageUrl": self.processed_image_url,
            "faceDetected": self.face_detected,
            "lightingQuality": self.lighting_quality,
            "errorMessage": self.error_message,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "processingCompletedAt": self.processing_completed_at.isoformat() if self.processing_completed_at else None,
        }
