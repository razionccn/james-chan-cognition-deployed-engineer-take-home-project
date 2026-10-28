# Feature-Flag Admin Panel — Build Metrics Report

Experiment: build a **second** internal application (Feature-Flag Admin Panel) on the existing
**Internal Tools Template** in a fresh Devin session, using only what is in the repository
(`AGENTS.md`, `.agents/skills/create-internal-tool/SKILL.md`, `AUDIT.md`, `specs/kyc.yaml`,
`README.md`, `docs/IMPLEMENTATION_LOG.md`, and the code) as project knowledge.

Everything in this file is either a measured value with its measurement source, or is marked
**NOT MEASURED**. Nothing below is an estimate presented as a measurement.

---

## 0. Baseline (recorded BEFORE any code change)

| Item | Value |
|---|---|
| Start time (UTC, ISO 8601) | `2026-10-28T05:23:41Z` (first shell command of the session; the task message arrived at session start, 22:23 PDT) |
| Devin session | https://app.devin.ai/sessions/929c6363efd14330b0ab305373bc0200 |
| Git branch | `devin/feature-flag-admin-panel` (created from `main`) |
| Baseline commit SHA | `03646510c301dc0faf2524ae1de5022dfaf4c001` (`main`, merge of PR #2) — not modified or rebased |
| Counting tool | `cloc` 1.90 (`apt-get install cloc`), run from the repository root |
| Python / Node | Python 3.10.12, Node 20.20.2 (via nvm), npm 10.8.3 |

### 0.1 Counting conventions

- **Source** = `backend/app/**` + `frontend/src/**` (`.py`, `.ts`, `.tsx`, `.css`). **Tests** = `backend/tests/**`.
- Excluded: `node_modules`, `dist`, `backend/data` (SQLite), `__pycache__`, `package-lock.json`,
  images/SVGs, YAML specs, Markdown docs, config files (`vite.config.ts`, `tailwind.config.js`,
  `postcss.config.js`, `tsconfig*.json`, `pytest.ini`, `index.html`).
- Numbers are cloc's **code** column (blank lines and comments excluded).
- "Shared template" = `backend/app/core/`, `backend/app/main.py`, `backend/app/cli.py`, package `__init__`s,
  `frontend/src/shared/`, `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/src/index.css`,
  `frontend/src/apps/registry.ts`, `frontend/src/apps/home/`.
  "Application-specific" = `backend/app/apps/<app_id>/` + `frontend/src/apps/<app_id>/`.

Reproduce (from the repo root, at the baseline SHA):

```bash
git checkout 03646510c301dc0faf2524ae1de5022dfaf4c001
cloc --quiet --exclude-dir=__pycache__ --not-match-f='\.(svg|png)$' backend/app frontend/src   # all source
cloc --quiet --exclude-dir=__pycache__ backend/app                                              # backend source
cloc --quiet --not-match-f='\.(svg|png)$' frontend/src                                           # frontend source
cloc --quiet --exclude-dir=__pycache__ backend/tests                                            # tests
cloc --quiet --exclude-dir=__pycache__ backend/app/core backend/app/main.py backend/app/cli.py backend/app/__init__.py backend/app/apps/__init__.py   # shared backend
cloc --quiet frontend/src/shared frontend/src/App.tsx frontend/src/main.tsx frontend/src/apps/registry.ts frontend/src/apps/home frontend/src/index.css   # shared frontend
cloc --quiet --exclude-dir=__pycache__ backend/app/apps/kyc                                     # KYC backend
cloc --quiet frontend/src/apps/kyc                                                               # KYC frontend
```

### 0.2 Baseline line counts (cloc "code" lines, measured at `0364651`)

| Scope | Files | Code lines |
|---|---|---|
| Total source (backend + frontend, no tests) | 40 | **1599** |
| Backend source (`backend/app`) | 14 | 497 |
| Frontend source (`frontend/src`) | 26 | 1102 (1093 TS/TSX + 9 CSS) |
| Test code (`backend/tests`) | 3 | **180** |
| Shared template — backend (`core/`, `main.py`, `cli.py`, inits) | 6 | 181 |
| Shared template — frontend (`shared/`, `App.tsx`, `main.tsx`, `registry.ts`, `home/`, `index.css`) | 21 | 767 |
| Shared template — total | 27 | **948** |
| Application-specific — KYC backend (`apps/kyc`) | 8 | 316 |
| Application-specific — KYC frontend (`apps/kyc`) | 5 | 335 |
| Application-specific — total (KYC only) | 13 | **651** |

Check: 948 + 651 = 1599 ✓; 181 + 316 = 497 ✓; 767 + 335 = 1102 ✓.

### 0.3 Baseline test / build results (actual output, run in this session before any change)

```
$ cd backend && pip install -r requirements.txt && python -m app.cli init-db --reset --seed
[kyc] dropped tables: kyc_audit_events, kyc_cases
[kyc] schema ensured (2 tables)
[kyc] seeded 24 records

$ cd backend && python -m pytest -o addopts="" -q -p no:warnings
15 passed in 0.36s                     (2 in test_core.py + 13 in test_kyc.py)

$ cd frontend && npm install && npm run typecheck
> tsc -b                               (no errors)

$ cd frontend && npm run build
dist/assets/index-BHuYmWvx.css   18.93 kB │ gzip:  4.16 kB
dist/assets/index-D3lU5NVH.js   189.38 kB │ gzip: 61.14 kB
✓ built in 1.35s
```

Environment note: the session VM's blueprint build had failed, so `node`/`npm` were not on PATH
(fixed with `source ~/.nvm/nvm.sh && nvm use 20`) and FastAPI/pytest were not installed
(`pip install -r requirements.txt`). `cloc` was installed with `apt-get`. This setup took the first
~2 minutes of the session (05:23 → 05:25 UTC) and is included in the total elapsed time.

### 0.4 Existing reusable components relevant to the new app (inspected at baseline)

Frontend (`frontend/src/shared/`): `AppShell` (nav from `apps/registry.ts` + persona switcher),
`DataTable`, `FilterBar` / `SearchInput` / `SelectFilter`, `StatusBadge`, `DetailPanel` /
`DescriptionList` / `Section`, `ConfirmDialog` (optional required reason), `ToastProvider` / `useToast`,
`LoadingState` / `EmptyState` / `ErrorState`, `Button`, `PageHeader`, `api.get/post` + `ApiError` +
`buildQuery` (`shared/api/client.ts`), `useQuery`, `PersonaContext` / `usePersona`, `shared/format.ts`.

Backend (`backend/app/core/`): `connect()` / `get_db` / `transaction()` / `init_db()` (`db.py`),
`AppError` family + uniform `{"error": {code, message}}` handlers (`errors.py`), DEV-ONLY personas +
`require_role()` (`personas.py`), `installed_apps()` registry (`registry.py`), `python -m app.cli init-db`,
auto-mount of each app's router at `/api/<app_id>` (`main.py`). Tests: `conftest.py` fixtures `client`,
`conn`, `reviewer_headers`, `viewer_headers`, `as_persona()`.

Known gaps noted in `AUDIT.md` that affect this app: no form/edit/toggle primitive, no `api.put/patch`,
audit logging is per-app (no shared audit table/helper), roles are a global `reviewer`/`viewer` pair,
`pages.elements` in the spec are prose only.

### 0.5 Outstanding defects check and smallest viable implementation

`AUDIT.md` P0 items are marked DONE and verified by `test_request_validation_uses_error_envelope` and
`test_concurrent_conflicting_actions_do_not_both_succeed` (both pass at baseline). No open correctness
defect in the template would invalidate the new app.

Smallest viable implementation decided at baseline:
- `specs/feature-flags.yaml` with the same sections as `specs/kyc.yaml`.
- Backend module `backend/app/apps/feature_flags/` (schema with `feature_flags` + `feature_flag_audit_events`,
  deterministic seed of 12 flags, repository, service enforcing: production immutable → 403, viewer → 403,
  unknown flag → 404, no-op toggle → 409; conditional `UPDATE … WHERE enabled = ?` + audit insert in one
  `transaction()`), router (`GET /meta`, `GET /flags`, `GET /flags/{id}`, `POST /flags/{id}/toggle`).
- Frontend module `frontend/src/apps/feature_flags/` (list page with search + environment filter,
  detail panel with toggle, confirm dialog, toast, audit history), registered in `apps/registry.ts`.
- One small template extension only if needed: a `Toggle` component (brief P1) — decided after inspecting whether `Button` + `ConfirmDialog` suffice.
- `backend/tests/test_feature_flags.py` with one test per acceptance criterion.
- Reuse the KYC audit *convention* (app-owned audit table + insert inside the transaction); no migration of KYC audit.

(Sections A–G below are filled in after implementation.)
