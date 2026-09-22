# Legacy `src-tauri` Removal Report

Date: 2026-04-04

## Summary

The old `src-tauri` tree was removed from the project folder after confirming it was no longer used by the active build, runtime, packaging, or platform seam.

## Why It Was Safe To Remove

- `package.json` points only to `src-tauri-shell`
- the active runtime/backend is `src-tauri-shell`
- the renderer talks only through `src/platform/*`
- the current packaged portable build uses only the Tauri shell under `src-tauri-shell`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_144330_legacy_src_tauri_removal`

## What Was Removed

- `src-tauri/`

## Docs Updated

- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `src-tauri-shell/README.md`
- `TAURI_ONLY_ELECTRON_RETIREMENT_REPORT.md`

## Validation

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`
- bounded launch of `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`

## Output

- portable folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- launcher: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
