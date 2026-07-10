def _seed(client):
    accounts = client.get("/api/accounts").json()
    categories = client.get("/api/categories").json()
    return accounts[0], {c["name"]: c for c in categories}


def _add_fixture_transactions(client, account, cats):
    txns = [
        ("income", 3000, "Salary", cats["Salary"]["id"], "2026-07-01"),
        ("expense", 300, "Rent share", cats["Housing"]["id"], "2026-07-02"),
        ("expense", 200, "Groceries", cats["Food"]["id"], "2026-07-03"),
        ("expense", 100, "Gas", cats["Fuel"]["id"], "2026-07-04"),
    ]
    for type_, amount, desc, cat_id, d in txns:
        client.post(
            "/api/transactions",
            json={"type": type_, "amount": amount, "description": desc, "category_id": cat_id, "account_id": account["id"], "date": d},
        )


def test_summary_matches_hand_computed_fixture(auth_client):
    account, cats = _seed(auth_client)
    _add_fixture_transactions(auth_client, account, cats)

    resp = auth_client.get("/api/stats/summary?period=monthly&year=2026&month=7")
    assert resp.status_code == 200
    body = resp.json()
    assert body["income"] == 3000
    assert body["expense"] == 600
    assert body["balance"] == 2400
    assert body["savings_rate"] == 80


def test_summary_zero_income_no_division_error(auth_client):
    account, cats = _seed(auth_client)
    auth_client.post(
        "/api/transactions",
        json={"type": "expense", "amount": 50, "description": "x", "category_id": cats["Food"]["id"], "account_id": account["id"], "date": "2026-07-01"},
    )
    resp = auth_client.get("/api/stats/summary?period=monthly&year=2026&month=7")
    assert resp.json()["savings_rate"] == 0


def test_category_breakdown_sorted_and_percentages(auth_client):
    account, cats = _seed(auth_client)
    _add_fixture_transactions(auth_client, account, cats)

    resp = auth_client.get("/api/stats/category-breakdown?period=monthly&year=2026&month=7&type=expense")
    body = resp.json()
    # Housing 300, Food 200, Fuel 100 -> sorted descending
    assert [c["name"] for c in body] == ["Housing", "Food", "Fuel"]
    assert body[0]["pct"] == 50  # 300/600


def test_trend_labels_and_totals(auth_client):
    account, cats = _seed(auth_client)
    _add_fixture_transactions(auth_client, account, cats)

    resp = auth_client.get("/api/stats/trend?months=3&year=2026&month=7")
    body = resp.json()
    assert [p["label"] for p in body] == ["May", "Jun", "Jul"]
    july = body[-1]
    assert july["income"] == 3000
    assert july["expense"] == 600


def test_cumulative_balance_running_total(auth_client):
    account, cats = _seed(auth_client)
    auth_client.post("/api/transactions", json={"type": "income", "amount": 100, "description": "a", "category_id": cats["Salary"]["id"], "account_id": account["id"], "date": "2026-07-01"})
    auth_client.post("/api/transactions", json={"type": "expense", "amount": 40, "description": "b", "category_id": cats["Food"]["id"], "account_id": account["id"], "date": "2026-07-02"})

    resp = auth_client.get("/api/stats/cumulative-balance")
    body = resp.json()
    assert body[0]["balance"] == 100
    assert body[1]["balance"] == 60


def test_top_categories_respects_limit(auth_client):
    account, cats = _seed(auth_client)
    _add_fixture_transactions(auth_client, account, cats)
    resp = auth_client.get("/api/stats/top-categories?period=monthly&year=2026&month=7&limit=2")
    assert len(resp.json()) == 2


def test_net_worth_totals_across_accounts(auth_client):
    account, cats = _seed(auth_client)
    cash = auth_client.post("/api/accounts", json={"name": "Cash", "type": "savings", "icon": "bank"}).json()
    auth_client.post("/api/transactions", json={"type": "income", "amount": 500, "description": "a", "category_id": cats["Salary"]["id"], "account_id": account["id"], "date": "2026-07-01"})
    auth_client.post("/api/transactions", json={"type": "income", "amount": 1000, "description": "b", "category_id": cats["Salary"]["id"], "account_id": cash["id"], "date": "2026-07-01"})

    resp = auth_client.get("/api/stats/net-worth")
    body = resp.json()
    assert body["total"] == 1500
    assert len(body["accounts"]) == 2
