import uuid
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.models.doctor import Doctor
from app.models.consultation_type import ConsultationType
from app.models.appointment import Appointment
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
    appointment_id: uuid.UUID,
    body: UpdateAppointmentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appointment = AppointmentService.update(db, user, appointment_id, body)
    if not appointment:
        return error_response("Appointment not found", 404)
    return success_response("Appointment updated successfully", appointment.to_dict())


@router.get(
    "/doctor",
    summary="Doctor appointment dashboard",
    description=(
        "Returns all appointments for the currently authenticated doctor. "
        "Supports optional `date` (YYYY-MM-DD) and `status` query filters."
    ),
)
def get_doctor_appointments(
    date: Optional[date_type] = Query(None, description="Filter by appointment date (YYYY-MM-DD)"),
    status: Optional[str] = Query(None, description="Filter by status: pending | booked | cancelled | completed"),
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    result = AppointmentService.get_doctor_appointments(
        db, user, filter_date=date, filter_status=status
    )
    if result is None:
        return error_response("Doctor profile not found for this user", 404)
    return success_response("Doctor appointments fetched successfully", result)


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


@router.get(
    "/admin",
    summary="List all appointments (admin)",
)
def get_all_appointments_admin(
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    appointments = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.slot_timing),
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialty),
            joinedload(Appointment.consultation_type),
            joinedload(Appointment.user),
        )
        .order_by(Appointment.date.desc())
        .all()
    )
    serialized = [a.to_dict() for a in appointments]
    return success_response("Appointments fetched successfully", {"appointments": serialized, "total": len(serialized)})


@router.get(
    "/consultation-types",
    summary="Get all consultation types",
)
def get_consultation_types(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    types = db.query(ConsultationType).filter(ConsultationType.is_active == True).all()
    return success_response("Consultation types fetched", [t.name for t in types])
