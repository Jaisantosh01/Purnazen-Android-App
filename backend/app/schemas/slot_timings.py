from pydantic import BaseModel
from uuid import UUID
from datetime import time
from typing import Optional

class SlotTimingsCreate(BaseModel):
    day_of_week_id: UUID
    start_time: time
    end_time: time

class SlotTimingsUpdate(BaseModel):
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_active: Optional[bool] = None
