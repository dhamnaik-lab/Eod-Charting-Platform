# Corporate Action Phase 1 — Controlled Historical ISIN Bootstrap V1.9.2.3 Reporting Recovery Fix

## Purpose

V1.9.2.2 successfully committed the controlled historical-ISIN bootstrap transaction, but final reporting failed afterward when the tuple CSV serializer attempted to serialize `import_ids: Vec<i64>` directly inside a CSV row.

Observed post-commit error:

`CSV write error: cannot serialize sequence container inside struct when writing headers from structs`

The committed database state was independently verified afterward by a zero-write private-snapshot Preview: all 283 reviewed candidates classified `ALREADY_APPLIED`, with zero partial prior applies, zero history conflicts, and zero state changes.

## Change

- Preserve `HistoricalIsinBootstrapApplyTupleResult.import_ids` as `Vec<i64>` for internal logic and JSON.
- Add a CSV-only scalar projection `HistoricalIsinBootstrapApplyTupleCsvRow`.
- Convert tuple `importIds` to a deterministic pipe-delimited scalar for CSV only, e.g. `1274|1275`.
- Keep Apply JSON `importIds` as the original array `[1274, 1275]`.
- Add regression test `phase1_v1923_apply_outputs_flatten_compound_import_ids_for_csv_only` that exercises `write_apply_outputs()` without a database.

## Safety boundary

This package is source/reporting-only. Its wrapper:

- does not open SQLite;
- does not run Preview;
- does not run Apply;
- does not insert historical ISIN rows;
- does not Quick Resolve imports;
- does not approve Corporate Actions;
- does not change factors, price validation, or raw EOD data.

The wrapper accepts only the exact V1.9.2.2 bootstrap source hash or the already-applied V1.9.2.3 payload hash.
