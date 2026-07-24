"""Test video upload end-to-end.

Requires the backend to have Azure Storage configured in .env
(otherwise the test will skip when Azure is unavailable).

Usage:
    pytest tests/test_video_upload.py -v
"""

import os
import uuid

import pytest

from app.core.config import settings

REGISTER_PAYLOAD = {
    "full_name": "Upload Test User",
    "email": "upload-test@example.com",
    "password": "secret123",
}


def register(client, payload=None):
    return client.post("/api/v1/auth/register", json=payload or REGISTER_PAYLOAD)


def login(client, email="upload-test@example.com", password="secret123"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _azure_configured():
    return bool(
        settings.AZURE_STORAGE_ACCOUNT_NAME
        and settings.AZURE_STORAGE_ACCOUNT_KEY
        and settings.AZURE_BLOB_CONTAINER_NAME
    )


@pytest.fixture(scope="module")
def sample_video_path():
    """Path to a real MP4 file used for upload tests."""
    candidate = r"C:\Users\soubhagya.p\Downloads\yoga.mp4"
    if os.path.isfile(candidate):
        return candidate
    # fallback: create a minimal valid MP4 from known test data
    fallback = os.path.join(os.path.dirname(__file__), "_test_sample.mp4")
    if not os.path.isfile(fallback):
        _write_minimal_mp4(fallback)
    return fallback


def _write_minimal_mp4(path):
    """Write a minimal but valid MP4 file (ftyp + moov boxes)."""
    import struct

    ftyp = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42mp41"
    moov = (
        b"\x00\x00\x00\x08moov"
        b"\x00\x00\x00\x20mvhd"
        + struct.pack(">I", 0)  # version/flags
        + b"\x00" * 12  # creation/modify times
        + b"\x00\x00\x00\x01"  # timescale
        + b"\x00\x00\x00\x00"  # duration
        + b"\x00\x00\x01\x00"  # rate
        + b"\x01\x00\x00\x00"  # volume
        + b"\x00" * 60  # matrix
        + b"\x00" * 24  # pre-defined
        + b"\x00\x00\x00\x00\x00\x00\x00\x00"
        b"\x00\x00\x00\x14trak"
        b"\x00\x00\x00\x1ctkhd\x00\x00\x00\x01"
        + b"\x00" * 16
        + b"\x00\x00\x00\x01"
        + b"\x00" * 8
        + b"\x00\x00\x00\x01\x00\x00\x00\x01"
        + b"\x00" * 20
        + b"\x00\x00\x00\x14mdia"
        b"\x00\x00\x00\x0cmdhd\x00\x00\x00\x00\x00\x00\x00\x00"
        b"\x00\x00\x00\x14hdlr\x00\x00\x00\x00vide\x00\x00\x00\x00\x00\x00"
        b"\x00\x00\x00\x10minf"
        b"\x00\x00\x00\x0cstbl"
        b"\x00\x00\x00\x08stsd"
    )
    with open(path, "wb") as f:
        f.write(ftyp + moov)


@pytest.mark.skipif(
    not _azure_configured(),
    reason="Azure Storage not configured — skipping upload test",
)
class TestVideoUpload:
    def _auth_headers(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_upload_without_group(self, client, sample_video_path):
        """Upload a video without a video_group_id (simulating frontend behaviour)."""
        register(client)
        login_resp = login(client)
        assert login_resp.status_code == 200
        token = login_resp.json()["data"]["access_token"]
        unique_name = f"yoga_{uuid.uuid4().hex[:8]}.mp4"

        with open(sample_video_path, "rb") as f:
            resp = client.post(
                "/api/v1/videos/upload",
                data={
                    "directory": "",
                    "title": "Test Yoga Upload",
                    "description": "Uploaded by integration test",
                    "duration": "30",
                    "icon": "play-circle",
                    "video_group_id": "",
                    "sort_order": "0",
                },
                files={"file": (unique_name, f, "video/mp4")},
                headers=self._auth_headers(token),
            )

        assert resp.status_code in (200, 201), f"Upload failed: {resp.text}"
        body = resp.json()
        assert body["success"] is True
        assert body["data"] is not None
        assert body["data"]["title"] == "Test Yoga Upload"
        assert body["data"]["videoUrl"] is not None

    def test_upload_with_valid_group(self, client, sample_video_path, db_session):
        """Upload a video linked to a real video group."""
        register(client)
        login_resp = login(client)
        assert login_resp.status_code == 200
        data = login_resp.json()["data"]
        token = data["access_token"]
        user_id = uuid.UUID(data["user"]["id"])

        from app.db.base import VideoGroups
        group = VideoGroups(
            id=uuid.uuid4(),
            title="Test Upload Group",
            description="Created by integration test",
            icon="play-circle",
            created_by=user_id,
            updated_by=user_id,
        )
        db_session.add(group)
        db_session.commit()
        unique_name = f"grouped_yoga_{uuid.uuid4().hex[:8]}.mp4"

        with open(sample_video_path, "rb") as f:
            resp = client.post(
                "/api/v1/videos/upload",
                data={
                    "directory": "",
                    "title": "Grouped Yoga Upload",
                    "description": "Uploaded with a group",
                    "duration": "45",
                    "icon": "play-circle",
                    "video_group_id": str(group.id),
                    "sort_order": "1",
                },
                files={"file": (unique_name, f, "video/mp4")},
                headers=self._auth_headers(token),
            )

        assert resp.status_code in (200, 201), f"Upload failed: {resp.text}"
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["title"] == "Grouped Yoga Upload"
        assert body["data"]["videoUrl"] is not None
        assert unique_name in body["data"]["videoUrl"], (
            f"Expected videoUrl to contain '{unique_name}', got '{body['data']['videoUrl']}'"
        )
        # The endpoint should have created a mapping to the group
        from app.db.base import VideoGroupMapping
        mapping = (
            db_session.query(VideoGroupMapping)
            .filter_by(video_group_id=group.id, video_id=uuid.UUID(body["data"]["id"]))
            .first()
        )
        assert mapping is not None, "No VideoGroupMapping was created"

    def test_upload_missing_file_rejected(self, client):
        """Upload without a file returns 422."""
        register(client)
        login_resp = login(client)
        token = login_resp.json()["data"]["access_token"]

        resp = client.post(
            "/api/v1/videos/upload",
            data={
                "directory": "",
                "title": "No File",
                "description": "",
                "duration": "0",
                "icon": "play-circle",
                "video_group_id": "",
                "sort_order": "0",
            },
            headers=self._auth_headers(token),
        )
        assert resp.status_code in (400, 422), f"Expected 400 or 422, got {resp.status_code}: {resp.text}"

    def test_upload_requires_auth(self, client, sample_video_path):
        """Upload without auth returns 401/403."""
        with open(sample_video_path, "rb") as f:
            resp = client.post(
                "/api/v1/videos/upload",
                data={
                    "directory": "",
                    "title": "Unauthorized",
                    "description": "",
                    "duration": "0",
                    "icon": "play-circle",
                    "video_group_id": "",
                    "sort_order": "0",
                },
                files={"file": ("unauth.mp4", f, "video/mp4")},
            )
        assert resp.status_code in (401, 403), f"Expected 401 or 403, got {resp.status_code}: {resp.text}"

    def test_upload_to_subdirectory(self, client, sample_video_path):
        """Upload a video to a specific storage subdirectory."""
        register(client)
        login_resp = login(client)
        assert login_resp.status_code == 200
        token = login_resp.json()["data"]["access_token"]

        test_dir = f"test_uploads/{uuid.uuid4().hex}/"
        with open(sample_video_path, "rb") as f:
            resp = client.post(
                "/api/v1/videos/upload",
                data={
                    "directory": test_dir,
                    "title": "Subdirectory Upload",
                    "description": "Uploaded to a subdirectory",
                    "duration": "60",
                    "icon": "play-circle",
                    "video_group_id": "",
                    "sort_order": "0",
                },
                files={"file": ("subdir_test.mp4", f, "video/mp4")},
                headers=self._auth_headers(token),
            )

        assert resp.status_code in (200, 201), f"Upload failed: {resp.text}"
        body = resp.json()
        assert body["success"] is True
        assert test_dir.rstrip("/") in body["data"]["videoUrl"], (
            f"Expected videoUrl to contain '{test_dir}', got '{body['data']['videoUrl']}'"
        )

    def test_non_video_file_rejected(self, client):
        """Upload a non-video file (e.g. .txt) is rejected."""
        register(client)
        login_resp = login(client)
        assert login_resp.status_code == 200
        token = login_resp.json()["data"]["access_token"]

        resp = client.post(
            "/api/v1/videos/upload",
            data={
                "directory": "",
                "title": "Not a Video",
                "description": "",
                "duration": "0",
                "icon": "play-circle",
                "video_group_id": "",
                "sort_order": "0",
            },
            files={"file": ("readme.txt", b"this is not a video", "text/plain")},
            headers=self._auth_headers(token),
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        body = resp.json()
        assert body["success"] is False
        assert "Only video files are allowed" in body["message"]
