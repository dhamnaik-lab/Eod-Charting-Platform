# WATCHLIST_DUPLICATE_IMPORT_AND_SYMBOL_CONTEXT_MENU_FIX_REPORT

Date: 2026-04-04

## Scope

This was a narrow watchlist follow-up pass.

It fixed two user-facing issues without redesigning the watchlist system:

- repeated official import actions could create duplicate source-linked watchlists with names like `(2)`
- the Watchlists panel still showed duplicated symbol/action columns with inline delete buttons instead of a cleaner symbol-only list plus right-click delete

This pass did not:

- change official provider logic
- change official source-linked metadata structure
- change manual `Update` behavior
- change symbol resolution rules
- redesign the sidebar
- modify Sheets, workspace behavior, or chart behavior

## What Was Wrong Before

### Duplicate Official Imports

Official import was still using generic duplicate-name handling during watchlist creation.

That meant re-importing the same official group could create another watchlist like:

- `NSE Index - NIFTY MIDCAP 100 (2)`

even though the original watchlist was already source-linked to the same official provider group.

### Watchlist Panel Rows

The Watchlists panel still showed:

- a `Symbol` column
- an `Action` column
- duplicated row text
- inline `x` remove buttons

This made the list noisier than necessary for normal watchlist browsing.

## What Was Changed

### Official Import Deduping

`src/store/chartStore.ts` now uses source-linked metadata to detect already-imported official groups before creating a new watchlist.

It now compares:

- `sourceType`
- `sourceExchange`
- `sourceGroupType`
- `sourceKey`

If the selected official group is already linked to an existing watchlist:

- no new watchlist is created
- the existing linked watchlist is reused as the import target reference
- a compact import toast explains that the selected groups are already imported
- logging records the skip as:
  - `[official-watchlist-import] already-linked`

This preserves manual watchlist behavior and keeps duplicate-safe naming only for genuinely new watchlists.

### Watchlist Symbol List Simplification

`src/components/Sidebar.tsx` now renders the Watchlists panel list as a symbol-only list.

Changes:

- removed the `Action` header from the watchlist item list
- removed the secondary duplicated symbol/action presentation
- removed the inline `x` button from each watchlist row

### Right-Click Delete

The Watchlists panel now supports a compact local context menu for symbol removal.

Behavior:

- right-click any symbol row in the selected watchlist
- a small menu appears with `Delete`
- selecting `Delete` removes that symbol from the current watchlist

The menu is scoped to the Watchlists panel and closes on:

- click-away
- scroll
- `Escape`
- watchlist change

## Files Modified

- `src/store/chartStore.ts`
- `src/components/Sidebar.tsx`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Added

- `WATCHLIST_DUPLICATE_IMPORT_AND_SYMBOL_CONTEXT_MENU_FIX_REPORT.md`

## Backup Location

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_010637_watchlist_duplicate_and_context_menu_fix`

## Exact Build Commands Run

- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `npm run tauri:portable:win`

## Build Output Path

- `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`

## Launcher Path

- `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Remaining Limitations

- This pass prevents new duplicate source-linked official watchlists from being created; it does not automatically delete older duplicates that already exist in a user database from earlier builds.
- Symbol deletion in the Watchlists panel is now right-click driven; there is still no multi-select delete flow in this pass.
- The bounded self-check after packaging confirms startup only, not a full interactive visual walkthrough of every watchlist state.
