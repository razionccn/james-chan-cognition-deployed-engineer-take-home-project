# AGENTS.md — Fintech Operations Console

Instructions for engineers and for Devin working in this repository. Read this
before changing anything. The procedure for adding a new internal application
is in `.agents/skills/create-internal-tool/SKILL.md`; application
specifications live in `specs/`.

## What this repository is

A console of small internal business applications (a Power Apps alternative)
sharing one frontend shell, one backend, one SQLite database, and one set of
conventions. Each application is a self-contained module on both sides:

```
specs/<app_id>.yaml                   structured requirements (source of truth)
backend/app/apps/<app_id>/            FastAPI router + service + repository + schema + seed
frontend/src/apps/<app_id>/           React pages, types and typed API calls
backend/tests/test_<app_id>.py        pytest acceptance tests
```

Shared code:

```
backend/app/core/db.py                SQLite connection, transaction(), init_db()
backend/app/core/errors.py            AppError hierarchy -> {"error": {code, message}} responses
backend/app/core/personas.py          DEV-ONLY simulated identities + require_role()
backend/app/core/registry.py          list of installed app modules
backend/app/core/spec.py              application-spec schema (spec_version 1) + validate_spec()
backend/app/core/spec_router.py       POST /api/specs/validate, GET /api/specs/schema|meta
backend/app/cli.py                    `python -m app.cli init-db [--reset] [--seed]`, `validate-spec <files>`
frontend/src/shared/layout/AppShell   sidebar nav (from apps/registry.ts) + persona switcher
frontend/src/shared/components/       DataTable, FilterBar, StatusBadge, DetailPanel, ConfirmDialog, Toast, States, Button, PageHeader,
                                      Form controls: FormField, TextField, TextArea, SelectField, Toggle, CheckboxGroup
frontend/src/apps/request/            "Request New App" wizard (non-engineer entry point; produces a validated spec)
frontend/src/shared/api/client.ts     apiFetch / ApiError / persona header
frontend/src/shared/api/useQuery.ts   loading / error / success hook
frontend/src/apps/registry.ts         app list used for navigation and routing
```

## Application specifications (`specs/<app_id>.yaml`)

One schema serves both entry points — engineers editing YAML and non-engineers using the
**Request New App** wizard. The schema lives in `backend/app/core/spec.py` (Pydantic,
`spec_version: 1`); validate with `python -m app.cli validate-spec specs/<app_id>.yaml` or
`POST /api/specs/validate`. `specs/kyc.yaml` is the reference example.

| Section | Validated? | Used for |
|---|---|---|
| `app` (id, name, category, purpose, users) | yes | module/route names; `category` ∈ review_queue / crud / admin_panel |
| `roles[]` (id, can[view/act/create/edit/delete/admin]) | yes | `require_role()` checks; persona setup |
| `entities[].fields[]` (name, type, options, required, searchable, filterable) | yes + cross-refs | schema.py, Pydantic models, list/search/filter wiring |
| `views.list` / `views.detail` | yes (fields must exist, filters must be filterable) | page layout: DataTable columns, FilterBar, DetailPanel sections |
| `forms[]` (entity, fields, roles, requires_reason) | yes | editable fields → form controls + PATCH endpoint; required for crud/admin_panel |
| `workflow` (states, initial, terminal, actions from→to, roles) | yes (state consistency) | rules.py transition table; required for review_queue |
| `audit` | yes (must be enabled when forms/workflow exist) | audit table + history section |
| `acceptance_criteria[]` | yes (≥ 1) | one pytest per criterion |
| `business_rules`, `api`, `seed_data`, `non_goals`, `devin_notes` | **free-form** | read and interpreted by Devin; not checked |

**Nothing is generated from a spec.** Validation guarantees the spec is consistent; Devin (or an
engineer) still writes the application code by following the Skill. Rule-of-thumb when implementing:
every validated section above maps to a concrete file or test; every free-form section is guidance.

## Architecture rules

1. **Frontend is presentation only.** It calls `/api/...` and renders what comes back.
   Every business rule (state transitions, required fields, permissions) is enforced
   in the backend `service.py`; the frontend may *also* hide or disable controls for UX.
2. **Backend layering inside an app module:**
   - `router.py` — HTTP only: parse request, call service, return Pydantic models.
   - `service.py` — business rules; raises `AppError` subclasses from `app/core/errors.py`.
   - `repository.py` — SQL only; takes a `sqlite3.Connection`; no business logic.
   - `schema.py` — `CREATE TABLE IF NOT EXISTS ...` DDL and `TABLES` list.
   - `seed.py` — deterministic synthetic data (`seed(conn) -> int`).
   - `schemas.py` — Pydantic request/response models.
3. **Persistence is SQLite via the standard library.** No ORM. Use `transaction(conn)`
   for any write that touches more than one row/table (e.g. status change + audit event)
   so it commits or rolls back atomically.
4. **Errors are uniform.** Raise `NotFoundError` (404), `ValidationError` (422),
   `InvalidTransitionError` (409), `ForbiddenError` (403). The handler renders
   `{"error": {"code": "...", "message": "..."}}`; the frontend shows `message` verbatim.
5. **Audit anything consequential.** Every state-changing action records who, what,
   previous → new value, reason and timestamp in an app-owned audit table.
6. **Synthetic data only.** No real PII, documents, credentials or external calls.

## Authorization (simulated — read this twice)

Requests carry an `X-Demo-User` header naming a persona from
`backend/app/core/personas.py`. The persona's `role` (`reviewer` / `viewer`)
gates writes via `require_role()`. Unknown/missing header → read-only viewer.

This is a **development-only fixture** to demonstrate backend-enforced
authorization. It is **not** authentication, SSO or an access-control system.
Production would replace the header with an identity provider (OIDC/SAML) and a
real policy; the `require_role()` seam is where that plugs in.

## Frontend conventions

- React 18 + TypeScript + Vite + Tailwind. Path alias `@/` → `src/`.
- Register apps in `src/apps/registry.ts`; the shell and router pick them up.
- Fetch with `api.get/post` from `shared/api/client.ts`; shape loading/error with `useQuery`.
- Reuse `shared/components`. Add a shared component only when the current app needs it
  and it is genuinely generic; otherwise keep it in the app folder.
- Every list view has loading, empty and error states. Every consequential action goes
  through `ConfirmDialog` and shows a `useToast()` success message.
- Editable fields (spec `forms[]`) use the shared form controls (`TextField`, `SelectField`,
  `Toggle`, …) inside `FormField`; show the backend's validation message in `error`.
- Keep the backend's error `message` visible to the user on failure.

## Running locally

Prerequisites: Python 3.10+, Node 20+.

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate   # optional
pip install -r requirements.txt
python -m app.cli init-db --reset --seed            # creates backend/data/console.db
uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev                                          # http://localhost:5173 (proxies /api -> :8000)
```

## Testing

```bash
cd backend && python -m pytest        # real FastAPI app + real temp SQLite per test
cd frontend && npm run typecheck      # tsc -b
```

- Tests live in `backend/tests/`. `conftest.py` provides `client` (seeded temp DB),
  `conn`, `reviewer_headers`, `viewer_headers`.
- One test per acceptance criterion in the spec, named `test_ac<N>_<what>`.
- Tests go through HTTP and SQLite; never mock the service or repository.
- Never claim tests pass without running them; paste actual output into the PR / log.

## Requirements for every new internal tool

- Starts from a spec in `specs/<app_id>.yaml` that passes `python -m app.cli validate-spec`.
- Follows the module layout above and registers itself in both registries.
- Enforces its business rules and roles in the backend, with an audit table for writes.
- Ships deterministic seed data and acceptance tests before UI polish.
- Documents assumptions, test results and limitations in `docs/IMPLEMENTATION_LOG.md`.
