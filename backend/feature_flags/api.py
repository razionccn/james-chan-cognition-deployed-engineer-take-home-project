import sqlite3
from typing import Iterator, Optional

from fastapi import APIRouter, Depends, Header, Query, Request

from . import service
from .db import connect
from .personas import ROLES_THAT_CAN_TOGGLE, Persona, resolve_persona
from .schemas import Environment, FeatureFlagDetail, FlagList, Meta, ToggleRequest

router = APIRouter(prefix="/api/feature_flags", tags=["feature_flags"])


def get_conn(request: Request) -> Iterator[sqlite3.Connection]:
    """One SQLite connection per request so concurrent requests never share a transaction."""
    conn = connect(request.app.state.db_path)
    try:
        yield conn
    finally:
        conn.close()


def get_persona(x_demo_user: Optional[str] = Header(default=None, alias="X-Demo-User")) -> Persona:
    return resolve_persona(x_demo_user)


@router.get("/meta", response_model=Meta)
def meta() -> dict:
    return {"environments": service.ENVIRONMENTS, "roles_that_can_toggle": ROLES_THAT_CAN_TOGGLE}


@router.get("/flags", response_model=FlagList)
def list_flags(
    q: Optional[str] = Query(default=None, max_length=200),
    environment: Optional[Environment] = Query(default=None),
    enabled: Optional[bool] = Query(default=None),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    items = service.list_flags(conn, q=q, environment=environment.value if environment else None, enabled=enabled)
    return {"items": items, "total": len(items)}


@router.get("/flags/{flag_id}", response_model=FeatureFlagDetail)
def get_flag(flag_id: str, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    return service.get_flag_detail(conn, flag_id)


@router.post("/flags/{flag_id}/toggle", response_model=FeatureFlagDetail)
def toggle_flag(
    flag_id: str,
    body: ToggleRequest,
    conn: sqlite3.Connection = Depends(get_conn),
    persona: Persona = Depends(get_persona),
) -> dict:
    return service.toggle_flag(conn, flag_id, body.enabled, body.reason or "", persona)
