import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.support import (
    SupportContactCreate,
    SupportContactUpdate,
    SupportFaqCreate,
    SupportFaqUpdate,
)
from app.services.support_service import SupportService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/support", tags=["Support"])


# ── Public ──────────────────────────────────────────────────────────────────
@router.get("/help", summary="Help & Support contacts + FAQs")
def get_help(db: Session = Depends(get_db)):
    return success_response("Help content fetched successfully", SupportService.get_help(db))


# ── Contacts (admin) ─────────────────────────────────────────────────────────
@router.post("/contacts")
def create_contact(
    body: SupportContactCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contact = SupportService.create_contact(db, body, user)
    return success_response("Support contact created successfully", contact.to_dict())


@router.put("/contacts/{contact_id}")
def update_contact(
    contact_id: uuid.UUID,
    body: SupportContactUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contact = SupportService.update_contact(db, contact_id, body, user)
    if not contact:
        return error_response("Support contact not found", 404)
    return success_response("Support contact updated successfully", contact.to_dict())


@router.delete("/contacts/{contact_id}")
def delete_contact(
    contact_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contact = SupportService.delete_contact(db, contact_id, user)
    if not contact:
        return error_response("Support contact not found", 404)
    return success_response("Support contact deleted successfully", {})


# ── FAQs (admin) ─────────────────────────────────────────────────────────────
@router.post("/faqs")
def create_faq(
    body: SupportFaqCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    faq = SupportService.create_faq(db, body, user)
    return success_response("Support FAQ created successfully", faq.to_dict())


@router.put("/faqs/{faq_id}")
def update_faq(
    faq_id: uuid.UUID,
    body: SupportFaqUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    faq = SupportService.update_faq(db, faq_id, body, user)
    if not faq:
        return error_response("Support FAQ not found", 404)
    return success_response("Support FAQ updated successfully", faq.to_dict())


@router.delete("/faqs/{faq_id}")
def delete_faq(
    faq_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    faq = SupportService.delete_faq(db, faq_id, user)
    if not faq:
        return error_response("Support FAQ not found", 404)
    return success_response("Support FAQ deleted successfully", {})
