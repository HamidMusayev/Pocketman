import pytest

from tests.conftest import TEST_PASSWORD


def test_status_reports_registration(client):
    resp = client.get("/api/auth/status")
    assert resp.status_code == 200
    assert resp.json() == {"registration_enabled": True}


def test_register_seeds_defaults_and_returns_token(client):
    resp = client.post("/api/auth/register", json={"username": "alice_01", "password": TEST_PASSWORD})
    assert resp.status_code == 201
    body = resp.json()
    assert body["username"] == "alice_01"
    headers = {"Authorization": f"Bearer {body['token']}"}

    accounts = client.get("/api/accounts", headers=headers)
    assert accounts.status_code == 200
    assert len(accounts.json()) == 1
    assert accounts.json()[0]["name"] == "Main"
    assert accounts.json()[0]["removable"] is False

    categories = client.get("/api/categories", headers=headers)
    assert len(categories.json()) == 16

    me = client.get("/api/auth/me", headers=headers)
    assert me.json()["username"] == "alice_01"


@pytest.mark.parametrize(
    "username",
    ["short", "Alice_01", "alice-01", "alice 01", "əlizadə1", "a" * 33, ""],
)
def test_register_rejects_bad_usernames(client, username):
    resp = client.post("/api/auth/register", json={"username": username, "password": TEST_PASSWORD})
    assert resp.status_code == 422


@pytest.mark.parametrize(
    "password",
    ["short1a", "onlyletters", "12345678", "", "a1" * 40],
)
def test_register_rejects_bad_passwords(client, password):
    resp = client.post("/api/auth/register", json={"username": "alice_01", "password": password})
    assert resp.status_code == 422


def test_register_accepts_boundary_values(client):
    resp = client.post("/api/auth/register", json={"username": "abc_12", "password": "abcdefg1"})
    assert resp.status_code == 201


def test_duplicate_username_rejected(client, register):
    register("alice_01")
    resp = client.post("/api/auth/register", json={"username": "alice_01", "password": "other1234"})
    assert resp.status_code == 409


def test_registration_can_be_disabled(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "ALLOW_REGISTRATION", False)
    assert client.get("/api/auth/status").json() == {"registration_enabled": False}
    resp = client.post("/api/auth/register", json={"username": "alice_01", "password": TEST_PASSWORD})
    assert resp.status_code == 403


def test_login_wrong_password(client, register):
    register("alice_01")
    resp = client.post("/api/auth/login", json={"username": "alice_01", "password": "wrong1234"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Incorrect username or password"


def test_login_unknown_user_same_error(client):
    resp = client.post("/api/auth/login", json={"username": "nobody_here", "password": "wrong1234"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Incorrect username or password"


def test_login_correct_password(client, register):
    register("alice_01")
    resp = client.post("/api/auth/login", json={"username": "alice_01", "password": TEST_PASSWORD})
    assert resp.status_code == 200
    assert resp.json()["token"]


def test_login_username_is_case_insensitive_input(client, register):
    register("alice_01")
    resp = client.post("/api/auth/login", json={"username": " Alice_01 ", "password": TEST_PASSWORD})
    assert resp.status_code == 200


def test_login_is_rate_limited_per_username(client, register):
    register("alice_01")
    for _ in range(5):
        assert client.post("/api/auth/login", json={"username": "alice_01", "password": "bad12345"}).status_code == 401
    # locked out now, even with the right password
    resp = client.post("/api/auth/login", json={"username": "alice_01", "password": TEST_PASSWORD})
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers


def test_successful_login_resets_failure_count(client, register):
    register("alice_01")
    for _ in range(4):
        client.post("/api/auth/login", json={"username": "alice_01", "password": "bad12345"})
    assert client.post("/api/auth/login", json={"username": "alice_01", "password": TEST_PASSWORD}).status_code == 200
    for _ in range(4):
        assert client.post("/api/auth/login", json={"username": "alice_01", "password": "bad12345"}).status_code == 401


def test_register_is_rate_limited_per_ip(client):
    for i in range(10):
        r = client.post("/api/auth/register", json={"username": f"user_{i:03d}", "password": TEST_PASSWORD})
        assert r.status_code == 201
    r = client.post("/api/auth/register", json={"username": "user_999", "password": TEST_PASSWORD})
    assert r.status_code == 429


def test_protected_route_rejects_missing_token(client):
    assert client.get("/api/accounts").status_code == 401


def test_protected_route_rejects_invalid_token(client):
    resp = client.get("/api/accounts", headers={"Authorization": "Bearer garbage"})
    assert resp.status_code == 401


def test_token_signed_with_other_key_rejected(client, register):
    from jose import jwt

    register("alice_01")
    forged = jwt.encode({"sub": "1", "ver": 0, "typ": "access"}, "some-other-key", algorithm="HS256")
    assert client.get("/api/accounts", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_unsigned_token_rejected(client, register):
    import base64
    import json

    register("alice_01")

    def b64(d: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    token = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': '1', 'ver': 0, 'typ': 'access'})}."
    assert client.get("/api/accounts", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_token_for_deleted_user_rejected(client, register):
    from app.database import get_db
    from app.models.user import User

    user = register("alice_01")
    db = next(client.app.dependency_overrides[get_db]())
    db.query(User).delete()
    db.commit()
    db.close()
    assert client.get("/api/accounts", headers=user["headers"]).status_code == 401


def test_change_password_revokes_old_tokens(client, register):
    user = register("alice_01")
    resp = client.post(
        "/api/auth/change-password",
        headers=user["headers"],
        json={"current_password": TEST_PASSWORD, "new_password": "newpass456"},
    )
    assert resp.status_code == 200
    new_token = resp.json()["token"]

    # old token no longer works, new one does
    assert client.get("/api/accounts", headers=user["headers"]).status_code == 401
    assert client.get("/api/accounts", headers={"Authorization": f"Bearer {new_token}"}).status_code == 200

    assert client.post("/api/auth/login", json={"username": "alice_01", "password": "newpass456"}).status_code == 200
    assert client.post("/api/auth/login", json={"username": "alice_01", "password": TEST_PASSWORD}).status_code == 401


def test_change_password_wrong_current(auth_client):
    resp = auth_client.post(
        "/api/auth/change-password",
        json={"current_password": "wrong1234", "new_password": "newpass456"},
    )
    assert resp.status_code == 401


def test_change_password_enforces_rules(auth_client):
    resp = auth_client.post(
        "/api/auth/change-password",
        json={"current_password": TEST_PASSWORD, "new_password": "weak"},
    )
    assert resp.status_code == 422


def test_change_username(client, register):
    user = register("alice_01")
    register("bob_0001")
    taken = client.post(
        "/api/auth/change-username", headers=user["headers"],
        json={"new_username": "bob_0001", "password": TEST_PASSWORD},
    )
    assert taken.status_code == 409

    ok = client.post(
        "/api/auth/change-username", headers=user["headers"],
        json={"new_username": "alice_new", "password": TEST_PASSWORD},
    )
    assert ok.status_code == 200
    assert ok.json()["username"] == "alice_new"
    assert client.post("/api/auth/login", json={"username": "alice_new", "password": TEST_PASSWORD}).status_code == 200


def test_logout_all_revokes_tokens(client, register):
    user = register("alice_01")
    resp = client.post("/api/auth/logout-all", headers=user["headers"])
    assert resp.status_code == 200
    assert client.get("/api/accounts", headers=user["headers"]).status_code == 401
