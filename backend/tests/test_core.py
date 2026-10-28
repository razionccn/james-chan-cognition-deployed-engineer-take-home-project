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


@pytest.mark.parametrize("module", installed_apps(), ids=lambda m: m.APP_ID)
def test_seeded_history_is_consistent_with_seeded_records(conn, module):
    """AGENTS.md rule 7: a seeded record's updated_at equals the created_at of its newest seeded audit event.
    The audit table is found by name (*_audit_events) and joined through its declared foreign key."""
    audit_tables = [t for t in module.TABLES if t.endswith("_audit_events")]
    assert audit_tables, f"{module.APP_ID} declares no *_audit_events table"
    for audit_table in audit_tables:
        fks = conn.execute(f"PRAGMA foreign_key_list({audit_table})").fetchall()
        assert fks, f"{audit_table} has no foreign key to its entity table"
        parent, child_col, parent_col = fks[0]["table"], fks[0]["from"], fks[0]["to"]
        mismatches = conn.execute(
            f"""
            SELECT p.{parent_col}, p.updated_at, MAX(e.created_at) AS newest
            FROM {parent} p JOIN {audit_table} e ON e.{child_col} = p.{parent_col}
            GROUP BY p.{parent_col} HAVING p.updated_at != newest
            """
        ).fetchall()
        assert conn.execute(f"SELECT COUNT(*) FROM {audit_table}").fetchone()[0] > 0
        assert [tuple(r) for r in mismatches] == [], f"{module.APP_ID}: seeded updated_at disagrees with newest audit event"


@pytest.mark.parametrize("path", sorted(SPECS_DIR.glob("*.yaml")), ids=lambda p: p.name)
def test_every_spec_file_parses_with_the_core_sections(path):
    """Includes specs/TEMPLATE.yaml, so a broken template is caught before someone copies it."""
    spec = yaml.safe_load(path.read_text())
    for section in ("app", "roles", "data_model", "business_rules", "api", "pages", "seed_data", "acceptance_criteria", "non_goals"):
        assert section in spec, f"{path.name} lacks section '{section}'"
    for rule in spec["business_rules"]:
        assert rule.get("id", "").startswith("BR-") and rule.get("rule"), f"{path.name}: every business rule needs id BR-n and rule text"
