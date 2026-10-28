"""Deterministic synthetic feature flags. No real configuration or secrets."""
from __future__ import annotations

import sqlite3
from datetime import timedelta

from app.core.time import SEED_EPOCH as BASE, to_iso


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

# Historical audit events: (flag_name, environment, previous, new, actor_id, actor_name, reason).
# Each one is the flag's latest change, so it is stamped with that flag's updated_at.
_HISTORY: list[tuple[str, str, bool, bool, str, str, str]] = [
    ("checkout.new_payment_form", "staging", False, True, "ben.reviewer", "Ben Castillo", "Enable for QA regression run."),
    ("payments.realtime_rails", "staging", False, True, "ben.reviewer", "Ben Castillo", "Pilot with the payments team."),
    ("risk.velocity_limits", "staging", False, True, "ana.reviewer", "Ana Okafor", "Verify limits against synthetic traffic."),
]


def seed(conn: sqlite3.Connection) -> int:
    ids: dict[tuple[str, str], str] = {}
    updated_at: dict[str, datetime] = {}
    for index, (name, description, environment, enabled, updated_by, days_ago) in enumerate(_ROWS):
        flag_id = f"FF-{1001 + index}"
        ids[(name, environment)] = flag_id
        updated = BASE + timedelta(days=20 - days_ago, hours=index % 5)
        updated_at[flag_id] = updated
        conn.execute(
            """INSERT INTO feature_flags (id, name, description, environment, enabled, updated_at, updated_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (flag_id, name, description, environment, int(enabled), to_iso(updated), updated_by),
        )
    for name, environment, previous, new, actor_id, actor_name, reason in _HISTORY:
        flag_id = ids[(name, environment)]
        conn.execute(
            """INSERT INTO feature_flag_audit_events
                   (flag_id, action, previous_enabled, new_enabled, actor_id, actor_name, reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (flag_id, "enable" if new else "disable", int(previous), int(new),
             actor_id, actor_name, reason, to_iso(updated_at[flag_id])),
        )
    return len(_ROWS)
