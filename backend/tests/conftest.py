"""Shared test fixtures.

Every test gets a fresh, seeded SQLite database in a temp directory and a
FastAPI TestClient wired to it, so tests exercise the real HTTP + SQL path.
"""

import os
import sqlite3
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core import db as db_module


@pytest.fixture()
def db_path(tmp_path, monkeypatch) -> Iterator[str]:
    path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    conn = db_module.connect(path)
    db_module.init_db(conn, seed=True, reset=True)
    conn.close()
    yield str(path)


@pytest.fixture()
def conn(db_path) -> Iterator[sqlite3.Connection]:
    c = db_module.connect()
    yield c
    c.close()


@pytest.fixture()
def client(db_path) -> Iterator[TestClient]:
    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c


def as_persona(persona_id: str) -> dict[str, str]:
    """Headers for a request made as the given DEV-ONLY persona."""
    return {"X-Demo-User": persona_id}


@pytest.fixture()
def reviewer_headers() -> dict[str, str]:
    return as_persona("ana.reviewer")


@pytest.fixture()
def viewer_headers() -> dict[str, str]:
    return as_persona("vic.viewer")
