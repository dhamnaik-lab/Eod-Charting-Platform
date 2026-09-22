# Portable Build Pipeline Fix

## Timestamp

2026-08-05 02:05:05 +05:30

## Defects corrected

- Portable packaging previously preferred a stale root-level target executable.
- SHA-256 verification originally depended on Get-FileHash, which was unavailable in the Windows PowerShell process launched by npm.

## Final implementation

- Sole executable source: src-tauri-shell\target\release\eod-charting-platform-shell.exe
- Portable destination: release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe
- SHA-256 calculated using System.Security.Cryptography.SHA256.
- Packaging fails closed if source and portable executable hashes differ.

## Validation

- PowerShell parser validation: PASSED
- Packaging-only validation: PASSED
- Full npm run tauri:portable:win: PASSED
- Final verified SHA-256: 1C18CC76BBB8BD56ED490CCF566CBF468B3C9EB433D95674FBBC33FED45FAACA
- Final portable path: release\tauri-portable-win\EOD Chart Portable

## Files changed

- scripts\prepare-tauri-portable.ps1

## Backups

- docs\changes\backups\2026-08-05_0143_IST_PORTABLE_SOURCE_PATH_FIX
- docs\changes\backups\2026-08-05_0154_IST_PORTABLE_HASH_COMPATIBILITY_FIX
