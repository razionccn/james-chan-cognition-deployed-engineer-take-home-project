"""DDL for the Feature-Flag Admin Panel. Tables are owned by this app only."""

TABLES = ["feature_flags", "feature_flag_audit_events"]

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS feature_flags (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL,
    environment  TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
    enabled      INTEGER NOT NULL CHECK (enabled IN (0, 1)),
    updated_at   TEXT NOT NULL,
    updated_by   TEXT NOT NULL,
    UNIQUE (name, environment)
);

CREATE TABLE IF NOT EXISTS feature_flag_audit_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    flag_id          TEXT NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
    action           TEXT NOT NULL CHECK (action IN ('enable', 'disable')),
    previous_enabled INTEGER NOT NULL CHECK (previous_enabled IN (0, 1)),
    new_enabled      INTEGER NOT NULL CHECK (new_enabled IN (0, 1)),
    actor_id         TEXT NOT NULL,
    actor_name       TEXT NOT NULL,
    reason           TEXT NOT NULL DEFAULT '',
    created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_env ON feature_flags(environment);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_flag ON feature_flag_audit_events(flag_id, created_at);
"""
