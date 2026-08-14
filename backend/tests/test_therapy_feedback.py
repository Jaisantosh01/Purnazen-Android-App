"""Session feedback: it must stay attached to the run it was written for, be
readable back in Session History, and be reachable only by the patient who
left it."""
from tests.test_therapy_history import auth_headers, seed_group_with_videos


def start_session(client, headers, group, session_type="relief"):
    response = client.post(
        "/api/v1/therapy-history/start-session",
        json={"groupId": str(group.id), "sessionType": session_type},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def create_feedback(client, headers, group, session_group_id, pain_before=7):
    response = client.post(
        "/api/v1/therapy-feedback",
        json={
            "videoGroupId": str(group.id),
            "sessionType": "relief",
            "sessionGroupId": session_group_id,
            "painBefore": pain_before,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def list_sessions(client, headers):
    return client.get("/api/v1/therapy-history/sessions", headers=headers).json()["data"][
        "sessions"
    ]


# ── The remark reaches Session History, against the right run ────────────────


def test_feedback_shows_against_its_own_session(client, db_session):
    group, _ = seed_group_with_videos(db_session)
    headers = auth_headers(client)

    first = start_session(client, headers, group)
    second = start_session(client, headers, group)

    fb_first = create_feedback(client, headers, group, first)
    fb_second = create_feedback(client, headers, group, second)

    client.put(
        f"/api/v1/therapy-feedback/{fb_first}/pain-after",
        json={"painAfter": 2, "userFeedback": "first run felt great"},
        headers=headers,
    )
    client.put(
        f"/api/v1/therapy-feedback/{fb_second}/pain-after",
        json={"painAfter": 5, "userFeedback": "second run was harder"},
        headers=headers,
    )

    by_id = {s["id"]: s for s in list_sessions(client, headers)}
    assert by_id[first]["feedback"]["userFeedback"] == "first run felt great"
    assert by_id[second]["feedback"]["userFeedback"] == "second run was harder"


def test_session_without_feedback_reports_none(client, db_session):
    group, _ = seed_group_with_videos(db_session)
    headers = auth_headers(client)
    session_group_id = start_session(client, headers, group)

    sessions = list_sessions(client, headers)
    assert sessions[0]["id"] == session_group_id
    assert sessions[0]["feedback"] is None


def test_remark_survives_a_later_score_only_update(client, db_session):
    """The player collects the written remark and "Mark Complete" collects the
    score; whichever runs second must not blank the other's answer."""
    group, _ = seed_group_with_videos(db_session)
    headers = auth_headers(client)
    session_group_id = start_session(client, headers, group)
    feedback_id = create_feedback(client, headers, group, session_group_id)

    client.put(
        f"/api/v1/therapy-feedback/{feedback_id}/pain-after",
        json={"userFeedback": "shoulder feels looser"},
        headers=headers,
    )
    client.put(
        f"/api/v1/therapy-feedback/{feedback_id}/pain-after",
        json={"painAfter": 3},
        headers=headers,
    )

    stored = client.get(
        f"/api/v1/therapy-feedback/by-session/{session_group_id}", headers=headers
    ).json()["data"]
    assert stored["userFeedback"] == "shoulder feels looser"
    assert stored["painAfter"] == 3
    assert stored["painBefore"] == 7


# ── Ownership ────────────────────────────────────────────────────────────────


def test_feedback_is_not_readable_by_another_user(client, db_session):
    group, _ = seed_group_with_videos(db_session)
    owner = auth_headers(client, email="owner@example.com")
    session_group_id = start_session(client, owner, group)
    create_feedback(client, owner, group, session_group_id)

    intruder = auth_headers(client, email="intruder@example.com")
    response = client.get(
        f"/api/v1/therapy-feedback/by-session/{session_group_id}", headers=intruder
    )
    assert response.status_code == 404


def test_feedback_is_not_writable_by_another_user(client, db_session):
    group, _ = seed_group_with_videos(db_session)
    owner = auth_headers(client, email="owner2@example.com")
    session_group_id = start_session(client, owner, group)
    feedback_id = create_feedback(client, owner, group, session_group_id)

    intruder = auth_headers(client, email="intruder2@example.com")
    response = client.put(
        f"/api/v1/therapy-feedback/{feedback_id}/pain-after",
        json={"painAfter": 10, "userFeedback": "not mine to write"},
        headers=intruder,
    )
    assert response.status_code == 404

    stored = client.get(
        f"/api/v1/therapy-feedback/by-session/{session_group_id}", headers=owner
    ).json()["data"]
    assert stored["userFeedback"] is None
    assert stored["painAfter"] is None


def test_session_cannot_be_completed_by_another_user(client, db_session):
    group, _ = seed_group_with_videos(db_session)
    owner = auth_headers(client, email="owner3@example.com")
    session_group_id = start_session(client, owner, group)

    intruder = auth_headers(client, email="intruder3@example.com")
    response = client.post(
        f"/api/v1/therapy-history/sessions/{session_group_id}/complete",
        json={"painAfter": 1, "userFeedback": "not mine to close"},
        headers=intruder,
    )
    assert response.status_code == 404

    sessions = list_sessions(client, owner)
    assert sessions[0]["status"] == "in_progress"
    assert sessions[0]["feedback"] is None
