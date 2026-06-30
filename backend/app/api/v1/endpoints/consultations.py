import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.user import User
from app.schemas.consultation import (
    CreateConsultationRecordRequest,
    UpdateConsultationRecordRequest,
)
from app.services.consultation_service import ConsultationService
from app.utils.responses import error_response, success_response

# Shares the /appointments prefix; clinical records always hang off an appointment.
router = APIRouter(prefix="/appointments", tags=["Consultation Records"])


@router.get(
    "/{appointment_id}/records",
    summary="List clinical records for an appointment (doctor)",
)
def list_records(
    appointment_id: uuid.UUID,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    records = ConsultationService.list_records(db, user, appointment_id)
    if records is None:
        return error_response("Appointment not found", 404)
    return success_response("Consultation records fetched successfully", records)


@router.post(
    "/{appointment_id}/records",
    status_code=201,
    summary="Add a clinical record to an appointment (doctor)",
)
def create_record(
    appointment_id: uuid.UUID,
    body: CreateConsultationRecordRequest,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    record = ConsultationService.create_record(db, user, appointment_id, body)
    if record is None:
        return error_response("Appointment not found", 404)
    return success_response("Consultation record added", record, 201)


@router.put(
    "/{appointment_id}/records/{record_id}",
    summary="Update a clinical record (doctor)",
)
def update_record(
    appointment_id: uuid.UUID,
    record_id: uuid.UUID,
    body: UpdateConsultationRecordRequest,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    record = ConsultationService.update_record(db, user, appointment_id, record_id, body)
    if record is None:
        return error_response("Record not found", 404)
    return success_response("Consultation record updated", record)


@router.delete(
    "/{appointment_id}/records/{record_id}",
    summary="Delete a clinical record (doctor)",
)
def delete_record(
    appointment_id: uuid.UUID,
    record_id: uuid.UUID,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    ok = ConsultationService.delete_record(db, user, appointment_id, record_id)
    if not ok:
        return error_response("Record not found", 404)
    return success_response("Consultation record deleted", None)
