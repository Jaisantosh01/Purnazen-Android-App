"""Sprint 4: tongue pipeline + dashboard / trends / compare endpoints."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.face_scan import FaceScan
from app.models.scan_result import ScanResult
from app.models.user import User


def _login(client):
    client.post("/api/v1/auth/register", json={"full_name": "Dash", "email": "dash@t.com", "password": "pass1234"})
    r = client.post("/api/v1/auth/login", json={"email": "dash@t.com", "password": "pass1234"})
    return r.json()["data"]["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _seed(db, user_id, glows, base_days_ago=3):
    """Create completed face scans + results with staggered dates; oldest first."""
    ids = []
    for i, glow in enumerate(glows):
        when = datetime.now(timezone.utc) - timedelta(days=base_days_ago - i)
        scan = FaceScan(user_id=user_id, scan_type="face", status="completed",
                        image_url="x", image_public_id="x", created_at=when,
                        processing_completed_at=when)
        db.add(scan); db.commit(); db.refresh(scan)
        db.add(ScanResult(
            scan_id=scan.id, glow_score=glow, overall_wellness_score=glow - 2,
            hydration_score=60, oiliness_score=40, wrinkle_score=30, pigmentation_score=25,
            dark_circle_score=35, pore_score=30, elasticity_score=65, muscle_tone_score=70,
            inflammation_score=20, toxin_indicator=30, skin_age_estimate=28,
            raw_metrics={"scoring_method": "cv"},
        ))
        db.commit()
        ids.append(scan.id)
    return ids


def _seed_tongue(db, user_id, wellnesses, markers=None, base_days_ago=3):
    """Create completed tongue scans + results with staggered dates; oldest first."""
    markers = markers or {}
    ids = []
    for i, wellness in enumerate(wellnesses):
        when = datetime.now(timezone.utc) - timedelta(days=base_days_ago - i)
        scan = FaceScan(user_id=user_id, scan_type="tongue", status="completed",
                        image_url="x", image_public_id="x", created_at=when,
                        processing_completed_at=when)
        db.add(scan); db.commit(); db.refresh(scan)
        m = markers.get(i, {})
        db.add(ScanResult(
            scan_id=scan.id, overall_wellness_score=wellness,
            tongue_body_color=m.get("body", "normal"),
            tongue_coat_color=m.get("coat", "white"),
            tongue_coat_thick=m.get("thick", "thin"),
            tongue_moisture=m.get("moisture", "moist"),
            tongue_shape=m.get("shape", "normal"),
            raw_metrics={"scoring_method": "cv"},
        ))
        db.commit()
        ids.append(scan.id)
    return ids


def _user_id(db):
    return db.query(User).filter(User.email == "dash@t.com").first().id


# ── dashboard ────────────────────────────────────────────────────────────────

def test_dashboard_empty(client):
    token = _login(client)
    r = client.get("/api/v1/face-glow/dashboard", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["hasData"] is False
    assert data["scanCount"] == 0


def test_dashboard_with_scans(client, db_session):
    token = _login(client)
    _seed(db_session, _user_id(db_session), [40, 55, 70])
    r = client.get("/api/v1/face-glow/dashboard", headers=_auth(token))
    data = r.json()["data"]
    assert data["hasData"] is True
    assert data["scanCount"] == 3
    assert data["latest"]["results"]["glowScore"] == 70.0  # newest
    assert len(data["glowTrend"]) == 3
    assert data["rollingGlow7d"] is not None


# ── trends ───────────────────────────────────────────────────────────────────

def test_trends_glow(client, db_session):
    token = _login(client)
    _seed(db_session, _user_id(db_session), [40, 55, 70])
    r = client.get("/api/v1/face-glow/trends?metric=glow_score", headers=_auth(token))
    data = r.json()["data"]
    assert data["metric"] == "glow_score"
    assert [p["value"] for p in data["points"]] == [40.0, 55.0, 70.0]


def test_trends_invalid_metric(client):
    token = _login(client)
    r = client.get("/api/v1/face-glow/trends?metric=not_a_metric", headers=_auth(token))
    assert r.status_code == 400


# ── compare ──────────────────────────────────────────────────────────────────

def test_compare_to_previous(client, db_session):
    token = _login(client)
    ids = _seed(db_session, _user_id(db_session), [50, 65])
    r = client.post(f"/api/v1/face-glow/scan/{ids[1]}/compare", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["hasBaseline"] is True
    assert data["deltas"]["glowScore"] == 15.0  # 65 - 50
    assert data["baseline"]["scanId"] == str(ids[0])


def test_compare_first_scan_has_no_baseline(client, db_session):
    token = _login(client)
    ids = _seed(db_session, _user_id(db_session), [50])
    r = client.post(f"/api/v1/face-glow/scan/{ids[0]}/compare", headers=_auth(token))
    data = r.json()["data"]
    assert data["hasBaseline"] is False


def test_compare_unknown_scan_404(client):
    token = _login(client)
    r = client.post(f"/api/v1/face-glow/scan/{uuid.uuid4()}/compare", headers=_auth(token))
    assert r.status_code == 404


# ── tongue dashboard ─────────────────────────────────────────────────────────

def test_tongue_dashboard_empty(client):
    token = _login(client)
    r = client.get("/api/v1/face-glow/dashboard?scan_type=tongue", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["scanType"] == "tongue"
    assert data["hasData"] is False


def test_tongue_dashboard_with_scans(client, db_session):
    token = _login(client)
    _seed_tongue(db_session, _user_id(db_session), [60, 72],
                 markers={1: {"coat": "yellow", "moisture": "dry"}})
    r = client.get("/api/v1/face-glow/dashboard?scan_type=tongue", headers=_auth(token))
    data = r.json()["data"]
    assert data["scanType"] == "tongue"
    assert data["hasData"] is True
    assert data["scanCount"] == 2
    assert data["latest"]["results"]["overallWellnessScore"] == 72.0
    assert data["markers"]["tongueCoatColor"] == "yellow"
    assert [p["value"] for p in data["wellnessTrend"]] == [60.0, 72.0]
    assert data["rollingWellness7d"] is not None


def test_tongue_and_face_dashboards_are_separate(client, db_session):
    token = _login(client)
    uid = _user_id(db_session)
    _seed(db_session, uid, [40, 70])
    _seed_tongue(db_session, uid, [80])
    face = client.get("/api/v1/face-glow/dashboard", headers=_auth(token)).json()["data"]
    tongue = client.get("/api/v1/face-glow/dashboard?scan_type=tongue", headers=_auth(token)).json()["data"]
    assert face["scanCount"] == 2 and face["scanType"] == "face"
    assert tongue["scanCount"] == 1 and tongue["scanType"] == "tongue"


# ── tongue compare ───────────────────────────────────────────────────────────

def test_tongue_compare_wellness_and_markers(client, db_session):
    token = _login(client)
    ids = _seed_tongue(db_session, _user_id(db_session), [60, 75],
                       markers={0: {"coat": "yellow"}, 1: {"coat": "white"}})
    r = client.post(f"/api/v1/face-glow/scan/{ids[1]}/compare", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["scanType"] == "tongue"
    assert data["hasBaseline"] is True
    assert data["wellnessDelta"] == 15.0
    coat = next(m for m in data["markerChanges"] if m["key"] == "tongueCoatColor")
    assert coat["baseline"] == "yellow" and coat["current"] == "white" and coat["changed"] is True
    shape = next(m for m in data["markerChanges"] if m["key"] == "tongueShape")
    assert shape["changed"] is False


def test_tongue_compare_first_scan_no_baseline(client, db_session):
    token = _login(client)
    ids = _seed_tongue(db_session, _user_id(db_session), [60])
    r = client.post(f"/api/v1/face-glow/scan/{ids[0]}/compare", headers=_auth(token))
    data = r.json()["data"]
    assert data["scanType"] == "tongue"
    assert data["hasBaseline"] is False


# ── tongue pipeline ──────────────────────────────────────────────────────────

def test_tongue_pipeline_markers():
    pytest.importorskip("cv2")
    import cv2
    import numpy as np
    from app.ai.tongue import analyze

    img = np.full((480, 480, 3), (40, 40, 40), np.uint8)
    cv2.ellipse(img, (240, 240), (150, 180), 0, 0, 360, (90, 90, 200), -1)  # reddish (BGR)
    out = analyze(img)
    assert out["tongue_body_color"] in {"pale", "normal", "red", "dark_red", "purple"}
    assert out["tongue_coat_color"] in {"white", "yellow"}
    assert out["tongue_moisture"] in {"moist", "dry"}
    assert 20.0 <= out["overall_wellness_score"] <= 95.0
