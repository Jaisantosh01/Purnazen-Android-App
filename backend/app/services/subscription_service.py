from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.subscription_repository import SubscriptionRepository


class SubscriptionService:

    @staticmethod
    def get_plans(db: Session) -> list[dict]:
        return [p.to_dict() for p in SubscriptionRepository.get_active_plans(db)]

    @staticmethod
    def get_current(db: Session, user_id) -> dict:
        """The user's subscription, defaulting to the Free plan when unset."""
        sub = SubscriptionRepository.get_user_subscription(db, user_id)
        if sub:
            return sub.to_dict()
        free = SubscriptionRepository.get_plan_by_code(db, "free")
        return {
            "planCode": free.code if free else "free",
            "planName": free.name if free else "Free",
            "status": "active",
            "startedAt": None,
            "currentPeriodEnd": None,
            "cancelAtPeriodEnd": False,
            "plan": free.to_dict() if free else None,
        }

    @staticmethod
    def subscribe(db: Session, user_id, plan_code: str) -> dict:
        plan = SubscriptionRepository.get_plan_by_code(db, plan_code)
        if not plan or not plan.is_active:
            raise HTTPException(status_code=404, detail=f"Unknown plan '{plan_code}'")

        # Fail closed on anything priced. This endpoint has no payment step, no
        # purchase token, no receipt and no signature check — it simply sets the
        # user's plan to whatever they ask for. While every plan is free that is
        # merely harmless; the moment one carries a price it is both an unbilled
        # digital purchase (a Play Payments policy violation) and a hole anyone
        # with a session can walk through.
        #
        # So the invariant lives here rather than in a comment: granting a
        # priced plan requires a verified purchase, and until that code exists
        # the only correct answer is 402. Deliberately not conditioned on an
        # env var or a feature flag — a flag is something you can forget to set.
        if plan.price is not None and float(plan.price) > 0:
            raise HTTPException(
                status_code=402,
                detail=(
                    f"Plan '{plan_code}' is priced and cannot be granted without a "
                    "verified purchase. Paid plans are not available yet."
                ),
            )
        # Paid recurring plans get a rolling period; free/forever plans never expire.
        period_end = None
        if plan.code != "free" and plan.period in ("month", "year"):
            days = 365 if plan.period == "year" else 30
            period_end = datetime.now(timezone.utc) + timedelta(days=days)
        sub = SubscriptionRepository.set_user_plan(db, user_id, plan, period_end)
        return sub.to_dict()
