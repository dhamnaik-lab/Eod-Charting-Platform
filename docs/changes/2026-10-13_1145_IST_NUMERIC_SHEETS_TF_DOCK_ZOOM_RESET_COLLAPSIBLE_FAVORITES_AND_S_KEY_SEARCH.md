# Numeric Sheets, Timeframe Dock Polish, Auto Zoom Reset, Collapsible Favorites & 'S' Key Symbol Search

**Date:** 2026-10-13 11:45 IST  
**Status:** Completed & Validated  
**Pre-edit Backups:** 
* `backups/pre_opencode_changes_20261013_045622_ui_timeframe_sheets_fav`
* `backups/pre_opencode_changes_20261013_111201_command_palette_s_key`

---

## 1. Overview & Objectives

This session delivered 5 core UI, workflow, and keyboard navigation enhancements requested for the EOD Charting Platform:
1. **Numeric Sheet Names**: Replaced default `Sheet1, Sheet2...` naming with clean numeric naming (`1, 2...`) for faster recognition and visual compactness.
2. **Timeframe Dock Polish**: Removed the redundant `"TF"` prefix from the chart header dock, and updated tooltip hovers to full readable names (`Daily`, `Weekly`, `Monthly`, `Quarterly`, `Yearly`).
3. **Timeframe Change Auto Zoom Reset**: Eliminated the need to manually click the zoom reset (`0`) button after switching timeframes (e.g. from `Yearly` to `Daily`), automatically resetting the viewport to the standard default 120-bar right-aligned view.
4. **Collapsible Favorites in Indicator Sidebar**: Added collapsible toggle behavior (`►`/`▼`) with persistence for the `★ Favorites` section in the indicator sidebar, matching the existing subcategory groups.
5. **'S' Single-Key Shortcut for Symbol Search**: Enabled pressing `'S'` (or `'s'`) anywhere on the chart to instantly open the Command Palette with auto-focus in the search bar to search symbols and companies.

---

## 2. Detailed Changes

### 2.1 Numeric Sheet Names
* **[`src/components/SheetTabs.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/SheetTabs.tsx)**:
  * Default new sheet creation dialog now initializes with `${num}` (e.g., `1`, `2`, `3`) instead of `Sheet${num}`.
  * Added `formatSheetLabel(name: string)` helper that converts any existing `Sheet <n>` or `Sheet<n>` label to `<n>`, while preserving custom user sheet titles (e.g. "Support & Resistance").
* **[`src/features/workspace/workspacePersistence.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/features/workspace/workspacePersistence.ts)**:
  * Hydration fallback for unnamed sheets updated from `Sheet${index}` to `${index}`.

### 2.2 Timeframe Dock Cleanup & Tooltips
* **[`src/components/ChartHeader.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/ChartHeader.tsx)**:
  * Removed `<span style={groupCaptionStyle}>TF</span>` from the header timeframe cluster.
  * Updated button title attributes from `Switch to ${tf.label}` to full strings: `Daily`, `Weekly`, `Monthly`, `Quarterly`, `Yearly`.
  * Cleaned up unused caption style and adjusted cluster padding.
* **[`src/components/TileHeader.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/TileHeader.tsx)**:
  * Added `TF_TOOLTIPS` dictionary mapping `D/W/M/Q/Y` to full names, harmonizing tooltips in multi-chart tile headers.

### 2.3 Auto Zoom Reset on Timeframe Change
* **[`src/features/charts/chartTabStateMutationService.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/features/charts/chartTabStateMutationService.ts)**:
  * In `applyTimeframeToTab`, replaced `remapViewportAcrossTimeframe` with `createDefaultViewport(displayBars.length, tab.futureMarginMode)`.
  * Switching timeframes (e.g., `Y -> D`) now immediately displays a clean 120-bar right-aligned view rather than carrying over a narrow bar span from higher timeframes.
* **[`src/features/charts/__tests__/chartTabStateMutationService.test.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/features/charts/__tests__/chartTabStateMutationService.test.ts)**:
  * Updated test assertions to verify that switching timeframes resets viewport zoom to default right-aligned range.

### 2.4 Collapsible Favorites in Indicator Sidebar
* **[`src/components/Sidebar.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/Sidebar.tsx)**:
  * Added `SIDEBAR_COLLAPSED_FAVORITES_KEY` (`'eod-chart.sidebar.collapsed-favorites.v1'`) and `readStoredFavoritesCollapsed` reader.
  * Added `favoritesCollapsed` state and `toggleFavoritesCollapse` handler.
  * Converted the static `★ Favorites` header into a collapsible button (`subgroupHeaderButtonStyle`) with `►`/`▼` toggle icon, badge count, and persistent collapse state.

### 2.5 'S' Key Symbol Search
* **[`src/components/CommandPalette.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/CommandPalette.tsx)**:
  * Added module-level `isEditableKeyboardTarget` guard checking `INPUT`, `TEXTAREA`, `SELECT`, `isContentEditable`, or dialog inputs.
  * Added listener for `e.key.toLowerCase() === 's'` when modifiers (`ctrlKey`, `metaKey`, `altKey`) are false, allowing single-press `'S'` to open the Command Palette with instant search focus.
  * Standard system shortcuts such as `Ctrl+S` (Save) remain fully unaffected.
* **[`src/components/KeyboardShortcutsDialog.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/KeyboardShortcutsDialog.tsx)**:
  * Documented `'S'` under Workspace Shortcuts: `Search symbols (Command Palette)`.

---

## 3. Files Touched

```
src/components/ChartHeader.tsx
src/components/CommandPalette.tsx
src/components/KeyboardShortcutsDialog.tsx
src/components/SheetTabs.tsx
src/components/Sidebar.tsx
src/components/TileHeader.tsx
src/features/charts/__tests__/chartTabStateMutationService.test.ts
src/features/charts/chartTabStateMutationService.ts
src/features/workspace/workspacePersistence.ts
```

---

## 4. Validation Results

* `npm run typecheck:renderer`: **PASS** (zero TypeScript errors)
* `vitest run src/features/charts/__tests__/chartTabStateMutationService.test.ts src/features/workspace/__tests__/workspacePersistence.test.ts`: **PASS** (12/12 tests passed)
