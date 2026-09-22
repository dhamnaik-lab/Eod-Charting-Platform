# Corporate Action V1.9.2.3 Reporting Recovery Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the post-commit Apply tuple CSV serializer so compound tuples such as GLOBE can be reported without any database mutation or Apply rerun.

**Architecture:** Keep `HistoricalIsinBootstrapApplyTupleResult.import_ids` as `Vec<i64>` for JSON and internal correctness. Project each tuple into a CSV-only scalar row where `importIds` is a deterministic pipe-delimited string, then serialize that flat row. Add a regression test that exercises `write_apply_outputs()` end-to-end against a temporary directory and proves both CSV and JSON representations are correct.

**Tech Stack:** Rust, serde, csv crate, tempfile, PowerShell package guard, Node.js package-contract test.

## Global Constraints

- Do not execute Preview or Apply from this package.
- Do not open or mutate the live SQLite database.
- Do not change historical-ISIN insertion, Quick Resolve, transaction, approval, factor, price, or raw-EOD logic.
- Preserve JSON `importIds` as an array; flatten only the tuple CSV representation.
- CSV `importIds` separator is `|`; for GLOBE the expected scalar is `1274|1275`.
- Package applies only to the exact V1.9.2.2 reporting source basis or the already-applied V1.9.2.3 payload hash.

---

### Task 1: Add an exact regression for compound tuple reporting

**Files:**
- Modify/Test: `src-tauri-shell/src/database/corporate_action_imports/historical_isin_bootstrap.rs`

**Interfaces:**
- Consumes: `write_apply_outputs(output, result, backup_path)` and `HistoricalIsinBootstrapApplyResult`.
- Produces: test `phase1_v1923_apply_outputs_flatten_compound_import_ids_for_csv_only`.

- [ ] Add a test result with one GLOBE tuple whose `import_ids` is `vec![1274, 1275]`.
- [ ] Call `write_apply_outputs()` into a `tempdir()`.
- [ ] Assert the tuple CSV contains `1274|1275` and two data imports remain represented by one tuple row.
- [ ] Assert the JSON report still contains `"importIds":[1274,1275]` semantically as an array.
- [ ] Verify the pre-fix source fails the package regression contract because it serializes the nested `Vec<i64>` directly.

### Task 2: Flatten only the CSV projection

**Files:**
- Modify: `src-tauri-shell/src/database/corporate_action_imports/historical_isin_bootstrap.rs`

**Interfaces:**
- Consumes: `HistoricalIsinBootstrapApplyTupleResult`.
- Produces: `HistoricalIsinBootstrapApplyTupleCsvRow` and `historical_isin_bootstrap_apply_tuple_csv_row(&HistoricalIsinBootstrapApplyTupleResult)`.

- [ ] Define a CSV-only serializable row with scalar `import_ids: String`.
- [ ] Convert `Vec<i64>` to a pipe-delimited scalar using the existing tuple order.
- [ ] Change only the tuple CSV writer to serialize the CSV projection.
- [ ] Leave `HistoricalIsinBootstrapApplyResult` and JSON serialization unchanged.

### Task 3: Guard, document, and validate the reporting-only package

**Files:**
- Create: `docs/changes/2026-08-16_CORPORATE_ACTION_PHASE1_CONTROLLED_HISTORICAL_ISIN_BOOTSTRAP_V1_9_2_3_REPORTING_RECOVERY_FIX.md`
- Modify/Create package contract and PowerShell source-only apply/validation wrapper.

**Interfaces:**
- Consumes: exact V1.9.2.2 bootstrap source SHA-256.
- Produces: V1.9.2.3 source-only package that cannot invoke Preview or Apply.

- [ ] Add package-contract assertions that direct tuple serialization is absent and CSV projection is present.
- [ ] Add a hash guard and source backup before replacing the bootstrap module.
- [ ] Run the focused V1.9.2.3 Rust regression, full historical-bootstrap tests, and `cargo check` on Windows.
- [ ] Stop after validation and print an explicit `NO DATABASE OPERATION` marker.
