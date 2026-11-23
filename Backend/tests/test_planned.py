from datetime import date, timedelta

TODAY = date.today()


def _seed(client):
    accounts = client.get("/api/accounts").json()
    categories = client.get("/api/categories").json()
    return accounts[0], {c["name"]: c for c in categories}


def _plan(client, account, cat, when, amount=500, type_="expense", **extra):
    resp = client.post(
        "/api/planned",
        json={
            "type": type_, "amount": amount, "description": "Rent",
            "category_id": cat["id"], "account_id": account["id"],
            "date": when.isoformat(), **extra,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _balance(client):
    return sum(a["net"] for a in client.get("/api/accounts").json())


def test_planned_item_stays_out_of_balance_and_transactions(auth_client):
    account, cats = _seed(auth_client)
    item = _plan(auth_client, account, cats["Housing"], TODAY + timedelta(days=3), note="May", tags=["Home"])
    assert item["recurring_rule_id"] is None
    assert item["tags"] == ["home"]
    assert auth_client.get("/api/transactions").json() == []
    assert _balance(auth_client) == 0
    listed = auth_client.get("/api/planned").json()
    assert [p["id"] for p in listed] == [item["id"]]


def test_confirm_with_changed_amount_posts_transaction(auth_client):
    account, cats = _seed(auth_client)
    item = _plan(auth_client, account, cats["Housing"], TODAY, note="flat", tags=["home"])
    resp = auth_client.post(f"/api/planned/{item['id']}/confirm", json={"amount": 480.5})
    assert resp.status_code == 201
    txns = auth_client.get("/api/transactions").json()
    assert len(txns) == 1
    t = txns[0]
    assert (t["amount"], t["date"], t["note"], t["tags"]) == (480.5, TODAY.isoformat(), "flat", ["home"])
    assert _balance(auth_client) == -480.5
    assert auth_client.get("/api/planned").json() == []


def test_confirm_without_body_uses_plan(auth_client):
    account, cats = _seed(auth_client)
    item = _plan(auth_client, account, cats["Salary"], TODAY - timedelta(days=2), amount=1000, type_="income")
    assert auth_client.post(f"/api/planned/{item['id']}/confirm").status_code == 201
    t = auth_client.get("/api/transactions").json()[0]
    assert (t["amount"], t["date"]) == (1000, (TODAY - timedelta(days=2)).isoformat())


def test_postpone_and_delete(auth_client):
    account, cats = _seed(auth_client)
    item = _plan(auth_client, account, cats["Housing"], TODAY)
    later = TODAY + timedelta(days=7)
    resp = auth_client.post(f"/api/planned/{item['id']}/postpone", json={"date": later.isoformat()})
    assert resp.status_code == 200
    assert resp.json()["due_date"] == later.isoformat()
    past = auth_client.post(
        f"/api/planned/{item['id']}/postpone", json={"date": (TODAY - timedelta(days=1)).isoformat()}
    )
    assert past.status_code == 422
    assert auth_client.delete(f"/api/planned/{item['id']}").status_code == 204
    assert auth_client.get("/api/planned").json() == []
    assert auth_client.get("/api/transactions").json() == []


def test_update_planned(auth_client):
    account, cats = _seed(auth_client)
    item = _plan(auth_client, account, cats["Housing"], TODAY + timedelta(days=1))
    resp = auth_client.put(
        f"/api/planned/{item['id']}",
        json={"amount": 520, "date": (TODAY + timedelta(days=2)).isoformat(), "tags": ["a", "b"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert (body["amount"], body["tags"]) == (520, ["a", "b"])
    bad = auth_client.put(f"/api/planned/{item['id']}", json={"category_id": cats["Salary"]["id"]})
    assert bad.status_code == 422


def test_recurring_without_auto_add_shows_up_as_planned(auth_client):
    account, cats = _seed(auth_client)
    rule = auth_client.post(
        "/api/recurring",
        json={
            "description": "Gym", "amount": 40, "category_id": cats["Fitness"]["id"],
            "account_id": account["id"], "type": "expense", "frequency": "Monthly",
            "start_date": TODAY.isoformat(),
        },
    ).json()
    listed = auth_client.get("/api/planned").json()
    assert len(listed) == 1
    assert listed[0]["recurring_rule_id"] == rule["id"]
    assert listed[0]["frequency"] == "Monthly"
    assert auth_client.post(f"/api/planned/{listed[0]['id']}/confirm", json={"amount": 45}).status_code == 201
    assert auth_client.get("/api/transactions").json()[0]["amount"] == 45


def test_forecast(auth_client):
    account, cats = _seed(auth_client)
    auth_client.put(f"/api/accounts/{account['id']}", json={"opening_balance": 1000})
    auth_client.post(
        "/api/transactions",
        json={"type": "expense", "amount": 100, "description": "Food", "category_id": cats["Food"]["id"],
              "account_id": account["id"], "date": TODAY.isoformat()},
    )
    _plan(auth_client, account, cats["Housing"], TODAY, amount=300)  # due today, still expected
    _plan(auth_client, account, cats["Salary"], TODAY, amount=50, type_="income")
    # next month: not part of this month's forecast
    _plan(auth_client, account, cats["Housing"], TODAY + timedelta(days=40), amount=999)

    f = auth_client.get("/api/planned/forecast").json()
    assert f["balance"] == 900
    assert f["planned_income"] == 50
    assert f["planned_expense"] == 300
    assert f["expected_balance"] == 650
    assert f["item_count"] == 2


def test_forecast_counts_upcoming_recurring(auth_client):
    account, cats = _seed(auth_client)
    tomorrow = TODAY + timedelta(days=1)
    auth_client.post(
        "/api/recurring",
        json={"description": "Coffee", "amount": 2, "category_id": cats["Food"]["id"],
              "account_id": account["id"], "type": "expense", "frequency": "Daily",
              "start_date": tomorrow.isoformat()},
    )
    f = auth_client.get("/api/planned/forecast").json()
    end = date.fromisoformat(f["end_date"])
    days_left = (end - TODAY).days
    assert f["planned_expense"] == 2 * days_left


def test_planned_items_are_private(client, register):
    alice = register("alice_01")
    bob = register("bob_0001")
    client.headers.update(alice["headers"])
    account, cats = _seed(client)
    item = _plan(client, account, cats["Housing"], TODAY)
    client.headers.update(bob["headers"])
    assert client.get("/api/planned").json() == []
    assert client.post(f"/api/planned/{item['id']}/confirm").status_code == 404
    assert client.post(f"/api/planned/{item['id']}/postpone", json={"date": TODAY.isoformat()}).status_code == 404
    assert client.put(f"/api/planned/{item['id']}", json={"amount": 1}).status_code == 404
    assert client.delete(f"/api/planned/{item['id']}").status_code == 404
    # and bob can't plan against alice's account
    bob_account, bob_cats = _seed(client)
    resp = client.post(
        "/api/planned",
        json={"type": "expense", "amount": 1, "description": "x", "category_id": bob_cats["Housing"]["id"],
              "account_id": account["id"], "date": TODAY.isoformat()},
    )
    assert resp.status_code == 422
    assert client.get("/api/planned/forecast").json()["planned_expense"] == 0
