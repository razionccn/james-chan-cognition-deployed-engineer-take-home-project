"""Timestamp conventions shared by every app.

All timestamps stored or returned by the API are ISO-8601, UTC, ``Z`` suffix,
second precision (e.g. ``2026-10-01T09:00:00Z``). Audit history is ordered by
``created_at DESC, id DESC`` so same-second events still have a stable order.
"""

from datetime import datetime, timezone

SEED_EPOCH = datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc)
"""Fixed reference instant for deterministic seed data."""


def to_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def utc_now_iso() -> str:
    return to_iso(datetime.now(timezone.utc))
