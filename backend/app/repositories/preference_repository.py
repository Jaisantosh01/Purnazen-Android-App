import uuid

from sqlalchemy.orm import Session

from app.models.user_preference import UserPreference


class PreferenceRepository:

    @staticmethod
    def get_by_user(db: Session, user_id: uuid.UUID) -> UserPreference | None:
        return db.query(UserPreference).filter_by(user_id=user_id).first()

    @staticmethod
    def get_or_create(db: Session, user_id: uuid.UUID) -> UserPreference:
        preference = PreferenceRepository.get_by_user(db, user_id)
        if not preference:
            preference = UserPreference(user_id=user_id, push_enabled=True, notifications={})
            db.add(preference)
            db.commit()
            db.refresh(preference)
        return preference
