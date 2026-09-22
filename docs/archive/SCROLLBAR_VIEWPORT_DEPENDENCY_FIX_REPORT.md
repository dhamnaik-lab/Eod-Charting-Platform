# SCROLLBAR_VIEWPORT_DEPENDENCY_FIX_REPORT.md

## 1. Backup path
`E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260520_025029_scrollbar_viewport_dependency_fix`

## 2. File changed
- `src/components/ChartCanvas.tsx`

## 3. Exact dependency change made
Modified the `useEffect` that synchronizes the viewport from the store to the `ChartEngine`.

**Before:**
```typescript
  useEffect(() => {
    engineRef.current?.setViewport(viewport);
  }, [viewport]);
```

**After:**
```typescript
  useEffect(() => {
    engineRef.current?.setViewport(viewport);
  }, [viewport.startIndex, viewport.endIndex]);
```

## 4. Why no store/refactor was needed
The root cause was identified as React's shallow equality check on the `viewport` object dependency. When store mutations reused the same object identity (even if properties like `startIndex` changed), React would skip the effect that notifies the `ChartEngine` of the update. By switching to primitive fields (`startIndex`, `endIndex`), we ensure the effect triggers whenever the logical viewport range changes, regardless of object identity.

## 5. Validation results
- `npm run typecheck:renderer`: Passed.
- `npm run tauri:check`: Passed.
- `git status --short`: Confirms only `src/components/ChartCanvas.tsx` was modified (plus existing untracked files).

## 6. Manual QA checklist
- [ ] Drag bottom scrollbar thumb left/right.
- [ ] Confirm chart candles move.
- [ ] Confirm date/time axis moves.
- [ ] Confirm visible date range text updates.
- [ ] Confirm mouse wheel/zoom still works.
- [ ] Confirm Home/End behavior still works.
- [ ] Confirm sheet switch preserves same symbol.
- [ ] Confirm deleted indicator stays deleted after sheet switch.
- [ ] Confirm startup latest/right-side viewport restore still works.
