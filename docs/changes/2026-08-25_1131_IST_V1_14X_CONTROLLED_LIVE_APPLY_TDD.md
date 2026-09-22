# V1.14X Controlled Live Apply TDD

**IST timestamp:** 2026-08-25 11:31:14 IST

## Objective

Implement the separately authorized exact five-pair controlled live Corporate Action consolidation Apply, bound to the validated V1.14W Apply plan.

## Previous defect or limitation

V1.14W intentionally exposes private-copy dry-run only. No live Apply maintenance path exists yet.

## Files changed in Stage A

- src-tauri-shell\src\database\corporate_action_imports.rs — registered V1.14X RED tests only.
- src-tauri-shell\src\database\corporate_action_imports\v114x_tests.rs — added live-Apply source-contract RED tests.

## Final implementation

Not implemented in Stage A. This stage establishes the failing TDD gate only.

## Validation command

cargo test --manifest-path src-tauri-shell\Cargo.toml v114x_red_ -- --nocapture

## Actual validation results

RED CONFIRMED: all four V1.14X source-contract tests failed because the authorized live Apply path is not implemented yet. Cargo exit code: 101. Log: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14x-tdd-red_20260825_113114_339\reports\v1-14x-a-targeted-red.log

## Risks or limitations

- No production/live Apply code exists in Stage A.
- Tests inspect source contracts only and do not open SQLite.

## Rollback guidance

- Restore corporate_action_imports.rs from E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14x-tdd-red_20260825_113114_339\source-before\corporate_action_imports.rs
- Delete src-tauri-shell\src\database\corporate_action_imports\v114x_tests.rs

## Production-data safety

- Live database opened: no.
- Database writes: 0.
- Live Apply capability added: no.

