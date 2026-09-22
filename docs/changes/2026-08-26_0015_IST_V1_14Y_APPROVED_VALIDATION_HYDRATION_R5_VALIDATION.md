# V1.14Y Approved Validation Hydration R5 Validation

**IST timestamp:** 2026-08-26 00:15:07 +05:30 IST

## Objective

Validate the V1.14Y Approved-view validation-evidence hydration source already installed by R4, without modifying source or repeating the preserved RED.

## Previous defect or limitation

Approved Split/Bonus rows relied on the incidental scanRows UI cache, so persisted MATCHED validation could display as NOT VALIDATED. V1.14Y adds targeted latest completed official_imports scan hydration. The original B orchestration failed after RED because an empty PowerShell replacement string was rejected. R3 failed before modification due an incorrect combined anchor. R4 installed the intended frontend code but stopped at a stale expected hash caused by PowerShell here-string trailing-newline semantics.

## Files changed by V1.14Y

- src-tauri-shell\src\database.rs
- src-tauri-shell\src\database\corporate_action_imports.rs
- src-tauri-shell\src\database\corporate_action_imports\v114y_tests.rs
- src\types\desktop.ts
- src\components\DatabaseToolsDialogs.tsx

## Final implementation

- Targeted scan-list input accepts up to 500 import IDs.
- Targeted mode returns the latest result per requested import from COMPLETED official_imports runs.
- Existing non-targeted scan-result behavior remains unchanged.
- Approved Split/Bonus rows hydrate persisted validation evidence in batches of 500.
- Cached validation rows are replaced for all requested import IDs, including imports with no qualifying scan.
- No scan rerun, approval mutation, or database repair is required.

## R4 hash-guard clarification

- Actual DatabaseToolsDialogs.tsx SHA-256: 1CEFF93CBBDCDC394BB7E9644864C2CA91B2CE888331E510D545C3A9D3F36816
- Original planned SHA-256: 8D55DBCD0F2E0DF260491476324DECD0132BB579D34503DB38BCCFD59041A4E7
- The difference is exactly one extra blank line left by PowerShell here-string newline semantics.
- In-memory removal of that single blank line reproduces the original planned SHA-256 exactly.
- No source edit is made solely to normalize that whitespace.

## Validation commands

- cargo test database::corporate_action_imports::v114y_tests:: -- --nocapture --test-threads=1
- cargo test phase1_price_validation_gate -- --nocapture --test-threads=1
- cargo test v114x_ -- --nocapture --test-threads=1
- cargo test v17a_ -- --nocapture --test-threads=8
- npm test -- src/features/corporateActions/__tests__/corporateActionValidation.test.ts
- npm test
- npm run typecheck:renderer
- npm run build:renderer
- cargo check --manifest-path src-tauri-shell\Cargo.toml
- cargo test --manifest-path src-tauri-shell\Cargo.toml

## Actual validation results

- Preserved deterministic RED: PASS; 0 passed / 2 failed for the intended missing contracts.
- R5 GREEN and regression validation: IN PROGRESS.

## Risks or limitations

- Approved lists with more than 500 Split/Bonus rows use multiple read-only targeted calls.
- Manual UI smoke testing is required after automated validation.

## Rollback guidance

- Exact pre-V1.14Y backups remain under E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14y-approved-validation-hydration_20260825_192729_589\source-before.
- Restore the four pre-change files from that directory and remove v114y_tests.rs if rollback is required.
- No database rollback is required because V1.14Y does not mutate production data.

## Validation failure

- Status: FAILED
- Error: Full Vitest suite FAILED with exit code 1. Log: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14y-approved-validation-hydration-r5_20260826_001507_077\reports\06-vitest-full.log
- R5 did not modify source code.
- No production database path was supplied and no production database write was requested.
