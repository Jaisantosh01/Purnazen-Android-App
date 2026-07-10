def test_faq_crud(client):
    # 1. Create
    create_payload = {"question": "Test Q?", "answer": "Test A", "sort_order": 1}
    response = client.post("/api/v1/support-faqs/", json=create_payload)
    assert response.status_code == 201
    faq = response.json()
    assert faq["question"] == "Test Q?"
    assert faq["answer"] == "Test A"
    assert faq["sort_order"] == 1
    assert faq["is_active"] is True
    assert "id" in faq
    faq_id = faq["id"]

    # 2. Get All (returns all, including inactive)
    response = client.get("/api/v1/support-faqs/")
    assert response.status_code == 200
    items = response.json()
    assert any(item["id"] == faq_id for item in items)

    # 3. Update
    update_payload = {"question": "Updated Q?", "answer": "Updated A"}
    response = client.put(f"/api/v1/support-faqs/{faq_id}", json=update_payload)
    assert response.status_code == 200
    updated = response.json()
    assert updated["question"] == "Updated Q?"
    assert updated["answer"] == "Updated A"
    assert updated["id"] == faq_id

    # 4. Delete (soft-delete)
    response = client.delete(f"/api/v1/support-faqs/{faq_id}")
    assert response.status_code == 204

    # 5. Item still in list but inactive
    response = client.get("/api/v1/support-faqs/")
    deleted_item = next((item for item in response.json() if item["id"] == faq_id), None)
    assert deleted_item is not None
    assert deleted_item["is_active"] is False

    # 6. Update still works on inactive item
    response = client.put(f"/api/v1/support-faqs/{faq_id}", json={"is_active": True})
    assert response.status_code == 200
    assert response.json()["is_active"] is True
