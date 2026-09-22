# WATCHLIST_MENU_IMPORT_WINDOW_REFINEMENT_REPORT

Date: 2026-04-03

## Scope

This pass refined watchlist management and official watchlist import UX without redesigning the broader app shell.

This pass preserved:

- official watchlist import/update/live-source logic
- source-linked metadata
- ISIN-first then symbol-fallback matching
- Bhavcopy behavior
- sidebar pin / auto-hide behavior
- Sheets behavior
- chart/workspace behavior
- Electron fallback
- `src/platform/*` runtime seam

## Problem Before This Pass

The official watchlist import/update foundation already existed, but the management surface still felt too sidebar-bound:

- there was no top-level `Watchlist` menu in the native menu bar
- official import still lived primarily as a sidebar action
- the importer window was too narrow for sector/index workflow at scale
- the importer did not feel like a proper management workflow with group preview
- the currently displayed catalog was still shaped by the older starter subset instead of the fuller reliable NSE catalog now available

## What Was Added

### Top-Level Watchlist Menu

The main menu order is now:

- `File`
- `Database`
- `Watchlist`
- `Chart`
- `View`
- `Help`

The new `Watchlist` menu currently includes:

- `Manage Watchlists`
- `Import Official Watchlists`

### Watchlist Management Surface

A minimal `Manage Watchlists` dialog was added so watchlists now have a proper menu-based management entry point for:

- list watchlists
- create watchlist
- rename watchlist
- delete watchlist

The implementation stays deliberately low-risk and reuses the existing prompt/confirm style for naming and deletion.

### Sidebar Refinement

- `Import` was removed from the sidebar primary action row.
- The sidebar is now focused on current watchlist usage:
  - `New`
  - `Update`
  - watchlist selector
  - compact helper/status text
- `Update` remained in the sidebar because it is a contextual current-watchlist action and still fits the compact utility row cleanly.
- The sidebar now explicitly points users to `Watchlist > Import Official Watchlists` for the main official import workflow.

## Import Window Refinement

The old narrow single-column popup was replaced with a larger structured import window.

### New Window Layout

1. Source filter tabs at the top:
   - `NSE Sectors`
   - `NSE Indices`
   - `BSE Sectors`
   - `BSE Indices`
2. Two-pane body:
   - left pane: checkbox group list with group name plus constituent count
   - right pane: constituent preview for the currently highlighted group
3. Footer:
   - `Cancel`
   - `Import Selected`

### Selection Behavior

- only one source filter is active at a time
- clicking a row previews that group on the right
- checking rows selects one or more groups for import
- importing still creates one watchlist per selected group

## Official Provider Coverage Shown In The Importer

The current visible reliable catalog shown by the importer after this pass is:

- `NSE Sectors`: 22 groups
- `NSE Indices`: 21 groups
- `BSE Sectors`: 5 groups
- `BSE Indices`: 2 groups

Notes:

- the packaged NSE snapshot was expanded from the earlier starter subset to the fuller currently validated sectoral and broad-based catalog
- BSE remains limited to the currently validated groups because broader official BSE constituent coverage is still constrained by paginated/rate-limited source behavior that was not safe to fully promote in this pass
- `bse-500` remains intentionally filtered from the importer because the currently packaged fallback is still partial and the current live BSE source is paginated

## Provider/Fallback Refinement

This pass preserved the existing live-source-first, snapshot-fallback-second behavior.

A small safety refinement was added:

- paginated BSE live constituent pages now force snapshot fallback instead of treating a single visible page as a full live result

That keeps import/update behavior safer for the currently validated BSE groups.

## Files Added

- `src/components/WatchlistManagerDialog.tsx`
- `WATCHLIST_MENU_IMPORT_WINDOW_REFINEMENT_REPORT.md`

## Files Modified

- `src/components/Sidebar.tsx`
- `src/components/OfficialWatchlistImportDialog.tsx`
- `src/store/chartStore.ts`
- `src/RootApp.tsx`
- `src/features/watchlists/officialWatchlistProviders.ts`
- `src/features/watchlists/officialWatchlistData.generated.ts`
- `electron/db.ts`
- `electron/ipc/handlers.ts`
- `electron/preload.ts`
- `electron/menuBar.ts`
- `src/types/electron.d.ts`
- `src/platform/types.ts`
- `src/platform/tauriDesktop.ts`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/main.rs`

## Backup Location

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260403_160656_watchlist_menu_import_window_refinement`

## Markdown Files Updated

- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `OFFICIAL_WATCHLIST_IMPORT_FOUNDATION_REPORT.md`
- `OFFICIAL_WATCHLIST_UPDATE_REPORT.md`
- `OFFICIAL_WATCHLIST_LIVE_SOURCE_REPORT.md`
- `WATCHLIST_ACTION_DISCOVERABILITY_FIX_REPORT.md`
- `WATCHLIST_MENU_IMPORT_WINDOW_REFINEMENT_REPORT.md`

## Exact Build Commands Run

- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `npm run tauri:portable:win`

## Exact Runnable Windows Output Path

- `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`

## Exact Launcher Path

- `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Remaining Limitations

- broader BSE sector/index coverage was investigated, but not fully promoted because current official BSE constituent pages are paginated/rate-limited and need a dedicated pagination-safe live-source follow-up before they should be claimed as fully reliable
- the new importer previews packaged constituent data; import/update still fetch live data first when supported and fall back when needed
- `Update` remains a contextual sidebar action and is not yet exposed as a full Watchlist-menu command
- the watchlist manager dialog is intentionally minimal and does not add bulk or multi-select management
