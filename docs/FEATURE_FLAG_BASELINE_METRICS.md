# Feature-Flag Admin Panel — Control Run (no template, no Skill) vs Template Run

Experiment question: `docs/FEATURE_FLAG_BUILD_METRICS.md` measured how long and how much code it took to
build the Feature-Flag Admin Panel **on** the Internal Tools Template with the `create-internal-tool`
Skill. It had no control group. This report adds one: the same tool, same spec, same fixed stack,
same agent mode, built by a fresh Devin session **without** the template, the Skill, `AGENTS.md`,
the shared components or the KYC code.

Every number below is a measured value with its source, or is marked **NOT MEASURED**. The caveats in
§5 are material; read them before quoting any ratio.

---

## 1. Setup

| Item | Template run (treatment) | Control run |
|---|---|---|
| Session | https://app.devin.ai/sessions/929c6363efd14330b0ab305373bc0200 | https://app.devin.ai/sessions/14b2a627a5e341ffbd6f14dd9454a76a (child session) |
| Agent mode | Ultra | Ultra (inherited) |
| Starting point | `main` at `0364651` (template + KYC app, 1599 source lines, 948 of them shared template) | Empty directory. The repo was attached only for push credentials; the session's first command was `rm -rf` of the pre-cloned checkout (verified in its event log: no file read before the delete) |
| Input | Task brief + repository (`AGENTS.md`, Skill, `specs/kyc.yaml`, code); the session wrote `specs/feature_flags.yaml` itself (2 min 32 s) | The same `specs/feature_flags.yaml`, handed over pre-written, with its template-pointing lines neutralised (removed "see AGENTS.md", "shared Toggle", "reuses the template's write role", two `backend/app/core/...` path hints; AC-9 "KYC tests still pass" marked NOT APPLICABLE) |
| Stack constraint | Implicit (the template's) | Explicit in the prompt: FastAPI + Pydantic + stdlib `sqlite3`, pytest over `TestClient` + temp SQLite; React 18 + TS + Vite + Tailwind; `X-Demo-User` persona header with `reviewer`/`viewer` roles |
| Verification bar | Skill steps 6–8: AC tests over HTTP, `tsc`, `vite build`, recorded browser run by the testing agent | Same, but the browser check was done by the session itself with screenshots (3 required states + 1 defect) |
| Output | PR #5 (`be1f095` final code commit) | Orphan branch `baseline/no-template-feature-flags`, head `ca88e20` (no PR, `main` untouched) |

## 2. Development time

Sources: `date -u` marks recorded by each session at its first command, and `git log --format=%cI`.

| Phase | Template run | Control run |
|---|---|---|
| First command (START) | `05:23:41Z` | `20:06:01Z` |
| Environment repair + reading the repo + baseline measurement | 3 min 02 s (→ `4d501e5`) | — (nothing to read) |
| Writing the spec | 2 min 32 s (→ `f455afe`) | — (spec supplied) |
| Backend implemented | 1 min 55 s (→ `4337050`) | 3 min 36 s (→ `658bf29`, incl. db/errors/personas/time helpers/CLI) |
| Tests + frontend, first green `pytest` + `tsc` + `vite build` | 34 s (→ `085d208`) | 3 min 27 s (tests `7f8edb6` +14 s; frontend `178879b` +3 min 13 s) |
| **Spec in hand → first complete build (implementation only)** | **2 min 29 s** (`05:29:15Z` → `05:31:44Z`) | **7 min 03 s** (`20:06:01Z` → `20:13:04Z`) |
| START → first complete build (as each session experienced it) | 8 min 03 s | 7 min 03 s |
| Browser check → fix committed | 7 min 36 s (testing-agent run #1 found the missing optional-reason field → `be1f095` at `05:39:20Z`) | 6 min 09 s (own browser check found a stale list row after a 409 → `ca88e20` at `20:19:13Z`; README + spec commits in between) |
| START → final code commit | 15 min 39 s | 13 min 12 s |
| START → final commit incl. documentation | 22 min 08 s (metrics report, log, README) | 13 min 12 s (README only; this report was written by the parent session afterwards: NOT MEASURED) |
| `pytest` iterations / failures | 3 runs; 1 failure (wrong test assumption, test corrected) | 3 runs; 0 failures (first run had 56 deprecation warnings → `on_event` replaced by lifespan) |
| Browser iterations / defects | 2 runs; 1 defect (dialog lacked optional reason) | 1 run + re-verify; 1 defect (list row stale after out-of-band 409) |
| Human prompts during the build | 0 | 0 |

Reading: when the clock starts with a spec in hand, the template run reached a complete, green build in
roughly a third of the time (2 min 29 s vs 7 min 03 s). Measured end to end as each session experienced
it, the two are within a minute of each other, because the template run spent 5½ minutes on repo
reading, environment repair and spec writing that the control did not have to do.

## 3. Code written (`cloc` code lines; same counting conventions as `FEATURE_FLAG_BUILD_METRICS.md` §0.1)

| Metric | Template run (delta `0364651` → `be1f095`) | Control run (`ca88e20`, everything is new) |
|---|---|---|
| Backend source | +270 (`backend/app/apps/feature_flags/`) | 440 (`backend/feature_flags/`, 13 files: api, service, repository, models, seed, db, errors, personas, time_utils, main, CLI) |
| Frontend source | +349 (`frontend/src/apps/feature_flags/` + 49 shared) | 863 (`frontend/src/`, 13 files: pages, components, api client, persona context, format) |
| **Total source** | **+619** (570 app-specific + 49 shared template) | **1 303** |
| Test code | +142 (`test_feature_flags.py`; `conftest.py` reused) | 265 (`test_feature_flags.py` 232 + `conftest.py` 33) |
| Config / scaffolding (package.json, tsconfig, vite/tailwind/postcss, requirements, pytest.ini, .gitignore) | 0 (existed) | 81 raw lines, 9 files |
| Files created | 10 source/test files + 1 spec | 38 tracked files (excl. lockfile) + spec |
| Shared / reusable code produced | 49 lines added to the shared template (`Toggle`, `ConfirmDialog` optional reason, registry) — available to app #3 | 0 by construction; the equivalents of the template's `db`, `errors`, `personas`, time helpers, `ConfirmDialog`, `Toast`, `States`, `Badge`, API client and persona switcher were re-implemented inside the app (~600 of the 1 303 lines by file: NOT MEASURED precisely) |
| Backend tests at delivery | 28 total (13 new flag tests + 15 pre-existing core/KYC) | 28 (all flag tests: 8 AC groups incl. parametrised personas, 6 BR tests, 4 seed/meta tests) |
| Frontend tests / CI | none at `be1f095` (added later in PR #5) | none |

Reading: the control wrote **2.1×** the source lines and **1.9×** the test lines for the same feature set,
and none of it is reusable by a next tool. The template run's 619 lines include 49 that *are* reusable.
The control's test file is more thorough per test than the template run's at `be1f095` (it already has a
two-connection concurrency test and a rollback test, which the template repo only gained in the PR #5
review round) — see §5, caveat 2.

## 4. Verification of the control artefact (run by the parent session, not self-reported)

```
$ git worktree add /tmp/ctrl origin/baseline/no-template-feature-flags
$ cd /tmp/ctrl/backend && python -m pytest -q -p no:warnings
28 passed in 1.50s
$ cd /tmp/ctrl/frontend && npm ci && npx tsc -b && npx vite build
tsc exit 0
✓ built in 1.17s
```

Browser evidence (screenshots attached to PR #9 and to the child session): staging toggle with toast
and audit entry; production flag locked; viewer read-only; inline `409 invalid_transition` with the
stale list row that the control's one browser-found defect fixed.

Functional parity, by inspection of the branch: same endpoints (`GET /meta`, `GET /flags`, `GET /flags/{id}`,
`POST /flags/{id}/toggle`), same error codes per `on_violation`, uniform `{"error": {code, message}}`
envelope, `BEGIN IMMEDIATE` transaction with a conditional update (rowcount 0 → 409), audit order
`created_at DESC, id DESC`, seeded `updated_at` = newest audit event. The control also chose
`enabled` as a strict boolean (string `"true"` → 422), which the template app only adopted in PR #7.

## 5. Caveats (read before quoting a ratio)

1. **Contamination — `AGENTS.md` was in the control's context from the start.** The child reported that
   the harness injected the repo's `AGENTS.md` as an always-on rule block "after all source was written".
   Its event log says otherwise: `rules_injected: AGENTS … always_on` at `20:05:57–20:06:01Z` — i.e. at
   START, before the first line of code — and again at `20:18:58Z`. The session's own reasoning at
   `20:06:08Z` acknowledges seeing it. So the control had **no code, no Skill, no KYC example and no
   shared components**, but it did have the template's *written conventions* (layering, error envelope,
   personas, transaction and audit rules). Several conventions in the control's code match `AGENTS.md`
   (envelope shape, `BEGIN IMMEDIATE`, per-app audit table, service/repository split); some of those are
   also in the spec or are common practice, so how much came from `AGENTS.md` is **NOT MEASURED**. Net
   effect: the control is "no template code, no Skill", not "no template knowledge" — it likely
   *understates* the gap in defects/decisions and does not affect the line counts much (the code still
   had to be written). A clean re-run needs a session on a repo without an `AGENTS.md`.
2. **The spec was written under template conventions.** `specs/feature_flags.yaml` names the exact
   endpoints, error codes, audit fields and seed rules, which is most of the design work. Both runs
   benefited equally, but the control's "7 min 03 s with 0 test failures" is a measurement of
   *implementing a very precise spec*, not of designing a tool from a vague request.
3. **n = 1 per arm, same model, different wall-clock hours.** No variance estimate is possible; a second
   control run could plausibly land anywhere between 5 and 15 minutes.
4. **Different browser-check methods.** The template run used the recorded testing agent (two full
   runs, ~7½ min); the control checked itself with screenshots (faster, less adversarial). The
   post-build phases are therefore not directly comparable; the "spec → first green build" row is the
   cleanest comparison.
5. **Not measured on either arm:** human review time, model-vs-tool time split, token/ACU cost,
   maintainability over time, and the cost of the template itself (building the template and KYC app
   took two earlier PRs — amortised over two apps so far).

## 6. Conclusion

- **Time:** with a spec in hand, the template cut implementation-to-green-build time from 7 min 03 s to
  2 min 29 s (−65 %). End-to-end as experienced, the runs were within a minute, because the template
  session also spent time reading the repository and writing the spec.
- **Code:** the template halved the code that had to be written for the same feature set (619 vs 1 303
  source lines; 142 vs 265 test lines) and was the only arm to produce reusable code (49 shared lines).
- **Quality:** both arms found exactly one defect in the browser that tests had missed; the control's
  backend tests were more thorough than the template run's first version. The template's advantage is
  consistency with the existing app (shared shell, components, conventions), not raw correctness.
- **What would make the result trustworthy:** a control on a repo with no `AGENTS.md` (caveat 1), two
  or three runs per arm, and a third app that is *not* a list/detail/audit tool.
