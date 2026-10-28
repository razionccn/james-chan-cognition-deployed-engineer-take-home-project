# Learnings from building internal tools with this Skill

Append one entry per build (Skill step 10). Entries are the raw material; the Skill, `AGENTS.md`
and `shared/`/`core/` are where learnings are *applied*. An entry that only sits here is not done.

## Promotion rules (apply in the same PR as the build)
1. **Guessed twice → write it down.** If an assumption had to be made and a previous entry made the
   same kind of assumption, add the rule to `AGENTS.md` (convention) or the Skill (procedure) and
   state it in the spec header template.
2. **Copied twice → promote.** Code copied from an existing app for the second time moves to
   `backend/app/core/` or `frontend/src/shared/`, and both apps use it in this PR.
3. **Every finding → a test or a rule.** Anything a review or browser run caught that the suite did
   not, gets a regression test (preferred) or, if untestable, a line in `AGENTS.md`.
4. **Keep the Skill short.** Prefer pointing at code (`index.ts`, `test_core.py`) over prose lists;
   remove Skill text that the code now enforces.

## Entry template
```
## <app_id> — <date> — <PR>
Elapsed: <first command → PR>          Shared/core lines changed: <n>   App lines: <n>   Tests: <n>
Spec gaps (had to guess):              <list; each → which rule/section now covers it, or "open">
Skill gaps (step was unclear/missing): <list → Skill change made>
Template gaps (had to copy or add):    <list → promoted to shared? y/n, where>
Found by review/browser, not tests:    <list → test added / rule added>
Still open:                            <list; carry into the next entry>
```

---

## kyc — 2026-10-27 — PR #2 (first app; template built in the same session)
Elapsed: NOT MEASURED (template and app built together)   Shared/core lines changed: 0 after the template   App lines: ≈ 650   Tests: 13
Spec gaps: assignment semantics (any reviewer may act); escalated → re-escalate disallowed → recorded as assumptions in the log. Open at the time; now covered by the `workflow` section convention.
Skill gaps: none recorded in the first build (the Skill was written alongside the app).
Template gaps: none; the app added no shared code.
Found by review/browser, not tests: 100k-char reason accepted (→ `max_length`); Pydantic 422 outside the error envelope (→ handler); TOCTOU on status (→ conditional `UPDATE`); `--seed` without `--reset` crash (→ guard). All fixed in Milestone 4 with tests.
Still open: form primitives; shared audit; per-app roles; CI; frontend tests (see `AUDIT.md`).

## feature_flags — 2026-10-28 — PR #5 (fresh session, repository-only context)
Elapsed: 22 min 08 s to docs commit   Shared/core lines changed: 49   App lines: 570   Tests: 13 (+1 later)
Spec gaps: write role (reused `reviewer`), `development` editability, no-op toggle → 409, reason optional ≤ 500 → recorded in the spec itself and `FEATURE_FLAG_BUILD_METRICS.md` §F; roles note now in the spec header template.
Skill gaps: spec filename hyphen vs underscore (→ AGENTS.md rule 8 + `test_core` check); component list stale (→ Skill points at `index.ts`); no `npm run build`/full-suite/regression-after-shared-change guidance (→ steps 3 and 7); no timestamp or conditional-write guidance (→ step 4, AGENTS.md rules 3 and 7).
Template gaps: `Toggle` (added, generic); optional reason in `ConfirmDialog` (`collectReason`); copied from KYC: `_now`, seed `_iso`/`BASE`, `useDebounced`, URL-param state, audit timeline, date formatting → all promoted (`core/time.py`, `shared/hooks.ts`, `AuditTimeline`, `shared/format.ts`) in the same PR. Audit table/repository still per app (rule 9; promote at app #3).
Found by review/browser, not tests: optional reason field missing in the dialog (browser → Vitest `ConfirmDialog.test.tsx`); `database is locked` 500 under a competing writer (review → `BEGIN IMMEDIATE` + two-connection tests in core and both apps); seed history later than `updated_at` (review → spec seed requirement + `test_core::test_seeded_history_is_consistent_with_seeded_records`); spec filename (review → `test_core`).
Still open: per-app roles; form primitives (`TextField`, `SelectField`); shared audit table; spec JSON-Schema; Playwright smoke test.
