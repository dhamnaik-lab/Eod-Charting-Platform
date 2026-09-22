# V1.14W five-pair consolidation maintenance TDD

**IST timestamp:** 2026-08-25 01:10:21 IST

## Objective

Implement a narrowly scoped Rust maintenance path for the exact five Corporate Action consolidations, with V1.14W restricted to private-copy dry-run only and no live Apply capability.

## Previous defect or limitation

V1.14U proved the consolidation transaction on a Python-managed disposable copy and V1.14V proved the exact live state, but the application source has no maintainable Rust maintenance path for this exact consolidation.

## Files changed in Stage A

- src-tauri-shell\src\database\corporate_action_imports.rs — registered focused V1.14W tests only.
- src-tauri-shell\src\database\corporate_action_imports\v114w_tests.rs — added RED source-contract tests.

## Final implementation

Not implemented in Stage A. This stage exists only to establish the mandatory failing TDD RED gate.

## Validation command

cargo test --manifest-path src-tauri-shell\Cargo.toml v114w_red_ -- --nocapture",
        ",
        

RED CONFIRMED: all three focused V1.14W source-contract tests failed because the approved maintenance path is not implemented yet. Cargo exit code: 101. Log: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14w-tdd-red_20260825_011021_641\reports\v1-14w-a-targeted-red.log

## Risks or limitations

- V1.14W production implementation is intentionally absent at this stage.
- No database is opened by the Stage A patching script; cargo tests use source text only.

## Rollback guidance

Restore corporate_action_imports.rs from: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14w-tdd-red_20260825_011021_641\source-before\corporate_action_imports.rs
Delete: src-tauri-shell\src\database\corporate_action_imports\v114w_tests.rs

## Production-data safety

- No live database open.
- No database write.
- No evidence movement or target deletion.
- No Apply capability added.

