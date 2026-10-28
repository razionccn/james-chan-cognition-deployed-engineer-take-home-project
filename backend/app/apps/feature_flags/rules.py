"""Environment rules for feature flags. Mirrors specs/feature_flags.yaml `environments`."""
from typing import Literal

Environment = Literal["development", "staging", "production"]
Action = Literal["enable", "disable"]

ENVIRONMENTS: tuple[str, ...] = ("development", "staging", "production")
EDITABLE_ENVIRONMENTS: frozenset[str] = frozenset({"development", "staging"})
TOGGLE_ROLES: tuple[str, ...] = ("reviewer",)


def is_editable(environment: str) -> bool:
    return environment in EDITABLE_ENVIRONMENTS
