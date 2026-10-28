# Internal Tools Template — Audit

Skeptical staff-engineer review of the template and the KYC Review Queue before any second application is built.
Scope: code as of this branch (`devin/kyc-review-app`, PR #2 stacked on PR #1). Everything marked PASS below was
executed or observed in this session; nothing is inferred from intent.

**Terminology:** this document uses **Internal Tools Template**. The repository currently uses *three* names —
"Internal Tools Template" (README, AGENTS.md, log), "Internal Tools Template" (README line 4 parenthetical, branch
`devin/golden-path-foundation`, early commit messages) and now "Internal Tools Template" (this file). Unify (see P0-1).

---

## A. Executive assessment

| Area | Score | One-line justification |
|---|---|---|
| KYC functionality | **8 / 10** | All 10 functional requirements verified (13 pytest + full browser run incl. backend restart). Deductions: non-uniform error envelope for body validation, unbounded reason length, check-then-write race. |
| Internal Tools Template completeness | **5 / 10** | List → detail → audited action is covered well. There is **no form/edit primitive, no shared audit mechanism, no CI, no frontend tests**, and the spec is documentation only. |
| Cross-application reusability | **5 / 10** | Shared code has zero KYC references (verified by grep) and the KYC module added no shared code. But a *feature-flag* app needs capabilities the template does not have (toggle/edit form, per-app roles, environment filter is fine). Reuse is proven for one shape of app only. |
| Developer experience | **7 / 10** | `AGENTS.md` + Skill + spec are concrete and match the repo; setup is 6 commands; `init-db --seed` without `--reset` crashes; three names for the template; two stale `kyc-review.yaml` references. |
| Prototype security & reliability | **6 / 10** | Backend enforces roles/transitions/reason; SQL fully parameterised; status+audit atomic. Gaps: TOCTOU race on transition check, no input length limits, Pydantic 422s bypass the error envelope, viewer gets 422 before 403 on malformed bodies. |

**Top three concerns**
1. **The template cannot yet express or render an "edit a record" tool.** Spec `pages.elements` are free-text strings; there is no field/form section and no shared form inputs. The Feature-Flag panel is exactly that shape.
2. **Audit logging is per-app, not a template capability.** `kyc_audit_events` + the insert live in the KYC module. App #2 will copy-paste ~40 lines and a schema; app #10 will have ten audit tables with drifting columns.
3. **Credibility nits that a VP will notice:** three names for the template, "Internal Tools Template" still in the README, `specs/kyc-review.yaml` referenced in two docstrings, README says Node 22 (machine ran Node 20.20.2), `--seed` without `--reset` throws a traceback.

---

## B. Functional verification matrix (KYC)

Evidence keys: `T` = `backend/tests/test_kyc.py` (run this session: **13 passed, 2 warnings in 0.33s**); `B` = browser run by Devin's testing agent in this session (recording on PR #2); `C` = curl against the running server; `K` = code inspection.

| Requirement | Status | Evidence | Missing work |
|---|---|---|---|
| Cases loaded through real backend endpoints | PASS | T `test_ac1` (24 rows via `GET /api/kyc/cases`); B queue shows 24 cases, 7 columns; `useQuery` → `api.get` (K) | — |
| Search and filtering | PASS | T `test_ac2` (name, id, status+risk, invalid → 422); B name/id search, status, risk, combined (3 rows), clear, empty state | Filters are not in the URL (only `?case=`); no sorting |
| Case details display | PASS | B summary, findings with Pass/Review/Fail, history; `?case=` survives reload; Esc/backdrop close | — |
| Approve / reject / escalate | PASS | T `test_ac3`, `test_ac9`; B approve, escalate→reject with toast + table/badge update | — |
| Reason validated by backend | PARTIAL | T `test_ac5` (`""`, whitespace, absent → 422, no mutation); C: **100,000-char reason accepted and stored** | Add `max_length` (and trim) in `ReviewActionRequest` |
| Invalid transitions rejected | PASS | T `test_ac4` (terminal ×3 actions, escalated→escalate → 409, unchanged); B forced 409 | Race: status is read **before** the transaction (`service.py:60-74`); two concurrent different actions on one pending case can both succeed — see D |
| Persists across refresh and restart | PASS | T `test_ac6` (new connection + new `create_app()`); B hard refresh **and real uvicorn restart** | — |
| Accurate audit records | PASS | T `test_ac7` (exactly +1 row; case, prev/new, actor id+name, reason, timestamp == `updated_at`); B history entries incl. "Rejected by Ana Okafor" | — |
| Authorization enforced server-side | PASS | T `test_ac8` (viewer, missing, unknown header → 403, unchanged); C viewer POST via Vite proxy → 403; B viewer sees no buttons, forced request 403 | Malformed body as viewer returns 422 before 403 (Pydantic runs before the dependency) — information-order nit |
| Loading / empty / error states | PASS | B loading skeleton, "No cases match", empty history; inline 409 in dialog with reconciliation; `ErrorState` on list failure (K) | Pydantic 422s render as raw JSON string in the UI (`client.ts` falls back to `JSON.stringify(detail)`) |

Automated test commands and actual results (this session):
```
cd backend  && python -m pytest        → 13 passed, 2 warnings in 0.33s
cd frontend && npm run typecheck       → 0 errors
cd frontend && npm run build           → ✓ built in 1.10s
```
Not tested: frontend unit/component tests (none exist); load/concurrency; browsers other than Chrome.

---

## C. Template completeness matrix

| Capability | Implemented? | Actually reusable? | Evidence | Gaps |
|---|---|---|---|---|
| App spec format (`specs/<id>.yaml`) | Yes | Partly | `specs/kyc.yaml` parses; sections: roles, data_model, workflow, business_rules (+HTTP code), api, pages, seed_data, acceptance_criteria, non_goals | **Docs-only — nothing executes it.** `pages.elements` are prose. No `forms`/`fields` section, no data-source section (SQLite assumed), no per-app roles. Fine for Devin, thin for a human template author. |
| Shell + navigation | Yes | Yes | `AppShell` builds nav from `apps/registry.ts`; zero KYC refs in `shared/` (grep) | No breadcrumbs/sub-routes convention; mobile nav verified at 400px |
| Data table | Yes | Yes | `DataTable<Row>` generic columns, selection, loading/empty; keyboard rows | No sorting, pagination, column alignment helpers; `role="button"` on `<tr>` is wrong ARIA (should stay a row) |
| Filters / search | Yes | Yes | `FilterBar`, `SearchInput`, `SelectFilter` | No date-range, multi-select, or URL-sync helper; debounce lives in the KYC page |
| Detail view | Yes | Yes | `DetailPanel`, `DescriptionList`, `Section` | Side-panel only; no full-page detail layout |
| **Forms / editing** | **No** | — | Only `ConfirmDialog` (single textarea) | No `TextField`, `Select`, `Toggle`, `Form` with error display. Blocks any CRUD-style tool. |
| Status indicators | Yes | Yes | `StatusBadge` tone+label; apps map domain → tone (`labels.tsx`) | — |
| API client + error handling | Yes | Yes | `apiFetch`, `ApiError`, `buildQuery`, `useQuery` | No `put/patch/delete`; no retry/abort; Pydantic errors stringified |
| Toasts / confirm / states | Yes | Yes | `ToastProvider`, `ConfirmDialog` (reason reset verified), `Loading/Empty/ErrorState` | — |
| Persona / roles (frontend) | Yes | Partly | `PersonaContext` + switcher; `role` is a global `'reviewer' \| 'viewer'` literal | New role (e.g. `flag_admin`) requires editing `shared/persona` and `core/personas.py` — a per-app concern leaking into core |
| Backend app contract | Yes | Yes | `registry.py` contract (`APP_ID, TABLES, SCHEMA_SQL, seed, router`), auto-mounted at `/api/<id>`, `init_db` iterates apps | Registration is a manual list edit on both sides (acceptable; explicit) |
| Data access | Yes | Yes | `connect()` (WAL, FK), `transaction()`, `get_db` per request | No migrations (`CREATE IF NOT EXISTS` only); `--seed` without `--reset` → `IntegrityError` traceback |
| Business logic separation | Yes | Yes | `router → service → repository` honoured in KYC; rules as data in `rules.py` | Transition table + `allowed_actions` is a pattern, not a helper — app #2 re-implements it (small; fine) |
| Input validation | Partly | Yes | Pydantic models + service checks | No length limits; `RequestValidationError` not mapped to the `{"error":{...}}` envelope |
| Authorization conventions | Yes | Yes | `require_role()` seam; unknown persona → viewer | Single global role set (see above) |
| **Audit logging** | **Per-app only** | **No** | `kyc_audit_events` schema + `insert_audit_event` in KYC module | No shared table/helper; app #2 duplicates schema, insert, ordering, response model |
| Testing infrastructure | Yes | Yes | `conftest.py` temp DB + `TestClient` + persona headers; AC-per-test convention | **No frontend tests, no CI**; no helper for "assert case unchanged" |
| Docs / Skill | Yes | Yes | `AGENTS.md`, 9-step Skill, README commands verified | Naming inconsistency; stale `kyc-review.yaml` in 2 docstrings; Node version claim |

Code size (lines): `core` 195, `shared` 776, KYC backend 429, KYC frontend 373, tests 215. The KYC app is ~45 % of the
non-test code — a healthy ratio for app #1, but note that a lot of the "template" is UI chrome; the backend core is only 195 lines.

---

## D. Power Apps capability comparison

| # | Capability | Classification | Notes |
|---|---|---|---|
| 1 | Rapid data-driven app development | **Partially implemented** | One app, from spec, in one session. Repeatability asserted by structure, not yet demonstrated with app #2. |
| 2 | Forms and record management | **Architecturally possible, not implemented** | Read + single action only. No create/edit forms. |
| 3 | Search, sorting, filtering | **Partially implemented** | Search + filters verified; no sorting/pagination. |
| 4 | Data connectivity | **Not addressed** | SQLite only; no connectors to Postgres/Salesforce/Stripe etc. Power Apps' main selling point. |
| 5 | Business workflows | **Implemented and verified** (single-app) | Explicit state machine, backend-enforced, audited. Stronger than typical Power Apps logic, but hand-written per app. |
| 6 | Persistent storage | **Implemented and verified** (prototype-grade) | SQLite file; survives restart. Not multi-user/production storage. |
| 7 | Reusable components | **Partially implemented** | Verified for list/detail/action tools; missing forms. |
| 8 | Authentication & authorization | **Architecturally possible, not implemented** | **Simulated personas only.** Header is client-chosen; nothing is authenticated. Role enforcement seam exists. |
| 9 | Audit logging | **Implemented and verified** (per app) | Not a platform capability yet. |
| 10 | External integrations | **Not addressed** | — |
| 11 | Deployment and hosting | **Not addressed** | Local dev servers only; no Dockerfile, no hosting target. |
| 12 | Governance / ALM | **Not addressed** | No CI, environments, release process, or ownership model. Git + PR review is the implicit answer. |
| 13 | Business-user self-service | **Not addressed** (by design) | This model replaces citizen-dev with engineer-reviewed Devin PRs; spec authoring could be the self-service surface but is not shown. |

Replicated: 5, 6, 9 (prototype-grade). Partially: 1, 2(no), 3, 7. Not addressed: 4, 8 (simulated), 10, 11, 12, 13.

---

## E. Security and maintenance risks

Severity: **High** = undermines demo credibility/correctness; **Med** = visible wart or real-but-unlikely bug; **Low** = polish.

### Prototype defects (fix in prototype)
| Sev | Finding | Evidence | Fix |
|---|---|---|---|
| Med | Transition check is outside the write transaction (TOCTOU). Two reviewers racing on one pending case can both succeed (e.g. approve + reject), leaving last-writer status with two audit rows. | `service.py:60` reads status, `:74` opens txn | Read inside the transaction, or `UPDATE … WHERE id=? AND status=?` and raise 409 when `rowcount == 0` (~15 min) |
| Med | Pydantic body errors bypass the uniform error envelope; UI shows raw JSON. Also fires before auth, so a viewer sees 422 instead of 403 for a malformed body. | `curl … {"action":"bogus"}` → `{"detail":[…]}` | Add `RequestValidationError` handler in `core/errors.py` → `{"error":{"code":"validation_error",…}}` (~15 min) |
| Med | No input length limits: 100 kB reason accepted and stored. | curl, stored length 100000 | `Field(max_length=2000)`; same for `q` (~5 min) |
| Med | `python -m app.cli init-db --seed` (without `--reset`) crashes with `IntegrityError` traceback. | run this session | Skip seed when tables are non-empty, print a hint (~10 min) |
| Low | `role="button"` on `<tr>` breaks table semantics for screen readers. | `DataTable.tsx:75` | Drop `role`, keep `tabIndex`/key handling, or put a button in the first cell (~10 min) |
| Low | Unexpected exceptions return FastAPI's plain-text 500, not the envelope. | K | Generic handler returning `{"error":{"code":"internal_error"}}`, log server-side (~10 min) |
| Low | `reviewerNames` duplicated in `apps/kyc/labels.tsx`; drifts from `core/personas.py`. | grep | Read names from `PersonaContext` (`/api/personas`) (~10 min) |
| Low | Stale references to `specs/kyc-review.yaml` in `tests/test_kyc.py:1` and `apps/kyc/rules.py:1`; README says "Node 22" (actual 20.20.2); three template names; "Internal Tools Template" in README + branch name. | grep | Docs sweep (~15 min) |

Checked and **not** an issue: SQL injection (all values parameterised; the only f-strings interpolate constant
clauses/table names from code), hardcoded secrets (none), sensitive data (synthetic only), frontend-only auth (backend
enforces; UI hiding is additive), non-atomic status+audit (single `transaction()`, verified by `test_ac7` + rollback on
exception), CORS (localhost origins only), `X-Demo-User` fallback (unknown → viewer, never escalates).

### Production gaps (out of prototype scope — say so explicitly)
- No authentication: the persona header is **client-chosen**. Requires OIDC/SAML + server-side session and a policy layer at `require_role()`.
- SQLite single file: no HA, backups, migrations, or connection pooling. Postgres + Alembic behind `repository.py`.
- No CI, no frontend tests, no Playwright smoke; no logging/metrics/alerting; no Dockerfile/hosting; no rate limiting, CSRF, security headers; no secrets management; no data-retention or PII handling; no compliance review.
- No optimistic concurrency contract for clients (`expected_status`/ETag) and no idempotency keys.

---

## F. Prioritised recommendations

### P0 — fix before recording the Loom (≈ 1–1.5 h total)
| # | Task | Effort | Why |
|---|---|---|---|
| P0-1 | Unify naming to **Internal Tools Template** across README, AGENTS.md, Skill, log, PR titles; remove the "Internal Tools Template" parenthetical or keep exactly one, clearly labelled as the brief's term; rename branch on next PR | 15 min | Three names in one repo reads as unfinished |
| P0-2 | Fix stale `kyc-review.yaml` docstrings; correct Node version claim; add `--seed` guard with hint | 15 min | README/CLI accuracy is the first thing a reviewer tries |
| P0-3 | `RequestValidationError` → error envelope (and generic 500 handler) | 15 min | Otherwise the "uniform error handling" claim is false for the most common 422 |
| P0-4 | Close the TOCTOU race (`UPDATE … WHERE status=?`, 409 on `rowcount==0`) + one test with two sequential conflicting writes through the service | 20 min | "Backend enforces transitions" must hold under concurrency for a fintech audience |
| P0-5 | `max_length` on `reason` and `q` | 5 min | Trivial, and an obvious question from a VP |

### P1 — high-value within remaining prototype time (≈ 2–3 h; do only what app #2 needs)
| # | Task | Effort | Why |
|---|---|---|---|
| P1-1 | **Shared form primitives**: `TextField`, `SelectField`, `Toggle`, `FormRow` + inline error, in `shared/components` | 45 min | Required by the Feature-Flag panel (toggle + description edit); every CRUD tool after it |
| P1-2 | **Shared audit**: single `audit_events` table in core (`app_id, entity_id, action, previous, new, actor, reason, created_at`) + `record_audit(conn, …)` helper + `GET /api/audit?app=&entity=`; migrate KYC to it | 60 min | Two apps need it; prevents 10 drifting audit tables; gives one cross-app audit view (a real Power Apps gap) |
| P1-3 | Per-app roles: persona carries `roles: list[str]`; `require_role()` accepts any; add `flag_admin` to a reviewer persona | 20 min | Avoids editing core for every app's role model |
| P1-4 | Spec: add `forms:` (fields, type, required, options) and `environments:`/`enums:` sections; document in Skill step 1 | 20 min | Makes "spec → UI" concrete for edit-style tools |
| P1-5 | Add `api.put/patch`, URL-synced filter helper (`useFilterParams`), move debounce into `SearchInput` | 20 min | Small, removes copy-paste from app #2 |
| P1-6 | CI: GitHub Actions running pytest + typecheck + build | 15 min | Cheapest credibility win; also governance story |
| P1-7 | One frontend test (Vitest + Testing Library) for `ConfirmDialog` reason reset | 20 min | Shows the frontend is testable; covers the bug Devin Review found |

### P2 — production considerations
Real identity (OIDC) + policy; Postgres + migrations; Dockerfile + hosting + env config; logging/metrics/alerts; Playwright smoke in CI; concurrency contract (`expected_status`, idempotency keys); security review (headers, rate limits, CSRF), PII/retention policy, compliance evidence; data connectors (Postgres/Stripe/Salesforce) as the real Power Apps substitute; ownership/ALM model (per-app CODEOWNERS, release notes).

---

## G. Final verdict

1. **Is the KYC Review Queue genuinely functional?** Yes. Every functional requirement was verified by automated tests and a browser run including a backend restart. Remaining defects are edge cases (race, limits, envelope), not demo blockers — but fix them (P0) because the audience is fintech.
2. **Is the template reusable today, or a KYC app with shared components?** In between, closer to reusable. The shared layer has no KYC coupling and the KYC module added no shared code — that is real evidence. But the template only covers the *list → detail → audited action* shape; it has no form/edit capability and no shared audit, so app #2 would have to extend the template, not just use it. Call it "a reusable foundation for workflow tools, proven on one app."
3. **Could an unfamiliar engineer build another tool with it?** Mostly yes. `AGENTS.md` + Skill + spec are concrete and match the code; setup is six commands. They would trip on: which name the template has, the `--seed` crash, and the lack of guidance for edit-style pages. Nothing essential lives only in the original conversation except the decision log in `docs/IMPLEMENTATION_LOG.md` (which is in the repo).
4. **Single highest-value improvement next?** **P1-1 + P1-2 together (form primitives + shared audit)** — they are exactly what the Feature-Flag panel needs and what turns "one app on a template" into "a template that handles two app shapes." Do P0 first (≈1 h).
5. **Fix the template, build feature flags, or stop?** In order: (a) P0 fixes (≈1 h), (b) P1-1/P1-2/P1-3 (≈2 h), (c) build the Feature-Flag panel *from a spec via the Skill* and time it — that recording is the strongest evidence you can show. If the total budget is already spent, do (a) only and present the template honestly as proven for one app shape.
6. **Claims to avoid with the VP:** "replaces Power Apps"; "has authentication/RBAC" (it has simulated personas); "production-ready" or "secure"; "connects to our data" (SQLite only); any cost-saving number; "the template is proven across tools" (n=1 until feature flags exists); "20 minutes to build" without saying the template took most of the session and the browser run found two bugs; "no Devin bugs" — Devin Review and testing each found real defects that were fixed, which is the better story to tell.
