# Stability Phase S1A — App-Wide Not Responding / Main-Thread Blocking Audit

## 1. Executive Summary

The observed "Not Responding" freezes in the EOD Charting Platform are primarily caused by **lock contention leading to main-thread starvation**, combined with **direct main-thread blocking** on certain heavy filesystem operations. 

While heavy tasks like `get_db_stats`, `download_bhavcopy`, and `get_eod_data` correctly use Tauri's asynchronous `spawn_blocking` to avoid blocking the main thread directly, they interact poorly with a global database Mutex. The global connection cache lock (`ActiveDatabaseConnectionState::cached`) is held for the *entire duration* of database operations. When a background thread holds this lock for seconds (e.g., scanning 5000+ `.eod` files for stats), any subsequent synchronous UI command (like searching symbols or fetching watchlists) hits the locked Mutex and completely freezes the Tauri main thread.

Furthermore, `delete_database` uses a fully synchronous filesystem deletion (`fs::remove_dir_all`) directly on the main thread, causing an immediate app freeze when deleting large Binary EOD databases.

### Top 3 Highest-Risk Paths:
1. **`delete_database`**: Synchronous directory deletion blocks the main thread.
2. **`get_db_stats` / `get_all_binary_stats`**: Background thread holds the global database lock for seconds while scanning 5000+ `.eod` files, freezing any new UI interactions.
3. **Synchronous Data Mutators**: Heavy commands like `merge_symbols`, `apply_official_watchlist_update`, and `list_quotes` are currently synchronous and block the main thread directly.

---

## 2. Current Architecture Findings

- **Tauri Commands**: Many commands are correctly marked `pub async fn` and use `tauri::async_runtime::spawn_blocking` (e.g., `get_app_snapshot`, `get_db_stats`, `import_csv`, `download_bhavcopy`, `get_eod_data`, `validate_binary_parity`).
- **Synchronous Commands**: A large number of database and settings commands are `pub fn` (synchronous). This includes `delete_database`, `close_database`, `list_quotes`, `merge_symbols`, `apply_corporate_action`, and all watchlist operations.
- **Global Lock**: The `with_active_connection` and `with_connection_for_folder` helpers lock the `ActiveDatabaseConnectionState` Mutex and pass a reference to the inner connection to a closure. The Mutex is held until the closure finishes. This means only one database operation can run at a time across the entire application, and synchronous UI commands will block waiting for background tasks to finish.

---

## 3. High-Risk Blocking Paths

### S1A-RISK-001: Synchronous Database Deletion
- **Severity**: P0
- **File path**: `src-tauri-shell/src/database/connection_registry.rs`
- **Function**: `delete_database` (Lines 199-232)
- **Triggering UI action**: User selects "Delete Database..." from Command Palette or Settings.
- **Blocking mechanism**: Calls `fs::remove_dir_all(&folder_path)` synchronously on the main thread.
- **Why it causes "Not Responding"**: Deleting thousands of `.eod` files takes time on Windows. The Tauri event loop cannot process messages, causing the OS to mark the window as unresponsive.
- **Root Cause Type**: Filesystem / Main-thread block.
- **Fix Recommendation**: Convert to `pub async fn` and wrap the `fs::remove_dir_all` call in `tauri::async_runtime::spawn_blocking`.

### S1A-RISK-002: Global Mutex Starvation via DB Stats
- **Severity**: P0
- **File path**: `src-tauri-shell/src/database/connection_registry.rs` and `src-tauri-shell/src/database/binary_eod.rs`
- **Function**: `get_or_load_cached_db_stats` and `get_all_binary_stats`
- **Triggering UI action**: App startup, dashboard load, or opening a database.
- **Blocking mechanism**: `get_or_load_cached_db_stats` locks the connection Mutex. It then calls `load_db_stats`, which calls `get_all_binary_stats`. This reads the header of every `.eod` file on disk. 
- **Why it causes "Not Responding"**: The background thread holds the global lock for seconds. Any concurrent UI interaction that triggers a synchronous command (e.g., `search_symbols`, `list_quotes`, `get_watchlists`) tries to acquire the lock on the main thread and freezes the app.
- **Root Cause Type**: Lock Contention / Filesystem.
- **Fix Recommendation**: Limit the scope of the Mutex lock. Do not hold the global connection cache lock while performing long filesystem walks (`get_all_binary_stats`). Clone the path/state needed and run the filesystem walk outside the lock.

### S1A-RISK-003: Synchronous Heavy Mutators
- **Severity**: P1
- **File path**: `src-tauri-shell/src/database/instrument_mutations.rs`, `src-tauri-shell/src/database/quotes.rs`, `src-tauri-shell/src/database/watchlists.rs`
- **Function**: `merge_symbols`, `apply_corporate_action`, `list_quotes`, `apply_official_watchlist_update`
- **Triggering UI action**: Merging symbols, applying splits, viewing large quote lists, replacing watchlists.
- **Blocking mechanism**: These are `pub fn` and run directly on the Tauri main thread, performing hundreds of SQLite queries or dual-writes to Binary EOD.
- **Why it causes "Not Responding"**: Direct CPU/SQLite blocking on the main thread.
- **Root Cause Type**: SQLite / Filesystem / Main-thread block.
- **Fix Recommendation**: Convert to `pub async fn` and wrap the work in `spawn_blocking`.

---

## 4. Delete Database Path Audit

**Trace:**
1. **Frontend**: `DeleteDatabaseDialog.tsx` calls `api.deleteDatabase(dbPath)` on confirm.
2. **Invoke**: `tauriDesktop.ts` maps this to `tauriInvoke('delete_database')`.
3. **Backend Command**: `delete_database` in `connection_registry.rs`.
4. **Execution**: The command runs on the main Tauri thread (because it is `pub fn`). It removes the active registry entry, clears the connection cache, and synchronously calls `fs::remove_dir_all`.
5. **Issues**: No progress state exists. The UI thread is entirely blocked. No locks are held during the delete itself, but the filesystem I/O blocks the renderer's IPC loop.
6. **Likely freeze cause**: `fs::remove_dir_all` on a folder with ~5000 `.eod` files blocks the main thread for seconds.

---

## 5. Database Stats / Startup / Dashboard Audit

**Trace:**
1. Dashboard mounts and triggers `api.getDbStats()`.
2. Backend `get_db_stats` runs asynchronously in `spawn_blocking`.
3. Calls `get_or_load_cached_db_stats` which locks `state.cached.lock()`.
4. Calls `load_db_stats` in `bootstrap.rs`.
5. Queries `eod_prices` (SQLite) via `GROUP BY`.
6. Calls `get_all_binary_stats` in `binary_eod.rs`.
7. Does a `fs::read_dir` over `eod_data/<exchange>/` and opens *every single `.eod` file* to read the 64-byte header.
8. **Issues**: Extreme lock contention. The global `Connection` Mutex is locked for the entire duration of opening 5000+ files.

---

## 6. Quote Editor / Chart Loading Audit

- **Quote Editor (`list_quotes`)**: Currently a synchronous `pub fn` command. It reads from Binary (`BinaryEodFile::read_latest(limit)`) or SQLite. The default limit is 500-2000. It doesn't walk directories, but doing this synchronously blocks the main thread.
- **Chart Loading (`get_eod_data`)**: Asynchronous with `spawn_blocking`. Safe from blocking the main thread, but uses `with_active_connection`, so it can be blocked by `get_db_stats` holding the lock.

---

## 7. Import / Bhavcopy / Watchlist Audit

- **Import/Bhavcopy**: Both `import_csv` and `download_bhavcopy` use `spawn_blocking` and open their own isolated `Connection::open`. This safely bypasses the global Mutex lock and does not block the UI.
- **Watchlists**: All watchlist commands (create, rename, delete, add, remove, update official) are synchronous `pub fn`. `apply_official_watchlist_update` inserts hundreds of rows synchronously on the main thread.

---

## 8. Renderer Responsiveness Audit

- **Parity Dialog (`JSON.stringify`)**: Exporting a massive parity report calls `JSON.stringify` on the main JS thread. This can cause a minor stutter (50-100ms) but isn't the cause of hard OS freezes.
- **Large Lists**: Watchlist sidebars and quote editors appear to handle rendering limits (e.g., `slice(0, 500)`) preventing massive DOM unresponsiveness.

---

## 9. Recommended Fix Plan

- **Phase S1B (Lock Contention Fix)**:
  - Modify `get_or_load_cached_db_stats` to release the `cached.lock()` before executing the heavy `load_db_stats` filesystem scan. Use an independent connection or just read the binary stats without the global lock.
  - Review `with_connection_for_folder` to determine if SQLite WAL mode allows giving out cloned connections instead of holding a Mutex over a single shared reference.
- **Phase S1C (Delete Database Fix)**:
  - Convert `delete_database` to `pub async fn` and wrap `fs::remove_dir_all` in `spawn_blocking`.
- **Phase S1D (Heavy Mutators Fix)**:
  - Convert `list_quotes`, `merge_symbols`, `apply_corporate_action`, and `apply_official_watchlist_update` to `pub async fn` + `spawn_blocking`.
- **Phase S1E (Dashboard/Stats Optimization)**:
  - Optimize `get_all_binary_stats` to avoid opening 5000 files on every startup. Introduce a binary cache file or rely on SQLite metadata.

---

## 10. Validation Plan For Future Fixes

After applying any fixes from the plan above, run the following verification steps:

1. Static checks:
   ```bash
   npm run typecheck:renderer
   npm run tauri:check
   ```
2. Automated tests:
   ```bash
   npm run test
   cd src-tauri-shell && cargo test
   ```
3. Release Preview Build:
   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\run-release-preview.ps1"
   ```
4. Manual QA: Create a database, open dashboard, trigger delete database, and interact with the UI to verify the main thread remains responsive.