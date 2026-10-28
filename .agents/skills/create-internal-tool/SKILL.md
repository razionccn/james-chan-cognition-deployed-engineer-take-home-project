---
name: create-internal-tool
description: Build a new internal application for the Fintech Operations Console from a structured spec in specs/<app>.yaml, reusing the shared shell, components and API conventions. Use when asked to implement, extend or add an internal tool/app from a specification.
---

# Create an internal tool from a specification

This is a repeatable engineering procedure, not a code generator. Follow the
steps in order; do not skip the inspection or verification steps.

## 1. Read the specification
- Open `specs/<app_id>.yaml`. Read every section: roles, data_model, workflow,
  business_rules, api, pages, seed_data, acceptance_criteria, non_goals.
- Note every business rule's `on_violation` status/code — the backend must return exactly those.
- If something essential is missing, make a sensible decision, write it down in
  `docs/IMPLEMENTATION_LOG.md` under "Assumptions", and keep going. Do not block on clarifications.

## 2. Inspect what already exists
- `AGENTS.md` — architecture and conventions (read fully).
- Backend shared code: `backend/app/core/` (`db.py` transactions, `errors.py` error types,
  `personas.py` roles, `registry.py` app registration).
- Frontend shared code: `frontend/src/shared/components/` (DataTable, FilterBar, StatusBadge,
  DetailPanel, ConfirmDialog, Toast, States, Button, PageHeader), `shared/api/client.ts`,
  `shared/api/useQuery.ts`, `shared/layout/AppShell.tsx`, `apps/registry.ts`.
- Existing apps under `backend/app/apps/` and `frontend/src/apps/` — copy their structure.

## 3. Reuse before you build
- Use the shared components for tables, filters, badges, detail panels, confirmations and toasts.
- Use `AppError` subclasses for rule violations and `transaction()` for multi-statement writes.
- Only add a new shared component if the current app needs it *and* it is generic. Put
  app-specific UI in `frontend/src/apps/<app_id>/`.

## 4. Implement the backend app
Create `backend/app/apps/<app_id>/` with:
- `__init__.py` exporting `APP_ID`, `TABLES`, `SCHEMA_SQL`, `seed`, `router`.
- `schema.py` (DDL), `seed.py` (deterministic synthetic data), `repository.py` (SQL only),
  `service.py` (business rules, raises `AppError`s), `schemas.py` (Pydantic models), `router.py`.
- Register the module in `backend/app/core/registry.py`.
- Enforce every business rule in `service.py`; the router only parses input and maps output.

## 5. Implement the frontend app
Create `frontend/src/apps/<app_id>/` with `types.ts`, `api.ts` (typed calls via `api`),
page components, and register the app in `frontend/src/apps/registry.ts`.
Cover loading, empty and error states; confirm consequential actions; show backend error
messages verbatim; toast on success.

## 6. Tests for the acceptance criteria
- One pytest module per app in `backend/tests/test_<app_id>.py`.
- Each `acceptance_criteria` entry in the spec gets at least one test, named `test_ac<N>_...`.
- Tests use the `client` fixture (real FastAPI app + real SQLite file); never mock the service layer.

## 7. Run everything
```bash
cd backend && python -m app.cli init-db --reset --seed && python -m pytest
cd backend && uvicorn app.main:app --reload --port 8000
cd frontend && npm run typecheck && npm run dev
```
Then walk the browser flow in the spec's browser acceptance criterion. If a browser tool is
available, use it; otherwise state clearly that browser verification was not performed.

## 8. Fix failures
Fix real failures in the code. Never weaken a test, and never claim a test passed without
running it.

## 9. Summarize
Append to `docs/IMPLEMENTATION_LOG.md`: what was built, which shared components were reused,
assumptions made, tests executed with actual results, and known limitations. Open a PR whose
description links to the spec.
