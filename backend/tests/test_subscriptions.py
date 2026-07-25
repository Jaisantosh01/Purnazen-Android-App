"""Subscription catalog + per-user subscription endpoints."""

from app.models.subscription_plan import SubscriptionPlan

REGISTER_PAYLOAD = {
    "full_name": "Sub User",
    "email": "sub@example.com",
    "password": "secret123",
}


def auth_headers(client, email="sub@example.com"):
    client.post("/api/v1/auth/register", json={**REGISTER_PAYLOAD, "email": email})
    tokens = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "secret123"}
    ).json()["data"]
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def seed_plans(db_session):
    db_session.add_all(
        [
            SubscriptionPlan(
                code="free", name="Free", price=0, period="forever", sort_order=0,
                features=[{"text": "Basic yoga", "included": True}],
            ),
            SubscriptionPlan(
                code="premium", name="Premium", price=499, period="month", sort_order=1,
                badge="Most Popular", accent_color="#1FA77A",
                features=[{"text": "Unlimited sessions", "included": True}],
            ),
            SubscriptionPlan(
                code="pro", name="Pro", price=999, period="month", sort_order=2,
                accent_color="#7C3AED", features=[],
            ),
        ]
    )
    db_session.commit()


def test_list_plans_is_public_and_ordered(client, db_session):
    seed_plans(db_session)
    res = client.get("/api/v1/subscriptions/plans")  # no auth
    assert res.status_code == 200
    plans = res.json()["data"]["plans"]
    assert [p["code"] for p in plans] == ["free", "premium", "pro"]  # by sort_order
    premium = plans[1]
    assert premium["price"] == 499.0
    assert premium["badge"] == "Most Popular"
    assert premium["accentColor"] == "#1FA77A"
    assert premium["features"] == [{"text": "Unlimited sessions", "included": True}]


def test_list_plans_hides_inactive(client, db_session):
    seed_plans(db_session)
    pro = db_session.query(SubscriptionPlan).filter_by(code="pro").first()
    pro.is_active = False
    db_session.commit()
    codes = [p["code"] for p in client.get("/api/v1/subscriptions/plans").json()["data"]["plans"]]
    assert "pro" not in codes


def test_me_defaults_to_free(client, db_session):
    seed_plans(db_session)
    headers = auth_headers(client)
    sub = client.get("/api/v1/subscriptions/me", headers=headers).json()["data"]["subscription"]
    assert sub["planCode"] == "free"
    assert sub["status"] == "active"
    assert sub["currentPeriodEnd"] is None


def test_me_requires_auth(client):
    assert client.get("/api/v1/subscriptions/me").status_code == 401


def test_subscribe_to_paid_plan_sets_period_end(client, db_session):
    seed_plans(db_session)
    headers = auth_headers(client)
    res = client.post(
        "/api/v1/subscriptions/subscribe", json={"plan_code": "premium"}, headers=headers
    )
    assert res.status_code == 200
    sub = res.json()["data"]["subscription"]
    assert sub["planCode"] == "premium"
    assert sub["status"] == "active"
    assert sub["currentPeriodEnd"] is not None  # monthly plan gets a rolling period

    # persisted — /me now reflects the new plan
    me = client.get("/api/v1/subscriptions/me", headers=headers).json()["data"]["subscription"]
    assert me["planCode"] == "premium"


def test_subscribe_to_free_has_no_period_end(client, db_session):
    seed_plans(db_session)
    headers = auth_headers(client)
    sub = client.post(
        "/api/v1/subscriptions/subscribe", json={"plan_code": "free"}, headers=headers
    ).json()["data"]["subscription"]
    assert sub["planCode"] == "free"
    assert sub["currentPeriodEnd"] is None


def test_subscribe_switches_plan_in_place(client, db_session):
    """Changing plans updates the single subscription row rather than stacking."""
    seed_plans(db_session)
    headers = auth_headers(client)
    client.post("/api/v1/subscriptions/subscribe", json={"plan_code": "premium"}, headers=headers)
    res = client.post("/api/v1/subscriptions/subscribe", json={"plan_code": "pro"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["data"]["subscription"]["planCode"] == "pro"
    me = client.get("/api/v1/subscriptions/me", headers=headers).json()["data"]["subscription"]
    assert me["planCode"] == "pro"


def test_subscribe_unknown_plan_404(client, db_session):
    seed_plans(db_session)
    headers = auth_headers(client)
    res = client.post(
        "/api/v1/subscriptions/subscribe", json={"plan_code": "does-not-exist"}, headers=headers
    )
    assert res.status_code == 404


def test_subscribe_requires_auth(client, db_session):
    seed_plans(db_session)
    assert client.post("/api/v1/subscriptions/subscribe", json={"plan_code": "free"}).status_code == 401


def test_subscriptions_are_per_user(client, db_session):
    seed_plans(db_session)
    first = auth_headers(client)
    client.post("/api/v1/subscriptions/subscribe", json={"plan_code": "pro"}, headers=first)

    other = auth_headers(client, email="other-sub@example.com")
    me = client.get("/api/v1/subscriptions/me", headers=other).json()["data"]["subscription"]
    assert me["planCode"] == "free"  # unaffected by the first user's upgrade
