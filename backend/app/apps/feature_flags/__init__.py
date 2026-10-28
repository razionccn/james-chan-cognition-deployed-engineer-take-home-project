"""Feature-Flag Admin Panel — installed app module (contract: app/core/registry.py)."""
from .router import router
from .schema import SCHEMA_SQL, TABLES
from .seed import seed

APP_ID = "feature_flags"

__all__ = ["APP_ID", "TABLES", "SCHEMA_SQL", "seed", "router"]
