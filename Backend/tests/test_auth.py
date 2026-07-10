def test_status_false_before_setup(client):
    resp = client.get("/api/auth/status")
    assert resp.status_code == 200
    assert resp.json() == {"setup_complete": False}


def test_setup_seeds_defaults_and_returns_token(client):
    resp = client.post("/api/auth/setup", json={"password": "testpass123"})
    assert resp.status_code == 200
    token = resp.json()["token"]
    assert token

    status_resp = client.get("/api/auth/status")
    assert status_resp.json() == {"setup_complete": True}

    accounts = client.get("/api/accounts", headers={"Authorization": f"Bearer {token}"})
    assert accounts.status_code == 200
    assert len(accounts.json()) == 1
    assert accounts.json()[0]["name"] == "Main"
    assert accounts.json()[0]["removable"] is False

    categories = client.get("/api/categories", headers={"Authorization": f"Bearer {token}"})
    assert categories.status_code == 200
    assert len(categories.json()) == 16


def test_cannot_setup_twice(client):
    client.post("/api/auth/setup", json={"password": "testpass123"})
    resp = client.post("/api/auth/setup", json={"password": "another123"})
    assert resp.status_code == 400


def test_login_wrong_password(client):
    client.post("/api/auth/setup", json={"password": "testpass123"})
    resp = client.post("/api/auth/login", json={"password": "wrong"})
    assert resp.status_code == 401


def test_login_correct_password(client):
    client.post("/api/auth/setup", json={"password": "testpass123"})
    resp = client.post("/api/auth/login", json={"password": "testpass123"})
    assert resp.status_code == 200
    assert "token" in resp.json()


def test_protected_route_rejects_missing_token(client):
    resp = client.get("/api/accounts")
    assert resp.status_code == 401


def test_protected_route_rejects_invalid_token(client):
    resp = client.get("/api/accounts", headers={"Authorization": "Bearer garbage"})
    assert resp.status_code == 401


def test_change_password(auth_client):
    resp = auth_client.post(
        "/api/auth/change-password",
        json={"current_password": "testpass123", "new_password": "newpass456"},
    )
    assert resp.status_code == 200

    login_resp = auth_client.post("/api/auth/login", json={"password": "newpass456"})
    assert login_resp.status_code == 200

    old_login = auth_client.post("/api/auth/login", json={"password": "testpass123"})
    assert old_login.status_code == 401


def test_change_password_wrong_current(auth_client):
    resp = auth_client.post(
        "/api/auth/change-password",
        json={"current_password": "wrong", "new_password": "newpass456"},
    )
    assert resp.status_code == 401
