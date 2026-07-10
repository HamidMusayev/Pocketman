def _seed(client):
    accounts = client.get("/api/accounts").json()
    categories = client.get("/api/categories").json()
    return accounts[0], {c["name"]: c for c in categories}


def test_create_transaction_rejects_zero_amount(auth_client):
    account, cats = _seed(auth_client)
    resp = auth_client.post(
        "/api/transactions",
        json={"type": "expense", "amount": 0, "description": "x", "category_id": cats["Food"]["id"], "account_id": account["id"], "date": "2026-07-01"},
    )
    assert resp.status_code == 422


def test_create_and_get_transaction(auth_client):
    account, cats = _seed(auth_client)
    resp = auth_client.post(
        "/api/transactions",
        json={"type": "expense", "amount": 42.5, "description": "Lunch", "category_id": cats["Dining"]["id"], "account_id": account["id"], "date": "2026-07-01"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["category_name"] == "Dining"
    assert body["account_name"] == account["name"]


def test_update_and_delete_transaction(auth_client):
    account, cats = _seed(auth_client)
    created = auth_client.post(
        "/api/transactions",
        json={"type": "expense", "amount": 10, "description": "orig", "category_id": cats["Food"]["id"], "account_id": account["id"], "date": "2026-07-01"},
    ).json()

    updated = auth_client.put(f"/api/transactions/{created['id']}", json={"description": "edited", "amount": 15})
    assert updated.status_code == 200
    assert updated.json()["description"] == "edited"
    assert updated.json()["amount"] == 15

    deleted = auth_client.delete(f"/api/transactions/{created['id']}")
    assert deleted.status_code == 204
    assert auth_client.get("/api/transactions").json() == []


def test_monthly_period_filter(auth_client):
    account, cats = _seed(auth_client)
    auth_client.post("/api/transactions", json={"type": "income", "amount": 100, "description": "june", "category_id": cats["Salary"]["id"], "account_id": account["id"], "date": "2026-06-15"})
    auth_client.post("/api/transactions", json={"type": "income", "amount": 200, "description": "july", "category_id": cats["Salary"]["id"], "account_id": account["id"], "date": "2026-07-15"})

    july = auth_client.get("/api/transactions?period=monthly&year=2026&month=7").json()
    assert len(july) == 1
    assert july[0]["description"] == "july"


def test_search_and_filters(auth_client):
    account, cats = _seed(auth_client)
    auth_client.post("/api/transactions", json={"type": "expense", "amount": 5, "description": "Coffee run", "category_id": cats["Dining"]["id"], "account_id": account["id"], "date": "2026-07-01"})
    auth_client.post("/api/transactions", json={"type": "expense", "amount": 30, "description": "Groceries", "category_id": cats["Food"]["id"], "account_id": account["id"], "date": "2026-07-02"})

    results = auth_client.get("/api/transactions?search=coffee").json()
    assert len(results) == 1
    assert results[0]["description"] == "Coffee run"

    by_cat = auth_client.get(f"/api/transactions?category_id={cats['Food']['id']}").json()
    assert len(by_cat) == 1


def test_export_csv_roundtrip_via_import(auth_client):
    account, cats = _seed(auth_client)
    auth_client.post("/api/transactions", json={"type": "income", "amount": 500, "description": "pay", "category_id": cats["Salary"]["id"], "account_id": account["id"], "date": "2026-07-01"})

    export = auth_client.get("/api/transactions/export?period=all")
    assert export.status_code == 200
    csv_text = export.text
    assert "pay" in csv_text

    # delete original, then import the exported CSV back in
    original = auth_client.get("/api/transactions").json()[0]
    auth_client.delete(f"/api/transactions/{original['id']}")
    assert auth_client.get("/api/transactions").json() == []

    files = {"file": ("export.csv", csv_text, "text/csv")}
    imported = auth_client.post("/api/transactions/import", files=files)
    assert imported.status_code == 200
    assert imported.json()["created"] == 1
    assert imported.json()["skipped"] == 0

    restored = auth_client.get("/api/transactions").json()
    assert len(restored) == 1
    assert restored[0]["description"] == "pay"


def test_import_reports_row_errors_without_failing_whole_file(auth_client):
    csv_content = (
        "Date,Type,Description,Category,Account,Amount\n"
        "2026-07-01,expense,Good row,Food,Main,12.50\n"
        "2026-07-02,bogus,Bad type,Food,Main,10\n"
        "not-a-date,expense,Bad date,Food,Main,10\n"
    )
    files = {"file": ("bad.csv", csv_content, "text/csv")}
    resp = auth_client.post("/api/transactions/import", files=files)
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] == 1
    assert body["skipped"] == 2
    assert len(body["errors"]) == 2


def test_import_auto_creates_unknown_category_and_account(auth_client):
    csv_content = (
        "Date,Type,Description,Category,Account,Amount\n"
        "2026-07-01,expense,New stuff,BrandNewCategory,BrandNewAccount,15\n"
    )
    files = {"file": ("new.csv", csv_content, "text/csv")}
    resp = auth_client.post("/api/transactions/import", files=files)
    assert resp.status_code == 200
    assert resp.json()["created"] == 1

    categories = [c["name"] for c in auth_client.get("/api/categories").json()]
    accounts = [a["name"] for a in auth_client.get("/api/accounts").json()]
    assert "BrandNewCategory" in categories
    assert "BrandNewAccount" in accounts
