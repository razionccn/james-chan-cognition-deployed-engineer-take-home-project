"""Template-level tests: health, personas, spec<->app convention, transaction semantics."""
import sqlite3
from pathlib import Path

import pytest
import yaml

from app.core import db as db_module
from app.core.registry import installed_apps


def test_health_lists_installed_apps(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert isinstance(body["apps"], list)


def test_personas_are_clearly_simulated(client):
    res = client.get("/api/personas")
    assert res.status_code == 200
    body = res.json()
    assert body["simulated"] is True
    roles = {p["role"] for p in body["personas"]}
    assert roles == {"reviewer", "viewer"}


SPECS_DIR = Path(__file__).resolve().parents[2] / "specs"


@pytest.mark.parametrize("module", installed_apps(), ids=lambda m: m.APP_ID)
def test_every_installed_app_has_a_matching_spec(module):
    """Convention from AGENTS.md: specs/<app_id>.yaml exists, parses, and names the same app id."""
    path = SPECS_DIR / f"{module.APP_ID}.yaml"
    assert path.exists(), f"missing {path.relative_to(SPECS_DIR.parent)} for app '{module.APP_ID}'"
    spec = yaml.safe_load(path.read_text())
    assert spec["app"]["id"] == module.APP_ID
    assert spec["business_rules"], "spec must list business_rules"
    assert spec["acceptance_criteria"], "spec must list acceptance_criteria"


def test_transaction_takes_the_write_lock_up_front(db_path):
    """Two real connections: a competing writer must wait for an open transaction(), and the
    transaction's own read-then-write must not fail with 'database is locked'."""
    a = db_module.connect()
    b = db_module.connect()
    b.execute("PRAGMA busy_timeout = 100")
    a.execute("CREATE TABLE IF NOT EXISTS core_lock_probe (id INTEGER PRIMARY KEY, n INTEGER NOT NULL)")
    a.execute("INSERT INTO core_lock_probe (id, n) VALUES (1, 0)")
    a.commit()
    try:
        with db_module.transaction(a):
            n = a.execute("SELECT n FROM core_lock_probe WHERE id = 1").fetchone()[0]
            with pytest.raises(sqlite3.OperationalError, match="locked"):
                b.execute("UPDATE core_lock_probe SET n = 99 WHERE id = 1")
            b.rollback()
            assert a.execute("UPDATE core_lock_probe SET n = ? WHERE id = 1 AND n = ?", (n + 1, n)).rowcount == 1
        assert b.execute("SELECT n FROM core_lock_probe WHERE id = 1").fetchone()[0] == 1
        b.execute("UPDATE core_lock_probe SET n = 2 WHERE id = 1")
        b.commit()
    finally:
        a.close()
        b.close()
