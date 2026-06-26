from typing import Optional

from pydantic import BaseModel


class SupportContactCreate(BaseModel):
    contact_type: str
    title: str
    subtitle: Optional[str] = None
    value: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True


class SupportContactUpdate(BaseModel):
    contact_type: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    value: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class SupportFaqCreate(BaseModel):
    question: str
    answer: str
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True


class SupportFaqUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
