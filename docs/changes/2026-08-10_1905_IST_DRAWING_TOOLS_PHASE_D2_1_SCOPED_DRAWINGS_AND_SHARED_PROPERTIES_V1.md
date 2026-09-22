# Drawing Tools Phase D2.1 — Scoped Drawings and Shared Properties V1

**IST timestamp:** 2026-08-10 19:05 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Guarded baseline:** `Eod Charting Platform Source Code 2026-08-10_184042_IST`  
**Baseline ZIP SHA-256:** `e0f2704fbba34725a32ec95ef53f9026f794f961e20f901edbb48a59930bc281`

## Objective

Close the remaining Phase D2 runtime-acceptance defects without beginning D3:

1. drawings must be owned independently by chart tab, sheet, and instrument identity;
2. creating a new sheet must commit the current sheet first so its drawings are not lost;
3. switching from one symbol to another must not carry the previous symbol's drawings into the new symbol;
4. returning to a previously used symbol must restore that symbol's drawings for the active sheet;
5. `Extend Left`, `Extend Right`, and `Show Label` must be reusable drawing capabilities rather than Regression-Trend-only settings.

## Previous defects / limitations

The D2 source had passed Windows focused Vitest (8 files / 44 tests), renderer TypeScript typecheck, and renderer production build. Portable runtime geometry was broadly working. Manual acceptance then exposed two state-lifecycle defects:

- `applyEodResultToTab()`/instrument loading retained the active tab's `drawings` when the base instrument changed, so TCS drawings could appear on RELIANCE.
- `buildSaveCurrentAsSheetState()` created and activated a new blank sheet without first committing unsaved current-sheet state, so drawings on Sheet 1 could disappear when Sheet 2 was created.

The Properties UI also had no shared capability contract for extension and label visibility. Regression Trend was the immediate example, but the requirement applies to every drawing whose geometry or renderer supports those features.

## Files inspected

Primary implementation paths:

- `src/engine/types.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `src/engine/DrawingGeometry.ts`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartDrawingPropertiesDialog.tsx`
- `src/store/chartStoreTypes.ts`
- `src/features/charts/chartTabWorkspaceService.ts`
- `src/features/charts/chartSheetWorkspaceService.ts`
- `src/features/charts/chartInstrumentHydrationService.ts`
- `src/features/charts/chartTabStateMutationService.ts`
- `src/features/charts/drawingTimeframeAnchorService.ts`
- `src/features/workspace/workspacePersistence.ts`
- existing D1/D1.1/D2 drawing tests and alert tests

## Files created

- `src/engine/DrawingCapabilities.ts`
- `src/engine/__tests__/DrawingCapabilities.test.ts`
- `src/features/charts/drawingScopeService.ts`
- `src/features/charts/__tests__/drawingScopeService.test.ts`
- `src/features/charts/__tests__/chartInstrumentDrawingScopes.test.ts`
- `docs/changes/2026-08-10_1905_IST_DRAWING_TOOLS_PHASE_D2_1_SCOPED_DRAWINGS_AND_SHARED_PROPERTIES_V1.md`

## Files modified

- `src/engine/types.ts`
- `src/engine/DrawingGeometry.ts`
- `src/engine/Renderer.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/__tests__/DrawingGeometry.test.ts`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartDrawingPropertiesDialog.tsx`
- `src/store/chartStoreTypes.ts`
- `src/features/charts/chartTabWorkspaceService.ts`
- `src/features/charts/chartSheetWorkspaceService.ts`
- `src/features/charts/chartInstrumentHydrationService.ts`
- `src/features/charts/chartTabStateMutationService.ts`
- `src/features/charts/__tests__/chartSheetWorkspaceService.test.ts`
- `src/features/charts/__tests__/chartTabStateMutationService.test.ts`
- `src/features/workspace/workspacePersistence.ts`
- `src/features/workspace/__tests__/workspacePersistence.test.ts`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`

## Final implementation

### 1. Per-sheet + per-instrument drawing scopes

`ChartTabState` now carries:

```ts
drawings: ChartDrawing[];
drawingScopes: Record<string, ChartDrawing[]>;
```

`drawings` remains the active collection used by the renderer and interaction layer. `drawingScopes` stores the inactive symbol collections for the current sheet.

The scope key is canonical:

```text
EXCHANGE:SYMBOL
```

with both components normalized to uppercase.

Example:

```text
Chart Tab A
└─ Sheet 1
   ├─ NSE:TCS      -> TCS drawings
   └─ NSE:RELIANCE -> Reliance drawings
```

Each sheet serializes its own scope map, so the same symbol may have different drawings on different sheets. Different chart tabs already have independent `ChartTabState` objects and therefore independent scope maps.

### 2. Symbol switching

Before activating another instrument, the active drawing collection is saved to the outgoing instrument's scope. The target instrument's scoped collection is then activated.

When the target data finishes loading, timestamp-aware drawing anchors are rebound/remapped to the target display bars. Requested aliases are normalized to the resolved exchange/symbol identity where necessary.

Expected behavior:

```text
TCS drawings -> switch to RELIANCE -> TCS drawings hidden
RELIANCE drawings -> switch back to TCS -> TCS drawings restored
```

### 3. Sheet creation and switching

Creating a new sheet now commits the active sheet workspace before activating the new blank sheet.

Sheet switching continues to commit the outgoing sheet, then loads the incoming sheet and selects the drawing scope belonging to the currently active symbol.

This prevents Sheet 1 drawings from being discarded when Sheet 2 is created and preserves independent drawing contexts per sheet.

### 4. Workspace backward compatibility

Workspace version remains `1`.

`drawingScopes` is optional in persisted content. When an old workspace has only `drawings`, restore logic migrates those drawings into the active instrument's scope. Existing persisted drawing kind names and drawing objects are not renamed or rewritten.

### 5. Shared drawing capabilities

`ChartDrawingBase` now has optional:

```ts
extendLeft?: boolean;
extendRight?: boolean;
showLabel?: boolean;
```

`DrawingCapabilities.ts` centrally determines which drawing kinds expose each capability. This is intentionally reusable for later D3-D5 tools.

Current extendable drawings:

- Trend Line
- Info Line
- Trend Angle
- Regression Trend
- Parallel Channel
- Fibonacci Retracement

Current label-visibility-capable drawings:

- Info Line
- Trend Angle
- Price Range
- Date Range
- Regression Trend
- Fibonacci Time Zone
- Fibonacci Circles
- Fibonacci Arcs
- Forecast
- Fibonacci Retracement
- Fibonacci Extension
- Fibonacci Fan
- Gann Fan
- Measure

The Properties dialog displays only applicable controls. Existing drawings preserve previous behavior because omitted `extendLeft`/`extendRight` mean OFF and omitted `showLabel` means visible.

### 6. Rendering and hit testing

Extension behavior is implemented in the native renderer and hit-testing paths for the current extendable drawings. Selection handles remain on the original user anchors even when the visible line/channel extends to chart boundaries.

`Show Label` gates actual renderer labels rather than only hiding UI metadata.

### 7. Drawing mutation synchronization

Add/update/lock/delete/clear/remove-last and timeframe remapping now synchronize the active `drawingScopes` entry so saved/restored scope state cannot lag behind the visible `drawings` collection.

## Behavior deliberately preserved

- all original drawing kinds and D1/D1.1/D2 drawing geometry;
- unified Properties color workflow (`choose color -> Save`);
- locked-drawing deletion protection;
- timeframe-stable timestamp anchors;
- existing Measure semantics;
- existing two-anchor Fibonacci Extension semantics;
- existing Fibonacci Fan and Gann Fan semantics;
- drawing alert whitelist remains `hline`, `trendline`, and `ray` only;
- workspace format version remains 1;
- custom Canvas chart engine remains authoritative;
- no `lightweight-charts` runtime dependency was added;
- D3 generalized multi-anchor work was not started.

## Validation performed during package preparation

The extracted snapshot does not contain the project's installed `node_modules`, so full Vitest/typecheck/build cannot be truthfully claimed in this preparation environment.

Performed here:

1. TypeScript/TSX transpilation syntax check across 21 modified/new source and test files: **PASS**.
2. Executed `DrawingGeometry.ts` and `DrawingCapabilities.ts` via TypeScript transpilation harness:
   - Extend Left/Right geometry including reversed anchors: **PASS**.
   - shared extension capability registry: **PASS**.
   - shared label capability registry and default-visible/explicit-hide behavior: **PASS**.
3. Executed `drawingScopeService.ts` with the real timeframe-anchor service via a TypeScript module harness:
   - TCS -> RELIANCE isolation: **PASS**.
   - RELIANCE -> TCS restoration: **PASS**.
   - stable two-anchor timestamp binding: **PASS**.
4. Package manifest and SHA-256 verification: performed when package is built.

## Required Windows validation

The guarded installer must run focused tests that include:

- drawing capabilities;
- drawing geometry;
- per-symbol drawing scopes;
- instrument hydration scope switching;
- sheet commit/restore behavior;
- workspace legacy migration and scope persistence;
- drawing mutation scope synchronization;
- timeframe anchors;
- lock protection;
- D1/D2 contracts;
- drawing-alert regression.

Then run:

```powershell
npm run typecheck:renderer
npm run build:renderer
```

After automated PASS:

```powershell
npm run tauri:portable:win
```

Manual acceptance must confirm:

1. plot drawings on TCS;
2. switch to RELIANCE and confirm TCS drawings are absent;
3. add a Reliance drawing;
4. switch back to TCS and confirm TCS drawings restore;
5. return to Reliance and confirm Reliance drawing restores;
6. on Sheet 1 create drawings, create Sheet 2, then return to Sheet 1 and verify drawings remain;
7. verify the same symbol can hold different drawings on Sheet 1 and Sheet 2;
8. verify Extend Left/Right for every currently supported tool;
9. verify Show Label on every currently labeled tool;
10. verify Properties color workflow and locked-deletion protection remain correct;
11. verify Daily -> Weekly -> Daily remains correct;
12. restart the portable application and confirm scopes/sheets restore.

## Risks / limitations

- `drawingScopes` increases workspace JSON size in proportion to saved symbol-specific drawing collections. This is bounded by user-created drawings and does not copy OHLC history.
- Inactive symbol scopes retain timestamp identities and their last resolved indexes; timestamp remapping is authoritative when that symbol is loaded again.
- Future D3/D4 tools must register their extension/label capabilities centrally rather than creating tool-specific Properties logic.
- Label dragging remains deferred; current label positioning behavior is unchanged except for visibility control.

## Rollback guidance

The installer must call `scripts\create-project-backup.ps1` before replacing modified files. To roll back, restore the files listed in that generated backup manifest. Existing version-1 workspace files remain readable by the previous source because `drawingScopes` is an additive JSON field; previous builds will ignore the extra field but will only use the active `drawings` collection.

## Status

**Implementation prepared. Windows automated validation and portable runtime acceptance are pending. D3 must not begin until D2.1 passes.**
