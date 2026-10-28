from dataclasses import dataclass
from typing import Optional

REVIEWER = "reviewer"
VIEWER = "viewer"
ROLES_THAT_CAN_TOGGLE = [REVIEWER]

HEADER_NAME = "X-Demo-User"


@dataclass(frozen=True)
class Persona:
    id: str
    name: str
    role: str

    @property
    def can_toggle(self) -> bool:
        return self.role in ROLES_THAT_CAN_TOGGLE


PERSONAS = {
    "alice.reviewer": Persona("alice.reviewer", "Alice Nguyen", REVIEWER),
    "bob.reviewer": Persona("bob.reviewer", "Bob Okafor", REVIEWER),
    "carol.viewer": Persona("carol.viewer", "Carol Díaz", VIEWER),
}

ANONYMOUS = Persona("anonymous", "Anonymous viewer", VIEWER)


def resolve_persona(header_value: Optional[str]) -> Persona:
    """Unknown or missing header resolves to a read-only viewer (never raises)."""
    if not header_value:
        return ANONYMOUS
    persona = PERSONAS.get(header_value.strip())
    if persona is None:
        return Persona(header_value.strip(), header_value.strip(), VIEWER)
    return persona
