import uuid
from datetime import datetime

from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.doctor_leave import DoctorLeave
from app.models.doctor_leave_slot import DoctorLeaveSlot


class DoctorLeaveRepository:

    # ── Create ───────────────────────────────────────────────────────────────

    @staticmethod
    def create_leave(
        db: Session,
        doctor_id: uuid.UUID,
        created_by: uuid.UUID,
        slot_timing_ids: Optional[List[uuid.UUID]] = None,
        **fields,
    ) -> DoctorLeave:
        """
        Persist a new leave request.

        For custom leave (leave_type == 'custom') pass slot_timing_ids;
        the junction rows in doctor_leave_slots are created here.
        All other fields are passed as keyword arguments matching the
        DoctorLeave model columns directly.
        """
        leave = DoctorLeave(
            doctor_id=doctor_id,
            created_by=created_by,
            **fields,
        )
        db.add(leave)
        db.flush()  # populate leave.id before inserting child rows

        if slot_timing_ids:
            for slot_id in slot_timing_ids:
                db.add(DoctorLeaveSlot(leave_id=leave.id, slot_timing_id=slot_id))

        db.commit()
        db.refresh(leave)
        return leave

    # ── Read ─────────────────────────────────────────────────────────────────

    @staticmethod
    def get_leave_by_id(db: Session, leave_id: uuid.UUID) -> DoctorLeave | None:
        """Return a single leave record (with slots eager-loaded) or None."""
        return (
            db.query(DoctorLeave)
            .options(joinedload(DoctorLeave.slots).joinedload(DoctorLeaveSlot.slot_timing))
            .filter(DoctorLeave.id == leave_id)
            .first()
        )

    @staticmethod
    def get_leave_history(
        db: Session,
        doctor_id: uuid.UUID,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[DoctorLeave]:
        """
        Return a doctor's leave history, newest-first.

        Optionally filter by status (e.g. 'approved', 'rejected').
        Supports simple pagination via limit / offset.
        """
        query = (
            db.query(DoctorLeave)
            .options(joinedload(DoctorLeave.slots).joinedload(DoctorLeaveSlot.slot_timing))
            .filter(
                DoctorLeave.doctor_id == doctor_id,
                DoctorLeave.is_active == True,
            )
        )

        if status is not None:
            query = query.filter(DoctorLeave.status == status)

        return (
            query
            .order_by(DoctorLeave.applied_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_pending_leaves(
        db: Session,
        doctor_id: Optional[uuid.UUID] = None,
    ) -> List[DoctorLeave]:
        """
        Return all pending leave requests.

        Pass doctor_id to scope results to a single doctor (doctor-facing
        endpoint); omit it to return all pending leaves (admin-facing endpoint).
        """
        query = (
            db.query(DoctorLeave)
            .options(joinedload(DoctorLeave.slots).joinedload(DoctorLeaveSlot.slot_timing))
            .filter(
                DoctorLeave.status == "pending",
                DoctorLeave.is_active == True,
            )
        )

        if doctor_id is not None:
            query = query.filter(DoctorLeave.doctor_id == doctor_id)

        return (
            query
            .order_by(DoctorLeave.applied_at.asc())
            .all()
        )

    # ── Update ───────────────────────────────────────────────────────────────

    @staticmethod
    def update_leave(
        db: Session,
        leave: DoctorLeave,
        updated_by: uuid.UUID,
        slot_timing_ids: Optional[List[uuid.UUID]] = None,
        **fields,
    ) -> DoctorLeave:
        """
        Update editable fields on an existing leave record.

        If slot_timing_ids is provided (custom leave only), the existing
        junction rows are replaced with the new set.
        """
        for key, value in fields.items():
            setattr(leave, key, value)

        leave.updated_by = updated_by
        leave.updated_at = datetime.utcnow()

        if slot_timing_ids is not None:
            # Replace existing slot links
            db.query(DoctorLeaveSlot).filter(
                DoctorLeaveSlot.leave_id == leave.id
            ).delete(synchronize_session="fetch")

            for slot_id in slot_timing_ids:
                db.add(DoctorLeaveSlot(leave_id=leave.id, slot_timing_id=slot_id))

        db.commit()
        db.refresh(leave)
        return leave

    @staticmethod
    def update_leave_status(
        db: Session,
        leave: DoctorLeave,
        status: str,
        approved_by: uuid.UUID,
        admin_reason: Optional[str] = None,
    ) -> DoctorLeave:
        """
        Approve or reject a leave request.

        Sets status, approved_by, approved_at, and optionally admin_reason.
        """
        leave.status = status
        leave.approved_by = approved_by
        leave.approved_at = datetime.utcnow()

        if admin_reason is not None:
            leave.admin_reason = admin_reason

        db.commit()
        db.refresh(leave)
        return leave

    # ── Delete (soft) ────────────────────────────────────────────────────────

    @staticmethod
    def delete_leave(
        db: Session,
        leave: DoctorLeave,
        deleted_by: uuid.UUID,
    ) -> DoctorLeave:
        """
        Cancel a leave request by setting status = 'cancelled'.
        """
        leave.status = 'cancelled'
        leave.updated_by = deleted_by
        leave.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(leave)
        return leave
