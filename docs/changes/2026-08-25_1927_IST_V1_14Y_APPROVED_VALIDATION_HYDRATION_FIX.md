# V1.14Y Approved Corporate Action Validation Hydration Fix

**IST timestamp:** 2026-08-25 19:27:29 +05:30 IST

## Objective

Make the Approved Corporate Actions view display authoritative persisted Split/Bonus validation evidence instead of depending on whichever scan rows happen to be in the renderer cache.

## Previous defect or limitation

V1.14Y read-only audit proved approved ANDHRAPAP import 9582 has latest COMPLETED official_imports scan 5353 with MATCHED status and 0.990625 confidence, while the Approved UI displayed NOT VALIDATED because scanRows had not been hydrated for that row.

## Files changed

- src-tauri-shell\src\database.rs
- src-tauri-shell\src\database\corporate_action_imports.rs
- src-tauri-shell\src\database\corporate_action_imports\v114y_tests.rs
- src\types\desktop.ts
- src\components\DatabaseToolsDialogs.tsx

## Final implementation

TDD RED confirmed. GREEN implementation and validation are in progress.

## Validation commands

- V1.14Y targeted RED/GREEN
- Phase 1 price-validation gate regression
- V1.14X Corporate Action regression
- V1.7A regression
- focused and full Vitest
- renderer TypeScript typecheck
- renderer production build
- cargo check
- full Rust default-parallel suite

## Actual validation results

- V1.14Y RED: PASS (expected 0 passed / 2 failed).
- GREEN validation: IN PROGRESS.

## Risks or limitations

- No database migration or mutation is intended.
- Targeted scan-list mode is limited to 500 import IDs per request; the renderer batches larger Approved lists.

## Rollback guidance

- Restore the four pre-change files from E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14y-approved-validation-hydration_20260825_192729_589\source-before.
- Remove src-tauri-shell\src\database\corporate_action_imports\v114y_tests.rs.
- No database rollback is required because V1.14Y-A changes source/read behavior only.

## Validation failure

- Status: FAILED
- Error: Cannot bind argument to parameter 'New' because it is an empty string.
- Production database was not opened or written by this source-validation script.
