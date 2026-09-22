# OFFICIAL_WATCHLIST_UPDATE_REPORT

Date: 2026-04-03

## Follow-Up Note

Later on April 3, 2026, a separate live-source provider pass changed provider freshness so manual import and manual `Update` now fetch live official NSE/BSE constituents when possible and fall back to the packaged snapshot when live fetch fails.

Later on April 3, 2026, a separate discoverability pass also made the Watchlists panel expose a visible `Import` action and a visible conditional `Update` action in the panel control block.

Later on April 3, 2026, a Watchlist-menu refinement pass moved official import into a new top-level `Watchlist` menu, added a minimal `Manage Watchlists` dialog, and kept `Update` in the sidebar as the compact current-watchlist action because it remains contextual to the currently selected watchlist.

This report still documents the source-linked metadata and manual update foundation pass.

See `OFFICIAL_WATCHLIST_LIVE_SOURCE_REPORT.md` for the current provider-freshness behavior.

## Scope

This pass added source-linked metadata and manual update capability for imported official NSE/BSE sector and index watchlists.

This pass did not:

- redesign the watchlist UI
- change manual watchlist behavior
- change symbol matching rules
- add background or auto-scheduled updates
- modify Bhavcopy flows
- modify workspace, Sheets, or sidebar behavior beyond a minimal watchlist-toolbar action

## What Was Added

- Optional source-linked metadata on `watchlists`
- Metadata-aware official watchlist creation during import
- A minimal `Update` action for selected official watchlists in the existing watchlist toolbar
- Transactional official watchlist update handling in both Electron and Tauri backends
- Provider helpers for stable official source keys and source-link lookup

## How Metadata Is Stored

Imported official watchlists now persist nullable metadata directly on the existing `watchlists` row:

- `source_type`
- `source_exchange`
- `source_group_type`
- `source_key`
- `source_display_name`
- `last_synced_at`

Manual watchlists leave all of those fields `NULL`.

This keeps the extension minimal and avoids a separate table or broad schema redesign.

## How Import Now Stores Metadata

When the user imports an official group, the created watchlist now stores:

- `source_type = official`
- `source_exchange = NSE | BSE`
- `source_group_type = sector | index`
- `source_key = <stable uppercase key derived from provider group id>`
- `source_display_name = <official group name>`
- `last_synced_at = <import timestamp>`

Example:

- watchlist name: `NSE Sector - Nifty IT`
- metadata:
  - `source_type: official`
  - `source_exchange: NSE`
  - `source_group_type: sector`
  - `source_key: NIFTY_IT`

## How Update Action Works

- User selects a watchlist in the existing Watchlist sidebar panel.
- If that watchlist is source-linked to an official provider group, the toolbar now enables `Update`.
- Clicking `Update`:
  1. resolves the stored source-link back to the packaged provider/group
  2. loads the current instrument catalog from the active DB
  3. reuses the existing official-member resolution logic:
     - exact exchange + ISIN first
     - exact exchange + symbol second
  4. computes a diff against the current watchlist contents
  5. applies the diff through a single backend operation
  6. updates `last_synced_at`
  7. refreshes the watchlist snapshot and shows a compact toast summary

If provider lookup fails, the update is aborted and the watchlist is left unchanged.

## How Diff Logic Works

For a selected official watchlist:

- `symbols_to_add`: resolved provider members not already in the watchlist
- `symbols_to_remove`: current watchlist members no longer present in the resolved provider set
- `symbols_unchanged`: intersection of current and provider-resolved members
- `unresolved`: provider members that could not be matched to DB instruments

The backend update path:

- removes stale members
- appends new members with duplicate-safe `INSERT OR IGNORE`
- updates `last_synced_at`
- runs inside a single transaction

## Logging

This pass logs compact official update summaries, for example:

- watchlist name
- source key
- added count
- removed count
- unchanged count
- unresolved count

Unresolved members are logged separately without failing the whole update.

## Files Modified

- `electron/db.ts`
- `electron/ipc/handlers.ts`
- `electron/preload.ts`
- `src/types/electron.d.ts`
- `src/platform/types.ts`
- `src/platform/tauriDesktop.ts`
- `src/features/watchlists/officialWatchlistProviders.ts`
- `src/store/chartStore.ts`
- `src/components/Sidebar.tsx`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/main.rs`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `OFFICIAL_WATCHLIST_IMPORT_FOUNDATION_REPORT.md`

## Files Added

- `OFFICIAL_WATCHLIST_UPDATE_REPORT.md`

## Backup Location

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260403_021048_official_watchlist_update`

## Exact Build Commands Run

- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `npm run tauri:portable:win`

## Build Output Path

- `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`

## Launcher Path

- `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Limitations

- This report documents the original metadata/update pass; live provider fetch with packaged fallback was added later in `OFFICIAL_WATCHLIST_LIVE_SOURCE_REPORT.md`.
- Manual watchlists remain intentionally unlinked and do not expose the update action.
- The current provider coverage still depends on the packaged group snapshot quality from the prior import-foundation pass.
- There is no per-watchlist update-history UI yet beyond `last_synced_at` persistence and runtime logs.

## Future Extension Suggestions

- Add a visible `last synced` readout in the watchlist panel for official-linked watchlists.
- Add bulk update for all official-linked watchlists in the current database.
- Add source refresh tooling to regenerate the packaged provider snapshot from official feeds.
- Add explicit rename/delete actions to the watchlist panel if that workflow is still partially external.
