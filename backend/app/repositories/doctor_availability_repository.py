import uuid

from sqlalchemy.orm import Session, joinedload

from app.models.doctor_availability import DoctorAvailability
from app.models.slot_timings import SlotTimings
from app.models.day_of_week import DayOfWeek


class DoctorAvailabilityRepository:

    @staticmethod
    def get_all(db: Session, doctor_id: uuid.UUID = None):
        query = (
            db.query(DoctorAvailability)
            .join(SlotTimings, DoctorAvailability.slot_timing_id == SlotTimings.id)
            .join(DayOfWeek, SlotTimings.day_of_week_id == DayOfWeek.id)
            .options(
                joinedload(DoctorAvailability.slot_timing)
                .joinedload(SlotTimings.day_of_week)
            )
            .filter(DoctorAvailability.is_active.is_(True))
        )
        if doctor_id is not None:
            query = query.filter(DoctorAvailability.doctor_id == doctor_id)
        return query.all()

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