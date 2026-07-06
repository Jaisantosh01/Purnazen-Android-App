import uuid
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db, require_role
from app.models.doctor import Doctor
from app.models.doctor_leave import DoctorLeave
from app.models.doctor_leave_slot import DoctorLeaveSlot
from app.models.user import User
from app.schemas.doctor_leave import (
    DoctorLeaveCreate,
    DoctorLeaveStatusUpdate,
    DoctorLeaveUpdate,
)
from app.services.doctor_leave_service import DoctorLeaveService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/doctor-leaves", tags=["Doctor Leaves"])


# ─────────────────────────────────────────────────────────────────────────────
# Internal helper — used only by the legacy admin read endpoints that still
# do their own querying (these are not touched per the "do not change existing
# logic" requirement).
# ─────────────────────────────────────────────────────────────────────────────

def _leave_to_dict_admin(leave: DoctorLeave) -> dict:
    """
    Serialises a DoctorLeave for the admin list / detail endpoints.
    Enriches with doctor_name and slot timing detail where available.
    """
    doctor_name = None
    if leave.doctor and leave.doctor.user:
        doctor_name = leave.doctor.user.full_name

    slot_dicts = []
    for s in (leave.slots or []):
        entry = {"slot_timing_id": str(s.slot_timing_id)}
        if s.slot_timing:
            entry["start_time"] = (
                s.slot_timing.start_time.strftime("%I:%M %p")
                if s.slot_timing.start_time
                else None
            )
            entry["end_time"] = (
                s.slot_timing.end_time.strftime("%I:%M %p")
                if s.slot_timing.end_time
                else None
            )
        slot_dicts.append(entry)

    if leave.leave_type == "multiple" and leave.start_date and leave.end_date:
        if leave.start_date == leave.end_date:
            date_str = leave.start_date.isoformat()
        else:
            date_str = f"{leave.start_date.isoformat()} to {leave.end_date.isoformat()}"
    elif leave.start_date:
        date_str = leave.start_date.isoformat()
    else:
        date_str = None

    return {
        "id": str(leave.id),
        "doctorId": str(leave.doctor_id),
        "doctorName": doctor_name,
        "leaveType": leave.leave_type,
        "startDate": leave.start_date.isoformat() if leave.start_date else None,
        "endDate": leave.end_date.isoformat() if leave.end_date else None,
        "startTime": (
            leave.start_time.strftime("%I:%M %p") if leave.start_time else None
        ),
        "endTime": leave.end_time.strftime("%I:%M %p") if leave.end_time else None,
        "reason": leave.reason,
        "notes": leave.notes,
        "adminReason": leave.admin_reason,
        "status": leave.status,
        "isActive": leave.is_active,
        "approvedBy": str(leave.approved_by) if leave.approved_by else None,
        "approvedAt": leave.approved_at.isoformat() if leave.approved_at else None,
        "appliedAt": leave.applied_at.isoformat() if leave.applied_at else None,
        "createdAt": leave.created_at.isoformat() if leave.created_at else None,
        "updatedAt": leave.updated_at.isoformat() if leave.updated_at else None,
        "slots": slot_dicts,
        "leaveDate": date_str,
    }


# ─────────────────────────────────────────────────────────────────────────────
# DOCTOR SELF-SERVICE  (authenticated doctor, no admin role required)
# ─────────────────────────────────────────────────────────────────────────────


@router.post(
    "",
    status_code=201,
    summary="Submit a leave request",
    description=(
        "Doctor submits a new leave request. "
        "`leaveType` must be **single**, **multiple**, or **custom** (Partial Day). "
        "For Partial Day, `slotTimingIds` (list of UUIDs) is required."
    ),
)
def create_leave(
    body: DoctorLeaveCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = DoctorLeaveService.create_leave(db, user, body)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response["leave"], status_code)


@router.get(
    "",
    summary="List the authenticated doctor's leave requests",
    description=(
        "Returns all leave requests for the currently logged-in doctor, newest first. "
        "Filter by `status` (pending | approved | rejected | cancelled)."
    ),
)
def get_leaves(
    status: Optional[str] = Query(
        None,
        description="Filter by status: pending | approved | rejected | cancelled",
    ),
    limit: int = Query(50, ge=1, le=200, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = DoctorLeaveService.get_leave_history(
        db, user, status=status, limit=limit, offset=offset
    )
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response)


@router.get(
    "/history",
    summary="Leave history for the authenticated doctor",
    description=(
        "Alias for GET /doctor-leaves. Returns the full leave history for the "
        "logged-in doctor, newest first, with optional status filtering."
    ),
)
def get_leave_history(
    status: Optional[str] = Query(
        None,
        description="Filter by status: pending | approved | rejected | cancelled",
    ),
    limit: int = Query(50, ge=1, le=200, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = DoctorLeaveService.get_leave_history(
        db, user, status=status, limit=limit, offset=offset
    )
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response)


@router.get(
    "/pending",
    summary="Pending leave requests for the authenticated doctor",
    description="Returns all leave requests with status **pending** for the logged-in doctor.",
)
def get_pending_leaves(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = DoctorLeaveService.get_pending_leaves(db, user)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response)


@router.get(
    "/{leave_id}",
    summary="Get details of a specific leave request",
    description="Returns the details of a specific leave request for the authenticated doctor.",
)
def get_leave_by_id(
    leave_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = DoctorLeaveService.get_leave_by_id(db, user, leave_id)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response["leave"])


@router.put(
    "/{leave_id}",
    summary="Update a pending leave request",
    description=(
        "The authenticated doctor can edit a **pending** leave request. "
        "Only the owning doctor may update their own request. "
        "Approved or rejected requests cannot be changed."
    ),
)
def update_leave(
    leave_id: uuid.UUID,
    body: DoctorLeaveUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = DoctorLeaveService.update_leave(db, user, leave_id, body)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response["leave"])


@router.put(
    "/{leave_id}/approve",
    summary="Approve a leave request (admin)",
    description=(
        "Admin-only. Transitions the leave status from **pending** → **approved**. "
        "Optionally attach an `adminReason`."
    ),
)
def approve_leave(
    leave_id: uuid.UUID,
    body: DoctorLeaveStatusUpdate = DoctorLeaveStatusUpdate(status="approved"),
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    # Force the status to "approved" regardless of what the body says
    from app.schemas.doctor_leave import DoctorLeaveStatusUpdate as _SU

    approve_body = _SU(status="approved", admin_reason=body.admin_reason)
    response, status_code = DoctorLeaveService.update_leave_status(
        db, user, leave_id, approve_body
    )
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response["leave"])


@router.put(
    "/{leave_id}/reject",
    summary="Reject a leave request (admin)",
    description=(
        "Admin-only. Transitions the leave status from **pending** → **rejected**. "
        "Provide `adminReason` to explain the rejection."
    ),
)
def reject_leave(
    leave_id: uuid.UUID,
    body: DoctorLeaveStatusUpdate = DoctorLeaveStatusUpdate(status="rejected"),
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    from app.schemas.doctor_leave import DoctorLeaveStatusUpdate as _SU

    reject_body = _SU(status="rejected", admin_reason=body.admin_reason)
    response, status_code = DoctorLeaveService.update_leave_status(
        db, user, leave_id, reject_body
    )
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response["leave"])


@router.delete(
    "/{leave_id}",
    summary="Cancel / delete a pending leave request",
    description=(
        "The authenticated doctor soft-deletes their own **pending** leave request. "
        "Approved or rejected requests cannot be deleted."
    ),
)
def delete_leave(
    leave_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = DoctorLeaveService.delete_leave(db, user, leave_id)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"])


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN ENDPOINTS  (require admin role, not changed from original behaviour)
# ─────────────────────────────────────────────────────────────────────────────


@router.get(
    "/stats",
    summary="Leave KPI counts (admin)",
    description="Returns a count breakdown of all leave records grouped by status.",
)
def get_leave_stats(
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    counts = (
        db.query(DoctorLeave.status, func.count(DoctorLeave.id))
        .group_by(DoctorLeave.status)
        .all()
    )
    stats = {"pending": 0, "approved": 0, "rejected": 0, "cancelled": 0}
    for status, count in counts:
        if status in stats:
            stats[status] = count
    return success_response("Leave stats fetched successfully", stats)


@router.get(
    "/admin",
    summary="List all leave requests (admin)",
    description=(
        "Returns all leave records across all doctors. "
        "Supports filtering by `doctor_id`, `status`, `from_date`, `to_date`, and `leave_type`."
    ),
)
def get_all_leaves_admin(
    doctor_id: Optional[uuid.UUID] = Query(None, description="Filter by doctor UUID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    from_date: Optional[date_type] = Query(None, description="Filter start_date >= this date"),
    to_date: Optional[date_type] = Query(None, description="Filter end_date <= this date"),
    leave_type: Optional[str] = Query(None, description="single | multiple | custom"),
    search: Optional[str] = Query(None, description="Search by doctor name"),
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    query = (
        db.query(DoctorLeave)
        .options(
            joinedload(DoctorLeave.doctor).joinedload(Doctor.user),
            joinedload(DoctorLeave.slots).joinedload(DoctorLeaveSlot.slot_timing),
        )
        .filter(DoctorLeave.is_active == True)
    )

    if doctor_id:
        query = query.filter(DoctorLeave.doctor_id == doctor_id)
    if status:
        query = query.filter(DoctorLeave.status == status)
    if from_date:
        query = query.filter(DoctorLeave.start_date >= from_date)
    if to_date:
        query = query.filter(DoctorLeave.end_date <= to_date)
    if leave_type:
        query = query.filter(DoctorLeave.leave_type == leave_type)
    if search:
        doctor_ids = (
            db.query(Doctor.id)
            .join(User, Doctor.user_id == User.id)
            .filter(User.full_name.ilike(f"%{search}%"))
            .subquery()
        )
        query = query.filter(DoctorLeave.doctor_id.in_(doctor_ids))

    leaves = query.order_by(DoctorLeave.applied_at.desc()).all()
    serialized = [_leave_to_dict_admin(l) for l in leaves]
    return success_response(
        "Doctor leaves fetched successfully",
        {"leaves": serialized, "total": len(serialized)},
    )


@router.patch(
    "/{leave_id}/status",
    summary="Update leave status (admin)",
    description=(
        "Admin-only. Set status to any valid value: "
        "**pending** | **approved** | **rejected** | **cancelled**."
    ),
)
def update_leave_status_admin(
    leave_id: uuid.UUID,
    body: DoctorLeaveStatusUpdate,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    response, status_code = DoctorLeaveService.update_leave_status(
        db, user, leave_id, body
    )
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response["leave"])
