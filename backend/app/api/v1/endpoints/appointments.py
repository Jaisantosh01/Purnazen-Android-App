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
    description=(
        "Writable by the patient who booked it, the doctor it belongs to, or an "
        "admin. `payment_status` is staff-only — patients move it through the "
        "payments flow, not by writing to the appointment."
    ),
)
def update_appointment(
    appointment_id: uuid.UUID,
    body: UpdateAppointmentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.get(Appointment, appointment_id)
    if not existing:
        return error_response("Appointment not found", 404)

    role = user.role.name if user.role else None
    is_patient = existing.user_id == user.id
    is_owning_doctor = bool(existing.doctor and existing.doctor.user_id == user.id)
    is_staff = is_owning_doctor or role == "admin"

    # Same party rule as the read: without it any authenticated account could
    # cancel — or mark paid — an appointment belonging to someone else.
    if not (is_patient or is_staff):
        return error_response("Appointment not found", 404)
    if body.payment_status is not None and not is_staff:
        return error_response("Not allowed to change the payment status", 403)

    appointment = AppointmentService.update(db, user, appointment_id, body)
    if not appointment:
        return error_response("Appointment not found", 404)

    payload = (
        AppointmentService.serialize_for_doctor(db, appointment)
        if is_staff
        else appointment.to_dict()
    )
    return success_response("Appointment updated successfully", payload)


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
            # The admin detail popup renders the clinic / home-visit address,
            # so eager-load both instead of lazy-loading per row.
            joinedload(Appointment.clinic),
            joinedload(Appointment.user_address),
        )
        .order_by(Appointment.date.desc())
        .all()
    )
    serialized = [a.to_dict() for a in appointments]
    return success_response("Appointments fetched successfully", {"appointments": serialized, "total": len(serialized)})


@router.get(
    "/consultation-types",
    summary="Get all consultation types",
    description="Active visit modes (Clinic Visit / Home Visit / Video Call). "
    "Returns full records — the admin doctor editor needs the ids to attach "
    "per-type pricing.",
)
def get_consultation_types(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    types = db.query(ConsultationType).filter(ConsultationType.is_active == True).all()
    return success_response("Consultation types fetched", [t.to_dict() for t in types])


@router.get(
    "/{appointment_id}",
    summary="Get appointment details",
    description=(
        "Readable by the patient who booked it, the doctor it belongs to, or an "
        "admin. Doctors and admins additionally get the patient profile fields "
        "(age, gender, contact) and the prior-visit count, matching the shape of "
        "`GET /appointments/doctor`."
    ),
)
def get_appointment_detail(
    appointment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        return error_response("Appointment not found", 404)

    role = user.role.name if user.role else None
    is_patient = appointment.user_id == user.id
    is_owning_doctor = bool(
        appointment.doctor and appointment.doctor.user_id == user.id
    )

    # An appointment is clinical data about a named patient — only the two
    # parties and an admin may read it. Previously any authenticated account
    # could fetch any appointment by id.
    if not (is_patient or is_owning_doctor or role == "admin"):
        return error_response("Appointment not found", 404)

    if is_owning_doctor or role == "admin":
        payload = AppointmentService.serialize_for_doctor(db, appointment)
    else:
        payload = appointment.to_dict()

    return success_response("Appointment details fetched successfully", payload)
