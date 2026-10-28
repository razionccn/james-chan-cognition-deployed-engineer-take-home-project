# Feature-Flag Admin Panel — Control Runs (no template, no Skill) vs the Template Run

Experiment question: `docs/FEATURE_FLAG_BUILD_METRICS.md` measured how long and how much code it took to
build the Feature-Flag Admin Panel **on** the Internal Tools Template with the `create-internal-tool`
Skill. It had no control group. This report adds two: the same tool, same spec, same fixed stack, same
agent mode, built by fresh Devin sessions **without** the template, the Skill, the shared components or
the KYC code.

- **Control 1** had the repository attached (for push credentials only; its first command deleted the
  clone). The harness nevertheless injected `AGENTS.md` into its context at START — see §5.1. It is a
  "no template code / no Skill" control, not a "no template knowledge" one.
- **Control 2** had no repository attached. Its event log contains no `rules_injected` event. It is
  the clean control, with the small residual leaks listed in §5.2.

Every number below is a measured value with its source, or is marked **NOT MEASURED**.

---

## 1. Setup

| Item | Template run (treatment) | Control 1 | Control 2 (clean) |
|---|---|---|---|
| Session | https://app.devin.ai/sessions/929c6363efd14330b0ab305373bc0200 | https://app.devin.ai/sessions/14b2a627a5e341ffbd6f14dd9454a76a | https://app.devin.ai/sessions/eab8be6bfad044059caae56c2c8379ca |
| Agent mode | Ultra | Ultra | Ultra |
| Starting point | `main` at `0364651` (template + KYC app: 1599 source lines, 948 of them shared template) | Empty directory; repo attached for push credentials, deleted as first command | Empty directory; no repository attached |
| Input | Task brief + repository (`AGENTS.md`, Skill, `specs/kyc.yaml`, code); the session wrote `specs/feature_flags.yaml` itself (2 min 32 s) | Same `specs/feature_flags.yaml`, pre-written, template-pointing lines neutralised (removed "see AGENTS.md", "shared Toggle", "reuses the template's write role", two `backend/app/core/...` hints; AC-9 "KYC tests still pass" marked NOT APPLICABLE) | Same as control 1 |
| Stack constraint | Implicit (the template's) | Explicit in the prompt: FastAPI + Pydantic + stdlib `sqlite3`, pytest over `TestClient` + temp SQLite; React 18 + TS + Vite + Tailwind; `X-Demo-User` persona header, `reviewer`/`viewer` roles | Same |
| Verification bar | AC tests over HTTP, `tsc`, `vite build`, recorded browser run by the testing agent | Same, browser check by the session itself with screenshots | Same |
| Output | PR #5 (`be1f095` final code commit) | Orphan branch `baseline/no-template-feature-flags` (`ca88e20`) | Delivered as a `git bundle`; pushed by the parent as orphan branch `baseline/no-template-feature-flags-run2` (`67c6cb1`) |

## 2. Development time

Sources: `date -u` marks recorded by each session at its first command, and `git log --format=%cI`.

| Phase | Template run | Control 1 | Control 2 |
|---|---|---|---|
| First command (START) | `05:23:41Z` | `20:06:01Z` | `20:30:42Z` |
| Environment repair + reading the repo + baseline measurement | 3 min 02 s | — | — |
| Writing the spec | 2 min 32 s | — (supplied) | — (supplied) |
| Backend implemented | 1 min 55 s (→ `4337050`) | 3 min 36 s (→ `658bf29`) | 2 min 31 s (→ `dfdf7c3`) |
| Tests + frontend → first green `pytest` + `tsc` + `vite build` | 34 s (→ `085d208`) | 3 min 27 s (→ `178879b`) | 4 min 49 s (→ `6efe0f9`) |
| **Spec in hand → first complete build** | **2 min 29 s** | **7 min 03 s** | **7 min 20 s** |
| START → first complete build (as each session experienced it) | 8 min 03 s | 7 min 03 s | 7 min 20 s |
| Browser check → last fix committed | 7 min 36 s (1 defect, testing-agent run #1 → `be1f095`) | 6 min 09 s (1 defect → `ca88e20`; README + spec commits in between) | 4 min 55 s (3 defects → `fa57ae5`, `b92f650`, `67c6cb1`) |
| START → final code commit | 15 min 39 s | 13 min 12 s | 12 min 15 s |
| START → final commit incl. documentation | 22 min 08 s (metrics report, log, README) | 13 min 12 s (README only) | 12 min 15 s (README only) |
| `pytest` runs / failures | 3 / 1 (wrong test assumption; test corrected) | 3 / 0 | 3 / 0 |
| Browser-found defects the tests missed | 1 (dialog lacked the optional reason field) | 1 (list row stale after an out-of-band 409) | 3 (detail panel covered the header/persona switcher; list row stale after 409; **Escape closed dialog and panel together**) |
| Human prompts during the build | 0 | 0 | 0 |

Reading: with a spec in hand, the template run reached a complete, green build in about a third of the
time (2 min 29 s vs 7 min 03 s / 7 min 20 s). The two controls agree within 17 s on that figure, which
is the most robust number in this report. Measured end to end as each session experienced it, all three
runs are within a minute of each other, because the template run spent 5½ minutes reading the repo,
repairing the environment and writing the spec — work the controls did not have to do.

## 3. Code written (`cloc` code lines; same counting conventions as `FEATURE_FLAG_BUILD_METRICS.md` §0.1)

| Metric | Template run (delta `0364651` → `be1f095`) | Control 1 (`ca88e20`) | Control 2 (`67c6cb1`) |
|---|---|---|---|
| Backend source | +270 | 440 (13 files) | 396 (10 files) |
| Frontend source | +349 (of which 49 shared) | 863 (13 files) | 861 (11 files) |
| **Total source** | **+619** (570 app-specific + 49 shared template) | **1 303** | **1 257** |
| Test code | +142 (`conftest.py` reused) | 265 | 223 |
| Config / scaffolding files written (package.json, tsconfigs, vite/tailwind/postcss, requirements, pytest.ini, .gitignore) | 0 (existed) | 9 files | 12 files |
| Tracked files created (excl. lockfile) | 10 source/test files + 1 spec | 38 | 38 |
| Reusable code produced for a next tool | 49 shared lines (`Toggle`, `ConfirmDialog` optional reason, registry) | 0 by construction — db/errors/personas/time helpers, dialog, toast, states, API client, persona switcher re-implemented inside the app | 0 by construction (same list) |
| Backend tests at delivery | 28 total (13 new flag tests + 15 pre-existing core/KYC) | 28 (all flag tests) | 22 (all flag tests) |
| Frontend tests / CI | none at `be1f095` (added later in PR #5) | none | none |

Reading: each control wrote **~2.1×** the source lines and **1.6–1.9×** the test lines for the same
feature set, and none of it is reusable by a next tool. The controls agree with each other within 4 %
on source lines.

## 4. Independent verification of the control artefacts (run by the parent session)

```
# control 1
$ git worktree add /tmp/ctrl origin/baseline/no-template-feature-flags
$ cd /tmp/ctrl/backend && python -m pytest -q -p no:warnings        → 28 passed in 1.50s
$ cd /tmp/ctrl/frontend && npm ci && npx tsc -b && npx vite build   → tsc exit 0; ✓ built in 1.17s

# control 2
$ git clone feature-flags-baseline.bundle /tmp/ctrl2
$ cd /tmp/ctrl2/backend && python -m pytest -q -p no:warnings       → 22 passed in 0.41s
$ cd /tmp/ctrl2/frontend && npm ci && npm run typecheck             → tsc --noEmit -p tsconfig.app.json, exit 0
$ npx vite build                                                    → ✓ built in 1.04s
```

Control 2 note: `npx tsc -b` (the template repo's typecheck command) fails on its `vite.config.ts`
(`Cannot find name 'process'`, missing `@types/node`); its own `npm run typecheck` script, which is what
the session ran and reported, only checks `tsconfig.app.json`. Recorded as a difference in rigour, not a
functional defect.

Functional parity, by inspection of both branches: same endpoints (`GET /meta`, `GET /flags`,
`GET /flags/{id}`, `POST /flags/{id}/toggle`), same error codes per `on_violation`, a uniform
`{code, message}` error body (control 1 wrapped it in `{"error": …}` like the template; control 2 did
not), `BEGIN IMMEDIATE` + conditional update → 409 in both, audit order newest first, seeded `updated_at`
= newest audit event. Both controls chose a strict boolean for `enabled` (string `"true"` → 422), which
the template app only adopted in PR #7.

Browser evidence: screenshots attached to PR #9 and to each child session (staging toggle with toast +
audit entry; production locked; viewer read-only; control 1 also captured the stale-row defect).

## 5. Caveats (read before quoting a ratio)

1. **Control 1 was contaminated by `AGENTS.md`.** The child reported the harness injected the repo's
   `AGENTS.md` "after all source was written". Its event log says otherwise: `rules_injected: AGENTS …
   always_on` at `20:05:57–20:06:01Z` (START, before any code) and again at `20:18:58Z`; its own
   reasoning at `20:06:08Z` acknowledges seeing it. Control 1 therefore had the template's *written
   conventions* (layering, error envelope, personas, transaction and audit rules) but no code, Skill,
   shared components or KYC example. How much of its code came from `AGENTS.md`: **NOT MEASURED**.
   Control 2 was run to remove this; its figures agree with control 1's, which suggests the leak did
   not change the time/size result much.
2. **Control 2 residual leaks (small, disclosed):** (a) the spec copy still carried the header comment
   "Consumed by the `create-internal-tool` Skill (`.agents/skills/create-internal-tool/SKILL.md`)" — a
   path, no content; (b) the session's `repo_setup_initialized` event carried this repo's blueprint
   notes ("Specs in `specs/<app_id>.yaml`; follow `.agents/skills/…/SKILL.md` to add an app") even
   with no repository attached — again a pointer, no conventions; (c) the parent's memory index names
   this repo in one line. None of these contain a rule or a line of code. No `rules_injected` event
   exists for control 2 (checked with the session-events API).
3. **The spec was written under template conventions.** `specs/feature_flags.yaml` names the exact
   endpoints, error codes, audit fields and seed rules, which is most of the design work. All three
   runs benefited equally; the controls' "7 minutes with 0 test failures" measures *implementing a very
   precise spec*, not designing a tool from a vague request.
4. **n = 1 treatment, n = 2 control, same model.** No variance estimate for the treatment arm; the two
   controls differing by 17 s and 4 % is encouraging but not a confidence interval.
5. **Different browser-check methods.** The template run used the recorded testing agent (two full,
   adversarial runs); the controls checked themselves with screenshots. The post-build phases are
   therefore not directly comparable; the "spec → first green build" row is the cleanest comparison.
6. **Not measured on any arm:** human review time, model-vs-tool time split, token/ACU cost,
   maintainability over time, and the cost of the template itself (two earlier PRs, amortised over
   two apps so far).

## 6. Conclusion

- **Time:** with a spec in hand, the template cut implementation-to-green-build from ~7 min 10 s
  (mean of two controls) to 2 min 29 s (**−65 %**). End to end as experienced, all runs were within a
  minute of each other because the template session also read the repository and wrote the spec.
- **Code:** the template halved what had to be written for the same feature set (619 vs 1 257–1 303
  source lines; 142 vs 223–265 test lines) and was the only arm to produce reusable code (49 shared
  lines). Both controls re-implemented the same ~10 infrastructure pieces inside the app.
- **Quality:** the template run found 1 defect in the browser; the clean control found 3, and two of
  them (Escape closing the dialog *and* the panel; stale list row after a 409) are exactly the record-
  safety bugs the template repo fixed in PR #7 and now carries in its shared components. That is the
  concrete form of the template's quality advantage: a fresh build on the template inherits those
  fixes; a fresh build without it rediscovers the bugs.
- **What would make the result stronger:** two or three treatment runs, and a third app that is *not*
  a list/detail/audit tool.
