from sqlalchemy.orm import Session

from app.models.language import Language


class LanguageRepository:

    @staticmethod
    def get_all(db: Session):
        return (
            db.query(Language)
            .filter(Language.is_active.is_(True))
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, language_id: int):
        return (
            db.query(Language)
            .filter(
                Language.id == language_id,
                Language.is_active.is_(True),
            )
            .first()
        )

    @staticmethod
    def create(db: Session, language: Language):
        db.add(language)
        db.commit()
        db.refresh(language)
        return language

    @staticmethod
    def save(db: Session, language: Language):
        db.commit()
        db.refresh(language)
        return language