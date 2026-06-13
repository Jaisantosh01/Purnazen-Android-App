REGISTER_PAYLOAD = {
    "full_name": "Test User",
    "email": "profile@example.com",
    "password": "secret123",
}


def login_tokens(client, email="profile@example.com", password="secret123"):
    client.post("/api/v1/auth/register", json={**REGISTER_PAYLOAD, "email": email})
    return client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    ).json()["data"]


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


# ── PUT /auth/me ─────────────────────────────────────────────────────────────


def test_update_profile(client):
    tokens = login_tokens(client)
    response = client.put(
        "/api/v1/auth/me",
        json={"fullName": "Renamed User", "avatarUrl": "https://cdn/x.png"},
        headers=bearer(tokens["access_token"]),
    )
    assert response.status_code == 200
    user = response.json()["data"]["user"]
    assert user["full_name"] == "Renamed User"
    assert user["avatar_url"] == "https://cdn/x.png"

    # persisted
    me = client.get("/api/v1/auth/me", headers=bearer(tokens["access_token"]))
    assert me.json()["data"]["user"]["full_name"] == "Renamed User"


def test_update_profile_partial(client):
    tokens = login_tokens(client)
    response = client.put(
        "/api/v1/auth/me",
        json={"fullName": "Only Name"},
        headers=bearer(tokens["access_token"]),
    )
    user = response.json()["data"]["user"]
    assert user["full_name"] == "Only Name"
    assert user["avatar_url"] is None


def test_update_profile_requires_auth(client):
    response = client.put("/api/v1/auth/me", json={"fullName": "X"})
    assert response.status_code == 401


# ── POST /auth/change-password ───────────────────────────────────────────────


def test_change_password_wrong_current(client):
    tokens = login_tokens(client)
    response = client.post(
        "/api/v1/auth/change-password",
        json={"currentPassword": "wrong", "newPassword": "newsecret1"},
        headers=bearer(tokens["access_token"]),
    )
    assert response.status_code == 401
    assert response.json()["message"] == "Current password is incorrect"


def test_change_password_invalidates_old_tokens(client):
    tokens = login_tokens(client)
    response = client.post(
        "/api/v1/auth/change-password",
        json={"currentPassword": "secret123", "newPassword": "newsecret1"},
        headers=bearer(tokens["access_token"]),
    )
    assert response.status_code == 200
    new_tokens = response.json()["data"]

    # Old refresh and access tokens are revoked
    refresh = client.post(
        "/api/v1/auth/refresh", headers=bearer(tokens["refresh_token"])
    )
    assert refresh.status_code == 401
    me = client.get("/api/v1/auth/me", headers=bearer(tokens["access_token"]))
    assert me.status_code == 401

    # The returned pair works
    me = client.get("/api/v1/auth/me", headers=bearer(new_tokens["access_token"]))
    assert me.status_code == 200
    refresh = client.post(
        "/api/v1/auth/refresh", headers=bearer(new_tokens["refresh_token"])
    )
    assert refresh.status_code == 200

    # Old password no longer logs in, the new one does
    bad = client.post(
        "/api/v1/auth/login",
        json={"email": "profile@example.com", "password": "secret123"},
    )
    assert bad.status_code == 401
    good = client.post(
        "/api/v1/auth/login",
        json={"email": "profile@example.com", "password": "newsecret1"},
    )
    assert good.status_code == 200


def test_change_password_rejects_short_new_password(client):
    tokens = login_tokens(client)
    response = client.post(
        "/api/v1/auth/change-password",
        json={"currentPassword": "secret123", "newPassword": "abc"},
        headers=bearer(tokens["access_token"]),
    )
    assert response.status_code == 400


# ── DELETE /auth/me ──────────────────────────────────────────────────────────


def test_delete_account(client):
    tokens = login_tokens(client)

    # leave some user-owned rows behind to exercise the cascade
    client.post(
        "/api/v1/therapy-history/save",
        json={
            "title": "Session",
            "type": "wellness",
            "date": "2026-06-10T09:30:00Z",
            "duration": "15 min",
        },
        headers=bearer(tokens["access_token"]),
    )

    response = client.delete(
        "/api/v1/auth/me", headers=bearer(tokens["access_token"])
    )
    assert response.status_code == 200

    # Deleted user can't login and their tokens are dead
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "profile@example.com", "password": "secret123"},
    )
    assert login.status_code == 401
    me = client.get("/api/v1/auth/me", headers=bearer(tokens["access_token"]))
    assert me.status_code == 401


def test_delete_account_requires_auth(client):
    response = client.delete("/api/v1/auth/me")
    assert response.status_code == 401
