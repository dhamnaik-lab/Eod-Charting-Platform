# CHART_WINDOW_UI_GAP_FOLLOWUP_REPORT

Date: 2026-04-02

## Scope

This was a narrow renderer/UI follow-up based on a comparison against TradingView Lightweight Charts as a chart-surface benchmark, not as a workspace-shell template.

Only the top two low-risk items were implemented:

1. Visually fuse the single-chart top band so `ChartHeader.tsx` and `Toolbar.tsx` read as one continuous chart header area.
2. Strengthen indicator-pane separators and pane-title presentation so pane boundaries feel more deliberate.

No sheet/sidebar/runtime/model work was changed in this pass.

## Problems Before This Pass

- The single-chart top area still read as two stacked bars with similar but separate visual systems:
  - `ChartHeader.tsx` for symbol/price/OHLC/timeframe
  - `Toolbar.tsx` for studies/mode/magnet/add-study
- That split made the chart header feel more fragmented than the underlying chart deserved.
- Indicator panes were functional, but pane boundaries were still visually weak.
- Pane titles rendered correctly after the previous truncation fix, but they still felt like plain text dropped onto the canvas rather than a deliberate pane title treatment.
- The price-pane to indicator-pane boundary relied heavily on a thin resize strip, which was easy to miss.

## What Changed

### 1. Top-band visual fusion

Files:

- `src/components/ChartHeader.tsx`
- `src/components/Toolbar.tsx`
- `src/RootApp.tsx`

Changes:

- `ChartHeader.tsx` now uses a transparent band background so it visually belongs to the shared `chartChromeStyle` shell instead of reading like an isolated bar.
- Header group blocks now use a more unified gradient/border treatment with softer borders and consistent inset highlight.
- Symbol, context, price-label, OHLC-label, and timeframe container tones were slightly tightened so the whole area reads as one system.
- `Toolbar.tsx` now also uses a transparent band background and a subtle top divider instead of behaving like a separate second toolbar.
- The `Studies` caption was de-emphasized from a pill-like badge into a lighter chart-control caption so it no longer competes with symbol/price identity.
- Applied-study chips were reduced from badge-heavy pills into smaller rounded controls that sit more naturally inside the shared top band.
- `RootApp.tsx` now gives the combined header region a cleaner continuous shell treatment through the existing `chartChromeStyle`.

Result:

- The single-chart top area still has two rows for information density, but it now reads as one chart header band rather than two unrelated rows.

### 2. Pane separator and pane-title polish

Files:

- `src/engine/Renderer.ts`
- `src/components/ChartCanvas.tsx`

Changes:

- `drawPaneTitle()` in `Renderer.ts` now:
  - draws a subtle separator line at the top of each indicator pane
  - renders the pane title inside a compact rounded title rail
  - extends a faint continuation rule to the right so the pane header feels intentional
- The chart-side pane resize handle in `ChartCanvas.tsx` is now more visible and labeled:
  - wider visible splitter area
  - centered grip lines
  - compact `Indicator pane` / `Indicator panes` caption

Result:

- Indicator panes now read more like explicit stacked panes and less like loosely divided regions inside one canvas.

## What Was Preserved Intentionally

- Per-chart-window Sheets
- Larger bottom sheet tabs
- In-strip new-sheet `+`
- Left sidebar pin/auto-hide behavior
- Sidebar readability refinements
- Cursor-anchored zoom behavior
- Recent zoom-stability refinements
- Shared bottom X-axis renderer structure
- Existing chart data/state ownership
- Electron fallback runtime
- `src/platform/*` runtime seam
- Active `src-tauri-shell` backend path

## Files Modified

- `src/components/ChartHeader.tsx`
- `src/components/Toolbar.tsx`
- `src/RootApp.tsx`
- `src/components/ChartCanvas.tsx`
- `src/engine/Renderer.ts`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260402_160229_chart_window_ui_gap_followup`

## Markdown Updated

- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHART_WINDOW_UI_GAP_FOLLOWUP_REPORT.md`

## Validation Commands

Passed validation for this pass:

- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `npm run tauri:portable:win`

Portable packaging note:

- The first `tauri:portable:win` attempt failed because the previous staged `release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe` was still running and locked.
- After stopping that stale portable process, `npm run tauri:portable:win` succeeded without code changes.

## Expected Portable Output

- Output folder: `release\tauri-portable-win\EOD Chart Portable`
- Launcher: `release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Remaining Limitations

- The single-chart top area is still structurally two rows; this pass only fused them visually.
- Tiled headers were preserved in this pass and were not broadly reworked.
- Pane management remains renderer-driven rather than exposing a richer pane-control model.
- This pass improves pane boundaries visually, but it does not add new pane actions or pane reordering behavior.
