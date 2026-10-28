import os
import sqlite3
from contextlib import contextmanager
from typing import Iterator

DEFAULT_DB_PATH = os.environ.get("FEATURE_FLAGS_DB", "feature_flags.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS feature_flags (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
    enabled     INTEGER NOT NULL CHECK (enabled IN (0, 1)),
    updated_at  TEXT NOT NULL,
    updated_by  TEXT NOT NULL,
    UNIQUE (name, environment)
);

CREATE TABLE IF NOT EXISTS feature_flag_audit_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    flag_id          TEXT NOT NULL REFERENCES feature_flags(id),
    action           TEXT NOT NULL CHECK (action IN ('enable', 'disable')),
    previous_enabled INTEGER NOT NULL CHECK (previous_enabled IN (0, 1)),
    new_enabled      INTEGER NOT NULL CHECK (new_enabled IN (0, 1)),
    actor_id         TEXT NOT NULL,
    actor_name       TEXT NOT NULL,
    reason           TEXT NOT NULL DEFAULT '',
    created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_flag_created
    ON feature_flag_audit_events (flag_id, created_at DESC, id DESC);
"""


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def init_schema(conn: sqlite3.Connection, reset: bool = False) -> None:
    if reset:
        conn.executescript(
            "DROP TABLE IF EXISTS feature_flag_audit_events; DROP TABLE IF EXISTS feature_flags;"
        )
    conn.executescript(SCHEMA)


@contextmanager
def transaction(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """IMMEDIATE transaction so two writers serialize at BEGIN instead of at COMMIT."""
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    else:
        conn.execute("COMMIT")
