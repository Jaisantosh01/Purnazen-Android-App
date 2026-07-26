"""Test add-folder endpoint against REAL Azure storage (no mock).

Integration test: it needs live Azure credentials AND the `Knee_Pain/` folder to
actually contain blobs. CI has neither (no secrets are exposed to the test job),
where it failed on `count > 0` rather than being skipped. It now skips unless
the storage account is configured — run it locally with a populated `.env`.
"""
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings

pytestmark = pytest.mark.skipif(
    not (settings.AZURE_STORAGE_ACCOUNT_NAME and settings.AZURE_STORAGE_ACCOUNT_KEY),
    reason="Azure storage is not configured — this test talks to real blob storage",
)

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
