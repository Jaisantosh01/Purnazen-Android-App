from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.subscription_plan import SubscriptionPlan
from app.models.user_subscription import UserSubscription


class SubscriptionRepository:

    @staticmethod
    def get_active_plans(db: Session) -> list[SubscriptionPlan]:
        return (
            db.query(SubscriptionPlan)
            .filter(SubscriptionPlan.is_active.is_(True))
            .order_by(SubscriptionPlan.sort_order.asc())
            .all()
        )

    @staticmethod
    def get_plan_by_code(db: Session, code: str) -> SubscriptionPlan | None:
        return db.query(SubscriptionPlan).filter(SubscriptionPlan.code == code).first()

    @staticmethod
    def get_user_subscription(db: Session, user_id) -> UserSubscription | None:
        return (
            db.query(UserSubscription)
            .filter(UserSubscription.user_id == user_id)
            .order_by(UserSubscription.created_at.desc())
            .first()
        )

    @staticmethod
    def set_user_plan(db: Session, user_id, plan: SubscriptionPlan, period_end=None) -> UserSubscription:
        """Upsert the user's single subscription row onto ``plan``."""
        now = datetime.now(timezone.utc)
        sub = SubscriptionRepository.get_user_subscription(db, user_id)
        if sub:
            sub.plan_id = plan.id
            sub.status = "active"
            sub.started_at = now
            sub.current_period_end = period_end
            sub.cancel_at_period_end = False
            sub.updated_at = now
        else:
            sub = UserSubscription(
                user_id=user_id,
                plan_id=plan.id,
                status="active",
                started_at=now,
                current_period_end=period_end,
            )
            db.add(sub)
        db.commit()
        db.refresh(sub)
        return sub
