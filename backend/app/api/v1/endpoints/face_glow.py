from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/face-glow", tags=["Face Glow"])

# Curated catalogue — seeded here until a FaceGlowRoutine DB model is added.
_ROUTINES = [
    {
        "key": "MorningGlow",
        "icon": "🌅",
        "title": "Morning Glow Routine",
        "duration": "10 min",
        "benefits": ["Reduces puffiness", "Boosts circulation", "Awakens skin tone"],
    },
    {
        "key": "FacialAcupressure",
        "icon": "💆",
        "title": "Facial Acupressure",
        "duration": "8 min",
        "benefits": ["Relieves tension headaches", "Lifts cheekbones", "Smooths fine lines"],
    },
    {
        "key": "NightRepair",
        "icon": "🌙",
        "title": "Night Repair Routine",
        "duration": "12 min",
        "benefits": ["Promotes cell renewal", "Deep relaxation", "Reduces dark circles"],
    },
    {
        "key": "GuaShaFlow",
        "icon": "✨",
        "title": "Gua Sha Flow",
        "duration": "15 min",
        "benefits": ["Sculpts jawline", "Drains lymph nodes", "Brightens complexion"],
    },
]


@router.get(
    "/routines",
    summary="Face glow routine catalogue",
    description="Returns all available face acupressure routines.",
)
def get_routines(_user: User = Depends(get_current_user)):
    return success_response(
        "Face glow routines fetched successfully",
        {"routines": _ROUTINES, "total": len(_ROUTINES)},
    )


@router.get(
    "/routines/{routine_key}",
    summary="Single face glow routine",
    description="Returns a single routine by key; 404 when the key is unknown.",
)
def get_routine(routine_key: str, _user: User = Depends(get_current_user)):
    routine = next((r for r in _ROUTINES if r["key"] == routine_key), None)
    if not routine:
        return error_response("Routine not found", 404)
    return success_response("Routine fetched successfully", routine)
