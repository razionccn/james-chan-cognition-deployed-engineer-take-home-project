# Fintech Operations Console — Internal Tool Development Template + KYC Review Queue

Proof of concept for a Cognition Deployed Engineer case study: a repeatable
**Internal Tool Development Template** (the "Golden Path" in the case brief) for building
internal business tools with Devin, and a working **KYC Review Queue** built by following it.

The chain it demonstrates:

> Structured spec (`specs/kyc.yaml`) → reusable template (`AGENTS.md`, Skill, shared shell/components/services) → Devin implementation (PR #2) → functional KYC review app → verified behaviour (pytest acceptance tests + browser walkthrough)

All data is synthetic. The persona switcher is a development-only fixture, not authentication.

---

## 1. What this demonstrates (and the Power Apps context)

A fintech team runs KYC review, refunds and feature-flag tools in Power Apps (~$250K/yr) and
needs ten more. This repo shows the alternative: a small, conventional code console where each
internal tool is a thin module on a shared foundation, and where **Devin builds the next tool from a
structured spec by following a written procedure** — not by free-form prompting.

- The **KYC Review Queue** is the representative tool: queue, filters, case detail, approve / reject /
  escalate with mandatory reason, backend-enforced transitions and roles, persisted audit trail.
- The **template** is what makes tool #2..#13 cheap: the spec format, the repository rules, the
  Devin Skill, and the shared components/services the KYC app reuses.

## 2. How Devin was used

1. The brief was turned into a structured spec, `specs/kyc.yaml` (roles, data model, workflow,
   business rules with the exact HTTP error each violation must return, API, pages, acceptance criteria).
2. Devin established the template first — [PR #1](https://github.com/razionccn/james-chan-cognition-deployed-engineer-take-home-project/pull/1):
   `AGENTS.md`, `.agents/skills/create-internal-tool/SKILL.md`, shared backend core and frontend shell/components. No KYC code.
3. Devin then followed the Skill against the spec to produce the KYC app — [PR #2](https://github.com/razionccn/james-chan-cognition-deployed-engineer-take-home-project/pull/2):
   backend module, frontend module, one pytest per acceptance criterion.
4. Devin Review ran on the PRs; its findings (a YAML syntax error in the spec, a stale-reason bug in
   `ConfirmDialog`, keyboard accessibility of table rows) were fixed in-session. See `docs/IMPLEMENTATION_LOG.md`.

## 3. Architecture

```
frontend/  React 18 + TypeScript + Vite + Tailwind      ──/api──▶  backend/  FastAPI + stdlib sqlite3  ──▶  backend/data/console.db
```

| Layer | Path | Notes |
|---|---|---|
| Spec | `specs/<app_id>.yaml` | Source of truth per tool |
| Repo instructions | `AGENTS.md` | Architecture rules, conventions, run/test commands |
| Devin Skill | `.agents/skills/create-internal-tool/SKILL.md` | 9-step procedure: read spec → inspect → reuse → implement → test → run → fix → summarise |
| Backend core | `backend/app/core/` | `db.py` (connection, `transaction()`, `init_db`), `errors.py` (uniform error envelope), `personas.py` (dev-only roles), `registry.py` |
| Backend app | `backend/app/apps/kyc/` | `router → service → repository`, `schema.py`, `seed.py`, `rules.py`, `schemas.py` |
| Frontend shared | `frontend/src/shared/` | `AppShell`, `DataTable`, `FilterBar`, `StatusBadge`, `DetailPanel`, `ConfirmDialog`, `Toast`, states, `api` client, `useQuery` |
| Frontend app | `frontend/src/apps/kyc/` | `KycQueuePage`, `CaseDetailPanel`, typed `api.ts` |
| Tests | `backend/tests/` | `conftest.py` (seeded temp DB + TestClient), `test_core.py`, `test_kyc.py` |
| Log | `docs/IMPLEMENTATION_LOG.md` | Milestones, decisions, assumptions, actual test output |

Key decisions
- **Business rules live only in the backend** (`service.py`). The UI hides disallowed actions for UX, but every rule is re-checked server-side.
- **No ORM.** SQLite via the standard library keeps dependencies minimal and makes the status-update + audit-insert transaction explicit (`transaction(conn)`).
- **Workflow as data.** `rules.py` holds `TRANSITIONS = {(action, from_status): to_status}`; the API exposes `allowed_actions` so the UI never hard-codes the state machine.
- **Simulated identity.** `X-Demo-User` header → persona → role. Clearly a fixture; `require_role()` is the seam a real IdP replaces.

## 4. Running locally

Prerequisites: Python 3.10+, Node 20+ (tested with Python 3.10 / Node 22 / npm 10).

```bash
# backend
cd backend
pip install -r requirements.txt
python -m app.cli init-db --reset --seed          # creates backend/data/console.db with 24 synthetic cases
uvicorn app.main:app --reload --port 8000         # http://localhost:8000/api/health

# frontend (second terminal)
cd frontend
npm install
npm run dev                                       # http://localhost:5173  (proxies /api -> :8000)
```

Open **http://localhost:5173/kyc**. Use the persona switcher (top of sidebar) to act as
`Ana Okafor (reviewer)`, `Ben Castillo (reviewer)` or `Vic Lindqvist (viewer)`. Re-run
`init-db --reset --seed` at any time to restore the demo data.

## 5. Tests

```bash
cd backend && python -m pytest          # 13 passed  (2 core + 11 KYC)
cd frontend && npm run typecheck        # tsc -b, clean
cd frontend && npm run build            # production build, clean
```

`backend/tests/test_kyc.py` maps 1:1 to the spec's acceptance criteria and runs through the real
FastAPI app and a real SQLite file (no mocks):

| Test | Verifies |
|---|---|
| `test_ac1_list_returns_all_seeded_cases` | list endpoint, 24 cases, required columns |
| `test_ac2_filters_by_status_risk_and_search` | status + risk filters, search by name and by id, invalid filter → 422 |
| `test_ac3_reviewer_can_approve_pending_case` | pending → approved, `updated_at` changes |
| `test_ac4_invalid_transition_is_rejected_and_case_unchanged` | terminal cases and escalate-on-escalated → 409, no mutation |
| `test_ac5_missing_reason_is_rejected` | `""`, whitespace, absent reason → 422, no mutation |
| `test_ac6_review_persists_across_new_connection_and_app_restart` | fresh connection + fresh app instance still see the new status |
| `test_ac7_successful_action_creates_exactly_one_audit_event` | exactly +1 row with case, prev/new status, actor, reason, timestamp |
| `test_ac8_viewer_cannot_modify` | viewer, missing and unknown persona → 403 |
| `test_ac9_escalated_case_can_be_approved_or_rejected` | escalated → approved / rejected |
| `test_unknown_case_returns_404`, `test_meta_exposes_transitions` | 404 envelope; transition table |

Browser verification (AC-10): see `docs/IMPLEMENTATION_LOG.md` for what was actually walked through.

## 6. Building the next internal tool with the template

1. Write `specs/<app_id>.yaml` with the same sections as `specs/kyc.yaml`.
2. Ask Devin: *"Use the `create-internal-tool` skill to implement `specs/<app_id>.yaml`."*
3. Devin follows `.agents/skills/create-internal-tool/SKILL.md`: reads the spec and `AGENTS.md`,
   inspects `shared/` and the existing apps, reuses the shell/table/filters/badges/panel/dialog/toast
   and the error/transaction/persona conventions, adds `backend/app/apps/<app_id>/` and
   `frontend/src/apps/<app_id>/`, registers both, writes `tests/test_<app_id>.py` (one per acceptance
   criterion), runs everything, fixes failures, and records the result in `docs/IMPLEMENTATION_LOG.md`.
4. Review the PR. The spec + tests make "did it build what we asked" a checklist rather than a judgement call.

A refunds or feature-flag tool would add roughly: one schema, one seed, one service with its own
rules, one router, one page — and zero new shared infrastructure unless the spec genuinely needs it.

## 7. Known limitations (read before demoing)

- **Synthetic data only.** Names, emails, findings and risk scores are invented. No documents are stored.
- **Simulated permissions.** `X-Demo-User` is a dev-only header; anyone can send it. There is no
  authentication, session, or SSO. Production needs an identity provider (OIDC/SAML) and a real
  authorization policy wired in at `require_role()`.
- **No real KYC provider, sanctions screening, or case assignment workflow.** "Assigned reviewer" is informational.
- **No security or compliance certification**, no rate limiting, no CSRF/CORS hardening beyond localhost.
- **No deployment, monitoring, backups or migrations.** SQLite file on disk; schema is `CREATE TABLE IF NOT EXISTS` only.
- **No evidence of long-term cost savings.** This shows build feasibility and repeatability, not TCO.
- Single-user assumptions: no optimistic locking; two reviewers acting on the same case at once get last-write-wins (the audit trail still records both).

## 8. Implementation evidence

What Devin implemented: everything in this repository except the initial README commit.

Tests executed and results (actual output, this session):
```
backend  $ python -m pytest        → 13 passed, 2 warnings in 0.32s
frontend $ npm run typecheck       → tsc -b (no errors)
frontend $ npm run build           → ✓ built
```

Corrections made during the session
- Vite's current template (Vite 8 / TS 7 / React 19.3) failed to install under npm 10 → pinned React 18 / Vite 5 / TS 5 / Tailwind 3.
- Devin Review on PR #1: spec YAML did not parse (list/map mix, unquoted `enum [...]`) → fixed and validated with `yaml.safe_load`; spec renamed to `specs/kyc.yaml` to match the `specs/<app_id>.yaml` convention; `ConfirmDialog` reset its reason on every open; `DataTable` rows made keyboard-navigable without stealing Enter from nested controls.

Not completed / out of scope: feature-flag second module (stretch goal, not built — reuse is
demonstrated by the template structure and the KYC module, not by a second app), production
identity, deployment, pagination.

## 9. Recommended next steps for production readiness

1. Replace personas with an IdP (OIDC) and a policy layer; keep `require_role()` as the enforcement point.
2. Move from SQLite to Postgres with migrations (Alembic or plain SQL), keeping the `repository.py` boundary.
3. Add optimistic concurrency (`expected_status` on review actions) and idempotency keys.
4. Add structured logging/metrics, CI (pytest + typecheck + build), and a Playwright smoke test for the queue flow.
5. Build the second tool (refunds or feature flags) from a spec to measure the real marginal cost of a new module.
