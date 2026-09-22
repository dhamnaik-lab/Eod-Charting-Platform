# OFFICIAL_WATCHLIST_LIVE_SOURCE_REPORT

Date: 2026-04-03

## Follow-Up Note

Later on April 3, 2026, a separate discoverability pass made the Watchlists panel expose a visible `Import` action and a visible conditional `Update` action without changing the provider behavior described here.

Later on April 3, 2026, a Watchlist-menu refinement pass moved official import into a top-level `Watchlist` menu, replaced the old narrow importer with a larger two-pane preview window, expanded the packaged reliable NSE catalog shown by that importer, and added a small provider safety refinement so paginated BSE live constituent pages now force packaged fallback instead of being treated as complete live results.

## Scope

This pass enhanced the existing official watchlist provider layer so manual import and manual `Update` now try to fetch the latest official constituent lists from live NSE/BSE sources at the moment the user acts.

This pass did not:

- redesign the watchlist UI
- change the update diff logic
- change watchlist metadata structure
- change symbol matching behavior
- add background refresh or auto-sync
- modify Bhavcopy behavior
- modify workspace, Sheets, or sidebar behavior

## What Was Added

- Live official-source fetch capability behind the existing desktop runtime seam
- Snapshot-safe provider fallback when a live source fails
- Async provider loaders for:
  - `NSE Sectors`
  - `NSE Indices`
  - `BSE Sectors`
  - `BSE Indices`
- Live-fetch logging and fallback logging
- Provider-side normalization logging without changing store-side symbol resolution rules

## Which Sources Are Used

### NSE

NSE groups now use the official Nifty Indices constituent CSV endpoints already stored in the packaged provider snapshot, for example:

- `https://www.niftyindices.com/IndexConstituent/ind_nifty50list.csv`
- `https://www.niftyindices.com/IndexConstituent/ind_niftyitlist.csv`

The live parser reads the official CSV columns:

- `Company Name`
- `Symbol`
- `ISIN Code`

### BSE

BSE groups now use the official BSE constituent pages already stored in the packaged provider snapshot, for example:

- `https://www.bseindia.com/sensex/IndicesWatch_Weight.aspx?iname=BSE30&index_Code=16`
- `https://www.bseindia.com/sensex/IndicesWatch_Weight.aspx?iname=TECK&index_Code=45`

The live parser reads the structured HTML constituent table:

- company name
- ISIN

BSE live parsing intentionally relies on ISIN-first matching because those official pages do not provide a stable renderer-ready symbol column comparable to the NSE CSV feed.

When a BSE constituent page is paginated, the provider now treats that live response as incomplete and falls back to the packaged snapshot instead of accepting only the first visible page as a full live result.

## Provider Structure

`src/features/watchlists/officialWatchlistProviders.ts` now has two layers:

1. Snapshot metadata access for UI listing and stable source-key lookup
2. Async live loaders used only when importing or updating

The current provider flow is:

1. identify the requested official group from the packaged snapshot metadata
2. fetch live source text through the desktop bridge
3. parse and normalize the returned data by source type
4. return fresh constituents when parsing succeeds
5. fall back to packaged snapshot constituents when live fetch/parsing fails

## Fallback Logic Behavior

If live fetch fails for any reason:

- unsupported host
- network failure
- source downtime
- parser mismatch
- empty/invalid response

the provider logs fallback usage and returns the packaged snapshot members for that group.

This preserves:

- manual import behavior
- manual update behavior
- existing update diff logic
- existing unresolved-symbol handling

The watchlist flow does not break or partially fail just because the live source is unavailable.

## Normalization And Matching Safety

This pass does not change watchlist symbol matching behavior.

Provider normalization is intentionally limited to:

- trimming whitespace
- cleaning empty values
- collapsing extra whitespace in names
- de-duplicating parsed members by `isin | symbol | name`

Store-side matching remains unchanged:

- exact exchange + ISIN first
- exact exchange + symbol second

## Logging

Provider logs now include:

- live fetch success
- snapshot fallback use
- normalization counts

Example log categories:

- `[official-watchlist-provider] live-fetch-success`
- `[official-watchlist-provider] fallback-snapshot`
- `[official-watchlist-provider] normalization`

## Files Modified

- `electron/ipc/handlers.ts`
- `electron/preload.ts`
- `src/types/electron.d.ts`
- `src/platform/types.ts`
- `src/platform/tauriDesktop.ts`
- `src/features/watchlists/officialWatchlistProviders.ts`
- `src/store/chartStore.ts`
- `src-tauri-shell/src/main.rs`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `OFFICIAL_WATCHLIST_IMPORT_FOUNDATION_REPORT.md`
- `OFFICIAL_WATCHLIST_UPDATE_REPORT.md`

## Backup Location

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260403_032731_official_watchlist_live_sources`

## Exact Build Commands Run

- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `npm run tauri:portable:win`

All four commands passed.

## Build Output Path

- `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`

## Launcher Path

- `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Limitations

- Live refresh still runs only on explicit user action:
  - import
  - manual `Update`
- There is still no background sync or scheduled refresh
- NSE/BSE source structure may change in the future, so parser maintenance is still a risk
- BSE live parsing currently depends on table structure and ISIN availability from the official HTML page
- If the user is offline or the official source is unavailable, the app falls back to packaged snapshot data rather than failing hard

## Future Extension Suggestions

- Add a visible `last synced` readout for official watchlists
- Add a bulk `Update All Official Watchlists` action
- Add a snapshot-regeneration tool so packaged fallback data can be refreshed more systematically
- Add smoke-test fixtures for official-source parsing so source changes are caught earlier
