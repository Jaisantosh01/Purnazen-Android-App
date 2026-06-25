from datetime import datetime

import uuid

from app.models.expertise import Expertise
from app.models.user import User
from app.repositories.expertise_repository import ExpertiseRepository


class ExpertiseService:

    @staticmethod
    def get_all(db):
        return ExpertiseRepository.get_all(db)

    @staticmethod
    def create(db, name: str, user: User):

        expertise = Expertise(
            name=name,
            created_by=user.id,
            is_active=True,
        )

        return ExpertiseRepository.create(db, expertise)

    @staticmethod
    def update(db, expertise_id: uuid.UUID, name: str, user: User):

        expertise = ExpertiseRepository.get_by_id(
            db,
            expertise_id,
        )

        if not expertise:
            return None

        expertise.name = name
        expertise.updated_at = datetime.utcnow()
        expertise.updated_by = user.id

        return ExpertiseRepository.save(db, expertise)

    @staticmethod
    def delete(db, expertise_id: uuid.UUID, user: User):

        expertise = ExpertiseRepository.get_by_id(
            db,
            expertise_id,
        )

        if not expertise:
            return None

        expertise.is_active = False
        expertise.updated_at = datetime.utcnow()
        expertise.updated_by = user.id

        return ExpertiseRepository.save(db, expertise)