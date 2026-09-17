"""Catalog exposes lower-quality sibling files (``<stem>.<height>p.mp4``) as a
rendition ladder, highest first, and leaves videos without siblings alone."""
from app.services import video_service
from tests.test_therapy_history import seed_group_with_videos


def test_catalog_lists_sibling_renditions(client, db_session, monkeypatch):
    group, (master, other) = seed_group_with_videos(db_session, video_count=2)
    master.video_url = "yoga/warmup.mp4"
    other.video_url = "yoga/cooldown.mp4"
    db_session.commit()

    listed = []
    monkeypatch.setattr(video_service, "list_blob_names", lambda prefix: listed.append(prefix) or [
        "yoga/warmup.mp4", "yoga/warmup.480p.mp4", "yoga/warmup.720p.mp4",
        "yoga/warmup2.360p.mp4",  # different stem
        "yoga/cooldown.mp4",
    ])

    r = client.get(f"/api/v1/videos/groups/{group.id}/catalog")
    assert r.status_code == 200, r.text
    by_id = {v["id"]: v for v in r.json()["data"]["videos"]}

    assert listed == ["yoga/"]  # one listing per folder, not per video
    assert [x["height"] for x in by_id[str(master.id)]["renditions"]] == [720, 480]
    assert by_id[str(master.id)]["renditions"][0]["videoUrl"].endswith("yoga/warmup.720p.mp4")
    assert "renditions" not in by_id[str(other.id)]
