"""Workflow definition for KYC cases. Mirrors specs/kyc.yaml `workflow`."""
from typing import Literal

Status = Literal["pending", "approved", "rejected", "escalated"]
Action = Literal["approve", "reject", "escalate"]
RiskLevel = Literal["low", "medium", "high"]

STATUSES: tuple[str, ...] = ("pending", "approved", "rejected", "escalated")
RISK_LEVELS: tuple[str, ...] = ("low", "medium", "high")
ACTIONS: tuple[str, ...] = ("approve", "reject", "escalate")
TERMINAL_STATUSES: frozenset[str] = frozenset({"approved", "rejected"})

# (action, from_status) -> to_status
TRANSITIONS: dict[tuple[str, str], str] = {
    ("approve", "pending"): "approved",
    ("reject", "pending"): "rejected",
    ("escalate", "pending"): "escalated",
    ("approve", "escalated"): "approved",
    ("reject", "escalated"): "rejected",
}


def allowed_actions(status: str) -> list[str]:
    return [action for (action, from_status) in TRANSITIONS if from_status == status]


def next_status(action: str, status: str) -> str | None:
    return TRANSITIONS.get((action, status))
