# PORTABLE_WINDOWS_DEV_BASE_REPORT

Date: 2026-03-30

## Summary

This pass makes the fresh Tauri shell at `src-tauri-shell` practical for day-to-day Windows development and personal use without changing the active renderer seam or removing Electron fallback.

The supported workflow is now:

1. build and stage with `npm run tauri:portable:win`
2. use the staged folder at `release/tauri-portable-win/EOD Chart Portable`
3. launch with `Launch Portable EOD Chart.cmd`

Electron remains intact as the fallback runtime.

## What Was Added Or Improved

- `src-tauri-shell/src/runtime.rs`
  - resolves portable vs system runtime paths
  - detects portable mode through `EOD_CHART_PORTABLE_ROOT`
  - falls back to a sibling `portable-data` folder when present
  - exposes runtime diagnostics for app info
  - writes runtime log lines to `app-runtime.log`
  - formats startup failures for a user-facing error dialog
- startup diagnostics in `src-tauri-shell/src/main.rs`
  - resolves runtime context at startup
  - initializes registry state early
  - logs startup details
  - shows a readable startup error dialog instead of only crashing through a panic path
- portable-aware registry handling in `src-tauri-shell/src/database.rs`
  - registry now lives under `state/database-registry.json`
  - older root-level registry is migrated forward when present
- richer runtime/app info contract
  - Tauri and Electron now both expose runtime/build/path metadata through the existing app-info path
- renderer-visible runtime diagnostics
  - the existing About flow now shows runtime mode, build profile, state path, and log path
- reproducible portable staging workflow
  - `npm run tauri:portable:win`
  - `scripts/prepare-tauri-portable.ps1`
  - generated `Launch Portable EOD Chart.cmd`
  - generated `README.txt` inside the staged portable folder

## Portable Workflow

### Supported command

```powershell
npm run tauri:portable:win
```

### Output folder

`release/tauri-portable-win/EOD Chart Portable`

### Supported entry point

`Launch Portable EOD Chart.cmd`

This launcher sets `EOD_CHART_PORTABLE_ROOT` to the local `portable-data` folder, which makes the runtime-path contract explicit and predictable.

### Direct executable launch

`EOD Chart.exe` still exists in the staged folder, but it is fallback-only and should not be treated as the primary portable guarantee.

## Portable Data, State, And Logs

In the supported launcher-driven workflow:

- runtime state root: `portable-data`
- registry path: `portable-data/state/database-registry.json`
- runtime log path: `portable-data/logs/app-runtime.log`

Important boundary:

- the portable folder stores runtime state and diagnostics
- the actual market database still lives wherever the user creates or opens it

## Electron Fallback Status

Electron was not removed or rewritten in this pass.

The Electron fallback path remains intact, and the shared app-info surface was extended so Electron can report comparable runtime/build/path diagnostics through the same renderer-facing About flow.

## Backup / Snapshot

Pre-change snapshot:

`backups/pre_opencode_changes_20260330_000001_portable_windows_dev_base`

## Files Added

- `src-tauri-shell/src/runtime.rs`
- `scripts/prepare-tauri-portable.ps1`
- `PORTABLE_WINDOWS_DEV_BASE_REPORT.md`

## Files Modified

- `package.json`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/database.rs`
- `src/types/electron.d.ts`
- `electron/ipc/handlers.ts`
- `src/store/chartStore.ts`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `RISK_REGISTER.md`
- `src-tauri-shell/README.md`

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
- `PORTABLE_WINDOWS_DEV_BASE_REPORT.md`

## Validation

Verified in this pass:

- `npm run build`
- `cargo check --manifest-path src-tauri-shell/Cargo.toml`
- `npm run tauri:build`
- `npm run tauri:portable:win`
- bounded launch of the local Electron fallback through `node_modules/electron/dist/electron.exe`
- bounded launch of `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
- bounded launch of `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`
- creation of `release/tauri-portable-win/EOD Chart Portable/portable-data/logs/app-runtime.log`
- creation of `release/tauri-portable-win/EOD Chart Portable/portable-data/state/database-registry.json`
- seam check confirming no active renderer file outside `src/platform/*` imports `@tauri-apps/*`

## Honest Constraints

- portable behavior is validated through the generated launcher, not as a blanket claim about every direct executable launch path
- another Windows PC still needs Microsoft WebView2 Runtime available
- this pass does not change the current release cutover recommendation; it improves the daily-use Windows development base
- installer-first work, signed releases, and macOS validation are still deferred

## What Still Remains Electron-Only Or Deferred

- Electron remains the fallback runtime by design
- installer-first release hardening remains deferred
- macOS packaging, signing, notarization, and runtime validation remain deferred
- full packaged interactive parity is still a separate validation topic and was not reopened in this pass

## Recommended Next Step

Use the portable Tauri workflow as the normal Windows development/runtime base for the next feature or bugfix while preserving:

- `src/platform/*` as the only renderer-facing runtime seam
- `src-tauri-shell` as the only active Tauri backend path
- Electron as the working fallback runtime
