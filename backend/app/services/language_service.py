from datetime import datetime

from app.models.language import Language
from app.models.user import User
from app.repositories.language_repository import LanguageRepository


class LanguageService:

    @staticmethod
    def get_all(db):
        return LanguageRepository.get_all(db)

    @staticmethod
    def get_by_id(db, language_id):
        return LanguageRepository.get_by_id(db, language_id)

    @staticmethod
    def create(db, name: str, user: User):

        language = Language(
            name=name,
            created_by=user.id,
            is_active=True,
        )

        return LanguageRepository.create(db, language)

    @staticmethod
    def update(db, language_id: int, name: str, user: User):

        language = LanguageRepository.get_by_id(
            db,
            language_id,
        )

        if not language:
            return None

        language.name = name
        language.updated_at = datetime.utcnow()
        language.updated_by = user.id

        return LanguageRepository.save(db, language)

    @staticmethod
    def delete(db, language_id: int, user: User):

        language = LanguageRepository.get_by_id(
            db,
            language_id,
        )

        if not language:
            return None

        language.is_active = False
        language.updated_at = datetime.utcnow()
        language.updated_by = user.id

        return LanguageRepository.save(db, language)