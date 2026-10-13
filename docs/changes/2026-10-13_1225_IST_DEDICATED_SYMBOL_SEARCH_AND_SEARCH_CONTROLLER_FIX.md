# Dedicated Symbol Search Mode & Chart Search Controller Fix

- **Date:** October 13, 2026 12:25 IST
- **Pre-edit Backup:** `backups/pre_opencode_changes_20261013_121451_dedicated_symbol_search`
- **Scope:** Dedicated symbol search dialog via `S` hotkey, exchange filter pills, recently viewed symbols fallback, and SQLite search controller fix.

## 1. Problem Statement & Root Cause

1. **Why Symbols Did Not Appear in Search**:
   - `chartSearchController.runSearch(query)` previously guarded incoming results with:
     ```ts
     if (state.searchQuery !== query) return;
     ```
   - When `CommandPalette` invoked `runSearch(query.trim())` directly without first calling `setSearchQuery()`, `state.searchQuery` remained `""` in the store. When the SQLite search results returned, `"" !== query` evaluated to true, silently discarding all symbol results.
   - Fixed by ensuring `deps.setState({ searchQuery: query })` executes immediately at the entry of `runSearch`.

2. **Dedicated Symbol Search Requirement**:
   - The user requested pressing the single key `S` to bring up a focused Symbol Search dialog containing only instruments (no command actions), while preserving `Ctrl+K` / `/` for the full Command Palette.
   - Also requested quick switching with exchange filters (`All`, `NSE`, `BSE`), recent symbols on empty query, and keyboard navigation.

## 2. Changes Made

### A. [`src/features/charts/chartSearchController.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/features/charts/chartSearchController.ts)
- Updated `runSearch` to immediately store `searchQuery: query` in state so asynchronous SQLite responses match the active query.
- Handled empty queries cleanly by resetting results state without network or disk IO.

### B. [`src/store/uiStore.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/store/uiStore.ts)
- Added `commandPaletteMode: 'all' | 'symbol'`.
- Extended `setCommandPaletteOpen(open, mode = 'all')` and `toggleCommandPalette(mode = 'all')` to support opening in dedicated symbol mode.

### C. [`src/components/CommandPalette.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/CommandPalette.tsx)
- **Single-key `S` Hotkey**: Opens the palette in `'symbol'` mode when focus is not inside an editable text element.
- **Dedicated Symbol Display**: When `mode === 'symbol'`, command rows are hidden and up to 35 symbol results are displayed.
- **Recently Viewed Symbols**: When the search query is empty in `'symbol'` mode, loads recent symbols from localStorage (`eod-chart.sidebar.recentlyViewedSymbols.v1`), allowing instant `S` &rarr; `↓` &rarr; `Enter` instrument switching.
- **Exchange Filter Pills**: Added `[All Exchanges]`, `[NSE]`, and `[BSE]` filter buttons, cyclable with the `Tab` key.
- **Series Badges**: Renders security series badges (e.g. `EQ`, `BE`, `SM`) alongside symbol names.
- **Fixed Size Geometry**: Assigned stable fixed dimensions (`580px` width × `480px` height) with `flex: 1` list and `overflowY: 'auto'`, preventing dialog jumping/resizing as items load or queries change.
- **Draggable Window**: Connected `useDraggableFloatingWindow` with localStorage position persistence (`eod-chart.command-palette.position.v1`), allowing users to click and drag the header to move the window anywhere across the chart.
- **Header ESC Badge Removed**: Removed redundant `<span style={escBadgeStyle}>ESC</span>` next to the `✕` close button; `<kbd>Esc</kbd> Close` remains present in the dialog footer.

## 3. Validation
- `npm run typecheck:renderer`: PASS (0 errors).
- `npm test -- src/features/charts/__tests__/chartTabStateMutationService.test.ts`: PASS (7/7 tests passed).
