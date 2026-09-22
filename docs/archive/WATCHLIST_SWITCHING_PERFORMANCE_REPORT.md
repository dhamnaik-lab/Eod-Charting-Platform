# Watchlist Switching Performance Report

## Scope

This pass targeted the next likely user-visible renderer bottleneck after the Tauri backend speed work:

- unnecessary sidebar rerenders during watchlist usage
- watchlist panel updates being coupled to full active-tab object churn
- redundant `selectWatchlist(...)` state updates when the same watchlist was chosen again

Preserved intentionally:

- the current Tauri-only runtime structure
- existing watchlist behavior and current watchlist UI structure
- official import/update/live-source behavior
- symbol matching rules
- Sheets behavior
- chart behavior
- sidebar layout and pin/auto-hide behavior

## What Changed

- `src/components/Sidebar.tsx` no longer subscribes to the full `chartTabs` array just to determine the active symbol or active indicators.
- The sidebar now subscribes to narrower derived values:
  - active instrument key
  - active indicator list
  - active database path / DB stats / watchlists
- `SymbolListRow` is now memoized so row rendering is less sensitive to unrelated sidebar/store updates.
- The row open/context-menu handlers are now stable item-based callbacks instead of fresh inline closures for every render.
- `src/store/chartStore.ts` now treats `selectWatchlist(...)` as a no-op when the requested watchlist is already selected.

## Why This Helps

Before this pass:

- the sidebar subscribed to `chartTabs`
- chart hover, viewport movement, and other active-tab mutations could force the sidebar watchlist panel to rerender even when the selected watchlist had not changed
- repeated selection of the same watchlist still created a store update

After this pass:

- watchlist switching is driven more directly by the selected watchlist and the active instrument key
- chart hover and other tab-level state churn no longer force the watchlist panel through the same rerender path
- selecting the already active watchlist does nothing

## Files Modified

- `src/components/Sidebar.tsx`
- `src/store/chartStore.ts`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Added

- `WATCHLIST_SWITCHING_PERFORMANCE_REPORT.md`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260404_154900_watchlist_switching_perf_pass`

## Validation

Executed successfully:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

## Runnable Output

- Output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`
- Executable: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

## Remaining Limitations

- very large watchlists still render all rows; this pass reduced rerender churn but did not add virtualization
- watchlist switching cost can still include normal React paint work for the newly selected list
- if sheet switching remains noticeably slower than watchlist switching, the next bottleneck is likely tab/sheet handoff rather than watchlist render churn

## Suggested Next Steps

1. manually verify:
   - watchlist switching with large official watchlists
   - chart hover while the watchlist panel is open
   - repeated same-watchlist selection
2. if sheet switching is now the most visible lag point, target sheet-switch handoff and active-tab hydration next
3. if startup still feels heavy, consider a safe stale-while-revalidate shell-info path for startup-only DB stats
