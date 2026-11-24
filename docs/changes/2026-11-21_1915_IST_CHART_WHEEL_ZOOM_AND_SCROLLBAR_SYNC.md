# Chart wheel zoom right-edge anchor & viewport scrollbar sync

- **IST timestamp:** 2026-11-21 19:15 IST (UTC+05:30)
- **Workstream / authorized root:** `E:\TA Projects\EOD Charting Platform`
- **Affected files:** `src/engine/ChartEngine.ts`, `src/components/ChartCanvas.tsx`, `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Objective and previous behavior

1. **Mouse-wheel zoom anchor:** Commit `a40bf61` (2026-11-17, UX Audit W6 F-42) changed `onWheel` in `src/engine/ChartEngine.ts` to pass the cursor X index (`pointerState.scaleX.toIndex(pointerState.clampedX)`) and `'cursor'` anchor to `zoomViewport`, shifting both `startIndex` and `endIndex` during mouse-wheel zoom instead of keeping the right edge pinned like pre-`a40bf61` builds (`2026-04-08` through `2026-11-15`).
2. **Viewport horizontal scrollbar:** In `src/components/ChartCanvas.tsx`, rounding `visibleSpan`, `futureMarginBars`, `scrollValue`, and `onScroll` `nextStart` caused `useLayoutEffect` to detect a `>= 1 px` mismatch during thumb drags, fighting the user's thumb position, re-arming the 60 ms `syncingNativeScrollbarRef` lockout, and stopping short of the right edge on fractional viewport spans. In addition, the bottom scrollbar and navigation buttons (`0`, `-`, `+`, `<`, `>`) sat outside `chartViewportRef` and lacked `tabId ?? undefined` / `runForChart(...)` targeting for multi-chart Auto-Tile layouts.

## Bounded implementation

1. `src/engine/ChartEngine.ts` (`onWheel`, lines 995–1007): restored the pre-`a40bf61` right-edge-anchored wheel zoom (`pivotIndex = (this.viewport.startIndex + this.viewport.endIndex) / 2` and default `'right'` anchor on `zoomViewport`), keeping `ScaleManager.zoomViewport`'s optional `'cursor'` parameter intact for unit tests and preserving `Shift+wheel` panning and price/indicator axis wheel scaling.
2. `src/components/ChartCanvas.tsx` (lines 272–284, 382–383, 2182–2249):
   - Computed `maxScrollStart` and `scrollValue` from exact fractional `actualSpan = Math.max(1, viewport.endIndex - viewport.startIndex)` and unrounded `futureMarginBars = Math.max(0, viewport.endIndex - bars.length)` while retaining integer `visibleSpan` for `<`/`>` step sizes and bar counts.
   - Rounded `scrollbarContentWidth` to integer pixels (`Math.max(Math.round(scrollbarViewportWidth + maxScrollStart * pixelsPerBar), scrollbarViewportWidth)`) while keeping the `pixelsPerBar = Math.max(8, ...)` model intact.
   - Updated `onScroll` to pass unrounded `nextStart = (element.scrollLeft / maxScrollLeft) * maxScrollStart` with `tabId ?? undefined` to `scrollToViewportStart`, keeping `Math.abs(element.scrollLeft - nextScrollLeft) < 1` during thumb drags.
   - Added `onMouseDownCapture` tab activation on `<div style={scrollbarWrapStyle}>` and wrapped bottom-bar `0`, `-`, `+`, `<`, `>` button `onClick` handlers in `runForChart(...)`.

## Pre-edit backups

- `backups/pre_opencode_changes_20261121_180012_restore-wheel-zoom-right-anchor`
- `backups/pre_opencode_changes_20261121_185802_fix-chart-scrollbar-sync-and-tile-target`
- `backups/pre_opencode_changes_20261121_191636_docs-chart-wheel-and-scrollbar-sync`

## Validation results

- `npx.cmd vitest run src/engine/__tests__/ScaleManager.test.ts src/components/__tests__/ScannerChartRouting.test.ts` — **PASS** (2 files, 22/22 tests).
- `npm.cmd run typecheck:renderer` — **PASS** (`tsc -p tsconfig.json --noEmit`, exit code `0`).
- `scripts/check-doc-references.ps1` — **PASS**.

## Remaining acceptance & rollback notes

- Manual Windows portable rebuild and visual verification remain pending for live wheel zoom, scrollbar thumb drag, and multi-tile bottom-bar interactions in the packaged app.
- Rollback by restoring `src/engine/ChartEngine.ts` and `src/components/ChartCanvas.tsx` from the recorded pre-edit backups above (no database or schema changes).
