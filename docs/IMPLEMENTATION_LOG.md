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

## Milestone 5 — Two ways to create an app: shared spec schema, form controls, "Request New App" wizard (PR #4)

Scope decision (from the brief's Part 6): ~2 h budget already consumed by build + audit. Implemented the three
highest-leverage items; the Feature-Flag app itself is **not** built — its spec is (`specs/feature_flags.yaml`).

Delivered:
- `backend/app/core/spec.py` — `spec_version: 1` schema (Pydantic, `extra=forbid`): app/category, roles+permissions,
  entities+typed fields, list/detail views, forms, workflow, audit, acceptance criteria; cross-reference checks
  (fields exist, filters filterable, states/initial/terminal/actions consistent, roles exist, audit required for writers,
  category requirements). Free-form sections (`business_rules`, `api`, `seed_data`, `non_goals`, `devin_notes`) pass through.
- `POST /api/specs/validate` (object or YAML text) → `{valid, errors[{path,message}], warnings, normalized, yaml}`;
  `GET /api/specs/schema` (JSON Schema), `GET /api/specs/meta`; CLI `python -m app.cli validate-spec <files>` (exit 1 on failure).
- `specs/kyc.yaml` migrated to the schema (same content, structured fields/views/workflow); validates clean.
- Shared form controls: `FormField`, `TextField`, `TextArea`, `SelectField`, `Toggle`, `CheckboxGroup`, `parseList`.
- `frontend/src/apps/request/` — 4-step wizard (basics → data → workflows & access → review). Category defaults seed a
  sensible starting point; `buildSpec.ts` maps the draft to a spec document; the backend validates it; the user gets a
  summary, the error list (with spec paths) or the YAML with copy/download, plus explicit manual hand-off steps and a
  Devin prompt. Draft persists in localStorage. **No persistence of requests, no automatic creation/deployment.**
- `specs/feature_flags.yaml` — produced from the wizard's output shape and validated; marked "specification only".
- Tests `backend/tests/test_spec.py` (16): kyc.yaml valid; wizard-shaped feature-flag spec valid (with expected warnings);
  11 parametrised invalid cases each reported with a path; crud-needs-form / id-not-editable; endpoint accepts object+YAML,
  rejects neither; CLI exit codes.

Verification (actual): `python -m pytest` → **31 passed**; `npm run typecheck` clean; `npm run build` clean;
`python -m app.cli validate-spec ../specs/*.yaml` → OK for both files.

Template components reused by the wizard: `PageHeader`, `Button`, `StatusBadge`, `ErrorState`, `LoadingState`, `useToast`,
`useQuery`, `api` client, `AppShell`/registry (the wizard is just another registered app) + the new form controls.

Honest status of automation:
- Automated: validation (same code path for CLI, API and wizard), YAML rendering, draft persistence in the browser.
- Manual: committing the spec to `specs/`, engineering review, asking Devin to implement, code review, merge.
- Not demonstrated: building a second app from a wizard-produced spec (Feature-Flag panel). The spec exists; the module does not.

Browser verification of the wizard (Devin testing agent, recording on PR #4): full admin-panel request → valid → YAML download →
downloaded file validated with the CLI; copy toasts; draft persistence and reset; six local step gates; backend errors shown
with spec path + Re-check; review-queue defaults and custom Escalate action; "nothing is automatic" copy present; KYC regression
(24 cases, approve + audit, new 422 envelope). Two fixes from testing: actions with a blank from/to are now gated locally;
the shared mobile header wraps instead of overflowing at 400px. Not independently verified: clipboard contents.
