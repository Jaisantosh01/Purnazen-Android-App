import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, get_current_user, require_role
from app.models.doctor_leave import DoctorLeave
from app.models.doctor import Doctor
from app.models.slot_timings import SlotTimings
from app.models.user import User
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/doctor-leaves", tags=["Doctor Leaves"])


def _parse_time(value: str):
    """Parse HH:MM (24h) into a time object."""
    return datetime.strptime(value.strip(), "%H:%M").time()


def _leave_to_dict(leave: DoctorLeave) -> dict:
    doctor_name = None
    if leave.doctor:
        doctor_name = leave.doctor.user.full_name if leave.doctor.user else None

    slot_time = None
    if leave.slot_timing:
        slot_time = {
            "start_time": leave.slot_timing.start_time.strftime("%I:%M %p") if leave.slot_timing.start_time else None,
            "end_time": leave.slot_timing.end_time.strftime("%I:%M %p") if leave.slot_timing.end_time else None,
        }

    return {
        "id": str(leave.id),
        "doctor_id": str(leave.doctor_id),
        "doctor_name": doctor_name,
        "leave_date": leave.leave_date.isoformat() if leave.leave_date else None,
        "slot_timing_id": str(leave.slot_timing_id) if leave.slot_timing_id else None,
        "slot_time": slot_time,
        "doctor_reason": leave.doctor_reason,
        "admin_reason": leave.admin_reason,
        "status": leave.status,
        "is_active": leave.is_active,
        "created_at": leave.created_at.isoformat() if leave.created_at else None,
        "updated_at": leave.updated_at.isoformat() if leave.updated_at else None,
    }


@router.get("/stats", summary="Get doctor leave KPI counts")
def get_leave_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    counts = (
        db.query(DoctorLeave.status, func.count(DoctorLeave.id))
        .group_by(DoctorLeave.status)
        .all()
    )
    stats = {"pending": 0, "approved": 0, "rejected": 0}
    for status, count in counts:
        stats[status] = count
    return success_response("Leave stats fetched successfully", stats)


@router.get("", summary="Fetch all doctor leaves")
def get_leaves(
    doctor_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    from_date: str | None = Query(default=None, description="YYYY-MM-DD"),
    to_date: str | None = Query(default=None, description="YYYY-MM-DD"),
    search: str | None = Query(default=None, description="Search by doctor name"),
    leave_type: str | None = Query(default=None, description="full_day or partial"),
    time_from: str | None = Query(default=None, description="HH:MM start time filter"),
    time_to: str | None = Query(default=None, description="HH:MM end time filter"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(DoctorLeave).options(
        joinedload(DoctorLeave.doctor).joinedload(Doctor.user),
        joinedload(DoctorLeave.slot_timing),
    )

    if doctor_id:
        query = query.filter(DoctorLeave.doctor_id == doctor_id)
    if status:
        query = query.filter(DoctorLeave.status == status)
    if from_date:
        query = query.filter(DoctorLeave.leave_date >= date.fromisoformat(from_date))
    if to_date:
        query = query.filter(DoctorLeave.leave_date <= date.fromisoformat(to_date))
    if search:
        query = query.join(Doctor, DoctorLeave.doctor_id == Doctor.id).join(
            User, Doctor.user_id == User.id
        ).filter(User.full_name.ilike(f"%{search}%"))
    if leave_type == "full_day":
        query = query.filter(DoctorLeave.slot_timing_id.is_(None))
    elif leave_type == "partial":
        query = query.filter(DoctorLeave.slot_timing_id.isnot(None))
    if time_from or time_to:
        query = query.join(SlotTimings, DoctorLeave.slot_timing_id == SlotTimings.id)
        if time_from:
            query = query.filter(SlotTimings.start_time >= _parse_time(time_from))
        if time_to:
            query = query.filter(SlotTimings.end_time <= _parse_time(time_to))

    leaves = query.order_by(DoctorLeave.leave_date.desc()).all()
    return success_response("Doctor leaves fetched successfully", [_leave_to_dict(l) for l in leaves])


@router.post("", summary="Create a doctor leave", dependencies=[Depends(require_role("admin"))])
def create_leave(
    data: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doctor_id = data.get("doctor_id")
    if not doctor_id:
        return error_response("doctor_id is required", 400)

    doctor = db.get(Doctor, doctor_id)
    if not doctor:
        return error_response("Doctor not found", 404)

    leave_date = data.get("leave_date")
    if not leave_date:
        return error_response("leave_date is required", 400)

    if isinstance(leave_date, str):
        leave_date = date.fromisoformat(leave_date)

    leave = DoctorLeave(
        doctor_id=doctor_id,
        leave_date=leave_date,
        slot_timing_id=data.get("slot_timing_id"),
        doctor_reason=data.get("doctor_reason"),
        admin_reason=data.get("admin_reason"),
        status=data.get("status", "pending"),
        created_by=user.id,
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return success_response("Leave created successfully", _leave_to_dict(leave), 201)


@router.put("/{leave_id}", summary="Update a doctor leave", dependencies=[Depends(require_role("admin"))])
def update_leave(
    leave_id: uuid.UUID,
    data: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    leave = db.get(DoctorLeave, leave_id)
    if not leave:
        return error_response("Leave not found", 404)

    if "leave_date" in data:
        val = data["leave_date"]
        leave.leave_date = date.fromisoformat(val) if isinstance(val, str) else val
    if "slot_timing_id" in data:
        leave.slot_timing_id = data["slot_timing_id"]
    if "doctor_reason" in data:
        leave.doctor_reason = data["doctor_reason"]
    if "admin_reason" in data:
        leave.admin_reason = data["admin_reason"]
    if "status" in data:
        leave.status = data["status"]
    if "is_active" in data:
        leave.is_active = data["is_active"]

    leave.updated_at = leave.updated_at
    leave.updated_by = user.id
    db.commit()
    db.refresh(leave)
    return success_response("Leave updated successfully", _leave_to_dict(leave))


@router.patch("/{leave_id}/status", summary="Update leave status only", dependencies=[Depends(require_role("admin"))])
def update_leave_status(
    leave_id: uuid.UUID,
    data: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    leave = db.get(DoctorLeave, leave_id)
    if not leave:
        return error_response("Leave not found", 404)

    status = data.get("status")
    if not status or status not in ("pending", "approved", "rejected"):
        return error_response("Invalid status. Must be pending, approved, or rejected", 400)

    leave.status = status
    if data.get("admin_reason"):
        leave.admin_reason = data["admin_reason"]
    leave.updated_at = leave.updated_at
    leave.updated_by = user.id
    db.commit()
    db.refresh(leave)
    return success_response("Leave status updated successfully", _leave_to_dict(leave))
