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


def session_payload(**overrides):
    # Mirrors what YogaSessionScreen/ReliefSessionScreen send on completion
    payload = {
        "title": "Headache Relief",
        "type": "wellness",
        "date": "2026-06-10T09:30:00.000Z",
        "duration": "15 min",
        "status": "Completed",
        "painBefore": 8,
        "painAfter": 3,
    }
    payload.update(overrides)
    return payload


def test_save_session_success(client):
    headers = auth_headers(client)
    response = client.post(
        "/api/v1/therapy-history/save", json=session_payload(), headers=headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True

    data = body["data"]
    assert data["title"] == "Headache Relief"
    assert data["type"] == "wellness"
    assert data["date"] == "June 10, 2026"
    assert data["duration"] == "15 min"
    assert data["status"] == "Completed"
    assert data["painBefore"] == 8
    assert data["painAfter"] == 3


def test_save_session_requires_auth(client):
    response = client.post("/api/v1/therapy-history/save", json=session_payload())
    assert response.status_code == 401
    assert response.json()["success"] is False


def test_save_session_rejects_unknown_type(client):
    headers = auth_headers(client)
    response = client.post(
        "/api/v1/therapy-history/save",
        json=session_payload(type="juggling"),
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["success"] is False


def test_history_lists_saved_sessions_newest_first(client):
    headers = auth_headers(client)
    client.post(
        "/api/v1/therapy-history/save",
        json=session_payload(title="Older", date="2026-06-01T10:00:00Z"),
        headers=headers,
    )
    client.post(
        "/api/v1/therapy-history/save",
        json=session_payload(title="Newer", date="2026-06-10T10:00:00Z"),
        headers=headers,
    )

    response = client.get("/api/v1/therapy-history", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 2
    assert [s["title"] for s in data["sessions"]] == ["Newer", "Older"]


def test_history_stats(client):
    headers = auth_headers(client)
    client.post(
        "/api/v1/therapy-history/save",
        json=session_payload(duration="15 min", painBefore=8, painAfter=3),
        headers=headers,
    )
    client.post(
        "/api/v1/therapy-history/save",
        json=session_payload(duration="20 min", painBefore=7, painAfter=2),
        headers=headers,
    )

    stats = client.get("/api/v1/therapy-history", headers=headers).json()["data"]["stats"]
    assert stats["sessions"] == 2
    assert stats["minutes"] == 35
    assert stats["avgRelief"] == -5


def test_history_pagination(client):
    headers = auth_headers(client)
    for index in range(3):
        client.post(
            "/api/v1/therapy-history/save",
            json=session_payload(title=f"Session {index}", date=f"2026-06-0{index + 1}T10:00:00Z"),
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


def test_history_only_own_sessions(client):
    headers = auth_headers(client)
    client.post(
        "/api/v1/therapy-history/save", json=session_payload(), headers=headers
    )

    other = auth_headers(client, email="other@example.com")
    response = client.get("/api/v1/therapy-history", headers=other)
    assert response.json()["data"]["total"] == 0
