from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship
from app.db.types import GUID
import uuid

from app.db.base_class import Base


class Clinic(Base):
    __tablename__ = "clinics"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    doctor_id = Column(GUID(), ForeignKey("doctors.id"), nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=False)
    city = Column(String(100), nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    phone = Column(String(20))
    is_primary = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    doctor = relationship("Doctor", back_populates="clinics")

    def to_dict(self):
        return {
            "id": self.id,
            "doctor_id": self.doctor_id,
            "name": self.name,
            "address": self.address,
            "city": self.city,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "phone": self.phone,
            "is_primary": self.is_primary,
        }
