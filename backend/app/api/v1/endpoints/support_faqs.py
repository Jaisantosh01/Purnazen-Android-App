from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.services.support_faq_service import SupportFaqService
from app.schemas.support_faq import SupportFaqCreate, SupportFaqUpdate, SupportFaqResponse
from typing import List

router = APIRouter()
service = SupportFaqService()

@router.get("", response_model=List[SupportFaqResponse])
def get_all_faqs(db: Session = Depends(get_db)):
    return service.get_all_faqs(db)

@router.post("", response_model=SupportFaqResponse, status_code=status.HTTP_201_CREATED)
def create_faq(faq_in: SupportFaqCreate, db: Session = Depends(get_db)):
    return service.create_faq(db, faq_in)

@router.put("/{faq_id}", response_model=SupportFaqResponse)
def update_faq(faq_id: str, faq_in: SupportFaqUpdate, db: Session = Depends(get_db)):
    faq = service.update_faq(db, faq_id, faq_in)
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    return faq

@router.delete("/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faq(faq_id: str, db: Session = Depends(get_db)):
    success = service.delete_faq(db, faq_id)
    if not success:
        raise HTTPException(status_code=404, detail="FAQ not found")
    return None
