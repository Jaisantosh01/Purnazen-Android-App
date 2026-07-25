from sqlalchemy.orm import Session
from app.models.support_faq import SupportFaq
from app.schemas.support_faq import SupportFaqCreate, SupportFaqUpdate

class SupportFaqRepository:
    def get_all(self, db: Session):
        return db.query(SupportFaq).order_by(SupportFaq.sort_order).all()

    def get_by_id(self, db: Session, faq_id: str):
        return db.query(SupportFaq).filter(SupportFaq.id == faq_id).first()

    def create(self, db: Session, obj_in: SupportFaqCreate):
        db_obj = SupportFaq(**obj_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, faq_id: str, obj_in: SupportFaqUpdate):
        db_obj = self.get_by_id(db, faq_id)
        if not db_obj:
            return None
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, faq_id: str):
        db_obj = self.get_by_id(db, faq_id)
        if not db_obj:
            return False
        db.delete(db_obj)
        db.commit()
        return True
