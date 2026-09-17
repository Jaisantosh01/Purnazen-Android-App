"""Shared helpers for the therapy-feedback test modules (no tests here)."""


def login(client, email, password="secret123"):
    tokens = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()["data"]
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def make_feedback(client, headers, group, remark, before, after):
    r = client.post(
        "/api/v1/therapy-feedback",
        json={"videoGroupId": str(group.id), "sessionType": "relief", "painBefore": before},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    fid = r.json()["data"]["id"]
    if remark is not None or after is not None:
        body = {}
        if after is not None:
            body["painAfter"] = after
        if remark is not None:
            body["userFeedback"] = remark
        client.put(f"/api/v1/therapy-feedback/{fid}/pain-after", json=body, headers=headers)
    return fid
