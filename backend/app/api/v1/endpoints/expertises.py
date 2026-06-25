import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.expertise import ExpertiseCreate, ExpertiseUpdate
from app.services.expertise_service import ExpertiseService
from app.utils.responses import error_response, success_response

router = APIRouter(
    prefix="/expertises",
    tags=["Expertises"],
)

@router.get("")
def get_expertises(
    db: Session = Depends(get_db),
):
    return success_response(
        "Expertises fetched successfully",
        [e.to_dict() for e in ExpertiseService.get_all(db)],
    )

@router.post("")
def create_expertise(
    body: ExpertiseCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expertise = ExpertiseService.create(
        db,
        body.name,
        user,
    )

    return success_response(
        "Expertise created successfully",
        expertise.to_dict(),
    )

@router.put("/{expertise_id}")
def update_expertise(
    expertise_id: uuid.UUID,
    body: ExpertiseUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expertise = ExpertiseService.update(
        db,
        expertise_id,
        body.name,
        user,
    )

    if not expertise:
        return error_response(
            "Expertise not found",
            404,
        )

    return success_response(
        "Expertise updated successfully",
        expertise.to_dict(),
    )

@router.delete("/{expertise_id}")
def delete_expertise(
    expertise_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expertise = ExpertiseService.delete(
        db,
        expertise_id,
        user,
    )

    if not expertise:
        return error_response(
            "Expertise not found",
            404,
        )

    return success_response(
        "Expertise deleted successfully",
        {},
    )