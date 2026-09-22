# Tauri Frontend Asset Rebuild Invalidation Report

## Scope

This pass fixed a deeper Tauri build invalidation problem behind the portable blank-window issue.

Problem targeted:

- `dist/` frontend assets were rebuilt
- but the Rust/Tauri executable could still be reused from an older compile
- that left the packaged app carrying stale embedded frontend asset metadata

## Root Cause

`src-tauri-shell/build.rs` only contained:

```rust
fn main() {
    tauri_build::build()
}
```

So Cargo had no explicit rerun trigger tied to `../dist`.

That allowed this bad sequence:

1. frontend assets change
2. `dist/index.html` and `dist/assets/*` are rebuilt
3. Cargo reuses the previous Rust executable
4. the staged portable folder receives a stale exe plus fresh frontend files
5. the app can still fail with `asset not found: index.html`

## What Changed

- `src-tauri-shell/build.rs` now includes:

```rust
println!("cargo:rerun-if-changed=../dist");
```

- That forces Cargo/Tauri to rebuild the shell when the frontend build output changes.

## Files Modified

- `src-tauri-shell/build.rs`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `PORTABLE_ASSET_STAGING_FIX_REPORT.md`
- `PORTABLE_LAUNCHER_WORKDIR_FIX_REPORT.md`

## Files Added

- `TAURI_FRONTEND_ASSET_REBUILD_INVALIDATION_REPORT.md`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_162300_frontend_asset_rebuild_invalidation_fix`

## Validation

Executed successfully:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

Additional bounded validation:

- confirmed the rebuilt Tauri executable timestamp advanced after the frontend build
- confirmed the staged portable launcher started successfully after the rebuild

## Runnable Output

- Output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
- Executable: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`
