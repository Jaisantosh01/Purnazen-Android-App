from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services.session_catalog_service import SessionCatalogService
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
    "/sessions/{session_key}",
    summary="Wellness session detail",
    description="A single wellness session in the player shape; 404 when the key is unknown.",
)
def get_session(session_key: str, db: Session = Depends(get_db)):
    session = SessionCatalogService.get_wellness_session(db, session_key)
    if not session:
        return error_response("Session not found", 404)

    return success_response("Session fetched successfully", session)


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
