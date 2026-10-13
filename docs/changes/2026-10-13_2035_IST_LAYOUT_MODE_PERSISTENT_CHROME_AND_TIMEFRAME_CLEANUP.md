# Layout Mode Persistent Chrome, Right Tool Dock & Timeframe Cleanup

**Date:** 2026-10-13 20:35 IST  
**Classification:** `UI_AND_WORKFLOW_POLISH__ALL_VALIDATION_GATES_PASSED`  
**Status:** Completed and Validated  

---

## 1. Problem Statement

When users switched to multi-chart tiled layout modes (`tile`, `tile-h`, `tile-v`, `tile-grid`), several critical UX and layout defects occurred:

1. **Header Dock Disappeared:** The global `<Toolbar />` (containing the timeframe selector `D W M Q Y`, chart type dropdown, volume toggle, indicators, alerts, signals, and scanners) was wrapped in `{layoutMode === 'single' ? ... : null}` and completely unmounted in tiled layouts.
2. **Drawing Tool Dock Disappeared:** `<ChartToolDock />` was placed exclusively inside the single-chart branch of the workspace shell, rendering drawing tools inaccessible in multi-chart view.
3. **Cluttered Duplicate Timeframe Docks:** In compensation for the missing top toolbar, each individual tile header rendered its own `tileTfGroupStyle` with duplicate `D W M Q Y` buttons, squishing symbol and price display.
4. **No Active Chart Distinction:** All tiles shared identical generic borders (`1px solid var(--border)`), giving no visual indication of which chart was focused.
5. **Unhydrated Background Tiles:** When switching from single to tiled mode, background tabs were not eagerly hydrated, displaying "No chart data loaded" until clicked.

---

## 2. Industry Benchmark & Architecture

Industry research into professional multi-chart layouts (TradingView, TC2000, MultiCharts) confirmed a unified context-aware model:
- **Global Context-Aware Toolbars:** Top header dock and drawing tool dock remain permanently fixed at the application level and dynamically control whichever chart is currently active.
- **Active Chart Focus Ring:** Exactly one chart pane holds focus at any time, visually distinguished by an active accent border and focus glow.
- **Click-to-Activate:** Clicking anywhere inside a chart pane immediately focuses it for timeframe selection, indicator manipulation, and drawing tools.
- **Clean Minimal Tile Headers:** Individual panels show only essential metadata (Symbol, Exchange, Last Price, % Change), maximizing chart plot space.

---

## 3. Implementation Details

### A. Persistent Top Header Dock (`src/RootApp.tsx`)
- Unhooked `<Toolbar />` from the single-mode conditional:
  ```tsx
  <ChartTabs />
  <div style={chartChromeStyle}>
    <Toolbar />
  </div>
  <div style={chartWorkspaceShellStyle}>
  ...
  ```
- The main header dock stays permanently visible across all layout modes and dynamically operates on `activeTab`.

### B. Persistent Right Tool Dock (`src/RootApp.tsx`)
- Wrapped the entire chart workspace row with `<ChartToolDock />`:
  ```tsx
  <div style={chartContentRowStyle}>
    <div style={chartContentColumnStyle}>
      {layoutMode !== 'single' ? (...) : (...)}
    </div>
    <ChartToolDock />
  </div>
  ```
- Drawing tools (trendlines, channels, Fibonacci, etc.) remain fixed on the right rail across all single and tiled modes.

### C. Active Chart Focus Ring & Click-to-Activate (`src/RootApp.tsx` & `src/components/ChartCanvas.tsx`)
- Updated `tileCellStyle(isActive)` to dynamically apply an accent border and glow:
  ```tsx
  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
  boxShadow: isActive ? 'inset 0 0 0 1px var(--accent-soft)' : 'none',
  ```
- Added click activation on the tile wrapper and in `ChartCanvas.tsx` (`onMouseDownCapture`):
  ```tsx
  if (tabId && tabId !== activeChartTabId) {
    activateChartTab(tabId);
  }
  ```

### D. Streamlined Tile Headers (`src/components/TileHeader.tsx`)
- Removed `TF_ORDER`, `TF_TOOLTIPS`, `tileTfGroupStyle`, and `tileTfBtnStyle` (`D W M Q Y` buttons).
- Retained clean Symbol, Exchange badge, Last Price, and Daily Change (+/-%).
- Added an active accent dot indicator to the focused tile header.

### E. Eager Background Tab Hydration (`src/features/charts/chartTabSessionController.ts`)
- In `setLayoutMode`, when switching to multi-tile (`mode !== 'single'`), automatically queries and hydrates unhydrated tabs:
  ```tsx
  const unhydratedTabIds = state.chartTabs
    .filter(
      (tab) =>
        (tab.requestedInstrument ?? tab.instrument) &&
        shouldHydrateChartTab(
          tab,
          state.adjustedMode,
          state.includeDividendAdjustments,
          state.includeRightsAdjustments,
        ),
    )
    .map((tab) => tab.id);
  if (unhydratedTabIds.length > 0) {
    queueSequentialTabHydration(unhydratedTabIds);
  }
  ```

---

## 4. Validation Results

| Test Gate | Scope | Result |
|---|---|---|
| `npm run typecheck:renderer` | Whole TypeScript codebase | ✅ PASS (0 errors) |
| `npm run test -- chart` | 16 chart test suites | ✅ PASS (100/100 tests passed) |

---

## 5. Files Changed

- [`src/RootApp.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/RootApp.tsx)
- [`src/components/TileHeader.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/TileHeader.tsx)
- [`src/components/ChartCanvas.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/ChartCanvas.tsx)
- [`src/features/charts/chartTabSessionController.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/features/charts/chartTabSessionController.ts)
- [`HANDOFF.md`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/HANDOFF.md)
