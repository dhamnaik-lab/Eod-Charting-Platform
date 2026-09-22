# Stability Phase S1D-E — Quote Edit/Delete Audit

## 1. Executive Summary

This report documents the findings of the S1D-E Audit, focusing on the blocking risks of the `upsert_quote` and `delete_quote` Tauri commands. 

Both commands are currently synchronous (`pub fn`), executing heavy SQLite operations (including `prev_close` recomputation across all rows for a symbol) and full binary `.eod` file read/rewrites directly on the main Tauri thread. They hold the global `ActiveDatabaseConnectionState` lock for the duration of the SQLite transaction.

**Risk Severity:** P2
While less globally disruptive than merging symbols or updating massive watchlists, manual quote edits/deletes are common user actions that cause noticeable "Not Responding" UI micro-freezes.

**Recommendation:** A direct async conversion (Phase S1D-F) using `spawn_blocking` and the temporary SQLite connection pattern is the most effective and immediate fix. Deeper partial-update designs for the binary format are unnecessary for manual, single-record edits.

---

## 2. Command Flow Inventory

### `upsert_quote`
- **File path**: `src-tauri-shell/src/database.rs` -> `src-tauri-shell/src/database/quotes.rs`
- **Signature**: `pub fn` (Synchronous)
- **Frontend Trigger**: `tauriInvoke('upsert_quote', { input })` in `src/platform/tauriDesktop.ts`, called by the Quote Editor component.
- **Backend Internal**: `upsert_quote_internal`
- **Storage Mode Behavior**: Dual-writes. Always mutates SQLite `eod_prices` (Legacy/Hybrid) and if binary mode is active (base path resolved), writes to the `.eod` file.
- **Snapshot/Event**: Generates an `AppSnapshot` (without stats/watchlists) and calls `emit_database_changed`, which triggers frontend reloads.
- **Cache Invalidation**: Currently **does not** invalidate `db_stats_cache`.
- **Lock Behavior**: Uses `with_active_connection`, holding the global database lock during the SQLite transaction.

### `delete_quote`
- **File path**: `src-tauri-shell/src/database.rs` -> `src-tauri-shell/src/database/quotes.rs`
- **Signature**: `pub fn` (Synchronous)
- **Frontend Trigger**: `tauriInvoke('delete_quote', { input })` in `src/platform/tauriDesktop.ts`, called by the Quote Editor component.
- **Backend Internal**: `delete_quote_internal`
- **Storage Mode Behavior**: Dual-writes. Always mutates SQLite `eod_prices` (Legacy/Hybrid) and if binary mode is active, deletes from the `.eod` file.
- **Snapshot/Event**: Generates an `AppSnapshot` (without stats/watchlists) and calls `emit_database_changed`.
- **Cache Invalidation**: Currently **does not** invalidate `db_stats_cache`.
- **Lock Behavior**: Uses `with_active_connection`, holding the global database lock during the SQLite transaction.

---

## 3. Binary EOD Behavior

In Binary mode, manual quote mutations interact with `.eod` files (`BinaryEodFile`):
- **Read**: Yes. `delete_record_by_date` reads the full file. `append_or_merge_records` reads the full file if the date being upserted is not strictly greater than the last recorded date (i.e., a historical edit).
- **Rewrite**: Yes. If records are modified or deleted, the full file is rewritten via an atomic `write_all` (writes to a `.tmp` file, flushes, and renames). Fast append is only used for sequential trailing additions.
- **Atomic Write**: Yes, using `.tmp` files and `fs::rename`.
- **Sorting/Dedupe**: Yes, `append_or_merge_records` sorts by date and handles deduplication before rewriting.
- **`prev_close`**: Recomputed inside SQLite (`recompute_prev_close_for_symbol`) by ordering all rows by date, and then the updated `prev_close` is written to the Binary EOD file.
- **Volume/OI**: Preserved during edits if not explicitly changed.
- **Missing/Corrupt**: If the binary file does not exist, `append_or_merge_records` creates it. If `delete_record_by_date` finds no file, it gracefully does nothing.
- **SQLite Fallback**: The commands rely on SQLite as the primary source of truth for the transaction and recomputing fields, then project that row to the binary file.

---

## 4. Blocking Risk Findings

### S1D-E-RISK-001: Synchronous `upsert_quote`
- **Severity**: P2
- **File Path**: `src-tauri-shell/src/database.rs`
- **Function**: `upsert_quote`
- **Trigger**: User clicks "Save" in Quote Editor.
- **Blocking Mechanism**: Synchronous SQLite transaction, `prev_close` full-symbol recomputation, and full binary file read/write.
- **Locking Behavior**: Global connection lock held during SQLite phase.
- **Why it causes Not Responding**: All I/O occurs on the main Tauri thread.
- **Smallest Safe Fix**: Convert to `pub async fn`, use `spawn_blocking` and a temporary connection.

### S1D-E-RISK-002: Synchronous `delete_quote`
- **Severity**: P2
- **File Path**: `src-tauri-shell/src/database.rs`
- **Function**: `delete_quote`
- **Trigger**: User clicks "Delete" in Quote Editor.
- **Blocking Mechanism**: Synchronous SQLite transaction, `prev_close` full-symbol recomputation, and full binary file read/write.
- **Locking Behavior**: Global connection lock held during SQLite phase.
- **Why it causes Not Responding**: All I/O occurs on the main Tauri thread.
- **Smallest Safe Fix**: Convert to `pub async fn`, use `spawn_blocking` and a temporary connection.

---

## 5. Safe Fix Recommendation

**Recommendation: A. Simple S1D-F async/spawn_blocking conversion using temporary connection.**

**Reasoning:**
The workload for a single symbol (even rewriting 10,000 records in a binary file and executing SQLite updates) is very fast (single-digit milliseconds), but doing it synchronously blocks the UI thread and holds the global DB lock, risking stuttering. By shifting this exact workload into `spawn_blocking` with a temporary connection (matching the S1D-B/C/D pattern), we completely resolve the UI freeze and lock contention without needing to fundamentally redesign how the binary system handles partial updates.

---

## 6. Proposed S1D-F Implementation Plan

- **Target Commands**: `upsert_quote` and `delete_quote` in `src-tauri-shell/src/database.rs`.
- **Files to Change**: `src-tauri-shell/src/database.rs`.
- **Strategy**: 
  1. Change both to `pub async fn`.
  2. Use `tauri::async_runtime::spawn_blocking`.
  3. Resolve database folder and use `open_connection_for_folder`.
  4. Call `upsert_quote_internal` / `delete_quote_internal`.
  5. Preserve the `get_app_snapshot_internal` and `emit_database_changed` calls exactly as they are currently implemented.
  6. **Cache**: To be fully correct, we *should* invalidate `db_stats_cache` because adding/deleting quotes changes the total row count and min/max dates. We will add `invalidate_cached_db_stats`.

---

## 7. Validation Plan

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run test` (Crucial: Vitest tests cover quote logic)
- `cargo test` (Runs Rust unit tests for quotes and binary EOD)
- `npm run build`
- **Manual Testing**:
  - Open a Binary database.
  - Edit a quote and verify the chart reloads and shows the new price.
  - Delete a quote and verify it disappears from the chart and quote editor list.
