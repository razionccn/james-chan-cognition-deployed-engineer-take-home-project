"""Application specification schema (spec_version 1) and validator.

Both ways of creating a spec — an engineer editing ``specs/<app_id>.yaml`` and a
non-engineer using the "Request New App" wizard — produce this structure and are
validated by ``validate_spec``.

What is validated here: structure, types, enum values and cross-references
(fields referenced by views/forms/workflow exist, states are consistent, roles exist,
audit is enabled for anything that writes).

What is NOT validated and is interpreted by Devin when implementing:
``business_rules``, ``api``, ``seed_data``, ``non_goals``, ``devin_notes`` and any
``description`` text.  Nothing in this module generates application code.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError as PydanticValidationError, model_validator

SPEC_VERSION = 1

Category = Literal["review_queue", "crud", "admin_panel"]
FieldType = Literal["string", "text", "integer", "number", "boolean", "enum", "date", "datetime", "email", "json"]
Permission = Literal["view", "act", "create", "edit", "delete", "admin"]

_SLUG = re.compile(r"^[a-z][a-z0-9_]{1,30}$")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AppMeta(_Strict):
    id: str = Field(pattern=_SLUG.pattern, description="snake_case identifier; also the URL path and module name")
    name: str = Field(min_length=3, max_length=60)
    category: Category
    purpose: str = Field(min_length=10, max_length=1000)
    users: list[str] = Field(default_factory=list, description="Who will use it (free text)")
    console: str | None = None
    data_policy: str | None = None


class Role(_Strict):
    id: str = Field(pattern=_SLUG.pattern)
    description: str = ""
    can: list[Permission] = Field(default_factory=lambda: ["view"])


class FieldSpec(_Strict):
    name: str = Field(pattern=_SLUG.pattern)
    type: FieldType
    label: str | None = None
    required: bool = False
    options: list[str] | None = Field(default=None, description="Allowed values; required for enum")
    searchable: bool = False
    filterable: bool = False
    min_length: int | None = None
    max_length: int | None = None
    description: str | None = None

    @model_validator(mode="after")
    def _enum_needs_options(self) -> "FieldSpec":
        if self.type == "enum" and not self.options:
            raise ValueError("enum fields need a non-empty `options` list")
        if self.type != "enum" and self.options:
            raise ValueError("`options` is only valid for enum fields")
        if self.filterable and self.type not in ("enum", "boolean"):
            raise ValueError("only enum and boolean fields can be `filterable`")
        return self


class Entity(_Strict):
    id: str = Field(pattern=_SLUG.pattern)
    name: str
    id_field: str = "id"
    fields: list[FieldSpec] = Field(min_length=1)
    description: str | None = None

    @model_validator(mode="after")
    def _fields_unique_and_id_present(self) -> "Entity":
        names = [f.name for f in self.fields]
        dupes = sorted({n for n in names if names.count(n) > 1})
        if dupes:
            raise ValueError(f"duplicate field names: {', '.join(dupes)}")
        if self.id_field not in names:
            raise ValueError(f"id_field '{self.id_field}' is not one of the fields")
        return self


class Sort(_Strict):
    field: str
    direction: Literal["asc", "desc"] = "desc"


class ListView(_Strict):
    entity: str
    columns: list[str] = Field(min_length=1)
    search_fields: list[str] = Field(default_factory=list)
    filters: list[str] = Field(default_factory=list)
    default_sort: Sort | None = None


class DetailSection(_Strict):
    title: str
    fields: list[str] = Field(default_factory=list)
    source: Literal["fields", "audit"] = "fields"


class DetailView(_Strict):
    entity: str
    sections: list[DetailSection] = Field(min_length=1)


class Views(_Strict):
    list: ListView
    detail: DetailView | None = None


class Form(_Strict):
    id: str = Field(pattern=_SLUG.pattern)
    entity: str
    label: str
    mode: Literal["create", "edit"] = "edit"
    fields: list[str] = Field(min_length=1)
    roles: list[str] = Field(min_length=1)
    requires_reason: bool = True
    confirm: bool = True


class WorkflowAction(_Strict):
    id: str = Field(pattern=_SLUG.pattern)
    label: str
    from_states: list[str] = Field(alias="from", min_length=1)
    to: str
    roles: list[str] = Field(min_length=1)
    requires_reason: bool = True

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Workflow(_Strict):
    entity: str
    state_field: str = "status"
    states: list[str] = Field(min_length=2)
    initial: str
    terminal: list[str] = Field(default_factory=list)
    actions: list[WorkflowAction] = Field(min_length=1)


class Audit(_Strict):
    enabled: bool = True
    record: list[Literal["actor", "previous_value", "new_value", "reason", "timestamp"]] = Field(
        default_factory=lambda: ["actor", "previous_value", "new_value", "reason", "timestamp"]
    )
    retention_note: str | None = None


class AcceptanceCriterion(_Strict):
    id: str
    given: str | None = None
    when: str | None = None
    then: str
    kind: Literal["api", "browser"] = "api"


class AppSpec(_Strict):
    """spec_version 1. Sections marked *free-form* are not validated beyond type and are interpreted by Devin."""

    spec_version: int = Field(default=SPEC_VERSION)
    app: AppMeta
    roles: list[Role] = Field(min_length=1)
    entities: list[Entity] = Field(min_length=1)
    views: Views
    forms: list[Form] = Field(default_factory=list)
    workflow: Workflow | None = None
    audit: Audit = Field(default_factory=Audit)
    acceptance_criteria: list[AcceptanceCriterion] = Field(min_length=1)
    # free-form, interpreted by Devin:
    business_rules: list[dict[str, Any]] | None = None
    api: dict[str, Any] | None = None
    seed_data: dict[str, Any] | None = None
    non_goals: list[str] | None = None
    devin_notes: str | None = None
    roles_note: str | None = None

    @model_validator(mode="after")
    def _cross_references(self) -> "AppSpec":
        errors: list[str] = []
        if self.spec_version != SPEC_VERSION:
            errors.append(f"spec_version must be {SPEC_VERSION}")
        entities = {e.id: e for e in self.entities}
        role_ids = {r.id for r in self.roles}
        if len(entities) != len(self.entities):
            errors.append("entity ids must be unique")
        if len(role_ids) != len(self.roles):
            errors.append("role ids must be unique")

        def check_fields(where: str, entity_id: str, names: list[str]) -> None:
            ent = entities.get(entity_id)
            if ent is None:
                errors.append(f"{where}: unknown entity '{entity_id}'")
                return
            known = {f.name for f in ent.fields}
            for n in names:
                if n not in known:
                    errors.append(f"{where}: unknown field '{n}' on entity '{entity_id}'")

        lv = self.views.list
        check_fields("views.list.columns", lv.entity, lv.columns)
        check_fields("views.list.search_fields", lv.entity, lv.search_fields)
        check_fields("views.list.filters", lv.entity, lv.filters)
        if lv.default_sort:
            check_fields("views.list.default_sort", lv.entity, [lv.default_sort.field])
        if lv.entity in entities:
            by_name = {f.name: f for f in entities[lv.entity].fields}
            for n in lv.filters:
                if n in by_name and not by_name[n].filterable:
                    errors.append(f"views.list.filters: field '{n}' is not marked filterable")
        if self.views.detail:
            for i, sec in enumerate(self.views.detail.sections):
                if sec.source == "fields":
                    check_fields(f"views.detail.sections[{i}]", self.views.detail.entity, sec.fields)
                elif not self.audit.enabled:
                    errors.append(f"views.detail.sections[{i}]: audit section requires audit.enabled")

        for f in self.forms:
            check_fields(f"forms[{f.id}].fields", f.entity, f.fields)
            ent = entities.get(f.entity)
            if ent and ent.id_field in f.fields and f.mode == "edit":
                errors.append(f"forms[{f.id}]: id_field '{ent.id_field}' cannot be edited")
            for r in f.roles:
                if r not in role_ids:
                    errors.append(f"forms[{f.id}].roles: unknown role '{r}'")

        wf = self.workflow
        if wf:
            states = set(wf.states)
            if len(states) != len(wf.states):
                errors.append("workflow.states must be unique")
            if wf.initial not in states:
                errors.append(f"workflow.initial '{wf.initial}' is not a state")
            for t in wf.terminal:
                if t not in states:
                    errors.append(f"workflow.terminal '{t}' is not a state")
            ent = entities.get(wf.entity)
            if ent is None:
                errors.append(f"workflow.entity: unknown entity '{wf.entity}'")
            else:
                sf = next((f for f in ent.fields if f.name == wf.state_field), None)
                if sf is None:
                    errors.append(f"workflow.state_field '{wf.state_field}' is not a field of '{wf.entity}'")
                elif sf.type != "enum" or set(sf.options or []) != states:
                    errors.append(
                        f"workflow.state_field '{wf.state_field}' must be an enum whose options equal workflow.states"
                    )
            seen_actions: set[str] = set()
            for a in wf.actions:
                if a.id in seen_actions:
                    errors.append(f"workflow.actions: duplicate action id '{a.id}'")
                seen_actions.add(a.id)
                for s in a.from_states:
                    if s not in states:
                        errors.append(f"workflow.actions[{a.id}].from: unknown state '{s}'")
                    if s in wf.terminal:
                        errors.append(f"workflow.actions[{a.id}].from: '{s}' is terminal")
                if a.to not in states:
                    errors.append(f"workflow.actions[{a.id}].to: unknown state '{a.to}'")
                for r in a.roles:
                    if r not in role_ids:
                        errors.append(f"workflow.actions[{a.id}].roles: unknown role '{r}'")

        if self.app.category == "review_queue" and not wf:
            errors.append("category 'review_queue' requires a `workflow`")
        if self.app.category in ("crud", "admin_panel") and not self.forms:
            errors.append(f"category '{self.app.category}' requires at least one `forms` entry")
        if (wf or self.forms) and not self.audit.enabled:
            errors.append("audit.enabled must be true when the app has workflow actions or forms")
        writers = {r.id for r in self.roles if set(r.can) & {"act", "create", "edit", "delete", "admin"}}
        if (wf or self.forms) and not writers:
            errors.append("at least one role needs a write permission (act/create/edit/delete/admin)")

        if errors:
            raise ValueError("; ".join(errors))
        return self


class SpecError(BaseModel):
    path: str
    message: str


class SpecValidationResult(BaseModel):
    valid: bool
    errors: list[SpecError]
    warnings: list[str] = []
    normalized: dict[str, Any] | None = None
    yaml: str | None = None


def _format_errors(exc: PydanticValidationError) -> list[SpecError]:
    out: list[SpecError] = []
    for err in exc.errors():
        loc = ".".join(str(x) for x in err["loc"])
        msg = err["msg"]
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        # The cross-reference validator joins messages with "; " — split them back out.
        for part in msg.split("; ") if loc in ("", "spec") else [msg]:
            out.append(SpecError(path=loc or "spec", message=part))
    return out


def _warnings(spec: AppSpec) -> list[str]:
    w: list[str] = []
    if not spec.views.detail:
        w.append("No detail view: records can only be seen in the list.")
    if spec.seed_data is None:
        w.append("No seed_data: Devin will choose the synthetic data set.")
    if not any(c.kind == "browser" for c in spec.acceptance_criteria):
        w.append("No browser acceptance criterion: UI behaviour will not be verified end to end.")
    if spec.workflow and not spec.workflow.terminal:
        w.append("Workflow has no terminal states; every state stays actionable.")
    return w


def to_yaml(data: dict[str, Any]) -> str:
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=100)


def validate_spec(data: Any) -> SpecValidationResult:
    if not isinstance(data, dict):
        return SpecValidationResult(valid=False, errors=[SpecError(path="spec", message="specification must be a mapping")])
    try:
        spec = AppSpec.model_validate(data)
    except PydanticValidationError as exc:
        return SpecValidationResult(valid=False, errors=_format_errors(exc))
    normalized = spec.model_dump(by_alias=True, exclude_none=True)
    return SpecValidationResult(valid=True, errors=[], warnings=_warnings(spec), normalized=normalized, yaml=to_yaml(normalized))


def validate_yaml_text(text: str) -> SpecValidationResult:
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        return SpecValidationResult(valid=False, errors=[SpecError(path="yaml", message=f"YAML parse error: {exc}")])
    return validate_spec(data)


def validate_spec_file(path: Path) -> SpecValidationResult:
    return validate_yaml_text(Path(path).read_text())


def json_schema() -> dict[str, Any]:
    return AppSpec.model_json_schema(by_alias=True)
