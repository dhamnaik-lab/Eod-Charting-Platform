# QE3-C NSE Index Already-Downloaded / Missing Binary Data Audit

## 1. Executive Summary
- **Most Likely Root Cause**: 
    1. **Blind Trust in Download Log**: The skip logic in `process_download_task` (and specifically `metadata_has_imported_rows_for_date`) blindly trusts the `download_log` table in SQLite. It does not verify if the actual Binary `.eod` files for the relevant symbols exist or contain data for that date.
    2. **Incomplete Refresh Logic for Indices**: The existing fix that re-downloads dates with `max_volume = 0` is hardcoded to only apply to the `NSE` exchange. `NSE_INDEX` is excluded from this logic, meaning index downloads with zero volume are permanently skipped once logged.
    3. **Silenced Binary Write Failures**: In `parse_and_insert`, failures to write to Binary `.eod` files are caught and printed to `stderr` but do not prevent the `download_log` from being marked as successful (`status = 'ok'`).
- **Severity**: High (Data gap that cannot be fixed by the user without manual database manipulation).
- **Type**: Backend logic bug (Data integrity/Sync between Log and Storage).

## 2. Video-Based Reproduction
- **Active Chart**: `NSE_INDEX:NIFTY` (Binary mode).
- **Current State**: Data exists up to 2026-05-13.
- **Action**: Download NSE Index for 2026-05-14 to 2026-05-17.
- **Observation**: 
    - 2026-05-14 and 2026-05-15 are skipped as **"Already downloaded"**.
    - `rows_inserted: 0`.
    - After restart, `NIFTY` is still stuck at 2026-05-13.
- **Inference**: The `download_log` table contains entries for 2026-05-14/15 for `NSE_INDEX` with `rows_inserted > 0`, but the actual `NIFTY.eod` file was never updated for those dates (possibly due to a previous `Hybrid` mode run or a failed `Binary` write).

## 3. Download History / Skip Logic Audit
- **History Store**: SQLite table `download_log` (columns: `trade_date`, `exchange`, `rows_inserted`, `max_volume`, `status`).
- **Skip Logic**: `process_download_task` in `src-tauri-shell/src/bhavcopy.rs` queries `download_log`.
- **Finding**: The skip logic **blindly trusts** the log. It does not check if the storage mode has changed (e.g. from Hybrid to Binary) or if the specific symbol being viewed has the data.
- **Date Range Mode**: Even in `Date Range` mode, `process_download_task` checks the log and returns "Already downloaded" if an entry exists, effectively preventing a manual "Force Refresh" via the UI.

## 4. NSE Index Write Path Audit
- **Exchange Mapping**: `NSE Index` UI selection -> `NSE_INDEX` backend string.
- **Normalization**: `normalize_exchange_key("NSE_INDEX")` -> `NSEINDEX`. This is used for holiday checks but NOT for folder names.
- **Binary Path**: `eod_data/NSE_INDEX/NIFTY.eod`.
- **Finding**: The paths used for writing (`bhavcopy.rs`) and reading (`eod_data.rs`) are consistent (`NSE_INDEX`).
- **Symbol Mapping**: `map_index_symbol` correctly maps "NIFTY 50" (normalized to `NIFTY50`) to `NIFTY`.

## 5. Database/Portable State Audit
- **Scope**: `download_log` is stored inside the active database's SQLite file (`market-data.sqlite3`).
- **Inheritance**: If a user creates a "New Binary Database" but it's based on an existing folder or if they switched from `Hybrid` mode, the `download_log` might contain entries that are not reflected in the new storage layout.
- **Stale History**: If `BinaryEodFile::append_or_merge_records` fails (e.g. file locked), the log is still marked `ok`. Future attempts to fix the gap by re-downloading will be skipped.

## 6. Root Cause Candidates

### QE3-C-RISK-001: Skip logic trusts Log over Storage
- **Likelihood**: High
- **Evidence**: `metadata_has_imported_rows_for_date` only queries `download_log`.
- **Smallest safe fix**: In `Binary` mode, the skip logic should optionally check if the symbol's `.eod` file actually contains the date, OR allow `Date Range` mode to bypass the log check.

### QE3-C-RISK-002: `NSE_INDEX` missing from zero-volume refresh fix
- **Likelihood**: High
- **Evidence**: `metadata_has_stale_zero_volume_rows_for_date` explicitly excludes non-`NSE` exchanges.
- **Smallest safe fix**: Allow `NSE_INDEX` (and `BSE_INDEX`) to participate in the zero-volume refresh logic.

### QE3-C-RISK-003: Silenced Binary write failures
- **Likelihood**: High
- **Evidence**: `parse_and_insert` prints to `stderr` but doesn't propagate error or decrement `rows_inserted` when `append_or_merge_records` fails.
- **Smallest safe fix**: Propagate binary write errors so the `download_log` is marked as `error` instead of `ok`.

## 7. Recommended Fix Plan (QE3-D)
A mixed approach is recommended:

1. **QE3-D1 (Critical)**: Update `metadata_has_stale_zero_volume_rows_for_date` to include `NSE_INDEX`. This will allow dates with 0 max volume (common in partial/corrupt index downloads) to be re-downloaded.
2. **QE3-D2 (Critical)**: In `process_download_task`, if `mode == DownloadMode::Range`, **bypass the "Already downloaded" skip**. This gives the user a "Force Redownload" escape hatch by manually selecting the date range.
3. **QE3-D3 (Hardening)**: Propagate binary write errors in `parse_and_insert` so the log accurately reflects failures.
4. **QE3-D4 (Safety)**: In `Binary` mode, consider clearing `download_log` entries for a date if a validation check shows the `.eod` file is missing data for that date.

## 8. Validation Plan
1. **Manual Log Check**: Inspect `download_log` in the user's DB for `2026-05-14` / `NSE_INDEX`.
2. **Implementation**: Apply QE3-D2 (bypass skip in Range mode).
3. **Test**:
    - Open `NIFTY` (Daily).
    - Select `NSE Index` for 2026-05-14 to 15 in `Date Range` mode.
    - Confirm the downloader **does not** skip with "Already downloaded".
    - Confirm rows are inserted and `NIFTY.eod` is updated.
    - Confirm Quote Editor and Chart show data for 14th/15th.
