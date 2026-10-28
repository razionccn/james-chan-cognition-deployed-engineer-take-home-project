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

## Milestone 5 — Feature-Flag Admin Panel (second app, fresh session, built by following the Skill against `specs/feature_flags.yaml`)

Full measurements, timeline and skeptical evaluation: `docs/FEATURE_FLAG_BUILD_METRICS.md`.
Baseline `0364651` (main) → final code commit `be1f095`. Session: https://app.devin.ai/sessions/929c6363efd14330b0ab305373bc0200

- `specs/feature_flags.yaml`: 14 flags across development / staging / production; AC-1 … AC-10; non-goals (no real
  provider, no CRUD, no rollouts, no SSO, no pagination).
- Backend `app/apps/feature_flags/`: `feature_flags` + `feature_flag_audit_events` tables; `GET /meta`, `GET /flags`
  (`q`, `environment`, `enabled`), `GET /flags/{id}` (detail + audit events), `POST /flags/{id}/toggle`
  (`{enabled, reason?}`). Rules in `service.py`: reviewer only (403 `forbidden`), production locked
  (403 `environment_locked`), unknown → 404, no-op → 409, reason ≤ 500 chars; conditional
  `UPDATE … WHERE enabled = ?` + audit insert inside one `transaction()`.
- Frontend `apps/feature_flags/`: list page (search, environment + state filters, debounced, URL-selected row), detail
  panel (description list, change history, footer with lock / read-only notice and `Toggle`), `ConfirmDialog` with
  optional reason, toast, backend error shown inline, refetch on success and on failure.
- Shared changes: `Toggle` component (new, generic), `ConfirmDialog.collectReason` (optional reason field),
  both registries. KYC files untouched.

Assumptions / decisions (repository had no guidance)
- Flag writes reuse the global `reviewer` role rather than adding an app-scoped role to `personas.py`.
- `development` is editable like `staging`; only `production` is locked (the brief mandates staging editable and
  production locked and is silent on development).
- Reason is optional for flag toggles (the brief says "simple" toggles), unlike KYC where it is mandatory.
- Re-sending the current state is a 409 `invalid_transition`, consistent with KYC's invalid-action handling.

Tests (actual output): `python -m pytest -o addopts="" -q -p no:warnings` → **28 passed in 0.66s**
(2 core + 13 KYC unchanged + 13 feature-flag). `npm run typecheck` clean; `npm run build` ✓.
First run after writing the tests was `1 failed, 27 passed`: the test sent `"enabled": "yes"` expecting 422 but
Pydantic lax mode coerces it to `true`; the test was corrected, the API was not changed.

Browser verification (testing agent, recorded): run #1 at `085d208` — 7/8 PASS; FAIL: the toggle confirmation had
no optional reason field because `ConfirmDialog` only rendered it when required. Fixed (`collectReason`), run #2 at
`be1f095` — PASS, and KYC's Reject dialog still requires a reason.

Known limitations: simulated personas (not auth); no app-scoped roles; audit table/timeline duplicated from KYC
by convention rather than shared; no frontend tests / CI; concurrency guard tested with a simulated stale read only.

Post-review (Devin Review on PR #5): `transaction()` in `core/db.py` switched to `BEGIN IMMEDIATE` after reproducing a
`database is locked` 500 when a competing write committed between the read and the conditional `UPDATE` (affects KYC
too); seed audit timestamps aligned with the flags' `updated_at`. `pytest` → **28 passed**. Spec filename
(`feature_flags.yaml` vs `<app_id>.yaml`) escalated to the owner because the brief named the file explicitly.

## Milestone 6 — Template audit after two apps and its P0/P1 fixes (PR #5)

`docs/TEMPLATE_AUDIT.md` scores the Skill, AGENTS.md/template code and the spec files against what the two builds
actually needed (7 / 6.5 / 7 out of 10). Fixes applied in the same PR, each as its own commit: shared `core/time.py`
timestamp helpers (both apps' private `_now`/`_iso` removed); `test_core` checks `specs/<APP_ID>.yaml` exists and matches
and that `transaction()` holds the write lock against a second connection; shared `useDebounced`/`useUrlParam` hooks and
`AuditTimeline` component (both apps migrated, −60 lines); AGENTS.md rules 7–9 and a refreshed shared-code map; Skill
steps rewritten where the two builds had to guess; spec headers state the conventions and AC-10 is a checklist; CI
workflow + first Vitest test (`ConfirmDialog`). Verification: `pytest` → 35 passed; `tsc -b` clean; `npm test` → 4 passed;
`vite build` clean. Deferred (P2): per-app roles, form primitives, spec schema, Playwright.

