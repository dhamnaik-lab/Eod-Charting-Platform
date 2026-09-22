# Drawing Tools Phase D1.1 — Runtime Acceptance Fixes V1

**IST timestamp:** 2026-08-10 16:31 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Source state:** Phase D1 V1 applied to the verified post-SMA baseline.

## Objective

Correct the manual-runtime acceptance defects discovered after Phase D1 V1 while preserving the seven new drawing tools and all pre-existing drawing behavior.

## Previous defect / limitation

The user-side D1 automated validation passed (focused Vitest 5 files / 30 tests, renderer TypeScript typecheck, and renderer production build). Manual chart testing then exposed these blockers:

1. drawings created on Daily did not remain correctly anchored when the chart timeframe changed;
2. locked drawings could still be removed through some deletion paths;
3. Drawing Properties color editing was not reliably understandable/usable;
4. the Date Range label was fixed near the top of the pane and could overlap the chart title/OHLC/candles.

The D1 acceptance contract explicitly required properties editing and Daily/Weekly/Daily switching, so D1 must remain unaccepted until these defects are corrected and revalidated.

## Files inspected

- `src/engine/types.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `src/engine/DrawingGeometry.ts`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartToolDock.tsx`
- `src/components/ChartDrawingContextMenu.tsx`
- `src/components/ChartDrawingPropertiesDialog.tsx`
- `src/features/charts/chartTabStateMutationService.ts`
- `src/store/chartStore.ts`
- drawing/workspace tests
- uploaded drawing-reference demo and registry
- uploaded indicator-reference example settings UI

## Files modified

- `src/engine/types.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `src/engine/DrawingGeometry.ts`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartToolDock.tsx`
- `src/components/ChartDrawingContextMenu.tsx`
- `src/components/ChartDrawingPropertiesDialog.tsx`
- `src/features/charts/chartTabStateMutationService.ts`
- `src/engine/__tests__/DrawingGeometry.test.ts`
- `docs/plans/drawing-tools/00_MASTER_DRAWING_TOOLS_EXPANSION_PLAN.md`
- `docs/plans/drawing-tools/01_PHASE_D1_SAFE_LINES_AND_MEASUREMENTS.md`

## Files created

- `src/features/charts/drawingTimeframeAnchorService.ts`
- `src/features/charts/__tests__/drawingTimeframeAnchorService.test.ts`
- `src/features/charts/__tests__/drawingLockProtection.test.ts`
- `docs/plans/drawing-tools/08_REFERENCE_SETTINGS_UI_AUDIT.md`
- this report

## Final implementation

### 1. Stable drawing anchors across timeframe changes

Drawings previously persisted only display-bar indexes. A Daily bar index does not identify the same date after the displayed bars are aggregated to Weekly/Monthly/Quarterly/Yearly.

D1.1 adds optional timestamp identities to point and anchored drawings:

- `anchorTimestamp`
- `startTimestamp`
- `endTimestamp`

Creation and dragging stamp those identities from the active display bars. `applyTimeframeToTab()` now remaps drawing indexes into the new display-bar series by timestamp while retaining the stable source timestamps. This allows a Daily → Weekly → Daily round trip to restore the original Daily anchor date instead of reinterpreting the old integer index in the new timeframe.

Existing serialized workspaces remain compatible because the new timestamp fields are optional. Existing drawings receive timestamps lazily on their first timeframe remap.

### 2. Locked drawings are deletion-protected

Lock now protects against removal at the store mutation seam:

- direct selected-drawing delete is refused for a locked drawing;
- Clear Drawings preserves locked drawings;
- remove-last/undo-style removal skips locked drawings and removes the newest unlocked drawing instead.

The drawing context menu, properties dialog and drawing dock also disable/guard Delete for a locked selected drawing. `ChartCanvas` checks the lock before marking drawing-linked alerts missing, so a blocked deletion cannot incorrectly orphan an alert.

### 3. Drawing Properties color workflow

The previous custom color popup required an inner confirmation and then an outer Drawing Properties Save, which made the effective commit path unclear. D1.1 makes color changes update the dialog draft immediately; the normal outer **Save** remains the single commit point. Outer **Cancel** still discards the draft.

This is a targeted reliability correction only. A complete Drawing/Indicator Settings layout redesign and replacement color picker remain deferred to the planned settings-UX phase.

### 4. Date Range label placement

The Date Range label no longer uses a fixed top-pane Y coordinate. It now inspects the candle high/low envelope inside the selected date range and prefers free space below the candles, then above them, with a safe lower-edge fallback. A reserved top strip keeps it away from the chart title/OHLC area.

The label X position is clamped to the chart width to prevent long date text from clipping at the left/right edge. Fully draggable label placement is intentionally deferred.

## Behaviour deliberately preserved

- the seven D1 drawing definitions and geometry;
- all original 13 drawing types;
- current Measure semantics;
- existing two-anchor Fibonacci Extension;
- Fibonacci Fan and Gann Fan;
- drawing-alert eligibility remains only Horizontal Line / Trend Line / Ray;
- custom Canvas chart renderer;
- magnet behavior;
- existing Renko drawing-anchor metadata;
- SMA indicator-cache correction;
- no Lightweight Charts runtime dependency.

## Validation performed in implementation environment

### TypeScript/TSX syntax transpilation

Changed/new TypeScript and TSX files were parsed/transpiled with the installed TypeScript compiler using `transpileModule` diagnostics.

**Result:** PASS.

### Pure timeframe/label harness

Validated:

- Daily Date Range anchors map into Weekly bars;
- Weekly → Daily restores the exact original Daily indexes through retained timestamps;
- Date Range label prefers free space below candles, falls above when necessary, and uses the lower safe fallback when neither side is free.

**Result:** `D1.1 pure harness: PASS`.

### Full project Vitest / renderer typecheck / renderer build

Not run in the extracted implementation environment because the source snapshot does not contain the project's installed dependency tree.

**Result:** PENDING user-side Windows validation.

## Required Windows validation

Run the D1/D1.1 focused tests, renderer typecheck and renderer build through the supplied installer `-RunValidation` option. After PASS, rebuild:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"
npm run tauri:portable:win
```

Manual acceptance must verify:

1. D1 drawings remain date-aligned across D → W → M → Q → Y → D.
2. A drawing moved while on an aggregated timeframe obtains the new timeframe anchor and maps back deterministically.
3. locked drawings cannot be deleted by keyboard, dock Delete, context menu, Properties Delete, Clear Drawings, or remove-last/undo-style actions.
4. color/line style/line width save correctly through Drawing Properties; Cancel does not modify the drawing.
5. Date Range information text avoids the chart-title/candle area and remains horizontally visible.
6. original drawing tools remain operational.
7. Renko drawing behavior is spot-checked because Renko can contain multiple bricks sharing source timestamps.

## Risks / limitations

1. Aggregated W/M/Q/Y bars are mapped by source timestamp to the containing display bucket. If a drawing is deliberately moved on an aggregated timeframe, returning to Daily maps that anchor to the aggregate bar's source timestamp, which is the deterministic expected behavior.
2. Renko series may contain repeated timestamps. Existing Renko anchor identity remains present, but portable runtime testing is required to confirm timeframe switching does not introduce a Renko-specific visual edge case.
3. Date Range labels are auto-placed, not user-draggable in D1.1.
4. The custom color picker is only workflow-corrected here; full settings layout/color-picker redesign is deferred.

## Rollback guidance

Use the installer-created backup for the D1.1 modified existing files. Remove the D1.1-created service/tests/docs if rolling back only D1.1. Do not rollback the accepted SMA cache fix or the base D1 tool additions unless a separate defect requires it.

## Post-report runtime acceptance

After the D1.1 package was applied, the user manually confirmed on 2026-08-10 that the corrected drawing behavior was working well. This closes the manual acceptance blockers described above, including the timeframe-anchor behavior, lock/delete protection, Date Range label placement, and corrected color-setting workflow.

The user additionally standardized the color-setting requirement for subsequent drawing work: all drawing tools should use the same Properties draft-color → Save workflow unless a tool genuinely requires distinct stroke/fill/text color controls.
