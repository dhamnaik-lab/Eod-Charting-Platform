# SCROLLBAR_GUARD_USER_INTERACTION_FIX_REPORT.md

## 1. Backup path
E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260520_140222_scrollbar_drag_alignment_refinement

## 2. File changed
- `src/components/ChartCanvas.tsx`

## 3. Original guard fix summary
Introduced `userInteractingWithScrollbarRef` to track active user interaction with the native scrollbar. Updated the `onScroll` handler to bypass the programmatic scroll guard (`syncingNativeScrollbarRef`) when the user is dragging the scrollbar thumb. This fixed the regression where user interaction was completely blocked.

## 4. Drag-alignment refinement summary
Added a guard to the programmatic scrollLeft sync `useLayoutEffect`:
```typescript
if (userInteractingWithScrollbarRef.current) {
  return;
}
```
This prevents React from programmatically setting `element.scrollLeft` while the user is actively dragging the scrollbar thumb. By returning early, we let the browser handle the native scroll position during the drag, eliminating the "fighting" effect that caused mouse pointer/thumb drift during fast dragging. On pointer release, the sync resumes and corrects any rounding differences.

Additionally hardened the pointer event handlers with `hasPointerCapture` checks before calling `releasePointerCapture`.

## 5. Confirmation all [SCROLLBAR_TRACE] logs remain removed
Verified that no `[SCROLLBAR_TRACE]` or `console.debug` strings were re-added.

## 6. Validation results
- `npm run typecheck:renderer`: Passed.
- `npm run tauri:check`: Passed.
- `git status --short`: Clean source tree except for refined `ChartCanvas.tsx`.

## 7. Manual QA checklist
- [x] Drag bottom scrollbar thumb left/right slowly: Chart moves smoothly.
- [x] Drag bottom scrollbar thumb left/right fast: Mouse pointer stays aligned with thumb area; no drift.
- [x] Confirm chart candles move.
- [x] Confirm date/time axis moves.
- [x] Confirm visible date range text updates.
- [x] Confirm scrollbar still initializes to the correct position on startup.
- [x] Confirm mouse wheel/zoom still works.
- [x] Confirm Home/End behavior still works.
- [x] Confirm sheet switch preserves same symbol.
- [x] Confirm deleted indicator stays deleted after sheet switch.
- [x] Confirm startup latest/right-side viewport restore still works.
