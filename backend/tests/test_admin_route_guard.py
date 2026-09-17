"""Content-management writes are admin-only.

Before 2026-09-17 these routes only required *a* signed-in account, and
patient sign-up is open — so any patient could delete the video library,
rewrite the support phone number, or change clinic slot timings. The FAQ
router accepted writes with no login at all.

The first test walks the whole app, so a new write route that forgets its
role gate fails here instead of shipping.
"""
import uuid

import pytest
from fastapi.routing import APIRoute

from app.main import app
from tests.test_therapy_history import auth_headers

# Writes any signed-in user may make, each scoped to that user's own data (or,
# for doctor self-service, to the caller's doctor profile).
SELF_SERVICE = {
    "/auth/", "/consent", "/doctor-availability", "/doctor-leaves", "/errors/report",
    "/face-glow/", "/notifications/", "/payments/", "/subscriptions/subscribe",
    "/therapy-feedback", "/therapy-history/", "/user-addresses", "/users/me/",
}


def _walk(routes, prefix=""):
    for r in routes:
        if isinstance(r, APIRoute):
            yield prefix + r.path, r
        elif hasattr(r, "routes") or hasattr(r, "router"):
            inner = getattr(r, "router", None) or r
            yield from _walk(getattr(inner, "routes", []), prefix + (getattr(r, "prefix", "") or ""))


def _has_role_gate(dependant):
    for sub in dependant.dependencies:
        if "require_role" in getattr(sub.call, "__qualname__", ""):
            return True
        if _has_role_gate(sub):
            return True
    return False


def test_every_write_route_is_role_gated_or_self_service():
    ungated = []
    for path, route in _walk(app.routes):
        if not ({"POST", "PUT", "PATCH", "DELETE"} & route.methods):
            continue
        rel = path.split("/api/v1", 1)[-1]
        if _has_role_gate(route.dependant) or any(rel.startswith(p) for p in SELF_SERVICE):
            continue
        ungated.append(f"{sorted(route.methods)} {path}")
    assert not ungated, "write routes without a role gate:\n" + "\n".join(ungated)


ID = str(uuid.uuid4())
ADMIN_WRITES = [
    ("post", "/api/v1/specialties", {"name": "X"}),
    ("put", f"/api/v1/specialties/{ID}", {"name": "X"}),
    ("delete", f"/api/v1/specialties/{ID}", None),
    ("post", "/api/v1/expertises", {"name": "X"}),
    ("delete", f"/api/v1/expertises/{ID}", None),
    ("post", "/api/v1/languages", {"name": "X"}),
    ("delete", f"/api/v1/languages/{ID}", None),
    ("post", "/api/v1/quick-relief", {"name": "x", "slug": "x", "title": "x"}),
    ("delete", f"/api/v1/quick-relief/{ID}", None),
    ("delete", f"/api/v1/sessions/{ID}", None),
    ("post", "/api/v1/slot-timings", {}),
    ("delete", f"/api/v1/slot-timings/{ID}", None),
    ("post", "/api/v1/support/contacts", {"contact_type": "phone", "title": "Call"}),
    ("put", f"/api/v1/support/contacts/{ID}", {"value": "+10000000000"}),
    ("delete", f"/api/v1/support/faqs/{ID}", None),
    ("post", "/api/v1/videos/groups", {"title": "x"}),
    ("delete", f"/api/v1/videos/groups/{ID}", None),
    ("delete", f"/api/v1/videos/{ID}", None),
    ("put", f"/api/v1/support-faqs/{ID}", {"question": "q"}),
    ("delete", f"/api/v1/support-faqs/{ID}", None),
]


@pytest.mark.parametrize("method,url,body", ADMIN_WRITES)
def test_patient_cannot_write_admin_content(client, method, url, body):
    headers = auth_headers(client)
    kwargs = {"headers": headers}
    if body is not None:
        kwargs["json"] = body
    r = getattr(client, method)(url, **kwargs)
    assert r.status_code == 403, (url, r.status_code, r.text[:200])


@pytest.mark.parametrize("method,url,body", [w for w in ADMIN_WRITES if "support-faqs" in w[1]])
def test_faq_writes_need_a_login(client, method, url, body):
    kwargs = {"json": body} if body is not None else {}
    r = getattr(client, method)(url, **kwargs)
    assert r.status_code in (401, 403)
