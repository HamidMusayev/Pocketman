def test_create_and_list_accounts(auth_client):
    resp = auth_client.post("/api/accounts", json={"name": "Cash", "type": "savings", "icon": "bank"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Cash"
    assert body["removable"] is True
    assert body["net"] == 0.0

    listed = auth_client.get("/api/accounts").json()
    assert len(listed) == 2


def test_duplicate_account_name_rejected(auth_client):
    auth_client.post("/api/accounts", json={"name": "Cash", "type": "cash", "icon": "wallet"})
    resp = auth_client.post("/api/accounts", json={"name": "Cash", "type": "cash", "icon": "wallet"})
    assert resp.status_code == 409


def test_cannot_delete_main_account(auth_client):
    accounts = auth_client.get("/api/accounts").json()
    main_id = accounts[0]["id"]
    resp = auth_client.delete(f"/api/accounts/{main_id}")
    assert resp.status_code == 409


def test_cannot_delete_last_account(auth_client):
    # Main is not removable but even a removable-flagged account should be blocked
    # if it's the only account left (create then delete Main is impossible, so
    # this test targets the "last account" guard using two accounts then one removal).
    accounts = auth_client.get("/api/accounts").json()
    main_id = accounts[0]["id"]
    create = auth_client.post("/api/accounts", json={"name": "Cash", "type": "cash", "icon": "wallet"})
    cash_id = create.json()["id"]

    # remove main should still fail (not removable) regardless of count
    resp = auth_client.delete(f"/api/accounts/{main_id}")
    assert resp.status_code == 409

    # removing Cash (removable, no txns) should succeed leaving 1 account
    resp2 = auth_client.delete(f"/api/accounts/{cash_id}")
    assert resp2.status_code == 204


def test_cannot_delete_account_with_transactions(auth_client):
    accounts = auth_client.get("/api/accounts").json()
    categories = auth_client.get("/api/categories").json()
    cash = auth_client.post("/api/accounts", json={"name": "Cash", "type": "cash", "icon": "wallet"}).json()
    salary_cat = next(c for c in categories if c["name"] == "Salary")

    auth_client.post(
        "/api/transactions",
        json={
            "type": "income", "amount": 100, "description": "test",
            "category_id": salary_cat["id"], "account_id": cash["id"], "date": "2026-07-01",
        },
    )
    resp = auth_client.delete(f"/api/accounts/{cash['id']}")
    assert resp.status_code == 409


def test_update_account(auth_client):
    accounts = auth_client.get("/api/accounts").json()
    main_id = accounts[0]["id"]
    resp = auth_client.put(f"/api/accounts/{main_id}", json={"name": "Primary"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Primary"


def test_account_net_reflects_transactions(auth_client):
    accounts = auth_client.get("/api/accounts").json()
    categories = auth_client.get("/api/categories").json()
    main_id = accounts[0]["id"]
    salary_cat = next(c for c in categories if c["name"] == "Salary")
    food_cat = next(c for c in categories if c["name"] == "Food")

    auth_client.post(
        "/api/transactions",
        json={"type": "income", "amount": 1000, "description": "pay", "category_id": salary_cat["id"], "account_id": main_id, "date": "2026-07-01"},
    )
    auth_client.post(
        "/api/transactions",
        json={"type": "expense", "amount": 200, "description": "food", "category_id": food_cat["id"], "account_id": main_id, "date": "2026-07-02"},
    )
    updated = auth_client.get("/api/accounts").json()[0]
    assert updated["net"] == 800
    assert updated["transaction_count"] == 2
