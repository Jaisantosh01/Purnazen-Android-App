import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from app.db.types import GUID

from app.db.base_class import Base


class SupportFaq(Base):
    """Admin-configurable Help & Support FAQ entry."""

    __tablename__ = "support_faqs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    question = Column(String(255), nullable=False)
    answer = Column(Text, nullable=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "question": self.question,
            "answer": self.answer,
            "sortOrder": self.sort_order,
        }
