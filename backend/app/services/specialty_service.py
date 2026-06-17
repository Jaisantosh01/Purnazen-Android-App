from datetime import datetime

from app.models.specialty import Specialty
from app.models.user import User
from app.repositories.specialty_repository import SpecialtyRepository


class SpecialtyService:

    @staticmethod
    def get_all(db):
        return SpecialtyRepository.get_all(db)

    @staticmethod
    def create(
        db,
        name: str,
        description: str,
        user: User,
    ):
        specialty = Specialty(
            name=name,
            description=description,
            created_by=user.id,
            is_active=True,
        )

        return SpecialtyRepository.create(
            db,
            specialty,
        )

    @staticmethod
    def update(
        db,
        specialty_id: int,
        name: str,
        description: str,
        user: User,
    ):
        specialty = SpecialtyRepository.get_by_id(
            db,
            specialty_id,
        )

        if not specialty:
            return None

        specialty.name = name
        specialty.description = description
        specialty.updated_at = datetime.utcnow()
        specialty.updated_by = user.id

        return SpecialtyRepository.save(
            db,
            specialty,
        )

    @staticmethod
    def delete(
        db,
        specialty_id: int,
        user: User,
    ):
        specialty = SpecialtyRepository.get_by_id(
            db,
            specialty_id,
        )

        if not specialty:
            return None

        specialty.is_active = False
        specialty.updated_at = datetime.utcnow()
        specialty.updated_by = user.id

        return SpecialtyRepository.save(
            db,
            specialty,
        )