from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from uuid import UUID

from app.api.deps import get_current_user, get_db
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

@router.post("", summary="Create slot timing")
async def create_slot(request: Request, body: SlotTimingsCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = await request.json()
    print("Received payload:", data)
    slot = SlotTimingsService.create(db, body.dict(), user)
    return success_response("Slot created successfully", slot.to_dict())

@router.put("/{slot_id}", summary="Update slot timing")
def update_slot(slot_id: UUID, body: SlotTimingsUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    slot = SlotTimingsService.update(db, slot_id, body.dict(exclude_unset=True), user)
    if not slot:
        return error_response("Slot not found", 404)
    return success_response("Slot updated successfully", slot.to_dict())

@router.delete("/{slot_id}", summary="Soft delete slot timing")
def delete_slot(slot_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    slot = SlotTimingsService.delete(db, slot_id, user)
    if not slot:
        return error_response("Slot not found", 404)
    return success_response("Slot deleted successfully", {})
