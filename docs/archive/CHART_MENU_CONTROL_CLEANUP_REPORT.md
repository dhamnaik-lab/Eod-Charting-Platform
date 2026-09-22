# CHART_MENU_CONTROL_CLEANUP_REPORT

Date: 2026-04-09

## Summary

Cleaned up duplicated chart controls so frequent actions stay on the chart surface and lower-frequency actions move into the native Chart menu.

## What Changed

- Removed the top-toolbar `Magnet`, `Raw`, `Adj`, `Log`, `Vol`, and `Compare` buttons from `src/components/Toolbar.tsx`.
- Kept `Magnet` on the right chart tool dock and replaced the old generic symbol with a bar-magnet icon.
- Added native `Chart` menu entries for `Compare...`, `Magnet`, and explicit `Raw` / `Adjusted` price mode actions in `src-tauri-shell/src/main.rs`.
- Moved compare-dialog open state into `src/store/uiStore.ts` so the native menu can open `CompareOverlayDialog` through `src/features/app/menuCommandRouter.ts`.
- Removed the old volume-visibility row from `src/components/ChartSettingsMenu.tsx`; the scale menu now only exposes the active EOD-relevant options.

## Files Changed

- `src/components/Toolbar.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartToolDock.tsx`
- `src/components/ChartSettingsMenu.tsx`
- `src/store/uiStore.ts`
- `src/features/app/menuCommandRouter.ts`
- `src-tauri-shell/src/main.rs`

## Validation

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run tauri:dev`

## Dev Workflow Note

- `src-tauri-shell/tauri.conf.json` now uses `npm run dev:renderer` as `beforeDevCommand` so `npm run tauri:dev` no longer recurses back into itself.
