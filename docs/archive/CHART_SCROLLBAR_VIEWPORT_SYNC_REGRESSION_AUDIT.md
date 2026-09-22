# Chart Scrollbar Viewport Sync Regression Audit

## 0. 2026-05-23 Fix Follow-Up

This audit is no longer audit-only. The regression was addressed in `src/components/ChartCanvas.tsx`.

### Applied Fix

- Added a dedicated native-scrollbar sync timer ref.
- Ensured `syncingNativeScrollbarRef.current` is reset to `false` when the current render does not need a programmatic scrollbar sync.
- Stopped clearing the old timer in a way that could leave the sync guard stuck on after a React rerender.
- Changed the viewport-to-engine effect dependency from the viewport object reference to `viewport.startIndex` and `viewport.endIndex`.

### Current Expected Flow

1. User drags the native horizontal scrollbar.
2. `onScroll` is ignored only while an active programmatic scrollbar sync is in progress.
3. Normal user scroll events calculate `nextStart` and call `scrollToViewportStart(nextStart)`.
4. The active tab viewport updates.
5. `ChartCanvas` pushes the new primitive viewport values into `ChartEngine.setViewport(...)`.
6. The chart redraws at the dragged scrollbar position.

### Backup

- `backups/pre_opencode_changes_20260523_171321_scrollbar-drag-viewport-sync`

### Validation

- `npm run typecheck:renderer`
- `npm run build:renderer`
- `git diff --check -- src/components/ChartCanvas.tsx PROJECT_STATE_EOD_CHARTING_PLATFORM.md CHART_SCROLLBAR_VIEWPORT_SYNC_REGRESSION_AUDIT.md`
- `rg -n "[ \t]+$" src/components/ChartCanvas.tsx PROJECT_STATE_EOD_CHARTING_PLATFORM.md CHART_SCROLLBAR_VIEWPORT_SYNC_REGRESSION_AUDIT.md`

## 1. Scope
This is an audit-only review of the charting platform's horizontal scrollbar and its failure to synchronize with the chart viewport. No code has been modified during this audit.

## 2. Current Git / Working Tree Safety
- **Current HEAD**: `cb8427d Audit chart visual area bounds and clipping`
- **Working Tree**: All tracked files are clean.
- **Untracked Files**: LC-A2 preservation files (`LC_A2_CHART_CLIPPING_FIX.patch`, etc.) and old session logs were ignored and left untouched.
- **Stashes**: Untouched.
- **GEMINI.md**: Untouched.

## 3. Files Inspected
- `src/components/ChartCanvas.tsx`
  - Render method (native scrollbar `div` and `onScroll` handler)
  - `useLayoutEffect` (scrollbar thumb position sync)
  - `useEffect` (viewport prop -> engine sync)
- `src/store/chartStore.ts`
  - `scrollToViewportStart` action
  - `syncViewport` action
- `src/features/charts/chartTabStateMutationService.ts`
  - `scrollTabViewportToStart` function
  - `withVisibleBarCount` function

## 4. Current Scrollbar Architecture
- **Rendering**: The bottom scrollbar is not drawn on the canvas. It is a real DOM `<div style={{ overflowX: 'auto' }}>` (the "native scrollbar") overlaid at the bottom of the `ChartCanvas` wrapper.
- **Thumb Control**: The thumb position (`scrollLeft`) is controlled by a `useLayoutEffect` hook in `ChartCanvas.tsx`, which calculates the correct pixel offset based on `viewport.startIndex`, `maxScrollStart`, and `scrollbarContentWidth`.
- **Viewport Control**: The actual chart viewport is controlled by the `ChartEngine`'s internal `viewport` state, which is periodically synced back to the React store (`chartStore.ts`) via the engine's `'viewportChange'` event.
- **Intended Sync**: When the user drags the DOM scrollbar, the `onScroll` event fires. This calculates a `nextStart` index and calls `scrollToViewportStart(nextStart)`. This updates the React store, which then passes the new `viewport` prop down to `ChartCanvas`, triggering a `useEffect` that calls `engineRef.current?.setViewport(viewport)`.

## 5. Expected Data Flow
1. User drags DOM scrollbar thumb.
2. `onScroll` event fires on `nativeScrollbarRef.current`.
3. `nextStart` index is calculated.
4. `scrollToViewportStart(nextStart)` is called.
5. `chartStore` updates active tab's `viewport` state.
6. `ChartCanvas` receives new `viewport` prop.
7. `useEffect` calls `engineRef.current?.setViewport(viewport)`.
8. `ChartEngine.setViewport` updates internal state and calls `markDirty()`.
9. `ChartEngine.renderBase` redraws the chart with the new index.

## 6. Actual Broken Flow / Suspected Break
The flow breaks at **Step 7/8**. The scrollbar moves visually, meaning the DOM is responding and `onScroll` is firing. However, the chart does not redraw. 

The suspected break is in how `ChartCanvas.tsx` handles the `viewport` dependency.

Specifically, the `useEffect` that pushes the viewport to the engine:
```typescript
  useEffect(() => {
    engineRef.current?.setViewport(viewport);
  }, [viewport]);
```
**Hypothesis**: Because `viewport` is an object, React's dependency array uses strict equality (`===`). If the store returns the *exact same object reference* when `scrollToViewportStart` is called, the `useEffect` will not fire, and the engine is never told to update. Alternatively, if the engine's `setViewport` clamps the value in a way that makes it identical to its internal state, it will early-return without marking the canvas as dirty.

## 7. Regression Analysis
- **Startup Viewport Restore / Sheet Identity**: Recent fixes hardened how viewports are preserved when switching sheets. It is possible that a mutation service now modifies viewport properties directly rather than creating a new object reference, causing the React `useEffect` to bail out.
- **LC-A2 Clipping**: Completely unrelated. The clipping audit/fix only touched `ctx.clip()` paths inside the engine's render loop and has no interaction with React state or DOM scroll events.

## 8. Root Cause Candidate Ranking

### 1. Most Likely: React Dependency Equality (Stale Object Reference)
- **File**: `src/components/ChartCanvas.tsx` / `src/features/charts/chartTabStateMutationService.ts`
- **Function**: `useEffect` for viewport / `withVisibleBarCount`
- **Evidence**: In `chartTabStateMutationService.ts`, `withVisibleBarCount` spreads the tab but might not be creating a strictly new `viewport` object if the properties inside are just mutated, or if `clampViewport` returns the same reference. If `viewport` reference doesn't change, `useEffect` in `ChartCanvas` ignores it.
- **Why it matches**: The DOM scrollbar updates its own `scrollLeft` natively, but the chart engine never receives the signal to pan.

### 2. Possible: `syncingNativeScrollbarRef` Race Condition
- **File**: `src/components/ChartCanvas.tsx`
- **Function**: `onScroll` and `useLayoutEffect`
- **Evidence**: `syncingNativeScrollbarRef.current = true` is set in `useLayoutEffect` and cleared after a 60ms timeout. If the React render cycle is delayed, the `onScroll` handler might fire while the guard is still true, immediately returning and dropping the user's scroll input.
- **Why it matches**: Hovering/clicking the scrollbar track often triggers programmatic scrolls that get swallowed by this guard.

### 3. Less Likely: Engine `setViewport` Early Return
- **File**: `src/engine/ChartEngine.ts`
- **Function**: `setViewport`
- **Evidence**: `setViewport` has an early return: `if (Math.abs(this.viewport.startIndex - nextViewport.startIndex) < 0.001 ...) return;`.
- **Why it matches**: If the scrollbar movement calculates a `nextStart` that is extremely close to the current start (due to floating point math), it might be ignored. However, this wouldn't explain why *large* drags also fail.

## 9. Minimal Future Fix Strategy
**Goal**: Ensure the `viewport` pushed from the store always triggers the engine update.

**Proposed Small Fix**:
In `src/components/ChartCanvas.tsx`, change the `useEffect` dependency array to watch the primitive values of the viewport rather than the object reference itself.

```typescript
  // Change this:
  // useEffect(() => {
  //   engineRef.current?.setViewport(viewport);
  // }, [viewport]);

  // To this:
  useEffect(() => {
    engineRef.current?.setViewport(viewport);
  }, [viewport.startIndex, viewport.endIndex]);
```
This forces the effect to fire whenever the logical start or end changes, regardless of object identity.

## 10. Files That Should Remain Untouched
- `src/store/chartStore.ts`: Do not touch. The store logic is correct.
- `src/store/chartStoreTypes.ts`: Do not touch.
- `src/engine/ScaleManager.ts`: Do not touch.
- `src/features/workspace/workspacePersistence.ts`: Do not touch.
- `src/features/charts/chartSheetWorkspaceService.ts`: Do not touch.

## 11. Suggested Manual Reproduction Steps
1. Open the charting application and load a symbol with significant history (e.g., AAPL).
2. Grab the bottom scrollbar thumb and drag it aggressively to the left.
3. **Observe**: The thumb moves, but the chart candles remain static.
4. Use the mouse wheel to pan (Shift + Wheel) or zoom.
5. **Observe**: The chart responds to wheel events perfectly, indicating the engine is capable of panning, but the DOM scrollbar sync is disconnected.

## 12. Final Recommendation
- **Is this a real regression?** Yes, the scrollbar DOM -> React -> Engine sync is broken.
- **Is LC-A2 clipping likely responsible?** No, clipping only affects rendering, not event flow.
- **What is the most likely broken file?** `src/components/ChartCanvas.tsx`.
- **Is it safe to proceed?** Yes, it is safe to proceed to a small fix.
- **What files should a future fix touch?** Only `src/components/ChartCanvas.tsx` to fix the `useEffect` dependency array, and optionally `src/features/charts/chartTabStateMutationService.ts` if a strict object recreation is preferred.

---
*End of Audit Report*
