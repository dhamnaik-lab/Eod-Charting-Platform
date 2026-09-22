# Bhavcopy Prefilter and Row-Parity Diagnostics V1

## IST timestamp

2026-08-08 19:16 +05:30

## Objective

Instrument two issues exposed by the successful BSE/BSE Index historical runtime test without changing import, binary durability, source-selection, or worker behavior:

1. The approximately 61-second delay before download jobs started.
2. The consistent +1 BSE Equity row difference between the EOD Charting Platform and the separately proven Go/Wails EOD Downloader for each tested December 2023 trading day.

## Previous defect or limitation

The 2023-12-01 through 2023-12-10 BSE/BSE Index runtime test proved that provider compatibility was fixed, but it exposed two measurement gaps.

### Planning / prefilter delay

The UI logged the batch start at approximately 19:11:51, but the first prefilter/plan messages appeared at approximately 19:12:52. The existing logs did not break that minute down.

Source inspection shows that Binary storage mode can reconcile imported dates by scanning every `.eod` file in the selected exchange directory when the number of imported target dates is 31 or fewer. For each file it opens the binary file, reads the header/date bounds, and tests target-date presence. This is the strongest code-level candidate for the observed delay, but runtime timing was not previously emitted.

### BSE Equity row parity

The standalone Go downloader reported these BSE Equity record counts for the successful December 2023 sessions:

- 2023-12-01: 4208
- 2023-12-04: 4372
- 2023-12-06: 4244
- 2023-12-07: 4200
- 2023-12-08: 4198

The EOD Charting Platform reported exactly one additional row on each corresponding day:

- 2023-12-01: 4209
- 2023-12-04: 4373
- 2023-12-06: 4245
- 2023-12-07: 4201
- 2023-12-08: 4199

The Go BSE parser explicitly deduplicates by normalized symbol and keeps the higher-volume record when a symbol repeats. The Rust staged CSV parser does not currently perform equivalent symbol/date deduplication. This is a strong parity hypothesis, but raw runtime duplicate evidence was not yet logged, so this change does not alter data behavior.

## Files changed

### Modified

- `src-tauri-shell/src/bhavcopy.rs`

### Created

- `docs/changes/2026-08-08_1916_IST_BHAVCOPY_PREFILTER_ROW_PARITY_DIAGNOSTICS_V1.md`

## Final implementation

### Prefilter timing diagnostics

`ImportedTradeDates` now records diagnostics only:

- metadata lookup elapsed milliseconds;
- binary reconciliation elapsed milliseconds;
- number of `.eod` files scanned;
- number of imported target dates checked.

Batch planning emits an operator-visible line in this shape:

```text
[BSE] Prefilter timings: metadata N ms; binary reconcile N ms; binary files scanned N; target dates N
```

The binary reconciliation algorithm itself is unchanged.

### Row-parity diagnostics

Before binary writes begin, the staged parsed rows are checked for duplicate `(exchange, symbol, trade_date)` keys. No rows are removed or replaced.

If duplicates exist, the app emits:

```text
Bhavcopy row parity audit: duplicate symbol/date rows N; samples [EXCHANGE:SYMBOL@DATE, ...]
```

Up to eight sample duplicate keys are logged.

A unit test was added to verify that the diagnostic helper detects a duplicate BSE symbol/date pair.

## Behavior deliberately preserved

- No BSE/NSE provider URL changes.
- No parser row filtering or deduplication change.
- No `.eod` binary layout change.
- No `append_or_merge_records_with_stats` behavior change.
- No `flush()` or `sync_data()` change.
- No binary worker-count change.
- No download worker-count change.
- No SQLite schema change.
- No frontend change.
- No download-log semantics change.

## Validation commands

Required Windows validation after applying the patch:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"

cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  bhavcopy `
  -- --nocapture

cargo check `
  --manifest-path ".\src-tauri-shell\Cargo.toml"

npm run tauri:check
```

The targeted Bhavcopy suite should increase from 23 to 24 tests because one diagnostics test was added.

After validation, a runtime re-run of the same BSE/BSE Index 2023-12-01 through 2023-12-10 range is sufficient to collect the two new diagnostic lines. A portable rebuild is required before using the packaged executable.

## Actual validation results

### Performed in artifact environment

- Source diff scope: only `src-tauri-shell/src/bhavcopy.rs` changed, plus this report.
- `git diff --no-index --check`: no whitespace-error diagnostics; exit code `1` only because files differ.
- Manual source review of all inserted timing and duplicate-detection paths: completed.

### Not run in artifact environment

- Rust compile: NOT RUN; Cargo/Rust toolchain is unavailable in the artifact environment.
- Rust tests: NOT RUN.
- Tauri check/build: NOT RUN.
- Live BSE runtime: NOT RUN.

The Windows project remains the authoritative compile/test/runtime environment.

## Risks or limitations

- Timing instrumentation adds only `Instant` measurements and counters, but the binary reconciliation operation remains serial and therefore may still take approximately the same time until a later optimization is deliberately implemented.
- Duplicate detection is measurement-only. If the runtime confirms exactly one duplicate BSE symbol/date row per tested day, a separate correction should match the Go downloader's deduplication policy only after the duplicate symbol and source rows are inspected.
- This patch does not repair any duplicate dates that may already exist in new `.eod` files from previous imports.

## Rollback guidance

Restore `src-tauri-shell/src/bhavcopy.rs` from the confirmed `2026-08-08_1820_IST_BHAVCOPY_PROVIDER_COMPATIBILITY_V1` source snapshot and remove this report. No database rollback is required because this diagnostics change does not modify storage semantics.
