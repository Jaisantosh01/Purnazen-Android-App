from sqlalchemy.orm import Session
from datetime import datetime
from app.models.slot_timings import SlotTimings
from app.models.user import User

class SlotTimingsService:
    @staticmethod
    def get_all(db: Session):
        return db.query(SlotTimings).filter(SlotTimings.is_active == True).all()

    @staticmethod
    def get_by_day(db: Session):
        from app.models.day_of_week import DayOfWeek
        return db.query(DayOfWeek).order_by(DayOfWeek.day_number).all()

    @staticmethod
    def create(db: Session, data: dict, user: User):
        slot = SlotTimings(
            **data,
            created_by=user.id,
            updated_by=user.id
        )
        db.add(slot)
        db.commit()
        db.refresh(slot)
        return slot

    @staticmethod
    def update(db: Session, slot_id: str, data: dict, user: User):
        slot = db.get(SlotTimings, slot_id)
        if not slot:
            return None
        
        for key, value in data.items():
            if value is not None:
                setattr(slot, key, value)
        
        slot.updated_at = datetime.utcnow()
        slot.updated_by = user.id
        db.commit()
        db.refresh(slot)
        return slot

    @staticmethod
    def delete(db: Session, slot_id: str, user: User):
        slot = db.get(SlotTimings, slot_id)
        if not slot:
            return None
        
        slot.is_active = False
        slot.updated_at = datetime.utcnow()
        slot.updated_by = user.id
        db.commit()
        return slot
