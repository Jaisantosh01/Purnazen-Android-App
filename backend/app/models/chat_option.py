from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.db.types import GUID
import uuid

from app.db.base_class import Base


class ChatOption(Base):
    __tablename__ = "chat_options"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    question_id = Column(GUID(), ForeignKey("chat_questions.id"), nullable=False)
    option_text = Column(String(255), nullable=False)
    next_question_id = Column(GUID(), ForeignKey("chat_questions.id"), nullable=True)
    video_group_id = Column(GUID(), ForeignKey("video_groups.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    question = relationship("ChatQuestion", back_populates="options", foreign_keys=[question_id])
    next_question = relationship("ChatQuestion", foreign_keys=[next_question_id])
    video_group = relationship("VideoGroups")

    def to_dict(self):
        return {
            "id": self.id,
            "questionId": self.question_id,
            "optionText": self.option_text,
            "nextQuestionId": self.next_question_id,
            "videoGroupId": self.video_group_id,
        }
