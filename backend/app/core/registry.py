"""Registry of installed internal apps.

Each app lives in ``app/apps/<app_id>/`` and exposes, from its package
``__init__``:

- ``APP_ID``      - short identifier (matches ``specs/<app_id>.yaml``)
- ``TABLES``      - table names it owns, in creation order
- ``SCHEMA_SQL``  - idempotent ``CREATE TABLE IF NOT EXISTS`` statements
- ``seed(conn)``  - inserts synthetic data; returns number of records
- ``router``      - FastAPI ``APIRouter`` mounted under ``/api/<app_id>``

To add an app: create the package, then append its import here.
"""

from types import ModuleType


def installed_apps() -> list[ModuleType]:
    return []
