# Portable Asset Staging Fix Report

## Scope

This pass fixed a portable-package regression in the active Tauri-only app:

- the staged portable folder launched a raw Tauri executable
- the frontend `dist` assets were not being copied into the portable folder
- the app therefore opened with `asset not found: index.html`

Preserved intentionally:

- the current Tauri-only runtime structure
- the active `src-tauri-shell` backend path
- the renderer/runtime seam in `src/platform/*`
- current chart, sidebar, Sheets, watchlist, and workspace behavior

## Root Cause

`scripts/prepare-tauri-portable.ps1` only copied:

- `src-tauri-shell/target/release/eod-charting-platform-shell.exe`

into the portable folder.

The staged portable folder did **not** include:

- `dist/index.html`
- `dist/assets/*`

So the portable executable had no frontend assets beside it and opened with:

- `asset not found: index.html`

## What Changed

- `scripts/prepare-tauri-portable.ps1` now verifies that `dist/index.html` exists before staging.
- The script now copies the built renderer output from `dist/*` into:
  - `release/tauri-portable-win/EOD Chart Portable/`
- The portable README now documents that the frontend assets are staged directly beside `EOD Chart.exe`.

## Files Modified

- `scripts/prepare-tauri-portable.ps1`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Added

- `PORTABLE_ASSET_STAGING_FIX_REPORT.md`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_160300_portable_asset_staging_fix`

## Validation

Executed successfully:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

Additional bounded runtime validation:

- launched the staged portable launcher
- confirmed a running `EOD Chart` process/window
- confirmed the portable folder now contains:
  - `index.html`
  - `assets\`
  - `EOD Chart.exe`

## Runnable Output

- Output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
- Executable: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

## Remaining Limitations

- The portable flow still stages a raw Tauri release executable plus built frontend assets, not a full installer layout.
- If the renderer build fails or `dist` is missing, portable staging now stops with a clear error instead of silently creating a broken portable folder.
- A follow-up launcher hardening pass now also forces the working directory to the portable folder; see `PORTABLE_LAUNCHER_WORKDIR_FIX_REPORT.md`.
- A deeper follow-up now also makes Cargo/Tauri rebuild the shell whenever `dist/` changes; see `TAURI_FRONTEND_ASSET_REBUILD_INVALIDATION_REPORT.md`.
