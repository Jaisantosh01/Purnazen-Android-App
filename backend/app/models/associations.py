"""Association tables for the doctor module (many-to-many links)."""

from sqlalchemy import Column, ForeignKey, Integer, Table
from sqlalchemy.dialects.postgresql import UUID

from app.db.base_class import Base

doctor_languages = Table(
    "doctor_languages",
    Base.metadata,
    Column("doctor_id", UUID(as_uuid=True), ForeignKey("doctors.id"), primary_key=True),
    Column("language_id", UUID(as_uuid=True), ForeignKey("languages.id"), primary_key=True),
)

doctor_consultation_types = Table(
    "doctor_consultation_types",
    Base.metadata,
    Column("doctor_id", UUID(as_uuid=True), ForeignKey("doctors.id"), primary_key=True),
    Column("consultation_type_id", UUID(as_uuid=True), ForeignKey("consultation_types.id"), primary_key=True),
)

doctor_expertise = Table(
    "doctor_expertise",
    Base.metadata,
    Column("doctor_id", UUID(as_uuid=True), ForeignKey("doctors.id"), primary_key=True),
    Column("expertise_id", UUID(as_uuid=True), ForeignKey("expertise.id"), primary_key=True),
)
