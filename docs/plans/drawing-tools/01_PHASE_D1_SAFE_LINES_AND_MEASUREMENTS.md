# Phase D1 — Safe Lines and Measurements

**Status:** IMPLEMENTED — D1.1 RUNTIME-CORRECTION VALIDATION PENDING

## Runtime acceptance correction D1.1

The first Windows manual acceptance after D1 automated validation exposed three blockers that must be corrected before D1 is accepted or D2 begins:

1. drawings created on Daily must retain their intended date anchors when switching to Weekly/Monthly/Quarterly/Yearly and back;
2. a locked drawing must not be removable through Delete, Clear Drawings, or remove-last/undo-style commands;
3. Drawing Properties must reliably commit common style changes, including color.

The same acceptance also requested that the Date Range information label avoid the chart title/candle area. D1.1 therefore auto-places that label into available lower/upper free space. Fully draggable information-label placement remains deferred to the later drawing-settings/annotation UX phase.

D1.1 does not expand drawing-alert eligibility or alter the seven D1 tool definitions.

## 1. Goal

Add seven high-value drawing tools without introducing generalized multi-anchor storage or replacing any existing drawing semantics.

## 2. Tools in D1

| Tool | Anchors | Native behavior |
|---|---:|---|
| Extended Line | 2 | Infinite line through both anchors, extended left and right |
| Horizontal Ray | 1 | Horizontal line starting at anchor and extending right by default |
| Cross Line | 1 | Persistent horizontal + vertical lines through one anchor |
| Info Line | 2 | Segment with price/time/bar/percentage information |
| Trend Angle | 2 | Trend segment with angle information |
| Price Range | 2 | Horizontal price zone/range with price and percentage metrics |
| Date Range | 2 | Vertical time range with bar/date/day metrics |

## 3. Files that must be inspected first

- `src/engine/types.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `src/components/ChartToolDock.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartDrawingPropertiesDialog.tsx`
- `src/components/ChartDrawingContextMenu.tsx`
- `src/engine/__tests__/DrawingMagnet.test.ts`
- `src/features/alerts/eodAlerts.ts`
- `src/features/alerts/__tests__/eodAlerts.test.ts`

Reference behavior:

- `src/tools/lines/extended-line.ts`
- `src/tools/lines/horizontal-ray.ts`
- `src/tools/lines/cross-line.ts`
- `src/tools/lines/info-line.ts`
- `src/tools/lines/trend-angle.ts`
- `src/tools/shapes/price-range.ts`
- `src/tools/forecasting/date-range.ts`

## 4. Required data-model changes

Extend `DrawingTool` and `ChartDrawing` with distinct new persisted kinds. Suggested native names:

- `extendedLine`
- `horizontalRay`
- `crossLine`
- `infoLine`
- `trendAngle`
- `priceRange`
- `dateRange`

Do **not** reuse or reinterpret:

- `trendline`
- `ray`
- `measure`
- `hline`
- `vline`

Backward compatibility requirement: an existing serialized workspace must deserialize exactly as before.

## 5. Creation behavior

### One-anchor tools

`Horizontal Ray` and `Cross Line`:

- one chart click creates the drawing;
- Esc cancels;
- magnet applies only where current policy permits;
- anchor must support Renko reconciliation like other anchored price drawings.

### Two-anchor tools

The remaining five tools should use the current two-click creation lifecycle:

1. first anchor;
2. live preview to crosshair;
3. second anchor commits;
4. Esc clears pending state.

No new generalized anchor state machine is required in D1.

## 6. Rendering contract

### Extended Line

- Use the line equation through both anchors.
- Extend to both visible chart edges.
- Vertical/near-vertical input must be handled without division-by-zero.
- Selection handles remain at the original anchors, not at viewport intersections.

### Horizontal Ray

- Default direction: right.
- Draw from anchor X to chart-right boundary at anchor price.
- Hit testing must not select the invisible half of the horizontal line.

### Cross Line

- Persistent drawing, distinct from transient chart crosshair.
- Horizontal line spans plot width.
- Vertical line spans active pane height.
- Selection is associated with the single anchor.

### Info Line

At minimum show:

- start value
- end value
- absolute change
- percentage change
- bar difference

If reliable timestamp information is available, also show elapsed calendar time. Do not invent calendar-day accuracy from bar count.

### Trend Angle

Angle display must be explicitly defined. Pixel-space angle changes with chart scaling, while price/bar slope is scale-invariant.

D1 should expose a stable definition such as:

- slope in price units per bar; and/or
- normalized angle derived from the current visual coordinate system, clearly treated as visual.

Do not present a pixel-derived angle as an invariant market statistic.

### Price Range

- Anchors define two price levels.
- Visual range spans the active pane width unless a native design decision explicitly bounds it.
- Show absolute range and percentage range.
- Must handle zero/negative denominator safely.

### Date Range

- Anchors define start/end bar indexes.
- Highlight full pane height between them.
- Show exact bar count from indexes.
- Calendar-day value must use underlying bar timestamps/dates, not a `1 bar = 1 day` approximation.

## 7. Properties dialog

At minimum all D1 tools must support:

- color
- line width where applicable
- line style where applicable
- lock/unlock

Tool-specific options may be added only where they have clear value.

Do not overbuild a universal settings framework in D1.

## 8. Hit testing and editing

Every D1 tool must support:

- selection
- body drag
- anchor drag where meaningful
- lock
- delete
- undo/clear compatibility
- context menu
- persistence and reload

`Horizontal Ray` hit testing must respect its direction.  
`Cross Line` may hit on either axis line but must retain one anchor.

## 9. Alerts contract

Existing alert eligibility is deliberately limited to:

- Horizontal Line
- Trend Line
- Ray

**D1 must not change this whitelist.**

Even though Extended Line and Horizontal Ray are line-like, they remain non-alert drawings until alert semantics are separately designed and tested.

## 10. Tests required

At minimum add focused tests for:

- D1 drawing construction.
- Existing drawing deserialization compatibility.
- Extended-line viewport clipping/intersection.
- Horizontal-ray directional hit testing.
- Cross-line hit testing.
- Info-line metric calculation.
- Trend-angle/slope calculation.
- Price-range percentage calculation including zero denominator.
- Date-range exact bar count and timestamp-day calculation.
- magnet behavior for every new price anchor type.
- Renko anchor preservation/reconciliation where applicable.
- existing drawing-alert whitelist remains unchanged.

## 11. Validation commands

Run actual project commands; do not claim success without output.

Suggested minimum:

```powershell
npm test -- <focused drawing tests>
npm run typecheck:renderer
npm run build:renderer
```

If runtime behavior is changed materially, also:

```powershell
npm run tauri:portable:win
```

Then perform manual drawing acceptance.

## 12. D1 manual acceptance

For every new tool:

- create
- preview
- commit
- select
- drag
- edit properties
- lock
- unlock
- delete
- undo where supported
- save workspace
- restart application
- reload workspace
- switch Daily/Weekly/Daily
- switch symbols
- test normal candlestick and Renko chart if supported

Existing 13 drawings must still behave identically.

## 13. D1 non-goals

- no pitchforks;
- no 3/4-anchor generalized model;
- no brush/polyline;
- no alert expansion;
- no replacement of Measure;
- no replacement of existing Fib Extension;
- no reference-library installation.
