import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from feature_flags.app import create_app
from feature_flags.db import connect, init_schema
from feature_flags.seed import seed

REVIEWER = {"X-Demo-User": "alice.reviewer"}
VIEWER = {"X-Demo-User": "carol.viewer"}
UNKNOWN = {"X-Demo-User": "mallory.nobody"}
BASE = "/api/feature_flags"


@pytest.fixture
def db_path(tmp_path: Path) -> str:
    path = str(tmp_path / "feature_flags.db")
    conn = connect(path)
    init_schema(conn, reset=True)
    seed(conn)
    conn.close()
    return path


@pytest.fixture
def client(db_path: str):
    with TestClient(create_app(db_path)) as c:
        yield c


@pytest.fixture
def raw_db(db_path: str):
    """A separate sqlite3 connection for asserting what is really on disk."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    yield conn
    conn.close()
