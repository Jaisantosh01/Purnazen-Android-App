from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.services.face_glow_routine_service import FaceGlowRoutineService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/face-glow", tags=["Face Glow"])


@router.get(
    "/routines",
    summary="Face glow routine catalogue",
    description="Returns all available face acupressure routines.",
)
def get_routines(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    routines = FaceGlowRoutineService.get_all(db)
    return success_response(
        "Face glow routines fetched successfully",
        {"routines": routines, "total": len(routines)},
    )


@router.get(
    "/routines/{routine_key}",
    summary="Single face glow routine",
    description="Returns a single routine by key; 404 when the key is unknown.",
)
def get_routine(
    routine_key: str,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    routine = FaceGlowRoutineService.get_by_key(db, routine_key)
    if not routine:
        return error_response("Routine not found", 404)
    return success_response("Routine fetched successfully", routine)
