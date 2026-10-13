# Step 1: Chart Color Live Wiring to Chart Engine

**Date:** 2026-10-13 04:20 IST  
**Status:** Completed & Validated  
**Pre-edit Backup:** `backups/pre_opencode_changes_20261013_040801_wire_chart_colors`

---

## 1. Problem & Root Cause

When users configured colors (Candle Up, Candle Down, Grid Lines, Crosshair) in **Settings &rarr; Chart Colors**, the changes were saved into `AppSettings` via `writeAppSettings`, but the chart canvas never updated:
1. `themeService.ts` (`getChartTheme`) returned static constants from `CHART_THEMES[themeId]`, ignoring any custom color overrides.
2. `ChartCanvas.tsx` only passed `getChartTheme(currentTheme)` to the engine, without subscribing to `AppSettings` chart color changes.
3. `resolveChartTheme` in `ChartEngine.ts` overwrote `gridLine` and `crosshair` with `DEFAULT_CHART_VISUAL_SETTINGS` fallbacks rather than allowing base theme values to shine through.
4. Candle colors (`candleUp`, `candleDown`) were not forwarded to the `ChartTheme` used by `Renderer.ts`.

---

## 2. Changes Made

1. **[`src/features/app/themeService.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/features/app/themeService.ts)**
   - Updated `getChartTheme(themeId, customColors?: Partial<ChartTheme>): ChartTheme` to merge user-specified colors.
   - Automatically derives `wickUp`, `wickDown`, `volumeUp` (`hexToRgba` at 0.24 alpha), and `volumeDown` from `candleUp` and `candleDown` when not explicitly overridden.

2. **[`src/store/uiStore.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/store/uiStore.ts)**
   - Added `customChartColors: Partial<ChartTheme> | null` and `setCustomChartColors(colors)` to `UiStoreState`.

3. **[`src/RootApp.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/RootApp.tsx)**
   - Added `subscribeAppSettingsChanges` listener alongside initial `readAppSettings()`.
   - Populates `setCustomChartColors` with `candleUpColor`, `candleDownColor`, `gridColor`, and `crosshairColor`.

4. **[`src/components/ChartCanvas.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/ChartCanvas.tsx)**
   - Subscribed to `customChartColors` from `useUiStore`.
   - Memoized `chartTheme = getChartTheme(currentTheme, customChartColors ?? undefined)`.
   - Passed `chartTheme` to `new ChartEngine(...)` and `engineRef.current?.setTheme(chartTheme)`.

5. **[`src/engine/ChartEngine.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/engine/ChartEngine.ts)**
   - Updated `resolveChartTheme` so `gridLine`, `gridLineMajor`, and `crosshair` preserve `baseTheme` values when `settings` match the default fallback values.

6. **[`src/components/SettingsDialog.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/SettingsDialog.tsx)**
   - Dispatched `setCustomChartColors` on `handleSave` so open charts update immediately upon saving.

7. **[`src/engine/__tests__/ChartTheme.test.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/engine/__tests__/ChartTheme.test.ts)**
   - Added unit tests for custom color merging, automatic wick/volume derivation, and fallback preservation.

---

## 3. Validation

- `npm run typecheck:renderer`: **PASS** (zero type errors)
- `npx vitest run src/engine/__tests__/ChartTheme.test.ts --exclude "tmp/**"`: **PASS** (5/5 tests passed)
