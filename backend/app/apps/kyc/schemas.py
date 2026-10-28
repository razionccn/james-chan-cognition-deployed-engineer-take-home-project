"""Pydantic request/response models for the KYC API (the wire format the frontend types mirror)."""
from __future__ import annotations

from pydantic import BaseModel, Field

from .rules import Action, RiskLevel, Status


class Finding(BaseModel):
    check: str
    result: str
    detail: str


class KycCaseSummary(BaseModel):
    id: str
    customer_name: str
    customer_email: str
    country: str
    account_type: str
    risk_level: RiskLevel
    status: Status
    submitted_at: str
    updated_at: str
    assigned_reviewer: str | None = None


class AuditEvent(BaseModel):
    id: int
    case_id: str
    action: Action
    previous_status: Status
    new_status: Status
    actor_id: str
    actor_name: str
    reason: str
    created_at: str


class KycCaseDetail(KycCaseSummary):
    findings: list[Finding]
    audit_events: list[AuditEvent]
    allowed_actions: list[Action]


class CaseListResponse(BaseModel):
    items: list[KycCaseSummary]
    total: int


class ReviewActionRequest(BaseModel):
    action: Action
    reason: str = Field(default="", max_length=2000)


class MetaResponse(BaseModel):
    statuses: list[str]
    risk_levels: list[str]
    actions: list[str]
    transitions: dict[str, list[str]]
