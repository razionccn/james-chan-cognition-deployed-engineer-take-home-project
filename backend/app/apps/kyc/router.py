from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, Query

from app.core.db import get_db
from app.core.personas import Persona, get_current_persona

from . import service
from .rules import ACTIONS, RISK_LEVELS, STATUSES, allowed_actions
from .schemas import CaseListResponse, KycCaseDetail, MetaResponse, ReviewActionRequest

router = APIRouter(tags=["kyc"])


@router.get("/meta", response_model=MetaResponse)
def get_meta() -> MetaResponse:
    return MetaResponse(
        statuses=list(STATUSES),
        risk_levels=list(RISK_LEVELS),
        actions=list(ACTIONS),
        transitions={s: allowed_actions(s) for s in STATUSES},
    )


@router.get("/cases", response_model=CaseListResponse)
def list_cases(
    q: str | None = Query(default=None, max_length=100, description="Customer name or case id fragment"),
    status: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    conn: sqlite3.Connection = Depends(get_db),
) -> CaseListResponse:
    items = service.list_cases(conn, q=q, status=status, risk_level=risk_level)
    return CaseListResponse(items=items, total=len(items))  # type: ignore[arg-type]


@router.get("/cases/{case_id}", response_model=KycCaseDetail)
def get_case(case_id: str, conn: sqlite3.Connection = Depends(get_db)) -> KycCaseDetail:
    return KycCaseDetail(**service.get_case_detail(conn, case_id))


@router.post("/cases/{case_id}/actions", response_model=KycCaseDetail)
def review_case(
    case_id: str,
    body: ReviewActionRequest,
    conn: sqlite3.Connection = Depends(get_db),
    persona: Persona = Depends(get_current_persona),
) -> KycCaseDetail:
    result = service.apply_review_action(
        conn, case_id=case_id, action=body.action, reason=body.reason, persona=persona
    )
    return KycCaseDetail(**result)
