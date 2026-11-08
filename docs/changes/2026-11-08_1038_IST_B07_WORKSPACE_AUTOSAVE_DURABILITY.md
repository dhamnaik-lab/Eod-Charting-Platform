# B07 — Durable workspace autosave acknowledgment, retry and ordered writes

**IST timestamp:** 2026-11-08 10:38 IST (UTC+05:30)
**Active workstream:** EOD Charting Platform only
**Authorized Windows root:** `E:\TA Projects\EOD Charting Platform` (not accessed; all changes on GitHub)
**GitHub repository:** `dhamnaik-lab/Eod-Charting-Platform`
**Verified authoritative baseline:** GitHub `main` commit `c1c3b115fc2684fb7c4567b88463b1c53ee70f72`, tree `57672a65dcaa7cb8d3fa3b29bf159b5a936a268a`
**Tracking:** Audit #36 (B07), master #28, draft PR #77
**Isolated branch:** `fix/b07-workspace-autosave-ack-retry-order-20261108`
**First source/test head:** `e7ec557ffbda5b6d99548b9dea98717cc34f84d1`
**Latest source/test head before this change record:** `fd7630420a8b59e7a6974aaf9925b2b97a0a44bb`

## Objective and previous defects

Workspace autosave previously set a module-global `autosaveSignature` before persisting the data, then invoked `void writeWorkspaceLayoutSetting(serialized)` without an error handler. On rejection the signature incorrectly indicated success and identical workspace data might never retry. Manual Save invoked an independent asynchronous write and set the same signature before completion; overlapping requests could overwrite newer state with an older delayed response. Loading a named layout marked its data persisted even though no autosave setting write had occurred. There was no persistent visible autosave-failure status.

The bounded objective was to **acknowledge only confirmed successful writes**, retry failed autosaves without repeated toast floods, keep latest queued state when older writes settle, ensure manual Save follows the same ordered persistence path, and preserve existing workspace/schema/chart behavior.

## Source authority and inspected files

- `src/store/chartStore.ts` — debounce scheduling (260 ms), module-global autosave signature, the `saveCurrentActiveDatabase` action, subscription filters and snapshot/DB transitions.
- `src/features/workspace/workspaceService.ts` — exact persisted workspace key and Tauri `set_setting` bridge. It remains unchanged by B07.
- `src/features/workspace/workspacePersistence.ts` — stringify/parse, chart sheets, restored layouts and version-one persistence schema; unchanged.
- `src/features/workspace/chartSnapshotHydrationService.ts` — successful restoration signature, database transition and hydration guards; unchanged.
- `src/features/charts/chartTabSessionController.ts` — named layout load and previous premature signature callback.
- `src/components/StatusBar.tsx` and `src/store/chartStoreTypes.ts` — existing visible progress/error and Zustand state contracts.
- `src/features/workspace/__tests__/workspacePersistence.test.ts`, `src/features/charts/__tests__/chartRequestConsistency.test.ts`, `src/components/__tests__/StatusBarIstClock.test.ts` — preservation and regression coverage.
- `src/platform/tauriDesktop.ts` — B06 workspace-key exemption and underlying Tauri invocation semantics; unchanged by B07.
- Latest GitHub `main` and issue #36 independently checked before branch creation; the historic issue baseline SHA was not used. No other project or local machine data was used.

## Files created and modified

- **Created:** `src/features/workspace/workspaceAutosaveQueue.ts` — single serialized save queue for manual and debounced autosaves, acknowledged signature only after fulfillment, latest-pending-snapshot coalescing, bounded 1-to-30-second exponential retry, manual save promises, one-error-per-outage reporting, recovery callback and restoration-epoch guard.
- **Modified:** `src/store/chartStore.ts` — keep the existing 260-ms debounce and chart-change subscription conditions; replace eager signature/fire-and-forget saves with queue calls. Manual Save now awaits the same queue; it never emits success on failure. On restoration/DB transition, pending queue state is invalidated. On failure, set persistent error and report one toast; clear after confirmed recovery.
- **Modified:** `src/store/chartStoreTypes.ts` — add `workspaceAutosaveError: string | null` to existing transient store state (not persisted to workspace JSON).
- **Modified:** `src/components/StatusBar.tsx` — show compact accessible `role=status` warning while autosave error exists; remove it on recovery. Existing IST clock, DB status, ranges and progress remain unchanged.
- **Modified:** `src/features/charts/chartTabSessionController.ts` — stop marking a newly loaded named layout as if already written to the active database's autosave setting. The existing store subscription treats this as dirty data and schedules normal autosave; no sheet/layout schema changes.
- **Created:** `src/features/workspace/__tests__/workspaceAutosaveQueue.test.ts` — ten standalone queue/persistence regression cases covering deferred success, failure/retry/backoff, repeated same snapshot, latest-wins ordering, overlapping manual writes, restoration epoch, saved layout, reload parse and recovery notifications.
- **Created:** `src/components/__tests__/StatusBarWorkspaceAutosaveError.test.tsx` — two SSR UI-status tests using an explicit mocked Zustand snapshot, verifying persistent error text/ARIA and recovery.
- **Modified:** `src/features/charts/__tests__/chartRequestConsistency.test.ts` — remove one obsolete `setAutosaveSignature` fixture argument, now absent from the session controller's public dependency contract. All existing test cases and assertions remain unchanged.
- **Created:** `docs/changes/2026-11-08_1038_IST_B07_WORKSPACE_AUTOSAVE_DURABILITY.md` (this record).
- **Unchanged:** workspace serialization/parse format, default tabs and sheets, drawing/indicator settings, price data and B06 cache behavior, Tauri/Rust/SQLite, package manifests/lockfile, plugins, native packaging and unrelated audit findings.

## Exact implementation and accepted behavior

- The queue remembers a **persisted signature** only after a write's backend promise resolves. Failed writes keep the previous signature and schedule retry; repeated equal-content autosave requests are not falsely considered persisted.
- At most one workspace-setting write runs at a time. New writes arriving during an active operation coalesce into the newest pending snapshot. Both manual and automatic saves use the same ordering, so an older delayed write cannot overwrite a newer completed write within that queue.
- Retry backoff starts at 1 second and doubles up to 30 seconds. A manual Save can immediately retry even when a background retry timer is pending. Only one error toast is issued per consecutive failed-save episode; the persistent status remains until recovery and is cleared once a later write succeeds.
- On a database/workspace restoration, queued work and retry timers are revoked, manual waiters are notified and stale prior-epoch completions cannot acknowledge the new workspace. An already executing Tauri call cannot be canceled at the native boundary; see limitations.
- The chart store's existing 260-ms debounce and subscription eligibility remain unchanged. Manual Save retains its existing success toast only after a confirmed successful write; canceled saves get a warning rather than a false success.
- Named layout import no longer falsely acknowledges a write that did not occur; the loaded layout can be persisted by the existing autosave. Successful hydration from a persisted active DB still initializes the known persisted signature, avoiding needless rewriting of unchanged state.
- No workspace JSON schema change, new data model, delayed chart rendering, new network call or dependency installation.

## Actual GitHub Actions validation and corrections

**First run:** [#42449173487](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42449173487) on `e7ec557ffbda5b6d99548b9dea98717cc34f84d1`: **FAIL overall**. Full Vitest **1,523 passed / 1 skipped / 0 failed** (including queue 10/10), renderer build PASS, but **TypeScript FAIL**: existing `chartRequestConsistency.test.ts` still supplied the removed controller dependency `setAutosaveSignature` (`TS2353`, line 64). Corrected only that obsolete fixture argument.

**Second run:** [#42449331497](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42449331497): **FAIL overall**. Full Vitest **1,524 passed / 1 skipped / 1 failed**; TypeScript PASS, renderer build PASS. New status-bar test mutated a live Zustand store, but React SSR reads the initial server snapshot, so its assertion did not observe the injected error state. Replaced the test harness with an explicit mocked store snapshot, without changing production UI behavior.

**Corrected implementation run:** [#42449464869](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42449464869), exact head `fd7630420a8b59e7a6974aaf9925b2b97a0a44bb`: **SUCCESS**.

| Check | Actual corrected-run result |
|---|---|
| GitHub checkout / Node 24 / `npm ci` | **PASS** |
| `npm test` full Vitest | **PASS:** 228 test files passed, 1 skipped; **1,525 tests passed, 1 skipped, 0 failed** |
| New `workspaceAutosaveQueue.test.ts` | **PASS: 10/10** |
| New `StatusBarWorkspaceAutosaveError.test.tsx` | **PASS: 2/2** |
| Existing `chartRequestConsistency.test.ts` | **PASS: 23/23** |
| Existing `workspacePersistence.test.ts` | **PASS: 5/5** |
| Existing `StatusBarIstClock.test.ts` | **PASS: 3/3** |
| `npm run typecheck:renderer` | **PASS** |
| `npm run build:renderer` | **PASS**, Vite built in 5.73 seconds |
| Standalone focused Vitest command | **NOT RUN**; the focused suites were executed as part of complete Vitest |
| Windows GUI installed application/manual reopen, real SQLite writes, Rust/Tauri and portable Windows packaging | **NOT RUN** |

**Final documented-commit requirement:** Creating this record changes the PR head SHA; verify a new complete GitHub Actions run against that exact final head before requesting merge. No previous CI result is evidence that a later commit passed.

## Risks and untested boundaries

- Actual Tauri/SQLite disk-full, locking, hard process crash, long-duration write delay and portable Windows/UI manual reload were not exercised. The save queue tests use mocked/deferred promises and simulated persisted JSON.
- The queue prevents **concurrent JavaScript-initiated workspace writes** and guards stale acknowledgement after a restoration. It cannot abort a Tauri write that already crossed the IPC boundary. If the user switches databases while that native call is still pending, the precise native commit target/timing is not proven; this must be considered during Windows manual acceptance. A native target-bound transaction or coordinated database-switch barrier would require a separately approved change.
- Automatically retrying while a database remains unavailable uses bounded delay but is not persisted across process restarts. A crash before an acknowledged write remains a normal unsaved-workspace risk.
- If a named layout is imported, the previous (prematurely acknowledged) behavior changes to normal autosave of the loaded layout. This is the explicit correctness fix under B07; no saved layout format or tab/sheet identity is rewritten.
- The persistent status warning is tested in React SSR, not tested for Windows DPI/compact-status-bar overflow, accessibility screen-reader announcements or real interactive behavior.
- Existing CI's one skipped Vitest test remains skipped. No unrun Rust, native build, browser/UI or database test is claimed passed.

## Rollback and next checkpoint

Before merge, close draft PR #77 without altering GitHub `main`. After a separate approved merge, use a reviewed rollback PR to revert only B07 changes while preserving newer unrelated work. Keep issue #36 and the master audit register updated with final head, exact merged/tested tree, actual CI and Windows-checkpoint limitations. A local Windows manual test should simulate a failed workspace save, edit while save is pending, retry/reopen, and verify sheet/tab layout survives. B08 and later issues are not authorized by this B07 approval.
