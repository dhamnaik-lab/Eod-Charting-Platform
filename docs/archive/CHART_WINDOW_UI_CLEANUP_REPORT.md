# Chart Window UI Cleanup Report

## Update Note
This report remains accurate for the shell-cleanup direction. The left-sidebar interaction model is now partially superseded by `CHART_WORKSPACE_UX_STABILITY_REPORT.md`, which adds click-based pin/auto-hide behavior and larger left-rail/sidebar controls without changing the sidebar's functional role.

## Goal
Clean up the chart-window shell so it behaves more like a disciplined desktop charting workspace and less like a stacked web dashboard.

## Guiding Model
- Primary model: AmiBroker-style desktop window ownership
- Supporting cues: TradingView/TC2000 clarity around chart-surface priority and tool separation

## Previous Problems
- The toolbar still behaved like an indicator summary bar because active indicators appeared as chip/badge controls.
- The left sidebar mixed too many heavy navigation cues at once: full vertical rail labels, a loud header, a scope badge, a clear button, and a strong A-Z jump strip.
- The right drawing rail read like a command wall because it stacked section headers, text buttons, and a status card.
- The chart still had a floating tool-status card that felt more like dashboard UI than chart-native UI.
- The bottom status bar exposed low-value developer/status details all the time, which added noise to the workspace.

## Changes Made
- `src/components/Toolbar.tsx`
  - removed the old chip-style indicator row
  - active indicators now render as compact plain-text controls with lighter separators
  - the toolbar now reads as an action strip instead of a summary banner
- `src/components/Sidebar.tsx`
  - reduced vertical rail labels to compact short labels
  - removed the redundant active-symbol badge from the sidebar header
  - simplified the symbol search row
  - reduced padding, row height, header scale, and the visual weight of the A-Z jump strip
- `src/components/ChartToolDock.tsx`
  - narrowed the dock
  - removed section-label chrome
  - removed the status card block
  - kept the existing tool behavior but made the rail feel closer to a compact drawing toolbar
- `src/components/ChartCanvas.tsx`
  - converted tool-status treatment into subtle text instead of a floating card block
- `src/components/StatusBar.tsx`
  - removed always-visible low-value developer chrome
  - kept the footer denser and more chart-relevant

## What Was Preserved
- chart engine behavior
- indicator calculations
- sheet ownership and sheet behavior
- tile behavior
- workspace/state architecture
- Electron fallback and the `src/platform/*` runtime seam

## Files Modified
- `src/components/Toolbar.tsx`
- `src/components/Sidebar.tsx`
- `src/components/ChartToolDock.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/StatusBar.tsx`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Files Added
- `CHART_WINDOW_UI_CLEANUP_REPORT.md`

## Backup Location
- `backups/pre_opencode_changes_20260402_001323_chart_window_ui_cleanup`

## Validation Commands
- `npm run typecheck:renderer`
- `npm run typecheck:electron`
- `npm run build`
- `npm run tauri:portable:win`

## Runnable Output
- Output path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Remaining Limitations
- This pass intentionally did not redesign the overall symbols/watchlist information architecture; it only reduced its visual weight.
- The drawing rail still uses text abbreviations rather than icons.
- Manual visual validation inside the staged portable app is still the right next check for spacing and readability in real tiled/single workflows.
