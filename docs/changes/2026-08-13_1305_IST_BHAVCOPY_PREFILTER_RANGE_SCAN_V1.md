# Bhavcopy Prefilter Range Scan V1

## Objective

Reduce Date Range prefilter latency in binary storage mode without weakening the existing metadata-vs-binary coverage safety check.

## Audited bottleneck

The previous reconciler scanned every `.eod` file in the selected exchange folder. For every file whose first/last date overlapped the requested dates, it then ran an independent binary search for every target date. With eight target dates this could cause dozens of tiny random `seek + read(4 bytes)` operations per symbol file, multiplied across thousands of files.

The runtime evidence that triggered this change showed:

- NSE: 7,132 binary files, 8 target dates, 523,371 ms reconciliation.
- BSE: 16,722 binary files, 8 target dates, 171,131 ms reconciliation.

## V1 implementation

- Keeps the existing `download_log` metadata lookup and 80% usable-binary-coverage threshold unchanged.
- Keeps `BINARY_PREFILTER_RECONCILE_MAX_DATES = 31` unchanged.
- Enumerates the same `.eod` files and still counts actual per-date binary coverage.
- Replaces one binary search per target date with:
  - one lower-bound search for the first overlapping target date,
  - one upper-bound search for the last overlapping target date,
  - one contiguous record-window read,
  - in-memory membership checks for target dates.
- Splits the read-only file scan across a bounded maximum of four workers.
- Preserves fail-closed behavior: file I/O/read errors still fail the reconcile instead of silently trusting metadata.

## Explicit non-scope

No changes to:

- provider URLs/download parsing,
- calendar/holiday/special-session policy,
- Update same-day cutoff,
- symbol identity/series filtering,
- binary file format,
- binary write paths,
- Phase 2C deferred APPEND_NEWEST durability,
- Phase 2D background checkpointing,
- interrupted checkpoint recovery,
- Manual Import Recovery,
- renderer/UI.

## Acceptance

1. Focused range-scan exact-count regression passes.
2. Focused four-worker cap regression passes.
3. Full Bhavcopy Rust test suite passes.
4. `cargo check` passes.
5. Portable runtime Date Range repeat shows materially lower `binary reconcile` elapsed time while returning the same prefiltered dates/tasks.