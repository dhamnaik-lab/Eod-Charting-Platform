# Session Log - 2026-05-15 - Phase 4C2 Audit

## Task: Bhavcopy State Refactor Audit (Phase 4C2)

### Goal
Prepare `bhavcopy.rs` for a binary-only OHLCV storage mode by decoupling import state checks from the SQLite `eod_prices` table.

### Files Inspected
- `src-tauri-shell/src/bhavcopy.rs`
- `src-tauri-shell/src/database/bootstrap.rs`

### Bhavcopy State Dependencies on `eod_prices`
The following functions in `bhavcopy.rs` currently query `eod_prices` to determine the download/import strategy:

1.  **`has_imported_rows_for_date`**: Used during `process_download_task` to skip downloads if data already exists. It specifically checks for *any* row in `eod_prices` for the given date and exchange.
2.  **`get_latest_imported_trade_date`**: Used in `DownloadMode::Update` to find the starting point for the update range. It queries `MAX(date)` from `eod_prices`.
3.  **`load_imported_trade_dates`**: Used in `DownloadMode::Update` and `FullHistory` to pre-filter dates that are already present in the database.
4.  **`has_stale_zero_volume_rows_for_date`**: Specific to NSE; it checks if `eod_prices` has rows for a date but all volumes are zero, indicating a need for a "refresh" download (common for NSE T+0 data).

### Current `download_log` Schema
```sql
CREATE TABLE IF NOT EXISTS download_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_date TEXT NOT NULL,
  exchange TEXT NOT NULL DEFAULT 'NSE',
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  downloaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'ok',
  note TEXT, -- Added via ensure_column
  UNIQUE (trade_date, exchange)
);
```

### Analysis & Recommendations

**1. Reliability of `download_log`**
The `download_log` table is highly reliable because it is updated within the same transaction (or immediately after) a successful bhavcopy import. However, it currently reflects "attempts" more than "coverage."

**2. The `eod_prices` vs `download_log` Gap**
Checking `eod_prices` is currently the "ultimate truth" because if a user manually deletes records or if a previous import was partially corrupted (SQLite-only), `eod_prices` accurately reflects the *current* state. `download_log` only reflects the *history* of imports.

**3. Recommendation: Enhance `download_log` or add `import_coverage`**
For binary-only databases, we **must** avoid scanning `.eod` files. I recommend transitioning `download_log` to be the primary source of truth for "active coverage."

**4. Proposed Future Behavior**
- **New Databases:** Set a flag (e.g., `coverage_mode = 'metadata'`). All state checks will bypass `eod_prices` and use `download_log`.
- **Hybrid Databases:** Continue using `eod_prices` for state checks to ensure 100% accuracy with existing SQLite data.

**5. Implementation Steps for `bhavcopy.rs`**
- **Step 1**: Modify `has_imported_rows_for_date` to accept a `metadata_only` flag. If true, query `download_log` where `status = 'ok' AND rows_inserted > 0`.
- **Step 2**: Modify `get_latest_imported_trade_date` to query `MAX(trade_date)` from `download_log` where `status = 'ok'`.
- **Step 3**: Modify `load_imported_trade_dates` to query `trade_date` from `download_log`.
- **Step 4**: **Risk Mitigation for NSE T+0**: Since `download_log` doesn't track if volume was zero (stale data), we should add a `max_volume` column to `download_log` or a `is_stale` flag.

### Risks and Mitigations
- **Risk**: `download_log` might say `ok` but the `.eod` file was manually deleted from disk.
- **Mitigation**: The Parity Audit (now read-only) or a "Verify Integrity" action can sync `download_log` with actual disk state.
- **Risk**: Manual Quote Editor changes (adding a single bar) aren't logged in `download_log`.
- **Mitigation**: `download_log` is for *bulk bhavcopy coverage*. Single manual edits shouldn't necessarily shift the "Update" mode start date unless we want them to. Usually, Bhavcopy flow is the "system of record" for date coverage.

### Validation
- No files were modified.
- Analysis confirms that `download_log` is a viable replacement for `eod_prices` state checks if slightly enhanced.
