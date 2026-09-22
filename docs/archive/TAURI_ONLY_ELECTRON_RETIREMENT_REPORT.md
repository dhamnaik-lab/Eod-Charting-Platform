# TAURI-Only Electron Retirement Report

Date: 2026-04-04

## Summary

This pass removed Electron from the active runtime path and made the repository Tauri-only for desktop execution.

## What Changed

- moved the shared desktop contract to `src/types/desktop.ts`
- made `src/platform/desktop.ts` Tauri-only
- made `src/platform/shell.ts` Tauri-only
- removed Electron runtime source files under `electron/`
- removed `src/types/electron.d.ts`
- removed `tsconfig.electron.json`
- removed Electron scripts, entrypoints, builder config, and dependencies from `package.json`
- refreshed the primary project docs so they no longer describe Electron as a current or fallback runtime

## Files Removed

- `electron/main.ts`
- `electron/preload.ts`
- `electron/menuBar.ts`
- `electron/db.ts`
- `electron/csvImporter.ts`
- `electron/importWorker.ts`
- `electron/bhavcopy.ts`
- `electron/logger.ts`
- `electron/ipc/handlers.ts`
- `src/types/electron.d.ts`
- `tsconfig.electron.json`

## Files Added

- `src/types/desktop.ts`
- `TAURI_ONLY_ELECTRON_RETIREMENT_REPORT.md`

## Key Safety Decisions

- kept the renderer/runtime seam inside `src/platform/*`
- did not touch the legacy `src-tauri` tree
- did not touch unrelated dirty work such as `src/engine/ChartEngine.ts`
- preserved the current Tauri database/import/bhavcopy/menu/runtime behavior
- updated docs so future threads do not assume Electron fallback still exists
- a follow-up on April 4, 2026 also removed the unused legacy `src-tauri` tree after confirming the active build/runtime path no longer referenced it

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_122500_tauri_only_electron_retirement`

## Validation

After the retirement pass:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

Also performed:

- bounded launch of `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`

## Output

- portable folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- launcher: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Remaining Limitations

- historical migration reports still mention Electron as past context
- `PARITY_MATRIX_ELECTRON_VS_TAURI.md` is now archival rather than a current runtime decision document
- installer-first and macOS work remain deferred

## Recommended Next Focus

- continue with Tauri-only performance validation and optimization
- prioritize remaining lag in database open, symbol switching, sheet switching, and watchlist switching before broader feature work
