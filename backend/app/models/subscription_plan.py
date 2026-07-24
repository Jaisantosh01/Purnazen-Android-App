import uuid
from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, Numeric, String, func

from app.db.types import GUID
from app.db.base_class import Base


class SubscriptionPlan(Base):
    """Catalog of subscription plans shown on the Subscriptions screen."""

    __tablename__ = "subscription_plans"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    code = Column(String(30), nullable=False, unique=True)          # free | premium | pro
    name = Column(String(50), nullable=False)
    price = Column(Numeric(10, 2), nullable=False, default=0)
    currency = Column(String(10), nullable=False, default="INR")
    period = Column(String(20), nullable=False, default="month")    # month | year | forever
    badge = Column(String(40), nullable=True)                       # e.g. "Most Popular"
    accent_color = Column(String(20), nullable=True)                # hex; null → neutral card
    features = Column(JSON, nullable=True)                          # [{"text": str, "included": bool}]
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            "id": str(self.id),
            "code": self.code,
            "name": self.name,
            "price": float(self.price) if self.price is not None else 0.0,
            "currency": self.currency,
            "period": self.period,
            "badge": self.badge,
            "accentColor": self.accent_color,
            "features": self.features or [],
            "sortOrder": self.sort_order,
        }
