# Light Theme Grid Line & Crosshair Preservation Fix

**Date:** 2026-10-13 15:25 IST  
**Status:** Completed & Validated  
**Pre-edit Backup:** `backups/pre_opencode_changes_20261013_151625_apply-light-theme-grid-fix`  
**Git Checkpoint:** `checkpoint-light-theme-grid-restored` (`02f34b8`)

---

## 1. Problem & Root Cause
When live custom chart colors were wired, `AppSettings` passed `gridColor: '#1e2a3a'` (an opaque dark navy designed for dark mode) to `getChartTheme`.
This caused light themes (`classic-light` and `deep-light`) to have their soft subtle grey grid lines (`rgba(203, 213, 225, 0.35)`) overwritten with heavy solid dark navy lines across both horizontal price levels and vertical date intervals.

---

## 2. Changes Made
1. **[`src/features/app/themeService.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/features/app/themeService.ts)**
   - Updated `getChartTheme` to detect when global dark defaults (`#1e2a3a` for grid lines, `#5588aa` for crosshairs) are passed in `customColors`.
   - Preserves `base.gridLine` and `base.crosshair` so each theme keeps its native styling unless the user explicitly chose an intentional non-default color.
2. **[`src/engine/__tests__/ChartTheme.test.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/engine/__tests__/ChartTheme.test.ts)**
   - Added unit test verifying that `classic-light` preserves its native subtle grid and crosshair when dark default settings are passed, while still retaining custom candle colors.

---

## 3. Validation
- `npm run typecheck:renderer`: **PASS** (0 errors)
- `npx vitest run src/engine/__tests__/ChartTheme.test.ts`: **PASS** (7/7 tests passed)
