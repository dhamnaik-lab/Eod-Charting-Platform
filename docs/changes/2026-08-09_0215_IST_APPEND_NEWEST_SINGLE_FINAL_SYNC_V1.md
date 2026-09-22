# APPEND_NEWEST Single Final Sync V1

## Timestamp

2026-08-09 02:15 +05:30

## Objective

Reduce the measured Bhavcopy/manual-import binary persistence bottleneck for the newest-date append path without changing binary format, database schema, worker counts, exchange download behavior, series handling, or the behavior of non-append write paths.

## Evidence motivating the change

Runtime diagnostics on the existing implementation showed that `APPEND_NEWEST` performs two `sync_data()` calls per existing symbol:

- NSE 2026-08-07: 3,200 `APPEND_NEWEST` symbols -> exactly 6,400 `sync_data()` calls; summed `sync_data()` time ~1,324,230 ms; binary wall time ~171,138 ms.
- BSE 2023-12-11..20: 4,693 `APPEND_NEWEST` symbols plus 32 rewrite-tail symbols -> 9,418 `sync_data()` calls; binary wall time ~232,555 ms.

Manual CSV/TXT diagnostics also confirmed that the same binary writer is the common persistence layer. Worker-count differences affect contention but do not remove the synchronization cost.

## Files changed

### Modified

- `src-tauri-shell/src/database/binary_eod.rs`

### Created

- `docs/changes/2026-08-09_0215_IST_APPEND_NEWEST_SINGLE_FINAL_SYNC_V1.md`

## Implementation

### Before

For `APPEND_NEWEST` only:

1. Seek to end.
2. Write appended EOD record bytes.
3. `flush()`.
4. `sync_data()`.
5. Seek to header.
6. Write new record count / price scale if required.
7. `flush()`.
8. `sync_data()`.

This produced two physical durability barriers per existing symbol.

### After

For `APPEND_NEWEST` only:

1. Seek to end.
2. Write appended EOD record bytes.
3. Seek to header.
4. Write new record count / price scale if required.
5. One final `flush()`.
6. One final `sync_data()`.

Both record bytes and the updated header are physically synchronized before the function returns success.

## Deliberately unchanged

- `NEW_FILE`
- `REWRITE_TAIL`
- `INSERT_HISTORICAL`
- `UPDATE_EXISTING`
- `NO_OP`
- `.eod` record/header format
- SQLite schema or metadata behavior
- Bhavcopy binary worker count (8)
- Manual import binary worker cap (4)
- download worker count
- exchange source/fallback logic
- all-series import behavior and sidebar series filtering
- duplicate handling
- frontend/UI

## Test update

The existing write-diagnostics test now asserts for `APPEND_NEWEST`:

- path is `APPEND_NEWEST`;
- one `flush()` call;
- one `sync_data()` call;
- resulting record count is correct;
- a full read-back returns both the original and appended dates in order.

## Durability semantics and risk

This is a deliberate durability trade-off relative to the previous two-barrier sequence.

The previous implementation physically synchronized appended record bytes before updating the header, which provided a stronger crash-ordering property if the process or machine failed between the two stages. The new implementation commits data and header with one final durability barrier. A successful function return still means the final `sync_data()` completed, but a process/power failure during the append operation before that final sync has a larger partial-write window than before.

This V1 therefore does **not** remove durability synchronization. It only removes the intermediate physical barrier. More aggressive session/batch durability changes are explicitly out of scope.

## Expected performance effect

For a fresh daily append workload dominated by `APPEND_NEWEST`, expected synchronization-call count is approximately halved.

Example measured NSE workload:

- before: 3,200 `APPEND_NEWEST` -> 6,400 append-path `sync_data()` calls;
- expected after: 3,200 `APPEND_NEWEST` -> 3,200 append-path `sync_data()` calls.

Actual wall-clock improvement must be measured on Windows because storage contention, antivirus/filter drivers, filesystem caching, and SSD behavior affect each sync latency.

## Required Windows validation

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"

cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  binary_eod `
  -- --nocapture

cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  imports `
  -- --nocapture

cargo check `
  --manifest-path ".\src-tauri-shell\Cargo.toml"

npm run typecheck:renderer
npm test
npm run build:renderer
npm run tauri:check
```

After those pass:

```powershell
npm run tauri:portable:win
```

## Runtime acceptance benchmark

Best benchmark: repeat a fresh/latest-day workload dominated by existing-symbol appends, ideally the same NSE 2026-08-07 delete/re-download scenario used for the baseline.

Expected diagnostic signature:

```text
append newest ~3200
sync_data calls ~3200 (plus any non-append paths that also sync)
```

Compare:

- binary write wall time;
- `sync_data` summed time and calls;
- p50/p95/max symbol elapsed;
- errors;
- inserted/changed/unchanged counts;
- chart/data correctness after restart.
