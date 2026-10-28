# Internal Tools Template — Audit after two applications

Scope: `.agents/skills/create-internal-tool/SKILL.md` (the Skill), `AGENTS.md` + the shared template code
(`backend/app/core`, `frontend/src/shared`), and the two spec files (`specs/kyc.yaml`, `specs/feature_flags.yaml`),
judged against what actually happened while building app #1 (KYC Review Queue, PR #2) and app #2 (Feature-Flag Admin
Panel, PR #5, fresh session with repository-only context). Code as of PR #5 head `ebabe4e`.

Evidence keys: **S** = Skill text, **A** = AGENTS.md, **C** = code (`grep`/`wc`/`diff` in this session),
**R** = Devin Review finding on PR #5, **M** = `docs/FEATURE_FLAG_BUILD_METRICS.md`, **L** = `docs/IMPLEMENTATION_LOG.md`.
Effort figures are estimates, not measurements. The earlier `AUDIT.md` (after app #1) is referenced as `AUDIT P1-x`.

## A. Scores

| Artifact | Score | One-line justification |
|---|---|---|
| Skill (`SKILL.md`) | **7 / 10** | Steps 1–9 were followed as written and produced a working app in a fresh session (M §F). Deductions: ambiguous spec filename rule that caused a review finding (R-0004); stale component list; `npm run build`, regression-before-shared-change and spec-parse checks missing; no guidance on timestamps or concurrency tests, both of which produced review findings. |
| `AGENTS.md` + template code | **6.5 / 10** | Registration-only wiring, error envelope, transactions, personas, fixtures all reused unchanged (M §F). Deductions: `transaction()` had a latent 500-under-concurrency bug that 28 tests missed (fixed `dfae768`); audit table/timeline, `_now`, seed helpers, debounce hook and label pattern are copy-pasted per app; component list in AGENTS.md is already stale; no CI, no frontend tests (AUDIT P1-6/7 still open). |
| Spec files (format + both files) | **7 / 10** | `business_rules.on_violation` → tests mapped 1:1 in both apps; sections were enough for a fresh session to write a second spec in the same shape. Deductions: nothing validates a spec (not even "file exists for each registered app"); timestamp format and seed-history consistency are unspecified (R-0002, R-0003); `roles:` implies per-app roles that do not exist; `feature_flags.yaml` has a now-wrong header comment; Skill step 1 lists a fixed section set (`workflow`) that app #2 legitimately lacks. |
| **Overall** | **7 / 10** | Clean and usable: a second app was built with 49 shared-code lines changed. Not yet comprehensive: the five review findings on app #2 all trace to conventions the documents do not state. |

## B. Skill audit — step by step

| Step | Verdict | Evidence | Gap / fix |
|---|---|---|---|
| Frontmatter / description | PARTIAL | S line 3 says `specs/<app>.yaml`; S line 12 and A say `specs/<app_id>.yaml`; nothing says ids are snake_case (Python package, API prefix) while routes are kebab-case (`/feature-flags`). | R-0004: app #2 shipped `specs/feature-flags.yaml`, renamed after owner decision. State the rule once: `app.id` = snake_case = package = table prefix = spec filename; `pages.route` may be kebab. |
| 1. Read the specification | PARTIAL | Lists a fixed section set incl. `workflow`; `feature_flags.yaml` has `environments:` instead (C). No "check the spec parses" step; KYC's first spec did not parse (L line 75). | Say "sections as applicable; `business_rules.on_violation` and `acceptance_criteria` are mandatory". Add `python -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" specs/<id>.yaml`. |
| 2. Inspect what already exists | PARTIAL | S lines 22–24 list 9 components; `shared/components/index.ts` exports 11 (+`Toggle`, `SearchInput`, `SelectFilter`, `DescriptionList`, `Section`, `cx`); `shared/format.ts` and `shared/persona/` are not mentioned (C). KYC's `labels.tsx` still has its own `formatDate` while app #2 used `shared/format.ts` — the list drift is already producing inconsistency. | Replace the enumerated list with "read `frontend/src/shared/components/index.ts`, `shared/format.ts`, `shared/persona/`"; keep the enumerated list in AGENTS.md only. |
| 3. Reuse before you build | PASS | Rule "add shared only if needed and generic" was applied correctly: `Toggle` (generic) added, audit timeline kept app-local (M §F). | Add: "if you change a shared component, re-run the existing apps' tests **and** re-verify their browser flow" — `ConfirmDialog.collectReason` required a KYC re-test (M §F problem 3). |
| 4. Implement the backend app | PASS | Layout matched 1:1 in both apps; registry docstring is accurate (C). | Add the timestamp convention (see D-4) and "read-then-write inside `transaction()`" — both apps did it right, but only because KYC did. |
| 5. Implement the frontend app | PARTIAL | Works, but the real conventions (`?case=`/`?flag=` URL state, debounced search, `labels.tsx` tone maps, audit `<ol>` timeline) live only in KYC code; the Skill says "copy their structure" (S line 25). Both pages contain an identical 8-line `useDebounced` hook (C). | Either name those idioms in the Skill or promote them to shared (see E). |
| 6. Tests | PASS | 13 tests per app, `test_ac<N>_` naming honoured; 4 extra non-AC tests per app follow the same pattern (C). Fixtures reused unchanged. | Add a convention for the extras (`test_<rule>_...`) and the two-connection concurrency pattern (see C-2). |
| 7. Run everything | PARTIAL | S lines 53–57 omit `npm run build` (the brief required it; it passed, 1.26 s) and do not say "run the **full** suite so existing apps act as regression" — which is what caught nothing but would have been the place to catch the `ConfirmDialog` regression if a frontend test existed. | Add `npm run build`; say "full `pytest`, not only `test_<app_id>.py`". |
| 8. Fix failures | PASS | Honoured: one test assumption was wrong (Pydantic coerces `"yes"`) and the **test** was corrected with the reason recorded (M §F problem 2). | — |
| 9. Summarize | PASS | L Milestone 5 and PR #5 description link the spec. | Add "record elapsed time and lines changed in shared vs app code" — M did this ad hoc; it is the metric the template exists for. |

## C. AGENTS.md and template code

| Area | Verdict | Evidence | Gap / fix |
|---|---|---|---|
| C-1 Shared code map | PARTIAL | A "Shared code" block lists components without `Toggle`; omits `shared/format.ts`, `shared/persona/`, `shared/components/cx.ts`; test fixtures listed correctly (C). | Regenerate the block; add a one-line test or script that diffs the list against `index.ts` exports, or drop the list in favour of pointing at `index.ts`. |
| C-2 `transaction()` correctness | FAIL → fixed | Deferred `BEGIN` + read-then-conditional-`UPDATE` returned `sqlite3.OperationalError: database is locked` (HTTP 500) when a competing commit landed between read and write; reproduced in session, fixed with `BEGIN IMMEDIATE` (`dfae768`). Both apps' concurrency tests use **one** connection with a monkeypatched stale read and could not see it (C: `test_concurrent_*` in both modules). | A rule 3 should state the semantics ("`transaction()` takes the write lock up front; do all reads for a decision inside it"). Add a two-connection helper/fixture to `conftest.py` and one core test; the Skill's step 6 should require it for any app with a conditional write. |
| C-3 Audit logging | PARTIAL | Still per-app (AUDIT P1-2 open): two audit tables, two `insert_audit_event`, two `list_audit_events`, two `_row_to_event`, two Pydantic event models, two `<ol>` timelines (C). `service.py` and `repository.py` share 27 identical lines each between apps (C: `comm`). | Promote at app #3 (rule of three) — or now, since two apps already pay for it: core `audit_events` table + `record_audit()` + shared `AuditTimeline` component. |
| C-4 Timestamps | FAIL → convention missing | `_now()` defined identically in both services (second precision, `Z` suffix); `BASE`/`_iso` defined identically in both seeds (C). Second precision produced R-0002 (dismissed as consistent, but it is *undocumented* consistency). | Add `utc_now_iso()` to `core/db.py` (or `core/time.py`) and state the format in A ("ISO-8601 UTC, `Z`, second precision; audit order = `created_at DESC, id DESC`"). |
| C-5 Roles | PARTIAL | `Role = Literal["reviewer","viewer"]` is global (C `personas.py:16`); app #2 reuses `reviewer` for "permitted engineer" and the spec has to explain it (`feature_flags.yaml` lines 19–23). AUDIT P1-3 open. | Per-app roles or at least rename the role concept (`editor`) in A so the next spec does not need an apology. |
| C-6 Frontend idiom duplication | PARTIAL | Identical `useDebounced` in both pages; both pages hand-roll `?id=` URL state; KYC `labels.tsx:26` has `formatDate` duplicating `shared/format.ts` (C). | Move debounce into `SearchInput`; add `useUrlParam()` to `shared/api` or `shared/hooks`; migrate KYC to `shared/format.ts`. |
| C-7 Spec ↔ code link | FAIL | `registry.py` docstring: `APP_ID` "matches `specs/<app_id>.yaml`" — nothing checks it (C). R-0004 would have been a failing test instead of a review comment. | `tests/test_core.py`: for every installed app, `specs/<APP_ID>.yaml` exists, parses, and `app.id == APP_ID`. ~10 lines. |
| C-8 Setup and CLI | PASS | `init-db --seed` without `--reset` now skips with a hint (C, run in session); `RequestValidationError` handler exists (C `errors.py:55`); README commands verified in both builds. | Blueprint needed `nvm use 20` before frontend commands (M §F problem 1) — now in the blueprint, not in README/AGENTS. Add one line under "Running locally". |
| C-9 CI / frontend tests | FAIL | None exist (C). The `ConfirmDialog` regression was found only by the recorded browser run. AUDIT P1-6/7 open. | GitHub Actions: `pytest`, `npm run typecheck`, `npm run build`. One Vitest for `ConfirmDialog` (`requireReason` vs `collectReason`). |

## D. Spec files

| Area | Verdict | Evidence | Gap / fix |
|---|---|---|---|
| D-1 Section set | PARTIAL | KYC: `workflow`; FF: `environments` + `data_model.constraints`; AC `kind: regression` exists only in FF (C). Skill step 1 lists a fixed set. | Document core vs optional sections at the top of each spec (comment block) and in the Skill. |
| D-2 Rule → test traceability | PASS | Every `on_violation` code appears in a `test_ac*` in both modules; AC ids map to test names (C). | — |
| D-3 Validation | FAIL | Nothing parses or checks a spec; first KYC spec was invalid YAML (L line 75). | C-7 test covers existence/parse/id; a JSON-Schema is optional later. |
| D-4 Timestamp format | FAIL | Both specs type fields as `datetime` only. | One line in the spec header comment or AGENTS.md (see C-4). |
| D-5 Seed consistency | FAIL → fixed | FF spec: "a few flags ship with a historical audit event" with no consistency requirement; seed stamped `updated_at` later than its last event (R-0003, fixed `a522e60`). KYC spec line 127 has the same wording. | Add to `seed_data.requirements` template: "every record's `updated_at` equals the `created_at` of its newest audit event". |
| D-6 Header comment accuracy | FAIL | `feature_flags.yaml` lines 5–6 say the file is named `feature_flags.yaml` "as requested by the task brief" — the brief asked for `feature-flags.yaml`; the name was changed by owner decision after R-0004. Introduced by the rename commit in this session. | Rewrite the note: "file name = `app.id` per AGENTS.md". |
| D-7 Roles section | PARTIAL | Both specs declare `roles:` as if per-app; implementation is the global persona role (C-5). | Say "roles reference the global persona roles in `core/personas.py`" until per-app roles exist. |
| D-8 Browser criterion | PARTIAL | AC-10 in both specs is one sentence containing 6–7 checks; the browser run had to split it into a checklist itself (M §E). | List the checks as bullets so the recording can be ticked against them. |
| D-9 Readability | PASS | 173 / 175 lines, commented, consistent key order; a fresh session reproduced the shape without instruction (M §F). | — |

## E. What the two builds duplicated (promote-to-shared candidates, measured)

| Item | KYC | Feature flags | Lines | Recommendation |
|---|---|---|---|---|
| `_now()` | `service.py:16` | `service.py:16` | 2 × 2 | core helper (C-4) |
| `BASE`, `_iso()` seed helpers | `seed.py:8,11` | `seed.py:7,10` | 2 × 4 | core helper |
| audit table DDL + insert + list + row mapper + Pydantic model | `schema.py`, `repository.py:40,58`, `schemas.py` | same | ≈ 2 × 45 | shared audit (C-3) |
| `useDebounced` | `KycQueuePage.tsx:13-20` | `FeatureFlagsPage.tsx:13-20` | 2 × 8 | into `SearchInput` |
| `?id=` URL-state for the detail panel | `KycQueuePage.tsx` | `FeatureFlagsPage.tsx` | ≈ 2 × 10 | `useUrlParam()` |
| audit timeline `<ol>` | `CaseDetailPanel.tsx:130-140` | `FlagDetailPanel.tsx:108-118` | ≈ 2 × 12 | `AuditTimeline` component |
| `labels.tsx` tone/label maps + Pill components | 35 lines | 19 lines | pattern only | document in Skill step 5; keep app-local |
| date formatting | `labels.tsx:26` (own) | `shared/format.ts` | — | migrate KYC |

## F. Prioritised fixes

### P0 — correctness of the documents themselves (≈ 45 min)
| # | Task | Why |
|---|---|---|
| P0-1 | Skill + AGENTS.md: one explicit naming rule (`app.id` snake_case = package = spec filename; routes kebab) and remove `specs/<app>.yaml` wording | Caused R-0004 and an owner decision |
| P0-2 | `tests/test_core.py`: spec exists / parses / `app.id == APP_ID` for every installed app | Turns the convention into a failing test |
| P0-3 | Fix `feature_flags.yaml` header note (D-6) | Currently states a falsehood |
| P0-4 | AGENTS.md rule 3: document `BEGIN IMMEDIATE` semantics and "reads inside the transaction"; add the timestamp convention (C-4) | Both were review findings; neither is written anywhere |
| P0-5 | Refresh the shared-code lists in AGENTS.md and Skill step 2 (or point at `index.ts`) | Already stale after one app |

### P1 — remove the copy-paste the second app proved (≈ 2–3 h)
| # | Task |
|---|---|
| P1-1 | `utc_now_iso()` + seed time helpers in core; both apps use them |
| P1-2 | Two-connection concurrency fixture in `conftest.py` + core test; Skill step 6 requires it for conditional writes |
| P1-3 | `SearchInput` debounce, `useUrlParam()`, `AuditTimeline`; migrate KYC `formatDate` to `shared/format.ts` |
| P1-4 | Shared audit table/helper (AUDIT P1-2) — or explicitly defer to app #3 and say so in AGENTS.md |
| P1-5 | Skill: add `npm run build`, spec-parse check, "full pytest as regression", "shared change ⇒ re-verify existing apps", and "record shared-vs-app lines + elapsed time" in step 9 |
| P1-6 | Spec template: optional sections list, seed-consistency requirement, roles note, AC-browser as bullets |
| P1-7 | CI (pytest + typecheck + build) and one Vitest for `ConfirmDialog` |

### P2 — before a third app of a different shape
Per-app roles (C-5); form primitives (`TextField`, `SelectField`) — still absent, so a CRUD-style tool would again extend the template; a JSON-Schema for specs; Playwright smoke test replacing the manual browser AC.

## G. Verdict

1. **Clean?** Yes. Both builds followed the documents without needing the original conversation; the fresh-session premise held (M §F).
2. **Easy to use?** Mostly. The two-list drift (AGENTS.md vs Skill vs `index.ts`) and the hyphen/underscore ambiguity are the only things that actively misled.
3. **Comprehensive?** Not yet. Every one of the five review findings on app #2 (concurrency 500, second-precision timestamps, seed history, spec filename, plus the browser-found optional-reason gap) corresponds to a convention that exists only in KYC's code or in nobody's head. Writing those five conventions down (P0) is cheap; the duplication in §E is the honest cost of "reuse by copying", and app #3 should not pay it a third time (P1).

---

## H. Fixes applied (same PR, after the audit)

| Audit item | Commit content | Verified by |
|---|---|---|
| P0-1, P0-5, C-1 | AGENTS.md rules 7–9 (timestamps, naming, per-app audit), refreshed shared-code map; Skill frontmatter/steps 1–7, 9 updated (naming, parse check, `index.ts` as the component source of truth, shared-change regression rule, timestamps/conditional write, frontend idioms, two-connection tests, `npm test`/`build`, metrics in the summary) | read-through |
| P0-2, C-7, D-3 | `tests/test_core.py::test_every_installed_app_has_a_matching_spec` (parametrised over `installed_apps()`) | `pytest` 31 passed |
| P0-3, D-6, D-1, D-5, D-7, D-8 | Both spec headers state the conventions; wrong "task brief" note removed; seed-consistency requirement added (KYC seed checked: 0 mismatches over 12 cases); AC-10 split into bullets | `yaml.safe_load` + query |
| P0-4, C-2, C-4, P1-1 | `app/core/time.py` (`utc_now_iso`, `to_iso`, `SEED_EPOCH`); both services/seeds use it; AGENTS.md rule 3 documents `BEGIN IMMEDIATE` | `pytest` 31 passed |
| P1-2 | `test_core.py::test_transaction_takes_the_write_lock_up_front` — two real connections | `pytest` |
| P1-3, C-6, E | `shared/hooks.ts` (`useDebounced`, `useUrlParam`), `shared/components/AuditTimeline.tsx`; both pages/panels use them; KYC `formatDate` removed in favour of `shared/format.ts` (−60 net lines in the two apps) | `tsc -b`, `vite build`, browser re-check |
| P1-4, C-3 | Decision recorded in AGENTS.md rule 9: audit tables stay per app until a third app; `AuditTimeline` removes the UI half of the duplication | — |
| P1-7, C-9 | `.github/workflows/ci.yml` (pytest, typecheck, Vitest, build); `ConfirmDialog.test.tsx` (4 tests: required, optional, none, reset) | `npm test` 4 passed |

Not done (P2): per-app roles, form primitives, spec JSON-Schema, Playwright smoke test.
