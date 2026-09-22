# QE2_F2_QUOTE_DELETE_CHART_REFRESH_AUDIT.md

## 1. Executive Summary
The chart fails to refresh after a quote is deleted or edited in the Quotations Editor because of a race condition between the backend's data mutation event and the frontend's reload request. The `chartStore` uses an internal `instrumentDataCache` to optimize OHLCV loading. While the backend emits a `db:changed` event to clear this cache, the Quotations Editor triggers a `loadInstrument` request immediately after the API call completes. If this request is processed before the `db:changed` event is received by the frontend, the store hits the stale cache and avoids fetching fresh data from the backend.

- **Most Likely Root Cause:** Race condition where `loadInstrument` hits the stale `instrumentDataCache` before the `db:changed` event listener has cleared it.
- **Issue Type:** Frontend (State Management/Cache logic).
- **Severity:** Medium. Data integrity is maintained on disk, but the UI is misleading until a restart or manual symbol switch.

## 2. Reproduction Flow
1. **Initial State:** User views NIFTY chart. OHLCV data is loaded and cached in `chartStore`.
2. **Action:** User opens Quotations Editor and deletes the latest row (2026-05-15).
3. **Backend:** Deletion succeeds. `delete_quote` emits `db:changed` and returns success.
4. **Frontend (Dialog):** `deleteQuoteRow` receives success, reloads the local quote list, then calls `onReloadInstrument` (which triggers `loadInstrument`).
5. **Frontend (Store):** `loadInstrument` checks the cache. Since the `db:changed` event is still in the Tauri event queue, the cache is still populated with old NIFTY data.
6. **Result:** `loadInstrument` returns the old data from cache. `ChartCanvas` does not see a data change and does not trigger an engine update.
7. **Verification:** Restarting the app clears the in-memory cache, forcing a fresh fetch which reflects the deletion.

## 3. Backend Event Audit
- **Files:** `src-tauri-shell/src/database.rs`, `src-tauri-shell/src/database/quotes.rs`
- **Behavior:**
  - `upsert_quote` and `delete_quote` both correctly call `emit_database_changed` before returning.
  - `emit_database_changed` uses `app.emit("db:changed", ...)` which is the standard Tauri broadcast mechanism.
  - The backend implementation is correct and follows established patterns for cross-window synchronization.

## 4. Frontend Event/State Audit
- **File:** `src/components/DatabaseToolsDialogs.tsx`
  - `handleSave` and `handleDelete` both call `onReloadInstrument(symbol, exchange)`.
  - This is correct intent, but lacks cache invalidation awareness.
- **File:** `src/store/chartStore.ts`
  - Binds `instrumentDataCache.clear` to `clearInstrumentDataCache`.
- **File:** `src/features/workspace/chartRuntimeController.ts`
  - Listens to `db:changed` and calls `deps.clearInstrumentDataCache()`.
  - This is the "global" refresh mechanism, which is asynchronous relative to the command response.
- **File:** `src/features/charts/chartInstrumentHydrationService.ts`
  - `loadInstrumentResult` (L186-200) explicitly checks the cache before calling `api.getEodData`.
  - **Critical Logic:**
    ```typescript
    const cachedResult = instrumentDataCache.read(databasePath, instrument, adjusted);
    if (cachedResult) {
      return cachedResult; // Hits stale data if db:changed hasn't arrived yet
    }
    ```

## 5. Chart Refresh Root Cause Candidates

### QE2-F2-RISK-001: Race condition between command return and event processing
- **Likelihood:** High.
- **Evidence:** Tauri event emission is non-blocking for the backend. Command responses and events arrive at the frontend asynchronously.
- **Smallest Safe Fix:** Update `loadInstrument` to support a `force` flag that bypasses the cache, or have the Quote Editor manually clear the cache for the specific instrument before reloading.

### QE2-F2-RISK-002: Stale data returned by `get_eod_data` due to backend caching
- **Likelihood:** Low.
- **Evidence:** Backend read path for Binary EOD opens the file directly and reads the latest records. There is no significant backend-level caching for bar data in the Rust layer.

### QE2-F2-RISK-003: `ChartEngine` not redrawing when identical object reference is passed
- **Likelihood:** Medium.
- **Evidence:** If `loadInstrument` returns the exact same object from cache, `ChartCanvas` (React) might skip some effects, though `engine.loadBars(bars)` is called in an effect. However, if the `bars` array reference is the same, the data is indeed stale.

## 6. Recommended Fix Plan
Recommend **QE2-F3 Frontend-only fix**:

1. **Modify `loadInstrument`** in `chartStore` and `chartInstrumentCompareController.ts` to accept an optional `options` object with a `forceReload` boolean.
2. **Modify `loadInstrumentResult`** in `chartInstrumentHydrationService.ts` to bypass the cache if `forceReload` is true.
3. **Update `DatabaseToolsDialogs.tsx`** to pass `{ forceReload: true }` when calling `onReloadInstrument` after a successful mutation.
4. **Alternative:** Simply have `DatabaseToolsDialogs.tsx` call a new `clearCacheForSymbol(symbol, exchange)` method before reloading. This is cleaner as it leverages existing hydration logic.

## 7. Validation Plan
- **Verification of fix:**
  1. Open NIFTY chart.
  2. Open Quote Editor.
  3. Delete latest row.
  4. Confirm chart updates immediately (candle disappears).
  5. Edit a row (e.g., change Close price).
  6. Confirm chart updates immediately.
- **Regression testing:**
  1. Switch between symbols in the watchlist.
  2. Confirm cache IS used (loading should be near-instant for previously visited symbols).
  3. Confirm that "force reload" only happens when explicitly requested by tools that modify data.
