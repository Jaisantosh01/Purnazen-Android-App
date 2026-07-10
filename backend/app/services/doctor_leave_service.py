import uuid
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.user import User
from app.models.doctor_leave import DoctorLeave
from app.repositories.doctor_leave_repository import DoctorLeaveRepository
from app.schemas.doctor_leave import (
    DoctorLeaveCreate,
    DoctorLeaveStatusUpdate,
    DoctorLeaveUpdate,
)

# ── Valid leave types ─────────────────────────────────────────────────────────

_VALID_LEAVE_TYPES = {"single", "multiple", "custom"}

# ── Allowed status transitions ────────────────────────────────────────────────
# Only pending leaves may be approved or rejected.

_ALLOWED_TRANSITIONS = {
    "approved": {"pending"},
    "rejected": {"pending"},
    "cancelled": {"pending"},
}


def _resolve_doctor(db: Session, user: User) -> Doctor | None:
    """Return the Doctor row linked to the authenticated user, or None."""
    return db.query(Doctor).filter(Doctor.user_id == user.id).first()


def _leave_to_dict(leave) -> dict:
    """
    Serialize a DoctorLeave ORM object to a plain dict that mirrors the
    camelCase convention used everywhere else in the project.
    """
    if leave.leave_type == "multiple" and leave.start_date and leave.end_date:
        if leave.start_date == leave.end_date:
            date_str = leave.start_date.isoformat()
        else:
            date_str = f"{leave.start_date.isoformat()} to {leave.end_date.isoformat()}"
    elif leave.start_date:
        date_str = leave.start_date.isoformat()
    elif leave.leave_date:
        date_str = leave.leave_date.isoformat()
    else:
        date_str = None

    return {
        "id": str(leave.id),
        "doctorId": str(leave.doctor_id),
        "leaveType": leave.leave_type,
        "startDate": leave.start_date.isoformat() if leave.start_date else (leave.leave_date.isoformat() if leave.leave_date else None),
        "endDate": leave.end_date.isoformat() if leave.end_date else (leave.leave_date.isoformat() if leave.leave_date else None),
        "leaveDate": date_str,
        "startTime": leave.start_time.isoformat() if leave.start_time else None,
        "endTime": leave.end_time.isoformat() if leave.end_time else None,
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
        "slots": [
            {
                "id": str(s.id),
                "slotTimingId": str(s.slot_timing_id),
                "startTime": s.slot_timing.start_time.strftime("%I:%M %p") if s.slot_timing and s.slot_timing.start_time else "",
                "endTime": s.slot_timing.end_time.strftime("%I:%M %p") if s.slot_timing and s.slot_timing.end_time else "",
            }
            for s in (leave.slots or [])
        ],
    }


class DoctorLeaveService:

    # ── Create ────────────────────────────────────────────────────────────────

    @staticmethod
    def create_leave(db: Session, user: User, data: DoctorLeaveCreate):
        # Resolve the Doctor record for the authenticated user
        doctor = _resolve_doctor(db, user)
        if not doctor:
            return {"success": False, "message": "Doctor profile not found"}, 404

        # Past date guard
        if data.start_date < date.today():
            return {
                "success": False,
                "message": "Start date must not be in the past",
            }, 400

        # Date range guard
        if data.end_date < data.start_date:
            return {
                "success": False,
                "message": "End date cannot be earlier than start date",
            }, 400

        # Overlapping active leave guard
        overlapping = db.query(DoctorLeave).filter(
            DoctorLeave.doctor_id == doctor.id,
            DoctorLeave.is_active == True,
            DoctorLeave.status.in_(["pending", "approved"]),
            DoctorLeave.start_date <= data.end_date,
            DoctorLeave.end_date >= data.start_date,
        ).first()

        if overlapping:
            status_str = "pending approval" if overlapping.status == "pending" else "approved"
            return {
                "success": False,
                "message": f"You already have a {status_str} leave request overlapping this date range.",
            }, 400

        # Leave type guard
        if data.leave_type not in _VALID_LEAVE_TYPES:
            return {
                "success": False,
                "message": f"leave_type must be one of {sorted(_VALID_LEAVE_TYPES)}",
            }, 400

        # Partial Day must have at least one slot
        if data.leave_type == "custom":
            if not data.slot_timing_ids:
                return {
                    "success": False,
                    "message": "Partial Day leave must include at least one slot timing",
                }, 400

        leave = DoctorLeaveRepository.create_leave(
            db,
            doctor_id=doctor.id,
            created_by=user.id,
            slot_timing_ids=data.slot_timing_ids,
            leave_type=data.leave_type,
            start_date=data.start_date,
            end_date=data.end_date,
            start_time=data.start_time,
            end_time=data.end_time,
            reason=data.reason,
            notes=data.notes,
            status="pending",
        )

        return {
            "success": True,
            "message": "Leave request submitted successfully",
            "leave": _leave_to_dict(leave),
        }, 201

    # ── Update ────────────────────────────────────────────────────────────────

    @staticmethod
    def update_leave(
        db: Session,
        user: User,
        leave_id: uuid.UUID,
        data: DoctorLeaveUpdate,
    ):
        doctor = _resolve_doctor(db, user)
        if not doctor:
            return {"success": False, "message": "Doctor profile not found"}, 404

        leave = DoctorLeaveRepository.get_leave_by_id(db, leave_id)
        if not leave or not leave.is_active:
            return {"success": False, "message": "Leave request not found"}, 404

        # Ownership check — a doctor can only edit their own leave
        if leave.doctor_id != doctor.id:
            return {"success": False, "message": "Access denied"}, 403

        # Only pending leaves may be modified
        if leave.status != "pending":
            return {
                "success": False,
                "message": "Only pending leave requests can be updated",
            }, 400

        # Derive the effective date range after the patch is applied
        effective_start = data.start_date if data.start_date is not None else leave.start_date
        effective_end = data.end_date if data.end_date is not None else leave.end_date

        if effective_start < date.today():
            return {
                "success": False,
                "message": "Start date must not be in the past",
            }, 400

        if effective_end < effective_start:
            return {
                "success": False,
                "message": "End date cannot be earlier than start date",
            }, 400

        # For custom leave: if slot_timing_ids are explicitly set, require at least one
        if leave.leave_type == "custom" and data.slot_timing_ids is not None:
            if not data.slot_timing_ids:
                return {
                    "success": False,
                    "message": "Partial Day leave must include at least one slot timing",
                }, 400

        fields = data.model_dump(exclude_unset=True, exclude={"slot_timing_ids"})
        updated = DoctorLeaveRepository.update_leave(
            db,
            leave=leave,
            updated_by=user.id,
            slot_timing_ids=data.slot_timing_ids,
            **fields,
        )

        return {
            "success": True,
            "message": "Leave request updated successfully",
            "leave": _leave_to_dict(updated),
        }, 200

    # ── Delete (soft) ─────────────────────────────────────────────────────────

    @staticmethod
    def delete_leave(db: Session, user: User, leave_id: uuid.UUID):
        doctor = _resolve_doctor(db, user)
        if not doctor:
            return {"success": False, "message": "Doctor profile not found"}, 404

        leave = DoctorLeaveRepository.get_leave_by_id(db, leave_id)
        if not leave or not leave.is_active:
            return {"success": False, "message": "Leave request not found"}, 404

        if leave.doctor_id != doctor.id:
            return {"success": False, "message": "Access denied"}, 403

        # Only pending leaves may be cancelled / deleted by the doctor
        if leave.status != "pending":
            return {
                "success": False,
                "message": "Only pending leave requests can be cancelled",
            }, 400

        DoctorLeaveRepository.delete_leave(db, leave=leave, deleted_by=user.id)

        return {"success": True, "message": "Leave request cancelled successfully"}, 200

    @staticmethod
    def get_leave_by_id(db: Session, user: User, leave_id: uuid.UUID):
        doctor = _resolve_doctor(db, user)
        is_admin = False
        if hasattr(user, "role") and user.role == "admin":
            is_admin = True
        
        leave = DoctorLeaveRepository.get_leave_by_id(db, leave_id)
        if not leave or not leave.is_active:
            return {"success": False, "message": "Leave request not found"}, 404

        if not is_admin and doctor and leave.doctor_id != doctor.id:
            return {"success": False, "message": "Access denied"}, 403

        return {
            "success": True,
            "message": "Leave detail fetched successfully",
            "leave": _leave_to_dict(leave),
        }, 200

    # ── Read: history ─────────────────────────────────────────────────────────

    @staticmethod
    def get_leave_history(
        db: Session,
        user: User,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ):
        doctor = _resolve_doctor(db, user)
        if not doctor:
            return {"success": False, "message": "Doctor profile not found"}, 404

        leaves = DoctorLeaveRepository.get_leave_history(
            db,
            doctor_id=doctor.id,
            status=status,
            limit=limit,
            offset=offset,
        )

        return {
           "success": True,
           "message": "Leave history fetched successfully",
           "leaves": [_leave_to_dict(l) for l in leaves],
           "total": len(leaves),
        }, 200

    # ── Read: pending list ────────────────────────────────────────────────────

    @staticmethod
    def get_pending_leaves(
        db: Session,
        user: User,
        doctor_id: Optional[uuid.UUID] = None,
    ):
        """
        Return pending leave requests.

        When called from a doctor-facing endpoint pass doctor_id=None so the
        service resolves the doctor from the authenticated user.  When called
        from an admin-facing endpoint pass the target doctor_id (or omit it to
        get all doctors' pending leaves).
        """
        # If no explicit doctor_id, scope to the authenticated doctor
        if doctor_id is None:
            doctor = _resolve_doctor(db, user)
            if not doctor:
                return {"success": False, "message": "Doctor profile not found"}, 404
            doctor_id = doctor.id

        leaves = DoctorLeaveRepository.get_pending_leaves(db, doctor_id=doctor_id)

        return {
            "success": True,
            "leaves": [_leave_to_dict(l) for l in leaves],
            "total": len(leaves),
        }, 200

    # ── Status transitions (admin) ────────────────────────────────────────────

    @staticmethod
    def update_leave_status(
        db: Session,
        admin_user: User,
        leave_id: uuid.UUID,
        data: DoctorLeaveStatusUpdate,
    ):
        """Approve or reject a leave request.  Caller must be an admin."""
        leave = DoctorLeaveRepository.get_leave_by_id(db, leave_id)
        if not leave or not leave.is_active:
            return {"success": False, "message": "Leave request not found"}, 404

        # Enforce valid status transition
        allowed_from = _ALLOWED_TRANSITIONS.get(data.status)
        if allowed_from and leave.status not in allowed_from:
            return {
                "success": False,
                "message": (
                    f"Cannot change status from '{leave.status}' to '{data.status}'. "
                    f"Only {sorted(allowed_from)} leave requests can be {data.status}"
                ),
            }, 400

        updated = DoctorLeaveRepository.update_leave_status(
            db,
            leave=leave,
            status=data.status,
            approved_by=admin_user.id,
            admin_reason=data.admin_reason,
        )

        action = "approved" if data.status == "approved" else "rejected"
        return {
            "success": True,
            "message": f"Leave request {action} successfully",
            "leave": _leave_to_dict(updated),
        }, 200
