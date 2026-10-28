"""Deterministic seed data: 14 flags (5 dev, 5 staging, 4 prod) plus historical audit events.

Every flag's updated_at equals the created_at of its newest audit event (or the seed
baseline timestamp when it has no history)."""
import sqlite3
from typing import List, Tuple

SEED_ACTOR = "seed"
SEED_ACTOR_NAME = "Seed script"
BASELINE = "2025-01-06T09:00:00Z"

# (id, name, description, environment, enabled)
FLAGS: List[Tuple[str, str, str, str, bool]] = [
    # development (5)
    ("FF-1001", "checkout.new_payment_form", "New card-entry form for checkout.", "development", True),
    ("FF-1002", "ledger.async_posting", "Post ledger entries asynchronously via the queue.", "development", True),
    ("FF-1003", "kyc.document_ocr", "OCR identity documents during KYC onboarding.", "development", False),
    ("FF-1004", "payments.instant_payouts", "Instant payouts for eligible merchants.", "development", True),
    ("FF-1005", "dev.debug_toolbar", "Show the debug toolbar in the web app.", "development", False),
    # staging (5)
    ("FF-2001", "checkout.new_payment_form", "New card-entry form for checkout.", "staging", True),
    ("FF-2002", "ledger.async_posting", "Post ledger entries asynchronously via the queue.", "staging", False),
    ("FF-2003", "kyc.document_ocr", "OCR identity documents during KYC onboarding.", "staging", False),
    ("FF-2004", "payments.instant_payouts", "Instant payouts for eligible merchants.", "staging", True),
    ("FF-2005", "reports.monthly_statement_v2", "Redesigned monthly statement PDF.", "staging", True),
    # production (4)
    ("FF-3001", "checkout.new_payment_form", "New card-entry form for checkout.", "production", False),
    ("FF-3002", "ledger.async_posting", "Post ledger entries asynchronously via the queue.", "production", True),
    ("FF-3003", "kyc.document_ocr", "OCR identity documents during KYC onboarding.", "production", False),
    ("FF-3004", "payments.instant_payouts", "Instant payouts for eligible merchants.", "production", True),
]

# (flag_id, action, previous, new, actor_id, actor_name, reason, created_at) - oldest first
AUDIT_EVENTS: List[Tuple[str, str, bool, bool, str, str, str, str]] = [
    ("FF-1001", "enable", False, True, "alice.reviewer", "Alice Nguyen", "Start dev testing of the new form.", "2025-01-08T10:15:00Z"),
    ("FF-2001", "enable", False, True, "alice.reviewer", "Alice Nguyen", "Promote to staging for QA.", "2025-01-10T14:30:00Z"),
    ("FF-2002", "enable", False, True, "bob.reviewer", "Bob Okafor", "Load test async posting.", "2025-01-12T08:00:00Z"),
    ("FF-2002", "disable", True, False, "bob.reviewer", "Bob Okafor", "Queue backlog during load test; rolling back.", "2025-01-12T11:45:00Z"),
    ("FF-3002", "enable", False, True, "release-bot", "Release process", "Release 2025.01.2", "2025-01-15T16:00:00Z"),
    ("FF-2005", "enable", False, True, "alice.reviewer", "Alice Nguyen", "", "2025-01-20T09:30:00Z"),
]


def seed(conn: sqlite3.Connection) -> None:
    newest = {}
    for flag_id, _action, _prev, _new, actor_id, actor_name, _reason, created_at in AUDIT_EVENTS:
        current = newest.get(flag_id)
        if current is None or created_at > current[0]:
            newest[flag_id] = (created_at, actor_name)

    conn.execute("BEGIN")
    try:
        conn.execute("DELETE FROM feature_flag_audit_events")
        conn.execute("DELETE FROM feature_flags")
        for flag_id, name, description, environment, enabled in FLAGS:
            updated_at, updated_by = newest.get(flag_id, (BASELINE, SEED_ACTOR_NAME))
            conn.execute(
                "INSERT INTO feature_flags (id, name, description, environment, enabled, updated_at, updated_by)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (flag_id, name, description, environment, int(enabled), updated_at, updated_by),
            )
        for flag_id, action, prev, new, actor_id, actor_name, reason, created_at in AUDIT_EVENTS:
            conn.execute(
                "INSERT INTO feature_flag_audit_events"
                " (flag_id, action, previous_enabled, new_enabled, actor_id, actor_name, reason, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (flag_id, action, int(prev), int(new), actor_id, actor_name, reason, created_at),
            )
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
