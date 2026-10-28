"""Pydantic request/response models for the feature-flag API (the wire format the frontend types mirror)."""
from __future__ import annotations

from pydantic import BaseModel, Field, StrictBool

from .rules import Action, Environment


class FeatureFlag(BaseModel):
    id: str
    name: str
    description: str
    environment: Environment
    enabled: bool
    updated_at: str
    updated_by: str


class AuditEvent(BaseModel):
    id: int
    flag_id: str
    action: Action
    previous_enabled: bool
    new_enabled: bool
    actor_id: str
    actor_name: str
    reason: str
    created_at: str


class FeatureFlagDetail(FeatureFlag):
    editable: bool
    audit_events: list[AuditEvent]


class FlagListResponse(BaseModel):
    items: list[FeatureFlag]
    total: int


class ToggleRequest(BaseModel):
    enabled: StrictBool  # state-changing admin field: no "yes"/"1"/"true" coercion
    reason: str = Field(default="", max_length=500)


class EnvironmentMeta(BaseModel):
    id: str
    editable: bool


class MetaResponse(BaseModel):
    environments: list[EnvironmentMeta]
    roles_that_can_toggle: list[str]
