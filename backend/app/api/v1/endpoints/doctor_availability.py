from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.doctor_availability import (
    DoctorAvailabilityCreate,
    DoctorAvailabilityUpdate,
)
from app.services.doctor_availability_service import (
    DoctorAvailabilityService,
)
from app.utils.responses import (
    error_response,
    success_response,
)

router = APIRouter(
    prefix="/doctor-availability",
    tags=["Doctor Availability"],
)


@router.get(
    "",
    summary="Get all doctor availability records",
)
def get_availability(
    db: Session = Depends(get_db),
):
    return success_response(
        "Doctor availability fetched successfully",
        [
            availability.to_dict()
            for availability in DoctorAvailabilityService.get_all(db)
        ],
    )


@router.post(
    "",
    summary="Create doctor availability",
)
def create_availability(
    body: DoctorAvailabilityCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    availability = DoctorAvailabilityService.create(
        db,
        body.doctor_id,
        body.day_of_week,
        body.start_time,
        body.end_time,
        body.slot_duration_minutes,
        user,
    )

    return success_response(
        "Doctor availability created successfully",
        availability.to_dict(),
    )


@router.put(
    "/{availability_id}",
    summary="Update doctor availability",
)
def update_availability(
    availability_id: int,
    body: DoctorAvailabilityUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    availability = DoctorAvailabilityService.update(
        db,
        availability_id,
        body.day_of_week,
        body.start_time,
        body.end_time,
        body.slot_duration_minutes,
        user,
    )

    if not availability:
        return error_response(
            "Doctor availability not found",
            404,
        )

    return success_response(
        "Doctor availability updated successfully",
        availability.to_dict(),
    )


@router.delete(
    "/{availability_id}",
    summary="Delete doctor availability",
)
def delete_availability(
    availability_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    availability = DoctorAvailabilityService.delete(
        db,
        availability_id,
        user,
    )

    if not availability:
        return error_response(
            "Doctor availability not found",
            404,
        )

    return success_response(
        "Doctor availability deleted successfully",
        {},
    )