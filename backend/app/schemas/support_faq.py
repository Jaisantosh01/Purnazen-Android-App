from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID

class SupportFaqCreate(BaseModel):
    question: str
    answer: str
    sort_order: Optional[int] = 0

class SupportFaqUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

class SupportFaqResponse(BaseModel):
    id: UUID
    question: str
    answer: str
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True
