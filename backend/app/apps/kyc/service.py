"""Business rules for the KYC review workflow (BR-1..BR-6 in specs/kyc.yaml)."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any

from app.core.db import transaction
from app.core.errors import ForbiddenError, InvalidTransitionError, NotFoundError, ValidationError
from app.core.personas import Persona, require_role

from . import repository
from .rules import ACTIONS, RISK_LEVELS, STATUSES, allowed_actions, next_status


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _validate_filter(name: str, value: str | None, allowed: tuple[str, ...]) -> str | None:
    if value in (None, ""):
        return None
    if value not in allowed:
        raise ValidationError(f"Invalid {name} '{value}'. Expected one of: {', '.join(allowed)}.")
    return value


def _transition_message(action: str, status: str) -> str:
    return (
        f"Cannot {action} a case with status '{status}'. "
        f"Allowed actions: {', '.join(allowed_actions(status)) or 'none (terminal)'}."
    )


def list_cases(conn: sqlite3.Connection, *, q: str | None, status: str | None, risk_level: str | None) -> list[dict[str, Any]]:
    return repository.list_cases(
        conn,
        q=q or None,
        status=_validate_filter("status", status, STATUSES),
        risk_level=_validate_filter("risk_level", risk_level, RISK_LEVELS),
    )


def get_case_detail(conn: sqlite3.Connection, case_id: str) -> dict[str, Any]:
    case = repository.get_case(conn, case_id)
    if case is None:
        raise NotFoundError(f"KYC case '{case_id}' was not found.")
    case["audit_events"] = repository.list_audit_events(conn, case_id)
    case["allowed_actions"] = allowed_actions(case["status"])
    return case


def apply_review_action(
    conn: sqlite3.Connection, *, case_id: str, action: str, reason: str, persona: Persona
) -> dict[str, Any]:
    # BR-3: authorization first, so viewers get a 403 even for unknown cases/actions.
    require_role(persona, "reviewer")

    if action not in ACTIONS:
        raise ValidationError(f"Unknown action '{action}'. Expected one of: {', '.join(ACTIONS)}.")
    # BR-1
    cleaned_reason = (reason or "").strip()
    if not cleaned_reason:
        raise ValidationError("A reason is required for every review action.")

    now = _now()
    # BR-4: read, transition check, status update and audit event in one transaction.
    with transaction(conn):
        # BR-5
        case = repository.get_case(conn, case_id)
        if case is None:
            raise NotFoundError(f"KYC case '{case_id}' was not found.")

        # BR-2
        target = next_status(action, case["status"])
        if target is None:
            raise InvalidTransitionError(_transition_message(action, case["status"]))

        # Guard against a concurrent writer that changed the status between read and write.
        changed = repository.update_status(conn, case_id, target, now, expected_status=case["status"])
        if changed != 1:
            current = repository.get_case(conn, case_id)
            raise InvalidTransitionError(
                _transition_message(action, current["status"] if current else "unknown")
                + " The case was updated by someone else; the view has been refreshed."
            )
        repository.insert_audit_event(
            conn,
            case_id=case_id,
            action=action,
            previous_status=case["status"],
            new_status=target,
            actor_id=persona.id,
            actor_name=persona.name,
            reason=cleaned_reason,
            created_at=now,
        )
    return get_case_detail(conn, case_id)
