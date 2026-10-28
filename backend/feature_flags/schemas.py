from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Environment(str, Enum):
    development = "development"
    staging = "staging"
    production = "production"


class EnvironmentMeta(BaseModel):
    id: Environment
    editable: bool


class Meta(BaseModel):
    environments: List[EnvironmentMeta]
    roles_that_can_toggle: List[str]


class FeatureFlag(BaseModel):
    id: str
    name: str
    description: str
    environment: Environment
    enabled: bool
    updated_at: str
    updated_by: str


class FlagList(BaseModel):
    items: List[FeatureFlag]
    total: int


class AuditEvent(BaseModel):
    id: int
    flag_id: str
    action: str
    previous_enabled: bool
    new_enabled: bool
    actor_id: str
    actor_name: str
    reason: str
    created_at: str


class FeatureFlagDetail(FeatureFlag):
    editable: bool
    audit_events: List[AuditEvent]


class ToggleRequest(BaseModel):
    enabled: bool
    reason: Optional[str] = Field(default="", max_length=500)


class ErrorBody(BaseModel):
    code: str
    message: str
