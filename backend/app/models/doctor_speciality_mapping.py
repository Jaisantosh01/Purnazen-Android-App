import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, func
from app.db.types import GUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class DoctorSpecialityMapping(Base):
    __tablename__ = "doctor_speciality_mapping"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    doctor_id = Column(GUID(), ForeignKey("doctors.id"), nullable=False)
    speciality_id = Column(GUID(), ForeignKey("specialties.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"))
    updated_by = Column(GUID(), ForeignKey("users.id"))
    
    specialty = relationship("Specialty")

    def to_dict(self):
        return {
            "id": str(self.id),
            "doctor_id": str(self.doctor_id),
            "speciality_id": str(self.speciality_id),
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
