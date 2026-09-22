# DNN Research Export Rust Lifetime Fix

## IST timestamp

2026-08-05 23:27:28 +05:30

## Objective

Correct the Rust borrow-checker failure in the DNN research dataset export candidate query without changing the export contract, filtering, ordering, or database behavior.

## Previous defect or limitation

The focused renderer tests passed, but the first Windows Rust test compilation failed with `error[E0597]` in:

```text
src-tauri-shell/src/database/dnn_research_export.rs:706
```

`load_export_candidates` returned a chained `query_map(...).collect(...)` expression as the final expression of the function. The temporary `MappedRows` value borrowed the prepared SQLite statement and could be dropped after the statement at block exit, so Rust rejected the lifetime ordering.

Observed Windows command:

```powershell
cargo test `
  --manifest-path .\src-tauri-shell\Cargo.toml `
  dnn_research_export `
  -- --nocapture
```

Observed result before this correction: **FAIL** during compilation with `E0597`.

The unrelated existing warning in `nse_identity_imports.rs` for unused variable `urls` did not cause the failure and was deliberately left unchanged.

## Files inspected

- `src-tauri-shell/src/database/dnn_research_export.rs`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/Cargo.toml`
- `docs/changes/2026-08-05_2230_IST_DNN_RESEARCH_DATASET_EXPORT_V1.md`

## Files modified

- `src-tauri-shell/src/database/dnn_research_export.rs`

## Files created

- `docs/changes/2026-08-05_2327_IST_DNN_RESEARCH_EXPORT_RUST_LIFETIME_FIX.md`

## Backup

The pre-fix exporter file is preserved at:

```text
docs\changes\backups\2026-08-05_2327_IST_DNN_RESEARCH_EXPORT_RUST_LIFETIME_FIX\dnn_research_export.rs
```

## Final implementation

The prepared statement, mapped-row iterator, and collected candidate vector now have explicit local bindings:

```rust
let mapped_rows = statement.query_map(...)?;
let candidates = mapped_rows.collect::<Result<Vec<_>, _>>()?;
Ok(candidates)
```

This forces the row iterator to be consumed before the function returns and removes the end-of-block temporary lifetime ambiguity.

## Exact behavior changed

- Rust can now determine a valid destruction order for the prepared statement and its mapped rows.

## Behavior deliberately preserved

- Same SQL query.
- Same NSE/BSE restriction.
- Same optional exchange filter.
- Same inactive-instrument policy.
- Same `ORDER BY exchange ASC, symbol ASC` ordering.
- Same `ExportCandidate` mapping.
- Same string-based error propagation.
- No renderer, database-schema, chart, scanner, prediction adapter, or packaging behavior changed.

## Validation evidence

### Already completed before this correction

```powershell
npm run typecheck:renderer
```

Result: **PASS**

```powershell
npx vitest run `
  src/plugins/__tests__/pluginRegistry.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/featureBuilder.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/predictionService.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/precomputedPredictionSource.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/pluginConfiguration.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/dnnResearchDatasetExportService.test.ts
```

Result: **PASS**

- Test files: 6 passed
- Tests: 27 passed

### Validation performed while preparing this correction

- Exact failing source block inspected: **PASS**
- Minimal source replacement applied: **PASS**
- Post-change source diff reviewed: **PASS**
- Export SQL and mapping semantics preserved: **PASS**

### Not run in the artifact environment

Rust tooling is not installed in the artifact environment, so `cargo fmt`, `cargo test`, `cargo check`, Tauri build, and Windows portable packaging were not executed here.

Required Windows validation:

```powershell
cargo test `
  --manifest-path .\src-tauri-shell\Cargo.toml `
  dnn_research_export `
  -- --nocapture
```

Then, only after it passes:

```powershell
npm test
npm run build
npm run tauri:portable:win
```

## Risks and possible regressions

- Risk is low because the change only introduces explicit local bindings around an unchanged query and collection.
- The correction is not considered fully validated until the Windows Rust test command passes.
- The existing unused-variable warning remains outside this fix.

## Rollback guidance

Restore:

```text
docs\changes\backups\2026-08-05_2327_IST_DNN_RESEARCH_EXPORT_RUST_LIFETIME_FIX\dnn_research_export.rs
```

to:

```text
src-tauri-shell\src\database\dnn_research_export.rs
```
