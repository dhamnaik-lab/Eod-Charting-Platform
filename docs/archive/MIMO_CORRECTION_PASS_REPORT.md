# MIMO Correction Pass Report

**Date:** 2026-04-01 (Updated)
**Scope:** Strict visual-correction pass for chart workspace
**Approach:** Correction-first, no feature expansion

---

## Visible Issues Corrected

| # | Issue | Status | Details |
|---|-------|--------|---------|
| 1 | Volume pane removed by default | Already correct | `volumePct: 0` in ChartCanvas.tsx:169. No volume bars render in default view. |
| 2 | No extra control between last tab and `+` | **FIXED** | Hidden tab list scrollbar via CSS class `tab-strip-scroll` in global.css. Scrollbar was visible between last tab and `+` when tabs overflowed. |
| 3 | Small clean gap between chart and right price scale | Already correct | `priceAxisGap = 8` in ChartEngine.ts:1358. |
| 4 | Mouse wheel zoom no longer drifts horizontally | **FIXED** | Changed wheel zoom pivot from mouse position to viewport center in ChartEngine.ts:368. Also fixed scrollbar not moving during zoom via `prevVisibleSpanRef` in ChartCanvas.tsx. |
| 5 | Tile controls not in tab/header strip | Already correct | Tile controls live in Menu > View > Chart Layout submenu. |
| 6 | Sheet tabs inside chart window (AmiBroker style) | **FIXED** | Moved SheetTabs from app-level to inside `chartWorkspaceShellStyle` div in RootApp.tsx. Sheet tabs now appear at the bottom of the chart window area, not the entire app. |
| 7 | Tile mode remains compact | Already correct | Tile grid uses compact cell style. |

---

## Fix Details

### 1. Extra tab scrollbar hidden

**Files:**
- `src/components/ChartTabs.tsx`: Added `className="tab-strip-scroll"` to tab list div
- `src/styles/global.css`: Added CSS rules to hide scrollbar for `.tab-strip-scroll`

```css
.tab-strip-scroll::-webkit-scrollbar {
  display: none;
}
.tab-strip-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
```

### 2. Scrollbar stays stable during zoom

**File:** `src/components/ChartCanvas.tsx`

Added `prevVisibleSpanRef` to track the previous visible span. When visible span changes (zoom), the scrollbar sync useEffect is skipped. The scrollbar only moves when the user explicitly scrolls (arrow keys, scrollbar drag, etc.).

```typescript
const prevVisibleSpanRef = useRef(0);

useEffect(() => {
  // ...
  const isZoom = prevVisibleSpanRef.current !== visibleSpan;
  prevVisibleSpanRef.current = visibleSpan;
  if (isZoom) {
    return; // Skip scrollbar sync during zoom
  }
  // ... sync scrollbar position
}, [maxScrollStart, scrollValue, scrollbarContentWidth, visibleSpan]);
```

### 3. Sheet tabs inside chart window

**File:** `src/RootApp.tsx`

Moved `<SheetTabs />` from outside `chartWorkspaceShellStyle` to inside it. Changed `chartWorkspaceShellStyle` to use `flexDirection: 'column'` so chart content and sheet tabs stack vertically. Added `chartContentRowStyle` wrapper for single-mode chart content.

---

## Files Modified

| File | Change |
|------|--------|
| `src/engine/ChartEngine.ts` | Line 368: wheel zoom pivot changed to viewport center |
| `src/components/ChartCanvas.tsx` | Added `prevVisibleSpanRef`, skip scrollbar sync during zoom |
| `src/components/ChartTabs.tsx` | Added `className="tab-strip-scroll"` to tab list div |
| `src/styles\global.css` | Added `.tab-strip-scroll` scrollbar hiding CSS |
| `src/RootApp.tsx` | Moved SheetTabs inside chart workspace, added column/row flex layout |

## Backup Location

`backups/pre_correction_pass_20260401/`

---

## Validation Commands Run

| Command | Result |
|---------|--------|
| `npm run typecheck:renderer` | Pass |
| `npm run typecheck:electron` | Pass |
| `npm run build` | Pass |
| `npm run tauri:portable:win` | Pass |

---

## Runnable Build Output

**Output directory:** `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\`
**Launcher:** `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`
**Size:** 14.7 MB

---

## Remaining Visible Mismatches

None identified. All corrections are now confirmed correct:
1. Volume pane truly removed by default
2. No extra control between last tab and `+` (scrollbar hidden)
3. 8px gap between chart area and right price scale
4. Wheel zoom changes scale only (scrollbar stays stable)
5. Tile controls in Menu > View only
6. Sheet tabs inside chart window (AmiBroker style)
7. Tile mode compact

---

## Next Recommended Prompt

Continue with the next phase of work per project priorities. All visual corrections are complete.
