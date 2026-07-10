from sqlalchemy.orm import Session
from app.repositories.support_faq_repository import SupportFaqRepository
from app.schemas.support_faq import SupportFaqCreate, SupportFaqUpdate

class SupportFaqService:
    def __init__(self):
        self.repository = SupportFaqRepository()

    def get_all_faqs(self, db: Session):
        return self.repository.get_all(db)

    def get_faq(self, db: Session, faq_id: str):
        return self.repository.get_by_id(db, faq_id)

    def create_faq(self, db: Session, obj_in: SupportFaqCreate):
        return self.repository.create(db, obj_in)

    def update_faq(self, db: Session, faq_id: str, obj_in: SupportFaqUpdate):
        return self.repository.update(db, faq_id, obj_in)

    def delete_faq(self, db: Session, faq_id: str):
        return self.repository.delete(db, faq_id)
