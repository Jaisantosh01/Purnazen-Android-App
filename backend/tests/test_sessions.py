from app.models.relief_session import ReliefSession
from app.models.wellness_session import WellnessSession

STEPS = [
    {"id": 1, "name": "Mountain Pose", "description": "Stand tall.", "duration": 60},
    {"id": 2, "name": "Savasana", "description": "Lie flat and relax.", "duration": 90},
]


def seed_wellness(db, title="Morning Yoga", active=True, order=0):
    from app.models.user import User
    admin = db.query(User).filter_by(email="admin@example.com").first()
    if not admin:
        from app.models.role import Role
        admin_role = db.query(Role).filter_by(name="admin").first()
        from app.core.security import hash_password
        admin = User(full_name="Admin", email="admin@example.com", password=hash_password("admin123"), role_id=admin_role.id)
        db.add(admin)
        db.commit()

    session = WellnessSession(
        title=title,
        duration="20 min",
        icon="🧘",
        sort_order=order,
        is_active=active,
        created_by=admin.id,
        updated_by=admin.id,
    )
    db.add(session)
    db.commit()
    return session


def seed_relief(db, key="Headache", title="Headache Relief", active=True, order=0):
    session = ReliefSession(
        key=key,
        title=title,
        duration="5 min",
        icon="🧠",
        video_url="https://example.com/video.mp4",
        total_cycles=3,
        steps=STEPS,
        sort_order=order,
        is_active=active,
    )
    db.add(session)
    db.commit()
    return session


# ── wellness ─────────────────────────────────────────────────────────────────


def test_list_wellness_sessions(client, db_session):
    seed_wellness(db_session, title="Meditation", order=2)
    seed_wellness(db_session, title="Morning Yoga", order=1)
    seed_wellness(db_session, title="Hidden", active=False)

    response = client.get("/api/v1/sessions")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 2
    # ordered by sort_order, inactive rows excluded
    assert [s["title"] for s in data["sessions"]] == ["Morning Yoga", "Meditation"]


# ── relief ───────────────────────────────────────────────────────────────────


def test_list_relief_sessions(client, db_session):
    seed_relief(db_session, key="Headache")
    seed_relief(db_session, key="Back Pain", title="Back Pain Relief", order=1)

    response = client.get("/api/v1/relief-sessions")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 2


def test_get_relief_session_key_with_space(client, db_session):
    seed_relief(db_session, key="Neck Pain", title="Neck Pain Relief")

    response = client.get("/api/v1/relief-sessions/Neck%20Pain")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["title"] == "Neck Pain Relief"
    assert data["totalCycles"] == 3
    assert data["videoUrl"] == "https://example.com/video.mp4"


def test_get_relief_session_unknown_key(client):
    response = client.get("/api/v1/relief-sessions/Nope")
    assert response.status_code == 404
    assert response.json()["success"] is False
