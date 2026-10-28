"""DEVELOPMENT-ONLY simulated identities.

This is NOT authentication. The frontend sends an ``X-Demo-User`` header naming
one of the personas below, and the backend uses the persona's role to decide
whether a write is allowed. In production this module would be replaced by an
identity provider (SSO / OIDC) and a real authorization policy.
"""

from dataclasses import dataclass
from typing import Literal

from fastapi import Header

from app.core.errors import ForbiddenError

Role = Literal["reviewer", "viewer"]


@dataclass(frozen=True)
class Persona:
    id: str
    name: str
    role: Role


DEMO_PERSONAS: dict[str, Persona] = {
    "ana.reviewer": Persona(id="ana.reviewer", name="Ana Okafor", role="reviewer"),
    "ben.reviewer": Persona(id="ben.reviewer", name="Ben Castillo", role="reviewer"),
    "vic.viewer": Persona(id="vic.viewer", name="Vic Lindqvist", role="viewer"),
}

DEFAULT_PERSONA_ID = "vic.viewer"


def get_current_persona(x_demo_user: str | None = Header(default=None)) -> Persona:
    """Resolve the simulated user from the ``X-Demo-User`` header.

    Unknown or missing personas fall back to the read-only viewer so a bad header
    can never grant more access than the default.
    """
    return DEMO_PERSONAS.get(x_demo_user or "", DEMO_PERSONAS[DEFAULT_PERSONA_ID])


def require_role(persona: Persona, *roles: Role) -> None:
    if persona.role not in roles:
        raise ForbiddenError(
            f"Persona '{persona.id}' has role '{persona.role}', which may not perform this action "
            f"(requires: {', '.join(roles)})."
        )
