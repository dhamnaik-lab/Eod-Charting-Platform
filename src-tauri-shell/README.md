# Tauri Shell

This directory contains the active Tauri 2 shell for the React + Vite + TypeScript frontend.

## Important Constraints

- it is not a port of the legacy `src-tauri` backend
- it is now the sole active desktop runtime/backend
- renderer runtime access must continue to flow through `src/platform/*`
- shell/runtime services may live here only when they are exposed behind `src/platform/*`

## Current Services Wired In This Shell

- app metadata via `get_app_info`
- external link opening via `open_external`
- native menu command forwarding through the `menu:command` event channel
- database snapshot and recent-database registry handling via `src/database.rs`
- create/open/activate/close/delete database lifecycle commands
- settings and saved-layout persistence
- symbol search/list reads and EOD history/event loading
- watchlist CRUD and official source-linked watchlist update writes
- official-source fetch bridge for live NSE/BSE watchlist data
- CSV file picking, preview, import execution, and `import:progress`
- bhavcopy settings, single-date download, batch download, and `bhavcopy:progress`
- quote editor CRUD
- merge-symbol flows
- corporate-action / identity-history mutations
- runtime-context detection, launcher-driven portable path handling, and startup diagnostics via `src/runtime.rs`

## Packaging Status

- `npm run tauri:build` builds the shell executable at `target/release/eod-charting-platform-shell.exe`
- `npm run tauri:portable:win` stages the supported Windows portable folder at `release/tauri-portable-win/EOD Chart Portable`
- the supported portable entry point is `Launch Portable EOD Chart.cmd`
- `npm run tauri:bundle:nsis` provides the Windows NSIS installer path for this shell
- `tauri.conf.json` still keeps `"bundle.active": false` so the default build stays fast; installer production remains an explicit packaging step

## Portable Windows Baseline

- the launcher sets `EOD_CHART_PORTABLE_ROOT` so runtime state and logs live under the local `portable-data` folder
- runtime diagnostics currently write to `portable-data/logs/app-runtime.log` in portable mode
- the recent-database registry currently lives at `portable-data/state/database-registry.json` in portable mode
- direct launch of the staged `EOD Chart.exe` is fallback-only and is not the primary portable guarantee
- another Windows PC still needs Microsoft WebView2 Runtime available

## Current Runtime Status

- Windows packaged startup is validated for the active shell
- Electron runtime code has been retired from the active app path
- the current focus is performance, workflow polish, and Windows-first validation inside this Tauri-only architecture
- installer-first hardening and macOS packaging/signing/notarization remain deferred

## Legacy Note

- the old `../src-tauri` tree was removed on April 4, 2026 because it was not part of the active build/runtime path
