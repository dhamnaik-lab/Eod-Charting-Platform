# Indicator Subcategories, Hybrid Indicator Dialog, and Draggable Floating Windows V1

**Date**: August 14, 2026 17:15 IST  
**Scope**: Sidebar Indicator Subcategories, Hybrid Indicator Modal (`IndicatorPickerDialog.tsx`), Draggable Floating Window Hook (`useDraggableFloatingWindow.ts`), and Non-Blur Chart Visibility.  
**Pre-backup Snapshot**: `E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-14_170628_IST` (639 files verified, 0 mismatches).

---

## 1. Summary of Changes

### A. Sidebar Indicator Subcategory Organization
- Mapped all 118 catalog indicators across **Price** (5 subcategories: Moving Averages, Bands & Channels, Trend Following & Stops, Smart Money & Levels, Price & Bar Transforms) and **Pane** (4 subcategories: Momentum Oscillators, Volatility & Risk, Trend Strength & Direction, Volume & Money Flow).
- Collapsible subcategory section headers with indicator counts and `localStorage` state persistence (`eod-chart.sidebar.collapsed-subcategories.v1`).

### B. Hybrid Indicator Window (`src/components/IndicatorPickerDialog.tsx`)
- Upgraded dialog to a 3-column Hybrid desktop trading workflow:
  - **Top Row**: Live universal search + clear button + Master Segmented Tabs (`All`, `Price`, `Pane`, `★ Favorites`).
  - **Left Rail**: 9 subcategories with indicator counts and Favorites tab.
  - **Center List**: Fast 1-click `[+]` addition directly to chart, interactive favorite `★` pinning (`eod-chart.indicator-favorites.v1`), and subtle `Price` / `Pane` badges.
  - **Right Preview**: Description, formula summary, default parameters, and "+ Add to Chart" button.
  - **Keyboard & Mouse**: Double-click or `Enter` to add & close, `Escape` to dismiss.

### C. Draggable Floating Window Architecture (`src/components/common/useDraggableFloatingWindow.ts`)
- Reusable hook handling mouse/pointer down on header, smooth translation tracking, viewport boundary clamping, and session position persistence.
- Added `FloatingDialogShell.tsx` for consistent draggable desktop panels.

### D. Zero-Blur Chart Visibility
- Replaced blocking dark blur overlays across `IndicatorPickerDialog.tsx`, `IndicatorSettingsDialog.tsx`, and `ChartDrawingPropertiesDialog.tsx` with crystal-clear overlays (`rgba(0,0,0,0.15)`).
- Candlesticks, volume bars, drawings, and price action remain 100% sharp and visible underneath.
- Indicator Settings and Drawing Properties can be moved to any corner while watching real-time chart updates live.

---

## 2. Verification Summary

- **Unit Tests**:
  - `indicatorCatalogSubcategories.test.ts`: **PASS (3/3 tests)**
  - `useDraggableFloatingWindow.test.ts`: **PASS (5/5 tests)**
  - `CandlestickPatterns.test.ts`: **PASS (12/12 tests)**
  - `candlestickSettingsService.test.ts`: **PASS (2/2 tests)**
- **Full Test Suite (`npm test`)**: **101 test files passed, 570/570 unit tests passing**.
- **TypeScript Check (`npm run typecheck:renderer`)**: **PASS (0 errors)**.
- **Documentation References (`check-doc-references.ps1`)**: **PASS**.
