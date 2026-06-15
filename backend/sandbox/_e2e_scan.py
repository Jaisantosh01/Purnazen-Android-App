"""Throwaway end-to-end scan test against the running server (venv312)."""
import time, uuid, requests

BASE = "http://localhost:5000/api/v1"
email = f"e2e_{uuid.uuid4().hex[:8]}@example.com"
pwd = "secret123"

r = requests.post(f"{BASE}/auth/register", json={"full_name": "E2E", "email": email, "password": pwd}, timeout=15)
print("register", r.status_code)
lr = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pwd}, timeout=15)
print("login", lr.status_code)
data = lr.json()["data"]
tok = data.get("access_token") or data.get("tokens", {}).get("access_token")
H = {"Authorization": f"Bearer {tok}"}

requests.post(f"{BASE}/consent", json={"consent_type": "scan_storage", "granted": True}, headers=H, timeout=15)

with open("sandbox/_sample_face.jpg", "rb") as f:
    up = requests.post(f"{BASE}/face-glow/scan/upload?scan_type=face",
                       files={"file": ("face.jpg", f, "image/jpeg")}, headers=H, timeout=60)
print("upload", up.status_code, up.json().get("message"))
scan_id = up.json()["data"]["scan_id"]

seen = []
final = None
for _ in range(40):
    s = requests.get(f"{BASE}/face-glow/scan/{scan_id}/status", headers=H, timeout=15).json()["data"]
    stage = s.get("progress_stage")
    if stage not in seen:
        seen.append(stage)
    if s["status"] in ("completed", "failed"):
        final = s
        break
    time.sleep(0.4)

print("stages seen:", seen)
print("final status:", final["status"])
lm = final.get("landmarks")
print("landmarks:", lm["type"] if lm else None, len(lm["points"]) if lm and lm.get("points") else "-")
print("image dims:", final.get("image_width"), "x", final.get("image_height"))
res = final.get("results") or {}
print("glow:", res.get("glowScore"), "wellness:", res.get("overallWellnessScore"))
print("recommendations:", len(final.get("recommendations") or []))
