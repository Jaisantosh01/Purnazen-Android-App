from datetime import datetime, time

from app.models.doctor_availability import DoctorAvailability
from app.models.user import User
from app.repositories.doctor_availability_repository import (
    DoctorAvailabilityRepository,
)


class DoctorAvailabilityService:

    @staticmethod
    def get_all(db):
        return DoctorAvailabilityRepository.get_all(db)

    @staticmethod
    def create(
        db,
        doctor_id: int,
        day_of_week: str,
        start_time: str,
        end_time: str,
        slot_duration_minutes: int,
        user: User,
    ):
        availability = DoctorAvailability(
            doctor_id=doctor_id,
            day_of_week=day_of_week,
            start_time=time.fromisoformat(start_time),
            end_time=time.fromisoformat(end_time),
            slot_duration_minutes=slot_duration_minutes,
            created_by=user.id,
            is_active=True,
        )

        return DoctorAvailabilityRepository.create(
            db,
            availability,
        )

    @staticmethod
    def update(
        db,
        availability_id: int,
        day_of_week: str,
        start_time: str,
        end_time: str,
        slot_duration_minutes: int,
        user: User,
    ):
        availability = DoctorAvailabilityRepository.get_by_id(
            db,
            availability_id,
        )

        if not availability:
            return None

        availability.day_of_week = day_of_week
        availability.start_time = time.fromisoformat(start_time)
        availability.end_time = time.fromisoformat(end_time)
        availability.slot_duration_minutes = slot_duration_minutes

        availability.updated_at = datetime.utcnow()
        availability.updated_by = user.id

        return DoctorAvailabilityRepository.save(
            db,
            availability,
        )

    @staticmethod
    def delete(
        db,
        availability_id: int,
        user: User,
    ):
        availability = DoctorAvailabilityRepository.get_by_id(
            db,
            availability_id,
        )

        if not availability:
            return None

        availability.is_active = False
        availability.updated_at = datetime.utcnow()
        availability.updated_by = user.id

        return DoctorAvailabilityRepository.save(
            db,
            availability,
        )