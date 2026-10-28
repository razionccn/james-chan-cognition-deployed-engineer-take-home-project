# Feature-Flag Admin Panel — Control Run (no template, no Skill) vs the Template Run

Experiment question: `docs/FEATURE_FLAG_BUILD_METRICS.md` measured how long and how much code it took to
build the Feature-Flag Admin Panel **on** the Internal Tools Template with the `create-internal-tool`
Skill. It had no control group. This report adds one: the same tool, same spec, same fixed stack, same
agent mode, built by a fresh Devin session **without** the template, the Skill, `AGENTS.md`, the shared
components or the KYC code. The control session had no repository attached, so the harness could not
inject repository rules; its event log contains no `rules_injected` event.

Every number below is a measured value with its source, or is marked **NOT MEASURED**.

---

## 1. Setup

| Item | Template run (treatment) | Control run |
|---|---|---|
| Session | https://app.devin.ai/sessions/929c6363efd14330b0ab305373bc0200 | https://app.devin.ai/sessions/eab8be6bfad044059caae56c2c8379ca (child session) |
| Agent mode | Ultra | Ultra |
| Starting point | `main` at `0364651` (template + KYC app: 1599 source lines, 948 of them shared template) | Empty directory; no repository attached |
| Input | Task brief + repository (`AGENTS.md`, Skill, `specs/kyc.yaml`, code); the session wrote `specs/feature_flags.yaml` itself (2 min 32 s) | The same `specs/feature_flags.yaml`, pre-written, with its template-pointing lines neutralised (removed "see AGENTS.md", "shared Toggle", "reuses the template's write role", two `backend/app/core/...` path hints; AC-9 "KYC tests still pass" marked NOT APPLICABLE) |
| Stack constraint | Implicit (the template's) | Explicit in the prompt: FastAPI + Pydantic + stdlib `sqlite3`, pytest over `TestClient` + temp SQLite; React 18 + TS + Vite + Tailwind; `X-Demo-User` persona header, `reviewer`/`viewer` roles |
| Verification bar | AC tests over HTTP, `tsc`, `vite build`, recorded browser run by the testing agent | Same, browser check by the session itself with screenshots |
| Output | PR #5 (`be1f095` final code commit) | Delivered as a `git bundle`; pushed by the parent session as orphan branch `baseline/no-template-feature-flags` (`67c6cb1`); no PR, `main` untouched |

## 2. Development time

Sources: `date -u` marks recorded by each session at its first command, and `git log --format=%cI`.

| Phase | Template run | Control run |
|---|---|---|
| First command (START) | `05:23:41Z` | `20:30:42Z` |
| Environment repair + reading the repo + baseline measurement | 3 min 02 s (→ `4d501e5`) | — (nothing to read) |
| Writing the spec | 2 min 32 s (→ `f455afe`) | — (spec supplied) |
| Backend implemented | 1 min 55 s (→ `4337050`) | 2 min 31 s (→ `dfdf7c3`, incl. db/errors/personas/CLI) |
| Tests + frontend → first green `pytest` + `tsc` + `vite build` | 34 s (→ `085d208`) | 4 min 49 s (tests `e9a6e17` +1 min 13 s; frontend `6efe0f9` +3 min 36 s) |
| **Spec in hand → first complete build** | **2 min 29 s** (`05:29:15Z` → `05:31:44Z`) | **7 min 20 s** (`20:30:42Z` → `20:38:02Z`) |
| START → first complete build (as each session experienced it) | 8 min 03 s | 7 min 20 s |
| Browser check → last fix committed | 7 min 36 s (testing-agent run #1 found 1 defect → `be1f095` at `05:39:20Z`) | 4 min 55 s (own browser check found 3 defects → `fa57ae5`, `b92f650`, `67c6cb1` at `20:42:57Z`) |
| START → final code commit | 15 min 39 s | 12 min 15 s |
| START → final commit incl. documentation | 22 min 08 s (metrics report, log, README) | 12 min 15 s (README only; this report was written by the parent session afterwards: NOT MEASURED) |
| `pytest` runs / failures | 3 / 1 (wrong test assumption; test corrected) | 3 / 0 |
| Browser-found defects the tests missed | 1 (dialog lacked the optional reason field) | 3 (detail panel covered the header and persona switcher; list row stale after a 409; **Escape closed the dialog and the panel together**) |
| Human prompts during the build | 0 | 0 |

Reading: with a spec in hand, the template run reached a complete, green build in about a third of the
time (2 min 29 s vs 7 min 20 s). Measured end to end as each session experienced it, the two runs are
within a minute of each other, because the template run spent 5½ minutes reading the repo, repairing
the environment and writing the spec — work the control did not have to do.

## 3. Code written (`cloc` code lines; same counting conventions as `FEATURE_FLAG_BUILD_METRICS.md` §0.1)

| Metric | Template run (delta `0364651` → `be1f095`) | Control run (`67c6cb1`, everything is new) |
|---|---|---|
| Backend source | +270 (`backend/app/apps/feature_flags/`) | 396 (`backend/feature_flags/`, 10 files) |
| Frontend source | +349 (of which 49 shared) | 861 (`frontend/src/`, 11 files) |
| **Total source** | **+619** (570 app-specific + 49 shared template) | **1 257** |
| Test code | +142 (`test_feature_flags.py`; `conftest.py` reused) | 223 (3 files) |
| Config / scaffolding written (package.json, tsconfigs, vite/tailwind/postcss, requirements, pytest.ini, .gitignore) | 0 (existed) | 12 files |
| Tracked files created (excl. lockfile) | 10 source/test files + 1 spec | 38 |
| Reusable code produced for a next tool | 49 shared lines (`Toggle`, `ConfirmDialog` optional reason, registry) | 0 by construction — db/transaction, error handling, personas, time helpers, confirm dialog, toast, states, API client and persona switcher were re-implemented inside the app |
| Backend tests at delivery | 28 total (13 new flag tests + 15 pre-existing core/KYC) | 22 (all flag tests, incl. a two-thread concurrency test) |
| Frontend tests / CI | none at `be1f095` (added later in PR #5) | none |

Reading: the control wrote **2.0×** the source lines and **1.6×** the test lines for the same feature
set, and none of it is reusable by a next tool.

## 4. Independent verification of the control artefact (run by the parent session, not self-reported)

```
$ git clone feature-flags-baseline.bundle /tmp/ctrl2
$ cd /tmp/ctrl2/backend && python -m pytest -q -p no:warnings
22 passed in 0.41s
$ cd /tmp/ctrl2/frontend && npm ci && npm run typecheck        # tsc --noEmit -p tsconfig.app.json
typecheck exit 0
$ npx vite build
✓ built in 1.04s
```

Note: `npx tsc -b` (the template repo's typecheck command) fails on the control's `vite.config.ts`
(`Cannot find name 'process'`, missing `@types/node`); the control's own `npm run typecheck` only checks
`tsconfig.app.json`. Recorded as a difference in rigour, not a functional defect.

Functional parity, by inspection of the branch: same endpoints (`GET /meta`, `GET /flags`,
`GET /flags/{id}`, `POST /flags/{id}/toggle`), same error codes per `on_violation`, `BEGIN IMMEDIATE` +
conditional update → 409, audit order newest first, seeded `updated_at` = newest audit event. The control
chose a strict boolean for `enabled` (string `"true"` → 422), which the template app only adopted in PR #7.
Its error body is `{code, message}` without the template's `{"error": …}` wrapper.

Browser evidence: screenshots attached to PR #9 and to the child session (staging toggle with toast and
audit entry; production locked; viewer read-only).

## 5. Caveats (read before quoting a ratio)

1. **Residual knowledge leaks (small, disclosed).** (a) The spec copy still carried the header comment
   "Consumed by the `create-internal-tool` Skill (`.agents/skills/create-internal-tool/SKILL.md`)" — a
   path, no content. (b) The session's `repo_setup_initialized` event carried this repository's blueprint
   notes ("Specs in `specs/<app_id>.yaml`; follow `.agents/skills/…/SKILL.md` to add an app") even with no
   repository attached — again a pointer, no conventions. (c) The parent's memory index names this repo in
   one line. None of these contain a rule or a line of code; no `rules_injected` event exists for the
   session (checked with the session-events API).
2. **The spec was written under template conventions.** `specs/feature_flags.yaml` names the exact
   endpoints, error codes, audit fields and seed rules, which is most of the design work. Both runs
   benefited equally; the control's "7 minutes with 0 test failures" measures *implementing a very
   precise spec*, not designing a tool from a vague request.
3. **n = 1 per arm, same model, different wall-clock hours.** No variance estimate is possible.
4. **Different browser-check methods.** The template run used the recorded testing agent (two full,
   adversarial runs); the control checked itself with screenshots. The post-build phases are therefore
   not directly comparable; the "spec → first green build" row is the cleanest comparison.
5. **Not measured on either arm:** human review time, model-vs-tool time split, token/ACU cost,
   maintainability over time, and the cost of the template itself (two earlier PRs, amortised over two
   apps so far).

## 6. Conclusion

- **Time:** with a spec in hand, the template cut implementation-to-green-build from 7 min 20 s to
  2 min 29 s (**−66 %**). End to end as experienced, the runs were within a minute of each other because
  the template session also read the repository and wrote the spec.
- **Code:** the template halved what had to be written for the same feature set (619 vs 1 257 source
  lines; 142 vs 223 test lines) and was the only arm to produce reusable code (49 shared lines). The
  control re-implemented ~10 infrastructure pieces inside the app.
- **Quality:** the template run found 1 defect in the browser; the control found 3, and two of them
  (Escape closing the dialog *and* the panel; stale list row after a 409) are exactly the record-safety
  bugs the template repo fixed in PR #7 and now carries in its shared components. That is the concrete
  form of the template's quality advantage: a fresh build on the template inherits those fixes; a fresh
  build without it rediscovers the bugs.
- **What would make the result stronger:** two or three runs per arm, and a third app that is *not* a
  list/detail/audit tool.
