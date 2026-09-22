# QE2_QUOTE_EDITOR_DELETE_AUDIT.md

## 1. Executive Summary
The Quote Editor "Delete" functionality fails in Binary storage mode because the backend logic incorrectly skips the binary file deletion if no matching row is found in the SQLite database. Additionally, a race condition or error-swallowing behavior in the `list_quotes` command causes the UI to receive an empty list of quotes after the failed deletion attempt, leading to a full UI reset and clearing of all rows.

- **Primary Root Cause:** Backend logic bug in `delete_quote_internal` where dual-deletion from binary files is conditional on a non-zero SQLite deletion count.
- **Secondary Root Cause:** `list_quotes` command silently returns an empty array instead of an error if the database connection is temporarily unavailable or if an error occurs during binary file access.
- **Severity:** High. Deletion is broken in the primary performance mode (Binary), and the UI behavior is confusing to the user.

## 2. Reproduction Flow From Video
1. **Initial State:** User loads symbol `NSE_INDEX:NIFTY`. 89 rows are loaded into the table.
2. **Selection:** User selects the latest row (Date: `2026-05-15`).
3. **Action:** User clicks "Delete" button.
4. **Backend Execution:**
   - `delete_quote` is invoked.
   - `delete_quote_internal` attempts to delete from SQLite table `eod_prices`.
   - In Binary mode, this quote likely only exists in the `.eod` file, so SQLite returns `deleted = 0`.
   - Backend skips `BinaryEodFile::delete_record_by_date` because `deleted` is not `> 0`.
   - Backend returns `success: false`.
5. **Frontend Reaction:**
   - `deleteQuoteRow` continues execution and calls `api.listQuotes`.
   - `list_quotes` (backend) returns `[]` (empty array), likely due to a race condition with `db:changed` events or a silent error in file access.
   - Frontend calls `setQuotes([])`, clearing the table (0 rows).
   - Frontend calls `createEmptyQuoteForm()`, resetting the form date to today (`2026-05-17`).
   - Frontend sets status message: "No matching quote was deleted."

## 3. Frontend Flow Audit
- **File:** `src/components/DatabaseToolsDialogs.tsx`
- **Function:** `deleteQuoteRow` (L203-231)
- **State Variables:** `quotes`, `selectedDate`, `form`, `status`.
- **Logic Issues:**
  - `listQuotes` is called immediately after `deleteQuote` regardless of whether the deletion was successful.
  - If `rows` is empty, the UI unconditionally resets the form via `createEmptyQuoteForm()`, which explains the date change to `2026-05-17`.
  - Buttons have `type="button"`, so no implicit form submission is occurring.
- **Payload Construction:**
  ```typescript
  const payload = {
    symbol: symbol.trim().toUpperCase(),
    exchange: exchange.trim().toUpperCase() || 'NSE',
    date: selectedDate, // "YYYY-MM-DD"
  };
  ```
  This payload correctly identifies the row to be deleted.

## 4. Backend Flow Audit
- **File:** `src-tauri-shell/src/database/quotes.rs`
- **Function:** `delete_quote_internal` (L250-291)
- **Critical Logic Bug:**
  ```rust
  if deleted > 0 { // 'deleted' is count from SQLite
      // Dual-delete from Binary EOD
      if let Some(folder_path) = base_path {
          // ... BinaryEodFile::delete_record_by_date called here ...
      }
  }
  ```
  In Binary mode, we *expect* records to be missing from SQLite. The condition `if deleted > 0` prevents deletion from the binary file if the record isn't also in SQLite.
- **File:** `src-tauri-shell/src/database.rs`
- **Function:** `list_quotes` (L485-492)
- **Silent Error Bug:**
  ```rust
  with_active_connection(&app, |connection| {
      list_quotes_internal(connection, &input, folder_path.as_deref())
  })
  .map(|value| value.unwrap_or_default()) // <--- BUG: returns [] if connection is missing
  ```
  This command swallows connection issues and returns an empty list, which misleads the frontend into thinking all data is gone.

## 5. Root Cause Candidates

### QE2-RISK-001: Backend skips binary delete if SQLite count is zero
- **Likelihood:** High (Verified by code review).
- **Type:** Backend.
- **Evidence:** `src-tauri-shell/src/database/quotes.rs` line 278: `if deleted > 0`.
- **Fix:** Change logic to attempt binary deletion regardless of SQLite count if in Binary/Hybrid mode, or check for presence in binary.

### QE2-RISK-002: `list_quotes` returns `[]` on connection/logic errors
- **Likelihood:** High (Verified by code review).
- **Type:** Backend.
- **Evidence:** `src-tauri-shell/src/database.rs` line 491: `.map(|value| value.unwrap_or_default())`.
- **Fix:** Ensure `list_quotes` returns an `Err` if the connection is missing or if `list_quotes_internal` fails.

### QE2-RISK-003: UI Reset on empty row list
- **Likelihood:** Medium (Verified by code review).
- **Type:** Frontend.
- **Evidence:** `src/components/DatabaseToolsDialogs.tsx` line 224: `setForm(createEmptyQuoteForm())` called when `rows` is empty.
- **Fix:** Avoid resetting the form to "today's date" if a load/refresh fails; keep previous state or show an error state.

## 6. Recommended Fix Plan
Recommend a two-phase fix:

1. **QE2-F1 (Backend Hardening):**
   - Update `delete_quote_internal` to attempt binary deletion regardless of SQLite result.
   - Refactor `list_quotes` and similar commands in `database.rs` to stop using `unwrap_or_default()` on connection results; return proper errors.
   - Improve `list_quotes_internal` to return errors from `BinaryEodFile::open` instead of skipping.

2. **QE2-F2 (Frontend Ergonomics):**
   - Update `deleteQuoteRow` to only clear the table/form if the symbol actually has 0 quotes or if an error occurs.
   - Add better error messaging if `listQuotes` returns 0 rows for a symbol that previously had data.

## 7. Validation Plan For Future Fix
- Run `npm run typecheck:renderer` and `npm run tauri:check`.
- **Manual Test Scenario:**
  1. Open a Binary-mode database.
  2. Load a symbol (e.g., NIFTY) with existing quotes.
  3. Select the latest quote.
  4. Click "Delete".
  5. **Verify:** Status says "Deleted 2026-05-15".
  6. **Verify:** Table reloads and shows 88 rows.
  7. **Verify:** Next available row (2026-05-14) is automatically selected.
  8. **Verify:** Binary `.eod` file size decreases or metadata (last date) updates.
  9. **Verify:** Re-load symbol to confirm deletion is persistent.
