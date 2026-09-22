# SCROLLBAR_TRACE_DIAGNOSTICS_REPORT.md

## 1. Backup path
`E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260520_031915_scrollbar_trace_diagnostics`

## 2. File changed
- `src/components/ChartCanvas.tsx`

## 3. Exact logs added
All logs are prefixed with `[SCROLLBAR_TRACE]`.

### In `onScroll` handler (line ~871):
- `[SCROLLBAR_TRACE] onScroll fired. syncingNativeScrollbarRef=${syncingNativeScrollbarRef.current}, loading=${loading}`
- `[SCROLLBAR_TRACE] onScroll: maxScrollLeft <= 0, returning` (if applicable)
- `[SCROLLBAR_TRACE] onScroll: scrollLeft=${element.scrollLeft}, maxScrollLeft=${maxScrollLeft}, maxScrollStart=${maxScrollStart}, calculated nextStart=${nextStart}`
- `[SCROLLBAR_TRACE] calling scrollToViewportStart(nextStart)`

### In viewport sync `useEffect` (line ~261):
- `[SCROLLBAR_TRACE] Viewport effect firing: start=${viewport.startIndex}, end=${viewport.endIndex}, engineExists=${!!engineRef.current}`

### In native scrollbar sync `useLayoutEffect` (line ~363):
- `[SCROLLBAR_TRACE] Sync layoutEffect: scrollValue=${scrollValue}, maxScrollStart=${maxScrollStart}, nextScrollLeft=${nextScrollLeft}, currentScrollLeft=${element.scrollLeft}`
- `[SCROLLBAR_TRACE] Programmatically setting scrollLeft to ${nextScrollLeft}. syncingNativeScrollbarRef was ${syncingNativeScrollbarRef.current}`
- `[SCROLLBAR_TRACE] Clearing syncingNativeScrollbarRef guard.` (inside `setTimeout`)

## 4. What user should do to reproduce and collect logs
1.  Open the application and load a chart with symbol history.
2.  Open the browser developer tools (Console tab).
3.  Drag the bottom horizontal scrollbar thumb.
4.  Observe the `[SCROLLBAR_TRACE]` messages.
5.  Check if `onScroll` is being blocked by `syncingNativeScrollbarRef` or `loading`.
6.  Check if `Viewport effect firing` appears after `calling scrollToViewportStart(nextStart)`.
7.  Check if `Viewport effect firing` shows the updated `start` index matching the `calculated nextStart`.

## 5. Validation results
- `npm run typecheck:renderer`: Passed.
- `npm run tauri:check`: Passed.
- `git status --short`: Only `src/components/ChartCanvas.tsx` modified.

## 6. Note
This is **temporary diagnostic instrumentation** intended to identify the point of failure in the scrollbar-to-viewport synchronization path. It is not a final fix and should be reverted after the bug is located.
