# Application design audit: bounded UI and performance pass

Source implementation and focused checks are complete for the changes below. This is not full ISSUE-01–10 closeout. The user owns the portable rebuild; new-code native acceptance remains pending.

## Implemented

- ISSUE-03: hover now lives in a transient per-tile store, outside persistent chart tabs. Tile and OHLCV headers subscribe to it. Closing a tab or replacing its bar array discards stale hover. Viewport/drawing persistence and app-root plugin ownership remain intact.
- ISSUE-04: shared modal Tab wrapping, Escape, focus entry/return, and outside-focus containment; modeless windows retain chart access. Applied to the floating shell, managed windows, chart settings, drawing properties, compare, watchlist dialogs and Command Palette. Existing custom-formula and indicator-settings focus handling remains. Corporate Actions' capture handler now defers to a higher modal. Chart tabs have tablist/tab semantics, sibling close buttons, roving focus and Left/Right/Home/End navigation.
- ISSUE-05: managed-window focus re-ranks within its tier instead of increasing indefinitely; restore/resize fits the current viewport. Chart modal layers sit above managed windows. Five blocking browser confirmations now use an explicit themed confirmation, retaining their messages and action gates. Escape, owner removal and database switching cancel; the safe button receives initial focus. No financial approval was added or executed.
- ISSUE-07: chart frames are scheduled only when dirty. Overlay-only updates, screenshot flushing, reentrant invalidation, kinetic invalidation and the deferred `axisWidthChange` notification are preserved. Indicator bundles are reused across geometry changes and adaptive-axis passes, using the registry's existing mutation signatures and invalidating at data/settings setters. This removes repeated bundle assembly; it does not replace the existing formula cache.
- ISSUE-09, bounded command dispatch: `list_symbols` and `search_symbols` now run on Tauri's blocking-worker pool. Existing SQL, filters, connection locking and response shapes are preserved. No read-pool, shutdown, settings-replacement or recovery architecture change was made.

## Measurements and evidence

| Sample | Before | After | Evidence scope |
|---|---:|---:|---|
| 1,000 background-tile hover events: persistent tab updates | 1,000 | 0 | Store regression; microbenchmark 70.209 ms before / 1.270 ms after, not native FPS |
| 120 simulated idle frames: scheduled callbacks | 120 | 1 | Scheduler regression; one initial base render in both |
| Ten viewport changes: indicator-bundle builds | 10 | 0 | Real engine with mocked canvas; data/settings mutation invalidation covered |
| Browser canvas, 300 ms idle after initial paint | — | 0 callbacks | Headless Chrome, real canvas; subsequent overlay invalidation: 0 base / 1 overlay render |

Native read profiling used the actual `E:\TA Projects\EOD Charting Platform\EOD DATABASE` and the regular portable state. Executable SHA-256 was `9B804C1160F3D881EFBD52577BD352180C9B215556C0BB9D48643EE46D481035` (build `20261115.183601`); active database was verified through the native bridge. Five listings each returned 28,206 symbols. Snapshot reads alone took 8.070–13.336 ms; snapshots issued alongside those listings took 1,068.607–1,292.729 ms. This is a pre-change native observation, including bridge/serialization overhead; it does not isolate mutex waiting or prove a post-change speedup. The benchmark instance closed normally.

- [Final browser evidence](../../tmp/fixtures/audit-bounded-ui-20261115/1794754105665/result.json): 13 checks, including Tab/Shift+Tab, Escape/return focus, modeless access, chart-tab navigation, cancel/confirm, nested Escape and database-switch cancellation.
- [Native read baseline](../../tmp/fixtures/audit-bounded-ui-20261115/native-reads/result.json).
- Repeatable isolated renderer runner: [verify-audit-ui.mjs](../../scripts/verify-audit-ui.mjs). It uses no desktop API or database, disables repository watching and automatic dependency discovery, and closes its browser/server. Earlier failed startup evidence is retained in the same fixture parent.

## Checks

- PASS: shared Cargo Preview, then `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('database::symbol_search::')`: 7 passed; compile/link 1m17s. One existing unused calendar-helper warning.
- PASS: `validate-change.ps1 -Profile renderer` after correcting a missing `placement` field in the new test fixture.
- PASS: 16 focused Vitest files, 80 tests: scheduler, canvas partition/bundles, hover isolation, viewport/window stacking, tile mutations/workspaces, modal navigation, indicator settings, floating-window keyboard/position behavior, tile index gaps, quote scope, identity confirmation and plugin host/registry.
- PASS: final `node scripts/verify-audit-ui.mjs`, 13 checks. Initial browser runner attempts failed during dependency discovery/watching and then a test-harness React DOM import; these were corrected before the passing run.
- PASS: standalone `check-doc-references.ps1`; backup-relative added-line whitespace/conflict-marker check across 34 changed/new files (no Git invocation).

The existing renderer validator invokes read-only `git diff --check` internally; this ran unintentionally under the no-Git restriction. No commit, push, checkout or Git state mutation occurred. Existing Vite/Vitest theme generation refreshed `src/styles/theme-tokens.generated.css` from the unchanged palette source; pre-run generated bytes were not separately captured. Release build metadata remains dated 18:36:01. No release build, packaging, installer, portable staging, financial action, repair, source download, or database fixture creation occurred.

## Files and backups

Runtime owners: [ChartEngine](../../src/engine/ChartEngine.ts), [chart store](../../src/store/chartStore.ts), [transient hover](../../src/features/charts/chartHoverStore.ts), [window store](../../src/store/windowStore.ts), [dialog focus](../../src/features/app/useDialogFocus.ts), [confirmation](../../src/components/common/useActionConfirmation.tsx), [symbol reads](../../src-tauri-shell/src/database/symbol_search.rs), and their component callers. Tests cover the changed owners; current handoff, phase tracker, architecture, inventory and feature status are updated.

Backups under `backups/`:

- `pre_opencode_changes_20261115_195541_audit-bounded-ui-performance`
- `pre_opencode_changes_20261115_195919_audit-modal-followup`
- `pre_opencode_changes_20261115_200104_audit-frame-scheduler`
- `pre_opencode_changes_20261115_200305_audit-nested-modal-focus`
- `pre_opencode_changes_20261115_201042_audit-indicator-profile`
- `pre_opencode_changes_20261115_201330_audit-symbol-read-dispatch`
- `pre_opencode_changes_20261115_201913_audit-inventory-update`
- `pre_opencode_changes_20261115_201930_audit-feature-status`

## Remaining acceptance and scope

After the user rebuilds portable, check two populated tiles (hover, resize, drawing ownership and plugin settings), native focus/stacking/confirmation behavior, kinetic scrolling and screenshot output, and repeat the same native symbol-list/snapshot profile. Headless component checks and mocked-canvas tests are not native/live acceptance.

Official watchlist download latency remains separately unprofiled; its synchronous handler is unchanged. Broader read contention, durable settings replacement and coordinated shutdown remain open. ISSUE-08 recovery/deep-parity decisions and ISSUE-10 optional features remain excluded. This pass does not close prior ISSUE-01/02/06 native acceptance or certify all modal surfaces.
