import os
import tempfile
from collections.abc import Callable, Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-0123456789"

TEST_PASSWORD = "testpass123"


@pytest.fixture(autouse=True)
def _reset_rate_limits() -> Generator[None, None, None]:
    from app.ratelimit import limiter

    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture()
def db_path() -> Generator[str, None, None]:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    os.remove(path)


@pytest.fixture()
def client(db_path: str) -> Generator[TestClient, None, None]:
    from app.database import Base, get_db
    from app.main import app

    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


@pytest.fixture()
def register(client: TestClient) -> Callable[..., dict]:
    """Register a user and return {"token", "username", "headers"}."""

    def _register(username: str = "alice_01", password: str = TEST_PASSWORD) -> dict:
        resp = client.post("/api/auth/register", json={"username": username, "password": password})
        assert resp.status_code == 201, resp.text
        token = resp.json()["token"]
        return {"token": token, "username": username, "headers": {"Authorization": f"Bearer {token}"}}

    return _register


@pytest.fixture()
def auth_client(client: TestClient, register) -> TestClient:
    """A client with one registered user and their Authorization header attached."""
    user = register()
    client.headers.update(user["headers"])
    return client
