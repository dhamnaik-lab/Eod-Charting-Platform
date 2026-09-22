# CSV Import Batch Progress Optimization Report

Date: 2026-06-08

## Scope

Improve the active Tauri CSV/TXT importer in `src-tauri-shell/src/imports.rs` without building the app, because the user was actively running the current EOD Charting Platform instance.

Target problems:

- single-date imports sat on `0% Starting import` for too long
- multi-file daily imports repeated binary `.eod` writes per symbol per file and were operationally too slow
- binary dual-write failures were not counted as import errors

## What Changed

### 1. Deterministic file order

Selected import files are now sorted before processing.

Why:

- daily `YYYYMMDD` files now run in chronological order
- batch behavior is predictable even if the OS file picker returns paths in a mixed order

### 2. Phase-aware progress

Import progress now reports two stages:

- parsing / SQLite stage
- binary `.eod` write stage

Parsing now emits more frequent progress updates with row and symbol counts.

Binary writing now emits live symbol-position updates such as:

- `Writing binary EOD 123/3054 symbols (RELIANCE)`

Why:

- the previous importer only emitted row progress every `5000` rows
- single-day NSE files around `3000` rows often showed no mid-import progress at all

### 3. Aggregated binary writes across the selected batch

For multi-file imports, binary records are now collected across the whole selected batch and written once per symbol after SQLite work completes.

Previous behavior:

- one binary append/merge per symbol for every input file

New behavior:

- one binary append/merge per symbol for the whole selected import batch

Why:

- daily-file imports were spending too much time repeating binary updates for the same symbol across consecutive days
- this is the lowest-risk backend optimization that does not redesign the import contract

### 4. Binary write failures now count as real import errors

If binary dual-write fails for a symbol:

- `rowsError` now increments
- the failure still surfaces in the error list
- overall `success` becomes `false` when such errors occur

Why:

- earlier behavior could report success while the SQLite side succeeded but the binary side failed

### 5. Binary-mode duplicate skip now matches the UI contract

When the app runs in binary mode and the import dialog uses:

- `On Duplicate: Skip`

the importer now inspects the existing binary `.eod` file for that symbol and removes already-present dates before writing.

Why:

- the earlier binary-mode path still reprocessed overlapping monthly imports even when the dialog was set to `Skip`
- this made timing tests misleading and made `rowsSkipped` inaccurate for overlap-heavy imports

### 6. Duplicate checks now use binary-search membership instead of full-file scans

`src-tauri-shell/src/database/binary_eod.rs` now exposes `filter_records_against_existing()` for incoming symbol blocks.

Behavior:

- opens the existing `.eod` file once
- uses the existing sorted date layout plus binary search for membership checks
- filters only the incoming dates that are already present
- avoids loading the whole `.eod` file into memory just to test overlap

Why:

- overlap-heavy monthly imports were still too slow after the correctness fix
- the main cost was full-file reads for per-symbol date membership checks

### 7. Duplicate checks now reuse one overlap-range read per symbol

`src-tauri-shell/src/database/binary_eod.rs` now narrows duplicate checking further:

- it reads the existing file header to get first/last date
- it returns early when the incoming block sits fully outside the existing date range
- otherwise it reads only the overlapping existing date span once with `read_range(...)`
- it compares incoming dates against that overlap set in memory

Why:

- the previous binary-search-per-date path was correct, but still too slow on fully overlapping monthly imports
- this new path keeps the same behavior while removing repeated file probes for each incoming row

### 8. Full-skip imports now keep source-scope summary fields

`src-tauri-shell/src/imports.rs` now keeps `symbolCount`, `dateRange`, and sample-symbol context from parsed source rows even when:

- `On Duplicate: Skip`
- every parsed row is already present in binary `.eod` storage
- `rowsInserted` becomes `0`

Why:

- the previous full-skip monthly result could show `Inserted: 0` correctly but still report `Symbols: 0` and a blank date range
- that made the result summary misleading even after duplicate handling was fixed

### 9. Binary symbol work now runs in a bounded parallel worker pool

`src-tauri-shell/src/imports.rs` now parallelizes the two most expensive symbol-level stages:

- binary duplicate filtering
- binary `.eod` append / merge writes

Behavior:

- the importer still parses source files in one thread
- once symbol batches are queued, a small bounded worker pool processes independent symbol jobs concurrently
- live progress is preserved by reporting symbol completions as worker results arrive

Why:

- the importer had already been grouped by `SYMBOL, DATE`, but it was still forcing thousands of independent symbol checks and writes to run strictly one-by-one
- this is the closest current step toward an AmiBroker-style import path without redesigning the storage format

## Files Changed

- `src-tauri-shell/src/imports.rs`
- `src-tauri-shell/src/database/binary_eod.rs`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`

## Validation

Executed in this pass:

- `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
- `git diff --check -- src-tauri-shell/src/imports.rs src-tauri-shell/src/database/binary_eod.rs`
- focused `cargo test` runs were attempted in earlier passes for this importer path, but they did not complete reliably within the local timeout window in this workspace

Intentionally not run:

- `cargo check`
- `cargo test`
- `npm run tauri:check`
- app builds / portable builds

Reason:

- the user explicitly asked not to build the app while the active EOD Charting Platform instance was running

## Expected User-Facing Effect

- single-date imports should now show live progress instead of sitting silently at `0%`
- small daily batches should show current file/stage progress and binary-write progress
- daily multi-file imports should be materially faster because binary writes are no longer repeated per symbol per input file
- overlapping monthly imports in binary mode should now skip already-imported dates instead of treating the full overlap as newly inserted
- fully skipped overlap imports should still show the real symbol/date scope of the imported file instead of collapsing to zero symbols / empty range

## Next Recommended Step

Use the running app to test:

1. one monthly merged import file from `EOD Downloader`
2. one 5-10 daily-file batch

Compare:

- visible progress quality
- total duration
- chart refresh behavior after completion
