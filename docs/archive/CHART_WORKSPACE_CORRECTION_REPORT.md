# Chart Workspace Correction Report

## Update Note
This report is now partially superseded by `CHART_WINDOW_SHEETS_REFACTOR_REPORT.md`. Bottom sheet tabs still remain inside the chart window as documented here, but sheet ownership/persistence no longer use the older global/localStorage behavior referenced later in this historical report.
The zoom notes in this historical report are also partially superseded by `CHART_WORKSPACE_UX_STABILITY_REPORT.md`: wheel zoom now anchors to the current cursor focus rather than to the viewport center.

## Review
All requested workspace corrections implemented. Removed wrong UI placements, fixed wheel zoom drift, added proper volume pane removal, price scale gap, AmiBroker-style bottom sheet tabs, and moved tile controls to Menu > View. Build passes and portable Windows output is ready.

## Update: 2026-04-01 Strict Correction Pass
Performed follow-up strict visual-correction pass. Found and fixed three issues:
1. **Extra tab scrollbar**: Hidden tab list scrollbar via CSS class `tab-strip-scroll` in global.css. Was visible between last tab and `+` when tabs overflowed.
2. **Scrollbar moves during zoom**: Added `prevVisibleSpanRef` to detect zoom vs scroll. Scrollbar now stays stable during zoom.
3. **Sheet tabs location**: Moved SheetTabs inside chart workspace (AmiBroker style). Now appears at bottom of chart window, not app level.
- Full build pipeline passed including `npm run tauri:portable:win`.
- See `MIMO_CORRECTION_PASS_REPORT.md` for detailed report.

## Backup Created
`D:\TA Projects\EOD Charting Platform\backups\pre_workspace_correction_20260401_110412`
`D:\TA Projects\EOD Charting Platform\backups\pre_correction_pass_20260401` (2026-04-01 correction pass)

## Files Added
- `src/components/SheetTabs.tsx` — New AmiBroker-style bottom sheet tabs component
- `CHART_WORKSPACE_CORRECTION_REPORT.md`

## Files Modified
- `src/components/ChartTabs.tsx` — Removed tile toggle button (▦/▣), removed layoutMode imports
- `src/components/Toolbar.tsx` — Removed all sheet save/select/rename/delete controls (~150 lines removed)
- `src/components/ChartCanvas.tsx` — Pass `volumePct: 0` to ChartEngine constructor
- `src/engine/ChartEngine.ts` — Fixed wheel zoom (removed deltaX drift), added `priceAxisGap` to ChartLayout
- `src/engine/Renderer.ts` — Updated `drawYAxis` to accept `axisGap` parameter for right-side spacing
- `src/RootApp.tsx` — Added SheetTabs at bottom, updated tile grid to support multiple layouts
- `src/store/chartStore.ts` — Extended layoutMode to include 'tile-h', 'tile-v', 'tile-grid'; added `menu:setLayoutMode` handler; Sheet interface updated
- `electron/menuBar.ts` — Added Chart Layout submenu under View with Single/Auto Tile/2-H/2-V/4-Grid options

## Markdown Files Updated
- `CHART_WORKSPACE_CORRECTION_REPORT.md` (created)

## Key Chart/Workspace Corrections Completed

### What Old UI/Workflow Was Removed
- ✅ **Tile toggle from tab strip** — Removed the ▦/▣ button that was incorrectly placed between chart tabs and the + button
- ✅ **Sheet toolbar controls** — Removed all sheet save (💾), sheet selector dropdown, rename (✎), and delete (×) buttons from the toolbar
- ✅ **Wheel zoom horizontal drift** — Removed `Math.abs(event.deltaX) > Math.abs(event.deltaY)` condition that caused unintended horizontal panning during vertical wheel zoom

### Default Volume Pane Removal
- ✅ **Properly fixed** — ChartEngine now receives `volumePct: 0` via constructor config (`new ChartEngine(containerRef.current, { volumePct: 0 })`)
- ✅ Volume rendering is completely disabled by default
- ✅ Volume support preserved for future explicit enablement via the config parameter

### Right-Side Chart/Price-Scale Spacing
- ✅ **Implemented via `priceAxisGap`** — Added `priceAxisGap: 8` to ChartLayout
- ✅ `drawYAxis` function updated to accept `axisGap` parameter
- ✅ Price axis is shifted 8px left from the chart edge, creating a clean visual gap
- ✅ Applied to both main price axis and indicator pane axes

### Wheel Zoom Behavior Correction
- ✅ **Fixed** — Wheel handler now only pans horizontally when `shiftKey` is pressed
- ✅ **Fixed (2026-04-01)** — Zoom pivot changed from mouse position to viewport center; wheel zoom changes scale only without horizontal drift
- ✅ Normal wheel (vertical) only zooms in/out at viewport center
- ✅ Horizontal movement still available via: left/right arrow keys, scrollbar dragging, chart panning with mouse drag, shift+wheel

### Extra Tab-Strip Control Removal
- ✅ **Removed** — The tile toggle button (▦/▣) that appeared between chart tabs and the + button is gone
- ✅ Tab strip now has clean browser-like appearance: tabs → + button

### Sheets Now Work at the Bottom
- ✅ **AmiBroker-style sheet tabs** — New `SheetTabs` component renders at the bottom of the chart window
- ✅ Sheet tabs look like workbook tabs: `Sheet1 | Sheet2 | Sheet3 | +`
- ✅ **Click** a sheet tab to load that workspace
- ✅ **Double-click** a sheet tab to rename it (uses native prompt dialog)
- ✅ **× button** on each sheet tab to delete it (with confirmation)
- ✅ **+ button** creates a new sheet from the current workspace state
- ✅ Each sheet preserves its own chart tabs, instruments, timeframes, indicators, drawings, viewports, and layoutMode
- ✅ Sheets persist to localStorage (`eod-chart.sheets.v1`)

### Tile Layouts Added
- ✅ **Auto Tile** — `repeat(auto-fill, minmax(480px, 1fr))` — responsive grid
- ✅ **2-Chart Horizontal** — `1fr 1fr` — side-by-side split
- ✅ **2-Chart Vertical** — `1fr 1fr` rows — top/bottom split
- ✅ **4-Chart Grid** — `1fr 1fr` columns × `1fr 1fr` rows — 2×2 grid

### Tile Controls Location
- ✅ **Moved to Menu > View > Chart Layout** submenu
- ✅ Options: Single Chart, Auto Tile, 2-Chart Horizontal, 2-Chart Vertical, 4-Chart Grid
- ✅ No tile controls in tab strip or toolbar anymore

## Validation
- ✅ `npm run typecheck:renderer` — PASSED (2026-04-01)
- ✅ `npm run typecheck:electron` — PASSED (2026-04-01)
- ✅ `npm run build:electron` — PASSED (2026-04-01)
- ✅ `npm run build:renderer` — PASSED (2026-04-01)
- ✅ `npm run build` — PASSED (full pipeline, 2026-04-01)
- ✅ `npm run tauri:portable:win` — PASSED (2026-04-01)

## Runnable Build Output
- **`npm run tauri:portable:win` was run**: YES
- **Output location**: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\`
- **Launcher to use**: `Launch Portable EOD Chart.cmd`
- **Contents**:
  - `EOD Chart.exe` — Tauri portable executable
  - `Launch Portable EOD Chart.cmd` — Batch launcher
  - `portable-data/` — Runtime state directory
  - `README.txt` — Usage instructions

## Any Remaining Limitations
- Sheet rename uses native `prompt()` dialog (not inline editing) — functional but not polished
- No sheet import/export yet
- No sheet descriptions/metadata
- No sheet reordering
- Tile layouts don't persist per-sheet (layoutMode is saved but specific grid dimensions are computed at render time)
- Tauri menu bar does not yet have the Chart Layout submenu (only Electron menuBar.ts was updated)

## Exact Next Recommended Prompt
"Add the Chart Layout submenu to the Tauri menu bar (src-tauri-shell). Then add sheet import/export functionality: export current sheet as JSON file, import sheet from JSON file. Add a small sheet management dialog accessible from the sheet bar. Validate with npm run build and npm run tauri:portable:win."
