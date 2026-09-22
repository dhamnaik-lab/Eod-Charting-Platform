# Chart Architecture Audit

## Scope

- Audit date: 2026-03-31
- Active frontend baseline: React + Vite + TypeScript
- Active Tauri backend path: `src-tauri-shell`
- Renderer-facing runtime seam: `src/platform/*`
- Legacy excluded from this audit: `src-tauri` and the older `src/app.js` + `src/modules/*.js` path
- This is an architecture/status audit only. No chart-tool implementation work was done here.

## Update Note

On April 1, 2026, the sheet ownership model was refactored after this audit. The current live architecture now treats sheets as per-chart-window state inside `ChartTabState`, and named layouts/workspace autosave persist that ownership model through the shared workspace serializer in `src/store/chartStore.ts`.

## Current Chart Architecture Summary

The active chart system is already organized as a layered renderer-side stack:

1. React shell components assemble the workspace and expose chart controls.
2. A single Zustand store (`src/store/chartStore.ts`) holds chart tabs, viewport state, indicators, drawings, hover state, and chart UI flags.
3. `ChartCanvas.tsx` is the React host for the chart viewport. It creates the imperative chart engine, forwards store state into it, and translates engine events back into store updates.
4. `ChartEngine.ts` is the core canvas runtime. It owns pointer interaction, hit testing, panning, zooming, drawing creation, drawing previews, and render scheduling.
5. `Renderer.ts`, `Crosshair.ts`, `ScaleManager.ts`, and `Indicators.ts` are helper layers under the engine:
   - `Renderer.ts` draws primitives and drawing shapes.
   - `Crosshair.ts` computes and renders crosshair state.
   - `ScaleManager.ts` handles viewport math and scales.
   - `Indicators.ts` converts indicator definitions into renderable series.
6. Desktop persistence and data loading stay behind `src/platform/*`, which keeps the chart renderer runtime-agnostic across Electron and Tauri.

This means the current chart engine is not a blank slate. It already supports price rendering, volume rendering, indicator panes, crosshair, zoom/pan, event markers, drawings, drawing selection/editing, and workspace persistence.

## Major Chart Files / Modules and Roles

| File | Role |
| --- | --- |
| `src/main.tsx` | Active React entrypoint. Confirms the current app boots through the TypeScript renderer path. |
| `src/RootApp.tsx` | Composes the chart workspace, active chart canvas, chart chrome, and dialogs. Passes the active tab state into `ChartCanvas`. |
| `src/store/chartStore.ts` | Main chart/application store. Owns chart tabs, active tab, instrument loading, indicators, drawings, viewport, hover bar, workspace autosave, menu-command handling, and layout restore. |
| `src/components/ChartCanvas.tsx` | React host around the imperative canvas engine. Handles keyboard shortcuts, indicator drag/drop, scrollbar sync, hover readout UI, drawing context menu, and drawing properties modal. |
| `src/engine/ChartEngine.ts` | Core chart engine. Manages canvases, render loop, pointer listeners, viewport changes, crosshair updates, drawing creation, drawing preview, drawing hit testing, drawing drag editing, and event emission back to React. |
| `src/engine/Renderer.ts` | Drawing primitives for candles, volume, axes, grid, indicators, event markers, tool shapes, and selection handles. |
| `src/engine/Crosshair.ts` | Crosshair state computation and axis-label rendering. |
| `src/engine/ScaleManager.ts` | X/Y scale construction, viewport clamp/zoom/pan math, and X/Y tick generation. |
| `src/engine/Indicators.ts` | Converts indicator definitions into overlay or pane render bundles using `technicalindicators`. |
| `src/engine/types.ts` | Shared chart contracts: OHLC bars, viewport, scale interfaces, drawing union types, indicator union types, and chart engine event types. |
| `src/indicators/catalog.ts` | Indicator catalog, defaults, placement metadata, and factory helpers. |
| `src/components/Toolbar.tsx` | Timeframe, adjusted/raw mode, magnet toggle, indicator add/edit/remove UI. |
| `src/components/ChartToolDock.tsx` | Tool dock for drawing mode selection, lock/delete/clear actions, undo-last, and pane reset. |
| `src/components/Sidebar.tsx` | Secondary chart tooling hook for indicator browsing and drag/drop into the chart. |
| `src/components/ChartHeader.tsx` | Main instrument header and quote summary tied to hover bar / latest bar. |
| `src/components/OhlcvBar.tsx` | Compact OHLCV readout tied to hover bar / latest bar. |
| `src/components/ChartTabs.tsx` | Multi-chart tab strip. |
| `src/components/LayoutManagerDialog.tsx` | Named chart layout save/load/delete UI. |
| `src/components/CommandPalette.tsx` | Symbol search and a few app-level commands. Not a full chart-tool command surface yet. |
| `src/platform/desktop.ts`, `src/platform/shell.ts`, `src/platform/tauriDesktop.ts`, `src/platform/types.ts` | Runtime seam for chart data loading, settings persistence, saved layouts, watchlists, and menu-command bridging. |
| `electron/menuBar.ts` and `src-tauri-shell/src/main.rs` | Electron and Tauri menu bridges that forward chart commands into the renderer store. |

## Rendering Pipeline Summary

The rendering path is currently:

1. `RootApp.tsx` selects the active chart tab and passes `bars`, `events`, `overlays`, `drawings`, `viewport`, and `indicatorPaneHeight` into `ChartCanvas`.
2. `ChartCanvas.tsx` pushes those props into `ChartEngine` through `setSymbol`, `loadBars`, `setEvents`, `setOverlays`, `setDrawings`, `setViewport`, `setSelectedDrawingId`, `setIndicatorPaneHeight`, and `setMagnetEnabled`.
3. `ChartEngine.renderBase()` performs the static render pass:
   - builds renderable indicator bundles
   - computes chart layout
   - computes price and pane scales
   - draws grid, candles, overlays, drawings, event markers, last-price marker, volume pane, indicator panes, axes
4. `ChartEngine.renderOverlay()` performs the dynamic render pass:
   - draws the crosshair
   - draws hovered event tooltip
   - draws tool previews for active drawing modes
5. `Renderer.ts` contains the actual drawing functions for primitives and tool shapes.

Important characteristics:

- The engine uses two canvases:
  - base canvas for candles, indicators, drawings, axes, and static chart content
  - overlay canvas for crosshair and drawing previews
- Indicator overlays and pane indicators are already separated by `Indicators.ts`.
- Drawings are rendered in the price pane, not in volume or indicator panes.
- Indicator panes are render-only right now; interaction logic remains price-pane-centric.

## Interaction Pipeline Summary

Interaction is split between the engine and the React host:

### Engine-owned interactions

- Pointer move on overlay canvas:
  - updates crosshair
  - emits `crosshairMove`
  - updates panning
  - updates active drawing drag edits
  - updates cursor based on drawing hit testing
- Pointer down on overlay canvas:
  - creates drawings when a non-cursor tool is active
  - selects drawings
  - starts drawing drag state
  - starts chart pan when empty space is dragged
- Mouse wheel on overlay canvas:
  - shift wheel or horizontal wheel pans
  - regular wheel zooms around the pointer pivot
- Double click on overlay canvas:
  - resets viewport in cursor mode
  - cancels pending drawing anchors in drawing mode

### React-host-owned interactions

- `ChartCanvas.tsx` handles:
  - keyboard shortcuts
  - native horizontal scrollbar sync
  - indicator drag/drop from the sidebar
  - drawing context menu
  - drawing properties modal
  - indicator-pane resize handle
- `chartStore.ts` receives engine events and turns them into persisted tab state:
  - `crosshairMove` -> `hoverBar`
  - `viewportChange` -> active tab viewport
  - `drawingComplete` -> add drawing
  - `drawingUpdate` -> update drawing
  - `drawingSelect` -> update selection

### Current keyboard flow

The chart viewport already handles:

- `H` -> horizontal line toggle
- `V` -> vertical line toggle
- `L` -> trend line toggle
- `C` -> cursor mode
- `M` -> magnet toggle
- arrow keys -> symbol navigation / viewport nudging
- `+`, `-`, `0`, `Home`, `End` -> zoom / reset / jump
- `Delete`, `Backspace`, `Shift+Delete` -> delete selected / clear all
- `Escape` -> cancel drawing mode and clear selection/UI overlays

## Chart State / Store Summary

The store model is already substantial.

### Per-chart-tab state

Each `ChartTabState` already carries:

- instrument identity and metadata
- raw bars and display bars
- corporate-action marker events
- timeframe
- viewport
- hover bar
- visible bar count
- indicators
- drawings
- selected drawing id
- indicator pane height
- adjusted/raw hydration status
- sheets
- active sheet id
- per-window layout mode

### Global chart/workspace state

The store also owns:

- active chart tab id
- global active drawing tool
- global magnet toggle
- drawing properties modal target
- chart chrome visibility flags
- database/import/download/layout dialog flags
- command palette state

### Important architectural note

Chart content and sheet ownership are now per-tab, but some tool state is still global:

- `activeDrawingTool`
- `magnetEnabled`
- `drawingPropertiesDrawingId`

The current hardened behavior is:

- `sheets`, `activeSheetId`, and `layoutMode` are now owned by each chart window/tab and no longer load/save through a separate global sheet path
- `activeDrawingTool` remains global and intentionally ephemeral
- it resets to `cursor` on chart-tab create/activate/close, workspace hydration, and named layout load
- `magnetEnabled` remains global by design as a chart-input preference rather than a per-tab persisted value
- `drawingPropertiesDrawingId` remains global UI state and is cleared alongside tool resets
- sheet actions are explicitly tab-scoped:
  - save/load/delete/rename now take the owning chart window id
  - loading a sheet restores only that chart window instead of replacing the full top-level workspace

## Current Toolbar / Tooling Hooks

Current chart-tool-related hooks already exist in multiple places:

- `Toolbar.tsx`
  - timeframe buttons
  - raw/adjusted toggle
  - magnet toggle
  - indicator add/edit/remove
- `ChartToolDock.tsx`
  - cursor
  - horizontal line
  - vertical line
  - trend line
  - advanced tool buttons for ray, arrow, rectangle, text, channel, fib, gann
  - drawing properties / lock / selection clear / delete / undo / clear all
- `Sidebar.tsx`
  - indicator catalog browser
  - drag/drop indicator injection into the chart
- `electron/menuBar.ts`
  - chart, drawing, and indicator menu commands for Electron
- `src-tauri-shell/src/main.rs`
  - equivalent menu-command forwarding for Tauri
- `CommandPalette.tsx`
  - symbol loading and a few app-level commands
  - currently not a strong chart-tool command surface

## Current Persistence Hooks

There are two active persistence paths for chart workspace state:

### 1. Background workspace autosave

`chartStore.ts` serializes:

- active chart tab id
- chart tabs
- instrument
- timeframe
- viewport
- indicators
- drawings
- indicator pane height
- per-chart-window sheets
- per-chart-window active sheet id
- per-chart-window layout mode

This is written through `src/platform/*` via:

- `getSetting('workspace.chartLayout.v1')`
- `setSetting({ key: 'workspace.chartLayout.v1', value })`

Important behavior:

- autosave only runs when an active database is open
- workspace autosave is database-scoped because settings are stored behind the active desktop database connection

### 2. Named layout save/load

`LayoutManagerDialog.tsx` uses:

- `getSavedLayouts`
- `saveLayout`
- `loadLayout`
- `deleteLayout`

Named layouts now use the same serialized workspace shape as autosave:

- `activeChartTabId` is saved explicitly
- the same parser/sanitizer path is used for named layout restore and autosave restore
- drawings continue to round-trip through the same JSON-serializable workspace payload
- per-window `sheets`, `activeSheetId`, and `layoutMode` now round-trip through the same payload

That removes the earlier named-layout fidelity gap for the active tab.

## Multi-Pane / Multi-Chart Behavior Notes

### Multi-chart

- The app supports multiple chart tabs.
- Each tab now owns its own instrument, bars, indicators, drawings, selection, viewport, pane height, sheets, active sheet id, and layout mode.
- Activating a tab resets the global drawing tool to cursor and closes drawing properties.
- Workspace hydration and named layout load also reset the global drawing tool to cursor.
- Magnet state remains global across tabs by design.
- Tab hydration is lazy when switching to a tab that has an instrument but stale bar data.
- In tiled mode, each rendered tile now shows the sheet strip for that owning chart window, and sheet actions target that tile's tab id.
- Tile compatibility is still partial because the overall single/tiled view selection still follows the active chart window's `layoutMode`.

### Multi-pane

- The price pane and volume pane are always present.
- Indicator panes are added for indicators whose placement is `pane`.
- Pane height is a single per-tab number shared across all indicator panes.
- The pane layout is simple and consistent, but not deeply configurable.

### Important limitation

Pointer-state math is price-pane-centric:

- `ChartEngine.getPointerState()` clamps Y to the price pane.
- Drawing tools and hit testing operate in the price pane.
- Indicator panes are rendered, but not part of a richer interaction model yet.

## Clear Extension Points

The safest extension points for chart tools are the existing drawing contracts and switch points:

1. `src/engine/types.ts`
   - extend `DrawingTool`
   - extend `ChartDrawing`
2. `src/engine/ChartEngine.ts`
   - add preview creation
   - add drawing creation
   - add hit testing
   - add drag-update behavior
3. `src/engine/Renderer.ts`
   - add drawing render logic
4. `src/store/chartStore.ts`
   - no new persistence mechanism is needed for basic client-side tools
   - new drawing kinds will already flow through the existing autosave/layout persistence paths if they stay JSON-serializable
5. `src/components/ChartToolDock.tsx`, `Toolbar.tsx`, `electron/menuBar.ts`, `src-tauri-shell/src/main.rs`
   - expose the tool through UI/menu surfaces

This is the main architectural conclusion:

- chart tools can be added without rewriting the chart engine
- chart tools can usually be added without new runtime imports outside `src/platform/*`
- the current model is incremental-friendly, but each new tool still requires touching multiple hard-coded switch locations

## Risk Areas

### 1. Monolithic tool logic in `ChartEngine.ts`

The drawing lifecycle is real, but heavily centralized:

- tool creation
- preview logic
- hit testing
- drag behavior

all live in one large engine file.

This is the main maintainability risk, not a reason to rewrite.

### 2. Tool rendering is also hard-coded

`Renderer.drawDrawing()` branches on every drawing kind. That is acceptable for a small set, but every new drawing adds more branching in both engine and renderer.

### 3. Multi-chart tool state is only partially isolated

Drawings are per-tab, but active tool mode and magnet state are global. The current hardening pass formalized this instead of moving state per-tab:

- tool mode is intentionally global + ephemeral
- magnet is intentionally global

That is low-risk for the current baseline, but full per-tab tool isolation remains deferred.

### 4. Layout persistence is uneven

The earlier named-layout `activeChartTabId` gap is now closed, but persistence still depends on JSON-serializable drawing payloads and does not yet validate drawing versions/schema beyond the current TypeScript shape.

### 5. Indicator panes are not a first-class interaction surface

The current interaction model is centered on the price pane. Any future tool that needs pane-local interactions will be a bigger step than simple price-pane drawings.

### 6. No chart-specific automated tests were found

A repo scan did not surface chart-focused `.test` / `.spec` files. Current chart behavior appears to be enforced mainly by manual runtime verification.

## Bottom-Line Assessment

- The current chart architecture is already a functioning chart engine, not just a renderer shell.
- Core engine files are `ChartEngine.ts`, `Renderer.ts`, `ScaleManager.ts`, `Crosshair.ts`, `Indicators.ts`, and `types.ts`.
- Rendering and interaction are meaningfully separated:
  - rendering helpers in `Renderer.ts`
  - input/stateful orchestration in `ChartEngine.ts`
  - app/tab state in `chartStore.ts`
  - React shell/UI glue in `ChartCanvas.tsx`
- The safest extension point for chart tools is still the existing drawing union plus the engine/renderer/store flow.
- Overlays already exist in two forms:
  - indicator overlays/panes
  - price-pane annotations/drawings
- Crosshair / hover / zoom / pan systems already exist and are usable, but not fully polished or abstracted.
- Chart tools can be added without rewriting the engine, and the current phase-1 hardening pass confirms that the safer path is still incremental support-definition on top of the current engine rather than a second framework.
