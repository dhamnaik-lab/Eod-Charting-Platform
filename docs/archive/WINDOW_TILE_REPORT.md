# Window Tile Implementation Report

## Update Note
This report is now partially superseded by `CHART_WINDOW_SHEETS_REFACTOR_REPORT.md`. The live app now renders each tile/chart window with its own bottom sheet strip and tab-scoped sheet actions. Tile compatibility remains partial because the overall tiled/single view still follows the active chart window's `layoutMode`.

## Review
Window tile mode implemented as a safe first version. Users can toggle between single-chart view and a tiled grid showing all open chart tabs simultaneously. No sheets, no full workspace redesign, no chart engine changes.

## Backup Created
`D:\TA Projects\EOD Charting Platform\backups\pre_window_tile_20260401_020733`

## Files Added
- `WINDOW_TILE_REPORT.md`

## Files Modified
- `src/store/chartStore.ts` — Added `layoutMode: 'single' | 'tile'` state and `setLayoutMode` action
- `src/components/ChartTabs.tsx` — Added tile toggle button (▦/▣) to tab strip
- `src/RootApp.tsx` — Added conditional rendering for tiled grid vs single-chart view, tile grid CSS styles

## Markdown Files Updated
- `WINDOW_TILE_REPORT.md` (created)

## Key Window Tile Features Completed

### Tile Mode Implementation
- **Layout mode state**: Added `layoutMode: 'single' | 'tile'` to chart store with `setLayoutMode` setter
- **Toggle button**: Added to `ChartTabs.tsx` tab strip as a compact icon button (▦ for tile active, ▣ for single active) with tooltip
- **Tiled grid rendering**: In `RootApp.tsx`, when `layoutMode === 'tile'`, all open chart tabs render simultaneously in a CSS Grid layout
- **Single mode preserved**: Normal single-chart view with `ChartToolDock` remains the default

### Grid Layout Details
- **Auto-fill grid**: `gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))'` — automatically creates columns based on available width
- **Minimum tile size**: 480px minimum width per chart ensures readability
- **Gap**: 2px between tiles for visual separation
- **Tile cells**: Each chart gets a bordered cell with subtle background and rounded corners
- **Overflow handling**: Grid auto-fills columns; if more tabs exist than fit comfortably, they wrap to additional rows. No explicit cap on chart count — CSS Grid handles it gracefully.

### Active Tab Behavior in Tiled Mode
- The `activeChartTabId` remains tracked and functional even in tiled mode
- The loading indicator only shows for the currently active tab (`isLoadingBars && tab.id === activeChartTabId`)
- `ChartHeader`, `Toolbar`, and `OhlcvBar` remain visible above the grid and reflect the active tab's state (they are not duplicated per tile)
- `ChartToolDock` is hidden in tiled mode (dock is per-chart and would be redundant/confusing in multi-chart view)
- Switching back to single mode restores the full single-chart experience including the tool dock

### What Each Tile Shows
- Each tile renders a full `ChartCanvas` with its own tab's:
  - Instrument data
  - Display bars
  - Events
  - Indicators/overlays
  - Drawings
  - Viewport state
  - Indicator pane height

## Practical Limits (Honest Assessment)
- **Comfortable range**: 2-4 charts side-by-side on a typical 1920px desktop display (480px min per tile)
- **Usable range**: Up to 6-8 charts with smaller effective tile sizes on wider monitors
- **Beyond 8+**: Charts become quite small; grid wraps to multiple rows which may require scrolling
- **No ChartToolDock in tile mode**: The dock is intentionally hidden in tiled view to avoid redundancy. Users should switch to single mode for detailed drawing tool access.
- **Shared header**: The chart header, toolbar, and OHLCV bar only reflect the active tab in tiled mode. This is a known limitation — each tile doesn't get its own header.

## What Remains for Later Sheets Phase
- Per-tile headers showing each chart's instrument info independently
- Per-tile tool dock or floating tool controls
- Sheet concept (named workspace configurations with saved layouts)
- Resizable tile boundaries (drag to resize individual chart panes)
- Tile maximize/minimize (double-click to expand a tile to full, click again to restore)
- Tile grouping (group related charts together)
- Persisted tile layouts per workspace

## Validation
- ✅ `npm run typecheck:renderer` — PASSED
- ✅ `npm run typecheck:electron` — PASSED
- ✅ `npm run build:electron` — PASSED
- ✅ `npm run build:renderer` — PASSED (467 modules, 4.12s)
- ✅ `npm run build` — PASSED (full pipeline)
- No Rust/Tauri code changed — `cargo check` not needed
- No Tauri/platform behavior changed — `npm run tauri:build` not needed
- No renderer file outside `src/platform/*` imports Tauri packages

## Any Incomplete Items
- Sheets: Not implemented (separate future phase)
- Per-tile headers: Not implemented (shared header reflects active tab only)
- Per-tile tool dock: Not implemented (dock hidden in tile mode)
- Resizable tile boundaries: Not implemented
- Tile maximize/minimize: Not implemented
- Persisted tile layouts: Not implemented

## Exact Next Recommended Prompt
"Implement sheets in chart window like AmiBroker. Create a backup first. Sheets should be named workspace configurations that save/restore chart tab layouts, instruments, timeframes, indicators, and drawings. Add a sheet selector UI, sheet save/load functionality, and sheet management (create, rename, delete). Keep changes modular and validate with npm run build after each phase."
