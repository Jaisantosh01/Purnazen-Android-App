REGISTER_PAYLOAD = {
    "full_name": "Pref User",
    "email": "prefs@example.com",
    "password": "secret123",
}


def auth_headers(client, email="prefs@example.com"):
    client.post("/api/v1/auth/register", json={**REGISTER_PAYLOAD, "email": email})
    tokens = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "secret123"}
    ).json()["data"]
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_get_preferences_defaults(client):
    headers = auth_headers(client)
    response = client.get("/api/v1/users/me/preferences", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["pushEnabled"] is True
    assert data["notifications"] == {}


def test_update_preferences_merges(client):
    headers = auth_headers(client)

    response = client.put(
        "/api/v1/users/me/preferences",
        json={"notifications": {"session_reminder": True, "offers": False}},
        headers=headers,
    )
    assert response.status_code == 200

    # second partial update merges instead of replacing
    response = client.put(
        "/api/v1/users/me/preferences",
        json={"pushEnabled": False, "notifications": {"offers": True}},
        headers=headers,
    )
    data = response.json()["data"]
    assert data["pushEnabled"] is False
    assert data["notifications"] == {"session_reminder": True, "offers": True}

    # persisted
    data = client.get("/api/v1/users/me/preferences", headers=headers).json()["data"]
    assert data["pushEnabled"] is False
    assert data["notifications"]["session_reminder"] is True


def test_update_preferences_rejects_non_bool_values(client):
    headers = auth_headers(client)
    response = client.put(
        "/api/v1/users/me/preferences",
        json={"notifications": {"offers": "yes please"}},
        headers=headers,
    )
    assert response.status_code == 400


def test_preferences_require_auth(client):
    assert client.get("/api/v1/users/me/preferences").status_code == 401
    assert (
        client.put("/api/v1/users/me/preferences", json={"pushEnabled": True}).status_code
        == 401
    )


def test_preferences_are_per_user(client):
    first = auth_headers(client)
    client.put(
        "/api/v1/users/me/preferences",
        json={"pushEnabled": False},
        headers=first,
    )

    other = auth_headers(client, email="other-prefs@example.com")
    data = client.get("/api/v1/users/me/preferences", headers=other).json()["data"]
    assert data["pushEnabled"] is True
