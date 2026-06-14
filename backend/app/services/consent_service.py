from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user_consent import ALLOWED_CONSENT_TYPES
from app.repositories.consent_repository import ConsentRepository


class ConsentService:

    @staticmethod
    def get_all(db: Session, user_id: int) -> list[dict]:
        consents = ConsentRepository.get_by_user(db, user_id)
        return [c.to_dict() for c in consents]

    @staticmethod
    def upsert(
        db: Session,
        user_id: int,
        consent_type: str,
        granted: bool,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        if consent_type not in ALLOWED_CONSENT_TYPES:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown consent type '{consent_type}'. Allowed: {sorted(ALLOWED_CONSENT_TYPES)}",
            )
        consent = ConsentRepository.upsert(
            db,
            user_id=user_id,
            consent_type=consent_type,
            granted=granted,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return consent.to_dict()

    @staticmethod
    def revoke(db: Session, user_id: int, consent_type: str) -> dict:
        if consent_type not in ALLOWED_CONSENT_TYPES:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown consent type '{consent_type}'. Allowed: {sorted(ALLOWED_CONSENT_TYPES)}",
            )
        consent = ConsentRepository.get_by_user_and_type(db, user_id, consent_type)
        if not consent:
            raise HTTPException(status_code=404, detail="Consent record not found")
        return ConsentRepository.upsert(
            db,
            user_id=user_id,
            consent_type=consent_type,
            granted=False,
        ).to_dict()

    @staticmethod
    def has_consent(db: Session, user_id: int, consent_type: str) -> bool:
        consent = ConsentRepository.get_by_user_and_type(db, user_id, consent_type)
        return bool(consent and consent.granted)
