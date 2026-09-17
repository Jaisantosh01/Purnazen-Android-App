from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.api.deps import get_db, require_role
from app.models.user import User
from app.schemas.slot_timings import SlotTimingsCreate, SlotTimingsUpdate
from app.services.slot_timings_service import SlotTimingsService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/slot-timings", tags=["Slot Timings"])

@router.get("", summary="Get all slot timings grouped by day")
def get_slots(db: Session = Depends(get_db)):
    days = SlotTimingsService.get_by_day(db)
    result = []
    for day in days:
        result.append({
            "id": str(day.id),
            "day": day.day,
            "day_number": day.day_number,
            "slots": [slot.to_dict() for slot in day.slots if slot.is_active]
        })
    return success_response("Slots fetched successfully", result)

@router.post("", summary="Create slot timing (admin)")
def create_slot(
    body: SlotTimingsCreate,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    slot = SlotTimingsService.create(db, body.model_dump(), user)
    return success_response("Slot created successfully", slot.to_dict())

@router.put("/{slot_id}", summary="Update slot timing (admin)")
def update_slot(
    slot_id: UUID,
    body: SlotTimingsUpdate,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    slot = SlotTimingsService.update(db, slot_id, body.model_dump(exclude_unset=True), user)
    if not slot:
        return error_response("Slot not found", 404)
    return success_response("Slot updated successfully", slot.to_dict())

@router.delete("/{slot_id}", summary="Soft delete slot timing (admin)")
def delete_slot(
    slot_id: UUID,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    slot = SlotTimingsService.delete(db, slot_id, user)
    if not slot:
        return error_response("Slot not found", 404)
    return success_response("Slot deleted successfully", {})
