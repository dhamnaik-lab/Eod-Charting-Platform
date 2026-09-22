# Custom Pointer-Driven Chart Scrollbar Design Audit

## 1. Scope
This is a **DESIGN and AUDIT-ONLY** task. No runtime code has been modified. This document outlines the proposed architecture and implementation plan for a custom pointer-driven chart scrollbar to replace the current native scrollbar implementation in `src/components/ChartCanvas.tsx`.

## 2. Current Native Scrollbar Summary
The current implementation uses a native HTML `div` with `overflow-x: auto`. 
- **Mechanism:** It relies on a "phantom" inner content div with a calculated `scrollbarContentWidth` to simulate a scrollable area. React synchronization logic uses `useLayoutEffect` to set `element.scrollLeft` programmatically, and an `onScroll` handler to update the store's `viewport.startIndex`.
- **Issues:** 
    - **Friction:** Constant "fighting" between the browser's native `scrollLeft` internal state and React's state-driven updates.
    - **Drift:** During fast dragging, the mouse pointer often drifts away from the scrollbar thumb because the browser's scroll increment doesn't map perfectly to the rounded bar indices in the store.
    - **Complexity:** Requires aggressive guards (`syncingNativeScrollbarRef`, `userInteractingWithScrollbarRef`, and 60ms timeouts) that are fragile and difficult to maintain.

## 3. Requirements for Custom Scrollbar
- **Precision:** The thumb must stay perfectly aligned under the pointer during drags, regardless of speed.
- **Direct Control:** Viewport updates should be calculated directly from the pointer's relative position on the track.
- **Pointer Capture:** Use the Pointer API (`setPointerCapture`) to ensure drags continue even if the pointer leaves the track area.
- **Visual Parity:** Maintain the existing aesthetic while allowing for better hover/active states.
- **Minimum Thumb Size:** Ensure the thumb remains clickable even when zoomed out significantly (e.g., min-width: 40px).
- **Stability:** Preserve existing sheet symbol identity, indicator persistence, and startup latest/right-side viewport restore.
- **Compatibility:** Keyboard shortcuts (Home/End/Arrows) and mouse wheel zooming/panning must remain functional and decoupled from the scrollbar's drag mechanics.

## 4. Proposed Architecture
- **UI Components:**
    - A `track` div: Relative position, fixed height (e.g., 14px), transparent or subtle background.
    - A `thumb` div: Absolute position, styled to look like a traditional chart scrollbar thumb.
- **Event Management:**
    - `onPointerDown` on the thumb: Captures the pointer, stores the initial `clientX` and the current `startIndex` (or calculated `thumbLeft`).
    - `onPointerMove` (global or on track): Calculates the delta, determines the new `ratio`, and calls `scrollToViewportStart(nextStart)`.
    - `onPointerUp` / `onPointerCancel`: Releases the pointer and clears dragging state.
- **State Integration:**
    - Use the existing `scrollToViewportStart` action from `chartStore.ts`.
    - No changes required to `chartStore.ts` or `ChartEngine.ts`.

## 5. Data Flow
1. **User interaction:** User clicks and drags the custom thumb.
2. **Calculation:** `ChartCanvas` calculates the `nextStart` bar index based on pointer offset and track width.
3. **Store update:** `scrollToViewportStart(nextStart)` is invoked.
4. **State propagation:** The store updates the active tab's `viewport`.
5. **Rerender:** `ChartCanvas` rerenders. The `thumb` position is recalculated from the new `viewport.startIndex` via `useMemo`.
6. **Engine sync:** The `useEffect` in `ChartCanvas` detects the viewport change and calls `engineRef.current.setViewport(viewport)`.
7. **Visual update:** `ChartEngine` marks the canvas as dirty and redraws the chart.

## 6. Formula Details
- **Constants/Inputs:**
    - `totalBarsPlusFuture = bars.length + effectiveFutureBars`
    - `maxScrollStart = Math.max(0, totalBarsPlusFuture - visibleSpan)`
    - `trackWidth` (obtained via `ResizeObserver` on the track element)
- **Thumb Dimensions:**
    - `thumbWidthRatio = visibleSpan / totalBarsPlusFuture`
    - `thumbWidth = Math.max(MIN_THUMB_WIDTH, thumbWidthRatio * trackWidth)`
- **Thumb Position:**
    - `scrollableTrackWidth = trackWidth - thumbWidth`
    - `thumbLeft = (viewport.startIndex / maxScrollStart) * scrollableTrackWidth`
- **Drag Interaction:**
    - `ratio = (currentPointerX - trackLeft - grabOffset) / scrollableTrackWidth`
    - `nextStart = clamp(ratio * maxScrollStart, 0, maxScrollStart)`

## 7. File-Level Implementation Plan
- **src/components/ChartCanvas.tsx:** **PRIMARY CHANGE.** Replace the native scrollbar JSX with the custom track/thumb. Implement pointer event handlers.
- **src/store/chartStore.ts:** **NO CHANGE.** Existing actions are sufficient.
- **src/engine/ChartEngine.ts:** **NO CHANGE.** Continues to receive viewport updates via `setViewport`.
- **src/features/charts/*.ts:** **NO CHANGE.** Viewport mutation logic is already robust.

## 8. Migration Plan from Native Scrollbar
1. **Phase CS-A (Foundation):** Implement the visual track and thumb in `ChartCanvas.tsx`. Calculate `thumbWidth` and `thumbLeft` using `useMemo`. Keep the native scrollbar hidden but functional for validation if needed.
2. **Phase CS-B (Interaction):** Implement `onPointerDown/Move/Up` logic. Hook it into `scrollToViewportStart`. Verify that dragging moves the chart.
3. **Phase CS-C (Cleanup):** Remove the `nativeScrollbarRef`, `syncingNativeScrollbarRef`, and the associated `useLayoutEffect` and `onScroll` handler.
4. **Phase CS-D (Refinement):** Add hover effects to the thumb, handle track clicks (paging), and ensure accessibility (ARIA attributes).

## 9. Risks
- **Update Frequency:** `pointermove` fires rapidly. If `scrollToViewportStart` causes heavy re-renders, throttling might be needed, though current performance suggests it should be fine.
- **Rounding Jitter:** Converting pointer pixels to bar indices and back to pixels might cause sub-pixel "jitter" in the thumb position. Using `Math.round` consistently or allowing the thumb to use fractional offsets for rendering can mitigate this.
- **Edge Cases:** Very small bar counts (thumb fills track) or very large bar counts (thumb at min-width) need careful clamping.

## 10. Manual QA Checklist
- [ ] Slow drag: Thumb stays under pointer.
- [ ] Fast drag: Thumb stays under pointer; no drift.
- [ ] Pointer leaves track: Drag continues (pointer capture).
- [ ] Track click: Jumps viewport (paging).
- [ ] Zooming (Wheel): Thumb size and position update correctly.
- [ ] Panning (Shift+Wheel): Thumb position updates correctly.
- [ ] Home/End/Arrows: Thumb position updates correctly.
- [ ] Sheet switch: Scrollbar reflects new symbol's data.
- [ ] Deleted indicator: Persistence is maintained across sheet switches.
- [ ] Startup: Viewport restores to the correct (usually right-side) position.

## 11. Final Recommendation
- **Direction:** A custom pointer-driven scrollbar is the **correct and recommended** future direction. It eliminates the "fighting" behavior of native scrollbars and provides the precision required for professional charting.
- **Timing:** Implementation should be done as a standalone task.
- **Safety:** By leveraging existing store actions, the risk of breaking core chart logic is minimal. `ChartCanvas.tsx` is the only runtime file that needs modification.
