"""Spec validation API used by the "Request New App" wizard and available to engineers.

Validating a spec does NOT create, generate or deploy an application. The
validated YAML is committed to ``specs/`` and implemented by Devin via the
``create-internal-tool`` Skill.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, model_validator

from app.core.errors import ValidationError
from app.core.spec import SPEC_VERSION, SpecValidationResult, json_schema, validate_spec, validate_yaml_text

router = APIRouter(tags=["specs"])


class ValidateRequest(BaseModel):
    spec: dict[str, Any] | None = None
    yaml: str | None = None

    @model_validator(mode="after")
    def _one_of(self) -> "ValidateRequest":
        if (self.spec is None) == (self.yaml is None):
            raise ValueError("provide exactly one of `spec` (object) or `yaml` (string)")
        return self


@router.post("/validate", response_model=SpecValidationResult)
def validate(body: ValidateRequest) -> SpecValidationResult:
    if body.yaml is not None:
        if len(body.yaml) > 200_000:
            raise ValidationError("YAML document too large.")
        return validate_yaml_text(body.yaml)
    return validate_spec(body.spec)


@router.get("/schema")
def schema() -> dict[str, Any]:
    return {"spec_version": SPEC_VERSION, "json_schema": json_schema()}


@router.get("/meta")
def meta() -> dict[str, Any]:
    return {
        "spec_version": SPEC_VERSION,
        "categories": [
            {"id": "review_queue", "label": "Review / approval queue", "example": "KYC review, refund approvals"},
            {"id": "crud", "label": "Record management (CRUD)", "example": "Merchant directory, vendor list"},
            {"id": "admin_panel", "label": "Administrative control panel", "example": "Feature flags, limits"},
        ],
        "field_types": ["string", "text", "integer", "number", "boolean", "enum", "date", "datetime", "email", "json"],
        "permissions": ["view", "act", "create", "edit", "delete", "admin"],
        "automation_note": (
            "Validation checks structure and consistency only. Nothing is generated or deployed: "
            "the YAML is committed to specs/ and implemented by Devin following the create-internal-tool Skill."
        ),
    }
