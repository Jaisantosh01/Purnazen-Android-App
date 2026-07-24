"""Test add-folder endpoint against REAL Azure storage (no mock)."""

from fastapi.testclient import TestClient

REGISTER_PAYLOAD = {
    "full_name": "Test Admin",
    "email": "admin@test.com",
    "password": "admin123",
}
LOGIN_PAYLOAD = {"email": "admin@test.com", "password": "admin123"}


class TestAddFolderReal:
    def test_import_real_folder(self, client: TestClient):
        r = client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
        assert r.status_code == 201

        r = client.post("/api/v1/auth/login", json=LOGIN_PAYLOAD)
        token = r.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.post("/api/v1/videos/storage/add-folder", json={
            "prefix": "Knee_Pain/",
        }, headers=headers)

        body = resp.json()
        print(f"status={resp.status_code} success={body.get('success')} message={body.get('message')} count={body.get('data', {}).get('count')}")

        if resp.status_code == 200 or (resp.status_code == 201 and body.get("data", {}).get("count", 0) > 0):
            pass
        assert resp.status_code in (200, 201)
        assert body["success"] is True
        assert body["data"]["count"] > 0, f"Expected > 0 files, got: {body}"
