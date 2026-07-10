def _get_category(client, name):
    return next(c for c in client.get("/api/categories").json() if c["name"] == name)


def test_create_category(auth_client):
    resp = auth_client.post("/api/categories", json={"name": "Pets", "type": "expense", "icon": "other"})
    assert resp.status_code == 201
    assert resp.json()["budget"] is None


def test_duplicate_category_name_rejected(auth_client):
    resp = auth_client.post("/api/categories", json={"name": "Food", "type": "expense", "icon": "food"})
    assert resp.status_code == 409


def test_invalid_icon_rejected(auth_client):
    resp = auth_client.post("/api/categories", json={"name": "Pets", "type": "expense", "icon": "not-a-real-icon"})
    assert resp.status_code == 422


def test_update_budget(auth_client):
    food = _get_category(auth_client, "Food")
    resp = auth_client.put(f"/api/categories/{food['id']}", json={"budget": 300})
    assert resp.status_code == 200
    assert resp.json()["budget"] == 300


def test_cannot_delete_category_in_use(auth_client):
    food = _get_category(auth_client, "Food")
    accounts = auth_client.get("/api/accounts").json()
    auth_client.post(
        "/api/transactions",
        json={"type": "expense", "amount": 20, "description": "x", "category_id": food["id"], "account_id": accounts[0]["id"], "date": "2026-07-01"},
    )
    resp = auth_client.delete(f"/api/categories/{food['id']}")
    assert resp.status_code == 409


def test_delete_unused_category(auth_client):
    pets = auth_client.post("/api/categories", json={"name": "Pets", "type": "expense", "icon": "other"}).json()
    resp = auth_client.delete(f"/api/categories/{pets['id']}")
    assert resp.status_code == 204


def test_budget_summary_ring_math(auth_client):
    food = _get_category(auth_client, "Food")
    car = _get_category(auth_client, "Car")
    accounts = auth_client.get("/api/accounts").json()
    account_id = accounts[0]["id"]

    auth_client.put(f"/api/categories/{food['id']}", json={"budget": 100})
    auth_client.put(f"/api/categories/{car['id']}", json={"budget": 200})

    auth_client.post(
        "/api/transactions",
        json={"type": "expense", "amount": 80, "description": "groceries", "category_id": food["id"], "account_id": account_id, "date": "2026-07-01"},
    )
    auth_client.post(
        "/api/transactions",
        json={"type": "expense", "amount": 220, "description": "repair", "category_id": car["id"], "account_id": account_id, "date": "2026-07-02"},
    )

    summary = auth_client.get("/api/categories/budget-summary?period=monthly&year=2026&month=7").json()
    assert summary["budget_total"] == 300
    assert summary["spent_total"] == 300  # 80 + 220 (car over budget but still counted)
    assert summary["budgeted_count"] == 2
    assert summary["pct"] == 100

    food_item = next(c for c in summary["categories"] if c["name"] == "Food")
    assert food_item["pct_used"] == 80
    car_item = next(c for c in summary["categories"] if c["name"] == "Car")
    assert car_item["pct_used"] == 110
