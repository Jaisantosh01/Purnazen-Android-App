import uuid
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.consultation_record import ConsultationRecord
from app.models.doctor import Doctor
from app.models.user import User
from app.repositories.consultation_record_repository import ConsultationRecordRepository
from app.schemas.consultation import (
    CreateConsultationRecordRequest,
    UpdateConsultationRecordRequest,
)


class ConsultationService:
    """Clinical records (doctor notes / diagnosis / prescription) for an
    appointment. Every call is scoped to the appointment's owning doctor — a
    doctor can only read/write records on their own appointments.
    """

    @staticmethod
    def _doctor_for(db: Session, user: User) -> Optional[Doctor]:
        return db.query(Doctor).filter(Doctor.user_id == user.id).first()

    @staticmethod
    def _owned_appointment(db: Session, user: User, appointment_id: uuid.UUID):
        """Return (doctor, appointment) when the appointment belongs to this
        doctor, else (None, None)."""
        doctor = ConsultationService._doctor_for(db, user)
        if not doctor:
            return None, None
        appointment = db.get(Appointment, appointment_id)
        if not appointment or appointment.doctor_id != doctor.id:
            return doctor, None
        return doctor, appointment

    @staticmethod
    def list_records(db: Session, user: User, appointment_id: uuid.UUID) -> Optional[List[dict]]:
        doctor, appointment = ConsultationService._owned_appointment(db, user, appointment_id)
        if not appointment:
            return None
        records = ConsultationRecordRepository.list_for_appointment(db, appointment_id)
        return [r.to_dict() for r in records]

    @staticmethod
    def create_record(
        db: Session,
        user: User,
        appointment_id: uuid.UUID,
        data: CreateConsultationRecordRequest,
    ) -> Optional[dict]:
        doctor, appointment = ConsultationService._owned_appointment(db, user, appointment_id)
        if not appointment:
            return None
        record = ConsultationRecord(
            appointment_id=appointment.id,
            doctor_id=doctor.id,
            user_id=appointment.user_id,
            record_type=data.record_type,
            content=data.content,
            created_by=user.id,
            updated_by=user.id,
        )
        record = ConsultationRecordRepository.create(db, record)
        return record.to_dict()

    @staticmethod
    def update_record(
        db: Session,
        user: User,
        appointment_id: uuid.UUID,
        record_id: uuid.UUID,
        data: UpdateConsultationRecordRequest,
    ) -> Optional[dict]:
        doctor, appointment = ConsultationService._owned_appointment(db, user, appointment_id)
        if not appointment:
            return None
        record = ConsultationRecordRepository.get(db, record_id)
        if not record or record.appointment_id != appointment_id:
            return None
        if data.content is not None:
            record.content = data.content
        record.updated_by = user.id
        record = ConsultationRecordRepository.save(db, record)
        return record.to_dict()

    @staticmethod
    def delete_record(
        db: Session,
        user: User,
        appointment_id: uuid.UUID,
        record_id: uuid.UUID,
    ) -> bool:
        doctor, appointment = ConsultationService._owned_appointment(db, user, appointment_id)
        if not appointment:
            return False
        record = ConsultationRecordRepository.get(db, record_id)
        if not record or record.appointment_id != appointment_id:
            return False
        record.is_active = False
        record.updated_by = user.id
        ConsultationRecordRepository.save(db, record)
        return True
