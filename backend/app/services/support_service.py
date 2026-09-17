import uuid

from sqlalchemy.orm import Session

from app.models.support_contact import SupportContact
from app.models.support_faq import SupportFaq
from app.models.user import User
from app.repositories.support_repository import SupportRepository
from app.schemas.support import (
    validate_contact_value,
    SupportContactCreate,
    SupportContactUpdate,
    SupportFaqCreate,
    SupportFaqUpdate,
)


class SupportService:

    # ── Reads (public Help & Support screen) ────────────────────────────────
    @staticmethod
    def get_help(db: Session) -> dict:
        return {
            "contacts": [c.to_dict() for c in SupportRepository.get_active_contacts(db)],
            "faqs": [f.to_dict() for f in SupportRepository.get_active_faqs(db)],
        }

    # ── Contacts CRUD (admin) ───────────────────────────────────────────────
    @staticmethod
    def list_contacts(db: Session) -> list[dict]:
        return [c.to_dict() for c in SupportRepository.list_all_contacts(db)]

    @staticmethod
    def create_contact(db: Session, body: SupportContactCreate, user: User) -> SupportContact:
        """Raises ValueError when `value` does not fit `contact_type`."""
        contact = SupportContact(
            contact_type=body.contact_type,
            title=body.title,
            subtitle=body.subtitle,
            value=validate_contact_value(body.contact_type, body.value),
            icon=body.icon,
            color=body.color,
            sort_order=body.sort_order or 0,
            is_active=body.is_active if body.is_active is not None else True,
            created_by=user.id,
        )
        return SupportRepository.create(db, contact)

    @staticmethod
    def update_contact(
        db: Session, contact_id: uuid.UUID, body: SupportContactUpdate, user: User
    ) -> SupportContact | None:
        contact = SupportRepository.get_contact_by_id(db, contact_id)
        if not contact:
            return None
        changes = body.model_dump(exclude_unset=True)
        if "contact_type" in changes or "value" in changes:
            # Re-check against the merged record: changing only the type can
            # make the stored value wrong for it.
            changes["value"] = validate_contact_value(
                changes.get("contact_type", contact.contact_type),
                changes.get("value", contact.value),
            )
        for field, value in changes.items():
            setattr(contact, field, value)
        contact.updated_by = user.id
        return SupportRepository.save(db, contact)

    @staticmethod
    def delete_contact(db: Session, contact_id: uuid.UUID, user: User) -> SupportContact | None:
        contact = SupportRepository.get_contact_by_id(db, contact_id)
        if not contact:
            return None
        contact.is_active = False
        contact.updated_by = user.id
        return SupportRepository.save(db, contact)

    # ── FAQs CRUD (admin) ───────────────────────────────────────────────────
    @staticmethod
    def create_faq(db: Session, body: SupportFaqCreate, user: User) -> SupportFaq:
        faq = SupportFaq(
            question=body.question,
            answer=body.answer,
            sort_order=body.sort_order or 0,
            is_active=body.is_active if body.is_active is not None else True,
            created_by=user.id,
        )
        return SupportRepository.create(db, faq)

    @staticmethod
    def update_faq(
        db: Session, faq_id: uuid.UUID, body: SupportFaqUpdate, user: User
    ) -> SupportFaq | None:
        faq = SupportRepository.get_faq_by_id(db, faq_id)
        if not faq:
            return None
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(faq, field, value)
        faq.updated_by = user.id
        return SupportRepository.save(db, faq)

    @staticmethod
    def delete_faq(db: Session, faq_id: uuid.UUID, user: User) -> SupportFaq | None:
        faq = SupportRepository.get_faq_by_id(db, faq_id)
        if not faq:
            return None
        faq.is_active = False
        faq.updated_by = user.id
        return SupportRepository.save(db, faq)
