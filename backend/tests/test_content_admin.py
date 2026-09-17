"""Admin management of home-screen quick relief cards and Help & Support
contacts: listing hidden rows, validation of what the patient app will open,
and re-enabling hidden rows."""
from tests.test_dashboard import setup_admin

QR = "/api/v1/quick-relief"
CONTACTS = "/api/v1/support/contacts"


def card(**kw):
    body = {"name": "Neck", "slug": "neck-pain", "title": "Neck Pain", "background_color": "#E8F8F2",
            "text_color": "#1FA77A", "sort_order": 2}
    body.update(kw)
    return body


def test_quick_relief_lifecycle(client, db_session):
    admin = setup_admin(db_session, client)
    r = client.post(QR, json=card(), headers=admin)
    assert r.status_code == 201, r.text
    cid = r.json()["data"]["id"]

    assert client.post(QR, json=card(name="Other"), headers=admin).status_code == 409

    # Hide it: gone from the patient home list, still in the admin list.
    client.put(f"{QR}/{cid}", json={"is_active": False}, headers=admin)
    home = client.get("/api/v1/home/quick-relief").json()["data"]
    assert all(c["id"] != cid for c in home)
    listed = {c["id"]: c for c in client.get(QR, headers=admin).json()["data"]}
    assert listed[cid]["is_active"] is False

    # …and it can be switched back on.
    r = client.put(f"{QR}/{cid}", json={"is_active": True, "title": "Neck & Shoulder"}, headers=admin)
    assert r.status_code == 200
    home = client.get("/api/v1/home/quick-relief").json()["data"]
    assert any(c["id"] == cid and c["title"] == "Neck & Shoulder" for c in home)


def test_quick_relief_rejects_bad_input(client, db_session):
    admin = setup_admin(db_session, client)
    for bad in (card(slug="Neck Pain"), card(background_color="green"),
                card(icon_url="http://example.com/x.png"), card(title="")):
        r = client.post(QR, json=bad, headers=admin)
        assert r.status_code in (400, 422), bad


def test_support_contact_values_are_checked_per_type(client, db_session):
    admin = setup_admin(db_session, client)
    ok = [
        {"contact_type": "email", "title": "Email us", "value": "care@purnazen.com"},
        {"contact_type": "phone", "title": "Call us", "value": "+91 98765 43210"},
        {"contact_type": "chat", "title": "Live chat", "value": None},
    ]
    for body in ok:
        assert client.post(CONTACTS, json=body, headers=admin).status_code == 201, body
    bad = [
        {"contact_type": "email", "title": "Email", "value": "not-an-email"},
        {"contact_type": "phone", "title": "Call", "value": "call me"},
        {"contact_type": "other", "title": "Site", "value": "javascript:alert(1)"},
        {"contact_type": "fax", "title": "Fax", "value": "+911234567"},
    ]
    for body in bad:
        assert client.post(CONTACTS, json=body, headers=admin).status_code in (400, 422), body


def test_changing_contact_type_rechecks_the_stored_value(client, db_session):
    admin = setup_admin(db_session, client)
    cid = client.post(CONTACTS, json={"contact_type": "phone", "title": "Call", "value": "+911234567890"},
                      headers=admin).json()["data"]["id"]
    r = client.put(f"{CONTACTS}/{cid}", json={"contact_type": "email"}, headers=admin)
    assert r.status_code == 400
    r = client.put(f"{CONTACTS}/{cid}", json={"contact_type": "email", "value": "help@purnazen.com"},
                   headers=admin)
    assert r.status_code == 200
    assert r.json()["data"]["value"] == "help@purnazen.com"


def test_hidden_contacts_are_listed_for_admin_only(client, db_session):
    admin = setup_admin(db_session, client)
    cid = client.post(CONTACTS, json={"contact_type": "email", "title": "Old", "value": "a@b.co"},
                      headers=admin).json()["data"]["id"]
    client.delete(f"{CONTACTS}/{cid}", headers=admin)
    help_ = client.get("/api/v1/support/help").json()["data"]["contacts"]
    assert all(c["id"] != cid for c in help_)
    listed = client.get(CONTACTS, headers=admin).json()["data"]
    assert any(c["id"] == cid and c["isActive"] is False for c in listed)
