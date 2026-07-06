from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.db.types import GUID
import uuid

from app.db.base_class import Base


class TherapyFeedback(Base):
    __tablename__ = "therapy_feedback"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    video_group_id = Column(GUID(), ForeignKey("video_groups.id"), nullable=False)
    session_type = Column(String(30), nullable=False)
    pain_before = Column(Integer)
    pain_after = Column(Integer)
    user_pain_description = Column(String(500))
    user_feedback = Column(String(1000))
    doctor_feedback = Column(String(1000))
    doctor_feedback_by = Column(GUID(), ForeignKey("users.id"))
    admin_feedback = Column(String(1000))
    admin_feedback_by = Column(GUID(), ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    video_group = relationship("VideoGroups")
    creator = relationship("User", foreign_keys=[created_by])
    modifier = relationship("User", foreign_keys=[updated_by])
    doctor_feedback_user = relationship("User", foreign_keys=[doctor_feedback_by])
    admin_feedback_user = relationship("User", foreign_keys=[admin_feedback_by])

    def to_dict(self):
        return {
            "id": str(self.id),
            "userId": str(self.user_id) if self.user_id else None,
            "videoGroupId": str(self.video_group_id) if self.video_group_id else None,
            "sessionType": self.session_type,
            "painBefore": self.pain_before,
            "painAfter": self.pain_after,
            "userPainDescription": self.user_pain_description,
            "userFeedback": self.user_feedback,
            "doctorFeedback": self.doctor_feedback,
            "doctorFeedbackBy": str(self.doctor_feedback_by) if self.doctor_feedback_by else None,
            "adminFeedback": self.admin_feedback,
            "adminFeedbackBy": str(self.admin_feedback_by) if self.admin_feedback_by else None,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
