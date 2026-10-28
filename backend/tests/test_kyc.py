"""Acceptance tests for specs/kyc.yaml (AC-1 .. AC-9). All go through HTTP + real SQLite."""
from app.core import db as db_module
from app.main import create_app
from fastapi.testclient import TestClient

from .conftest import as_persona

PENDING = "KYC-1001"      # Amelia Hartwell, low, pending
ESCALATED = "KYC-1013"    # Isabella Rossi, high, escalated
APPROVED = "KYC-1017"     # Noah Williams, approved (terminal)
REJECTED = "KYC-1022"     # Omar Haddad, rejected (terminal)


def _case(client, case_id):
    r = client.get(f"/api/kyc/cases/{case_id}")
    assert r.status_code == 200, r.text
    return r.json()


def test_ac1_list_returns_all_seeded_cases(client):
    r = client.get("/api/kyc/cases")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 24 and len(body["items"]) == 24
    first = body["items"][0]
    for key in ("id", "customer_name", "risk_level", "status", "submitted_at", "assigned_reviewer", "updated_at"):
        assert key in first
    assert {c["status"] for c in body["items"]} == {"pending", "approved", "rejected", "escalated"}


def test_ac2_filters_by_status_risk_and_search(client):
    high_pending = client.get("/api/kyc/cases", params={"status": "pending", "risk_level": "high"}).json()
    assert high_pending["total"] == 3
    assert all(c["status"] == "pending" and c["risk_level"] == "high" for c in high_pending["items"])

    by_name = client.get("/api/kyc/cases", params={"q": "hartwell"}).json()
    assert [c["id"] for c in by_name["items"]] == [PENDING]

    by_id = client.get("/api/kyc/cases", params={"q": "kyc-1013"}).json()
    assert [c["id"] for c in by_id["items"]] == [ESCALATED]

    bad = client.get("/api/kyc/cases", params={"status": "bogus"})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "validation_error"


def test_ac3_reviewer_can_approve_pending_case(client, reviewer_headers):
    before = _case(client, PENDING)
    r = client.post(f"/api/kyc/cases/{PENDING}/actions", json={"action": "approve", "reason": "Docs verified."}, headers=reviewer_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "approved"
    assert body["updated_at"] != before["updated_at"]
    assert body["allowed_actions"] == []


def test_ac4_invalid_transition_is_rejected_and_case_unchanged(client, reviewer_headers):
    before = _case(client, APPROVED)
    for action in ("approve", "reject", "escalate"):
        r = client.post(f"/api/kyc/cases/{APPROVED}/actions", json={"action": action, "reason": "x"}, headers=reviewer_headers)
        assert r.status_code == 409, r.text
        assert r.json()["error"]["code"] == "invalid_transition"
    # escalated -> escalate is also not allowed
    r = client.post(f"/api/kyc/cases/{ESCALATED}/actions", json={"action": "escalate", "reason": "x"}, headers=reviewer_headers)
    assert r.status_code == 409
    after = _case(client, APPROVED)
    assert after["status"] == before["status"] and after["updated_at"] == before["updated_at"]
    assert len(after["audit_events"]) == len(before["audit_events"])


def test_ac5_missing_reason_is_rejected(client, reviewer_headers):
    before = _case(client, PENDING)
    for payload in ({"action": "approve", "reason": ""}, {"action": "approve", "reason": "   "}, {"action": "approve"}):
        r = client.post(f"/api/kyc/cases/{PENDING}/actions", json=payload, headers=reviewer_headers)
        assert r.status_code == 422, r.text
        assert r.json()["error"]["code"] == "validation_error"
        assert "reason" in r.json()["error"]["message"].lower()
    after = _case(client, PENDING)
    assert after["status"] == "pending" and after["updated_at"] == before["updated_at"]
    assert after["audit_events"] == []


def test_ac6_review_persists_across_new_connection_and_app_restart(client, reviewer_headers):
    r = client.post(f"/api/kyc/cases/{PENDING}/actions", json={"action": "reject", "reason": "ID expired."}, headers=reviewer_headers)
    assert r.status_code == 200

    conn = db_module.connect()  # fresh connection to the same file
    row = conn.execute("SELECT status FROM kyc_cases WHERE id = ?", (PENDING,)).fetchone()
    conn.close()
    assert row["status"] == "rejected"

    with TestClient(create_app()) as restarted:  # simulate backend restart
        assert restarted.get(f"/api/kyc/cases/{PENDING}").json()["status"] == "rejected"


def test_ac7_successful_action_creates_exactly_one_audit_event(client, conn):
    headers = as_persona("ben.reviewer")
    before_count = conn.execute("SELECT COUNT(*) AS n FROM kyc_audit_events").fetchone()["n"]
    r = client.post(f"/api/kyc/cases/{PENDING}/actions", json={"action": "escalate", "reason": "Needs senior sign-off."}, headers=headers)
    assert r.status_code == 200
    after_count = conn.execute("SELECT COUNT(*) AS n FROM kyc_audit_events").fetchone()["n"]
    assert after_count == before_count + 1

    events = r.json()["audit_events"]
    assert len(events) == 1
    event = events[0]
    assert event["case_id"] == PENDING
    assert event["previous_status"] == "pending" and event["new_status"] == "escalated"
    assert event["action"] == "escalate"
    assert event["actor_id"] == "ben.reviewer" and event["actor_name"] == "Ben Castillo"
    assert event["reason"] == "Needs senior sign-off."
    assert event["created_at"] == r.json()["updated_at"]


def test_ac8_viewer_cannot_modify(client, viewer_headers):
    before = _case(client, PENDING)
    r = client.post(f"/api/kyc/cases/{PENDING}/actions", json={"action": "approve", "reason": "trying"}, headers=viewer_headers)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"
    # missing / unknown persona header falls back to viewer
    for headers in ({}, as_persona("nobody")):
        r = client.post(f"/api/kyc/cases/{PENDING}/actions", json={"action": "approve", "reason": "trying"}, headers=headers)
        assert r.status_code == 403
    after = _case(client, PENDING)
    assert after["status"] == "pending" and after["audit_events"] == []


def test_ac9_escalated_case_can_be_approved_or_rejected(client, reviewer_headers):
    r = client.post(f"/api/kyc/cases/{ESCALATED}/actions", json={"action": "approve", "reason": "PEP match cleared."}, headers=reviewer_headers)
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert [e["new_status"] for e in r.json()["audit_events"]] == ["approved", "escalated"]

    r = client.post("/api/kyc/cases/KYC-1014/actions", json={"action": "reject", "reason": "Confirmed sanctions hit."}, headers=reviewer_headers)
    assert r.status_code == 200 and r.json()["status"] == "rejected"


def test_unknown_case_returns_404(client, reviewer_headers):
    assert client.get("/api/kyc/cases/KYC-9999").status_code == 404
    r = client.post("/api/kyc/cases/KYC-9999/actions", json={"action": "approve", "reason": "x"}, headers=reviewer_headers)
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_meta_exposes_transitions(client):
    meta = client.get("/api/kyc/meta").json()
    assert meta["transitions"]["pending"] == ["approve", "reject", "escalate"]
    assert meta["transitions"]["escalated"] == ["approve", "reject"]
    assert meta["transitions"]["approved"] == [] and meta["transitions"]["rejected"] == []


def test_request_validation_uses_error_envelope(client, reviewer_headers):
    r = client.post(f"/api/kyc/cases/{PENDING}/actions", json={"action": "bogus", "reason": "x"}, headers=reviewer_headers)
    assert r.status_code == 422
    body = r.json()
    assert body["error"]["code"] == "validation_error" and "action" in body["error"]["message"]

    too_long = client.post(f"/api/kyc/cases/{PENDING}/actions", json={"action": "approve", "reason": "x" * 2001}, headers=reviewer_headers)
    assert too_long.status_code == 422 and too_long.json()["error"]["code"] == "validation_error"
    assert client.get("/api/kyc/cases", params={"q": "x" * 101}).status_code == 422
    assert _case(client, PENDING)["status"] == "pending"


def test_concurrent_conflicting_actions_do_not_both_succeed(client, conn, reviewer_headers, monkeypatch):
    """Simulate a reviewer whose read happened before another reviewer approved the case."""
    from app.apps.kyc import repository, service

    real_get_case = repository.get_case
    stale = dict(real_get_case(conn, PENDING))  # status == pending

    def stale_then_real(c, case_id):
        monkeypatch.setattr(service.repository, "get_case", real_get_case)
        return stale

    first = client.post(f"/api/kyc/cases/{PENDING}/actions", json={"action": "approve", "reason": "first"}, headers=as_persona("ben.reviewer"))
    assert first.status_code == 200

    monkeypatch.setattr(service.repository, "get_case", stale_then_real)
    second = client.post(f"/api/kyc/cases/{PENDING}/actions", json={"action": "reject", "reason": "second"}, headers=reviewer_headers)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "invalid_transition"

    final = _case(client, PENDING)
    assert final["status"] == "approved"
    assert [e["reason"] for e in final["audit_events"]] == ["first"]
