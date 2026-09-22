# Manual Background Market Scan V1

## Timestamp

2026-08-04 23:57:33 +05:30

## Exact baseline

- User baseline bundle: 2026-08-04_2317_IST_MARKET_MOVERS_CURRENT_BASELINE.zip
- Tauri Rust line: 2.11.5
- Frontend Tauri API line: 2.11.x

## Objective

Make Market Movers explicitly user-triggered and keep the rest of the EOD Charting Platform usable during a full-universe scan.

## Changes

1. Opening the MOV tab or expanded Market Movers view no longer starts a scan.
2. Exchange, filter, and database changes mark existing results as update-required without rescanning.
3. The header provides Scan, Update, and Cancel controls.
4. Previous results remain visible while an update is running.
5. The Rust scanner opens a dedicated read-only SQLite connection rather than holding the shared active-chart connection mutex.
6. Rust emits request-scoped progress events during the symbol loop.
7. Cancellation uses a request ID and a backend atomic cancellation flag; cancellation is checked between symbols.
8. Frontend ranking and filtering run in a Vite Web Worker rather than the renderer UI thread.
9. Duplicate concurrent manual scan requests are coalesced.
10. Focused tests cover no-auto-scan, dirty-state behaviour, progress, request sharing, and cancellation.

## Deliberately deferred

- BSE equity/group/series filtering remains unchanged.
- The backend still returns bounded recent bars per symbol; a future compact Rust ranking response can reduce IPC payload further.

## Files and patch

- File manifest: 2026-08-04_2357_IST_MANUAL_BACKGROUND_MARKET_SCAN_V1_FILE_MANIFEST.txt
- Unified review patch: 2026-08-04_2357_IST_MANUAL_BACKGROUND_MARKET_SCAN_V1.patch
- Validation transcript: 2026-08-04_2357_IST_MANUAL_BACKGROUND_MARKET_SCAN_V1_VALIDATION.txt
- Backup directory: E:\TA Projects\EOD Charting Platform\docs\changes\backups\2026-08-04_2357_IST_MANUAL_BACKGROUND_MARKET_SCAN_V1

## Validation status

Validation completed successfully. Final results are recorded below.

## Final validation result

**PASSED**

- Market Movers tests passed.
- Scanner regression tests passed.
- TypeScript semantic checking passed.
- Renderer validation passed.
- Rust Market Movers tests passed.
- Cargo check passed.
- Integrated production build passed.
- Portable Windows build was not requested in this run.

