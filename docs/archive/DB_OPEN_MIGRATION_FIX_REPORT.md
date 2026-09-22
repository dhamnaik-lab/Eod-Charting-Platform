# DB Open Migration Fix Report

Date: 2026-04-08

## Root Cause

`src-tauri-shell/src/database.rs` was still running legacy data migration work on every database open inside `run_migrations()`.

The repeated open-time work included:

- normalizing legacy `corporate_actions` rows
- normalizing legacy `instrument_identity_history` rows
- backfilling `instruments` from `eod_prices`

The worst part was the repeated `eod_prices -> instruments` backfill query, which scanned the historical price table every time the app opened a database.

## Fix

- Added a one-time migration marker:
  - `migration.legacy_data_v1`
- Moved the legacy row-normalization and instrument-backfill logic into `run_legacy_data_migrations_once(...)`
- The expensive backfill now runs only once per database and then records completion in `settings`
- Added `read_setting_value(...)` and `write_setting_value(...)` helpers so backend migration markers can be persisted cleanly

## Files Changed

- `src-tauri-shell/src/database.rs`

## Validation

- `npm run build`

## Backup

- `backups/pre_opencode_changes_20260408_233008_db_open_migration_fix`
