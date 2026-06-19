import uuid
from typing import Optional

from pydantic import BaseModel


class WellnessSessionCreate(BaseModel):
    title: str
    duration: str
    icon: Optional[str] = None
    video_group_id: Optional[uuid.UUID] = None
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True


class WellnessSessionUpdate(BaseModel):
    title: Optional[str] = None
    duration: Optional[str] = None
    icon: Optional[str] = None
    video_group_id: Optional[uuid.UUID] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
