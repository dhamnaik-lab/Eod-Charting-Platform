# QE3-A Bhavcopy Import Active Chart Refresh Audit

## 1. Executive Summary
- **Most Likely Root Cause**: 
    1. **Missing Backend Event**: The backend commands `download_bhavcopy_batch` and `import_csv` do not emit the `db:changed` event upon completion.
    2. **Stale Frontend Cache**: Because `db:changed` is missing, the `chartStore`'s `instrumentDataCache` remains populated with stale data for already-loaded symbols.
    3. **Missing Active Refresh**: The frontend import/download UI components do not trigger a `loadInstrument` with `forceReload: true` after completion, leaving the active `ChartEngine` with old in-memory bars.
- **Severity**: Medium (User confusion; requires manual symbol switch or app restart to see new data).
- **Type**: Mixed (Backend missing events, Frontend missing refresh orchestration).

## 2. Reproduction Flow
1. Open NIFTY chart (NIFTY bars are loaded and cached in `instrumentDataCache`).
2. Open `BhavcopyDownloadWindow` and download data including a newer NIFTY date.
3. Import completes successfully (data is updated on disk in SQLite/Binary).
4. **Observation**: NIFTY chart remains stale, showing the old latest date.
5. Switch to a previously unloaded symbol (e.g. RELIANCE): Shows updated data (fetched fresh).
6. Switch back to NIFTY: Shows stale data (hit `instrumentDataCache`).
7. Restart app: Shows updated NIFTY data (cache is cold).

## 3. Backend Import/Event Audit
- **Files**: `src-tauri-shell/src/bhavcopy.rs`, `src-tauri-shell/src/imports.rs`
- **Commands**: `download_bhavcopy`, `download_bhavcopy_batch`, `import_csv`.
- **Finding**: None of these commands call `emit_database_changed`.
- **Mutation logic**: 
    - `bhavcopy.rs` calls `parse_and_insert` which writes to SQLite and Binary.
    - `imports.rs` calls `import_single_file` which writes to SQLite and Binary.
- **Event Emission**: Only `bhavcopy:progress`, `bhavcopy:result`, and `import:progress` are emitted. These are used for UI feedback in the dialogs but don't signal database state changes to the rest of the app.

## 4. Frontend Import Flow Audit
- **Files**: `src/components/BhavcopyDownloadWindow.tsx`, `src/features/workspace/chartRuntimeController.ts`
- **Logic**:
    - `BhavcopyDownloadWindow.tsx` calls `api.downloadBhavcopyBatch` directly.
    - It does not use `chartStore`'s `triggerDownload` (which is in `chartRuntimeController.ts`).
    - Even if it did, `chartRuntimeController.triggerDownload` calls `refreshSnapshot`, but `refreshSnapshot` only updates `dbStats` and `watchlists`.
- **Result**: The UI reports success, but no signal is sent to the active chart(s) to invalidate their specific bar data and reload.

## 5. Chart Cache/Engine Audit
- **Files**: `src/features/charts/chartInstrumentHydrationService.ts`, `src/store/chartStore.ts`
- **Cache**: `instrumentDataCache` is a `Map` in `chartStore`. It is only cleared when `db:changed` is received.
- **Engine**: `ChartEngine` holds `OHLCBar[]` in memory. It only updates when the `displayBars` prop in `ChartCanvas.tsx` changes (which happens when `chartStore` state updates).
- **Finding**: Without a `db:changed` event, the cache is never cleared. Without a `loadInstrument` call, the `chartStore` state for the active tab never updates, so the engine never receives new bars.

## 6. Root Cause Candidates

### QE3-A-RISK-001: Missing `db:changed` from Backend
- **Likelihood**: High
- **Evidence**: `src-tauri-shell/src/bhavcopy.rs` and `imports.rs` lack calls to `emit_database_changed`.
- **Smallest safe fix**: Add `emit_database_changed` call to the end of successful import/download batch commands.

### QE3-A-RISK-002: `refreshSnapshot` does not reload active chart
- **Likelihood**: Medium
- **Evidence**: `chartRuntimeController.ts` only refreshes `dbStats` and `watchlists` in `refreshSnapshot`.
- **Smallest safe fix**: Update `refreshSnapshot` or the `db:changed` listener to trigger a `loadInstrument` for the active symbol(s) if the database has changed.

### QE3-A-RISK-003: `BhavcopyDownloadWindow` bypasses store orchestration
- **Likelihood**: Medium
- **Evidence**: `BhavcopyDownloadWindow.tsx` calls the API directly instead of using a store method that coordinates the refresh.
- **Smallest safe fix**: Add a post-download refresh call in `BhavcopyDownloadWindow.tsx` or move the logic into a store-managed controller.

## 7. Recommended Fix Plan (QE3-B)
A mixed approach is recommended for robustness:

1. **Backend**: Update `download_bhavcopy_batch` and `import_csv` to call `emit_database_changed` after a successful mutation. This ensures that *any* part of the app (sidebar, stats, etc.) knows the data has changed.
2. **Frontend (Store)**: Update the `onDatabaseChanged` listener in `chartRuntimeController.ts` to reload the active instrument(s) after clearing the cache.
   - Specifically: `deps.clearInstrumentDataCache(); ... void loadActiveInstruments(true);`
3. **Frontend (UI)**: Add an explicit call to `refreshSnapshot({ refreshDbStats: true })` in `BhavcopyDownloadWindow.tsx` and `ImportCsvDialog.tsx` after success, just in case the backend event is delayed (similar to the QE2-F2 race condition fix).

## 8. Validation Plan
- **Pre-check**: `npm run typecheck:renderer`, `npm run tauri:check`.
- **Manual Test**:
    1. Open NIFTY.
    2. Download Bhavcopy for the current day.
    3. Confirm NIFTY chart updates bars automatically without switching symbols.
    4. Confirm DB Stats (total records) also updates.
    5. Switch symbols and confirm they load correctly from the updated database.
