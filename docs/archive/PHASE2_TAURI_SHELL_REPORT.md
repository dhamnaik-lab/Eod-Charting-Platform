# PHASE2_TAURI_SHELL_REPORT

Date: 2026-03-28

## Summary

Phase 2 was implemented by adding a fresh Tauri 2 shell under `src-tauri-shell` for the active React + Vite + TypeScript frontend.

This phase intentionally did not port database, import, bhavcopy, worker, or other Electron business logic. Electron remains the working runtime and rollback path.

## Fresh Tauri Shell Path

Fresh shell created at:

- `src-tauri-shell`

The shell contains:

- `Cargo.toml`
- `build.rs`
- `tauri.conf.json`
- `src/main.rs`
- `capabilities/default.json`
- minimal icon assets required for native build paths
- `README.md`

## Legacy Tauri Handling

The old `src-tauri` tree was left untouched and is still treated as legacy/disconnected reference only.

Phase 2 does not build on top of that tree. The new shell is intentionally separate so future migration work is forced onto the fresh path.

## Files Added

- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/build.rs`
- `src-tauri-shell/tauri.conf.json`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/capabilities/default.json`
- `src-tauri-shell/icons/icon.ico`
- `src-tauri-shell/icons/icon.icns`
- `src-tauri-shell/icons/icon.png`
- `src-tauri-shell/icons/128x128.png`
- `src-tauri-shell/README.md`
- `PHASE2_TAURI_SHELL_REPORT.md`

## Files Modified

- `package.json`
- `package-lock.json`
- `.gitignore`
- `vite.config.ts`

## Backup / Snapshot Location

Pre-change snapshot created at:

- `backups/pre_opencode_changes_20260328_160143_phase2_tauri_shell`

## Markdown Files Updated

- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `PHASE2_TAURI_SHELL_REPORT.md`

## What Was Added Or Changed

### Package / Build Wiring

- added `tauri:dev`
- added `tauri:build`
- added `tauri:check`
- added `@tauri-apps/cli` to `devDependencies`
- updated Vite dev server config to use `strictPort: true` for reliable Tauri dev targeting
- updated `.gitignore` for `src-tauri-shell/target/`

### Shell Config

- development points at `http://localhost:5173`
- production points at `../dist`
- bundle generation is intentionally disabled for now
- the shell window uses the current app title and Electron-like initial sizing

## What Still Remains Electron-Only By Design

- database lifecycle and registry handling
- typed preload bridge and IPC handlers
- CSV preview/import logic
- bhavcopy download/import logic
- import worker/background logic
- menu parity beyond the current Electron path
- runtime adapter work behind `src/platform/*`

## Validation

### Electron Safety Checks

- `npm run build` passed
- Electron scripts and runtime path remain intact

### Tauri Shell Checks

- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passed
- `npm run tauri:build` passed
- `src-tauri-shell/target/release/eod-charting-platform-shell.exe` launched successfully and opened an `EOD Chart` window

### Tauri Dev-Mode Check

- a bounded `npm run tauri:dev` run reached Vite dev-server readiness on `http://localhost:5173`
- full first-run debug compile plus shell launch was not confirmed within the bounded validation window, so dev-mode launch is still only partially verified

### Renderer Seam Check

- no renderer file outside `src/platform/*` imports Tauri packages directly
- active renderer direct `window.electronAPI` usage remains isolated to `src/platform/desktop.ts`

## Phase 3 Recommendation

Phase 3 should start porting low-risk runtime services behind `src/platform/*`, for example:

- app metadata/version helpers
- external link opening
- simple window actions if needed
- menu/event plumbing

Do not port database, import, bhavcopy, or worker business logic yet.
