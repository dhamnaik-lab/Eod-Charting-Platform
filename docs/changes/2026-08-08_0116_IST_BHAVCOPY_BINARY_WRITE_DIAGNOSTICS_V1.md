# Bhavcopy Binary Write Diagnostics V1

## IST timestamp

2026-08-08 01:16:35 +05:30

## Objective

Instrument the Bhavcopy binary EOD write path so the existing 12+ minute binary-write bottleneck can be decomposed into concrete filesystem operations before any performance optimization is attempted.

## Baseline source

- Snapshot: `Eod Charting Platform Source Code 2026-08-08_010155_IST`
- Uploaded ZIP SHA-256: `b494507fe0a8edc2b24c85ff5556ce047700934887f9cb7ae63431e57b4d2f98`

## Previous defect or limitation

The Bhavcopy runtime log exposed only aggregate binary-write duration and row/symbol counts. The observed 2026-08-07 import reported:

- 4 staged jobs
- 8,355 parsed/imported rows
- parse: 57 ms
- metadata upsert: 3,106 ms
- SQLite commit: 3,413 ms
- binary write: 747,065 ms
- binary workers: 8
- inserted dates: 8,355
- inserted symbols: 8,355
- binary errors: 0

The existing log could not distinguish whether each symbol used `NEW_FILE`, `APPEND_NEWEST`, `REWRITE_TAIL`, `UPDATE_EXISTING`, `INSERT_HISTORICAL`, or `NO_OP`, nor could it isolate time spent in `sync_data`, `flush`, opening files, writing payloads, historical byte shifting, or other binary-file operations.

## Files changed

1. `src-tauri-shell/src/database/binary_eod.rs`
2. `src-tauri-shell/src/bhavcopy.rs`
3. `docs/changes/2026-08-08_0116_IST_BHAVCOPY_BINARY_WRITE_DIAGNOSTICS_V1.md`

## Final implementation

### Binary writer diagnostics

Added measurement-only diagnostics to `BinaryEodFile::append_or_merge_records_with_stats` and its existing rewrite/upsert paths.

Each successful write is classified as one of:

- `NEW_FILE`
- `APPEND_NEWEST`
- `REWRITE_TAIL`
- `UPDATE_EXISTING`
- `INSERT_HISTORICAL`
- `NO_OP`

Aggregate microsecond timings are collected for:

- file existence checks
- file open
- header read
- last-date read
- incoming-record sort
- date lookup
- tail read
- full new-file write wrapper
- seek
- data write
- historical byte shift
- `set_len`
- header write
- `flush`
- `sync_data`
- total per-symbol elapsed time

`flush` and `sync_data` call counts are also recorded. This specifically allows the current two-`sync_data()` fast-append sequence to be measured without changing it.

### Bhavcopy aggregate logging

Added two runtime/progress log entries after the existing binary-write stats line:

- `Bhavcopy binary write paths: ...`
- `Bhavcopy binary write detail: ...`

The detail line includes accumulated operation timings plus per-symbol p50, p95, and maximum elapsed time. The total per-symbol timing is explicitly labelled as a parallel-summed value because it can exceed wall-clock binary-write duration when multiple workers run concurrently.

### Tests added/extended

Binary EOD tests now assert diagnostic path classification for representative cases:

- new file
- newest-date append
- rewrite tail
- historical insertion

They also assert the expected `sync_data` call count for those paths, including two calls for `APPEND_NEWEST`.

## Behaviour deliberately preserved

No optimization or storage-semantic change is included in this phase.

Preserved unchanged:

- `.eod` file format and constants
- header layout and record size
- price scaling
- binary path construction
- SQLite schema and transaction ordering
- insertion/update/unchanged semantics
- newest-date append logic
- tail-rewrite logic
- historical insertion logic
- `flush()` calls
- `sync_data()` calls and their ordering
- Bhavcopy binary worker-count algorithm
- download workers
- frontend/UI behaviour other than additional diagnostic progress messages

A static source comparison confirmed the number of `file.sync_data()` calls remains 5 in the module before and after instrumentation, and the number of `file.flush()` calls remains 7.

## Validation commands attempted in artifact environment

### Rust formatting / compilation

Command attempted:

```text
cargo fmt --manifest-path ./src-tauri-shell/Cargo.toml -- --check
```

Actual result:

```text
cargo: command not found
```

Therefore Rust formatting, compilation, unit tests, Tauri checks, and Windows packaging are **not claimed as passed** in this artifact environment.

### Static structural checks

Performed locally against the changed files:

- balanced Rust delimiters for `binary_eod.rs`: PASS
- balanced Rust delimiters for `bhavcopy.rs`: PASS
- `git diff --no-index --check` for `binary_eod.rs`: PASS (no whitespace errors reported)
- `git diff --no-index --check` for `bhavcopy.rs`: PASS (no whitespace errors reported)
- `file.sync_data()` source-call count: 5 before / 5 after
- `file.flush()` source-call count: 7 before / 7 after
- `HEADER_SIZE`, `RECORD_SIZE`, and `DEFAULT_SCALE` definitions: unchanged

## Required validation on Windows project

Run from:

```text
E:\TA Projects\EOD Charting Platform
```

```powershell
cargo fmt `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  -- --check

cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  binary_eod `
  -- --nocapture

cargo check `
  --manifest-path ".\src-tauri-shell\Cargo.toml"

npm run typecheck:renderer
npm test
npm run build:renderer
npm run tauri:check
```

Portable packaging should be deferred until the diagnostic build passes the checks above and a real Bhavcopy benchmark has been captured.

## Runtime benchmark required

Repeat the same one-day Bhavcopy import and capture these lines:

```text
Bhavcopy staged CSV timings: ...
Bhavcopy binary write stats: ...
Bhavcopy binary write paths: ...
Bhavcopy binary write detail: ...
```

The diagnostic result will determine whether Phase 2 should target `sync_data`, new-file creation/rename, filesystem open/stat overhead, historical shifting, worker contention, or another measured hotspot.

## Risks and limitations

- `Instant::now()` instrumentation adds small measurement overhead to each binary operation. It is expected to be negligible relative to the observed 747-second write phase, but the benchmark is intentionally diagnostic rather than a final performance number.
- `NEW_FILE` currently reports the existing `write_all` operation as one combined `new-file write` timing rather than decomposing create/header/payload/rename internally. If the benchmark shows `NEW_FILE` dominates, a second diagnostic refinement may be needed before optimization.
- Summed operation timings across symbols are not wall-clock time when multiple binary workers execute concurrently.
- No Rust compiler was available in the artifact environment, so Windows-side compile/test validation remains mandatory.

## Rollback guidance

Restore these two source files from the confirmed baseline snapshot:

- `src-tauri-shell/src/database/binary_eod.rs`
- `src-tauri-shell/src/bhavcopy.rs`

Then remove this report if a complete rollback of the diagnostic change is required. No database migration or data-file conversion is necessary because this phase does not change persisted formats or write semantics.
