# Portable Launcher Working Directory Fix Report

## Scope

This pass hardened the portable Tauri launcher after the earlier asset-staging fix.

Problem targeted:

- even with `index.html` and `assets/` staged correctly, some Windows launch contexts could still start the app with the wrong working directory
- that could lead to another `asset not found: index.html` failure in normal user launch scenarios

## Root Cause

The generated portable launcher used:

- `start "" "%~dp0EOD Chart.exe"`

That launched the exe by path, but it did **not** explicitly force the working directory to the portable app folder.

## What Changed

- `scripts/prepare-tauri-portable.ps1` now generates the launcher with:
  - `start "" /D "%~dp0" "%~dp0EOD Chart.exe"`
- The launcher still sets:
  - `EOD_CHART_PORTABLE_ROOT=%~dp0portable-data`
- The portable README text now explains that the launcher is the supported path for both portable state and stable frontend asset resolution.

## Files Modified

- `scripts/prepare-tauri-portable.ps1`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `PORTABLE_ASSET_STAGING_FIX_REPORT.md`

## Files Added

- `PORTABLE_LAUNCHER_WORKDIR_FIX_REPORT.md`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_161600_portable_launcher_workdir_fix`

## Validation

Executed successfully:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

Additional bounded runtime validation:

- launched the staged portable launcher after regeneration
- confirmed a running `EOD Chart` process/window
- verified the generated launcher now contains `/D "%~dp0"`

## Runnable Output

- Output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
- Executable: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

## Follow-up Note

- A deeper follow-up now also makes the Tauri shell rebuild whenever `dist/` changes, so the staged portable exe cannot silently remain stale after a frontend rebuild. See `TAURI_FRONTEND_ASSET_REBUILD_INVALIDATION_REPORT.md`.
