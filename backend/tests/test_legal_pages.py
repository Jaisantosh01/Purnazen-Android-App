"""Public legal pages: HTML, no auth, stable URLs.

Play Console needs a privacy policy a reviewer can open in a browser without
logging in, and a data-deletion URL reachable without installing the app. These
used to exist only as JSON from `/api/v1/content-pages/{type}`.
"""
import uuid

from app.models.content_page import ContentPage
from app.models.role import Role
from app.models.support_contact import SupportContact


def _seed_page(db, content_type, title, content, role_name="patient"):
    role = db.query(Role).filter_by(name=role_name).first()
    page = ContentPage(
        id=uuid.uuid4(),
        type=content_type,
        role_id=role.id,
        title=title,
        content=content,
        version="1.0",
        is_active=True,
    )
    db.add(page)
    db.commit()
    return page


def test_privacy_renders_html_without_auth(client, db_session):
    _seed_page(
        db_session,
        "privacy",
        "Privacy Policy",
        "# What we collect\n\nWe collect your **email address**.\n\n- Face scans\n- Tongue scans\n",
    )
    res = client.get("/legal/privacy")  # no Authorization header
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/html")
    body = res.text
    assert "<h2>What we collect</h2>" in body
    assert "<strong>email address</strong>" in body
    assert "<li>Face scans</li>" in body
    assert "Privacy Policy" in body


def test_terms_renders_html_without_auth(client, db_session):
    _seed_page(db_session, "terms", "Terms of Use", "Use the app sensibly.")
    res = client.get("/legal/terms")
    assert res.status_code == 200
    assert "<p>Use the app sensibly.</p>" in res.text


def test_page_content_is_escaped(client, db_session):
    """These pages are public, unauthenticated, and render database content."""
    _seed_page(db_session, "privacy", "Privacy Policy", "<script>alert(1)</script>")
    body = client.get("/legal/privacy").text
    assert "<script>alert(1)</script>" not in body
    assert "&lt;script&gt;" in body


def test_missing_page_is_a_readable_404(client, db_session):
    res = client.get("/legal/terms")
    assert res.status_code == 404
    assert res.headers["content-type"].startswith("text/html")
    assert "not been published yet" in res.text


def test_delete_account_page_states_what_is_kept(client, db_session):
    res = client.get("/legal/delete-account")
    assert res.status_code == 200
    body = res.text
    assert "30 days" in body                 # disclosed turnaround
    assert "Clinical records" in body        # what is retained
    assert "Razorpay" in body                # and who holds payment data


def test_delete_account_page_uses_the_configured_support_email(client, db_session):
    db_session.add(
        SupportContact(
            contact_type="email", title="Email us",
            value="help@example.com", is_active=True, sort_order=0,
        )
    )
    db_session.commit()
    body = client.get("/legal/delete-account").text
    assert "mailto:help@example.com" in body


def test_legal_index_links_all_three(client, db_session):
    body = client.get("/legal").text
    for path in ("/legal/privacy", "/legal/terms", "/legal/delete-account"):
        assert path in body
