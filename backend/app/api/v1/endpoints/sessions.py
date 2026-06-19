from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.quick_relief import QuickReliefCreate, QuickReliefUpdate
from app.schemas.wellness_session import WellnessSessionCreate, WellnessSessionUpdate
from app.services.quick_relief_service import QuickReliefService
from app.services.session_catalog_service import SessionCatalogService
from app.services.wellness_session_service import WellnessSessionService
from app.utils.responses import error_response, success_response

router = APIRouter(tags=["Sessions"])


@router.get(
    "/sessions",
    summary="List wellness sessions",
    description="Wellness player catalog (yoga/meditation/breathing routines).",
)
def get_sessions(db: Session = Depends(get_db)):
    sessions = SessionCatalogService.get_wellness_sessions(db)
    return success_response(
        "Sessions fetched successfully",
        {"sessions": sessions, "total": len(sessions)},
    )


@router.get(
    "/relief-sessions",
    summary="List relief sessions",
    description="Relief player catalog (acupressure routines).",
)
def get_relief_sessions(db: Session = Depends(get_db)):
    sessions = SessionCatalogService.get_relief_sessions(db)
    return success_response(
        "Relief sessions fetched successfully",
        {"sessions": sessions, "total": len(sessions)},
    )


@router.get(
    "/relief-sessions/{session_key}",
    summary="Relief session detail",
    description="A single relief session in the player shape; 404 when the key is unknown.",
)
def get_relief_session(session_key: str, db: Session = Depends(get_db)):
    session = SessionCatalogService.get_relief_session(db, session_key)
    if not session:
        return error_response("Relief session not found", 404)

    return success_response("Relief session fetched successfully", session)


@router.post(
    "/quick-relief",
    summary="Create quick relief",
    description="Create a new quick relief session.",
)
def create_quick_relief(
    body: QuickReliefCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    relief = QuickReliefService.create(db, body, user)
    return success_response("Quick relief created successfully", relief.to_dict())


@router.put(
    "/quick-relief/{relief_id}",
    summary="Update quick relief",
    description="Update an existing quick relief session.",
)
def update_quick_relief(
    relief_id: int,
    body: QuickReliefUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    relief = QuickReliefService.update(db, relief_id, body, user)
    if not relief:
        return error_response("Quick relief not found", 404)
    return success_response("Quick relief updated successfully", relief.to_dict())


@router.delete(
    "/quick-relief/{relief_id}",
    summary="Delete quick relief",
    description="Soft delete a quick relief session.",
)
def delete_quick_relief(
    relief_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    relief = QuickReliefService.delete(db, relief_id, user)
    if not relief:
        return error_response("Quick relief not found", 404)
    return success_response("Quick relief deleted successfully", {})


@router.post(
    "/sessions",
    summary="Create wellness session",
    description="Create a new wellness session.",
)
def create_wellness_session(
    body: WellnessSessionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = WellnessSessionService.create(db, body, user)
    return success_response("Wellness session created successfully", session.to_dict())


@router.put(
    "/sessions/{session_id}",
    summary="Update wellness session",
    description="Update an existing wellness session.",
)
def update_wellness_session(
    session_id: int,
    body: WellnessSessionUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = WellnessSessionService.update(db, session_id, body, user)
    if not session:
        return error_response("Wellness session not found", 404)
    return success_response("Wellness session updated successfully", session.to_dict())


@router.delete(
    "/sessions/{session_id}",
    summary="Delete wellness session",
    description="Soft delete a wellness session.",
)
def delete_wellness_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = WellnessSessionService.delete(db, session_id, user)
    if not session:
        return error_response("Wellness session not found", 404)
    return success_response("Wellness session deleted successfully", {})
