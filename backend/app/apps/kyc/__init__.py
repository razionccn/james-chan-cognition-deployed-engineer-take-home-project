"""KYC Review Queue — installed app module (contract: app/core/registry.py)."""
from .router import router
from .schema import SCHEMA_SQL, TABLES
from .seed import seed

APP_ID = "kyc"

__all__ = ["APP_ID", "TABLES", "SCHEMA_SQL", "seed", "router"]
