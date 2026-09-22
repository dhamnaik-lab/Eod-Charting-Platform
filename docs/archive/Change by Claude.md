# Changes by Claude

---

## 2026-04-02 — Zoom-Out Scroll Fix + New Indicators + Tool Dock UI

### Bug Fixed: Scroll drift on zoom-out (`src/engine/ScaleManager.ts`)

**Root cause:** `clampViewport` recomputed `span` from `(clamped-endIndex − unclamped-startIndex)`.
When the cursor was near the left edge during zoom-out, `startIndex` went slightly negative *and* `endIndex` crossed `totalBars` simultaneously. The `endIndex >= totalBars` guard snapped `endIndex` to `totalBars + RIGHT_MARGIN_BARS`, but `startIndex` was still negative, so `span = endIndex - startIndex` grew larger than the max span. This caused the viewport to silently expand beyond bounds on every zoom-out tick, producing horizontal drift even when the cursor was stationary.

**Fix:** Preserve the span requested by `zoomViewport`/`panViewport` before clamping `startIndex`:

```ts
// New clampViewport logic
const requestedSpan = viewport.endIndex - viewport.startIndex;
const span = Math.max(minSpan, Math.min(requestedSpan, maxSpan));
const maxStart = Math.max(maxSpan - span, 0);
const startIndex = Math.max(0, Math.min(viewport.startIndex, maxStart));
return { startIndex, endIndex: startIndex + span };
```

This ensures span is always respected and `startIndex` never goes out of range regardless of which side the cursor is on.

---

### New Indicators Added

**`src/engine/types.ts`** — Added 5 new indicator types to `ChartIndicator` union:
- `DEMA` — Double EMA (overlay)
- `TEMA` — Triple EMA (overlay)
- `VWAP` — Volume Weighted Average Price (overlay)
- `MOM` — Momentum / price difference (pane)
- `AROON` — Aroon Up/Down oscillator (pane)
- `CMF` — Chaikin Money Flow (pane)

**`src/engine/Indicators.ts`** — Added `DEMA`, `TEMA` (via `technicalindicators`), and custom implementations for `VWAP`, `MOM`, `AROON`, `CMF`.

**`src/indicators/catalog.ts`** — Added catalog entries for all 6 new indicators with descriptions, default colors, and correct `getIndicatorDisplayLabel` handling.

**Indicator summary (total: 22 indicators)**

| Indicator | Type    | Group      |
|-----------|---------|------------|
| SMA       | Overlay | Trend      |
| EMA       | Overlay | Trend      |
| WMA       | Overlay | Trend      |
| WEMA      | Overlay | Trend      |
| DEMA ✨   | Overlay | Trend      |
| TEMA ✨   | Overlay | Trend      |
| VWAP ✨   | Overlay | Volume     |
| BOLL      | Overlay | Volatility |
| PSAR      | Overlay | Trend      |
| RSI       | Pane    | Momentum   |
| MACD      | Pane    | Momentum   |
| STOCH     | Pane    | Momentum   |
| ROC       | Pane    | Momentum   |
| CCI       | Pane    | Momentum   |
| W%R       | Pane    | Momentum   |
| MOM ✨    | Pane    | Momentum   |
| ATR       | Pane    | Volatility |
| ADX       | Pane    | Trend      |
| AROON ✨  | Pane    | Trend      |
| MFI       | Pane    | Volume     |
| OBV       | Pane    | Volume     |
| CMF ✨    | Pane    | Volume     |

---

### ChartToolDock UI Overhaul (`src/components/ChartToolDock.tsx`)

Replaced cryptic text abbreviations (Cur, H, V, TL, Arr, Box, Txt, Ch, Gan…) with readable Unicode icons. Made buttons larger (26px min-height, 13px font) and widened the dock slightly (36px expanded, 20px collapsed). Separated collapsed state into a slim rail with a single expand arrow. Added danger styling to delete/clear buttons. Added proper title tooltips that show both the tool name and usage hint.

**Icon mapping:**
| Tool       | Old label | New icon |
|------------|-----------|----------|
| Cursor     | Cur       | ↖        |
| H-Line     | H         | ─        |
| V-Line     | V         | │        |
| Trend Line | TL        | ↗        |
| Ray        | Ray       | →        |
| Arrow      | Arr       | ↑        |
| Rectangle  | Box       | ▭        |
| Text       | Txt       | T        |
| Channel    | Ch        | ⇌        |
| Fibonacci  | Fib       | φ        |
| Gann Fan   | Gan       | ✦        |
| Properties | Prop      | ⚙        |
| Lock/Unlock| Lock      | 🔒/🔓   |
| Deselect   | Sel       | ✕        |
| Delete     | Del       | ⌫        |
| Undo       | Undo      | ↩        |
| Magnet     | Mag       | ⊕        |
| Clear All  | All       | ⊗        |
| Reset Pane | Pane      | ⊡        |

---

---

## 2026-04-02 — Toolbar properties dialog fix for new indicators

**`src/components/Toolbar.tsx`** — Added missing `IndicatorFields` switch cases so the properties dialog shows editable fields for all 6 new indicators:
- `DEMA`, `TEMA`, `MOM`, `CMF` → Period + Color (grouped with the existing SMA/EMA/RSI… cases)
- `VWAP` → Color only (no period — it's always cumulative)
- `AROON` → Period + Aroon Up Color + Aroon Down Color

Previously clicking any of these in the toolbar showed a blank dialog. Now all fields are editable.

---

### Files Modified
- `src/engine/ScaleManager.ts` — zoom-out scroll fix
- `src/engine/types.ts` — new indicator types
- `src/engine/Indicators.ts` — new indicator computations (DEMA/TEMA via local EMA chains)
- `src/indicators/catalog.ts` — new catalog entries
- `src/components/ChartToolDock.tsx` — UI overhaul
- `src/components/Toolbar.tsx` — new indicator properties fields + color swatch fix
