"""SQL access for KYC cases and audit events. No business logic here."""
from __future__ import annotations

import json
import sqlite3
from typing import Any


def _row_to_case(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    data["findings"] = json.loads(data.pop("findings_json") or "[]")
    return data


def list_cases(conn: sqlite3.Connection, *, q: str | None, status: str | None, risk_level: str | None) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if q:
        clauses.append("(lower(customer_name) LIKE ? OR lower(id) LIKE ?)")
        like = f"%{q.strip().lower()}%"
        params += [like, like]
    if status:
        clauses.append("status = ?")
        params.append(status)
    if risk_level:
        clauses.append("risk_level = ?")
        params.append(risk_level)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = conn.execute(
        f"SELECT * FROM kyc_cases {where} ORDER BY submitted_at DESC, id ASC", params
    ).fetchall()
    return [_row_to_case(r) for r in rows]


def get_case(conn: sqlite3.Connection, case_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM kyc_cases WHERE id = ?", (case_id,)).fetchone()
    return _row_to_case(row) if row else None


def list_audit_events(conn: sqlite3.Connection, case_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM kyc_audit_events WHERE case_id = ? ORDER BY created_at DESC, id DESC", (case_id,)
    ).fetchall()
    return [dict(r) for r in rows]


def update_status(
    conn: sqlite3.Connection, case_id: str, new_status: str, updated_at: str, *, expected_status: str
) -> int:
    """Conditional update: only succeeds if the row is still in ``expected_status``. Returns rows changed."""
    cur = conn.execute(
        "UPDATE kyc_cases SET status = ?, updated_at = ? WHERE id = ? AND status = ?",
        (new_status, updated_at, case_id, expected_status),
    )
    return cur.rowcount


def insert_audit_event(
    conn: sqlite3.Connection,
    *,
    case_id: str,
    action: str,
    previous_status: str,
    new_status: str,
    actor_id: str,
    actor_name: str,
    reason: str,
    created_at: str,
) -> int:
    cur = conn.execute(
        """INSERT INTO kyc_audit_events (case_id, action, previous_status, new_status, actor_id, actor_name, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (case_id, action, previous_status, new_status, actor_id, actor_name, reason, created_at),
    )
    return int(cur.lastrowid or 0)
