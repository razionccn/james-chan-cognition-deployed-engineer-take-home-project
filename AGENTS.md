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
backend/app/core/time.py              utc_now_iso(), to_iso(), SEED_EPOCH — the only timestamp helpers
backend/app/core/errors.py            AppError hierarchy -> {"error": {code, message}} responses
backend/app/core/personas.py          DEV-ONLY simulated identities + require_role()
backend/app/core/registry.py          list of installed app modules
backend/app/cli.py                    `python -m app.cli init-db [--reset] [--seed]`
frontend/src/shared/layout/AppShell   sidebar nav (from apps/registry.ts) + persona switcher
frontend/src/shared/components/       see index.ts: Button, StatusBadge, DataTable, FilterBar/SearchInput/SelectFilter,
                                      Loading/Empty/ErrorState, DetailPanel/DescriptionList/Section, ConfirmDialog,
                                      Toast/useToast, PageHeader, Toggle, AuditTimeline, cx
frontend/src/shared/hooks.ts          useDebounced(), useUrlParam() (selected record in the URL)
frontend/src/shared/format.ts         formatDate / formatDateTime / titleCase — do not re-implement per app
frontend/src/shared/persona/          PersonaContext + usePersona() (DEV-ONLY persona switcher state)
frontend/src/shared/api/client.ts     apiFetch / ApiError / persona header
frontend/src/shared/api/useQuery.ts   loading / error / success hook
frontend/src/apps/registry.ts         app list used for navigation and routing
```

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
   so it commits or rolls back atomically. `transaction()` issues `BEGIN IMMEDIATE`, i.e. it
   takes the write lock up front: do the reads that decide the write *inside* the block, and
   make the write conditional (`UPDATE … WHERE status = ?`, 409 when `rowcount == 0`).
4. **Errors are uniform.** Raise `NotFoundError` (404), `ValidationError` (422),
   `InvalidTransitionError` (409), `ForbiddenError` (403). The handler renders
   `{"error": {"code": "...", "message": "..."}}`; the frontend shows `message` verbatim.
5. **Audit anything consequential.** Every state-changing action records who, what,
   previous → new value, reason and timestamp in an app-owned audit table.
6. **Synthetic data only.** No real PII, documents, credentials or external calls.
7. **Timestamps** come from `app/core/time.py` only: ISO-8601, UTC, `Z` suffix, second
   precision. Audit history is ordered `created_at DESC, id DESC`. Seed data uses
   `SEED_EPOCH` offsets, and every seeded record's `updated_at` must equal the `created_at`
   of its newest seeded audit event.
8. **Naming.** `app.id` is snake_case and is used verbatim as the Python package, the API
   prefix (`/api/<app_id>`), the table prefix and the spec filename `specs/<app_id>.yaml`
   (enforced by `tests/test_core.py`). Frontend routes may be kebab-case (`/feature-flags`).
9. **Audit tables are per app** for now, named `<entity>_audit_events` next to the entity table
   (`kyc_cases` → `kyc_audit_events`, `feature_flags` → `feature_flag_audit_events`); render them
   with the shared `AuditTimeline`. Promote to one shared audit table when a third app needs one.

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
- Keep the backend's error `message` visible to the user on failure.

## Running locally

Prerequisites: Python 3.10+, Node 20+ (with nvm: `source ~/.nvm/nvm.sh && nvm use 20` first).

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
cd frontend && npm test               # Vitest + Testing Library (shared components)
cd frontend && npm run build          # tsc -b && vite build
```

All four run in CI (`.github/workflows/ci.yml`) on every pull request.

- Tests live in `backend/tests/`. `conftest.py` provides `client` (seeded temp DB),
  `conn`, `reviewer_headers`, `viewer_headers`.
- One test per acceptance criterion in the spec, named `test_ac<N>_<what>`.
- Tests go through HTTP and SQLite; never mock the service or repository.
- Any conditional write needs a concurrency test with **two connections** (see
  `test_core.py::test_transaction_takes_the_write_lock_up_front`); a single-connection
  simulated stale read cannot see locking bugs.
- Changing anything under `shared/` or `core/`: run the **full** suite, not just your app's,
  and re-verify the existing apps' browser flows.
- Never claim tests pass without running them; paste actual output into the PR / log.

## Requirements for every new internal tool

- Starts from a spec in `specs/<app_id>.yaml` with the same sections as `kyc.yaml`.
- Follows the module layout above and registers itself in both registries.
- Enforces its business rules and roles in the backend, with an audit table for writes.
- Ships deterministic seed data and acceptance tests before UI polish.
- Documents assumptions, test results and limitations in `docs/IMPLEMENTATION_LOG.md`.
- Ends with a retrospective entry in `.agents/skills/create-internal-tool/LEARNINGS.md` and applies
  its promotion rules (Skill step 10) so the next tool starts from a better template.
