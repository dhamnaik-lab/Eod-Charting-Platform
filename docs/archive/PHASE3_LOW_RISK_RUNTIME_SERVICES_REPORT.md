# PHASE3_LOW_RISK_RUNTIME_SERVICES_REPORT

Date: 2026-03-28

## Summary

Phase 3 is complete.

Low-risk runtime services were dual-wired behind `src/platform/*` without porting business-critical backend flows.

The key result is that the renderer now has a clearer split:

- `src/platform/desktop.ts` remains the Electron-backed business-service bridge
- `src/platform/shell.ts` now provides low-risk shell/runtime services that can be backed by Electron or Tauri

This keeps Electron fully intact as the fallback runtime while allowing the fresh Tauri shell in `src-tauri-shell` to participate in app metadata, external-link handling, and menu-command forwarding.

## Low-Risk Services Ported Or Dual-Wired

### Added behind `src/platform/shell.ts`

- app metadata/version access via `getAppInfo()`
- external URL opening via `openExternal(url)`
- runtime detection via `getDesktopRuntime()`
- shell capability reporting via `getDesktopCapabilities()`
- menu command subscription via `onMenuCommand(...)`

### Electron backing added

- `electron/preload.ts` now exposes:
  - `getAppInfo()`
  - `openExternal(url)`
- `electron/ipc/handlers.ts` now handles:
  - `shell:getAppInfo`
  - `shell:openExternal`

### Tauri backing added

- `src-tauri-shell/src/main.rs` now exposes:
  - `get_app_info`
  - `open_external`
- the fresh shell now emits `menu:command` events with existing renderer-friendly command ids such as:
  - `menu:newChart`
  - `menu:openLayoutManager`
  - `menu:setTimeframe`
  - `menu:addIndicator`
  - `menu:toggleSidebar`
  - `menu:toggleOhlcvBar`
  - `menu:toggleStatusBar`
  - `menu:about`

### Renderer changes

- `src/store/chartStore.ts` now registers menu subscriptions through `getDesktopShellApi()`
- the renderer can now respond to low-risk shell/menu actions even when a business backend is not wired
- the About flow now reads runtime/app metadata through the shell bridge and reports backend availability to the user via toast

## What Stayed Electron-Only By Design

The following areas were intentionally not ported in Phase 3:

- database lifecycle and registry handling
- recent database persistence
- settings persistence backends
- layout persistence backends
- symbol search and market-data reads
- watchlist persistence
- quote editor logic
- merge-symbol logic
- corporate-action logic
- CSV preview/import
- bhavcopy download/import
- worker-based long-running jobs and their heavy progress/event parity

These still flow through the Electron-backed business bridge in `src/platform/desktop.ts`.

## Fresh Tauri Shell Handling

- The fresh shell path remains `src-tauri-shell`
- The old `src-tauri` tree was not used as the baseline
- Phase 3 extended only `src-tauri-shell`
- The fresh shell is still intentionally limited to low-risk runtime services and shell wiring

## Files Added

- `src/platform/shell.ts`
- `src-tauri-shell/Cargo.lock`
- `PHASE3_LOW_RISK_RUNTIME_SERVICES_REPORT.md`

## Files Modified

- `package.json`
- `package-lock.json`
- `src/platform/types.ts`
- `src/platform/desktop.ts`
- `src/platform/index.ts`
- `src/store/chartStore.ts`
- `src/types/electron.d.ts`
- `electron/preload.ts`
- `electron/ipc/handlers.ts`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/capabilities/default.json`
- `src-tauri-shell/README.md`

## Backup / Snapshot Location

Pre-change snapshot:

- `backups/pre_opencode_changes_20260328_165911_phase3_low_risk_runtime_services`

## Markdown Files Updated

- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `src-tauri-shell/README.md`
- `PHASE3_LOW_RISK_RUNTIME_SERVICES_REPORT.md`

## Renderer Seam Purity Check

Checked explicitly:

- no active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`
- the legacy inactive files `src/app.js` and `src/modules/backend-api.js` still contain historical Tauri imports and remain outside the active runtime path
- direct `window.electronAPI` usage remains isolated to:
  - `src/platform/desktop.ts`
  - `src/platform/shell.ts`

## Validation

### Electron checks

- `npm run build` passed
- Electron fallback build path remains intact

### Tauri checks

- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passed
- `npm run tauri:build` passed
- `src-tauri-shell/target/release/eod-charting-platform-shell.exe` launched successfully and opened an `EOD Chart` window

### Partial validation only

- a bounded `npm run tauri:dev` run reached Vite dev-server readiness on `http://localhost:5173`
- a full debug shell/window launch was not confirmed within the bounded validation window
- this means the dev-mode Tauri path remains only partially verified

## Recommended Phase 4 Focus

Phase 4 should port database and persistence services behind `src/platform/*`, using `src-tauri-shell` as the only Tauri backend path.

Safest order:

1. app snapshot and active-database state
2. recent-database registry handling
3. create/open/activate/close database lifecycle
4. settings and layout persistence
5. symbol list/search reads
6. watchlist CRUD

If quote editor, merge-symbol, or corporate-action flows widen the change surface too much, they should remain Electron-backed for a later Phase 4 increment rather than being forced into the first pass.
