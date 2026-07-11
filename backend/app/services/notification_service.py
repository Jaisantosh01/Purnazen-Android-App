"""Central notification pipeline.

Every notification flows through ``NotificationService.notify``:

    global admin switch (notification_settings)
      → user preference (user_preferences.push_enabled + notifications JSON)
        → in-app row (notifications table)
        → device push (FCM, all registered tokens of the recipient)

Delivery rules:
  * Transactional categories (appointment / payment / reminder / system) always
    create the in-app row; user preferences only mute the device push.
  * Promotional ("promo") notifications are ON by default (opt-out): a user who
    explicitly disabled the offers toggle gets neither a row nor a push.
  * A disabled global admin switch drops the notification entirely.

All hooks call this best-effort: a notification failure must never break the
business action that triggered it, so callers wrap with try/except (see
``notify_safely``).
"""

import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.device_token import DeviceToken
from app.models.notification import Notification
from app.models.notification_setting import NotificationSetting
from app.models.user import User
from app.models.user_preference import UserPreference
from app.services import fcm_service

logger = logging.getLogger(__name__)

# category → global admin switch attribute
_GLOBAL_SWITCH = {
    "appointment": "appointments_enabled",
    "payment": "payments_enabled",
    "promo": "promos_enabled",
    "reminder": "reminders_enabled",
    # "system" has no switch — always on
}

# category → user preference toggle key (mobile NotificationsScreen ids)
_PREF_KEY = {
    "appointment": "appointment",
    "payment": "payment",
    "promo": "offers",
    "reminder": "appointment",
    # "system" ignores user toggles
}

# category → Android notification channel id (created in each app's
# MainApplication.kt; ids must stay in sync or Android drops the push)
_CHANNEL = {
    "appointment": "appointments",
    "payment": "payments",
    "promo": "offers",
    "reminder": "reminders",
    "system": "general",
}


class NotificationService:

    # ── settings ────────────────────────────────────────────────────────────

    @staticmethod
    def get_settings(db: Session) -> NotificationSetting:
        row = db.get(NotificationSetting, 1)
        if row is None:
            row = NotificationSetting(id=1)
            db.add(row)
            db.commit()
            db.refresh(row)
        return row

    # ── preference resolution ────────────────────────────────────────────────

    @staticmethod
    def _user_allows_push(db: Session, user_id, category: str) -> bool:
        pref = db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
        if pref is None:
            # No prefs row yet: everything defaults ON (offers included —
            # allowing notifications means all categories; each is opt-out).
            return True
        if not pref.push_enabled:
            return False
        key = _PREF_KEY.get(category)
        if key is None:  # system
            return True
        toggles = pref.notifications or {}
        return bool(toggles.get(key, True))  # every category defaults ON

    # ── core ────────────────────────────────────────────────────────────────

    @staticmethod
    def notify(
        db: Session,
        user_id,
        category: str,
        event: str,
        title: str,
        body: str,
        data: Optional[dict] = None,
    ) -> Optional[Notification]:
        """Create an in-app notification (+ push) for one recipient.

        Commits its own transaction; call AFTER the triggering business action
        has committed.
        """
        settings_row = NotificationService.get_settings(db)
        switch = _GLOBAL_SWITCH.get(category)
        if switch and not getattr(settings_row, switch):
            return None

        allows_push = NotificationService._user_allows_push(db, user_id, category)
        if category == "promo" and not allows_push:
            return None  # full opt-out for promotional content

        notification = Notification(
            user_id=user_id,
            category=category,
            event=event,
            title=title,
            body=body,
            data=data or {},
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        if allows_push:
            NotificationService._push_to_user(
                db,
                user_id,
                title,
                body,
                {
                    "category": category,
                    "event": event,
                    **{k: str(v) for k, v in (data or {}).items()},
                },
                channel_id=_CHANNEL.get(category, "general"),
            )

        return notification

    @staticmethod
    def notify_safely(db: Session, *args, **kwargs) -> None:
        """notify() variant that never raises — for business-logic hooks."""
        try:
            NotificationService.notify(db, *args, **kwargs)
        except Exception as exc:
            logger.warning("Notification dispatch failed: %s", exc)
            try:
                db.rollback()
            except Exception:
                pass

    @staticmethod
    def _push_to_user(
        db, user_id, title: str, body: str, data: dict, channel_id: str = "general"
    ) -> None:
        if not fcm_service.is_enabled():
            return
        tokens = db.query(DeviceToken).filter(DeviceToken.user_id == user_id).all()
        dead = []
        for t in tokens:
            if not fcm_service.send_to_token(t.token, title, body, data, channel_id):
                dead.append(t)
        for t in dead:
            db.delete(t)
        if dead:
            db.commit()

    # ── device tokens ───────────────────────────────────────────────────────

    @staticmethod
    def register_token(db: Session, user: User, token: str, platform: str, app: str) -> None:
        existing = db.query(DeviceToken).filter(DeviceToken.token == token).first()
        if existing:
            existing.user_id = user.id
            existing.platform = platform
            existing.app = app
        else:
            db.add(DeviceToken(user_id=user.id, token=token, platform=platform, app=app))
        db.commit()

    @staticmethod
    def remove_token(db: Session, token: str) -> None:
        db.query(DeviceToken).filter(DeviceToken.token == token).delete()
        db.commit()

    # ── broadcast (admin) ───────────────────────────────────────────────────

    #: days since signup for the "new_users" segment
    NEW_USER_DAYS = 30
    #: days without an appointment for the "inactive_users" segment
    INACTIVE_DAYS = 60

    @staticmethod
    def _resolve_audience(db: Session, audience: str, segment: str = "everyone"):
        """Return [(user_id, full_name), ...] for an audience + segment.

        Segments (personalized-offer targeting):
          * everyone       — no extra filtering
          * new_users      — signed up within NEW_USER_DAYS
          * inactive_users — no appointment in the last INACTIVE_DAYS
        """
        from datetime import date, datetime, timedelta

        from app.models.appointment import Appointment
        from app.models.doctor import Doctor

        query = db.query(User.id, User.full_name).filter(User.is_active == True)  # noqa: E712
        doctor_user_ids = {row[0] for row in db.query(Doctor.user_id).all()}
        if audience == "doctors":
            query = query.filter(User.id.in_(doctor_user_ids))
        elif audience == "users":
            if doctor_user_ids:
                query = query.filter(~User.id.in_(doctor_user_ids))

        if segment == "new_users":
            cutoff = datetime.now() - timedelta(days=NotificationService.NEW_USER_DAYS)
            query = query.filter(User.created_at >= cutoff)
        elif segment == "inactive_users":
            cutoff = date.today() - timedelta(days=NotificationService.INACTIVE_DAYS)
            recent_ids = {
                row[0]
                for row in db.query(Appointment.user_id)
                .filter(Appointment.date >= cutoff)
                .distinct()
                .all()
            }
            if recent_ids:
                query = query.filter(~User.id.in_(recent_ids))

        return query.all()

    @staticmethod
    def _personalize(text: str, full_name: Optional[str]) -> str:
        """Replace the {name} placeholder with the recipient's first name."""
        first = (full_name or "").strip().split(" ")[0] or "there"
        return text.replace("{name}", first)

    @staticmethod
    def send_broadcast(db: Session, broadcast) -> int:
        """Fan a Broadcast row out to its audience and mark it sent.

        Personalizes {name} per recipient. Returns the number of recipients
        that actually received it (after preference filtering).
        """
        from datetime import datetime

        recipients = NotificationService._resolve_audience(
            db, broadcast.audience, broadcast.segment or "everyone"
        )
        count = 0
        for uid, full_name in recipients:
            n = NotificationService.notify(
                db,
                uid,
                broadcast.category,
                "admin_broadcast",
                NotificationService._personalize(broadcast.title, full_name),
                NotificationService._personalize(broadcast.body, full_name),
                {"broadcastId": str(broadcast.id)},
            )
            if n:
                count += 1

        broadcast.status = "sent"
        broadcast.sent_at = datetime.now()
        broadcast.recipients_count = count
        db.commit()
        return count
