import uuid

from sqlalchemy.orm import Session

from app.models.support_contact import SupportContact
from app.models.support_faq import SupportFaq


class SupportRepository:

    # ── Contacts ────────────────────────────────────────────────────────────
    @staticmethod
    def get_active_contacts(db: Session):
        return (
            db.query(SupportContact)
            .filter_by(is_active=True)
            .order_by(SupportContact.sort_order.asc())
            .all()
        )

    @staticmethod
    def get_contact_by_id(db: Session, contact_id: uuid.UUID) -> SupportContact | None:
        return db.query(SupportContact).filter(SupportContact.id == contact_id).first()

    # ── FAQs ────────────────────────────────────────────────────────────────
    @staticmethod
    def get_active_faqs(db: Session):
        return (
            db.query(SupportFaq)
            .filter_by(is_active=True)
            .order_by(SupportFaq.sort_order.asc())
            .all()
        )

    @staticmethod
    def get_faq_by_id(db: Session, faq_id: uuid.UUID) -> SupportFaq | None:
        return db.query(SupportFaq).filter(SupportFaq.id == faq_id).first()

    # ── Shared persistence helpers ──────────────────────────────────────────
    @staticmethod
    def create(db: Session, obj):
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    @staticmethod
    def save(db: Session, obj):
        db.commit()
        db.refresh(obj)
        return obj
