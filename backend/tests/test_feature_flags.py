"""Acceptance tests for specs/feature_flags.yaml (AC-1 .. AC-9). All go through HTTP + real SQLite."""
from app.core import db as db_module
from app.main import create_app
from fastapi.testclient import TestClient

from .conftest import as_persona

BASE = "/api/feature_flags"
STAGING_ON = "FF-1002"       # checkout.new_payment_form, staging, enabled
STAGING_OFF = "FF-1005"      # onboarding.instant_kyc, staging, disabled
PRODUCTION = "FF-1003"       # checkout.new_payment_form, production
DEVELOPMENT = "FF-1001"      # checkout.new_payment_form, development
FIELDS = ("id", "name", "description", "environment", "enabled", "updated_at", "updated_by")


def _flag(client, flag_id):
    r = client.get(f"{BASE}/flags/{flag_id}")
    assert r.status_code == 200, r.text
    return r.json()


def _assert_unchanged(client, flag_id, before):
    after = _flag(client, flag_id)
    assert after["enabled"] == before["enabled"]
    assert after["updated_at"] == before["updated_at"] and after["updated_by"] == before["updated_by"]
    assert len(after["audit_events"]) == len(before["audit_events"])


def test_ac1_list_returns_all_seeded_flags(client):
    r = client.get(f"{BASE}/flags")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 14 and len(body["items"]) == 14
    for key in FIELDS:
        assert key in body["items"][0]
    assert {f["environment"] for f in body["items"]} == {"development", "staging", "production"}
    assert {f["enabled"] for f in body["items"]} == {True, False}


def test_ac2_filters_by_environment(client):
    staging = client.get(f"{BASE}/flags", params={"environment": "staging"}).json()
    assert staging["total"] == 5
    assert all(f["environment"] == "staging" for f in staging["items"])

    prod_on = client.get(f"{BASE}/flags", params={"environment": "production", "enabled": "true"}).json()
    assert [f["id"] for f in prod_on["items"]] == [PRODUCTION]

    bad = client.get(f"{BASE}/flags", params={"environment": "qa"})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "validation_error"
    bad = client.get(f"{BASE}/flags", params={"enabled": "maybe"})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "validation_error"


def test_ac3_search_by_name_or_id(client):
    by_name = client.get(f"{BASE}/flags", params={"q": "VELOCITY"}).json()
    assert by_name["total"] == 2
    assert all(f["name"] == "risk.velocity_limits" for f in by_name["items"])

    by_id = client.get(f"{BASE}/flags", params={"q": "ff-1003"}).json()
    assert [f["id"] for f in by_id["items"]] == [PRODUCTION]

    combined = client.get(f"{BASE}/flags", params={"q": "checkout", "environment": "staging"}).json()
    assert [f["id"] for f in combined["items"]] == [STAGING_ON]

    none = client.get(f"{BASE}/flags", params={"q": "does-not-exist"}).json()
    assert none["total"] == 0 and none["items"] == []


def test_ac4_reviewer_can_toggle_staging_flag(client, reviewer_headers):
    before = _flag(client, STAGING_OFF)
    assert before["enabled"] is False and before["editable"] is True
    r = client.post(f"{BASE}/flags/{STAGING_OFF}/toggle", json={"enabled": True, "reason": "QA run."}, headers=reviewer_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["enabled"] is True
    assert body["updated_at"] != before["updated_at"]
    assert body["updated_by"] == "Ana Okafor"

    # and back again, without a reason (reason is optional)
    r = client.post(f"{BASE}/flags/{STAGING_OFF}/toggle", json={"enabled": False}, headers=reviewer_headers)
    assert r.status_code == 200, r.text
    assert r.json()["enabled"] is False

    # development is editable too
    r = client.post(f"{BASE}/flags/{DEVELOPMENT}/toggle", json={"enabled": False}, headers=reviewer_headers)
    assert r.status_code == 200, r.text


def test_ac5_production_flag_update_is_rejected(client, reviewer_headers):
    before = _flag(client, PRODUCTION)
    assert before["editable"] is False
    for enabled in (True, False):
        r = client.post(f"{BASE}/flags/{PRODUCTION}/toggle", json={"enabled": enabled, "reason": "x"}, headers=reviewer_headers)
        assert r.status_code == 403, r.text
        assert r.json()["error"]["code"] == "environment_locked"
    _assert_unchanged(client, PRODUCTION, before)


def test_ac6_viewer_cannot_toggle(client, viewer_headers):
    before = _flag(client, STAGING_ON)
    for headers in (viewer_headers, {}, as_persona("nobody")):
        r = client.post(f"{BASE}/flags/{STAGING_ON}/toggle", json={"enabled": False, "reason": "x"}, headers=headers)
        assert r.status_code == 403, r.text
        assert r.json()["error"]["code"] == "forbidden"
    _assert_unchanged(client, STAGING_ON, before)


def test_ac7_toggle_persists_across_new_connection_and_app_restart(client, reviewer_headers):
    r = client.post(f"{BASE}/flags/{STAGING_ON}/toggle", json={"enabled": False, "reason": "Rollback."}, headers=reviewer_headers)
    assert r.status_code == 200, r.text

    fresh = db_module.connect()
    try:
        row = fresh.execute("SELECT enabled, updated_by FROM feature_flags WHERE id = ?", (STAGING_ON,)).fetchone()
        assert row["enabled"] == 0 and row["updated_by"] == "Ana Okafor"
    finally:
        fresh.close()

    with TestClient(create_app()) as restarted:
        detail = restarted.get(f"{BASE}/flags/{STAGING_ON}").json()
        assert detail["enabled"] is False
        listed = restarted.get(f"{BASE}/flags", params={"environment": "staging", "enabled": "false"}).json()
        assert STAGING_ON in {f["id"] for f in listed["items"]}


def test_ac8_successful_toggle_creates_exactly_one_audit_event(client, conn, reviewer_headers):
    before_count = conn.execute("SELECT COUNT(*) FROM feature_flag_audit_events WHERE flag_id = ?", (STAGING_OFF,)).fetchone()[0]
    r = client.post(f"{BASE}/flags/{STAGING_OFF}/toggle", json={"enabled": True, "reason": "Pilot."}, headers=as_persona("ben.reviewer"))
    assert r.status_code == 200, r.text
    body = r.json()

    rows = conn.execute(
        "SELECT * FROM feature_flag_audit_events WHERE flag_id = ? ORDER BY id DESC", (STAGING_OFF,)
    ).fetchall()
    assert len(rows) == before_count + 1
    ev = dict(rows[0])
    assert ev["action"] == "enable"
    assert ev["previous_enabled"] == 0 and ev["new_enabled"] == 1
    assert ev["actor_id"] == "ben.reviewer" and ev["actor_name"] == "Ben Castillo"
    assert ev["reason"] == "Pilot."
    assert ev["created_at"] == body["updated_at"]
    assert body["audit_events"][0]["id"] == ev["id"] and body["audit_events"][0]["new_enabled"] is True


def test_noop_toggle_is_rejected_with_409(client, reviewer_headers):
    before = _flag(client, STAGING_ON)
    r = client.post(f"{BASE}/flags/{STAGING_ON}/toggle", json={"enabled": before["enabled"]}, headers=reviewer_headers)
    assert r.status_code == 409, r.text
    assert r.json()["error"]["code"] == "invalid_transition"
    _assert_unchanged(client, STAGING_ON, before)


def test_unknown_flag_returns_404_and_request_validation_envelope(client, reviewer_headers):
    r = client.get(f"{BASE}/flags/FF-9999")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
    r = client.post(f"{BASE}/flags/FF-9999/toggle", json={"enabled": True}, headers=reviewer_headers)
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"

    r = client.post(f"{BASE}/flags/{STAGING_ON}/toggle", json={"enabled": "maybe"}, headers=reviewer_headers)
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"
    for loose in ("yes", "true", 1):  # StrictBool: coercible-looking values are rejected too
        r = client.post(f"{BASE}/flags/{STAGING_ON}/toggle", json={"enabled": loose}, headers=reviewer_headers)
        assert r.status_code == 422, (loose, r.text)
    r = client.post(f"{BASE}/flags/{STAGING_ON}/toggle", json={"enabled": False, "reason": "x" * 501}, headers=reviewer_headers)
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


def test_meta_exposes_environment_editability(client):
    meta = client.get(f"{BASE}/meta").json()
    assert {e["id"]: e["editable"] for e in meta["environments"]} == {"development": True, "staging": True, "production": False}
    assert meta["roles_that_can_toggle"] == ["reviewer"]


def test_concurrent_conflicting_toggles_do_not_both_succeed(client, conn, reviewer_headers, monkeypatch):
    """Simulate a stale read: a second writer flips the flag between our read and our conditional update."""
    from app.apps.feature_flags import repository, service

    real_get = repository.get_flag

    def stale_get(c, flag_id):
        flag = real_get(c, flag_id)
        if flag and flag_id == STAGING_OFF and not getattr(stale_get, "done", False):
            stale_get.done = True
            c.execute("UPDATE feature_flags SET enabled = 1 WHERE id = ?", (flag_id,))
        return flag

    monkeypatch.setattr(service.repository, "get_flag", stale_get)
    r = client.post(f"{BASE}/flags/{STAGING_OFF}/toggle", json={"enabled": True}, headers=reviewer_headers)
    assert r.status_code == 409, r.text
    assert conn.execute("SELECT COUNT(*) FROM feature_flag_audit_events WHERE flag_id = ?", (STAGING_OFF,)).fetchone()[0] == 0


def test_ac9_kyc_regression_health_lists_both_apps(client):
    assert client.get("/api/health").json()["apps"] == ["kyc", "feature_flags"]
    assert client.get("/api/kyc/cases").json()["total"] == 24


def test_competing_writer_on_a_second_connection_gets_409_not_500(client, conn, reviewer_headers):
    """Two real connections: connection B holds the write lock and flips the flag while request A is in flight.
    A must wait (busy_timeout), re-read the committed state inside its own transaction and answer 409."""
    import threading
    import time

    from app.core import db as db_module

    b = db_module.connect()
    result: dict[str, object] = {}

    def request_a():
        result["response"] = client.post(f"{BASE}/flags/{STAGING_OFF}/toggle", json={"enabled": True}, headers=reviewer_headers)

    try:
        b.execute("BEGIN IMMEDIATE")
        b.execute("UPDATE feature_flags SET enabled = 1 WHERE id = ?", (STAGING_OFF,))
        t = threading.Thread(target=request_a)
        t.start()
        time.sleep(0.3)
        assert t.is_alive(), "request A should be blocked while B holds the write lock"
        b.commit()
        t.join(timeout=10)
        assert not t.is_alive()
    finally:
        b.close()

    r = result["response"]
    assert r.status_code == 409, r.text  # type: ignore[union-attr]
    assert conn.execute("SELECT enabled FROM feature_flags WHERE id = ?", (STAGING_OFF,)).fetchone()[0] == 1
    assert conn.execute("SELECT COUNT(*) FROM feature_flag_audit_events WHERE flag_id = ?", (STAGING_OFF,)).fetchone()[0] == 0
