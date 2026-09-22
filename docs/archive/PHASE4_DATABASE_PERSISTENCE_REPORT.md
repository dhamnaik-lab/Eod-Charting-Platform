# PHASE4_DATABASE_PERSISTENCE_REPORT

Date: 2026-03-28

## Summary

Phase 4 ported the database and persistence subset needed for app startup, workspace continuity, symbol navigation, and watchlist/layout persistence into the fresh Tauri shell at `src-tauri-shell`.

The active renderer still goes through `src/platform/*`. Electron remains intact as the fallback runtime. Phase 5 and later backend flows were intentionally not moved in this pass.

## What Was Added Or Dual-Wired

- Added a new Rust persistence backend in `src-tauri-shell/src/database.rs`
- Added a Tauri-backed business adapter in `src/platform/tauriDesktop.ts`
- Updated `src/platform/desktop.ts` so the business bridge now resolves:
  - Electron first when `window.electronAPI` is present
  - otherwise the fresh Tauri business adapter
- Extended the fresh Tauri shell menu so it can trigger:
  - create database
  - open database
  - close database
  - delete database
- Updated the renderer store so those database menu command ids now work through the existing shell bridge
- Limited the command palette under Tauri so deferred Electron-only tools are not exposed there

## Phase 4 Database/Persistence Services Now Available In Tauri

- app snapshot construction
- active database state resolution from the registry
- recent-database registry handling
- create/open/activate/close/delete database lifecycle
- SQLite migrations and default seeding
- settings persistence
- saved-layout persistence
- symbol list/search reads
- EOD history reads with identity-history and corporate-action event markers
- watchlist CRUD

## What Remains Electron-Only By Design

- CSV preview/import
- bhavcopy download/import
- worker/event parity for long-running jobs
- quote editor CRUD
- merge-symbol flows
- corporate-action / identity-history mutation flows

## Deferred Database Flows

These were deliberately deferred because they widen the mutation and parity surface beyond the Phase 4 persistence target:

- quote editor
- merge symbols
- corporate actions / identity-history writes

## Files Added

- `src/platform/tauriDesktop.ts`
- `src-tauri-shell/src/database.rs`

## Files Modified

- `src/platform/desktop.ts`
- `src/store/chartStore.ts`
- `src/components/CommandPalette.tsx`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/Cargo.lock`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/README.md`

## Backup / Snapshot

- `backups/pre_opencode_changes_20260328_182905_phase4_database_persistence`

## Markdown Files Updated

- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `RISK_REGISTER.md`
- `src-tauri-shell/README.md`
- `PHASE4_DATABASE_PERSISTENCE_REPORT.md`

## Renderer Seam Purity Check

Checked after Phase 4:

- no active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`
- legacy inactive files `src/app.js` and `src/modules/backend-api.js` still contain historical Tauri imports and remain outside the active runtime path

## Validation

Passed:

- `npm run typecheck:renderer`
- `npm run build`
- `cargo check --manifest-path src-tauri-shell/Cargo.toml`
- `npm run tauri:build`
- bounded launch of `src-tauri-shell/target/release/eod-charting-platform-shell.exe` stayed alive long enough to confirm the built shell still opens

Not fully verified in this phase:

- full interactive Tauri database workflow smoke tests
- bounded `npm run tauri:dev` debug-shell launch verification
- Electron data-flow smoke tests that depend on the external fixture `D:\TA Projects\EOD Downloader\output\NSE\EQ\19941103.csv`

## Phase 5 Recommendation

Phase 5 should focus on long-running and Electron-specific workflows:

- CSV preview/import parity
- bhavcopy download/import parity
- progress event parity for import/download work
- careful hiding or graceful handling of Phase 5-deferred tools while Tauri is active
