# Settings S2.3.1 — TradingView UX / Visual Acceptance Corrections V1

**IST timestamp:** 2026-08-11 16:40 IST (+05:30)  
**Project:** EOD Charting Platform  
**Authoritative baseline:** `Eod Charting Platform Source Code 2026-08-11_161559_IST`  
**Baseline ZIP SHA-256:** `1ccb12e1347681b8ece4d648d992bc25b9ac7c2637d08c1f677f2cd62c68e8f5`

## Why this correction exists

Settings S2.1–S2.3 passed automated Windows validation, but the combined portable/manual review exposed several UX/visual defects that were not adequately represented by source-level contracts:

1. The generic Properties form became too tall once component-level Style controls were activated.
2. Style needed its own tab instead of sharing one vertically stacked form.
3. The Properties window was fixed in the center and could not be moved or resized.
4. The visible `Use one color` gate disabled individual color controls and added unnecessary workflow friction.
5. Fibonacci level labels were still too visually heavy and did not resemble the compact label treatment used by mature charting platforms.
6. Long Position could render semantically invalid target/stop orientation and its previous inline `--- text ---` presentation was not sufficiently TradingView-like.
7. Direct individual line colors worked well and should be the default interaction model.
8. Fib Retracement needed a clearer visual composition, including per-level colors/background bands and explicit extension behavior.

## External behavioral reference

TradingView was used as the primary behavioral reference, without copying source code:

- Fib Retracement: Style / Coordinates / Visibility; per-level controls, Background, labels/font size, left/right extension and other Fib-specific presentation options.  
  `https://www.tradingview.com/support/solutions/43000518158-fibonacci-retracement-drawing-tool/`
- Trend-Based Fib Extension: level/price/label visibility and font size plus precise coordinates.  
  `https://www.tradingview.com/support/solutions/43000518137-trend-based-fib-extension-drawing-tool/`
- Long Position: Inputs / Style / Visibility; target and stop zones, target/stop colors, text/stat presentation and timeframe visibility.  
  `https://www.tradingview.com/support/solutions/43000517002-long-position-drawing-tool/`
- Long/Short usage and risk/reward semantics.  
  `https://www.tradingview.com/support/solutions/43000475660-how-to-use-long-and-short-position-drawing-tools/`

The EOD Charting Platform intentionally omits broker/account-size authority from these chart-planning drawings.

## Files changed

### Modified

- `src/components/ChartCanvas.tsx`
- `src/components/ChartDrawingPropertiesDialog.tsx`
- `src/engine/ChartEngine.ts`
- `src/engine/DrawingD3CGeometry.ts`
- `src/engine/DrawingStyleSchema.ts`
- `src/engine/Renderer.ts`
- `src/engine/__tests__/DrawingD3CGeometry.test.ts`
- `src/engine/__tests__/DrawingS21Contracts.test.ts`
- `src/engine/__tests__/DrawingS22Contracts.test.ts`
- `src/engine/__tests__/DrawingS23Contracts.test.ts`
- `src/engine/__tests__/DrawingStyleSchema.test.ts`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`

### Created

- `src/engine/__tests__/DrawingS231Contracts.test.ts`
- `docs/changes/2026-08-11_1640_IST_SETTINGS_S2_3_1_TRADINGVIEW_UX_VISUAL_ACCEPTANCE_CORRECTIONS_V1.md`

## Implemented corrections

### 1. Tabbed Properties shell

Normal drawings now use:

```text
Style | Coordinates | Visibility
```

Long/Short Position use:

```text
Inputs | Style | Visibility
```

Only the active tab body scrolls. The header, tab strip and Save/Cancel/Delete footer remain fixed.

### 2. Movable + resizable Properties window

The dialog now:

- drags from the title bar;
- resizes from native panel edges/corner;
- uses a 560 × 420 minimum size;
- defaults to 720 × 620;
- clamps itself inside the chart/application viewport;
- persists the last bounds under `eod.chart.drawing-properties.bounds.v1`;
- reclamps after application/window resize.

### 3. Visible `Use one color` control removed

The advanced Style table no longer exposes the shared-color checkbox and never disables line color pickers.

The persisted `presentation.useOneColor` field remains readable solely for backward compatibility. When a legacy shared-color drawing is opened, its effective common color is expanded into each per-line draft color; the draft then saves with `useOneColor: false`. Other independent properties such as width/style/visibility/opacity remain preserved.

The former `Common / handle color` is renamed `Handle / construction color` and controls only common handles/construction aids.

### 4. Cleaner Fib labels

Level labels now use:

- 11px default semibold Segoe UI, user-adjustable 10–16px where label style is supported;
- the level's own color;
- no filled label box;
- no thick `strokeText` halo;
- only a subtle dark shadow for dark-chart contrast;
- a 6px offset outside the selected left/right line endpoint;
- centered vertical alignment with the level line.

This prevents the text from sitting on top of the Fib level itself and removes the previous glow-heavy appearance.

### 5. Fib Retracement visual composition

Fib Retracement schema defaults now assign a TradingView-inspired palette to individual level rows. Individual color pickers are immediately editable.

The Fib `Background` is enabled by default at low opacity. Instead of painting one common rectangle, the renderer fills each adjacent Fib interval using the corresponding level color at the configured Background opacity.

The existing drawing extension booleans are exposed as one compact Style dropdown:

```text
Don't extend | Left | Right | Both
```

No Fib ratio mathematics are changed by this phase.

### 6. Long/Short Position semantic normalization

Position anchors remain:

- anchor 0 = Entry
- anchor 1 = Target + end-time
- anchor 2 = Stop

but are now normalized by drawing kind:

```text
LONG  : Target > Entry > Stop
SHORT : Stop > Entry > Target
```

If a target/stop is entered or dragged to the wrong side, its distance from Entry is mirrored to the semantically correct side. Target and Stop continue sharing one end-time index.

The renderer and ChartEngine normalize these anchors before display/editing, so older invalid persisted position drawings are displayed coherently without a workspace migration.

### 7. TradingView-like position zones/stats

Long/Short Position is now part of the advanced component-style rollout:

- Target line default: `#26a69a`
- Entry line default: `#2962ff`
- Stop line default: `#ef5350`
- Target Zone default fill: green, 14%
- Stop Zone default fill: red, 14%

The old split `--- text ---` renderer path is removed. The tool now draws full target/entry/stop lines plus target/stop zones and compact on-chart stats for Target, Entry/R:R and Stop.

It remains a chart-planning drawing only; no broker order, position sizing or execution authority is introduced.

### 8. Coordinates and timeframe visibility become functional

The new Coordinates tab allows direct editing for:

- Horizontal Line price/value;
- Vertical Line bar index;
- one-point drawings: bar index + price/value;
- two-anchor drawings: Point 1/Point 2 bar index + price/value;
- Parallel Channel offset.

Multi-anchor non-position drawings show their anchor list read-only in this correction phase to avoid mixing a larger multi-anchor coordinate-editor project into this patch.

The Visibility tab persists master visibility plus D/W/M/Q/Y toggles. ChartEngine now excludes a disabled drawing from both render and hit-testing on that timeframe.

## Backward-compatibility boundaries

Preserved:

- all 48 persisted drawing kinds;
- grouped drawing dock and last-used group behavior;
- symbol + sheet drawing scopes;
- timeframe and Renko anchor persistence;
- drawing lock/delete protection;
- D3C.1 label-position preference and default-left behavior;
- S2.1 Regression/Channel component styles;
- S2.2 Pitchfork/Pitchfan component styles;
- S2.3 Fibonacci/Gann component styles;
- current drawing-alert whitelist;
- workspace schema compatibility.

No source IDs or drawing kinds are renamed.

## Explicitly deferred

This phase does not add:

- arbitrary add/remove/edit Fib ratio rows;
- reverse/log-scale Fib calculation controls;
- separate Price / Level-value label toggles;
- custom per-level text;
- editable multi-anchor Coordinates tables;
- Gann scale-ratio controls;
- drawing templates/default presets;
- broker/account sizing for Position drawings.

These are independent future settings features.

## Preparation validation performed here

- changed source/test TypeScript/TSX syntax transpilation: **PASS**
- focused engine semantic TypeScript check: **PASS**
- S2.3.1 runtime contract harness: **PASS**
- tab contract: **PASS**
- legacy shared-color migration contract: **PASS**
- distinct Fib default level-color contract: **PASS**
- Fib per-band Background contract: **PASS**
- Long directional normalization contract: **PASS**
- Short directional normalization contract: **PASS**
- target/stop shared end-time contract: **PASS**
- source contract: old inline `drawInlinePositionLevel` path absent: **PASS**
- source contract: dialog uses ResizeObserver + resizable bounds persistence: **PASS**

Full Windows Vitest, renderer TypeScript typecheck and production build remain to be established by `-RunValidation` on the user's project.

## Required post-apply manual acceptance

After automated Windows validation passes, rebuild portable and verify:

1. Fib Properties opens at a useful size and can be dragged/resized.
2. Style / Coordinates / Visibility tabs switch without layout corruption.
3. No `Use one color` checkbox is visible and every line color picker works immediately.
4. Fib labels are compact, legible and outside the line edge.
5. Fib Background produces low-opacity colored bands rather than the prior short-stick appearance.
6. Extend mode works in all four states.
7. Long Position always renders target above entry and stop below entry.
8. Short Position always renders stop above entry and target below entry.
9. Position target/stop zones and stats are readable.
10. S2.1/S2.2/S2.3 tools retain independent style controls.
11. Drawing Coordinates changes persist and remap correctly after timeframe changes.
12. Visibility D/W/M/Q/Y settings actually suppress both drawing display and hit-testing.

## Rollback

Use the installer-created targeted project backup. New S2.3.1 test/report files can be removed for a complete rollback.
