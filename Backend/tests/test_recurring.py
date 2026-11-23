from datetime import date

from app.services.recurring import advance_date, run_catch_up


def _seed(client):
    accounts = client.get("/api/accounts").json()
    categories = client.get("/api/categories").json()
    return accounts[0], {c["name"]: c for c in categories}


def test_advance_date_monthly_handles_month_end():
    assert advance_date(date(2026, 1, 31), "Monthly") == date(2026, 2, 28)


def test_advance_date_all_frequencies():
    d = date(2026, 1, 1)
    assert advance_date(d, "Daily") == date(2026, 1, 2)
    assert advance_date(d, "Weekly") == date(2026, 1, 8)
    assert advance_date(d, "Monthly") == date(2026, 2, 1)
    assert advance_date(d, "Yearly") == date(2027, 1, 1)


def test_create_recurring_rule(auth_client):
    account, cats = _seed(auth_client)
    resp = auth_client.post(
        "/api/recurring",
        json={
            "description": "Netflix", "amount": 15.99, "category_id": cats["Subscriptions"]["id"],
            "account_id": account["id"], "type": "expense", "frequency": "Monthly",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["next_due_date"] is not None


def test_catch_up_generates_only_due_occurrences(auth_client):
    account, cats = _seed(auth_client)
    auth_client.post(
        "/api/recurring",
        json={
            "description": "Rent", "amount": 2600, "category_id": cats["Housing"]["id"],
            "account_id": account["id"], "type": "expense", "frequency": "Monthly",
            "start_date": "2026-04-04",
        },
    )
    resp = auth_client.post("/api/recurring/catch-up")
    assert resp.status_code == 200
    body = resp.json()
    assert body["generated"] >= 1
    for p in body["pending"]:
        assert p["description"] == "Rent"


def test_catch_up_is_idempotent(auth_client):
    account, cats = _seed(auth_client)
    auth_client.post(
        "/api/recurring",
        json={
            "description": "Spotify", "amount": 10.99, "category_id": cats["Subscriptions"]["id"],
            "account_id": account["id"], "type": "expense", "frequency": "Monthly",
            "start_date": "2026-01-04",
        },
    )
    first = auth_client.post("/api/recurring/catch-up").json()
    assert first["generated"] > 0
    second = auth_client.post("/api/recurring/catch-up").json()
    assert second["generated"] == 0


def test_catch_up_engine_exact_occurrence_count(auth_client):
    """Unit-level check of the pure engine function, independent of real 'today'."""
    from app.database import get_db

    # Use the app's overridden session by hitting a private helper via HTTP setup,
    # then call run_catch_up directly against the same test DB through a fresh session.
    account, cats = _seed(auth_client)
    rule_resp = auth_client.post(
        "/api/recurring",
        json={
            "description": "Gym", "amount": 60, "category_id": cats["Fitness"]["id"],
            "account_id": account["id"], "type": "expense", "frequency": "Monthly",
            "start_date": "2026-01-15",
        },
    ).json()

    db_gen = auth_client.app.dependency_overrides[get_db]()
    db = next(db_gen)
    try:
        user_id = auth_client.get("/api/auth/me").json()["id"]
        generated = run_catch_up(db, user_id, today=date(2026, 4, 15))
        # Jan 15, Feb 15, Mar 15, Apr 15 = 4 occurrences
        assert len(generated) == 4
        dates = sorted(p.due_date for p in generated)
        assert dates == [date(2026, 1, 15), date(2026, 2, 15), date(2026, 3, 15), date(2026, 4, 15)]
    finally:
        db.close()


def test_approve_pending_creates_transaction_dated_occurrence(auth_client):
    account, cats = _seed(auth_client)
    auth_client.post(
        "/api/recurring",
        json={
            "description": "Netflix", "amount": 15.99, "category_id": cats["Subscriptions"]["id"],
            "account_id": account["id"], "type": "expense", "frequency": "Monthly",
            "start_date": "2026-01-04",
        },
    )
    catch_up = auth_client.post("/api/recurring/catch-up").json()
    first_pending = catch_up["pending"][0]

    approve_resp = auth_client.post(f"/api/recurring/pending/{first_pending['id']}/approve")
    assert approve_resp.status_code == 201

    txns = auth_client.get("/api/transactions").json()
    matching = [t for t in txns if t["description"] == "Netflix"]
    assert len(matching) == 1
    assert matching[0]["date"] == first_pending["due_date"]

    remaining_pending = auth_client.get("/api/recurring/pending").json()
    assert all(p["id"] != first_pending["id"] for p in remaining_pending)


def test_dismiss_pending_does_not_create_transaction(auth_client):
    account, cats = _seed(auth_client)
    auth_client.post(
        "/api/recurring",
        json={
            "description": "Netflix", "amount": 15.99, "category_id": cats["Subscriptions"]["id"],
            "account_id": account["id"], "type": "expense", "frequency": "Monthly",
            "start_date": "2026-01-04",
        },
    )
    catch_up = auth_client.post("/api/recurring/catch-up").json()
    first_pending = catch_up["pending"][0]

    dismiss_resp = auth_client.delete(f"/api/recurring/pending/{first_pending['id']}")
    assert dismiss_resp.status_code == 204
    assert auth_client.get("/api/transactions").json() == []
