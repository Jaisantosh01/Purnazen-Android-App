from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class TherapySession(Base):
    __tablename__ = "therapy_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False)
    session_type = Column(String(30), nullable=False)  # wellness | relief | yoga | ...
    duration_minutes = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="Completed")
    pain_before = Column(Integer)
    pain_after = Column(Integer)
    completed_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", backref="therapy_sessions")

    __table_args__ = (
        Index("ix_therapy_sessions_user_completed", "user_id", "completed_at"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "type": self.session_type,
            # Display shape consumed by TherapyHistoryScreen (matches the old mock)
            "date": f"{self.completed_at.strftime('%B')} {self.completed_at.day}, {self.completed_at.year}",
            "duration": f"{self.duration_minutes} min",
            "status": self.status,
            "painBefore": self.pain_before,
            "painAfter": self.pain_after,
        }
