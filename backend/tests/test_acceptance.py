"""Acceptance criteria AC-1..AC-8 and business rules BR-1..BR-6, through HTTP and real SQLite."""
import threading

from fastapi.testclient import TestClient

from feature_flags.app import create_app
from feature_flags.seed import FLAGS

from .conftest import BASE, REVIEWER, UNKNOWN, VIEWER

FLAG_FIELDS = {"id", "name", "description", "environment", "enabled", "updated_at", "updated_by"}


def _flag(client, flag_id):
    r = client.get(f"{BASE}/flags/{flag_id}")
    assert r.status_code == 200, r.text
    return r.json()


def _db_flag(raw_db, flag_id):
    return dict(raw_db.execute("SELECT * FROM feature_flags WHERE id = ?", (flag_id,)).fetchone())


def _db_events(raw_db, flag_id):
    return [dict(r) for r in raw_db.execute(
        "SELECT * FROM feature_flag_audit_events WHERE flag_id = ? ORDER BY id", (flag_id,))]


# ---------------------------------------------------------------- AC-1
def test_ac1_list_returns_all_14_seeded_flags_with_fields(client):
    r = client.get(f"{BASE}/flags")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 14
    assert len(body["items"]) == 14
    for item in body["items"]:
        assert FLAG_FIELDS <= set(item.keys())
        assert isinstance(item["enabled"], bool)
        assert item["updated_at"].endswith("Z")
    assert {i["id"] for i in body["items"]} == {f[0] for f in FLAGS}


def test_ac1_seed_distribution_and_consistency(client, raw_db):
    items = client.get(f"{BASE}/flags").json()["items"]
    by_env = {}
    for i in items:
        by_env.setdefault(i["environment"], []).append(i)
    assert {k: len(v) for k, v in by_env.items()} == {"development": 5, "staging": 5, "production": 4}
    names_in_all = {n for n in {i["name"] for i in items}
                    if {i["environment"] for i in items if i["name"] == n} == {"development", "staging", "production"}}
    assert len(names_in_all) >= 4
    assert raw_db.execute("SELECT count(*) FROM feature_flag_audit_events").fetchone()[0] >= 3
    for row in raw_db.execute("SELECT id, updated_at FROM feature_flags"):
        newest = raw_db.execute(
            "SELECT created_at FROM feature_flag_audit_events WHERE flag_id = ? ORDER BY created_at DESC LIMIT 1",
            (row["id"],)).fetchone()
        if newest is not None:
            assert row["updated_at"] == newest["created_at"], row["id"]


# ---------------------------------------------------------------- AC-2 / BR-6
def test_ac2_environment_filter_returns_only_that_environment(client):
    r = client.get(f"{BASE}/flags", params={"environment": "staging"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 5
    assert all(i["environment"] == "staging" for i in body["items"])


def test_ac2_invalid_environment_returns_422_validation_error(client):
    r = client.get(f"{BASE}/flags", params={"environment": "prod"})
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "validation_error"
    assert "environment" in body["message"]


def test_ac2_enabled_filter(client):
    for value, expected in (("true", True), ("false", False)):
        body = client.get(f"{BASE}/flags", params={"enabled": value}).json()
        assert body["total"] > 0
        assert all(i["enabled"] is expected for i in body["items"])
    assert client.get(f"{BASE}/flags", params={"enabled": "maybe"}).status_code == 422


# ---------------------------------------------------------------- AC-3
def test_ac3_search_matches_name_or_id_case_insensitively(client):
    body = client.get(f"{BASE}/flags", params={"q": "CHECKOUT"}).json()
    assert body["total"] == 3
    assert all("checkout" in i["name"] for i in body["items"])

    body = client.get(f"{BASE}/flags", params={"q": "ff-20"}).json()
    assert body["total"] == 5
    assert all(i["id"].startswith("FF-20") for i in body["items"])

    body = client.get(f"{BASE}/flags", params={"q": "nomatch-zzz"}).json()
    assert body == {"items": [], "total": 0}


def test_ac3_search_combines_with_environment_filter(client):
    body = client.get(f"{BASE}/flags", params={"q": "checkout", "environment": "production"}).json()
    assert [i["id"] for i in body["items"]] == ["FF-3001"]


# ---------------------------------------------------------------- AC-4
def test_ac4_reviewer_toggles_staging_flag(client, raw_db):
    before = _flag(client, "FF-2002")
    assert before["enabled"] is False and before["editable"] is True
    r = client.post(f"{BASE}/flags/FF-2002/toggle", json={"enabled": True, "reason": "QA run"}, headers=REVIEWER)
    assert r.status_code == 200, r.text
    after = r.json()
    assert after["enabled"] is True
    assert after["updated_at"] != before["updated_at"]
    assert after["updated_by"] == "Alice Nguyen" != before["updated_by"]
    assert FLAG_FIELDS | {"editable", "audit_events"} <= set(after.keys())
    db = _db_flag(raw_db, "FF-2002")
    assert db["enabled"] == 1 and db["updated_by"] == "Alice Nguyen" and db["updated_at"] == after["updated_at"]


def test_ac4_reviewer_can_toggle_development_flag_without_reason(client):
    r = client.post(f"{BASE}/flags/FF-1003/toggle", json={"enabled": True}, headers=REVIEWER)
    assert r.status_code == 200, r.text
    assert r.json()["enabled"] is True
    assert r.json()["audit_events"][0]["reason"] == ""


# ---------------------------------------------------------------- AC-5 / BR-1
def test_ac5_production_flag_locked_even_for_reviewer(client, raw_db):
    before = _db_flag(raw_db, "FF-3002")
    assert before["enabled"] == 1
    r = client.post(f"{BASE}/flags/FF-3002/toggle", json={"enabled": False, "reason": "try"}, headers=REVIEWER)
    assert r.status_code == 403
    assert r.json()["code"] == "environment_locked"
    assert _db_flag(raw_db, "FF-3002") == before
    assert _db_events(raw_db, "FF-3002") == _db_events(raw_db, "FF-3002")
    assert raw_db.execute("SELECT count(*) FROM feature_flag_audit_events WHERE flag_id='FF-3002'").fetchone()[0] == 1
    assert _flag(client, "FF-3002")["editable"] is False


# ---------------------------------------------------------------- AC-6 / BR-2
def test_ac6_viewer_persona_forbidden(client, raw_db):
    before = _db_flag(raw_db, "FF-2004")
    r = client.post(f"{BASE}/flags/FF-2004/toggle", json={"enabled": False}, headers=VIEWER)
    assert r.status_code == 403
    assert r.json()["code"] == "forbidden"
    assert _db_flag(raw_db, "FF-2004") == before
    assert _db_events(raw_db, "FF-2004") == []


def test_ac6_missing_persona_header_forbidden(client, raw_db):
    before = _db_flag(raw_db, "FF-2004")
    r = client.post(f"{BASE}/flags/FF-2004/toggle", json={"enabled": False})
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    assert _db_flag(raw_db, "FF-2004") == before


def test_ac6_unknown_persona_header_forbidden(client, raw_db):
    before = _db_flag(raw_db, "FF-2004")
    r = client.post(f"{BASE}/flags/FF-2004/toggle", json={"enabled": False}, headers=UNKNOWN)
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    assert _db_flag(raw_db, "FF-2004") == before


def test_ac6_viewer_can_still_read(client):
    assert client.get(f"{BASE}/flags", headers=VIEWER).status_code == 200
    assert client.get(f"{BASE}/flags/FF-2001", headers=VIEWER).status_code == 200
    assert client.get(f"{BASE}/flags", headers=UNKNOWN).json()["total"] == 14
    assert client.get(f"{BASE}/flags").json()["total"] == 14


# ---------------------------------------------------------------- AC-7
def test_ac7_toggle_persists_across_new_app_instance(client, db_path):
    r = client.post(f"{BASE}/flags/FF-2001/toggle", json={"enabled": False, "reason": "rollback"}, headers=REVIEWER)
    assert r.status_code == 200, r.text
    updated_at = r.json()["updated_at"]

    with TestClient(create_app(db_path)) as fresh:
        again = fresh.get(f"{BASE}/flags/FF-2001").json()
    assert again["enabled"] is False
    assert again["updated_at"] == updated_at
    assert again["updated_by"] == "Alice Nguyen"
    assert again["audit_events"][0]["reason"] == "rollback"


# ---------------------------------------------------------------- AC-8 / BR-4
def test_ac8_exactly_one_audit_event_with_full_payload(client, raw_db):
    before_events = _db_events(raw_db, "FF-2002")
    r = client.post(f"{BASE}/flags/FF-2002/toggle", json={"enabled": True, "reason": "Retest async posting"},
                    headers=REVIEWER)
    assert r.status_code == 200, r.text
    after_events = _db_events(raw_db, "FF-2002")
    assert len(after_events) == len(before_events) + 1
    new = after_events[-1]
    assert new["action"] == "enable"
    assert new["previous_enabled"] == 0 and new["new_enabled"] == 1
    assert new["actor_id"] == "alice.reviewer" and new["actor_name"] == "Alice Nguyen"
    assert new["reason"] == "Retest async posting"
    assert new["created_at"] == r.json()["updated_at"]
    api_events = r.json()["audit_events"]
    assert api_events[0]["id"] == new["id"], "audit_events must be newest first"
    assert [e["created_at"] for e in api_events] == sorted((e["created_at"] for e in api_events), reverse=True)
    assert raw_db.execute("SELECT count(*) FROM feature_flag_audit_events").fetchone()[0] == 7


def test_ac8_br4_concurrent_toggles_only_one_succeeds(db_path):
    """Two writers race to flip the same flag the same way; exactly one 200, one 409, one audit row."""
    results = []
    barrier = threading.Barrier(2)

    def worker():
        with TestClient(create_app(db_path)) as c:
            barrier.wait()
            r = c.post(f"{BASE}/flags/FF-2003/toggle", json={"enabled": True}, headers=REVIEWER)
            results.append(r.status_code)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == [200, 409], results
    with TestClient(create_app(db_path)) as c:
        detail = c.get(f"{BASE}/flags/FF-2003").json()
    assert detail["enabled"] is True
    assert len(detail["audit_events"]) == 1


# ---------------------------------------------------------------- BR-3
def test_br3_same_value_rejected_with_409_and_no_audit_row(client, raw_db):
    before = _db_flag(raw_db, "FF-2001")
    assert before["enabled"] == 1
    r = client.post(f"{BASE}/flags/FF-2001/toggle", json={"enabled": True}, headers=REVIEWER)
    assert r.status_code == 409
    assert r.json()["code"] == "invalid_transition"
    assert _db_flag(raw_db, "FF-2001") == before
    assert len(_db_events(raw_db, "FF-2001")) == 1


# ---------------------------------------------------------------- BR-5
def test_br5_unknown_flag_404(client):
    r = client.get(f"{BASE}/flags/FF-9999")
    assert r.status_code == 404 and r.json()["code"] == "not_found"
    r = client.post(f"{BASE}/flags/FF-9999/toggle", json={"enabled": True}, headers=REVIEWER)
    assert r.status_code == 404 and r.json()["code"] == "not_found"


# ---------------------------------------------------------------- BR-6
def test_br6_reason_optional_and_max_500_chars(client, raw_db):
    r = client.post(f"{BASE}/flags/FF-2004/toggle", json={"enabled": False, "reason": "x" * 501}, headers=REVIEWER)
    assert r.status_code == 422 and r.json()["code"] == "validation_error"
    assert _db_flag(raw_db, "FF-2004")["enabled"] == 1
    r = client.post(f"{BASE}/flags/FF-2004/toggle", json={"enabled": False, "reason": "y" * 500}, headers=REVIEWER)
    assert r.status_code == 200, r.text
    assert r.json()["audit_events"][0]["reason"] == "y" * 500


def test_br6_body_validation(client):
    assert client.post(f"{BASE}/flags/FF-2004/toggle", json={}, headers=REVIEWER).status_code == 422
    assert client.post(f"{BASE}/flags/FF-2004/toggle", json={"enabled": "yes please"}, headers=REVIEWER).status_code == 422


# ---------------------------------------------------------------- meta
def test_meta_lists_environments_and_toggle_roles(client):
    body = client.get(f"{BASE}/meta").json()
    assert body["roles_that_can_toggle"] == ["reviewer"]
    assert {e["id"]: e["editable"] for e in body["environments"]} == {
        "development": True, "staging": True, "production": False}
