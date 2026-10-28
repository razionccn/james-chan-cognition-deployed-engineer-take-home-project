"""HTTP layer for the Feature-Flag Admin Panel (/api/feature_flags). Parses input, calls service, maps output."""
from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, Query

from app.core.db import get_db
from app.core.personas import Persona, get_current_persona

from . import service
from .rules import ENVIRONMENTS, TOGGLE_ROLES, is_editable
from .schemas import EnvironmentMeta, FeatureFlagDetail, FlagListResponse, MetaResponse, ToggleRequest

router = APIRouter(tags=["feature_flags"])


@router.get("/meta", response_model=MetaResponse)
def get_meta() -> MetaResponse:
    return MetaResponse(
        environments=[EnvironmentMeta(id=e, editable=is_editable(e)) for e in ENVIRONMENTS],
        roles_that_can_toggle=list(TOGGLE_ROLES),
    )


@router.get("/flags", response_model=FlagListResponse)
def list_flags(
    q: str | None = Query(default=None, max_length=100, description="Flag name or id fragment"),
    environment: str | None = Query(default=None),
    enabled: str | None = Query(default=None, description="'true' or 'false'"),
    conn: sqlite3.Connection = Depends(get_db),
) -> FlagListResponse:
    items = service.list_flags(conn, q=q, environment=environment, enabled=enabled)
    return FlagListResponse(items=items, total=len(items))  # type: ignore[arg-type]


@router.get("/flags/{flag_id}", response_model=FeatureFlagDetail)
def get_flag(flag_id: str, conn: sqlite3.Connection = Depends(get_db)) -> FeatureFlagDetail:
    return FeatureFlagDetail(**service.get_flag_detail(conn, flag_id))


@router.post("/flags/{flag_id}/toggle", response_model=FeatureFlagDetail)
def toggle_flag(
    flag_id: str,
    body: ToggleRequest,
    conn: sqlite3.Connection = Depends(get_db),
    persona: Persona = Depends(get_current_persona),
) -> FeatureFlagDetail:
    result = service.toggle_flag(conn, flag_id=flag_id, enabled=body.enabled, reason=body.reason, persona=persona)
    return FeatureFlagDetail(**result)
