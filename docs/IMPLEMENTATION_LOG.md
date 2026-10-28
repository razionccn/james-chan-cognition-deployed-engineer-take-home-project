# Implementation log

Concise record of what was built, in order, so the work can be shown accurately.
Times are approximate wall-clock from the start of the session.

## Milestone 1 — Golden Path foundation (PR #1)

**Goal:** establish the minimum reusable foundation before writing any KYC-specific code.

Delivered:
- `specs/kyc-review.yaml` — structured requirements: roles, data model, workflow transitions,
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
