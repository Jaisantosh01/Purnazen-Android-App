"""Published-version registry: latest lookup, CI registration, store links."""
import pytest

from app.core.config import settings

LATEST = "/api/v1/app-releases/latest"
REGISTER = "/api/v1/app-releases"


@pytest.fixture()
def release_token(monkeypatch):
    monkeypatch.setattr(settings, "RELEASE_REGISTER_TOKEN", "ci-token")
    return {"X-Release-Token": "ci-token"}


def _register(client, headers, version, **extra):
    body = {"appSlug": "mobile-doctors", "version": version, **extra}
    return client.post(REGISTER, json=body, headers=headers)


def test_register_requires_the_ci_token(client, release_token):
    r = client.post(REGISTER, json={"appSlug": "mobile-doctors", "version": "1.0.0"})
    assert r.status_code == 401
    r = client.post(REGISTER, json={"appSlug": "mobile-doctors", "version": "1.0.0"},
                    headers={"X-Release-Token": "wrong"})
    assert r.status_code == 401


def test_latest_is_semver_ordered_and_carries_forced(client, release_token):
    _register(client, release_token, "1.0.9")
    _register(client, release_token, "1.0.10", forced=True, notes="Security fix")
    r = client.get(LATEST, params={"app": "mobile-doctors"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["version"] == "1.0.10"
    assert data["forced"] is True
    assert data["storeLinks"] == {}


def test_unknown_app_and_missing_release(client):
    assert client.get(LATEST, params={"app": "nope"}).status_code == 400
    assert client.get(LATEST, params={"app": "mobile-admin"}).status_code == 404


def test_store_links_are_returned_per_platform(client, release_token, monkeypatch):
    monkeypatch.setattr(settings, "STORE_LINKS_JSON",
        '{"mobile-doctors": {"ios": "https://testflight.apple.com/join/AbCd1234",'
        ' "android": "market://details?id=com.purnazen.doctor"}}')
    _register(client, release_token, "1.1.0")
    links = client.get(LATEST, params={"app": "mobile-doctors"}).json()["data"]["storeLinks"]
    assert links == {
        "ios": "https://testflight.apple.com/join/AbCd1234",
        "android": "market://details?id=com.purnazen.doctor",
    }


def test_unsafe_or_malformed_links_are_dropped(client, release_token, monkeypatch):
    _register(client, release_token, "1.1.0")
    monkeypatch.setattr(settings, "STORE_LINKS_JSON",
        '{"mobile-doctors": {"ios": "javascript:alert(1)", "android": "http://insecure.example"}}')
    assert client.get(LATEST, params={"app": "mobile-doctors"}).json()["data"]["storeLinks"] == {}
    monkeypatch.setattr(settings, "STORE_LINKS_JSON", "{not json")
    r = client.get(LATEST, params={"app": "mobile-doctors"})
    assert r.status_code == 200
    assert r.json()["data"]["storeLinks"] == {}
