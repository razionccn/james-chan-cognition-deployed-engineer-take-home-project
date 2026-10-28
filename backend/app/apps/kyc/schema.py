"""DDL for the KYC Review Queue. Tables are owned by this app only; TABLES is in drop order (children first)."""

TABLES = ["kyc_audit_events", "kyc_cases"]

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS kyc_cases (
    id                TEXT PRIMARY KEY,
    customer_name     TEXT NOT NULL,
    customer_email    TEXT NOT NULL,
    country           TEXT NOT NULL,
    account_type      TEXT NOT NULL CHECK (account_type IN ('individual', 'business')),
    risk_level        TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    status            TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'escalated')),
    submitted_at      TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    assigned_reviewer TEXT,
    findings_json     TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS kyc_audit_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id         TEXT NOT NULL REFERENCES kyc_cases(id) ON DELETE CASCADE,
    action          TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'escalate')),
    previous_status TEXT NOT NULL,
    new_status      TEXT NOT NULL,
    actor_id        TEXT NOT NULL,
    actor_name      TEXT NOT NULL,
    reason          TEXT NOT NULL,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kyc_cases_status ON kyc_cases(status);
CREATE INDEX IF NOT EXISTS idx_kyc_cases_risk ON kyc_cases(risk_level);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_case ON kyc_audit_events(case_id, created_at);
"""
