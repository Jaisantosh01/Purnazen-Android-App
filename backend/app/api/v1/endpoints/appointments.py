from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.appointment import BookAppointmentRequest, UpdateAppointmentRequest
from app.services.appointment_service import AppointmentService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.post(
    "/book",
    status_code=201,
    summary="Book an appointment",
    description=(
        "Books a slot with a doctor. Returns **409** when the doctor already has a "
        "non-cancelled appointment for the same date and slot."
    ),
)
def book_appointment(
    body: BookAppointmentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = AppointmentService.book(db, user, body)

    if not response["success"]:
        return error_response(response["message"], status_code)

    return success_response(response["message"], response["appointment"], status_code)


@router.put(
    "/{appointment_id}",
    summary="Update an appointment",
)
def update_appointment(
    appointment_id: int,
    body: UpdateAppointmentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appointment = AppointmentService.update(db, user, appointment_id, body)
    if not appointment:
        return error_response("Appointment not found", 404)
    return success_response("Appointment updated successfully", appointment.to_dict())


@router.get(
    "",
    summary="List my appointments",
    description="The authenticated user's appointments, newest first, with an `isUpcoming` flag.",
)
def get_appointments(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return success_response(
        "Appointments fetched successfully",
        AppointmentService.get_user_appointments(db, user.id),
    )
