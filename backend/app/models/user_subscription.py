import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, func
from sqlalchemy.orm import relationship

from app.db.types import GUID
from app.db.base_class import Base


class UserSubscription(Base):
    """A user's current subscription (one row per user, updated in place)."""

    __tablename__ = "user_subscriptions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    plan_id = Column(GUID(), ForeignKey("subscription_plans.id"), nullable=False)
    status = Column(String(20), nullable=False, default="active")   # active | cancelled | expired
    started_at = Column(DateTime, server_default=func.now())
    current_period_end = Column(DateTime, nullable=True)            # null for free/forever plans
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id], backref="subscriptions")
    plan = relationship("SubscriptionPlan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "planCode": self.plan.code if self.plan else None,
            "planName": self.plan.name if self.plan else None,
            "status": self.status,
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "currentPeriodEnd": self.current_period_end.isoformat() if self.current_period_end else None,
            "cancelAtPeriodEnd": self.cancel_at_period_end,
            "plan": self.plan.to_dict() if self.plan else None,
        }
