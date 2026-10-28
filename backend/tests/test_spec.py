"""Spec schema + validator: the same validation serves specs/*.yaml and the Request-New-App wizard."""
import copy
from pathlib import Path

import pytest
import yaml

from app.cli import main as cli_main
from app.core.spec import validate_spec, validate_spec_file

SPECS_DIR = Path(__file__).resolve().parents[2] / "specs"


def _kyc() -> dict:
    return yaml.safe_load((SPECS_DIR / "kyc.yaml").read_text())


def _feature_flags() -> dict:
    """The spec the wizard produces for the Feature-Flag Admin Panel (admin_panel category)."""
    return {
        "spec_version": 1,
        "app": {
            "id": "feature_flags",
            "name": "Feature-Flag Admin Panel",
            "category": "admin_panel",
            "purpose": "Let platform engineers see every feature flag per environment and toggle staging flags with an audited reason.",
            "users": ["Platform engineers", "On-call engineers (read-only)"],
        },
        "roles": [
            {"id": "flag_admin", "description": "Can toggle staging flags", "can": ["view", "edit"]},
            {"id": "viewer", "description": "Read-only", "can": ["view"]},
        ],
        "entities": [
            {
                "id": "feature_flag",
                "name": "Feature flag",
                "id_field": "key",
                "fields": [
                    {"name": "key", "type": "string", "required": True, "searchable": True},
                    {"name": "description", "type": "text"},
                    {"name": "environment", "type": "enum", "options": ["staging", "production"], "required": True, "filterable": True},
                    {"name": "enabled", "type": "boolean", "required": True, "filterable": True},
                    {"name": "owner_team", "type": "string"},
                    {"name": "updated_at", "type": "datetime", "required": True},
                ],
            }
        ],
        "views": {
            "list": {
                "entity": "feature_flag",
                "columns": ["key", "environment", "enabled", "owner_team", "updated_at"],
                "search_fields": ["key"],
                "filters": ["environment", "enabled"],
            },
            "detail": {
                "entity": "feature_flag",
                "sections": [
                    {"title": "Flag", "fields": ["description", "owner_team", "environment", "enabled"]},
                    {"title": "Change history", "source": "audit"},
                ],
            },
        },
        "forms": [
            {"id": "toggle_flag", "entity": "feature_flag", "label": "Update flag", "fields": ["enabled", "description"], "roles": ["flag_admin"]}
        ],
        "audit": {"enabled": True},
        "acceptance_criteria": [
            {"id": "AC-1", "when": "GET /api/feature_flags/flags?environment=staging", "then": "only staging flags are returned"},
            {"id": "AC-2", "given": "flag_admin persona", "when": "PATCH a staging flag enabled=true with a reason", "then": "200, persisted, one audit event"},
            {"id": "AC-3", "given": "viewer persona", "when": "PATCH any flag", "then": "403 forbidden"},
        ],
    }


def test_kyc_spec_file_is_valid():
    result = validate_spec_file(SPECS_DIR / "kyc.yaml")
    assert result.valid, [e.model_dump() for e in result.errors]
    assert result.normalized["app"]["id"] == "kyc"
    assert result.normalized["workflow"]["actions"][0]["from"] == ["pending", "escalated"]
    assert result.yaml and yaml.safe_load(result.yaml)["app"]["name"] == "KYC Review Queue"


def test_feature_flag_spec_from_wizard_is_valid():
    result = validate_spec(_feature_flags())
    assert result.valid, [e.model_dump() for e in result.errors]
    assert result.warnings == ["No seed_data: Devin will choose the synthetic data set.", "No browser acceptance criterion: UI behaviour will not be verified end to end."]


@pytest.mark.parametrize(
    "mutate, expected_fragment",
    [
        (lambda s: s["views"]["list"]["columns"].append("nonexistent"), "unknown field 'nonexistent'"),
        (lambda s: s["workflow"]["actions"][0].update({"to": "archived"}), "unknown state 'archived'"),
        (lambda s: s["workflow"]["actions"][0].update({"roles": ["auditor"]}), "unknown role 'auditor'"),
        (lambda s: s["workflow"]["actions"][0].update({"from": ["approved"]}), "'approved' is terminal"),
        (lambda s: s["audit"].update({"enabled": False}), "audit.enabled must be true"),
        (lambda s: s["app"].update({"id": "KYC Review"}), "String should match pattern"),
        (lambda s: s["entities"][0]["fields"][5].update({"filterable": False}), "not marked filterable"),
        (lambda s: s.pop("workflow"), "requires a `workflow`"),
        (lambda s: s["entities"][0]["fields"].append({"name": "status", "type": "string"}), "duplicate field names"),
        (lambda s: s["entities"][0]["fields"][4].pop("options"), "enum fields need a non-empty `options`"),
        (lambda s: s.update({"pages": []}), "Extra inputs are not permitted"),
    ],
)
def test_invalid_specs_are_rejected_with_a_path(mutate, expected_fragment):
    spec = _kyc()
    mutate(spec)
    result = validate_spec(spec)
    assert not result.valid
    assert any(expected_fragment in e.message for e in result.errors), [e.model_dump() for e in result.errors]
    assert all(e.path for e in result.errors)


def test_crud_requires_a_form_and_edit_cannot_touch_id():
    spec = _feature_flags()
    spec["forms"] = []
    assert any("requires at least one `forms`" in e.message for e in validate_spec(spec).errors)
    spec = _feature_flags()
    spec["forms"][0]["fields"].append("key")
    assert any("cannot be edited" in e.message for e in validate_spec(spec).errors)


def test_validate_endpoint_accepts_object_and_yaml(client):
    ok = client.post("/api/specs/validate", json={"spec": _feature_flags()})
    assert ok.status_code == 200 and ok.json()["valid"] is True and ok.json()["yaml"].startswith("spec_version: 1")

    bad_yaml = client.post("/api/specs/validate", json={"yaml": "app: [unclosed"})
    assert bad_yaml.status_code == 200 and bad_yaml.json()["valid"] is False
    assert bad_yaml.json()["errors"][0]["path"] == "yaml"

    neither = client.post("/api/specs/validate", json={})
    assert neither.status_code == 422 and neither.json()["error"]["code"] == "validation_error"

    meta = client.get("/api/specs/meta").json()
    assert [c["id"] for c in meta["categories"]] == ["review_queue", "crud", "admin_panel"]
    assert "Nothing is generated or deployed" in meta["automation_note"]
    assert client.get("/api/specs/schema").json()["json_schema"]["title"] == "AppSpec"


def test_cli_validate_spec(tmp_path, capsys):
    assert cli_main(["validate-spec", str(SPECS_DIR / "kyc.yaml")]) == 0
    assert capsys.readouterr().out.startswith("OK")
    broken = tmp_path / "broken.yaml"
    broken.write_text(yaml.safe_dump({"spec_version": 1, "app": {"id": "x"}}))
    assert cli_main(["validate-spec", str(broken)]) == 1
    out = capsys.readouterr().out
    assert out.startswith("FAIL") and "app.name" in out
