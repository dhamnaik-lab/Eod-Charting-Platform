# Bhavcopy Binary Workers 4 Experiment V1

## Timestamp

2026-08-09 11:04 +05:30

## Objective

Run a controlled A/B performance experiment on the Bhavcopy binary-write stage by reducing only the Bhavcopy binary worker cap from 8 to 4.

The experiment is intended to determine whether the high per-symbol `sync_data()` latency observed with 8 concurrent binary writers is caused materially by storage-device contention.

## Baseline evidence

The post-Phase-1 NSE+BSE 2026-08-07 refresh imported 8,314 rows across 8,313 symbols with:

- Bhavcopy binary workers: 8
- `NEW_FILE`: 181
- `APPEND_NEWEST`: 8,132
- binary-write wall time: 513,954 ms
- `sync_data()`: 2,722,930.184 ms summed / 8,132 calls
- parallel-summed symbol elapsed: 3,061,997.401 ms
- p50 symbol: 288.697 ms
- p95 symbol: 940.393 ms
- max symbol: 2,381.142 ms

Phase 1 is confirmed to be active because the `APPEND_NEWEST` count and `sync_data()` call count are both 8,132, proving one final sync per append rather than the previous two-sync sequence.

## Implementation

Modified `src-tauri-shell/src/bhavcopy.rs` only for runtime behavior:

1. Added `MAX_BHAVCOPY_BINARY_WORKERS: usize = 4`.
2. Changed `bhavcopy_binary_worker_count()` to cap available binary workers at that constant instead of 8.
3. Added a narrow unit test confirming the worker-count helper never exceeds the four-worker cap.

## Behavior deliberately preserved

No change was made to:

- Phase 1 `APPEND_NEWEST` single-final-`sync_data()` behavior
- Manual CSV/TXT import worker cap (remains 4)
- user-selected Bhavcopy HTTP/download worker count
- `NEW_FILE`, `REWRITE_TAIL`, `UPDATE_EXISTING`, or `INSERT_HISTORICAL` write semantics
- binary EOD format
- database schema
- series handling or exclusion behavior
- duplicate handling
- NSE/BSE/BSE Index/NSE Index provider logic
- prefilter reconciliation
- download staging or metadata commits
- frontend/UI

## Validation required on Windows

Run:

```powershell
cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  bhavcopy `
  -- --nocapture

cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  binary_eod `
  -- --nocapture

cargo check `
  --manifest-path ".\src-tauri-shell\Cargo.toml"

npm run tauri:check
npm run tauri:portable:win
```

## Benchmark protocol

After building the portable executable, repeat the same controlled workload:

- delete NSE and BSE 2026-08-07 data using the quotations/date tools
- wait until the complete delete operation and post-delete refresh finish
- Download Bhavcopy for 2026-08-07
- select NSE, BSE, NSE Index, and BSE Index
- keep download workers at 2

The Bhavcopy diagnostic log must report `workers 4` in the binary-write stats.

Compare against the 8-worker baseline using:

- binary-write wall time
- `sync_data()` summed time and call count
- parallel-summed symbol elapsed
- p50 / p95 / max symbol latency
- write-path counts
- row counts and errors

## Decision rule

This experiment does not establish 4 workers as the permanent setting by itself.

- If 4 workers materially reduce wall-clock binary-write time and tail latency, retain 4 and continue from that baseline.
- If 4 workers increase wall-clock time or provide only negligible improvement, restore 8 and move to the next durability/batching optimization.

## Rollback

Restore the previous Bhavcopy worker-count expression so the cap is 8 rather than 4. No data migration or binary-format rollback is required.
