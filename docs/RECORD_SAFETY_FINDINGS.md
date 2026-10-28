# Record-safety and UI-reliability investigation

Scope: the eight suspected frontend/backend defects raised by an independent source review. Method: read the
code, write a Vitest/RTL reproduction with deferred promises **before** changing anything, record the result,
fix only what reproduced, re-run everything. All tests below exist in the repo; "failed on original" means the
test was run against the unmodified code first.

| # | Suspected defect | Verdict | Evidence | Fix |
|---|---|---|---|---|
| 1 | Previous record's details/actions shown while the next record loads or fails | **PASS (reproduced)** | `CaseDetailPanel.test.tsx` "Bug 1" ×2 and `FlagDetailPanel.test.tsx` "Bug 1" failed on original: after switching A→B, A's name and Approve buttons stayed rendered (`useQuery` keeps `data` across dep changes; panels rendered `query.data` unkeyed). On a 404 for B, A stayed visible instead of the error. | Panels key the detail by record: `detail = query.data?.id === caseId ? query.data : undefined`. `useQuery` unchanged (keeping data is still right for list refetches). |
| 2 | Pending confirmation survives closing the panel | **PASS** | "Bug 2" failed on original: with `caseId=null`, `ConfirmDialog` stayed open (`open={pendingAction !== null}`). | Pending state is `{ caseId, action }` / `{ flagId, value }`; an effect cancels it when the selection changes (unless a submission is in flight); dialog `open` also requires a selected record. |
| 3 | Confirmed action could target a different record than it was started on | **PASS (partial)** | "Bug 3 … cancels the pending action" failed on original (dialog for A stayed open on B, with the typed reason). The "mid-flight prop change" variant **NOT REPRODUCED**: the original already captured `caseId` in the closure before `await`. | `confirm()` reads `pending.caseId`/`pending.flagId`, never the current prop; UI gating is not the only guard. |
| 4 | Failed refetch silently shows stale data | **PASS** | `KycQueuePage.test.tsx` and "Bug 4" panel test failed on original: pages render `ErrorState` only when `!query.data`. | New shared `RefreshError` alert (`role="alert"`, retry) rendered above stale rows/details when `status === 'error' && data`. Retry wiring unchanged. |
| 5 | Escape closes the underlying panel while the confirmation is open; no focus management | **PASS** | "Bug 5" failed on original: `DetailPanel`'s window Escape handler fired, `onClose` called, dialog remained. | `ConfirmDialog` owns Escape (capture-phase listener, `stopImmediatePropagation`, ignored while `busy`), traps Tab inside the dialog, focuses its first control on open and restores focus to the opener on close. No modal framework. |
| 6 | Audit timestamp taken before `BEGIN IMMEDIATE` may predate a commit it waited for | **PASS by inspection** (not observable in tests at second precision) | `now = utc_now_iso()` preceded `with transaction(conn)` in both services; with a 5 s busy wait the stamp could be older than the competing writer's. | `now` is taken inside the transaction. Second-precision ties remain a **DESIGN LIMITATION** (order falls back to `id DESC`; format unchanged for compatibility). |
| 7 | `role="button"` on `<tr>`; dialog focus | **PASS (a11y)** | `DataTable` put `role="button"` on rows, breaking table semantics for screen readers. | Rows keep their native role, expose `aria-selected`; keyboard activation unchanged. Dialog focus handled under #5. `DetailPanel` still lacks a focus trap — documented, not fixed (out of scope). |
| 8 | `enabled: bool` accepts `"yes"` | **PASS (contract)** | Documented in the build report; Pydantic lax mode. | `StrictBool`; test asserts `"yes"`, `"true"`, `1` → 422. Not a security issue. |

Verification (actual): `pytest` → 35 passed (one test extended); `npm test` → 14 passed (10 new, all failing on the original code
where marked); `tsc -b` clean; `vite build` clean.
