import uuid

from sqlalchemy.orm import Session

from app.models.doctor_availability import DoctorAvailability


class DoctorAvailabilityRepository:

    @staticmethod
    def get_all(db: Session):
        return (
            db.query(DoctorAvailability)
            .filter(DoctorAvailability.is_active.is_(True))
            .all()
        )

    @staticmethod
    def get_by_id(
        db: Session,
        availability_id: uuid.UUID,
    ):
        return (
            db.query(DoctorAvailability)
            .filter(
                DoctorAvailability.id == availability_id,
                DoctorAvailability.is_active.is_(True),
            )
            .first()
        )

    @staticmethod
    def create(
        db: Session,
        availability: DoctorAvailability,
    ):
        db.add(availability)
        db.commit()
        db.refresh(availability)

        return availability

    @staticmethod
    def save(
        db: Session,
        availability: DoctorAvailability,
    ):
        db.commit()
        db.refresh(availability)

        return availability