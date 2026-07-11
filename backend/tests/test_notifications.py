"""Notification center + admin broadcast tests.

Covers: list/clear endpoints, immediate broadcast fan-out with {name}
personalization, scheduled broadcasts (create → dispatch via the scheduler
helper → cancel), and the recent-broadcasts admin listing.
"""
from datetime import datetime, timedelta

from app.models.broadcast import Broadcast
from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User
from app.services.notification_service import NotificationService


def register_and_login(client, email, full_name="Test User", password="secret123"):
    client.post(
        "/api/v1/auth/register",
        json={"full_name": full_name, "email": email, "password": password},
    )
    data = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    ).json()["data"]
    return {"Authorization": f"Bearer {data['access_token']}"}


def make_admin(db_session, email):
    admin_role = db_session.query(Role).filter(Role.name == "admin").first()
    user = db_session.query(User).filter(User.email == email).first()
    user.role_id = admin_role.id
    db_session.commit()


# ── Notification center (user) ────────────────────────────────────────────────


def test_clear_notifications_scopes(client, db_session):
    headers = register_and_login(client, "clear@example.com")
    user = db_session.query(User).filter(User.email == "clear@example.com").first()

    db_session.add_all(
        [
            Notification(user_id=user.id, category="system", event="e", title="read 1", body="b", is_read=True),
            Notification(user_id=user.id, category="system", event="e", title="read 2", body="b", is_read=True),
            Notification(user_id=user.id, category="system", event="e", title="unread", body="b", is_read=False),
        ]
    )
    db_session.commit()

    # scope=read keeps the unread one
    res = client.post("/api/v1/notifications/clear?scope=read", headers=headers)
    assert res.status_code == 200
    assert res.json()["data"]["deleted"] == 2

    listing = client.get("/api/v1/notifications", headers=headers).json()["data"]
    assert listing["total"] == 1
    assert listing["unreadCount"] == 1

    # scope=all removes everything
    res = client.post("/api/v1/notifications/clear?scope=all", headers=headers)
    assert res.json()["data"]["deleted"] == 1
    listing = client.get("/api/v1/notifications", headers=headers).json()["data"]
    assert listing["total"] == 0


# ── Admin broadcast ───────────────────────────────────────────────────────────


def test_broadcast_now_personalizes_and_records(client, db_session):
    admin_headers = register_and_login(client, "admin@example.com", full_name="Ada Admin")
    make_admin(db_session, "admin@example.com")
    register_and_login(client, "priya@example.com", full_name="Priya Sharma")

    res = client.post(
        "/api/v1/notifications/admin/broadcast",
        json={
            "title": "Hi {name}!",
            "body": "Special offer for {name}.",
            "audience": "all",
            "category": "system",
        },
        headers=admin_headers,
    )
    assert res.status_code == 200
    payload = res.json()["data"]
    assert payload["status"] == "sent"
    assert payload["recipients"] == 2  # admin + priya

    n = (
        db_session.query(Notification)
        .join(User, Notification.user_id == User.id)
        .filter(User.email == "priya@example.com")
        .first()
    )
    assert n.title == "Hi Priya!"
    assert n.body == "Special offer for Priya."
    assert n.data["broadcastId"] == payload["id"]

    # Shows up in the recent-broadcasts listing
    listing = client.get("/api/v1/notifications/admin/broadcasts", headers=admin_headers)
    rows = listing.json()["data"]["broadcasts"]
    assert any(b["id"] == payload["id"] and b["status"] == "sent" for b in rows)


def test_scheduled_broadcast_dispatch_and_cancel(client, db_session):
    admin_headers = register_and_login(client, "admin2@example.com")
    make_admin(db_session, "admin2@example.com")

    future = (datetime.now() + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%S")

    def schedule(title):
        res = client.post(
            "/api/v1/notifications/admin/broadcast",
            json={"title": title, "body": "b", "category": "system", "scheduledAt": future},
            headers=admin_headers,
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["status"] == "scheduled"
        assert data["recipients"] == 0
        return data

    to_send = schedule("Scheduled offer")
    to_cancel = schedule("Cancelled offer")

    # No notifications yet
    assert db_session.query(Notification).count() == 0

    # Cancel one via the API
    res = client.delete(
        f"/api/v1/notifications/admin/broadcasts/{to_cancel['id']}", headers=admin_headers
    )
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "cancelled"

    # A sent broadcast can't be cancelled; simulate the scheduler dispatching
    # the due one (send_due_broadcasts uses its own session, so drive the
    # service directly against the test session).
    row = db_session.get(Broadcast, to_send["id"])
    row.scheduled_at = datetime.now() - timedelta(minutes=1)
    db_session.commit()
    count = NotificationService.send_broadcast(db_session, row)
    assert count == 1  # the admin
    assert row.status == "sent"
    assert row.recipients_count == 1

    res = client.delete(
        f"/api/v1/notifications/admin/broadcasts/{to_send['id']}", headers=admin_headers
    )
    assert res.status_code == 400

    # Cancelled broadcast never produced notifications
    titles = [n.title for n in db_session.query(Notification).all()]
    assert "Scheduled offer" in titles
    assert "Cancelled offer" not in titles


def test_broadcast_segment_new_users(client, db_session):
    admin_headers = register_and_login(client, "admin3@example.com")
    make_admin(db_session, "admin3@example.com")
    register_and_login(client, "old@example.com", full_name="Old Timer")

    # Age one account past the new-user window
    old_user = db_session.query(User).filter(User.email == "old@example.com").first()
    old_user.created_at = datetime.now() - timedelta(days=90)
    db_session.commit()

    res = client.post(
        "/api/v1/notifications/admin/broadcast",
        json={
            "title": "Welcome offer",
            "body": "b",
            "audience": "all",
            "segment": "new_users",
            "category": "system",
        },
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert res.json()["data"]["recipients"] == 1  # only the (new) admin

    recipient_ids = {n.user_id for n in db_session.query(Notification).all()}
    assert old_user.id not in recipient_ids
