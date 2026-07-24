from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.utils.azure_storage import list_all_blobs_with_sas, get_blob_service_client

REGISTER_PAYLOAD = {
    "full_name": "Test Admin",
    "email": "admin@test.com",
    "password": "admin123",
}
LOGIN_PAYLOAD = {"email": "admin@test.com", "password": "admin123"}

MOCK_FILES = [
    {"name": "videos/yoga/pose1.mp4", "size": 1024, "lastModified": "2024-01-01T00:00:00", "videoUrl": "https://mock.blob/container/videos/yoga/pose1.mp4?sas=abc"},
    {"name": "videos/yoga/pose2.mp4", "size": 2048, "lastModified": "2024-01-01T00:00:00", "videoUrl": "https://mock.blob/container/videos/yoga/pose2.mp4?sas=abc"},
    {"name": "videos/meditation/calm.mp4", "size": 512, "lastModified": "2024-01-01T00:00:00", "videoUrl": "https://mock.blob/container/videos/meditation/calm.mp4?sas=abc"},
]


def _mock_list_all_blobs_with_sas(prefix):
    return [f for f in MOCK_FILES if f["name"].startswith(prefix)]


@pytest.fixture(autouse=True)
def patch_azure():
    with patch("app.api.v1.endpoints.videos.list_all_blobs_with_sas") as mock:
        mock.side_effect = _mock_list_all_blobs_with_sas
        yield mock


def register(client):
    return client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)


def login(client):
    resp = client.post("/api/v1/auth/login", json=LOGIN_PAYLOAD)
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestAddFolder:
    """``POST /api/v1/videos/storage/add-folder``"""

    def test_imports_all_videos_from_folder(self, client: TestClient):
        register(client)
        headers = login(client)

        resp = client.post("/api/v1/videos/storage/add-folder", json={
            "prefix": "videos/yoga/",
        }, headers=headers)

        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["count"] == 2
        assert len(body["data"]["videos"]) == 2

        # videoUrl is a SAS URL (converted by _process_video_data),
        # but the blob path is stored as model.video_url in DB
        urls = [v["videoUrl"] for v in body["data"]["videos"]]
        assert all("videos/yoga/pose" in u for u in urls)
        assert any("pose1" in u for u in urls)

    def test_import_root_videos_folder(self, client: TestClient):
        register(client)
        headers = login(client)

        resp = client.post("/api/v1/videos/storage/add-folder", json={
            "prefix": "videos/",
        }, headers=headers)

        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["count"] == 3  # all 3 mock files under videos/
        assert len(body["data"]["videos"]) == 3

    def test_import_idempotent_returns_all_existing(self, client: TestClient):
        register(client)
        headers = login(client)

        resp1 = client.post("/api/v1/videos/storage/add-folder", json={
            "prefix": "videos/yoga/",
        }, headers=headers)
        assert resp1.json()["data"]["count"] == 2

        # Second import returns ALL records (not just new ones)
        resp2 = client.post("/api/v1/videos/storage/add-folder", json={
            "prefix": "videos/yoga/",
        }, headers=headers)
        assert resp2.json()["data"]["count"] == 2
        assert len(resp2.json()["data"]["videos"]) == 2

    def test_empty_folder_returns_zero(self, client: TestClient):
        register(client)
        headers = login(client)

        resp = client.post("/api/v1/videos/storage/add-folder", json={
            "prefix": "videos/empty/",
        }, headers=headers)

        assert resp.status_code in (200, 201)
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["count"] == 0

    def test_import_ensures_trailing_slash(self, client: TestClient):
        register(client)
        headers = login(client)

        resp = client.post("/api/v1/videos/storage/add-folder", json={
            "prefix": "videos/yoga",
        }, headers=headers)

        assert resp.status_code == 201
        assert resp.json()["data"]["count"] == 2

    def test_unauthenticated_returns_401(self, client: TestClient):
        resp = client.post("/api/v1/videos/storage/add-folder", json={
            "prefix": "videos/yoga/",
        })
        assert resp.status_code == 401
