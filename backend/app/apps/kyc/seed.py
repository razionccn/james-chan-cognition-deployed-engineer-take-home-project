"""Deterministic synthetic KYC cases. No real people, documents or PII."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone

BASE = datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _findings(risk: str, status: str) -> list[dict[str, str]]:
    doc = {"check": "Government ID document", "result": "pass", "detail": "Document authenticity checks passed."}
    face = {"check": "Selfie / liveness match", "result": "pass", "detail": "Face match confidence 0.97."}
    addr = {"check": "Proof of address", "result": "pass", "detail": "Utility bill dated within 90 days."}
    sanctions = {"check": "Sanctions & PEP screening", "result": "pass", "detail": "No matches on screened lists."}
    adverse = {"check": "Adverse media", "result": "pass", "detail": "No adverse media found."}
    if risk == "medium":
        addr = {"check": "Proof of address", "result": "warn", "detail": "Address differs from ID document; secondary proof provided."}
        adverse = {"check": "Adverse media", "result": "warn", "detail": "One low-relevance news mention; manual review suggested."}
    if risk == "high":
        face = {"check": "Selfie / liveness match", "result": "warn", "detail": "Face match confidence 0.81 (below 0.9 threshold)."}
        sanctions = {"check": "Sanctions & PEP screening", "result": "fail", "detail": "Possible name match on PEP list; requires analyst confirmation."}
        adverse = {"check": "Adverse media", "result": "warn", "detail": "Multiple mentions related to a regulatory inquiry."}
    if status == "rejected":
        doc = {"check": "Government ID document", "result": "fail", "detail": "Document expired / tampering indicators detected."}
    return [doc, face, addr, sanctions, adverse]


# (name, country, account_type, risk, status, assigned_reviewer, days_ago)
_ROWS: list[tuple[str, str, str, str, str, str | None, int]] = [
    ("Amelia Hartwell", "GB", "individual", "low", "pending", "ana.reviewer", 1),
    ("Rafael Ortega", "ES", "individual", "medium", "pending", "ben.reviewer", 1),
    ("Northwind Holdings Ltd", "GB", "business", "high", "pending", "ana.reviewer", 2),
    ("Priya Raman", "IN", "individual", "low", "pending", None, 2),
    ("Tobias Lindgren", "SE", "individual", "low", "pending", "ben.reviewer", 3),
    ("Chen Wei", "SG", "individual", "medium", "pending", "ana.reviewer", 3),
    ("Blue Harbor Logistics", "NL", "business", "medium", "pending", None, 4),
    ("Fatima Al-Sayed", "AE", "individual", "high", "pending", "ben.reviewer", 4),
    ("Lucas Moreau", "FR", "individual", "low", "pending", "ana.reviewer", 5),
    ("Grace Okonkwo", "NG", "individual", "medium", "pending", None, 6),
    ("Summit Ridge Capital", "US", "business", "high", "pending", "ana.reviewer", 6),
    ("Daniel Kim", "KR", "individual", "low", "pending", "ben.reviewer", 7),
    ("Isabella Rossi", "IT", "individual", "high", "escalated", "ana.reviewer", 8),
    ("Oakfield Trading GmbH", "DE", "business", "high", "escalated", "ben.reviewer", 9),
    ("Mateus Silva", "BR", "individual", "medium", "escalated", "ana.reviewer", 10),
    ("Hannah Fischer", "AT", "individual", "medium", "escalated", None, 11),
    ("Noah Williams", "US", "individual", "low", "approved", "ben.reviewer", 12),
    ("Sofia Petrova", "BG", "individual", "low", "approved", "ana.reviewer", 13),
    ("Kenji Watanabe", "JP", "individual", "medium", "approved", "ben.reviewer", 14),
    ("Harborline Freight Inc", "CA", "business", "medium", "approved", "ana.reviewer", 15),
    ("Elena Vasquez", "MX", "individual", "low", "approved", "ben.reviewer", 16),
    ("Omar Haddad", "JO", "individual", "high", "rejected", "ana.reviewer", 17),
    ("Crestline Ventures LLC", "US", "business", "high", "rejected", "ben.reviewer", 18),
    ("Liam O'Connor", "IE", "individual", "medium", "rejected", "ana.reviewer", 19),
]

_REVIEWER_NAMES = {"ana.reviewer": "Ana Okafor", "ben.reviewer": "Ben Castillo"}

_HISTORY_REASONS = {
    "approved": "All verification checks passed; identity confirmed against submitted documents.",
    "rejected": "Submitted identity document failed authenticity checks.",
    "escalated": "Sanctions screening returned a possible match; needs senior review.",
}


def seed(conn: sqlite3.Connection) -> int:
    for index, (name, country, account_type, risk, status, reviewer, days_ago) in enumerate(_ROWS):
        case_id = f"KYC-{1001 + index}"
        submitted = BASE + timedelta(days=20 - days_ago, hours=index % 7)
        updated = submitted
        email = name.lower().replace("'", "").replace(" ", ".") + "@example.com"
        conn.execute(
            """INSERT INTO kyc_cases (id, customer_name, customer_email, country, account_type, risk_level,
                   status, submitted_at, updated_at, assigned_reviewer, findings_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (case_id, name, email, country, account_type, risk, "pending", _iso(submitted), _iso(updated),
             reviewer, json.dumps(_findings(risk, status))),
        )
        if status != "pending":
            actor = reviewer or "ana.reviewer"
            acted_at = submitted + timedelta(days=1, hours=3)
            action = {"approved": "approve", "rejected": "reject", "escalated": "escalate"}[status]
            conn.execute(
                """INSERT INTO kyc_audit_events (case_id, action, previous_status, new_status, actor_id, actor_name, reason, created_at)
                   VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)""",
                (case_id, action, status, actor, _REVIEWER_NAMES[actor], _HISTORY_REASONS[status], _iso(acted_at)),
            )
            conn.execute("UPDATE kyc_cases SET status = ?, updated_at = ? WHERE id = ?", (status, _iso(acted_at), case_id))
    return len(_ROWS)
