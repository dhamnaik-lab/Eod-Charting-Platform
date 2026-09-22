# PHASE5_IMPORT_BHAVCOPY_PROGRESS_REPORT

Date: 2026-03-28

## Summary

Phase 5 ports the import/download surface behind `src/platform/*` for the fresh Tauri shell at `src-tauri-shell` while keeping Electron intact as the fallback runtime.

The Phase 5 Tauri backend now covers:

- CSV file picking
- CSV preview
- CSV import execution
- import progress events
- bhavcopy single-date download
- bhavcopy batch download
- bhavcopy settings load/save
- bhavcopy progress events

The renderer-facing seam stays unchanged:

- `src/platform/desktop.ts` remains the business-service bridge
- `src/platform/tauriDesktop.ts` now implements the Phase 5 Tauri import/download subset
- no active renderer file outside `src/platform/*` gained direct Tauri imports

## Fresh Tauri Backend Scope Added

New Tauri backend modules:

- `src-tauri-shell/src/imports.rs`
- `src-tauri-shell/src/bhavcopy.rs`

New command coverage in `src-tauri-shell/src/main.rs`:

- `pick_csv_files`
- `preview_csv`
- `import_csv`
- `download_bhavcopy`
- `download_bhavcopy_batch`
- `get_bhavcopy_settings`
- `save_bhavcopy_settings`

New menu coverage in the fresh shell:

- `menu:importCsv`
- `menu:openBhavcopyWindow`

## What Stayed Electron-Only By Design

- quote editor CRUD
- merge-symbol flows
- corporate-action / identity-history mutation flows
- full interactive parity proof for Tauri import/download jobs
- full `npm run tauri:dev` shell/window verification

## Progress/Event Parity

Status: partial-to-strong, not yet claimed as full end-to-end parity.

What is wired:

- Tauri import jobs emit `import:progress`
- Tauri bhavcopy jobs emit `bhavcopy:progress`
- `src/platform/tauriDesktop.ts` translates those events back into the existing renderer callback shape
- existing dialogs continue to consume progress through the same `DesktopApi` methods

What is not yet fully claimed:

- interactive proof that Tauri import progress behavior matches Electron under large real-world files
- interactive proof that Tauri bhavcopy progress/update cadence matches Electron under live archive downloads
- debug-shell (`tauri:dev`) runtime verification for these long-running flows

## Files Added

- `src-tauri-shell/src/imports.rs`
- `src-tauri-shell/src/bhavcopy.rs`
- `PHASE5_IMPORT_BHAVCOPY_PROGRESS_REPORT.md`

## Files Modified

- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/Cargo.lock`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/database.rs`
- `src/platform/tauriDesktop.ts`
- `src/components/CommandPalette.tsx`

## Backup / Snapshot

Pre-change snapshot:

- `backups/pre_opencode_changes_20260328_181724_phase5_import_bhavcopy_progress`

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
- `PHASE5_IMPORT_BHAVCOPY_PROGRESS_REPORT.md`

## Validation

Passed:

- `npm run typecheck:renderer`
- `cargo check --manifest-path src-tauri-shell/Cargo.toml`
- `npm run build`
- `npm run tauri:build`

Launch checks:

- bounded Electron production-shell launch stayed alive long enough to confirm startup
- bounded fresh Tauri production-shell launch stayed alive long enough to confirm window open

Seam checks:

- no active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`
- legacy inactive files `src/app.js` and `src/modules/backend-api.js` still contain historical Tauri imports and remain outside the active renderer path

Not fully validated in this phase:

- full interactive Tauri import workflow smoke coverage
- full interactive Tauri bhavcopy workflow smoke coverage
- full `npm run tauri:dev` debug-shell verification
- Electron data-driven smoke coverage still depends on the missing external fixture at `D:\TA Projects\EOD Downloader\output\NSE\EQ\19941103.csv`

## Phase 6 Recommendation

Phase 6 should focus on packaging validation and cutover readiness:

- verify packaged Electron and Tauri behavior side by side on Windows
- add macOS packaging/signing/notarization groundwork for the fresh shell
- decide whether quote editor / merge / corporate-action mutation flows must be ported before cutover or remain explicit Electron-only blockers
- tighten live-runtime validation for Tauri import and bhavcopy workflows
