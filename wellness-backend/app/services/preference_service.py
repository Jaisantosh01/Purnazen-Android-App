from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.preference_repository import PreferenceRepository
from app.schemas.preferences import UpdatePreferencesRequest


class PreferenceService:

    @staticmethod
    def get(db: Session, user: User) -> dict:
        return PreferenceRepository.get_or_create(db, user.id).to_dict()

    @staticmethod
    def update(db: Session, user: User, data: UpdatePreferencesRequest) -> dict:
        preference = PreferenceRepository.get_or_create(db, user.id)

        if data.push_enabled is not None:
            preference.push_enabled = data.push_enabled
        if data.notifications:
            # Reassign (not mutate) so SQLAlchemy detects the JSON change
            preference.notifications = {
                **(preference.notifications or {}),
                **data.notifications,
            }

        db.commit()
        db.refresh(preference)
        return preference.to_dict()
