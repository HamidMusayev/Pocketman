"""The multi-user migration must hand all single-user data to an owner account."""

import os

import bcrypt
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _alembic_cfg() -> Config:
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
    return cfg


def _upgrade(db_path: str, monkeypatch, revision: str) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "DATABASE_URL", f"sqlite:///{db_path}")
    command.upgrade(_alembic_cfg(), revision)


def test_legacy_data_is_assigned_to_owner(db_path, monkeypatch):
    _upgrade(db_path, monkeypatch, "b2f1a3c4d5e6")

    old_hash = bcrypt.hashpw(b"old1", bcrypt.gensalt()).decode()  # legacy 4-char password
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.begin() as c:
        c.execute(text(
            "INSERT INTO settings (id, password_hash, accent_color, currency_symbol, show_cents, setup_complete) "
            "VALUES (1, :h, '#2dbdb6', '₼', 0, 1)"), {"h": old_hash})
        c.execute(text("INSERT INTO accounts (id, name, type, icon, removable) VALUES (1, 'Main', 'cash', 'wallet', 0)"))
        c.execute(text("INSERT INTO categories (id, name, type, icon) VALUES (1, 'Food', 'expense', 'food')"))
        c.execute(text(
            "INSERT INTO transactions (id, type, amount, description, category_id, account_id, date) "
            "VALUES (1, 'expense', 12.5, 'lunch', 1, 1, '2026-07-01')"))
        c.execute(text(
            "INSERT INTO recurring_rules (id, description, amount, category_id, account_id, type, frequency, next_due_date) "
            "VALUES (1, 'rent', 100, 1, 1, 'expense', 'Monthly', '2026-08-01')"))
        c.execute(text(
            "INSERT INTO pending_approvals (id, recurring_rule_id, description, amount, category_id, account_id, type, due_date) "
            "VALUES (1, 1, 'rent', 100, 1, 1, 'expense', '2026-07-01')"))
    engine.dispose()

    monkeypatch.setenv("OWNER_USERNAME", "hamid_owner")
    _upgrade(db_path, monkeypatch, "head")

    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as c:
        users = c.execute(text("SELECT id, username, password_hash FROM users")).all()
        assert len(users) == 1
        owner_id, username, pw_hash = users[0]
        assert username == "hamid_owner"
        assert pw_hash == old_hash
        for table in ("accounts", "categories", "transactions", "recurring_rules", "pending_approvals", "settings"):
            rows = c.execute(text(f"SELECT user_id FROM {table}")).all()
            assert rows and all(r[0] == owner_id for r in rows), table
        s = c.execute(text("SELECT currency_symbol, accent_color FROM settings")).one()
        assert tuple(s) == ("₼", "#2dbdb6")
    engine.dispose()


def test_owner_can_log_in_and_new_users_start_empty(db_path, monkeypatch):
    """End to end: migrate legacy DB, then use the API against it."""
    test_legacy_data_is_assigned_to_owner(db_path, monkeypatch)

    from fastapi.testclient import TestClient
    from sqlalchemy.orm import sessionmaker

    from app.database import get_db
    from app.main import app

    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Session = sessionmaker(bind=engine, autoflush=False)

    def override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    try:
        with TestClient(app) as client:
            r = client.post("/api/auth/login", json={"username": "hamid_owner", "password": "old1"})
            assert r.status_code == 200
            h = {"Authorization": f"Bearer {r.json()['token']}"}
            txns = client.get("/api/transactions", headers=h).json()
            assert [(t["description"], t["amount"]) for t in txns] == [("lunch", 12.5)]
            assert client.get("/api/recurring", headers=h).json()[0]["amount"] == 100
            assert client.get("/api/settings", headers=h).json()["currency_symbol"] == "₼"

            # a second person can sign up with the same account/category names
            r2 = client.post("/api/auth/register", json={"username": "second_user", "password": "secret123"})
            assert r2.status_code == 201
            h2 = {"Authorization": f"Bearer {r2.json()['token']}"}
            assert client.get("/api/transactions", headers=h2).json() == []
            assert [a["name"] for a in client.get("/api/accounts", headers=h2).json()] == ["Main"]
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_fresh_install_creates_no_owner(db_path, monkeypatch):
    _upgrade(db_path, monkeypatch, "head")
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as c:
        assert c.execute(text("SELECT COUNT(*) FROM users")).scalar_one() == 0
    engine.dispose()


def test_money_columns_become_cents_and_downgrade_restores_floats(db_path, monkeypatch):
    test_legacy_data_is_assigned_to_owner(db_path, monkeypatch)
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as c:
        assert c.execute(text("SELECT amount FROM transactions")).scalar_one() == 1250
        assert c.execute(text("SELECT amount FROM pending_approvals")).scalar_one() == 10000
    engine.dispose()

    command.downgrade(_alembic_cfg(), "c3a9d2e4f1b7")
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as c:
        assert c.execute(text("SELECT amount FROM transactions")).scalar_one() == 12.5
    engine.dispose()
    command.upgrade(_alembic_cfg(), "head")
