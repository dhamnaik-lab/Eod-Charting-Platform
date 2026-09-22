# Manual Import Binary Diagnostics V1

## Timestamp

2026-08-09 00:48 IST

## Goal

Instrument the existing **Import CSV / TXT Data** backend so its binary persistence behavior can be compared directly with the already-instrumented **Download Bhavcopy** path before changing durability or worker behavior.

This is a measurement-only change.

## Baseline

Fresh source snapshot:

`Eod Charting Platform Source Code 2026-08-09_002538_IST`

The source audit confirmed:

- Manual CSV/TXT import uses up to 4 binary write workers.
- Download Bhavcopy uses up to 8 binary write workers.
- Both ultimately use `BinaryEodFile::append_or_merge_records_with_stats()`.
- `APPEND_NEWEST` currently performs two `flush()` + `sync_data()` durability stages per symbol.

Recent runtime evidence showed:

- BSE append-heavy Bhavcopy run: 4,693 `APPEND_NEWEST`, 9,418 `sync_data()` calls, about 232.6 seconds binary wall time.
- NSE 2026-08-07 append-heavy Bhavcopy rerun: 3,200 `APPEND_NEWEST`, exactly 6,400 `sync_data()` calls, about 171.1 seconds binary wall time.
- Manual CSV/TXT BSE import completed in about 2.1 minutes, but the dialog previously exposed only total duration and no binary-path timing.

## Files changed

### Modified

- `src-tauri-shell/src/imports.rs`
- `src/types/desktop.ts`
- `src/components/ImportCsvDialog.tsx`

### Created

- `docs/changes/2026-08-09_0048_IST_MANUAL_IMPORT_BINARY_DIAGNOSTICS_V1.md`

## Implementation

### Backend diagnostics

Manual import now aggregates the same low-level binary telemetry already available to Bhavcopy:

- binary worker count;
- parse/prepare wall time;
- binary duplicate-filter wall time;
- binary write wall time;
- inserted / changed / unchanged dates;
- binary errors;
- write-path counts:
  - `NEW_FILE`
  - `APPEND_NEWEST`
  - `REWRITE_TAIL`
  - `UPDATE_EXISTING`
  - `INSERT_HISTORICAL`
  - `NO_OP`
- phase timings:
  - exists
  - open
  - header read
  - last-date read
  - sort
  - lookup
  - tail read
  - new-file write
  - seek
  - data write
  - byte shift
  - set-len
  - header write
  - flush
  - sync_data
- flush and `sync_data()` call counts;
- parallel-summed symbol elapsed time;
- p50, p95, and maximum symbol time.

The manual writer now calls `append_or_merge_records_with_stats()` instead of discarding the existing stats/diagnostics through the convenience wrapper. Storage behavior is unchanged.

### Import Completed UI

The Import CSV/TXT completion box now shows a selectable, copy-friendly **Binary Diagnostics** text block when binary writes occurred.

This makes a manual import directly comparable to Bhavcopy runtime logs without requiring a console or persistent import log.

### Targeted regression assertion

The existing binary-skip manual import test now also verifies that a one-record newest-date append reports:

- one worker;
- one `APPEND_NEWEST` path;
- two `sync_data()` calls;
- one inserted date.

This explicitly freezes the current behavior for the diagnostic baseline. It does **not** approve that durability strategy as the final optimized design.

## Behavior deliberately unchanged

- No `.eod` binary format change.
- No `sync_data()` removal or consolidation.
- Manual import worker cap remains 4.
- Bhavcopy binary worker cap remains 8.
- No series filtering change.
- No duplicate identity/deduplication change.
- No database schema change.
- No exchange downloader change.
- No chart-loader change.
- No staged Bhavcopy architecture change.

## Expected runtime diagnostic example

After a successful manual import, the dialog should display lines similar to:

```text
workers 4; parse/prepare ... ms; binary filter ... ms; binary write ... ms
paths: new file ...; append newest ...; rewrite tail ...; update existing ...; insert historical ...; no-op ...
dates: inserted ...; changed ...; unchanged ...; errors ...
sync_data ... ms / ... calls; flush ... ms / ... calls
parallel-summed symbol ... ms; p50 ... ms; p95 ... ms; max ... ms
detail: exists ...; open ...; header read ...; ...
```

## Required Windows validation

Run:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"

cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  imports `
  -- --nocapture

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

After those pass:

```powershell
npm run tauri:portable:win
```

Then perform one new manual CSV/TXT import whose rows mostly append after existing symbol history and send the **Binary Diagnostics** block shown in the Import Completed window.

## Acceptance decision after measurement

Compare manual-import 4-worker measurements with Bhavcopy 8-worker measurements. Only then decide whether the first performance correction should target:

1. binary worker contention;
2. the two `sync_data()` durability barriers per `APPEND_NEWEST`;
3. both in a controlled sequence.

## Artifact-environment validation

Performed here:

- source scope comparison;
- whitespace/diff checks;
- archive integrity checks;
- generated/build-artifact exclusion checks.

Not performed here because Cargo/Rust toolchain is unavailable:

- Rust compilation;
- Rust tests;
- Tauri build.

Frontend package dependencies are also not present in the source snapshot, so Windows remains the authoritative TypeScript/build validation environment.
