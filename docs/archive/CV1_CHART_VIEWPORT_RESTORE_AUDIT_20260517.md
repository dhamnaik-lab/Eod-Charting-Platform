# CV1_CHART_VIEWPORT_RESTORE_AUDIT_20260517.md - Chart Viewport Restore Audit

## Summary
The EOD Charting Platform uses a centralized state management system (Zustand) to persist chart configurations, including the viewport (visible range of bars). This audit evaluates the reliability of viewport restoration during tab switching, sheet loading, and data refreshes.

## Files Inspected
- `src/store/chartStoreTypes.ts`: Definition of `ChartTabState` and `Viewport`.
- `src/store/chartStore.ts`: Action routing and `db:changed` orchestration.
- `src/features/charts/chartTabWorkspaceService.ts`: Tab activation and hydration logic.
- `src/features/charts/chartInstrumentHydrationService.ts`: Viewport normalization and result application.
- `src/features/charts/chartSheetWorkspaceService.ts`: Sheet loading and viewport preservation logic.
- `src/components/ChartCanvas.tsx`: Native scrollbar synchronization and viewport props handling.
- `src/engine/ScaleManager.ts`: `clampViewport` and `createDefaultViewport` implementation.

## Current Viewport State Flow

### 1. Viewport Storage
- Viewport state (`startIndex`, `endIndex`) is stored inside each `ChartTabState` object within the `chartTabs` array in `useChartStore`.
- This state is updated in real-time as the user pans or zooms the chart via the `syncViewport` action.

### 2. Chart Tab Switching
- **Mechanism:** `activateChartTab(tabId)` updates `activeChartTabId`.
- **Restoration:** Since the `viewport` is part of the tab state, it remains in memory. The `ChartCanvas` re-renders with the viewport from the newly active tab.
- **Verdict:** Reliable for in-memory transitions.

### 3. Sheet Switching
- **Mechanism:** `loadSheet(tabId, sheetId)` replaces the tab's properties with those saved in the sheet.
- **Restoration Policy:** `buildLoadSheetState` explicitly preserves the *current* viewport of the tab:
  ```typescript
  if (targetTab.viewport && nextTab.viewport) {
    nextTab.viewport = { ...targetTab.viewport };
  }
  ```
- **Verdict:** Consistent (scroll doesn't jump), but prevents sheets from having their own unique saved scroll positions.

### 4. Data Reload / Chart Refresh
- **Mechanism:** Triggered by `db:changed` (Tauri event) or manual `loadInstrument`.
- **Policy:** `applyEodResultToTab` takes a `preserveViewport` flag.
  - If `true`: Viewport is normalized and clamped to new data bounds.
  - If `false`: Viewport is reset to `createDefaultViewport` (far right).
- **Issue Identified:** In `ChartRuntimeController`'s `onDatabaseChanged` listener, `loadInstrument` is called, which internally sets `preserveViewport: false`.
- **Verdict:** **Risk.** A database update (e.g., Bhavcopy download) will currently reset the active chart's viewport to the far right, even if the user was inspecting historical data.

## Root-Cause Candidates for "Left-Scroll Reset"

The user reported the scroll moving **left** (historical data) instead of remaining at the current position or resetting to the right (latest data).

### Candidate A: Empty Data Race
- If a tab is activated but its bars are not yet loaded (`displayBars.length === 0`), `createDefaultViewport` returns `{startIndex: 0, endIndex: 0}`.
- If the `ChartCanvas` renders this state and the native scrollbar syncs to it, it may visually jump to the left.
- However, `applyEodResultToTab` usually runs shortly after. If `preserveViewport` is false (due to Issue identified above), it resets to the **far right**.
- If `preserveViewport` is true but the incoming viewport was already `{0,0}`, it still resets to the far right.

### Candidate B: Corrupted Viewport Clamping
- In `clampViewport`, if `totalBars` is small but `viewport.startIndex` is large, it clamps `startIndex` to `maxStart`.
- If `totalBars` is reported as 0 during a transition, `clampViewport` returns `{0,0}`.

### Candidate C: Scrollbar Syncing Logic
- In `ChartCanvas.tsx`, `nextScrollLeft` is calculated as `(scrollValue / maxScrollStart) * maxScrollLeft`.
- If `maxScrollStart` is 0 (few bars), `nextScrollLeft` becomes 0, scrolling to the far left. This is correct for few bars, but if bars are loading, it might be a flicker.

## Risk Assessment
- **Stability:** High. No crashes found.
- **UX Consistency:** Medium. The viewport reset during background data updates is a confirmed annoyance.
- **Data Integrity:** High. Viewport state is transient and doesn't affect price data.

## Recommendations

### 1. Hardening `db:changed` Refresh
- **Fix:** Update `ChartInstrumentCompareController.loadInstrument` to accept an optional `preserveViewport` parameter, or detect if the symbol is already the same and default to `true`.
- **Benefit:** Prevents chart "jumping" when a Bhavcopy download completes in the background.

### 2. Sheet Viewport Behavior Clarification
- **Decision:** Confirm if sheets should save their own scroll positions.
- **Current:** Sheets only save indicator/style layouts.
- **Proposed:** Allow sheets to optionally persist viewport if they were saved with one, or keep current "preserve context" behavior but document it.

### 3. Native Scrollbar Guard
- **Fix:** Add a check in `ChartCanvas` to skip scrollbar synchronization if `bars.length === 0` to prevent "flicker to left" during hydration.

## Proposed Implementation Phase: CV2 (Hardening)
1. Modify `loadInstrument` signature to support `preserveViewport`.
2. Update `ChartRuntimeController` to pass `preserveViewport: true` during `db:changed` refreshes.
3. Add "hydration guard" to `ChartCanvas` scrollbar effect.

## Manual QA Checklist for Viewport Restoration
- [ ] **Tab Switch:** Scroll Tab A to historical data. Switch to Tab B. Switch back to Tab A. Position should be preserved.
- [ ] **Sheet Switch:** Scroll Tab A. Switch to Sheet 2. Scroll position should be identical to Sheet 1.
- [ ] **Bhavcopy Refresh:** Scroll Tab A to historical data. Trigger a Bhavcopy download for the same symbol. Confirm scroll position remains locked after "Bhavcopy download complete".
- [ ] **Symbol Switch:** Switch symbol in Tab A. Viewport should reset to far right (intended behavior).
- [ ] **Empty State:** Open a new tab. Verify it defaults to 0,0 and then jumps to far right once data loads (intended behavior for new symbol).

## Git Status
```bash
?? NEXT_SMALL_IMPLEMENTATION_PHASES_20260517.md
?? CV1_CHART_VIEWPORT_RESTORE_AUDIT_20260517.md
```
No implementation code was changed in this phase.
