# WATCHLIST_ACTION_DISCOVERABILITY_FIX_REPORT

Date: 2026-04-03

## Scope

This pass fixed watchlist action discoverability in the existing Watchlists sidebar panel.

Later on April 3, 2026, a Watchlist-menu refinement pass moved the primary official import entry point out of the sidebar and into a new top-level `Watchlist` menu. This report still documents the earlier sidebar-first discoverability step that made the feature easier to reach before that menu refinement landed.

This pass did not:

- redesign the sidebar broadly
- change official watchlist import behavior
- change official watchlist update behavior
- change source-linked metadata
- change live-source provider logic
- change symbol matching behavior
- change Bhavcopy behavior
- change workspace, Sheets, or chart behavior

## Problem Before This Pass

The official watchlist feature set already existed, but the Watchlists panel made the main actions too easy to miss:

- `Import` was present but visually buried behind the selector-heavy control row
- `Update` was technically present but weakly discoverable in normal usage
- the control row mixed selection and actions tightly enough that the feature felt hidden even though the logic was implemented

The result was that the feature existed in code, but normal users could miss how to import official groups or manually refresh official source-linked watchlists.

## What Was Changed

- The Watchlists panel now uses a clearer top control block:
  - first row: visible action buttons for `New`, `Import`, and `Update`
  - second row: the current watchlist selector
  - third line: a compact status/helper message
- `Import` is now clearly visible as a first-class action next to the other watchlist actions.
- `Update` is now clearly visible as a first-class action instead of feeling secondary to the selector row.

## Visible Import Action

- Added a plainly visible `Import` button in the Watchlists panel action row.
- The button remains near `New`.
- Clicking it opens the existing official-source import menu for:
  - `NSE Sectors`
  - `NSE Indices`
  - `BSE Sectors`
  - `BSE Indices`

The underlying import dialog and import behavior were not changed.

## Visible Update Action

- Added a plainly visible `Update` button in the same Watchlists action row.
- `Update` remains manual user-triggered only.
- `Update` is conditional on the currently selected watchlist:
  - enabled for official source-linked watchlists
  - disabled for manual watchlists or when no database is open

The underlying source-linked update logic, diff logic, and live-source provider behavior were not changed.

## Small UX Refinements

- Moved actions out of the crowded selector row so they are easier to scan
- Kept the control block compact and aligned with the existing sidebar style
- Added clearer disabled-state presentation for unavailable actions
- Added a compact helper/status line so the user can tell whether the selected watchlist is:
  - official linked
  - manual
  - unavailable because no database is open

## Files Modified

- `src/components/Sidebar.tsx`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `OFFICIAL_WATCHLIST_IMPORT_FOUNDATION_REPORT.md`
- `OFFICIAL_WATCHLIST_UPDATE_REPORT.md`
- `OFFICIAL_WATCHLIST_LIVE_SOURCE_REPORT.md`

## Files Added

- `WATCHLIST_ACTION_DISCOVERABILITY_FIX_REPORT.md`

## Backup Location

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260403_141733_watchlist_action_discoverability_fix`

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

- `Import` still opens a compact menu instead of a full dedicated watchlist action bar, by design
- `Update` remains disabled for manual watchlists rather than hidden, so the capability stays discoverable
- This pass did not add rename/delete discoverability changes because that was outside scope
- This pass did not add background refresh or bulk update actions
