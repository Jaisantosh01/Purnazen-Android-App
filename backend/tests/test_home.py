from app.models.quick_relief import QuickRelief


def seed_relief(db, slug, title, sort_order=0, is_active=True):
    db.add(
        QuickRelief(
            name=title,
            slug=slug,
            title=title,
            subtitle=f"{title} relief",
            icon_name="head-outline",
            background_color="#E8F8F2",
            text_color="#1FA77A",
            sort_order=sort_order,
            is_active=is_active,
        )
    )
    db.commit()


def test_quick_relief_empty(client):
    response = client.get("/api/v1/home/quick-relief")
    assert response.status_code == 200
    assert response.json() == {"data": []}


def test_quick_relief_returns_active_sorted(client, db_session):
    seed_relief(db_session, "headache", "Headache", sort_order=2)
    seed_relief(db_session, "neck-pain", "Neck Pain", sort_order=1)
    seed_relief(db_session, "hidden", "Hidden", sort_order=0, is_active=False)

    response = client.get("/api/v1/home/quick-relief")
    assert response.status_code == 200
    data = response.json()["data"]

    assert [item["slug"] for item in data] == ["neck-pain", "headache"]
    first = data[0]
    assert first["title"] == "Neck Pain"
    assert first["icon_name"] == "head-outline"
    assert first["background_color"] == "#E8F8F2"
    assert first["text_color"] == "#1FA77A"


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
