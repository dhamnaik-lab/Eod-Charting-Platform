# Stability Phase S1D — Heavy Mutators Audit

## 1. Executive Summary

This report documents the findings of the Stability Phase S1D-A Audit, which focused on identifying remaining synchronous Tauri commands that perform heavy or potentially blocking operations.

After resolving `delete_database` blocking (S1B) and DB stats global mutex starvation (S1C/S1C2), the primary remaining cause of application "Not Responding" behavior is **synchronous heavy mutations** (S1A-RISK-003). When users trigger specific data management tasks (like merging symbols or updating massive watchlists), the frontend invokes synchronous Tauri commands. These commands lock the active database and perform extensive SQLite I/O or Binary EOD file I/O directly on the main Tauri thread, causing Windows to mark the UI as frozen.

**Top 5 Synchronous Heavy Command Risks:**
1. `merge_symbols`: P0 - Heavy SQLite transaction + Binary EOD File reads/writes/deletes.
2. `apply_official_watchlist_update`: P1 - SQLite transaction inserting/deleting hundreds of rows.
3. `replace_source_linked_watchlist`: P1 - SQLite transaction replacing entire watchlists.
4. `apply_corporate_action`: P1 - SQLite transaction saving corporate actions and identity history.
5. `upsert_quote` / `delete_quote`: P2 - Re-writes the entire binary file on every quote edit.

**Recommendation:** `merge_symbols` is the highest risk and should be fixed first (S1D-B), followed by the watchlist mutators (S1D-C) and finally the corporate action/quote mutators (S1D-D).

---

## 2. Command Inventory

| Command Name | File Path | Sync/Async | Heavy Work Type | Uses `spawn_blocking`? | Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `merge_symbols` | `database/instrument_mutations.rs` | `pub fn` | SQLite / Binary EOD / Filesystem | No | P0 |
| `apply_corporate_action` | `database/instrument_mutations.rs` | `pub fn` | SQLite | No | P1 |
| `apply_official_watchlist_update`| `database/watchlists.rs` | `pub fn` | SQLite (Bulk Insert/Delete) | No | P1 |
| `replace_source_linked_watchlist`| `database/watchlists.rs` | `pub fn` | SQLite (Bulk Insert/Delete) | No | P1 |
| `upsert_quote` | `database.rs` & `quotes.rs` | `pub fn` | SQLite / Binary EOD | No | P2 |
| `delete_quote` | `database.rs` & `quotes.rs` | `pub fn` | SQLite / Binary EOD | No | P2 |
| `list_quotes` | `database.rs` & `quotes.rs` | `pub fn` | Binary EOD Read (Up to 2000 rows) | No | P2 |
| `import_csv` | `imports.rs` | `pub async fn`| SQLite / CSV Parsing | Yes | Safe |
| `download_bhavcopy` | `bhavcopy.rs` | `pub async fn`| Network / SQLite / Filesystem | Yes | Safe |

---

## 3. High-Risk Findings

### S1D-RISK-001: Synchronous `merge_symbols`
- **Severity**: P0
- **File path**: `src-tauri-shell/src/database/instrument_mutations.rs`
- **Triggering UI action**: User clicks "Merge" in the Database Tools dialog.
- **Blocking mechanism**: Executes a multi-statement SQLite transaction to update `instruments`, `eod_prices`, and `watchlist_items`. Then, if binary mode is active, opens the source `.eod` file, reads all records, opens the target `.eod` file, performs a manual date-based deduplication, rewrites the target `.eod` file, and finally deletes the source `.eod` file.
- **Locking behavior**: Uses `with_active_connection` which locks the global `ActiveDatabaseConnectionState` for the duration of the SQLite transaction.
- **Why it causes Not Responding**: All SQLite queries and binary filesystem I/O happen synchronously on the Tauri main thread.
- **Smallest safe later fix**: Convert `merge_symbols` to `pub async fn`. Read the `active_database_folder` first. Pass it into `tauri::async_runtime::spawn_blocking` and perform the work inside the blocking worker.

### S1D-RISK-002: Synchronous Official Watchlist Updates
- **Severity**: P1
- **File path**: `src-tauri-shell/src/database/watchlists.rs`
- **Functions**: `apply_official_watchlist_update`, `replace_source_linked_watchlist`
- **Triggering UI action**: User updates official index/sector watchlists.
- **Blocking mechanism**: Loops over hundreds of symbols, executing an `INSERT` or `DELETE` statement for each one within an SQLite transaction.
- **Why it causes Not Responding**: SQLite bulk operations block the main thread.
- **Smallest safe later fix**: Convert to `pub async fn` and move the `with_active_connection` + `run_connection_transaction` block into `spawn_blocking`.

---

## 4. Mutation Safety Notes

- **Frontend Contract Stability**: All frontend calls to the backend via `api.mergeSymbols`, `api.applyCorporateAction`, etc., are already awaited `Promise`s. Converting the Rust `pub fn` to `pub async fn` will **not** require any frontend signature changes.
- **UI States**: The frontend components (e.g., `DatabaseToolsDialogs.tsx`) already implement `busy` states (disabling buttons and showing "Merged X rows..."). Double-submit risks are already mitigated on the client.
- **Locking Safety**: The `with_active_connection` helper locks the global DB state. When these commands are moved to `spawn_blocking`, they will still use `with_active_connection`. Because of Phase S1C, this lock is no longer held for long periods by background stats tasks, making it much safer to acquire. However, to prevent `merge_symbols` from starving other commands, the heavy Binary EOD file read/write logic in `merge_symbols_internal` runs *after* the SQLite transaction completes. This is structurally safe but means `merge_symbols` holds the main thread during binary operations. Moving it to `spawn_blocking` fixes the UI freeze immediately.
- **Error Handling**: `AppResult` mapping works identically across `spawn_blocking`. We just use `.await.map_err(|e| e.to_string())??`.

---

## 5. Recommended S1D Fix Plan

To minimize regression risk, I recommend a phased approach rather than a bulk conversion:

- **S1D-B (Highest Risk)**: Fix `merge_symbols` and `apply_corporate_action`.
  - Target: `src-tauri-shell/src/database/instrument_mutations.rs`
- **S1D-C (Watchlists)**: Fix `apply_official_watchlist_update` and `replace_source_linked_watchlist`.
  - Target: `src-tauri-shell/src/database/watchlists.rs`
- **S1D-D (Quotes)**: Fix `upsert_quote`, `delete_quote`, and `list_quotes`.
  - Target: `src-tauri-shell/src/database.rs` and `quotes.rs`

### Fix Pattern Example
For each command, we will apply this pattern:
```rust
#[tauri::command]
pub async fn merge_symbols(app: AppHandle, input: MergeSymbolsInput) -> AppResult<MergeSymbolsResult> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let folder_path = resolve_active_database_folder(&app_handle)?;
        let result = with_active_connection(&app_handle, |connection| {
            merge_symbols_internal(connection, &input, folder_path.as_deref())
        })?
        // ... get snapshot and emit ...
        Ok::<_, String>(result)
    })
    .await
    .map_err(|error| error.to_string())??;
}
```

---

## 6. Validation Plan

After implementing each phase (S1D-B, S1D-C, S1D-D), the following checks must be run:
1. `npm run typecheck:renderer` (Validates frontend APIs remain stable)
2. `npm run tauri:check` (Validates Rust async borrowing and compilation)
3. `npm run test` (Validates core logic hasn't broken)
4. **Manual UI Verification**: Trigger a symbol merge or watchlist update to ensure the "Not Responding" freeze is gone and the success toast appears normally.
