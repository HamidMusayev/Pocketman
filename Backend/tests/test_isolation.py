"""Two users must never see or touch each other's data (IDOR checks for every endpoint)."""

import pytest


@pytest.fixture()
def two_users(client, register):
    alice = register("alice_01")
    bob = register("bob_0001")
    a = alice["headers"]

    acc_a = client.get("/api/accounts", headers=a).json()[0]
    cats_a = {c["name"]: c for c in client.get("/api/categories", headers=a).json()}
    savings_a = client.post("/api/accounts", headers=a, json={"name": "Savings", "type": "savings", "icon": "bank"}).json()
    txn_a = client.post(
        "/api/transactions", headers=a,
        json={"type": "expense", "amount": 42, "description": "alice secret", "category_id": cats_a["Food"]["id"],
              "account_id": acc_a["id"], "date": "2026-07-01"},
    ).json()
    rule_a = client.post(
        "/api/recurring", headers=a,
        json={"description": "Alice rent", "amount": 500, "category_id": cats_a["Housing"]["id"],
              "account_id": acc_a["id"], "type": "expense", "frequency": "Monthly", "start_date": "2026-01-01"},
    ).json()
    client.post("/api/recurring/catch-up", headers=a)
    pending_a = client.get("/api/recurring/pending", headers=a).json()
    client.put("/api/settings", headers=a, json={"currency_symbol": "₼"})

    return {
        "a": a, "b": bob["headers"],
        "acc": acc_a, "savings": savings_a, "cat": cats_a["Food"], "txn": txn_a,
        "rule": rule_a, "pending": pending_a,
    }


def test_lists_are_scoped(client, two_users):
    b = two_users["b"]
    assert [a["name"] for a in client.get("/api/accounts", headers=b).json()] == ["Main"]
    assert client.get("/api/transactions", headers=b).json() == []
    assert client.get("/api/recurring", headers=b).json() == []
    assert client.get("/api/recurring/pending", headers=b).json() == []
    assert len(client.get("/api/categories", headers=b).json()) == 16
    # bob's catch-up must not generate anything from alice's rules
    assert client.post("/api/recurring/catch-up", headers=b).json() == {"generated": 0, "pending": []}
    export = client.get("/api/transactions/export", headers=b).text
    assert "alice secret" not in export


def test_stats_are_scoped(client, two_users):
    b = two_users["b"]
    s = client.get("/api/stats/summary?period=all", headers=b).json()
    assert s["expense"] == 0
    assert client.get("/api/stats/cumulative-balance", headers=b).json() == []
    assert client.get("/api/stats/category-breakdown?period=all", headers=b).json() == []
    assert all(p["expense"] == 0 for p in client.get("/api/stats/trend?year=2026&month=7", headers=b).json())
    summary = client.get("/api/categories/budget-summary?period=all", headers=b).json()
    assert all(c["spent"] == 0 for c in summary["categories"])


def test_settings_are_per_user(client, two_users):
    assert client.get("/api/settings", headers=two_users["a"]).json()["currency_symbol"] == "₼"
    assert client.get("/api/settings", headers=two_users["b"]).json()["currency_symbol"] == "$"


def test_cannot_modify_or_delete_other_users_rows(client, two_users):
    b, d = two_users["b"], two_users
    calls = [
        ("put", f"/api/accounts/{d['savings']['id']}", {"name": "pwned"}),
        ("delete", f"/api/accounts/{d['savings']['id']}", None),
        ("put", f"/api/categories/{d['cat']['id']}", {"name": "pwned"}),
        ("delete", f"/api/categories/{d['cat']['id']}", None),
        ("put", f"/api/transactions/{d['txn']['id']}", {"amount": 1}),
        ("delete", f"/api/transactions/{d['txn']['id']}", None),
        ("put", f"/api/recurring/{d['rule']['id']}", {"amount": 1}),
        ("delete", f"/api/recurring/{d['rule']['id']}", None),
        ("post", f"/api/recurring/pending/{d['pending'][0]['id']}/approve", None),
        ("delete", f"/api/recurring/pending/{d['pending'][0]['id']}", None),
    ]
    for method, url, body in calls:
        kwargs = {"headers": b}
        if body is not None:
            kwargs["json"] = body
        resp = getattr(client, method)(url, **kwargs)
        assert resp.status_code == 404, (method, url, resp.status_code)

    # alice's data is untouched
    a = d["a"]
    assert client.get("/api/transactions", headers=a).json()[0]["amount"] == 42
    assert {x["name"] for x in client.get("/api/accounts", headers=a).json()} == {"Main", "Savings"}
    assert len(client.get("/api/recurring/pending", headers=a).json()) == len(d["pending"])


def test_cannot_reference_other_users_account_or_category(client, two_users):
    b, d = two_users["b"], two_users
    acc_b = client.get("/api/accounts", headers=b).json()[0]
    cat_b = next(c for c in client.get("/api/categories", headers=b).json() if c["name"] == "Food")

    bad_creates = [
        {"type": "expense", "amount": 1, "description": "x", "category_id": d["cat"]["id"], "account_id": acc_b["id"], "date": "2026-07-01"},
        {"type": "expense", "amount": 1, "description": "x", "category_id": cat_b["id"], "account_id": d["acc"]["id"], "date": "2026-07-01"},
        {"type": "transfer", "amount": 1, "description": "x", "account_id": acc_b["id"], "transfer_account_id": d["acc"]["id"], "date": "2026-07-01"},
    ]
    for body in bad_creates:
        assert client.post("/api/transactions", headers=b, json=body).status_code == 422

    own = client.post(
        "/api/transactions", headers=b,
        json={"type": "expense", "amount": 1, "description": "mine", "category_id": cat_b["id"], "account_id": acc_b["id"], "date": "2026-07-01"},
    ).json()
    assert client.put(f"/api/transactions/{own['id']}", headers=b, json={"account_id": d["acc"]["id"]}).status_code == 422
    assert client.put(f"/api/transactions/{own['id']}", headers=b, json={"category_id": d["cat"]["id"]}).status_code == 422

    rule_body = {"description": "r", "amount": 1, "category_id": d["cat"]["id"], "account_id": acc_b["id"],
                 "type": "expense", "frequency": "Monthly"}
    assert client.post("/api/recurring", headers=b, json=rule_body).status_code == 422
    own_rule = client.post("/api/recurring", headers=b, json={**rule_body, "category_id": cat_b["id"]}).json()
    assert client.put(f"/api/recurring/{own_rule['id']}", headers=b, json={"account_id": d["acc"]["id"]}).status_code == 422


def test_filtering_by_other_users_ids_returns_nothing(client, two_users):
    b, d = two_users["b"], two_users
    assert client.get(f"/api/transactions?account_id={d['acc']['id']}", headers=b).json() == []
    assert client.get(f"/api/transactions?category_id={d['cat']['id']}", headers=b).json() == []


def test_same_names_allowed_for_different_users(client, two_users):
    b = two_users["b"]
    assert client.post("/api/accounts", headers=b, json={"name": "Savings", "type": "savings", "icon": "bank"}).status_code == 201


def test_csv_import_uses_only_own_accounts_and_categories(client, two_users):
    b, a = two_users["b"], two_users["a"]
    csv_text = "Date,Type,Description,Category,Account,Amount\n2026-07-02,expense,bob lunch,Food,Savings,10\n"
    resp = client.post("/api/transactions/import", headers=b, files={"file": ("t.csv", csv_text, "text/csv")})
    assert resp.json()["created"] == 1
    bob_txn = client.get("/api/transactions", headers=b).json()[0]
    bob_accounts = {x["id"] for x in client.get("/api/accounts", headers=b).json()}
    assert bob_txn["account_id"] in bob_accounts
    assert bob_txn["account_id"] != two_users["savings"]["id"]
    # nothing leaked into alice's list
    assert [t["description"] for t in client.get("/api/transactions", headers=a).json()] == ["alice secret"]


def test_import_size_limit(client, two_users, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "MAX_IMPORT_BYTES", 100)
    big = "Date,Type,Description,Category,Account,Amount\n" + "2026-07-02,expense,x,Food,Main,1\n" * 10
    resp = client.post("/api/transactions/import", headers=two_users["b"], files={"file": ("t.csv", big, "text/csv")})
    assert resp.status_code == 413


def test_csv_export_neutralises_formulas(client, two_users):
    a = two_users["a"]
    client.post(
        "/api/transactions", headers=a,
        json={"type": "expense", "amount": 1, "description": "=HYPERLINK(\"http://evil\")",
              "category_id": two_users["cat"]["id"], "account_id": two_users["acc"]["id"], "date": "2026-07-03"},
    )
    text = client.get("/api/transactions/export", headers=a).text
    assert "'=HYPERLINK" in text
