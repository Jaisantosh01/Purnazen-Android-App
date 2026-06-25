from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.user_consent import UserConsent


class ConsentRepository:

    @staticmethod
    def get_by_user(db: Session, user_id: int) -> list[UserConsent]:
        return db.query(UserConsent).filter(UserConsent.user_id == user_id).all()

    @staticmethod
    def get_by_user_and_type(db: Session, user_id: int, consent_type: str) -> UserConsent | None:
        return (
            db.query(UserConsent)
            .filter(UserConsent.user_id == user_id, UserConsent.consent_type == consent_type)
            .first()
        )

    @staticmethod
    def upsert(
        db: Session,
        user_id: int,
        consent_type: str,
        granted: bool,
        ip_address: str | None = None,
        user_agent: str | None = None,
        version: str = "1.0",
    ) -> UserConsent:
        now = datetime.now(timezone.utc)
        consent = ConsentRepository.get_by_user_and_type(db, user_id, consent_type)
        if consent:
            consent.granted = granted
            consent.granted_at = now if granted else consent.granted_at
            consent.revoked_at = now if not granted else None
            consent.ip_address = ip_address
            consent.user_agent = user_agent
            consent.consent_version = version
            consent.updated_at = now
        else:
            consent = UserConsent(
                user_id=user_id,
                consent_type=consent_type,
                granted=granted,
                granted_at=now if granted else None,
                ip_address=ip_address,
                user_agent=user_agent,
                consent_version=version,
            )
            db.add(consent)
        db.commit()
        db.refresh(consent)
        return consent

    @staticmethod
    def revoke_all(db: Session, user_id: int) -> None:
        now = datetime.now(timezone.utc)
        db.query(UserConsent).filter(
            UserConsent.user_id == user_id,
            UserConsent.granted.is_(True),
        ).update({"granted": False, "revoked_at": now, "updated_at": now})
        db.commit()

    @staticmethod
    def delete_all(db: Session, user_id: int) -> None:
        db.query(UserConsent).filter(UserConsent.user_id == user_id).delete()
        db.commit()
