# Known Issues

This file tracks confirmed bugs and intentional limitations.
**Do not "fix" anything listed here without an explicit instruction to do so.**
Many items are marked intentional or have known tradeoffs.

---

## P0 — Active / Blocking

### [P0-1] Y-axis width is hardcoded
- **File:** canvas engine Y-axis rendering
- **Symptom:** Y-axis width is fixed (e.g. 62px). Long prices like `48,213.65` get clipped.
- **Fix needed:** Compute width via `ctx.measureText(longestLabel).width + padding`
  and apply to the Y-axis `<div>` width before each draw.
- **Do not touch:** The hardcoded value — wait for the full fix.

### [P0-2] Indicator pane headers show no live values (no legend system)
- **File:** Indicator pane header component
- **Symptom:** Pane header shows `STOCH (14, 3)` but not `%K 95.19  %D 89.47`
- **Fix needed:** A generic legend system that:
  1. Computes indicator values for the hovered bar (or last bar if no hover)
  2. Passes them as props to the pane header
  3. Works for all 22 indicators
- **Do not:** Hardcode per-indicator legend logic — must be generic.

---

## P1 — Important but not blocking

### [P1-1] No comma formatting on Y-axis price labels
- **Symptom:** Shows `48213.65` instead of `48,213.65`
- **Fix:** Apply `toLocaleString('en-IN', { minimumFractionDigits: 2 })` to all Y-axis labels.

### [P1-2] Duplicate month labels on X-axis at some zoom levels
- **Symptom:** At wide zoom, "Apr '25" appears twice on X-axis.
- **Fix:** De-duplicate labels when computed X positions are too close together.

### [P1-3] Histograms lack 4-color scheme
- **Symptom:** MACD histogram and Volume bars are single-color.
- **Fix needed:** 4-color scheme — rising above zero, falling above zero,
  rising below zero, falling below zero — matching TradingView/AmiBroker style.

---

## P2 — Low priority / cosmetic

### [P2-1] Adaptive Y-axis tick density
- Y-axis always shows the same number of ticks regardless of pane height.
- Should compute tick count based on available height / minimum label spacing.

### [P2-2] Candle wick width scales with bar width
- Wick is always 1px regardless of zoom.
- Should stay 1px at normal zoom, match body width if bars are very wide.

### [P2-3] Indicator lines too thick at some zoom levels
- Default stroke width looks heavy when bars are narrow.

### [P2-4] Grid lines too prominent
- Grid `rgba(255,255,255,0.035)` feels heavy on dense charts.

---

## Intentional Limitations (do not change)

### `upsertIndicator` deduplicates by `kind`
- **File:** `src/features/charts/chartDataUtils.ts`
- **Behavior:** Only one indicator of each kind allowed (e.g. cannot add two EMAs).
- **Why intentional:** Simplifies pane ID management and persistence.
- **Future:** Will change to dedup by `id` when multi-instance indicators are planned.

### `createChartCompareOverlay` ignores `timeframe` parameter
- **File:** `src/features/charts/compareOverlayService.ts`
- **Code:** `void timeframe;`
- **Why:** Timeframe aggregation for compare overlays is applied in `applyCompareOverlayResult`,
  not at creation time. The param is kept for API consistency.

### Holiday calendar is hardcoded through 2026
- **File:** `src-tauri/src/bhavcopy.rs` — `NSE_HOLIDAY_NAMES`
- **Why:** NSE API requires a session/cookie to fetch holiday data programmatically.
- **Limitation:** BSE holidays not covered. Needs annual update.
- **Do not:** Reorder entries — searched linearly, order doesn't affect correctness
  but reordering makes diffs unreadable.

### `window.setTimeout` delays in session controller
- **File:** `src/features/charts/chartTabSessionController.ts`
- **Code:** `window.setTimeout(() => hydrateChartTabData(tabId), 50)`
- **Why:** Lets React flush the new tab state before hydration begins.
- **Not a bug** — do not remove without replacing with a proper effect-driven trigger.

### `saveSettings` fires on every config change in BhavcopyDownloadWindow
- **File:** `src/components/BhavcopyDownloadWindow.tsx`
- **Why:** Auto-save on every toggle for good UX. IPC is fast enough for infrequent changes.
- **Known:** No debounce — rapid worker count changes fire multiple IPC calls.

### Module-level instrument data cache
- **File:** `src/features/charts/chartInstrumentHydrationService.ts`
- **Code:** `const instrumentDataCache = new Map<string, EodDataResult>()`
- **Why:** Intentional performance optimization — avoids repeated IPC calls for same symbol.
- **Limitation:** Shared across all store instances (test isolation concern).
- **Cleared by:** `clearInstrumentDataCache()` on database close.

---

## Cross-file sync requirements

These values must be kept in sync across files — if you change one, change all:

| Value | Files |
|---|---|
| `DEFAULT_EXCLUDED_SERIES` | `bhavcopy.rs` + `BhavcopyDownloadWindow.tsx` |
| `MAX_COMPARE_OVERLAYS = 3` | `compareOverlayService.ts` (used for color picker logic) |
| `MIN_PANE_HEIGHT = 72` | `chartIndicatorPaneService.ts` (implicit in clamp) |
| `MAX_PANE_HEIGHT = 168` | `chartIndicatorPaneService.ts` (implicit in clamp) |
| Drawing tool string literals | `menuCommandRouter.ts` + `uiStore.ts` `DrawingTool` type |
| Indicator `kind` values | `menuCommandRouter.ts` payload list + `catalog.ts` + `engine/types.ts` |
| Timeframe values `D W M Q Y` | `menuCommandRouter.ts` + `WorkspaceTimeframe` type + `aggregateBars()` |
| Workspace serialization fields | `workspacePersistence.ts` + `chartSheetWorkspaceService.ts` |
