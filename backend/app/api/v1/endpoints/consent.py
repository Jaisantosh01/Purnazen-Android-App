from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.services.consent_service import ConsentService
from app.utils.responses import success_response

router = APIRouter(prefix="/consent", tags=["Consent"])


class ConsentRequest(BaseModel):
    consent_type: str
    granted: bool


@router.get(
    "/",
    summary="Get all consents",
    description="Returns all consent records for the authenticated user.",
)
def get_consents(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consents = ConsentService.get_all(db, user.id)
    return success_response("Consents fetched successfully", {"consents": consents})


@router.post(
    "/",
    summary="Grant or update consent",
    description="Creates or updates a consent record. `consent_type` must be one of: scan_storage, ai_training, gdpr_data.",
)
def upsert_consent(
    body: ConsentRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    consent = ConsentService.upsert(
        db,
        user_id=user.id,
        consent_type=body.consent_type,
        granted=body.granted,
        ip_address=ip,
        user_agent=user_agent,
    )
    action = "granted" if body.granted else "revoked"
    return success_response(f"Consent {action} successfully", consent)


@router.delete(
    "/{consent_type}",
    summary="Revoke a consent",
    description="Revokes a specific consent type for the authenticated user.",
)
def revoke_consent(
    consent_type: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consent = ConsentService.revoke(db, user.id, consent_type)
    return success_response("Consent revoked successfully", consent)
