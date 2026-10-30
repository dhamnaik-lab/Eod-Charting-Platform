# Corporate Actions Ready guard and approval reports — 24 October 2026

## Implemented scope

- Dividend R1 must pass `ensure_official_import_eod_ready` before becoming eligible. This is the ordinary writer's existing symbol/date guard. Unified same-ISIN prices alone cannot make HEGAM Ready without a dated historical route. Existing evidence, factor, identity and exclusion checks remain in place.
- The Dividend transaction owner now explicitly checks rollback success before issuing `CA_DIVIDEND_ROLLBACK_CONFIRMED`. Failure details include up to ten failed import IDs, symbols and reasons. Commit errors and failed rollback attempts remain uncertain. One BEGIN/COMMIT-or-ROLLBACK boundary, the operation lock and the existing financial executor are preserved.
- The renderer distinguishes a confirmed failed-batch rollback from an unknown dispatched outcome. It explicitly warns that earlier batches may already have committed; it does not automatically retry.
- Any approval attempt invalidates the prepared generation and navigation Ready cache. Reports retain a separate read-only last-scan snapshot and last approval failure for the active database. Counts are labelled historical once readiness is invalidated. These snapshots are dialog-session state, not new disk-persisted scan receipts, and never supply approval authority.
- Reports → Recent approved actions loads the latest 200 persisted approved imports without pending/type/search filters. Approval timestamps are displayed in IST. The backend orders APPROVED lists by parsed approval time, newest first, with deterministic ID tie-breaking; pending ordering remains unchanged. This is durable action history, not a fabricated batch/run ledger.

## Files

- `src-tauri-shell/src/database/corporate_action_imports.rs`: transaction outcome details and approved-list ordering.
- `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs`: shared EOD readiness gate.
- `src/components/DatabaseToolsDialogs.tsx`: report retention, recent history, error wording and readiness invalidation.
- `src/features/corporateActions/legacy/corporateActionApprovalReports.ts`: failure wording and timestamp formatting.
- Focused Rust tests in `auto_approval/write_stage_tests.rs`, `simple_cash_dividend_transaction_owner_tests.rs` and the import-list test; frontend regression in `corporateActionApprovalReports.test.ts`.

## Measured validation

PASS, serial focused Rust checks (103 distinct tests):

- `cargo test --manifest-path src-tauri-shell/Cargo.toml dividend_policy_r1 --offline -- --nocapture`: 22.
- `cargo test --manifest-path src-tauri-shell/Cargo.toml auto_approval::write_stage_tests --offline -- --nocapture`: 42.
- `cargo test --manifest-path src-tauri-shell/Cargo.toml simple_cash_dividend_transaction_owner_tests --offline -- --nocapture`: 27.
- `cargo test --manifest-path src-tauri-shell/Cargo.toml dividend_prepared_scope_r1 --offline -- --nocapture`: 11.
- `cargo test --manifest-path src-tauri-shell/Cargo.toml list_import_rows_orders_by_ex_date_desc --offline -- --nocapture`: 1, including approval chronology/offset assertions.
- The same-ISIN regression was separately rerun after adding its positive dated-route control: PASS. It proves direct prices eligible, undated same-ISIN-only prices ineligible, and dated historical routing eligible, with no financial write.

PASS: 20 frontend tests across ApprovalReports, DividendExplicitApprovalR1, MaintenanceNavigation and DividendWriteStageOrchestration, using `npx vitest run --exclude 'tmp/**'` with the four exact active test paths. These include source-contract checks, not native interaction acceptance.

Initial transaction test run: FAIL, 25 passed / 2 assertions tied to the deliberately replaced helper/error string; updated to verify the new contract, rerun PASS 27. Initial frontend selector omitted the `tmp/**` exclusion and included archived/stale contract copies; that result is not acceptance evidence. Corrected focused selector PASS 20. Renderer typecheck PASS; initial unscoped validation wrapper FAIL on pre-existing `README.md:21` trailing whitespace. Scoped changed-file whitespace check PASS; unrelated README unchanged.

## Safety and remaining acceptance

Backup: `backups/pre_opencode_changes_20261024_194738_ca_ready_reports`. Existing unrelated work was preserved. Tests use disposable/in-memory fixtures; no live approval or database/price-data mutation was performed. No portable build, installer, full suite or live All Ready run was executed.

Rebuild for native acceptance, then Load & Validate again. Verify HEGAM July 22 is blocked, Reports survive Pending/Approved and advanced-tool navigation, and Recent approved actions shows saved approvals newest first. Any financial approval still requires a deliberate confirmation after fresh validation. Existing BSE master-collection transport acceptance remains a separate unresolved issue.
