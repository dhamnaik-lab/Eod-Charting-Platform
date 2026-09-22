# Chart Tools Additions Report

Date: 2026-03-31

## Summary

This report is historical for the earlier chart-tools additions pass.

The current hardened baseline is documented in `CHART_TOOLS_HARDENING_REPORT.md`, which supersedes this file for:

- named layout fidelity
- the current active-tool global/per-tab decision
- the current magnet global/per-tab decision
- the next recommended post-hardening tool phase

This pass added practical chart-interaction improvements for daily EOD use without changing the runtime seam, touching Rust/Tauri backend code, or broadly redesigning the UI.

The work focused on:

- clearer crosshair presentation
- more predictable zoom and pan behavior
- visible OHLC and volume readout on hover
- a cleaner drawing-tool dock with clearer active-state feedback
- safer drawing selection and deletion behavior
- preventing drawing-mode state from leaking across chart tabs

The existing drawing architecture in `src/engine/*` and `src/store/chartStore.ts` already provided a strong base. This pass extended that foundation rather than replacing it.

## Tooling Added Or Improved

### Crosshair and hover readout

- Improved crosshair contrast, label clamping, and center-point visibility
- Added an in-chart hover card showing:
  - date
  - open
  - high
  - low
  - close
  - absolute and percent change
  - volume

### Zoom and pan usability

- Added shift-wheel horizontal pan support
- Improved wheel zoom scaling so zoom speed is more consistent across mouse-wheel delta sizes
- Added clearer `grabbing` cursor feedback while panning or dragging drawings
- Restricted drag/pan initiation to the left mouse button

### Drawing tools framework polish

- Reworked the chart tool dock so the primary daily-use tools are prominent:
  - cursor
  - horizontal line
  - vertical line
  - trend line
- Grouped the broader tool set behind an advanced toggle instead of showing all tools equally
- Added explicit active-mode hints and selection-state hints in the dock and chart canvas
- Added keyboard shortcuts for common tools:
  - `H` horizontal line
  - `V` vertical line
  - `L` trend line
  - `C` cursor
  - `M` magnet toggle
  - `Esc` remains the cancel/clear path where already supported by current interaction handlers

### Selection and delete behavior

- `Delete` / `Backspace` now deletes only the selected drawing
- Removed the older unsafe fallback that deleted the last drawing when nothing was selected
- Kept `Shift+Delete` as the explicit clear-all path
- Tool switching now clears stale drawing-properties state and selection where appropriate

### Chart-tab stability

- Active drawing mode now resets to `cursor` on chart-tab create, activate, and close transitions
- Drawing-properties state also resets on those transitions
- This avoids tool-mode leakage across charts and keeps multi-chart workspace behavior more predictable

## Tool Foundation Added For Future Passes

This pass did not introduce a completely new drawing subsystem because one already existed. The new foundation work was architectural cleanup and UX scaffolding on top of the existing engine:

- clearer separation of primary versus advanced tools in `ChartToolDock`
- explicit per-mode hints and chart-side status badges
- safer selection/delete rules that make future tool expansion less risky
- chart-tab tool reset rules that reduce cross-chart state bleed
- keyboard affordances for the most common desktop drawing actions

This is a good base for future additions like:

- better selection handles and edit affordances
- duplicate/copy drawing actions
- a drawing list or object manager
- stronger snap behavior
- richer text/label tools

## Persistence Status

Persistence was included indirectly through the existing chart-state architecture rather than through new storage work in this pass.

- Drawings were already part of the persisted chart workspace model
- This pass preserved and continued using that existing drawing persistence
- Active tool mode, live selection, and open properties-panel state remain intentionally ephemeral UI state and are not persisted across chart/tab transitions

So the answer for this pass is:

- drawing persistence: preserved and included through the existing architecture
- tool-mode persistence: intentionally deferred / not added

## Files Added

- `CHART_TOOLS_ADDITIONS_REPORT.md`

## Files Modified

- `src/store/chartStore.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/Crosshair.ts`
- `src/components/ChartToolDock.tsx`
- `src/components/ChartCanvas.tsx`

## Backup Location

- `backups/pre_opencode_changes_20260331_000001_chart_tools_additions`

## Markdown Files Updated

- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `FILE_INVENTORY.md`
- `CHART_TOOLS_ADDITIONS_REPORT.md`

## Validation

Verified after the chart-tools pass:

- `npm run build`
- `cargo check --manifest-path src-tauri-shell/Cargo.toml`
- `npm run tauri:portable:win`
- bounded launch of:
  - `release/tauri-portable-win/EOD Chart Portable/EOD Chart.exe`
  - local Electron fallback through `node_modules/electron/dist/electron.exe`
- launcher-path evidence:
  - `Launch Portable EOD Chart.cmd` updated `portable-data/logs/app-runtime.log`
- seam-purity check:
  - no active renderer TypeScript file outside `src/platform/*` imports `@tauri-apps/*`

Validation was honest but bounded:

- build and startup level: verified
- interactive visual/manual verification of the new chart tools: not fully claimed in this pass

## What Remains For The Next Chart-Tools Pass

- manual Windows smoke validation of the new chart tools inside the running portable Tauri app
- tighter advanced-tool UX for tools beyond the primary set
- better selected-drawing affordances and possibly a drawing list
- optional drawing duplication and stronger object-management actions
- decide whether any chart-tool commands should surface naturally in command palette or menus

## Runtime Scope

This pass did not add or change runtime-specific code outside the existing frontend chart layer.

- no new Electron business-surface changes
- no new Tauri backend changes
- no direct runtime imports were added outside `src/platform/*`
