# SRC1: Bhavcopy Source URL Configurability Audit

## 1. Summary
This audit investigates how NSE and BSE Bhavcopy source URLs/templates are defined in the EOD Charting Platform. Currently, all URLs are hardcoded as constants or generated via template functions within the Rust backend. The goal is to design a safe mechanism for users to override these URLs/templates from the "Download Bhavcopy" UI to handle future exchange-side changes without requiring an app update.

## 2. Files Inspected
- `src-tauri-shell/src/bhavcopy.rs`: Primary backend logic for URL generation and downloading.
- `src-tauri-shell/src/database/settings.rs`: SQLite-based settings persistence logic.
- `src-tauri-shell/src/database/bootstrap.rs`: Database schema definition (includes `settings` table).
- `src/components/BhavcopyDownloadWindow.tsx`: Frontend UI for bhavcopy downloads.

## 3. Current NSE/BSE/NSE Index Source URL Flow
1. **Trigger**: User selects a download mode and exchanges in the `BhavcopyDownloadWindow`.
2. **Command**: Frontend invokes `download_batch` (indirectly via `download_bhavcopy` or `download_batch` internal logic).
3. **Generation**: Rust backend generates "Candidates" for each date/exchange pair using functions like `generate_nse_candidates`.
4. **Execution**: `download_single` iterates through candidates, attempting to fetch each one using `reqwest`.
5. **Success/Failure**: If a fetch succeeds, the file is parsed and inserted. If all candidates fail, a failure is reported.

## 4. Current Error/Failure Handling
- **Soft Failures (404/Missing)**: Handled gracefully; if all candidates for a date return 404, the date is marked as "skipped" (likely a holiday).
- **Hard Failures (Network/Timeout)**: Reported back to the UI via `onDownloadResult` with the error message.
- **Retry Logic**: `fetch_candidate_bytes` implements a basic retry mechanism (3 retries) with exponential backoff.

## 5. Current Settings Persistence Options
The application already has a `settings` table in the SQLite database:
```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
- **Scope**: Per-database (tied to the active database connection).
- **Existing Key**: `bhavcopy_settings` stores JSON with `exchanges`, `workers`, and `excluded_series`.
- **Recommendation**: Extend the `bhavcopy_settings` JSON to include optional URL override fields.

## 6. Hardcoded URL/Template List
All found in `src-tauri-shell/src/bhavcopy.rs`:

| Source | Hardcoded Template/URL |
| :--- | :--- |
| **NSE Full** | `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{ddmmyyyy}.csv` |
| **NSE CM** | `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{date_key}_F_0000.csv.zip` |
| **NSE Hist (Legacy)** | `https://archives.nseindia.com/content/historical/EQUITIES/{year}/{month}/{filename}` |
| **NSE Hist (New)** | `https://nsearchives.nseindia.com/content/historical/EQUITIES/{year}/{month}/{filename}` |
| **BSE Equity (API)** | `https://api.bseindia.com/BseIndiaAPI/api/EquityBhavcopy/ws/getEquityBhavcopy?date={date_key}` |
| **BSE Equity (CSV)** | `https://www.bseindia.com/download/BhavCopy/Equity_Bhavcopy_{date_key}.csv` |
| **NSE Index** | `https://nsearchives.nseindia.com/content/indices/ind_close_all_{ddmmyyyy}.csv` |
| **BSE Index** | `https://www.bseindia.com/download/BhavCopy/Index_Bhavcopy_{date_key}.csv` |

## 7. Risk Assessment
- **Breaking QE3**: Changing URL logic could break the currently stable "Download Bhavcopy" flow.
- **User Error**: Incorrectly formatted templates (e.g., missing `{date_key}`) will lead to 100% download failure.
- **Referer Issues**: Some NSE URLs require a specific `Referer` header (currently hardcoded to `https://www.nseindia.com/`). If the domain changes, this header might also need override support.
- **Scope**: Per-database settings mean a URL change must be applied to every database a user owns.

## 8. Recommended UI Placement
Inside `BhavcopyDownloadWindow.tsx`, add a collapsible "Source Settings" section at the bottom of the left panel (or as a separate "Advanced" tab).
- Fields for:
  - NSE Equities URL Template
  - NSE Indices URL Template
  - BSE Equities URL Template
  - BSE Indices URL Template
- Buttons:
  - "Test" (Attempts to download for current date or a specific test date)
  - "Reset to Defaults" (Clears overrides)

## 9. Recommended Settings Model
Extend `BhavcopySettings` struct in Rust:
```rust
pub struct BhavcopySettings {
    pub exchanges: ExchangeSelection,
    pub workers: u32,
    pub excluded_series: Vec<String>,
    // Optional Overrides
    pub nse_url_template: Option<String>,
    pub nse_index_url_template: Option<String>,
    pub bse_url_template: Option<String>,
    pub bse_index_url_template: Option<String>,
}
```
- **Bundled Defaults**: The hardcoded constants remain as fallback.
- **Optional User Override**: If the field is non-empty, it is used as the primary candidate.
- **Reset to Default**: Simply sets the fields to `None` in the settings JSON.

## 10. Recommended DBS/API/Backend Changes (SRC2)
1. **Extend Structs**: Update `BhavcopySettings` and `StoredBhavcopySettings` in `bhavcopy.rs`.
2. **Update Generation Logic**: Modify `generate_*_candidates` to accept `settings` and prepend the override template if it exists.
3. **New Command**: `test_bhavcopy_source(url_template, date)` to allow users to verify their custom URL before saving.
4. **Header Support**: Consider adding an optional `referer_override` field if domain changes are expected.

## 11. Files Likely to Change in SRC2
- `src-tauri-shell/src/bhavcopy.rs` (Structs, Generation logic, Test command)
- `src/platform/index.ts` (Type definitions)
- `src/components/BhavcopyDownloadWindow.tsx` (UI components for editing and testing)
- `src/components/BhavcopyDownloadWindow.styles.ts` (Styles for new UI elements)

## 12. Manual QA Checklist (SRC2)
- [ ] Verify default downloads still work perfectly (no regression).
- [ ] Enter a custom valid URL for NSE and verify it takes precedence.
- [ ] Enter an invalid URL and verify error reporting.
- [ ] Click "Reset to Defaults" and verify original URLs are restored.
- [ ] Verify settings persist after closing and reopening the window.
- [ ] Verify settings are saved correctly in the SQLite `settings` table.

## 13. Git Status
```
?? SRC1_BHAVCOPY_SOURCE_URL_AUDIT_20260518.md
?? SESSION_LOG_*.md
```
