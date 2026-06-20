import uuid
from typing import Optional

from pydantic import BaseModel


class QuickReliefCreate(BaseModel):
    name: str
    slug: str
    title: str
    subtitle: Optional[str] = None
    chat_question_id: Optional[uuid.UUID] = None
    icon_name: Optional[str] = None
    icon_url: Optional[str] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True


class QuickReliefUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    chat_question_id: Optional[uuid.UUID] = None
    icon_name: Optional[str] = None
    icon_url: Optional[str] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
