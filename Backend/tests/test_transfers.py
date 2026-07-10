"""Transfers move money between accounts and must NOT count as income/expense."""


def _two_accounts(client):
    main = client.get("/api/accounts").json()[0]
    savings = client.post(
        "/api/accounts", json={"name": "Savings", "type": "savings", "icon": "bank"}
    ).json()
    return main, savings


def test_transfer_creation_has_no_category_and_carries_destination(auth_client):
    main, savings = _two_accounts(auth_client)
    resp = auth_client.post(
        "/api/transactions",
        json={
            "type": "transfer",
            "amount": 250,
            "description": "Move to savings",
            "account_id": main["id"],
            "transfer_account_id": savings["id"],
            "date": "2026-07-05",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["type"] == "transfer"
    assert body["category_id"] is None
    assert body["category_name"] is None
    assert body["transfer_account_id"] == savings["id"]
    assert body["transfer_account_name"] == "Savings"


def test_transfer_excluded_from_income_and_expense(auth_client):
    main, savings = _two_accounts(auth_client)
    auth_client.post(
        "/api/transactions",
        json={"type": "transfer", "amount": 500, "description": "Move", "account_id": main["id"], "transfer_account_id": savings["id"], "date": "2026-07-05"},
    )
    summary = auth_client.get("/api/stats/summary?period=all").json()
    assert summary["income"] == 0
    assert summary["expense"] == 0
    assert summary["balance"] == 0

    # cumulative balance (total net worth over time) is unaffected by transfers
    cumulative = auth_client.get("/api/stats/cumulative-balance").json()
    assert cumulative == [] or all(point["balance"] == 0 for point in cumulative)


def test_transfer_moves_balance_between_accounts_but_not_total(auth_client):
    main, savings = _two_accounts(auth_client)
    # seed the source with income so it has funds
    food = {c["name"]: c for c in auth_client.get("/api/categories").json()}
    auth_client.post(
        "/api/transactions",
        json={"type": "income", "amount": 1000, "description": "Salary", "category_id": food["Salary"]["id"], "account_id": main["id"], "date": "2026-07-01"},
    )
    auth_client.post(
        "/api/transactions",
        json={"type": "transfer", "amount": 300, "description": "Move", "account_id": main["id"], "transfer_account_id": savings["id"], "date": "2026-07-05"},
    )

    net_worth = auth_client.get("/api/stats/net-worth").json()
    by_id = {a["id"]: a for a in net_worth["accounts"]}
    assert by_id[main["id"]]["net"] == 700  # 1000 income - 300 transferred out
    assert by_id[savings["id"]]["net"] == 300  # received the transfer
    assert net_worth["total"] == 1000  # transfer nets to zero across accounts


def test_transfer_requires_distinct_accounts(auth_client):
    main, _ = _two_accounts(auth_client)
    resp = auth_client.post(
        "/api/transactions",
        json={"type": "transfer", "amount": 100, "description": "x", "account_id": main["id"], "transfer_account_id": main["id"], "date": "2026-07-05"},
    )
    assert resp.status_code == 422


def test_account_receiving_transfers_cannot_be_deleted(auth_client):
    main, savings = _two_accounts(auth_client)
    auth_client.post(
        "/api/transactions",
        json={"type": "transfer", "amount": 100, "description": "x", "account_id": main["id"], "transfer_account_id": savings["id"], "date": "2026-07-05"},
    )
    # savings is only referenced as a transfer *destination* — still protected
    resp = auth_client.delete(f"/api/accounts/{savings['id']}")
    assert resp.status_code == 409
