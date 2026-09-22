# Bhavcopy Symbol-Batched Import Report

Date: 2026-06-27

## Scope

- Area: NSE/BSE Bhavcopy Download backend import path.
- Files changed:
  - `src-tauri-shell/src/bhavcopy.rs`
  - `src-tauri-shell/src/database/binary_eod.rs`
- Pre-edit backup:
  - `backups/pre_opencode_changes_20260627_020236_bhavcopy-symbol-batched-import`
  - `backups/pre_opencode_changes_20260627_190907_bhavcopy-csv-style-binary-pipeline`
  - `backups/pre_opencode_changes_20260628_010720_bhavcopy-phase-timing`

## Change

The batch downloader now keeps the staged-download phase, then parses staged CSV payloads before writing. Parsed CSV rows are imported through a symbol-batched writer, grouping binary EOD records by `exchange + symbol` so a multi-date batch touches each `.eod` symbol file once instead of once per date.

The binary EOD writer also keeps the prior fast paths:

- rewrite only the affected tail when inserting a missing recent date
- rewrite only the affected tail when replacing an existing recent date range
- skip binary rewrites entirely when the incoming recent records are unchanged
- append normally when incoming dates are after the current file tail
- use one read/write handle for fast-append inspection and header update instead
  of reopening the same `.eod` file multiple times per symbol

NSE Index full-list routing remains unchanged.

The Bhavcopy binary import stage now also mirrors the CSV/TXT importer's binary
pipeline more closely:

- write symbol groups in parallel through a single binary append/merge pass
- return inserted-date stats from the binary writer so binary-only mode still
  reports only newly imported rows
- skip already-present dates in binary-only mode without a separate pre-write
  `.eod` inspection pass
- keep the activity result as newly imported rows
- keep the download log populated from parsed day metadata so already-present
  staged days are not treated as missing on the next plan
- emit phase timing logs for staged CSV parse, metadata upsert, binary filter,
  binary write, download-log writes, and final cache/snapshot refresh so the
  next portable run can identify the real slow stage

## Expected Impact

For date ranges that include thousands of NSE symbols, the slow stage should move from repeated per-date binary writes to one grouped binary write per symbol. This is closer to an AmiQuote-style staged import flow: fetch first, parse/normalize, then write in a grouped import pass.

## Validation

Focused Rust tests:

- `test_insert_parsed_bhavcopy_files_batches_binary_records_by_symbol`
- `test_insert_parsed_bhavcopy_files_skips_existing_binary_records`
- `test_missing_recent_date_merges_tail_only`
- `test_existing_dates_overwrite_without_changing_record_count`
- `test_unchanged_existing_dates_skip_rewrite`
- `test_default_nse_index_plan_uses_daily_full_index_list_candidates`

Full validation:

- `scripts/validate-change.ps1 -Profile tauri -Paths @('src-tauri-shell/src/bhavcopy.rs','src-tauri-shell/src/database/binary_eod.rs')`
