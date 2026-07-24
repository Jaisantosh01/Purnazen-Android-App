from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.services.subscription_service import SubscriptionService
from app.utils.responses import success_response

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


class SubscribeRequest(BaseModel):
    plan_code: str


@router.get(
    "/plans",
    summary="List subscription plans",
    description="Returns the active subscription plans (catalog), ordered for display.",
)
def list_plans(db: Session = Depends(get_db)):
    plans = SubscriptionService.get_plans(db)
    return success_response("Plans fetched successfully", {"plans": plans})


@router.get(
    "/me",
    summary="Get current subscription",
    description="Returns the authenticated user's subscription, defaulting to the Free plan.",
)
def my_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = SubscriptionService.get_current(db, user.id)
    return success_response("Subscription fetched successfully", {"subscription": sub})


@router.post(
    "/subscribe",
    summary="Subscribe to / change plan",
    description="Sets the user's subscription to `plan_code` (one of the catalog plan codes).",
)
def subscribe(
    body: SubscribeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = SubscriptionService.subscribe(db, user.id, body.plan_code)
    return success_response("Subscription updated successfully", {"subscription": sub})
