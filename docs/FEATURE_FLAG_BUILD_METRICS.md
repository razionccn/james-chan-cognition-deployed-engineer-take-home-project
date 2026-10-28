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

---

## A. Experiment Summary

| Item | Value |
|---|---|
| Objective | Build a second internal application on the Internal Tools Template in a fresh session, using only repository context, and measure what the template did and did not help with. |
| Application implemented | **Feature-Flag Admin Panel** (`specs/feature-flags.yaml`, app id `feature_flags`, route `/feature-flags`, API `/api/feature_flags`): list / search / filter 14 seeded flags across development, staging, production; detail panel with change history; reviewer-only toggle of non-production flags with optional reason; production locked; every toggle audited. |
| Baseline commit | `03646510c301dc0faf2524ae1de5022dfaf4c001` (`main`) |
| Final code commit (what sections B–E measure) | `be1f095` — `ConfirmDialog: add collectReason prop …`. Documentation-only commits (this report, `docs/IMPLEMENTATION_LOG.md`, `README.md`) follow it; the PR head SHA is on the PR. |
| Devin session | https://app.devin.ai/sessions/929c6363efd14330b0ab305373bc0200 |
| Actual total elapsed time | **`22 min 08 s`** wall clock, from first shell command `2026-10-28T05:23:41Z` to the final documentation commit `2026-10-28T05:45:49Z` (VM `date -u`). Includes environment repair, baseline measurement, two browser-testing runs and writing this report. See B. |
| Test results (actual, final code commit) | `cd backend && python -m pytest -o addopts="" -q -p no:warnings` → **`28 passed in 0.66s`** (15 pre-existing: 2 core + 13 KYC, unchanged; 13 new feature-flag tests). `npm run typecheck` → `tsc -b`, no errors. `npm run build` → `✓ built in 1.26s`. Browser verification: 8/8 checklist items PASS after one UI fix (see E). |

## B. Development-Time Metrics

All times are UTC from the VM clock (`date -u`, git commit timestamps). The session is a single
uninterrupted agent run; there was no human in the loop between the task message and the final report.

| Metric | Measured value | Measurement source |
|---|---|---|
| Total elapsed development time | `22 min 08 s` (05:23:41Z → `2026-10-28T05:45:49Z`) | `date -u` at first command and at final docs commit |
| Environment repair + reading repo + baseline measurement | 3 min 02 s (05:23:41Z → 05:26:43Z, baseline commit `4d501e5`) | git commit timestamp |
| Spec writing | 2 min 32 s (→ 05:29:15Z, `f455afe`) | git commit timestamp |
| Backend implementation incl. smoke checks | 1 min 55 s (→ 05:31:10Z, `4337050`) | git commit timestamp |
| Frontend + tests (written in parallel), typecheck, build, first test run | 34 s (→ 05:31:44Z, `085d208`) | git commit timestamp (the frontend files and the test module were generated in the same step as the backend commit; the timestamp measures only the tail) |
| Implementation time (sum of the above, baseline → first complete build) | **8 min 03 s** (05:23:41Z → 05:31:44Z) | git commit timestamps |
| Debugging/testing time | 7 min 36 s (05:31:44Z → 05:39:20Z): browser run #1 found the missing optional-reason field; fix committed `be1f095`. Browser run #2 (retest) and metrics/docs writing follow and are included only in the total. | git commit timestamps |
| Test-suite iterations | 3 full `pytest` runs after the new tests existed: run 1 → `1 failed, 27 passed` (test assumption wrong, see F), run 2 → `28 passed`, run 3 (after UI fix) → `28 passed` | pytest output in this session |
| Browser-test iterations | 2 (full checklist → 1 FAIL; focused retest → PASS) | testing-agent reports |
| User correction prompts | **0** (single task message; no follow-up from the user before this report) | conversation |
| Human review time | **NOT MEASURED** (PR not yet reviewed when this report was written) | — |
| Model generation vs. tool execution time split | **NOT MEASURED** (no instrumentation) | — |
| Comparable no-template baseline | **NOT MEASURED** — no app was built without the template, so no speed-up percentage is claimed | — |

Caveat: the brief's time budget is "about two hours" for the whole prototype including KYC. The KYC build
time is not in this repository's history in a measurable form, so the two apps are not compared.

## C. Code Metrics

Same cloc conventions as §0.1, measured at `be1f095` from the repo root:

```bash
git checkout be1f095
cloc --quiet --exclude-dir=__pycache__ --not-match-f='\.(svg|png)$' backend/app frontend/src
cloc --quiet --exclude-dir=__pycache__ backend/tests
cloc --quiet --exclude-dir=__pycache__ backend/app/apps/feature_flags
cloc --quiet frontend/src/apps/feature_flags
cloc --quiet frontend/src/shared frontend/src/App.tsx frontend/src/main.tsx frontend/src/apps/registry.ts frontend/src/apps/home frontend/src/index.css
```

| Metric (cloc code lines) | Baseline `0364651` | Final `be1f095` | Delta |
|---|---|---|---|
| Total source-code lines (backend + frontend, no tests) | 1599 | **2218** | +619 |
| Frontend source-code lines (`frontend/src`) | 1102 | 1451 (1442 TS/TSX + 9 CSS) | +349 |
| Backend source-code lines (`backend/app`) | 497 | 767 | +270 |
| Test-code lines (`backend/tests`) | 180 | 322 | +142 (`test_feature_flags.py`) |
| Shared template source-code lines | 948 | 997 | **+49** (`Toggle.tsx` 37, `apps/registry.ts` +8, `ConfirmDialog.tsx` +4, `components/index.ts` +1; backend `registry.py` ±0 net) |
| Application-specific source-code lines — KYC | 651 | 651 | 0 |
| Application-specific source-code lines — Feature flags | 0 | 570 (backend 270 + frontend 300) | +570 |
| Application-specific — total | 651 | 1221 | +570 |

Checks: 997 + 1221 = 2218; 181 + 316 + 270 = 767; 816 + 335 + 300 = 1451.

Git diff (a different concept from the counts above — these are raw diff lines including blanks, comments and
docstrings, and exclude nothing but the pathspec):

```bash
git diff --shortstat 03646510c301dc0faf2524ae1de5022dfaf4c001 be1f095 -- backend frontend
#  19 files changed, 975 insertions(+), 5 deletions(-)        (code + tests only)
git diff --shortstat 03646510c301dc0faf2524ae1de5022dfaf4c001 be1f095
#  21 files changed, 1278 insertions(+), 5 deletions(-)       (+ specs/feature-flags.yaml and the baseline section of this report)
git diff --numstat 03646510c301dc0faf2524ae1de5022dfaf4c001 be1f095 -- backend/app/core frontend/src/shared frontend/src/apps/registry.ts
#  2  2  backend/app/core/registry.py
#  8  0  frontend/src/apps/registry.ts
#  7  3  frontend/src/shared/components/ConfirmDialog.tsx
#  42 0  frontend/src/shared/components/Toggle.tsx
#  1  0  frontend/src/shared/components/index.ts
git diff --stat 03646510c301dc0faf2524ae1de5022dfaf4c001 be1f095 -- backend/app/apps/kyc frontend/src/apps/kyc backend/tests/test_kyc.py backend/tests/conftest.py
#  (empty — KYC and the test fixtures are untouched)
```

Limited proxy, formula stated: of the 619 new source lines, 570 (92%) are application-specific and 49 (8%) are
template changes. This says how little the template had to change, not how productive anyone was. A "reuse
percentage" of the form shared-lines / total-lines (997 / 2218 = 45%) is **not** a productivity measure and is
listed only because the brief asks for the denominator to be explicit.

## D. Template Reuse

**Reused as-is (imported, zero modification)**

- Backend: `app.core.db` (`get_db`, `transaction`, `connect`, `init_db` via registry), `app.core.errors`
  (`NotFoundError`, `ValidationError`, `InvalidTransitionError`, `ForbiddenError` + the error envelope and the
  `RequestValidationError` handler), `app.core.personas` (`Persona`, `get_current_persona`, `require_role`),
  `app.main.create_app` (auto-mounts the router at `/api/<APP_ID>`), `app.cli init-db` (drops / creates / seeds the
  new tables with no CLI change), `tests/conftest.py` (`client`, `conn`, `reviewer_headers`, `viewer_headers`,
  `as_persona`) — the fixture seeds every registered app, so the new tests needed no fixture code.
- Frontend: `AppShell` (sidebar entry and persona switcher appear from the registry entry alone), `PageHeader`,
  `FilterBar`, `SearchInput`, `SelectFilter`, `Button`, `DataTable` (loading / empty / selected row / keyboard rows),
  `ErrorState`, `LoadingState`, `DetailPanel` (URL-driven open/close, Esc, backdrop), `DescriptionList`, `Section`,
  `StatusBadge`, `ConfirmDialog`, `useToast`, `shared/api/client` (`api.get/post`, `ApiError`, `buildQuery`, persona
  header), `shared/api/useQuery`, `shared/persona/PersonaContext`, `shared/format.formatDateTime`, Home page cards.
- Process: `AGENTS.md` + `.agents/skills/create-internal-tool/SKILL.md` + `specs/kyc.yaml` were sufficient to
  write the spec and the module without reading the KYC build conversation.

**Modified shared modules** (4 files, +58/−5 diff lines)

- `backend/app/core/registry.py` — register the module (expected by the Skill).
- `frontend/src/apps/registry.ts` — register the page (expected by the Skill).
- `frontend/src/shared/components/ConfirmDialog.tsx` — new optional `collectReason` prop. Before, the reason field
  rendered only when it was *required*; an optional reason was impossible. KYC behaviour unchanged (verified in browser).
- `frontend/src/shared/components/Toggle.tsx` (+ export) — new generic on/off switch (`role="switch"`). Added because
  the brief and spec call for a toggle and the template had no boolean input; it is app-agnostic.

**New application-specific modules**

- `backend/app/apps/feature_flags/`: `__init__.py`, `rules.py`, `schema.py`, `seed.py`, `repository.py`,
  `service.py`, `schemas.py`, `router.py` (270 code lines).
- `frontend/src/apps/feature_flags/`: `types.ts`, `api.ts`, `labels.tsx`, `FeatureFlagsPage.tsx`,
  `FlagDetailPanel.tsx` (300 code lines).
- `backend/tests/test_feature_flags.py` (142 code lines, 13 tests).
- `specs/feature-flags.yaml`.

**Duplicated or missing patterns (candidates for standardisation, not done here on purpose)**

- Audit table: `feature_flag_audit_events` mirrors `kyc_audit_events` (DDL, insert helper, list helper, Pydantic
  model, history list in the panel). Third copy would justify a shared `audit` helper + `AuditTimeline` component.
- `rules.py` + `/meta` endpoint pattern (expose editability so the UI never hard-codes it) is copied from KYC by hand.
- `useDebounced`, the filter-state shape and the `labels.tsx` badge-mapping idiom are re-implemented per app
  (≈40 lines); a `useListFilters` hook would remove them.
- `_now()` ISO timestamp helper and the "previous/new/actor/reason/created_at" audit row shape exist twice.
- Personas are global: there is no app-scoped role, so "may toggle flags" is expressed as the KYC role `reviewer`.
- No frontend tests and no CI in the template (already called out in `AUDIT.md`); the browser checklist is manual.

## E. Functionality Verification

Backend evidence = `backend/tests/test_feature_flags.py` (real FastAPI app + real temp SQLite, HTTP only).
Browser evidence = recorded testing-agent runs at `085d208` (full checklist) and `be1f095` (retest of the fix).

| AC | Criterion | Result | Evidence |
|---|---|---|---|
| AC-1 | List all flags with id, name, description, environment, enabled, updated_at, updated_by | **PASS** | `test_ac1_list_returns_all_seeded_flags`; browser: 14 rows, six columns |
| AC-2 | Filter by environment (and enabled); invalid filter → 422 envelope | **PASS** | `test_ac2_filters_by_environment`; browser: Staging → 5, Disabled → 6, Enabled → 8, combined filters, Clear |
| AC-3 | Search by name or id, combinable with filters; empty state | **PASS** | `test_ac3_search_by_name_or_id`; browser: "velocity" → 2, "checkout" → 3, nonsense → empty state |
| AC-4 | Reviewer toggles development/staging flag; `updated_at`/`updated_by` change; reason optional | **PASS** | `test_ac4_reviewer_can_toggle_staging_flag`; browser: FF-1005 toggled with and without a reason, toast + badges + row update |
| AC-5 | Production toggle → 403 `environment_locked`, flag unchanged; UI shows lock | **PASS** | `test_ac5_production_flag_update_is_rejected`; browser: lock notice, forced POST (scripted request from the browser) → 403, detail unchanged |
| AC-6 | Viewer / missing / unknown persona → 403 `forbidden`, flag unchanged; UI read-only | **PASS** | `test_ac6_viewer_cannot_toggle`; browser: Vic persona read-only notice, forced POST → 403 |
| AC-7 | Toggle persists across new connection, app restart, page refresh | **PASS** | `test_ac7_toggle_persists_across_new_connection_and_app_restart`; browser: hard refresh + real `uvicorn` restart without reseed |
| AC-8 | Exactly one audit event per toggle with previous/new, actor, reason, timestamp; shown in panel | **PASS** | `test_ac8_successful_toggle_creates_exactly_one_audit_event`; browser: history entries with reason text |
| AC-9 | KYC unchanged and passing | **PASS** | `test_kyc.py` 13 tests + `test_core.py` 2 unchanged and passing; `git diff` on KYC paths empty; browser: 24 cases, detail opens, Reject dialog still requires reason |
| AC-10 | Browser walkthrough (nav, list, filters, detail, toggle, lock, viewer, persistence) | **PASS** | run #1: 7/8 PASS, item 4 FAIL (no optional reason field); fixed in `be1f095`; run #2: PASS |
| BR-3 | No-op toggle → 409 `invalid_transition` | **PASS** | `test_noop_toggle_is_rejected_with_409` (backend only; not exercised in browser because the UI only offers the opposite state) |
| BR-7 | Concurrent conflicting toggles do not both succeed | **PASS** (simulated) | `test_concurrent_conflicting_toggles_do_not_both_succeed` — stale read injected via monkeypatch; a true multi-process race is **NOT TESTED** |
| — | Unknown flag → 404; bad body / reason > 500 chars → 422 envelope; `/meta` | **PASS** | `test_unknown_flag_returns_404_and_request_validation_envelope`, `test_meta_exposes_environment_editability` |
| — | Accessibility of the Toggle (screen reader, keyboard) | **NOT TESTED** | `role="switch"` + `aria-checked` present; no assistive-technology check |

## F. Engineering Observations

**What the template made easier**

- Registration is genuinely the only wiring: adding `feature_flags` to two registries produced the API mount, DB
  init/seed, sidebar entry, home card, route and test fixtures. Zero changes in `main.py`, `cli.py`, `App.tsx`,
  `AppShell`, `conftest.py`.
- Authorization, error envelope, transactions, persona header, loading/empty/error states, URL-driven detail panel,
  confirm-then-toast flow were all consumed, not written. The feature-flag `service.py` is 91 diff lines for six
  business rules.
- `AGENTS.md` + Skill + `specs/kyc.yaml` were enough context to produce a spec in the same shape and a module in the
  same layering without the original build conversation — the "fresh session" premise held.
- The existing KYC tests acted as a free regression suite for the shared changes (`ConfirmDialog`, registries).

**What required new implementation**

- Everything domain-specific: schema (two tables), 14-record seed, repository SQL, service rules (environment lock,
  role, no-op, conditional update), Pydantic models, two pages, badge mappings, the audit timeline rendering.
- A boolean input (`Toggle`) and an optional reason in `ConfirmDialog` — the template was shaped by a workflow whose
  reasons are mandatory and whose actions are buttons.

**Unexpected problems**

1. The VM blueprint had failed: `node`/`npm` were not on `PATH` and Python deps were missing. Fixed with
   `source ~/.nvm/nvm.sh && nvm use 20`, `pip install -r requirements.txt`, `apt-get install cloc` (~3 min, included
   in the total). Recommended blueprint fix: initialise nvm before frontend commands.
2. First test run: `1 failed, 27 passed`. My test sent `{"enabled": "yes"}` expecting 422; Pydantic v2 lax mode
   coerces `"yes"` to `true`, so the API correctly answered 409 (already enabled). Test fixed to send `"maybe"`.
   Not a product defect; recorded as a wrong assumption.
3. Browser run #1: `ConfirmDialog` only rendered the reason field when `requireReason` was true, so the "optional
   reason" the spec promises was unreachable from the UI (the API accepted it fine, which is why no backend test
   caught it). Fixed with a backward-compatible `collectReason` prop; KYC's required-reason dialog re-verified.
4. The baseline plan in §0.5 said "12 flags"; the spec and seed use 14 (two more to cover every
   environment × state combination for the filter tests). The plan was not edited to preserve the baseline record.

**Manual interventions**

- None from the user. All decisions below were made by the agent and are recorded here and in
  `docs/IMPLEMENTATION_LOG.md`: reuse the global `reviewer` role for flag writes instead of adding an app-scoped role;
  make `development` editable alongside `staging` (the brief only mandates staging editable and production locked);
  409 for no-op toggles; optional reason capped at 500 characters; conditional `UPDATE … WHERE enabled = ?` guard.

**Limitations of the experiment**

- Single run, single agent, no control group: nothing here proves the template is faster than no template.
- Timings are wall-clock on a VM, dominated by model generation; they are not comparable to human engineering hours.
- The second app is close in shape to the first (a table of records with an audited, role-gated state change).
  A tool needing forms, file upload, charts, multi-step wizards or cross-app joins would stress parts of the
  template that this experiment did not touch (`AUDIT.md` already lists the missing form/toggle primitives).
- Browser verification was performed by a testing agent, not a human; the forced 403 checks were scripted
  requests issued from the browser, not UI clicks (the UI correctly offers no way to attempt them).
- No frontend unit tests, no CI, no accessibility audit, no load/concurrency test across processes.

## G. Conclusion

**Does this second application provide credible evidence that the Internal Tools Template supports repeatable
Devin-assisted internal-tool development?**

Yes, within a defined scope. What the experiment establishes, with evidence in this repository:

- A fresh session with only the repository as context produced a working second application following the Skill,
  with 570 application-specific source lines and **49 lines of template change**, none of which touched KYC
  (`git diff` on KYC paths is empty; the 15 pre-existing tests pass unchanged).
- Every acceptance criterion in `specs/feature-flags.yaml` is covered by an HTTP-level test against real SQLite,
  and the browser checklist passed end-to-end including persistence across a real backend restart and backend-enforced
  production lock and viewer rejection.
- Baseline → first complete build was 8 minutes of wall clock; baseline → verified fix was 16 minutes. The one
  defect found was a template gap (optional reason), surfaced by browser testing, fixed in four lines.

What remains unproven:

- Speed relative to building without the template (NOT MEASURED — no control).
- Generality beyond "audited, role-gated list + detail + state change" tools; the template is still shaped by the KYC
  workflow (mandatory reasons, button actions, global reviewer/viewer roles).
- Scaling of the duplicated patterns (audit table, labels, debounced filters): at two apps they are tolerable; at
  three they should be promoted to shared code, which is maintenance the owning team inherits along with the persona
  fixture replacement, SQLite → Postgres migration, and the absence of frontend tests and CI.

---

## H. Post-review fixes (after the PR was opened; not included in the measurements above)

Devin Review on PR head `7c410ea` reported four findings. Triage, with evidence:

| Finding | Outcome | Evidence / reasoning |
|---|---|---|
| Concurrent toggles can return 500 instead of 409 | **Fixed** in `backend/app/core/db.py` (shared, 1 statement): `transaction()` now issues `BEGIN IMMEDIATE`. Reproduced first: with deferred `BEGIN`, a competing commit between the read and the `UPDATE` raised `sqlite3.OperationalError: database is locked`. After the fix the competing writer waits (`busy_timeout`) and the first toggle completes; 28 tests still pass. This was a latent template bug that KYC shares; the existing `test_concurrent_conflicting_*` tests use one connection and could not see it. | repro script run in session; `pytest` → `28 passed` |
| Rapid toggles within one second share an `updated_at` | **Dismissed** — `_now()` has second precision by the template convention copied from KYC; audit order is `created_at DESC, id DESC`, so ordering and the audit trail are unaffected. No wrong result identified. | code inspection |
| Seeded flag `updated_at` later than its last audit event | **Fixed** in `seed.py`: history rows are stamped with the flag's own `updated_at`. Verified: all 3 seeded events equal their flag's `updated_at`. | query in session |
| Spec file `specs/feature-flags.yaml` vs `app.id: feature_flags` (`specs/<app_id>.yaml` convention) | **Escalated** — the task brief explicitly named the file `specs/feature-flags.yaml`; renaming to `specs/feature_flags.yaml` would follow the repo convention but contradict the brief. Decision left to the owner. | `AGENTS.md`, Skill step 1 |
