# Implementation log

Concise record of what was built, in order, so the work can be shown accurately.
Times are approximate wall-clock from the start of the session.

## Milestone 1 — Internal Tools Template foundation (PR #1)

**Goal:** establish the minimum reusable foundation before writing any KYC-specific code.

Delivered:
- `specs/kyc.yaml` — structured requirements: roles, data model, workflow transitions,
  business rules (with required HTTP status/code per violation), API, pages, seed data,
  10 acceptance criteria, non-goals.
- `AGENTS.md` — architecture, layering rules, error/audit/authorization conventions, run & test commands.
- `.agents/skills/create-internal-tool/SKILL.md` — 9-step repeatable procedure for building an app from a spec.
- Backend foundation (`backend/app/core/`): SQLite connection + `transaction()` helper,
  `init_db` driven by an app registry, uniform `AppError` → JSON error handler,
  DEV-ONLY persona fixture with `require_role()`, `python -m app.cli init-db` command,
  pytest fixtures (seeded temp DB + TestClient).
- Frontend foundation (`frontend/src/shared/`): AppShell with registry-driven sidebar and
  persona switcher, DataTable, FilterBar (Search/Select), StatusBadge, DetailPanel +
  DescriptionList, ConfirmDialog (with required reason), Toast, Loading/Empty/Error states,
  Button, PageHeader, typed `apiFetch`/`ApiError`, `useQuery` hook, app registry.

Decisions:
- Stack as requested: React 18 + TS + Vite 5 + Tailwind 3; FastAPI; SQLite via stdlib `sqlite3` (no ORM).
  Pinned to stable majors after the Vite template's bleeding-edge defaults (Vite 8 / TS 7 / React 19.3)
  failed to install under npm 10.
- Permissions via an explicit `X-Demo-User` header + persona table, clearly labelled dev-only.
- Case detail is a side panel over the queue (`/kyc?case=ID`) so the URL stays shareable.

Verification: `pytest` 2/2 (health, personas); `npm run typecheck` clean; `npm run build` clean.

## Assumptions

- "Assigned reviewer" is informational; any reviewer may act on any case (no assignment enforcement).
- Approved/rejected are terminal; escalated cases can be approved or rejected but not re-escalated.

## Milestone 2 — KYC Review Queue (PR #2, built by following the Skill against `specs/kyc.yaml`)

Delivered:
- Backend module `backend/app/apps/kyc/` — schema (2 tables, CHECK + FK), `rules.py` transition table,
  deterministic seed (24 cases, historical audit events for non-pending cases), repository (SQL only),
  service (BR-1..BR-6, status + audit in one transaction), router (`/api/kyc/meta|cases|cases/{id}|cases/{id}/actions`).
- Frontend module `frontend/src/apps/kyc/` — `KycQueuePage` (debounced search, status/risk filters,
  7-column `DataTable`, selected case in URL), `CaseDetailPanel` (summary, findings, audit history,
  reviewer-only action buttons driven by backend `allowed_actions`, `ConfirmDialog` with required reason,
  inline backend error, success toast, list refetch).
- `backend/tests/test_kyc.py` — AC-1..AC-9 plus 404 and meta.

Template components reused (no new shared code was needed): `AppShell`, `DataTable`, `FilterBar`/`SearchInput`/`SelectFilter`,
`StatusBadge`, `DetailPanel`/`DescriptionList`/`Section`, `ConfirmDialog`, `Toast`, `LoadingState`/`EmptyState`/`ErrorState`,
`Button`, `PageHeader`, `api`/`ApiError`/`buildQuery`, `useQuery`, `PersonaContext`; backend `transaction()`, `AppError` family,
`require_role()`, registry/`init_db`/CLI, pytest fixtures.

Verification (actual output):
```
backend  $ python -m app.cli init-db --reset --seed   → [kyc] seeded 24 records
backend  $ python -m pytest                           → 13 passed, 2 warnings in 0.32s
frontend $ npm run typecheck                          → clean
curl :8000/api/health                                 → {"status":"ok","apps":["kyc"]}
curl -X POST :5173/api/kyc/cases/KYC-1001/actions (no persona header)
                                                      → 403 {"error":{"code":"forbidden",...}}   (viewer fallback through the Vite proxy)
```
Browser walkthrough (AC-10): performed by Devin's testing agent against the local Vite + FastAPI app (recording attached to PR #2).
Passed: 24-case queue with all 7 columns; search by name/id, status/risk filters, combined filter, clear, empty state;
row click + keyboard Enter open the panel, URL `?case=` survives reload, Escape/backdrop close; findings and history render;
viewer sees no actions, reviewer sees exactly the allowed actions per state; confirm disabled for empty/whitespace reason;
approve → toast, badge/table/timestamp update, audit entry with the exact reason; reason field empty when starting the next
action; state survives hard refresh **and a real backend restart**; escalate → reject shows two newest-first events;
forced requests return 403 / 409 / 422 with no mutation; 400px viewport usable (mobile nav, horizontal table scroll).

## Milestone 1.1 — Devin Review fixes on PR #1

- `specs/kyc-review.yaml` did not parse as YAML (`roles.note` inside a list; unquoted `enum [...]` flow value). Fixed; file
  renamed to `specs/kyc.yaml` to match the `specs/<app_id>.yaml` convention the Skill documents; validated with `yaml.safe_load`.
- `ConfirmDialog` kept the previous reason in state when re-opened while mounted → a stale reason could be written to the
  audit trail. Now resets on every open.
- `DataTable` clickable rows were not keyboard reachable → `tabIndex=0`, `role=button`, Enter/Space activation, only when the
  row itself (not a nested control) is the event target.

## Milestone 3 — Fixes from browser testing

- Audit history rendered "Rejectd by …" (label + "d"). Added explicit past-tense labels.
- A stale detail panel (another reviewer acted first) showed the 409 inline but kept stale status/buttons after Cancel.
  Failed actions now refetch the case and the queue so the UI reconciles to the backend state. Both re-verified in the browser.

## Milestone 4 — Audit and P0 fixes

- `AUDIT.md` written (functional matrix, template completeness, Power Apps comparison, risks, P0/P1/P2, verdict).
- P0 fixes landed: naming unified to **Internal Tools Template** (PR #1 replaced by PR #3 on `devin/internal-tools-template`);
  stale `kyc-review.yaml` references and Node version claim corrected; `init-db --seed` skips non-empty tables with a hint;
  `RequestValidationError` and unexpected exceptions now use the `{"error": {...}}` envelope; KYC transition check moved
  inside the write transaction with a conditional `UPDATE … WHERE status = ?` guard (409 on conflict); `reason` ≤ 2000 chars,
  `q` ≤ 100 chars. Two new tests: envelope/limits and a simulated stale-read conflict.

Verification: `python -m pytest` → **15 passed**.
