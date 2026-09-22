# MACD 4-Color Histogram Momentum Styling Report

Date: 2026-04-07

## Summary

Added TradingView-style 4-color momentum histogram rendering to MACD. The histogram now shows
four distinct colors based on the bar's sign and momentum direction (whether it is growing or
shrinking in magnitude), rather than a flat two-color positive/negative split.

This pass was triggered after confirming that the seven core goals from
`PRICE_SCALE_INDICATOR_VALUES_REVISED_PROMPT.md` were already fully implemented in the
April 5, 2026 Visual Parity TradingView pass. The 4-color histogram was listed as an optional
polish item in that prompt and is now complete.

---

## Background

The core price-scale / indicator-values pass (dynamic axis width, consistent formatting,
indicator pane scale auto-fit, live pane header values, right-axis value tags, overlay legend,
pane separator refinement) was fully implemented on 2026-04-05 and confirmed in
`VISUAL_PARITY_TRADINGVIEW_REPORT.md`. The remaining open optional item from that pass was
4-color histogram momentum styling.

---

## 4-Color Histogram Logic

| Bar sign | Momentum direction | Color    |
|---|---|---|
| Positive (>= 0) | Increasing (current >= prev) | `#26a69a` — teal green |
| Positive (>= 0) | Decreasing (current < prev) | `#b2dfdb` — muted teal |
| Negative (< 0)  | Decreasing (more negative, current <= prev) | `#ef5350` — red |
| Negative (< 0)  | Increasing (less negative, current > prev) | `#ffcdd2` — muted pink |

At the first valid bar (no previous non-null bar), the bar is treated as increasing in its
direction (full-strength color).

This matches the TradingView MACD histogram color convention and makes it visually easy to
identify momentum shifts before the MACD line crosses the signal line.

---

## Where the Change Is Scoped

- Only MACD histogram bars use 4-color rendering
- All other histogram-bearing indicators (none currently other than MACD) still use the
  standard two-color `positiveColor`/`negativeColor` path
- `colorValues` is an optional field on `RenderableHistogramSeries` — absent means fallback to
  the existing two-color behavior
- `drawHistogram` in `Renderer.ts` uses `colorValues?.[index]` first, falling back to the
  existing `positiveColor`/`negativeColor` per bar when not present

The right-axis indicator value tag and the pane legend live value for the MACD histogram also
now pick up the 4-color logic at the displayed bar index via `colorValues?.[valueIndex]`.

---

## Files Backed Up

`backups/pre_opencode_changes_20260407_172455_macd_4color_histogram/`

Contents: `src/engine/Indicators.ts`, `src/engine/Renderer.ts`, `src/engine/ChartEngine.ts`

---

## Files Modified

### `src/engine/Indicators.ts`
- Added `colorValues?: Array<string | null>` field to `RenderableHistogramSeries` interface
- In MACD case: compute `histColorValues` from padded histogram values, comparing each bar to
  the previous bar; attach as `colorValues` on the histogram object

### `src/engine/Renderer.ts`
- Added optional `colorValues?: Array<string | null>` parameter to `drawHistogram`
- Per-bar fill now uses `colorValues?.[index]` when present, otherwise keeps existing
  `positiveColor`/`negativeColor` logic

### `src/engine/ChartEngine.ts`
- `renderBase()` `drawHistogram` call: passes `pane.histogram.colorValues` as the new parameter
- `buildPaneLegendTokens`: histogram value color now uses `pane.histogram.colorValues?.[valueIndex]`
  with fallback to existing two-color logic
- `buildIndicatorValueTags`: histogram tag color uses same `colorValues?.[valueIndex]` pattern

---

## Validation

```
npm run test               →  2 files, 54 tests passed
npm run typecheck:renderer →  clean (0 errors)
npm run tauri:check        →  Finished dev profile (1m 22s)
npm run build              →  typecheck clean + tauri:check clean +
                               build:renderer 485 modules in 10.31s — exit 0
npm run tauri:portable:win →  Built release + staged clean
```

Portable folder check:
- `EOD Chart.exe` ✓
- `index.html` ✓
- `assets/` ✓
- `Launch Portable EOD Chart.cmd` ✓

Output: `release/tauri-portable-win/EOD Chart Portable/`
Launcher: `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`

---

## Remaining Limitations

- 4-color styling applies only to MACD; other histogram-bearing indicators (if added in the
  future) will use two-color by default unless they populate `colorValues`
- The `positiveColor`/`negativeColor` fields on the MACD histogram are preserved as fallback
  and for legend token tinting in contexts where `colorValues` is absent
- Candle wick stroke consistency and subtler grid opacity remain as lower-priority optional
  polish items from the original visual parity prompt
