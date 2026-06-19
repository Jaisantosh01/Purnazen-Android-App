from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
import uuid
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.models.associations import doctor_consultation_types
from app.models.doctor_expertise_mapping import DoctorExpertiseMapping
from app.models.doctor_language_mapping import DoctorLanguageMapping
from app.models.doctor_speciality_mapping import DoctorSpecialityMapping


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    specialty_id = Column(UUID(as_uuid=True), ForeignKey("specialties.id"), nullable=False)

    about = Column(Text)
    education = Column(Text)
    experience_years = Column(Integer, nullable=False)
    consultation_fee = Column(Numeric(10, 2), nullable=False)
    average_rating = Column(Numeric(3, 2), default=0)
    reviews_count = Column(Integer, default=0)
    is_available_today = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    user = relationship("User",foreign_keys=[user_id])
    specialty = relationship("Specialty", backref="doctors")
    clinics = relationship("Clinic", back_populates="doctor", cascade="all, delete-orphan")
    awards = relationship("Award", backref="doctor")
    availabilities = relationship("DoctorAvailability", backref="doctor")
    
    # New relationships using mapping tables
    language_mappings = relationship("DoctorLanguageMapping", backref="doctor")
    expertise_mappings = relationship("DoctorExpertiseMapping", backref="doctor")
    speciality_mappings = relationship("DoctorSpecialityMapping", backref="doctor")
    
    # Relationships for convenience, using association_proxy or just accessing via mapping
    # Assuming standard access to language/expertise through these mappings in to_dict()
    languages = relationship("Language", secondary="doctor_language_mapping", viewonly=True)
    expertises = relationship("Expertise", secondary="doctor_expertise_mapping", viewonly=True)
    # specialty is already linked via specialty_id

    consultation_types = relationship(
        "ConsultationType", secondary=doctor_consultation_types, backref="doctors"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.user.full_name,
            "specialty": self.specialty.name,
            "about": self.about,
            "education": self.education,
            "experience_years": self.experience_years,
            "consultation_fee": float(self.consultation_fee),
            "average_rating": float(self.average_rating),
            "reviews_count": self.reviews_count,
            "languages": [mapping.language.name for mapping in self.language_mappings],
            "consultation_types": [ct.name for ct in self.consultation_types],
            "expertise": [mapping.expertise.name for mapping in self.expertise_mappings],
            "is_available_today": self.is_available_today,
            "is_active": self.is_active,
        }
