import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .db import transaction
from .personas import Persona

ENVIRONMENTS = [
    {"id": "development", "editable": True},
    {"id": "staging", "editable": True},
    {"id": "production", "editable": False},
]
EDITABLE = {e["id"] for e in ENVIRONMENTS if e["editable"]}


class ServiceError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def _row_to_flag(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "environment": row["environment"],
        "enabled": bool(row["enabled"]),
        "updated_at": row["updated_at"],
        "updated_by": row["updated_by"],
    }


def _row_to_event(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "flag_id": row["flag_id"],
        "action": row["action"],
        "previous_enabled": bool(row["previous_enabled"]),
        "new_enabled": bool(row["new_enabled"]),
        "actor_id": row["actor_id"],
        "actor_name": row["actor_name"],
        "reason": row["reason"],
        "created_at": row["created_at"],
    }


def list_flags(
    conn: sqlite3.Connection,
    q: Optional[str] = None,
    environment: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> List[Dict[str, Any]]:
    sql = "SELECT * FROM feature_flags WHERE 1=1"
    params: List[Any] = []
    if q:
        like = f"%{q.lower()}%"
        sql += " AND (lower(name) LIKE ? OR lower(id) LIKE ?)"
        params += [like, like]
    if environment:
        sql += " AND environment = ?"
        params.append(environment)
    if enabled is not None:
        sql += " AND enabled = ?"
        params.append(int(enabled))
    sql += " ORDER BY name, CASE environment WHEN 'development' THEN 0 WHEN 'staging' THEN 1 ELSE 2 END"
    return [_row_to_flag(r) for r in conn.execute(sql, params)]


def get_flag_detail(conn: sqlite3.Connection, flag_id: str) -> Dict[str, Any]:
    row = conn.execute("SELECT * FROM feature_flags WHERE id = ?", (flag_id,)).fetchone()
    if row is None:
        raise ServiceError(404, "not_found", f"Flag '{flag_id}' was not found.")
    flag = _row_to_flag(row)
    flag["editable"] = flag["environment"] in EDITABLE
    events = conn.execute(
        "SELECT * FROM feature_flag_audit_events WHERE flag_id = ? ORDER BY created_at DESC, id DESC",
        (flag_id,),
    ).fetchall()
    flag["audit_events"] = [_row_to_event(e) for e in events]
    return flag


def toggle_flag(
    conn: sqlite3.Connection, flag_id: str, enabled: bool, reason: str, persona: Persona
) -> Dict[str, Any]:
    with transaction(conn):
        row = conn.execute("SELECT * FROM feature_flags WHERE id = ?", (flag_id,)).fetchone()
        if row is None:
            raise ServiceError(404, "not_found", f"Flag '{flag_id}' was not found.")
        if row["environment"] not in EDITABLE:  # BR-1 (checked before role so the UI message is accurate)
            raise ServiceError(
                403,
                "environment_locked",
                f"Flags in the '{row['environment']}' environment are locked and cannot be modified through this API.",
            )
        if not persona.can_toggle:  # BR-2
            raise ServiceError(
                403, "forbidden", f"Persona '{persona.name}' has role '{persona.role}' and may not toggle flags."
            )
        previous = bool(row["enabled"])
        if previous == enabled:  # BR-3
            state = "enabled" if enabled else "disabled"
            raise ServiceError(409, "invalid_transition", f"Flag '{flag_id}' is already {state}.")

        ts = now_iso()
        cur = conn.execute(
            "UPDATE feature_flags SET enabled = ?, updated_at = ?, updated_by = ?"
            " WHERE id = ? AND enabled = ?",
            (int(enabled), ts, persona.name, flag_id, int(previous)),
        )
        if cur.rowcount != 1:  # BR-4 conditional update lost a race
            raise ServiceError(
                409, "invalid_transition", f"Flag '{flag_id}' was modified concurrently; reload and retry."
            )
        conn.execute(
            "INSERT INTO feature_flag_audit_events"
            " (flag_id, action, previous_enabled, new_enabled, actor_id, actor_name, reason, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                flag_id,
                "enable" if enabled else "disable",
                int(previous),
                int(enabled),
                persona.id,
                persona.name,
                reason or "",
                ts,
            ),
        )
    return get_flag_detail(conn, flag_id)
