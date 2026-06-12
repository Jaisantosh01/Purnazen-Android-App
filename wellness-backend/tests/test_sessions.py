from app.models.relief_session import ReliefSession
from app.models.wellness_session import WellnessSession

STEPS = [
    {"id": 1, "name": "Mountain Pose", "description": "Stand tall.", "duration": 60},
    {"id": 2, "name": "Savasana", "description": "Lie flat and relax.", "duration": 90},
]


def seed_wellness(db, key="YogaSession", title="Morning Yoga", active=True, order=0):
    session = WellnessSession(
        key=key,
        title=title,
        duration_label="20 min",
        icon="🧘",
        video_url=None,
        total_cycles=2,
        steps=STEPS,
        sort_order=order,
        is_active=active,
    )
    db.add(session)
    db.commit()
    return session


def seed_relief(db, key="Headache", title="Headache Relief", active=True, order=0):
    session = ReliefSession(
        key=key,
        title=title,
        duration_label="5 min",
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
    seed_wellness(db_session, key="MeditationSession", title="Meditation", order=2)
    seed_wellness(db_session, key="YogaSession", title="Morning Yoga", order=1)
    seed_wellness(db_session, key="Hidden", title="Hidden", active=False)

    response = client.get("/api/v1/sessions")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 2
    # ordered by sort_order, inactive rows excluded
    assert [s["key"] for s in data["sessions"]] == ["YogaSession", "MeditationSession"]


def test_get_wellness_session_player_shape(client, db_session):
    seed_wellness(db_session)

    response = client.get("/api/v1/sessions/YogaSession")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["title"] == "Morning Yoga"
    assert data["duration"] == "20 min"
    assert data["icon"] == "🧘"
    assert data["videoUrl"] is None
    assert data["totalCycles"] == 2
    assert data["steps"] == STEPS


def test_get_wellness_session_unknown_key(client):
    response = client.get("/api/v1/sessions/Nope")
    assert response.status_code == 404
    assert response.json()["success"] is False


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
