"""SQLite access layer shared by every internal app.

Conventions:
- One database file (``DATABASE_PATH`` env var, default ``backend/data/console.db``).
- Each app module owns its own tables and declares them in ``SCHEMA_SQL``.
- Request handlers obtain a connection through the ``get_db`` dependency.
- Writes that must be atomic (e.g. a status change plus its audit event) run
  inside ``transaction(conn)`` so they commit or roll back together.
"""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "console.db"


def database_path() -> Path:
    return Path(os.environ.get("DATABASE_PATH", DEFAULT_DB_PATH))


def connect(path: Path | None = None) -> sqlite3.Connection:
    path = path or database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def transaction(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """Run a block as a single transaction; roll back on any exception."""
    try:
        conn.execute("BEGIN")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency: one connection per request."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


def init_db(conn: sqlite3.Connection, *, seed: bool = False, reset: bool = False) -> list[str]:
    """Create tables for every registered app; optionally reset and seed them.

    Returns a list of human-readable log lines.
    """
    from app.core.registry import installed_apps

    log: list[str] = []
    for module in installed_apps():
        if reset:
            for table in reversed(module.TABLES):
                conn.execute(f"DROP TABLE IF EXISTS {table}")
            log.append(f"[{module.APP_ID}] dropped tables: {', '.join(module.TABLES)}")
        conn.executescript(module.SCHEMA_SQL)
        log.append(f"[{module.APP_ID}] schema ensured ({len(module.TABLES)} tables)")
        if seed:
            first_table = module.TABLES[-1] if module.TABLES else None
            existing = conn.execute(f"SELECT COUNT(*) FROM {first_table}").fetchone()[0] if first_table else 0
            if existing:
                log.append(
                    f"[{module.APP_ID}] skipped seeding: {first_table} already has {existing} rows "
                    "(use --reset --seed to reseed)"
                )
            else:
                inserted = module.seed(conn)
                log.append(f"[{module.APP_ID}] seeded {inserted} records")
    conn.commit()
    return log
