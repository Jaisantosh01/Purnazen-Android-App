from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Clinic(Base):
    __tablename__ = "clinics"

    id = Column(Integer, primary_key=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=False)
    city = Column(String(100), nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    phone = Column(String(20))
    is_primary = Column(Boolean, default=False)

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
