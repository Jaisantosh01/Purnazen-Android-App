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
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.models.associations import (
    doctor_consultation_types,
    doctor_expertise,
    doctor_languages,
)


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    specialty_id = Column(Integer, ForeignKey("specialties.id"), nullable=False)

    about = Column(Text)
    education = Column(Text)
    experience_years = Column(Integer, nullable=False)
    consultation_fee = Column(Numeric(10, 2), nullable=False)
    average_rating = Column(Numeric(3, 2), default=0)
    reviews_count = Column(Integer, default=0)
    is_available_today = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)

    user = relationship("User", backref="doctor_profile")
    specialty = relationship("Specialty", backref="doctors")
    clinics = relationship("Clinic", back_populates="doctor", cascade="all, delete-orphan")
    awards = relationship("Award", backref="doctor")
    availabilities = relationship("DoctorAvailability", backref="doctor")
    languages = relationship("Language", secondary=doctor_languages, backref="doctors")
    consultation_types = relationship(
        "ConsultationType", secondary=doctor_consultation_types, backref="doctors"
    )
    expertises = relationship("Expertise", secondary=doctor_expertise, backref="doctors")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "specialty_id": self.specialty_id,
            "about": self.about,
            "education": self.education,
            "experience_years": self.experience_years,
            "consultation_fee": float(self.consultation_fee),
            "average_rating": float(self.average_rating),
            "reviews_count": self.reviews_count,
            "languages": [lang.to_dict() for lang in self.languages],
            "consultation_types": [ct.to_dict() for ct in self.consultation_types],
            "expertises": [expertise.to_dict() for expertise in self.expertises],
            "is_available_today": self.is_available_today,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "user": self.user.to_dict(),
            "specialty": self.specialty.to_dict(),
            "clinics": [clinic.to_dict() for clinic in self.clinics],
            "awards": [award.to_dict() for award in self.awards],
            "availabilities": [a.to_dict() for a in self.availabilities],
        }
