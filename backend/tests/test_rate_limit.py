from app.core.config import settings


def _limit_count(rate: str) -> int:
    """'5/minute' -> 5"""
    return int(rate.split("/")[0])


def test_login_rate_limited(rate_limited_client):
    limit = _limit_count(settings.RATE_LIMIT_LOGIN)
    payload = {"email": "nobody@example.com", "password": "wrong"}

    for _ in range(limit):
        response = rate_limited_client.post("/api/v1/auth/login", json=payload)
        assert response.status_code == 401

    response = rate_limited_client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 429
    body = response.json()
    assert body["success"] is False
    assert body["message"] == "Too many requests. Please try again later."


def test_register_rate_limited(rate_limited_client):
    limit = _limit_count(settings.RATE_LIMIT_REGISTER)

    for i in range(limit):
        response = rate_limited_client.post(
            "/api/v1/auth/register",
            json={
                "full_name": f"User {i}",
                "email": f"user{i}@example.com",
                "password": "secret123",
            },
        )
        assert response.status_code == 201

    response = rate_limited_client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "One Too Many",
            "email": "toomany@example.com",
            "password": "secret123",
        },
    )
    assert response.status_code == 429


def test_unlimited_endpoints_not_rate_limited(rate_limited_client):
    limit = _limit_count(settings.RATE_LIMIT_LOGIN)

    for _ in range(limit + 2):
        response = rate_limited_client.get("/health")
        assert response.status_code == 200
