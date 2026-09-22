# PHASE7_MUTATION_PARITY_REPORT

Date: 2026-03-28

## Summary

Phase 7 closed the remaining Tauri code-surface blockers for the Windows cutover path by porting the last deferred mutation flows behind `src/platform/*`:

- quote editor CRUD
- merge-symbol flows
- corporate-action / identity-history mutation flows

These flows now compile inside the fresh Tauri shell at `src-tauri-shell` and are exposed through the existing renderer dialogs and command palette without adding direct Tauri imports outside `src/platform/*`.

The cutover blocker is no longer "missing Tauri implementation" for those tools. The remaining blocker is validation depth: packaged Windows startup is revalidated, but full packaged interactive parity for the total Tauri surface is still only partial in this environment.

## What Was Ported

### Quote Editor CRUD

- `src/platform/tauriDesktop.ts` now routes `listQuotes`, `upsertQuote`, and `deleteQuote` to the Tauri backend
- `src-tauri-shell/src/database.rs` now exposes:
  - `list_quotes`
  - `upsert_quote`
  - `delete_quote`
- the Tauri backend now recomputes `prev_close` after quote mutations and emits `db:changed`

### Merge Symbols

- `src/platform/tauriDesktop.ts` now routes `mergeSymbols` to the Tauri backend
- `src-tauri-shell/src/database.rs` now exposes `merge_symbols`
- the Tauri backend merges prices, updates watchlist items, optionally deletes/deactivates the source instrument, recomputes `prev_close`, and emits `db:changed`

### Corporate Actions / Identity History

- `src/platform/tauriDesktop.ts` now routes `applyCorporateAction` to the Tauri backend
- `src-tauri-shell/src/database.rs` now exposes `apply_corporate_action`
- the Tauri backend now records split/bonus actions plus identity-history mutations, updates current instrument metadata, and emits `db:changed`

### Renderer / Menu Surface

- `src/components/CommandPalette.tsx` no longer hides Quote Editor, Merge Symbols, or Corporate Actions while running under Tauri
- `src-tauri-shell/src/main.rs` now forwards:
  - `menu:openQuoteEditor`
  - `menu:openMergeSymbols`
  - `menu:openCorporateAction`

## What Remains Electron-Only By Design

Nothing in the active claim set is still intentionally Electron-only on Windows after Phase 7.

Electron still remains the release fallback runtime because:

- full packaged interactive parity is still only partially verified
- macOS packaging, signing, notarization, and runtime validation are still not proven

## Packaged Windows Interactive Parity Results

### Build Verified

- `npm run build`
- `cargo check --manifest-path src-tauri-shell/Cargo.toml`
- `npm run tauri:build`
- `npm run tauri:bundle:nsis`

### Launch Verified

- `release/win-unpacked/EOD Chart.exe`
- `release/EOD Chart Setup 0.1.0.exe`
- `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
- `src-tauri-shell/target/release/bundle/nsis/EOD Chart_0.1.0_x64-setup.exe`

### Basic Interaction Verified

No packaged desktop interaction was directly automated in this phase.

The strongest available evidence below basic packaged interaction is:

- renderer dialogs still compile against the platform seam
- Tauri backend commands for the mutation flows now compile and register successfully
- packaged startup still works after adding the mutation flows

### Still Partial

The following remain only partially verified for packaged Tauri on Windows:

- database lifecycle interactions in the packaged window
- recent-database first-run/upgrade behavior
- settings/layout save and reload parity
- symbol reads/search interactive parity
- watchlist CRUD interactive parity
- CSV preview/import interactive parity
- import progress behavior under real packaged runs
- bhavcopy interactive download/progress parity
- quote editor CRUD interactive parity
- merge-symbol interactive parity
- corporate-action / identity-history interactive parity

The environment used in this repository does not currently provide a packaged desktop automation harness for those end-to-end UI flows, and the existing Electron smoke script still depends on fixture files outside this repository.

## Files Added

- `PHASE7_MUTATION_PARITY_REPORT.md`

## Files Modified

- `src/platform/tauriDesktop.ts`
- `src/components/CommandPalette.tsx`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/database.rs`
- `PARITY_MATRIX_ELECTRON_VS_TAURI.md`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `RISK_REGISTER.md`
- `src-tauri-shell/README.md`

## Backup / Snapshot

- `backups/pre_opencode_changes_20260328_193453_phase7_mutation_parity`

## Markdown Files Updated

- `PARITY_MATRIX_ELECTRON_VS_TAURI.md`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `RISK_REGISTER.md`
- `src-tauri-shell/README.md`
- `PHASE7_MUTATION_PARITY_REPORT.md`

## Updated Cutover Recommendation

Current recommendation: `Windows-preview-only`

Reason:

- the remaining Windows blocker is validation depth, not missing adapter coverage
- packaged Windows startup is now revalidated for Electron and Tauri after the mutation-port pass
- the total Tauri claim set is larger now, but packaged interactive parity is still only partial
- macOS readiness is still not validated

This is enough evidence to justify a controlled Windows preview track for the fresh Tauri shell, but not enough evidence to make Tauri the default runtime or to claim cross-platform release parity.

## Explicit Remaining Blockers For Default-Runtime Cutover

- packaged interactive Windows smoke for the full claimed Tauri surface
- signed Windows installer validation
- macOS app bundle, signing, notarization, and runtime validation
- a decision on whether the Electron fallback remains indefinitely or is retired after a later release gate

## What Should Happen Next

1. Run a dedicated packaged Windows interaction pass on the full Tauri claim set.
2. Keep Electron as the default release runtime until those results are green.
3. Treat Tauri as eligible for a Windows preview release only.
4. Plan a separate macOS release-readiness pass on real macOS hardware or CI.
