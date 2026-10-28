"""SQL access for feature flags and their audit events. No business logic here."""
from __future__ import annotations

import sqlite3
from typing import Any


def _row_to_flag(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    data["enabled"] = bool(data["enabled"])
    return data


def _row_to_event(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    data["previous_enabled"] = bool(data["previous_enabled"])
    data["new_enabled"] = bool(data["new_enabled"])
    return data


def list_flags(
    conn: sqlite3.Connection, *, q: str | None, environment: str | None, enabled: bool | None
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if q:
        clauses.append("(lower(name) LIKE ? OR lower(id) LIKE ?)")
        like = f"%{q.strip().lower()}%"
        params += [like, like]
    if environment:
        clauses.append("environment = ?")
        params.append(environment)
    if enabled is not None:
        clauses.append("enabled = ?")
        params.append(int(enabled))
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = conn.execute(
        f"""SELECT * FROM feature_flags {where}
            ORDER BY name ASC,
                     CASE environment WHEN 'development' THEN 0 WHEN 'staging' THEN 1 ELSE 2 END""",
        params,
    ).fetchall()
    return [_row_to_flag(r) for r in rows]


def get_flag(conn: sqlite3.Connection, flag_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM feature_flags WHERE id = ?", (flag_id,)).fetchone()
    return _row_to_flag(row) if row else None


def list_audit_events(conn: sqlite3.Connection, flag_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM feature_flag_audit_events WHERE flag_id = ? ORDER BY created_at DESC, id DESC", (flag_id,)
    ).fetchall()
    return [_row_to_event(r) for r in rows]


def update_enabled(
    conn: sqlite3.Connection, flag_id: str, enabled: bool, updated_at: str, updated_by: str, *, expected_enabled: bool
) -> int:
    """Conditional update: only succeeds if the row still has ``expected_enabled``. Returns rows changed."""
    cur = conn.execute(
        "UPDATE feature_flags SET enabled = ?, updated_at = ?, updated_by = ? WHERE id = ? AND enabled = ?",
        (int(enabled), updated_at, updated_by, flag_id, int(expected_enabled)),
    )
    return cur.rowcount


def insert_audit_event(
    conn: sqlite3.Connection,
    *,
    flag_id: str,
    action: str,
    previous_enabled: bool,
    new_enabled: bool,
    actor_id: str,
    actor_name: str,
    reason: str,
    created_at: str,
) -> int:
    cur = conn.execute(
        """INSERT INTO feature_flag_audit_events
               (flag_id, action, previous_enabled, new_enabled, actor_id, actor_name, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (flag_id, action, int(previous_enabled), int(new_enabled), actor_id, actor_name, reason, created_at),
    )
    return int(cur.lastrowid or 0)
