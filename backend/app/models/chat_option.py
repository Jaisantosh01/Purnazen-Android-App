from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base_class import Base


class ChatOption(Base):
    __tablename__ = "chat_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("chat_questions.id"), nullable=False)
    option_text = Column(String(255), nullable=False)
    next_question_id = Column(UUID(as_uuid=True), ForeignKey("chat_questions.id"), nullable=True)
    video_group_id = Column(UUID(as_uuid=True), ForeignKey("video_groups.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

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
