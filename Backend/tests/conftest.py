import os
import tempfile
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["SECRET_KEY"] = "test-secret-key"


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
def auth_client(client: TestClient) -> TestClient:
    """A client with the app already set up and an Authorization header attached."""
    resp = client.post("/api/auth/setup", json={"password": "testpass123"})
    assert resp.status_code == 200
    token = resp.json()["token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client
