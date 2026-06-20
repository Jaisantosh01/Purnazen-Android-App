"""Association models for the doctor module (many-to-many links with extra fields)."""

from sqlalchemy import Column, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class DoctorConsultationType(Base):
    """ORM model for the doctor_consultation_types association with extra fields."""
    __tablename__ = "doctor_consultation_types"

    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), primary_key=True)
    consultation_type_id = Column(UUID(as_uuid=True), ForeignKey("consultation_types.id"), primary_key=True)
    price = Column(Numeric(10, 2), nullable=True)

    doctor = relationship("Doctor", back_populates="consultation_type_links")
    consultation_type = relationship("ConsultationType")
