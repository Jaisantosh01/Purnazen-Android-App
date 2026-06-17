from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.specialty import SpecialtyCreate, SpecialtyUpdate
from app.services.specialty_service import SpecialtyService
from app.utils.responses import error_response, success_response

router = APIRouter(
    prefix="/specialties",
    tags=["Specialties"],
)


@router.get(
    "",
    summary="Get all specialties",
)
def get_specialties(
    db: Session = Depends(get_db),
):
    return success_response(
        "Specialties fetched successfully",
        [
            specialty.to_dict()
            for specialty in SpecialtyService.get_all(db)
        ],
    )


@router.post(
    "",
    summary="Create specialty",
)
def create_specialty(
    body: SpecialtyCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    specialty = SpecialtyService.create(
        db,
        body.name,
        body.description,
        user,
    )

    return success_response(
        "Specialty created successfully",
        specialty.to_dict(),
    )


@router.put(
    "/{specialty_id}",
    summary="Update specialty",
)
def update_specialty(
    specialty_id: int,
    body: SpecialtyUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    specialty = SpecialtyService.update(
        db,
        specialty_id,
        body.name,
        body.description,
        user,
    )

    if not specialty:
        return error_response(
            "Specialty not found",
            404,
        )

    return success_response(
        "Specialty updated successfully",
        specialty.to_dict(),
    )


@router.delete(
    "/{specialty_id}",
    summary="Delete specialty",
)
def delete_specialty(
    specialty_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    specialty = SpecialtyService.delete(
        db,
        specialty_id,
        user,
    )

    if not specialty:
        return error_response(
            "Specialty not found",
            404,
        )

    return success_response(
        "Specialty deleted successfully",
        {},
    )