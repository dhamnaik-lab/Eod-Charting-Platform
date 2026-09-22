# Root Cargo Target Alignment

## Timestamp

2026-08-05_1233 IST

## Objective

Move all Cargo/Tauri compiler output from:

src-tauri-shell\target

to the canonical repository-root location:

target

## Files changed

- .cargo\config.toml
- scripts\prepare-tauri-portable.ps1
- src-tauri-shell\README.md

## Files deliberately unchanged

- package.json
- src-tauri-shell\Cargo.toml
- src-tauri-shell\Cargo.lock
- src-tauri-shell\build.rs
- src-tauri-shell\tauri.conf.json
- .gitignore

## Cargo verification

Expected target directory:

E:\TA Projects\EOD Charting Platform\target

Resolved Cargo target directory:

E:\TA Projects\EOD Charting Platform\target

## Backup

E:\TA Projects\EOD Charting Platform\docs\changes\backups\2026-08-05_1233_IST_ROOT_CARGO_TARGET_ALIGNMENT

## Migration status

Configuration applied successfully.

The legacy src-tauri-shell\target directory has not been deleted or moved yet.
It must remain until the root-target release and portable builds pass.