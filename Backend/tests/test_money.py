"""Money is stored as integer cents: no float drift, two decimals everywhere."""

from decimal import Decimal

import pytest

from app.money import to_money


def _expense_cat(client):
    return next(c for c in client.get("/api/categories").json() if c["type"] == "expense")


def _main(client):
    return client.get("/api/accounts").json()[0]


def test_to_money_rounds_half_up_to_cents():
    assert to_money(0.1) == Decimal("0.10")
    assert to_money("2.675") == Decimal("2.68")
    assert to_money(3) == Decimal("3.00")
    with pytest.raises(ValueError):
        to_money(float("nan"))


def test_sums_are_exact(auth_client):
    cat, main = _expense_cat(auth_client), _main(auth_client)
    for amount in (0.1, 0.2):
        r = auth_client.post(
            "/api/transactions",
            json={"type": "expense", "amount": amount, "description": "x", "category_id": cat["id"],
                  "account_id": main["id"], "date": "2026-07-05"},
        )
        assert r.status_code == 201
    summary = auth_client.get("/api/stats/summary?period=all").json()
    assert summary["expense"] == 0.3  # with floats this would be 0.30000000000000004
    assert _main(auth_client)["net"] == -0.3


def test_amount_is_rounded_to_cents(auth_client):
    cat, main = _expense_cat(auth_client), _main(auth_client)
    r = auth_client.post(
        "/api/transactions",
        json={"type": "expense", "amount": "12.345", "description": "x", "category_id": cat["id"],
              "account_id": main["id"], "date": "2026-07-05"},
    )
    assert r.status_code == 201
    assert r.json()["amount"] == 12.35


def test_non_numeric_amount_is_rejected(auth_client):
    cat, main = _expense_cat(auth_client), _main(auth_client)
    for bad in ("abc", True, 0, -5, 1e13):
        r = auth_client.post(
            "/api/transactions",
            json={"type": "expense", "amount": bad, "description": "x", "category_id": cat["id"],
                  "account_id": main["id"], "date": "2026-07-05"},
        )
        assert r.status_code == 422, bad


def test_budget_is_exact(auth_client):
    cat = _expense_cat(auth_client)
    r = auth_client.put(f"/api/categories/{cat['id']}", json={"budget": 99.99})
    assert r.status_code == 200
    assert r.json()["budget"] == 99.99
