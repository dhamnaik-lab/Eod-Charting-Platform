# Store Split Pass 6 Report

Date: 2026-04-07

## What Was Addressed

The core business logic of the two official watchlist actions was extracted from `src/store/chartStore.ts` into a new dedicated service module `src/features/watchlists/officialWatchlistImportService.ts`. The store-side orchestration (toast messages, watchlist selection, dialog close, refresh) remained intentionally in `chartStore.ts`.

## What Was Extracted Into the Service

### `runOfficialWatchlistImport`

Extracted from `importOfficialWatchlists` store action:

- load official source metadata via `getOfficialWatchlistSource`
- load official groups via `loadOfficialWatchlistGroups` (live-source fetch with packaged fallback)
- fetch instrument catalog via `api.listSymbols`
- build `bySymbol` / `byIsin` lookup maps via `buildOfficialWatchlistLookupMaps`
- build `existingNames` set and `existingOfficialWatchlists` map for duplicate prevention
- for each group: check for already-linked watchlist (skip with log), create new watchlist with source metadata, resolve members (ISIN-first then symbol-fallback), add resolved members, collect unresolved members, log created watchlist
- log unresolved member summary
- return structured `OfficialImportResult` with `createdWatchlists`, `skippedExistingWatchlists`, `unresolvedMembers`, `selectWatchlistId`

### `runOfficialWatchlistUpdate`

Extracted from `updateOfficialWatchlist` store action:

- load source group via `loadOfficialWatchlistGroupBySourceLinkMeta` (live-source fetch with packaged fallback)
- fetch instrument catalog via `api.listSymbols`
- build lookup maps, resolve all source members (ISIN-first then symbol-fallback), collect unresolved
- build `currentMembers` map from current watchlist items
- compute diff: `symbolsToAdd`, `symbolsToRemove`, `unchangedCount`
- execute `applyOfficialWatchlistUpdate` mutation
- log unresolved member warning and summary
- return structured `OfficialUpdateResult` with `watchlistName`, `sourceKey`, `added`, `removed`, `unchanged`, `unresolvedCount`

## What Stayed in `chartStore.ts` Intentionally

For `importOfficialWatchlists`:
- precondition guard: `!getApi() || !snapshot?.activeDatabasePath`
- `await refreshWatchlistsOnly()`
- `set({ selectedWatchlistId: result.selectWatchlistId ?? get().selectedWatchlistId })`
- `getUiStoreState().closeOfficialWatchlistImportDialog()`
- `get().addToast(...)` with full message/type/title logic

For `updateOfficialWatchlist`:
- precondition guard: `!getApi() || !snapshot?.activeDatabasePath`
- watchlist existence check from snapshot
- `await refreshWatchlistsOnly()`
- `get().addToast(...)` with toast message from result fields

## Behavior Preserved

- ISIN-first then symbol-fallback resolution order: unchanged (delegated to `resolveOfficialWatchlistMember` in `officialWatchlistResolver.ts`)
- duplicate official-watchlist prevention via source signature: unchanged
- unresolved member reporting and logging: unchanged
- diff logic for updates (`symbolsToAdd`, `symbolsToRemove`, `unchangedCount`): unchanged
- source signature and watchlist naming: unchanged
- live-source fetch with packaged fallback: unchanged (provider layer untouched)
- toast message wording: unchanged
- dialog close behavior: unchanged
- `selectedWatchlistId` update: unchanged

## Service Design

```typescript
// Result types
export interface OfficialImportResult {
  createdWatchlists: OfficialImportCreatedEntry[];
  skippedExistingWatchlists: OfficialImportSkippedEntry[];
  unresolvedMembers: OfficialImportUnresolvedEntry[];
  selectWatchlistId: number | null;
}

export interface OfficialUpdateResult {
  watchlistName: string;
  sourceKey: string | null | undefined;
  added: number;
  removed: number;
  unchanged: number;
  unresolvedCount: number;
}

// Service functions
export async function runOfficialWatchlistImport(
  existingWatchlists: Watchlist[],
  sourceId: OfficialWatchlistSourceId,
  groupIds: string[],
): Promise<OfficialImportResult>

export async function runOfficialWatchlistUpdate(
  watchlist: Watchlist,
): Promise<OfficialUpdateResult>
```

- No `uiStore` imports in the service
- No toast calls in the service
- No dialog close in the service
- No `refreshWatchlistsOnly` in the service
- No Zustand `set(...)` in the service
- Uses `getDesktopApi()` directly for `listSymbols`
- Delegates mutations to `watchlistService` functions (`createWatchlist`, `addInstrumentToWatchlist`, `applyOfficialWatchlistUpdate`)

## Imports Removed from `chartStore.ts`

From `watchlistService`: `applyOfficialWatchlistUpdate`
From `officialWatchlistProviders`: `buildOfficialWatchlistSourceLinkMeta`, `getOfficialWatchlistSource`, `loadOfficialWatchlistGroupBySourceLinkMeta`, `loadOfficialWatchlistGroups`
Entire `officialWatchlistResolver` import block: `buildOfficialWatchlistLookupMaps`, `buildUniqueWatchlistName`, `instrumentSymbolKey`, `officialWatchlistSourceSignature`, `resolveOfficialWatchlistMember`

## Line Delta

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `chartStore.ts` lines | 1,774 | 1,566 | −208 |

## Files Added

- `src/features/watchlists/officialWatchlistImportService.ts`
- `STORE_SPLIT_PASS6_REPORT.md`

## Files Modified

- `src/store/chartStore.ts`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`

## Backup

- `backups\pre_opencode_changes_20260407_101803_store_split_pass6`

## Validation Performed

Passed:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

## Output

- Output folder: `release\tauri-portable-win\EOD Chart Portable`
- Launcher path: `release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Remaining Limitations

- `chartStore.ts` is now at 1,566 lines. The largest remaining hotspot is the chart tab management block (`createChartTab`, `activateChartTab`, `closeChartTab`) which is tightly coupled to store state and has the lowest extraction priority.
- The `officialWatchlistImportService.ts` service currently does not expose a dry-run or preview-only mode; if one is needed in the future, the service boundary is now a good place to add it.
- Official watchlist import/update still runs only on explicit user action — no background sync or scheduled refresh.
