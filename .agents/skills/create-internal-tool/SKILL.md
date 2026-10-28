---
name: create-internal-tool
description: Build a new internal application for the Fintech Operations Console from a structured spec in specs/<app_id>.yaml, reusing the shared shell, components and API conventions. Use when asked to implement, extend or add an internal tool/app from a specification.
---

# Create an internal tool from a specification

This is a repeatable engineering procedure, not a code generator. Follow the
steps in order; do not skip the inspection, verification or retrospective steps.
Before step 1, read `LEARNINGS.md` (next to this file): its "Still open" lines are the
known gaps you are most likely to hit.

## 1. Read the specification
- Open `specs/<app_id>.yaml`. The filename **is** `app.id` (snake_case; AGENTS.md rule 8).
  Check it parses: `python -c "import sys, yaml; yaml.safe_load(open(sys.argv[1]))" specs/<app_id>.yaml`.
- The spec format is documented field by field in `specs/README.md`; new specs start from
  `specs/TEMPLATE.yaml`. Mandatory sections: app, roles, data_model, business_rules (each with
  `on_violation`), api, pages, seed_data, acceptance_criteria, non_goals. Domain sections vary: a state machine has
  `workflow`, an environment-scoped tool has `environments`; follow `specs/kyc.yaml` and
  `specs/feature_flags.yaml` for the shape.
- Note every business rule's `on_violation` status/code — the backend must return exactly those.
- UI ↔ API binding: honour an explicit `source:` / `calls:` on a page element; otherwise apply the
  default mapping table in `specs/README.md` (list → `GET /<entities>`, detail → `GET /<entities>/{id}`,
  action → `POST /<entities>/{id}/<action>`, options → `GET /meta`).
- `roles` refer to the global persona roles in `backend/app/core/personas.py`; there are no
  per-app roles yet. If the spec needs one, record the mapping as an assumption.
- If something essential is missing, make a sensible decision, write it down in
  `docs/IMPLEMENTATION_LOG.md` under "Assumptions", and keep going. Do not block on clarifications.

## 2. Inspect what already exists
- `AGENTS.md` — architecture and conventions (read fully).
- Backend shared code: `backend/app/core/` (`db.py` transactions, `errors.py` error types,
  `personas.py` roles, `time.py` timestamps, `registry.py` app registration).
- Frontend shared code: read `frontend/src/shared/components/index.ts` for the current component
  list (do not rely on any prose list), plus `shared/hooks.ts` (`useDebounced`, `useUrlParam`),
  `shared/format.ts`, `shared/persona/`, `shared/api/client.ts`, `shared/api/useQuery.ts`,
  `shared/layout/AppShell.tsx`, `apps/registry.ts`.
- Existing apps under `backend/app/apps/` and `frontend/src/apps/` — copy their structure.
  App-local idioms worth copying: `rules.py` (enums + transition/editability table),
  `labels.tsx` (domain → badge tone/label maps and `*Pill` components).

## 3. Reuse before you build
- Use the shared components for tables, filters, badges, detail panels, confirmations and toasts.
- Use `AppError` subclasses for rule violations and `transaction()` for multi-statement writes.
- Only add a new shared component if the current app needs it *and* it is generic. Put
  app-specific UI in `frontend/src/apps/<app_id>/`.
- If you change anything under `shared/` or `core/`, the existing apps are your regression
  suite: run the full `pytest` and `npm test`, and re-verify the affected flow of each existing
  app in the browser (a prop added to `ConfirmDialog` once silently changed KYC's dialog).

## 4. Implement the backend app
Create `backend/app/apps/<app_id>/` with:
- `__init__.py` exporting `APP_ID`, `TABLES`, `SCHEMA_SQL`, `seed`, `router`.
- `schema.py` (DDL), `seed.py` (deterministic synthetic data), `repository.py` (SQL only),
  `service.py` (business rules, raises `AppError`s), `schemas.py` (Pydantic models), `router.py`.
- Register the module in `backend/app/core/registry.py`.
- Enforce every business rule in `service.py`; the router only parses input and maps output.
- Timestamps: `utc_now_iso()` / `to_iso()` / `SEED_EPOCH` from `app/core/time.py` — never a
  local `_now()`. State-changing writes: read the current row *inside* `transaction()` and
  update conditionally (`WHERE <field> = <previous>`), raising `InvalidTransitionError` when
  `rowcount == 0`.

## 5. Implement the frontend app
Create `frontend/src/apps/<app_id>/` with `types.ts`, `api.ts` (typed calls via `api`),
`labels.tsx`, page components, and register the app in `frontend/src/apps/registry.ts`.
- List page: `FilterBar` + `SearchInput` (debounce with `useDebounced`) + `SelectFilter`s,
  `DataTable`, selected record kept in the URL with `useUrlParam('<thing>')`.
- Detail: `DetailPanel` + `DescriptionList` + `Section`s; history via `AuditTimeline`.
- Cover loading, empty and error states; confirm consequential actions with `ConfirmDialog`
  (`requireReason` or `collectReason`); show backend error messages verbatim; toast on success.

## 6. Tests for the acceptance criteria
- One pytest module per app in `backend/tests/test_<app_id>.py`.
- Each `acceptance_criteria` entry in the spec gets at least one test, named `test_ac<N>_...`.
- Tests use the `client` fixture (real FastAPI app + real SQLite file); never mock the service layer.
- Extra tests beyond the ACs are named `test_<what>` (e.g. `test_unknown_case_returns_404`).
- Every conditional write gets a concurrency test with two connections (pattern:
  `tests/test_core.py::test_transaction_takes_the_write_lock_up_front`), not only a
  monkeypatched stale read.

## 7. Run everything
```bash
cd backend && python -m app.cli init-db --reset --seed && python -m pytest   # full suite, not only test_<app_id>.py
cd frontend && npm run typecheck && npm test && npm run build
cd backend && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev
```
Then walk the browser flow in the spec's browser acceptance criterion. If a browser tool is
available, use it; otherwise state clearly that browser verification was not performed.

## 8. Fix failures
Fix real failures in the code. Never weaken a test, and never claim a test passed without
running it.

## 9. Summarize
Append to `docs/IMPLEMENTATION_LOG.md`: what was built, which shared components were reused,
assumptions made, tests executed with actual results, known limitations, and the two numbers the
template exists to improve: elapsed time (first command → PR) and lines changed in `shared/`
+ `core/` versus in the app module (`git diff --stat`). Open a PR whose description links to the spec.

## 10. Retrospective — make the template better than you found it
Append an entry to `.agents/skills/create-internal-tool/LEARNINGS.md` using its template, then
apply its promotion rules **in the same PR**: anything guessed for the second time becomes a rule
in `AGENTS.md` or this Skill; anything copied from an existing app for the second time is promoted
to `core/` or `shared/` and both apps use it; anything a review or browser run caught that the
tests did not gets a regression test. Keep this file short — point at code rather than add prose.
The PR description links the LEARNINGS entry.
