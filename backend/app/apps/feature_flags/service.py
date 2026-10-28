"""Business rules for feature-flag changes (BR-1..BR-7 in specs/feature_flags.yaml)."""
from __future__ import annotations

import sqlite3
from typing import Any

from app.core.db import transaction
from app.core.errors import ForbiddenError, InvalidTransitionError, NotFoundError, ValidationError
from app.core.personas import Persona, require_role
from app.core.time import utc_now_iso

from . import repository
from .rules import ENVIRONMENTS, TOGGLE_ROLES, is_editable



def _validate_environment(value: str | None) -> str | None:
    if value in (None, ""):
        return None
    if value not in ENVIRONMENTS:
        raise ValidationError(f"Invalid environment '{value}'. Expected one of: {', '.join(ENVIRONMENTS)}.")
    return value


def _parse_enabled(value: str | None) -> bool | None:
    if value in (None, ""):
        return None
    if value.lower() in ("true", "1"):
        return True
    if value.lower() in ("false", "0"):
        return False
    raise ValidationError(f"Invalid enabled filter '{value}'. Expected 'true' or 'false'.")


def list_flags(conn: sqlite3.Connection, *, q: str | None, environment: str | None, enabled: str | None) -> list[dict[str, Any]]:
    return repository.list_flags(
        conn, q=q or None, environment=_validate_environment(environment), enabled=_parse_enabled(enabled)
    )


def get_flag_detail(conn: sqlite3.Connection, flag_id: str) -> dict[str, Any]:
    flag = repository.get_flag(conn, flag_id)
    if flag is None:
        raise NotFoundError(f"Feature flag '{flag_id}' was not found.")
    flag["editable"] = is_editable(flag["environment"])
    flag["audit_events"] = repository.list_audit_events(conn, flag_id)
    return flag


def toggle_flag(conn: sqlite3.Connection, *, flag_id: str, enabled: bool, reason: str, persona: Persona) -> dict[str, Any]:
    # BR-2: authorization first, so viewers get 403 even for unknown or locked flags.
    require_role(persona, *TOGGLE_ROLES)  # type: ignore[arg-type]
    cleaned_reason = (reason or "").strip()

    # BR-4: read, rule checks, conditional update and audit event in one transaction.
    with transaction(conn):
        now = utc_now_iso()  # after the write lock, so it never predates a commit we waited for
        flag = repository.get_flag(conn, flag_id)
        if flag is None:  # BR-5
            raise NotFoundError(f"Feature flag '{flag_id}' was not found.")
        if not is_editable(flag["environment"]):  # BR-1
            raise ForbiddenError(
                f"Flags in the '{flag['environment']}' environment are locked and cannot be changed from this panel.",
                code="environment_locked",
            )
        if flag["enabled"] == enabled:  # BR-3
            state = "enabled" if enabled else "disabled"
            raise InvalidTransitionError(f"Flag '{flag['name']}' ({flag['environment']}) is already {state}.")

        changed = repository.update_enabled(
            conn, flag_id, enabled, now, persona.name, expected_enabled=flag["enabled"]
        )
        if changed != 1:
            raise InvalidTransitionError(
                f"Flag '{flag['name']}' was updated by someone else; the view has been refreshed."
            )
        repository.insert_audit_event(
            conn,
            flag_id=flag_id,
            action="enable" if enabled else "disable",
            previous_enabled=flag["enabled"],
            new_enabled=enabled,
            actor_id=persona.id,
            actor_name=persona.name,
            reason=cleaned_reason,
            created_at=now,
        )
    return get_flag_detail(conn, flag_id)
