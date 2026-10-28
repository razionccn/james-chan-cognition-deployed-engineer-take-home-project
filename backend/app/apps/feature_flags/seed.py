"""Deterministic synthetic feature flags. No real configuration or secrets."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone

BASE = datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


# (name, description)
_FLAGS: list[tuple[str, str]] = [
    ("checkout.new_payment_form", "Redesigned card entry form with inline validation and wallet buttons."),
    ("onboarding.instant_kyc", "Skip manual document upload for low-risk individual sign-ups."),
    ("payments.realtime_rails", "Route eligible transfers over instant payment rails instead of batch ACH."),
    ("dashboard.v2_charts", "New charting library on the merchant dashboard."),
]

# (name, description, environment, enabled, updated_by, days_ago)
_ROWS: list[tuple[str, str, str, bool, str, int]] = []
for name, description in _FLAGS:
    _ROWS += [
        (name, description, "development", True, "Ana Okafor", 3),
        (name, description, "staging", name in ("checkout.new_payment_form", "payments.realtime_rails"), "Ben Castillo", 5),
        (name, description, "production", name == "checkout.new_payment_form", "release-bot", 9),
    ]
_ROWS += [
    ("risk.velocity_limits", "Per-customer transaction velocity limits enforced at authorization time.", "development", False, "Ana Okafor", 1),
    ("risk.velocity_limits", "Per-customer transaction velocity limits enforced at authorization time.", "staging", True, "Ana Okafor", 2),
]

# Historical audit events: (flag_name, environment, previous, new, actor_id, actor_name, reason, days_ago)
_HISTORY: list[tuple[str, str, bool, bool, str, str, str, int]] = [
    ("checkout.new_payment_form", "staging", False, True, "ben.reviewer", "Ben Castillo", "Enable for QA regression run.", 5),
    ("payments.realtime_rails", "staging", False, True, "ben.reviewer", "Ben Castillo", "Pilot with the payments team.", 5),
    ("risk.velocity_limits", "staging", False, True, "ana.reviewer", "Ana Okafor", "Verify limits against synthetic traffic.", 2),
]


def seed(conn: sqlite3.Connection) -> int:
    ids: dict[tuple[str, str], str] = {}
    for index, (name, description, environment, enabled, updated_by, days_ago) in enumerate(_ROWS):
        flag_id = f"FF-{1001 + index}"
        ids[(name, environment)] = flag_id
        updated = BASE + timedelta(days=20 - days_ago, hours=index % 5)
        conn.execute(
            """INSERT INTO feature_flags (id, name, description, environment, enabled, updated_at, updated_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (flag_id, name, description, environment, int(enabled), _iso(updated), updated_by),
        )
    for name, environment, previous, new, actor_id, actor_name, reason, days_ago in _HISTORY:
        acted_at = BASE + timedelta(days=20 - days_ago)
        conn.execute(
            """INSERT INTO feature_flag_audit_events
                   (flag_id, action, previous_enabled, new_enabled, actor_id, actor_name, reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (ids[(name, environment)], "enable" if new else "disable", int(previous), int(new),
             actor_id, actor_name, reason, _iso(acted_at)),
        )
    return len(_ROWS)
