import uuid
from datetime import datetime

from app.core.security import hash_password
from app.models.therapy_session import TherapySession
from app.models.user import User
from app.models.video_group_mapping import VideoGroupMapping
from app.models.video_groups import VideoGroups
from app.models.videos import Videos

REGISTER_PAYLOAD = {
    "full_name": "Test Patient",
    "email": "patient@example.com",
    "password": "secret123",
}


def auth_headers(client, email="patient@example.com"):
    client.post("/api/v1/auth/register", json={**REGISTER_PAYLOAD, "email": email})
    tokens = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "secret123"}
    ).json()["data"]
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def seed_group_with_videos(db, video_count=1):
    """Create a video group with N videos (and their group mappings).

    The merged model links therapy sessions to a group_id + video_id, so the
    tests need real catalog rows to reference.
    """
    owner = User(
        full_name="Content Owner",
        email=f"owner-{uuid.uuid4().hex[:8]}@example.com",
        password=hash_password("secret123"),
    )
    db.add(owner)
    db.flush()

    group = VideoGroups(
        title="Wellness & Prevention",
        description="Long-term wellness routines.",
        created_by=owner.id,
        updated_by=owner.id,
    )
    db.add(group)
    db.flush()

    videos = []
    for index in range(video_count):
        video = Videos(
            title=f"Video {index}",
            description="A routine.",
            duration=10,
            created_by=owner.id,
            updated_by=owner.id,
        )
        db.add(video)
        db.flush()
        db.add(
            VideoGroupMapping(
                video_group_id=group.id,
                video_id=video.id,
                created_by=owner.id,
                updated_by=owner.id,
            )
        )
        videos.append(video)

    db.commit()
    return group, videos


def save_payload(group, video, **overrides):
    # Mirrors what YogaSessionScreen/ReliefSessionScreen send on completion.
    payload = {
        "groupId": str(group.id),
        "videoId": str(video.id),
        "type": "wellness",
        "durationMinutes": 15,
        "status": "Completed",
        "painBefore": 8,
        "painAfter": 3,
    }
    payload.update(overrides)
    return payload


def test_save_session_success(client, db_session):
    group, videos = seed_group_with_videos(db_session)
    headers = auth_headers(client)

    response = client.post(
        "/api/v1/therapy-history/save",
        json=save_payload(group, videos[0]),
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True

    data = body["data"]
    assert data["type"] == "wellness"
    assert data["duration"] == "15 min"
    assert data["status"] == "Completed"
    # Pain scores moved to the therapy_feedback table (migration 1dd9c36eec4d);
    # sessions no longer carry them.
    assert "painBefore" not in data
    assert data["groupTitle"] == "Wellness & Prevention"
    assert data["videoTitle"] == "Video 0"


def test_save_session_requires_auth(client):
    response = client.post(
        "/api/v1/therapy-history/save",
        json={
            "groupId": str(uuid.uuid4()),
            "videoId": str(uuid.uuid4()),
            "type": "wellness",
            "durationMinutes": 15,
        },
    )
    assert response.status_code == 401
    assert response.json()["success"] is False


def test_save_session_rejects_unknown_type(client, db_session):
    group, videos = seed_group_with_videos(db_session)
    headers = auth_headers(client)
    response = client.post(
        "/api/v1/therapy-history/save",
        json=save_payload(group, videos[0], type="juggling"),
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["success"] is False


def test_history_lists_saved_sessions_newest_first(client, db_session):
    group, videos = seed_group_with_videos(db_session, video_count=2)
    headers = auth_headers(client)
    client.post(
        "/api/v1/therapy-history/save",
        json=save_payload(group, videos[0]),
        headers=headers,
    )
    client.post(
        "/api/v1/therapy-history/save",
        json=save_payload(group, videos[1]),
        headers=headers,
    )

    # Pin updated_at so the "newest first" ordering is deterministic (server
    # timestamps can collide within the same second).
    s0 = db_session.query(TherapySession).filter_by(video_id=videos[0].id).first()
    s1 = db_session.query(TherapySession).filter_by(video_id=videos[1].id).first()
    s0.updated_at = datetime(2026, 6, 1, 10, 0, 0)
    s1.updated_at = datetime(2026, 6, 10, 10, 0, 0)
    db_session.commit()

    response = client.get("/api/v1/therapy-history", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 2
    assert [s["videoTitle"] for s in data["sessions"]] == ["Video 1", "Video 0"]


def test_history_stats(client, db_session):
    group, videos = seed_group_with_videos(db_session, video_count=2)
    headers = auth_headers(client)
    client.post(
        "/api/v1/therapy-history/save",
        json=save_payload(group, videos[0], durationMinutes=15, painBefore=8, painAfter=3),
        headers=headers,
    )
    client.post(
        "/api/v1/therapy-history/save",
        json=save_payload(group, videos[1], durationMinutes=20, painBefore=7, painAfter=2),
        headers=headers,
    )

    stats = client.get("/api/v1/therapy-history", headers=headers).json()["data"]["stats"]
    assert stats["sessions"] == 2
    assert stats["minutes"] == 35
    # avgRelief left with the pain columns (now derived from therapy_feedback)


def test_history_pagination(client, db_session):
    group, videos = seed_group_with_videos(db_session, video_count=3)
    headers = auth_headers(client)
    for video in videos:
        client.post(
            "/api/v1/therapy-history/save",
            json=save_payload(group, video),
            headers=headers,
        )

    response = client.get(
        "/api/v1/therapy-history", params={"page": 2, "limit": 2}, headers=headers
    )
    data = response.json()["data"]
    assert data["total"] == 3
    assert len(data["sessions"]) == 1
    assert data["page"] == 2


def test_history_requires_auth(client):
    response = client.get("/api/v1/therapy-history")
    assert response.status_code == 401


def test_complete_session_records_feedback(client, db_session):
    """Marking a run complete stores the score and remark.

    The endpoint used to read `body.painAfter`/`body.userFeedback` — alias names,
    not field names — which raised AttributeError on every call, and the
    repository then only *updated* a feedback row, so a run that never captured a
    baseline dropped both values.
    """
    group, videos = seed_group_with_videos(db_session)
    headers = auth_headers(client)

    started = client.post(
        "/api/v1/therapy-history/start-session",
        json={"groupId": str(group.id), "sessionType": "relief"},
        headers=headers,
    )
    assert started.status_code == 201
    session_group_id = started.json()["data"]["id"]
    assert started.json()["data"]["sessionType"] == "relief"

    response = client.post(
        f"/api/v1/therapy-history/sessions/{session_group_id}/complete",
        json={"painAfter": 2, "userFeedback": "much better"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "completed"

    feedback = client.get(
        f"/api/v1/therapy-feedback/by-session/{session_group_id}", headers=headers
    ).json()["data"]
    assert feedback["painAfter"] == 2
    assert feedback["userFeedback"] == "much better"
    assert feedback["sessionType"] == "relief"


def test_completed_count_is_scoped_to_a_session_group(client, db_session):
    """A repeat run counts from zero instead of inheriting the earlier sitting."""
    group, videos = seed_group_with_videos(db_session)
    headers = auth_headers(client)

    first = client.post(
        "/api/v1/therapy-history/start-session",
        json={"groupId": str(group.id), "sessionType": "relief"},
        headers=headers,
    ).json()["data"]["id"]
    client.post(
        "/api/v1/therapy-history/save",
        json=save_payload(group, videos[0], type="relief", sessionGroupId=first),
        headers=headers,
    )

    second = client.post(
        "/api/v1/therapy-history/start-session",
        json={"groupId": str(group.id), "sessionType": "relief"},
        headers=headers,
    ).json()["data"]["id"]

    unscoped = client.get(
        f"/api/v1/therapy-history/completed-count/{group.id}", headers=headers
    ).json()["data"]["completedCount"]
    scoped = client.get(
        f"/api/v1/therapy-history/completed-count/{group.id}",
        params={"sessionGroupId": second},
        headers=headers,
    ).json()["data"]["completedCount"]

    assert unscoped == 1
    assert scoped == 0


def test_session_totals_ignore_removed_videos(client, db_session):
    """History counts the videos the catalog serves, not every mapping row.

    Deleting a video only flips ``is_active``, so a group that once held three
    videos and now holds one used to report "1/3 videos" — and the run could
    never auto-complete, because completed could never reach the stale total.
    """
    group, videos = seed_group_with_videos(db_session, video_count=3)
    for video in videos[1:]:
        video.is_active = False
    db_session.commit()

    headers = auth_headers(client)
    session_group_id = client.post(
        "/api/v1/therapy-history/start-session",
        json={"groupId": str(group.id), "sessionType": "relief"},
        headers=headers,
    ).json()["data"]["id"]

    client.post(
        "/api/v1/therapy-history/save",
        json=save_payload(group, videos[0], type="relief", sessionGroupId=session_group_id),
        headers=headers,
    )

    listed = client.get("/api/v1/therapy-history/sessions", headers=headers).json()["data"]
    session = next(s for s in listed["sessions"] if s["id"] == session_group_id)
    assert session["totalVideos"] == 1
    assert session["completedVideos"] == 1
    # Finishing the only remaining video closes the run.
    assert session["status"] == "completed"


def test_history_only_own_sessions(client, db_session):
    group, videos = seed_group_with_videos(db_session)
    headers = auth_headers(client)
    client.post(
        "/api/v1/therapy-history/save",
        json=save_payload(group, videos[0]),
        headers=headers,
    )

    other = auth_headers(client, email="other@example.com")
    response = client.get("/api/v1/therapy-history", headers=other)
    assert response.json()["data"]["total"] == 0
