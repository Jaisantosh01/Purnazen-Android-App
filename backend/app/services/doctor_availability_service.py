from datetime import datetime
from uuid import UUID

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
        slot_timing_id: UUID,
        user: User,
    ):
        availability = DoctorAvailability(
            doctor_id=doctor_id,
            slot_timing_id=slot_timing_id,
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
        slot_timing_id: UUID,
        user: User,
    ):
        availability = DoctorAvailabilityRepository.get_by_id(
            db,
            availability_id,
        )

        if not availability:
            return None

        availability.slot_timing_id = slot_timing_id
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