import uuid
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.consultation_record import ConsultationRecord


class ConsultationRecordRepository:
    @staticmethod
    def list_for_appointment(db: Session, appointment_id: uuid.UUID) -> List[ConsultationRecord]:
        return (
            db.query(ConsultationRecord)
            .filter(
                ConsultationRecord.appointment_id == appointment_id,
                ConsultationRecord.is_active.is_(True),
            )
            .order_by(ConsultationRecord.created_at.asc())
            .all()
        )

    @staticmethod
    def get(db: Session, record_id: uuid.UUID) -> Optional[ConsultationRecord]:
        record = db.get(ConsultationRecord, record_id)
        if record and record.is_active:
            return record
        return None

    @staticmethod
    def create(db: Session, record: ConsultationRecord) -> ConsultationRecord:
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def save(db: Session, record: ConsultationRecord) -> ConsultationRecord:
        db.commit()
        db.refresh(record)
        return record
