"""Opening balances, notes + tags, pagination, recurring transfers/auto-approve,
savings goals and the monthly report."""

from datetime import date

from dateutil.relativedelta import relativedelta


def _cats(client):
    cats = client.get("/api/categories").json()
    return (
        next(c for c in cats if c["type"] == "expense"),
        next(c for c in cats if c["type"] == "income"),
    )


def _main(client):
    return client.get("/api/accounts").json()[0]


def _expense(client, amount, d="2026-07-05", **extra):
    exp, _ = _cats(client)
    body = {"type": "expense", "amount": amount, "description": extra.pop("description", "spend"),
            "category_id": extra.pop("category_id", exp["id"]), "account_id": _main(client)["id"], "date": d}
    body.update(extra)
    r = client.post("/api/transactions", json=body)
    assert r.status_code == 201, r.text
    return r.json()


# ---- opening balance -------------------------------------------------------

def test_opening_balance_counts_toward_net_but_not_income(auth_client):
    r = auth_client.post("/api/accounts", json={"name": "Bank", "type": "savings", "icon": "bank",
                                                "opening_balance": 1500})
    assert r.status_code == 201
    bank = r.json()
    assert bank["opening_balance"] == 1500
    assert bank["net"] == 1500
    summary = auth_client.get("/api/stats/summary?period=all").json()
    assert summary["income"] == 0

    r = auth_client.put(f"/api/accounts/{bank['id']}", json={"opening_balance": -200.5})
    assert r.json()["net"] == -200.5


def test_cumulative_balance_starts_from_opening_balances(auth_client):
    main = _main(auth_client)
    auth_client.put(f"/api/accounts/{main['id']}", json={"opening_balance": 1000})
    _expense(auth_client, 100)
    points = auth_client.get("/api/stats/cumulative-balance").json()
    assert points[-1]["balance"] == 900


# ---- notes + tags ----------------------------------------------------------

def test_note_and_tags_are_saved_and_normalized(auth_client):
    t = _expense(auth_client, 20, note="  dinner with Ali  ", tags=["#Travel", "travel", "Baku Trip"])
    assert t["note"] == "dinner with Ali"
    assert t["tags"] == ["baku-trip", "travel"]

    r = auth_client.put(f"/api/transactions/{t['id']}", json={"tags": ["work"], "note": ""})
    assert r.json()["tags"] == ["work"]
    assert r.json()["note"] is None
    # tags nobody uses any more are cleaned up
    assert [x["name"] for x in auth_client.get("/api/tags").json()] == ["work"]


def test_invalid_tags_are_rejected(auth_client):
    exp, _ = _cats(auth_client)
    for tags in (["bad!tag"], ["x" * 41], [f"t{i}" for i in range(11)]):
        r = auth_client.post("/api/transactions", json={
            "type": "expense", "amount": 1, "description": "x", "category_id": exp["id"],
            "account_id": _main(auth_client)["id"], "date": "2026-07-05", "tags": tags})
        assert r.status_code == 422, tags


def test_filter_and_search_by_tag_and_note(auth_client):
    _expense(auth_client, 10, description="taxi", tags=["travel"])
    _expense(auth_client, 30, description="hotel", tags=["travel"], note="two nights")
    _expense(auth_client, 5, description="coffee")
    rows = auth_client.get("/api/transactions?tag=travel").json()
    assert sorted(r["description"] for r in rows) == ["hotel", "taxi"]
    assert [r["description"] for r in auth_client.get("/api/transactions?search=nights").json()] == ["hotel"]
    assert auth_client.get("/api/transactions?tag=nope").json() == []

    tags = auth_client.get("/api/tags").json()
    assert tags == [{"id": tags[0]["id"], "name": "travel", "count": 2, "income": 0, "expense": 40}]


def test_delete_tag_keeps_transactions(auth_client):
    t = _expense(auth_client, 10, tags=["travel"])
    tag_id = auth_client.get("/api/tags").json()[0]["id"]
    assert auth_client.delete(f"/api/tags/{tag_id}").status_code == 204
    rows = auth_client.get("/api/transactions").json()
    assert rows[0]["id"] == t["id"] and rows[0]["tags"] == []


def test_tags_are_per_user(client, register):
    alice, bob = register("alice_01"), register("bob_0001")
    client.headers.update(alice["headers"])
    _expense(client, 10, tags=["secret"])
    client.headers.update(bob["headers"])
    assert client.get("/api/tags").json() == []
    assert client.get("/api/transactions?tag=secret").json() == []


def test_csv_round_trips_note_and_tags(auth_client):
    _expense(auth_client, 12.5, description="lunch", note="with team", tags=["work", "food-out"])
    csv_text = auth_client.get("/api/transactions/export").text
    assert csv_text.splitlines()[0].endswith("Note,Tags")
    for t in auth_client.get("/api/transactions").json():
        auth_client.delete(f"/api/transactions/{t['id']}")
    r = auth_client.post("/api/transactions/import", files={"file": ("t.csv", csv_text, "text/csv")})
    assert r.json()["created"] == 1
    row = auth_client.get("/api/transactions").json()[0]
    assert (row["amount"], row["note"], row["tags"]) == (12.5, "with team", ["food-out", "work"])


# ---- pagination ------------------------------------------------------------

def test_pagination_with_total_count(auth_client):
    for i in range(7):
        _expense(auth_client, i + 1, d=f"2026-07-{i + 1:02d}", description=f"t{i}")
    r = auth_client.get("/api/transactions?limit=3")
    assert r.headers["X-Total-Count"] == "7"
    assert [t["description"] for t in r.json()] == ["t6", "t5", "t4"]
    r = auth_client.get("/api/transactions?limit=3&offset=6")
    assert [t["description"] for t in r.json()] == ["t0"]
    assert auth_client.get("/api/transactions?limit=0").status_code == 422


# ---- recurring transfers + auto-approve ------------------------------------

def _savings(client):
    return client.post("/api/accounts", json={"name": "Savings", "type": "savings", "icon": "bank"}).json()


def test_recurring_transfer_rule_and_approval(auth_client):
    main, savings = _main(auth_client), _savings(auth_client)
    start = (date.today() - relativedelta(months=1)).isoformat()
    r = auth_client.post("/api/recurring", json={
        "description": "Save", "amount": 100, "account_id": main["id"],
        "transfer_account_id": savings["id"], "type": "transfer", "frequency": "Monthly",
        "start_date": start})
    assert r.status_code == 201, r.text
    assert r.json()["category_id"] is None
    assert r.json()["transfer_account_name"] == "Savings"

    # listing pending runs catch-up automatically
    pending = auth_client.get("/api/recurring/pending").json()
    assert len(pending) == 2 and all(p["type"] == "transfer" for p in pending)
    for p in pending:
        assert auth_client.post(f"/api/recurring/pending/{p['id']}/approve").status_code == 201
    accounts = {a["name"]: a for a in auth_client.get("/api/accounts").json()}
    assert accounts["Savings"]["net"] == 200
    assert accounts["Main"]["net"] == -200
    assert auth_client.get("/api/stats/summary?period=all").json()["expense"] == 0


def test_recurring_transfer_needs_distinct_destination(auth_client):
    main = _main(auth_client)
    for extra in ({}, {"transfer_account_id": main["id"]}):
        r = auth_client.post("/api/recurring", json={
            "description": "Save", "amount": 100, "account_id": main["id"], "type": "transfer",
            "frequency": "Monthly", **extra})
        assert r.status_code == 422


def test_recurring_income_needs_category_of_right_type(auth_client):
    exp, inc = _cats(auth_client)
    base = {"description": "Pay", "amount": 100, "account_id": _main(auth_client)["id"],
            "type": "income", "frequency": "Monthly"}
    assert auth_client.post("/api/recurring", json=base).status_code == 422
    assert auth_client.post("/api/recurring", json={**base, "category_id": exp["id"]}).status_code == 422
    assert auth_client.post("/api/recurring", json={**base, "category_id": inc["id"]}).status_code == 201


def test_auto_approve_rule_posts_transactions_directly(auth_client):
    _, inc = _cats(auth_client)
    start = (date.today() - relativedelta(months=2)).isoformat()
    r = auth_client.post("/api/recurring", json={
        "description": "Salary", "amount": 2000, "category_id": inc["id"],
        "account_id": _main(auth_client)["id"], "type": "income", "frequency": "Monthly",
        "start_date": start, "auto_approve": True})
    assert r.json()["auto_approve"] is True
    result = auth_client.post("/api/recurring/catch-up").json()
    assert result["posted"] == 3 and result["generated"] == 0 and result["pending"] == []
    assert len(auth_client.get("/api/transactions?type=income").json()) == 3
    # idempotent
    assert auth_client.post("/api/recurring/catch-up").json()["posted"] == 0


def test_switching_rule_type_keeps_it_coherent(auth_client):
    exp, _ = _cats(auth_client)
    main, savings = _main(auth_client), _savings(auth_client)
    rule = auth_client.post("/api/recurring", json={
        "description": "Rent", "amount": 500, "category_id": exp["id"], "account_id": main["id"],
        "type": "expense", "frequency": "Monthly"}).json()
    r = auth_client.put(f"/api/recurring/{rule['id']}", json={"type": "transfer"})
    assert r.status_code == 422  # no destination yet
    r = auth_client.put(f"/api/recurring/{rule['id']}",
                        json={"type": "transfer", "transfer_account_id": savings["id"]})
    assert r.status_code == 200
    assert r.json()["category_id"] is None


# ---- goals -----------------------------------------------------------------

def test_goal_lifecycle(auth_client):
    target = (date.today() + relativedelta(months=3)).isoformat()
    r = auth_client.post("/api/goals", json={"name": "Car", "target_amount": 1000, "target_date": target,
                                             "icon": "car"})
    assert r.status_code == 201
    goal = r.json()
    assert goal["pct"] == 0 and goal["remaining"] == 1000
    assert goal["months_left"] == 4
    assert goal["monthly_needed"] == 250

    goal = auth_client.post(f"/api/goals/{goal['id']}/contribute", json={"amount": 400}).json()
    assert (goal["saved_amount"], goal["pct"], goal["monthly_needed"]) == (400, 40, 150)
    assert auth_client.post(f"/api/goals/{goal['id']}/contribute", json={"amount": -500}).status_code == 422
    goal = auth_client.post(f"/api/goals/{goal['id']}/contribute", json={"amount": 700}).json()
    assert goal["completed"] is True and goal["pct"] == 100 and goal["remaining"] == 0

    r = auth_client.put(f"/api/goals/{goal['id']}", json={"target_date": None, "name": "New car"})
    assert r.json()["target_date"] is None and r.json()["monthly_needed"] is None
    assert auth_client.delete(f"/api/goals/{goal['id']}").status_code == 204
    assert auth_client.get("/api/goals").json() == []


def test_goal_validation_and_isolation(client, register):
    alice, bob = register("alice_01"), register("bob_0001")
    client.headers.update(alice["headers"])
    assert client.post("/api/goals", json={"name": "x", "target_amount": 0}).status_code == 422
    assert client.post("/api/goals", json={"name": " ", "target_amount": 5}).status_code == 422
    assert client.post("/api/goals", json={"name": "x", "target_amount": 5, "icon": "nope"}).status_code == 422
    goal = client.post("/api/goals", json={"name": "Trip", "target_amount": 5}).json()
    client.headers.update(bob["headers"])
    assert client.get("/api/goals").json() == []
    assert client.post(f"/api/goals/{goal['id']}/contribute", json={"amount": 1}).status_code == 404
    assert client.delete(f"/api/goals/{goal['id']}").status_code == 404


def test_months_until():
    from app.routers.goals import months_until

    today = date(2026, 11, 23)
    assert months_until(date(2026, 11, 30), today) == 1
    assert months_until(date(2026, 12, 1), today) == 1
    assert months_until(date(2026, 12, 23), today) == 2
    assert months_until(date(2026, 11, 1), today) == 0


# ---- monthly report --------------------------------------------------------

def test_monthly_report_compares_with_previous_month(auth_client):
    exp, inc = _cats(auth_client)
    main = _main(auth_client)
    auth_client.put(f"/api/categories/{exp['id']}", json={"budget": 50})
    _expense(auth_client, 40, d="2026-06-10")
    _expense(auth_client, 60, d="2026-07-02", description="big", tags=["home"])
    _expense(auth_client, 20, d="2026-07-03", description="small")
    auth_client.post("/api/transactions", json={"type": "income", "amount": 1000, "description": "pay",
                                                "category_id": inc["id"], "account_id": main["id"],
                                                "date": "2026-07-01"})
    r = auth_client.get("/api/stats/monthly-report?year=2026&month=7").json()
    assert r["current"]["expense"] == 80 and r["previous"]["expense"] == 40
    assert r["expense_change_pct"] == 100
    assert r["income_change_pct"] is None  # no income in June
    assert r["transaction_count"] == 3
    assert r["avg_daily_expense"] == round(80 / 31, 2)
    cat = r["categories"][0]
    assert (cat["name"], cat["amount"], cat["previous"], cat["over_budget"]) == (exp["name"], 80, 40, True)
    assert [e["description"] for e in r["top_expenses"]] == ["big", "small"]
    assert r["tags"] == [{"name": "home", "amount": 60}]
    assert auth_client.get("/api/stats/monthly-report?month=13").status_code == 422
