import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.models.broadcast import Broadcast
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    BroadcastRequest,
    NotificationSettingsUpdate,
    RegisterDeviceTokenRequest,
    RemoveDeviceTokenRequest,
)
from app.services.notification_service import NotificationService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ─────────────────────────────────────────────────────────────────────────────
# Static paths MUST be declared before "/{notification_id}" (FastAPI matches
# routes in declaration order — see doctor_leaves.py for the war story).
# ─────────────────────────────────────────────────────────────────────────────


@router.get(
    "",
    summary="List my notifications",
    description="Newest first, with the recipient's unread count.",
)
def list_notifications(
    unread_only: bool = Query(False, alias="unreadOnly"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712
    total = query.count()
    unread = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read == False)  # noqa: E712
        .count()
    )
    rows = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    return success_response(
        "Notifications fetched",
        {
            "notifications": [n.to_dict() for n in rows],
            "total": total,
            "unreadCount": unread,
        },
    )


@router.post("/read-all", summary="Mark all my notifications as read")
def mark_all_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read == False)  # noqa: E712
        .update({Notification.is_read: True}, synchronize_session=False)
    )
    db.commit()
    return success_response("All notifications marked read", {"updated": updated})


@router.post(
    "/clear",
    summary="Bulk-delete my notifications",
    description="scope=read deletes only already-read notifications; scope=all deletes everything.",
)
def clear_notifications(
    scope: str = Query("read", pattern="^(read|all)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Notification).filter(Notification.user_id == user.id)
    if scope == "read":
        query = query.filter(Notification.is_read == True)  # noqa: E712
    deleted = query.delete(synchronize_session=False)
    db.commit()
    return success_response(f"{deleted} notification(s) cleared", {"deleted": deleted})


@router.post(
    "/device-tokens",
    summary="Register this device for push notifications",
    description="Upserts the FCM registration token for the logged-in user.",
)
def register_device_token(
    body: RegisterDeviceTokenRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    NotificationService.register_token(db, user, body.token, body.platform, body.app)
    return success_response("Device registered for push notifications")


@router.post(
    "/device-tokens/remove",
    summary="Unregister a device token (logout)",
)
def remove_device_token(
    body: RemoveDeviceTokenRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    NotificationService.remove_token(db, body.token)
    return success_response("Device token removed")


# ── Admin control ────────────────────────────────────────────────────────────


@router.get("/admin/settings", summary="Global notification switches (admin)")
def get_admin_settings(
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    row = NotificationService.get_settings(db)
    return success_response("Notification settings fetched", row.to_dict())


@router.put("/admin/settings", summary="Update global notification switches (admin)")
def update_admin_settings(
    body: NotificationSettingsUpdate,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    row = NotificationService.get_settings(db)
    for field in (
        "appointments_enabled",
        "payments_enabled",
        "promos_enabled",
        "reminders_enabled",
        "reminder_lead_minutes",
    ):
        value = getattr(body, field)
        if value is not None:
            setattr(row, field, value)
    row.updated_by = user.id
    db.commit()
    db.refresh(row)
    return success_response("Notification settings updated", row.to_dict())


@router.post(
    "/admin/broadcast",
    summary="Send or schedule a broadcast notification (admin)",
    description=(
        "Sends to every active user in the audience (all | users | doctors), "
        "optionally narrowed by segment (everyone | new_users | inactive_users). "
        "`{name}` in the title/body is replaced with each recipient's first "
        "name. With a future `scheduledAt`, the broadcast is stored and "
        "dispatched by the scheduler instead of immediately. Promotional "
        "broadcasts respect each user's offers opt-out; system broadcasts "
        "ignore user toggles."
    ),
)
def broadcast(
    body: BroadcastRequest,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    scheduled_at = body.scheduled_at
    if scheduled_at is not None and scheduled_at.tzinfo is not None:
        # Scheduler compares against naive server-local time.
        scheduled_at = scheduled_at.astimezone().replace(tzinfo=None)

    row = Broadcast(
        title=body.title,
        body=body.body,
        audience=body.audience,
        segment=body.segment,
        category=body.category,
        created_by=user.id,
    )

    if scheduled_at is not None and scheduled_at > datetime.now():
        row.status = "scheduled"
        row.scheduled_at = scheduled_at
        db.add(row)
        db.commit()
        db.refresh(row)
        return success_response(
            f"Broadcast scheduled for {scheduled_at.strftime('%d %b %Y, %I:%M %p')}",
            row.to_dict(),
        )

    db.add(row)
    db.commit()
    db.refresh(row)
    count = NotificationService.send_broadcast(db, row)
    return success_response(
        f"Broadcast delivered to {count} recipient(s)", row.to_dict()
    )


@router.get(
    "/admin/broadcasts",
    summary="Recent broadcasts (admin)",
    description="Newest first — sent, scheduled and cancelled broadcasts.",
)
def list_broadcasts(
    limit: int = Query(30, ge=1, le=100),
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Broadcast)
        .order_by(Broadcast.created_at.desc())
        .limit(limit)
        .all()
    )
    return success_response(
        "Broadcasts fetched", {"broadcasts": [b.to_dict() for b in rows]}
    )


@router.delete(
    "/admin/broadcasts/{broadcast_id}",
    summary="Cancel a scheduled broadcast (admin)",
)
def cancel_broadcast(
    broadcast_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    row = db.get(Broadcast, broadcast_id)
    if not row:
        return error_response("Broadcast not found", 404)
    if row.status != "scheduled":
        return error_response("Only scheduled broadcasts can be cancelled", 400)
    row.status = "cancelled"
    db.commit()
    return success_response("Broadcast cancelled", row.to_dict())


# ── Parameterized routes LAST ────────────────────────────────────────────────


@router.patch("/{notification_id}/read", summary="Mark one notification as read")
def mark_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        return error_response("Notification not found", 404)
    n.is_read = True
    db.commit()
    return success_response("Notification marked read", n.to_dict())


@router.delete("/{notification_id}", summary="Delete one of my notifications")
def delete_notification(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        return error_response("Notification not found", 404)
    db.delete(n)
    db.commit()
    return success_response("Notification deleted")
