import uuid
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.types import GUID
from app.db.base_class import Base

class DayOfWeek(Base):
    __tablename__ = "days_of_week"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    day_number = Column(Integer, unique=True, nullable=False)
    day = Column(String(20), unique=True, nullable=False)
    
    slots = relationship("SlotTimings", backref="day_of_week")
