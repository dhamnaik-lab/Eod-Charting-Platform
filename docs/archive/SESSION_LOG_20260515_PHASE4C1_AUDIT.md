# Session Log - 2026-05-15 - Phase 4C1 Audit

## Task: SQLite `eod_prices` Dependency Audit

### Goal
Identify all dependencies on the SQLite `eod_prices` table to prepare for a transition to binary-only OHLCV storage for fresh databases.

### Files Inspected
- `src-tauri-shell/src/bhavcopy.rs`
- `src-tauri-shell/src/imports.rs`
- `src-tauri-shell/src/database/eod_data.rs`
- `src-tauri-shell/src/database/quotes.rs`
- `src-tauri-shell/src/database/binary_eod.rs`
- `src-tauri-shell/src/database/bootstrap.rs`
- `src-tauri-shell/src/database/instrument_mutations.rs`

### Current OHLCV Write Paths (Dual-Write)
Currently, all modification flows write to both SQLite `eod_prices` and Binary `.eod` files:
1.  **Bhavcopy Imports:** `parse_and_insert` (`bhavcopy.rs`)
2.  **CSV Imports:** `import_single_file` (`imports.rs`)
3.  **Quote Editor Add/Edit:** `upsert_quote_internal` (`quotes.rs`)
4.  **Symbol Merge:** `execute_merge_symbols` (`instrument_mutations.rs`)
5.  **Corporate Actions:** `apply_corporate_action_internal` (`instrument_mutations.rs`)

### Current OHLCV Delete Paths (Dual-Delete)
1.  **Quote Editor Delete:** `delete_quote_internal` (`quotes.rs`)
2.  **Symbol Merge Cleanup:** `execute_merge_symbols` (`instrument_mutations.rs`) deletes the old symbol's records.

### Current OHLCV Read Paths
1.  **Chart Loading:** `get_eod_data` (`eod_data.rs`) - Tries binary first, falls back to SQLite `eod_prices` for missing symbols/dates.
2.  **Quote Editor List:** `list_quotes` (`quotes.rs`) - Tries binary first, merges and deduplicates against `eod_prices`.
3.  **Database Statistics:** `load_db_stats` (`bootstrap.rs`) - Aggregates binary file stats and falls back to SQLite `GROUP BY` for symbols not in binary cache.
4.  **Bhavcopy Download State Checks:** (`bhavcopy.rs`) - Uses `has_imported_rows_for_date`, `get_latest_imported_trade_date`, and `load_imported_trade_dates` directly against `eod_prices` to determine skip/refresh logic.
5.  **Parity Audit:** `validate_symbol_parity` (`binary_eod.rs`) - Directly compares SQLite `eod_prices` counts and date ranges against `.eod` files.

### SQLite Metadata Retention
The following SQLite tables must remain as they manage relational metadata:
- `instruments` (Symbol catalog, active status, series)
- `watchlists`
- `watchlist_symbols`
- `download_log` (Critical for Bhavcopy sync state)
- `settings`

### Risk List
1.  **Bhavcopy Download Checks:** `bhavcopy.rs` currently relies heavily on `eod_prices` (e.g., `SELECT 1 FROM eod_prices WHERE date = ?`) to know if a date was already imported. Querying thousands of binary files for this is unfeasible. We will need to rely strictly on `download_log` or introduce an `imported_dates` metadata table in SQLite.
2.  **Database Stats Performance:** `load_db_stats` relies on SQLite `GROUP BY` for fast summarization. While binary stats (`get_all_binary_stats`) are fast, doing filesystem directory scans as the *only* source of truth for total bar counts might be slower on Windows than a single SQLite query.
3.  **Legacy Database Compatibility:** Existing databases still need SQLite fallback. We cannot blindly remove `eod_prices` reads/writes without a feature flag or database-level property (e.g., `storage_mode = 'binary'`).
4.  **Parity Audit Relevancy:** The Parity Audit UI will become obsolete for fresh, binary-only databases.

### Recommended Implementation Phases
- **Phase 4C2 (Bhavcopy State Refactor):** Refactor `bhavcopy.rs` to rely exclusively on `download_log` (or a new `imported_dates` table) instead of checking `eod_prices` for existing data coverage.
- **Phase 4C3 (Storage Mode Flag):** Introduce a `storage_mode` property (e.g., `hybrid` vs `binary`) in `database.json` or SQLite `settings`. Update all dual-write/dual-delete flows to skip `eod_prices` if `storage_mode == 'binary'`.
- **Phase 4C4 (Read Paths & UI):** Update `get_eod_data`, `list_quotes`, and `load_db_stats` to skip SQLite fallback if `storage_mode == 'binary'`. Hide the Parity Audit UI for binary-only databases.
- **Phase 4C5 (Fresh Database Creation):** Modify the "New Database" flow to initialize with `storage_mode: 'binary'` and skip creating the `eod_prices` table entirely.

### Validation
- No files were modified during this audit.
- No frontend/backend logic was changed.