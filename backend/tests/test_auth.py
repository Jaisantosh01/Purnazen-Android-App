REGISTER_PAYLOAD = {
    "full_name": "Test User",
    "email": "test@example.com",
    "password": "secret123",
}


def register(client, payload=None):
    return client.post("/api/v1/auth/register", json=payload or REGISTER_PAYLOAD)


def login(client, email="test@example.com", password="secret123"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_register_success(client):
    response = register(client)
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["message"] == "User registered successfully"
    assert body["data"]["email"] == "test@example.com"
    assert body["data"]["full_name"] == "Test User"


def test_register_duplicate_email(client):
    register(client)
    response = register(client)
    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert body["message"] == "Email already exists"


def test_register_invalid_email(client):
    response = register(client, {**REGISTER_PAYLOAD, "email": "not-an-email"})
    assert response.status_code == 400
    assert response.json()["success"] is False


def test_register_missing_fields(client):
    response = client.post("/api/v1/auth/register", json={"email": "a@b.com"})
    assert response.status_code == 400
    assert response.json()["success"] is False


def test_login_success(client):
    register(client)
    response = login(client)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert data["access_token"]
    assert data["refresh_token"]
    assert data["user"]["email"] == "test@example.com"
    assert data["user"]["role"] == "patient"


def test_login_wrong_password(client):
    register(client)
    response = login(client, password="wrong")
    assert response.status_code == 401
    assert response.json()["message"] == "Invalid email or password"


def test_login_unknown_email(client):
    response = login(client, email="nobody@example.com")
    assert response.status_code == 401


def test_me_with_access_token(client):
    register(client)
    tokens = login(client).json()["data"]
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["user_id"] == str(tokens["user"]["id"])


def test_me_without_token(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["success"] is False


def test_me_rejects_refresh_token(client):
    register(client)
    tokens = login(client).json()["data"]
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['refresh_token']}"},
    )
    assert response.status_code == 401


def test_refresh_returns_new_access_token(client):
    register(client)
    tokens = login(client).json()["data"]
    response = client.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {tokens['refresh_token']}"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["access_token"]


def test_logout_revokes_refresh_token(client):
    register(client)
    tokens = login(client).json()["data"]
    headers = {"Authorization": f"Bearer {tokens['refresh_token']}"}

    response = client.post("/api/v1/auth/logout", headers=headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully"

    # The same refresh token must now be rejected
    response = client.post("/api/v1/auth/refresh", headers=headers)
    assert response.status_code == 401
    assert response.json()["message"] == "Token has been revoked"


def test_admin_dashboard_denied_for_patient(client):
    register(client)
    tokens = login(client).json()["data"]
    response = client.get(
        "/api/v1/auth/admin/dashboard",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response.status_code == 403
    assert response.json()["message"] == "Access denied"


def test_admin_dashboard_allowed_for_admin(client, db_session):
    from app.models.user import User

    register(client)
    user = db_session.query(User).filter_by(email="test@example.com").first()
    user.role = "admin"
    db_session.commit()

    tokens = login(client).json()["data"]
    response = client.get(
        "/api/v1/auth/admin/dashboard",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["dashboard"] == "Admin Panel"
