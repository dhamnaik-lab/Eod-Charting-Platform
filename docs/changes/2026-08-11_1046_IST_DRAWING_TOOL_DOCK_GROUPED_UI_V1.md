# Drawing Tool Dock Grouped UI V1

**IST timestamp:** 2026-08-11 10:46 IST (+05:30)  
**Project:** EOD Charting Platform  
**Project path:** `E:\TA Projects\EOD Charting Platform`  
**Authoritative baseline:** `Eod Charting Platform Source Code 2026-08-11_104332_IST`  
**Baseline ZIP SHA-256:** `f26f67ae4c17afa9c4694867830a69d615cfd49f47283a3eacb469a6a6f80fe2`

## Objective

Replace the long flat Drawing Tool Dock list and the legacy `More / Less` advanced-tools flyout with a compact grouped navigation model inspired by TradingView-style drawing families, without changing any persisted drawing identity, geometry, interaction, workspace state, or alert behavior.

## Previous limitation

The dock exposed five primary controls and placed the remaining drawing tools behind one large advanced-tool grid. After D3C the platform has 48 persisted drawing kinds, making one undifferentiated advanced list difficult to scan and increasingly unsuitable for D4/D5 expansion.

## Files changed

### Modified

- `src/components/ChartToolDock.tsx`
- `src/components/__tests__/ChartToolDockTooltips.test.ts`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`

### Created

- `src/components/DrawingToolGroups.ts`
- `src/components/__tests__/DrawingToolGroups.test.ts`
- `docs/changes/2026-08-11_1046_IST_DRAWING_TOOL_DOCK_GROUPED_UI_V1.md`

## Final implementation

Cursor and Crosshair remain direct top-level controls. The 48 persisted drawing kinds are partitioned exactly once into nine stable families:

1. Lines
2. Channels
3. Pitchforks
4. Fibonacci / Gann
5. Shapes
6. Measure / Projection
7. Positions
8. Arrows / Markers
9. Text

Each family row contains:

- a main button showing the last-used tool for that family;
- a narrow family-menu control that opens the flyout to the left of the right-side dock;
- a name-and-icon flyout list with active-tool highlighting;
- name-only hover text for actual drawing tools.

Selecting a tool from a family updates that family's last-used selection. The selection is stored under UI-only local storage key `eod-chart.chartToolDock.groupLastUsed.v1`. Invalid/stale stored values are sanitized back to the family's default tool. The value never enters chart/workspace serialization.

The dock closes an open family flyout when a tool is activated, the dock is collapsed, or the user clicks outside the dock.

## Tool-family mapping

### Lines
Trend Line, Ray, Extended Line, Horizontal Ray, Horizontal Line, Vertical Line, Cross Line, Info Line, Trend Angle.

### Channels
Parallel Channel, Flat Top / Bottom, Disjoint Channel, Regression Trend.

### Pitchforks
Andrews' Pitchfork, Schiff Pitchfork, Modified Schiff Pitchfork, Inside Pitchfork, Pitchfan.

### Fibonacci / Gann
Fibonacci Retracement, Fibonacci Extension, Trend-Based Fib Extension, Fibonacci Channel, Fib Time Zone, Trend-Based Fib Time, Fib Circles, Fib Arcs, Fibonacci Wedge, Fibonacci Fan, Gann Fan, Gann Box.

### Shapes
Rectangle / Box, Rotated Rectangle, Circle, Ellipse, Triangle, Arc.

### Measure / Projection
Measure, Price Range, Date Range, Forecast, Projection.

### Positions
Long Position, Short Position.

### Arrows / Markers
Arrow, Arrow Marker, Arrow Up, Arrow Down.

### Text
Text Label. This group intentionally remains a family because later D4 annotation/text tools can enter it without changing dock architecture.

## Behavior deliberately preserved

- all 48 persisted drawing kinds and exact kind strings;
- D1-D3C drawing geometry and anchor semantics;
- D3B.2 Properties titles and label-position behavior;
- D3A.1 name-only drawing-tool hover behavior;
- per-symbol/per-sheet drawing scopes;
- timeframe/Renko anchor reconciliation;
- locking and deletion protection;
- drawing alerts and their existing whitelist;
- current utility controls: Properties, Lock/Unlock, Deselect, Delete, Undo, Magnet, Clear All, Reset Pane Heights;
- existing active-tool click behavior: clicking the already-active tool returns to Cursor.

## D3C validation evidence reconciled

The baseline documentation previously recorded D3C Windows validation as pending. The user subsequently supplied the actual Windows result:

- 24 / 24 focused Vitest files passed;
- 104 / 104 tests passed;
- renderer TypeScript typecheck passed;
- renderer production build passed;
- 591 modules transformed;
- build completed in 5.73 seconds.

This report and the accompanying documentation update supersede the stale pending-validation wording.

## Validation commands after installation

```powershell
npm test -- `
  'src/components/__tests__/DrawingToolGroups.test.ts' `
  'src/components/__tests__/ChartToolDockTooltips.test.ts' `
  'src/engine/__tests__/DrawingD3CGeometry.test.ts' `
  'src/engine/__tests__/DrawingD3CContracts.test.ts' `
  'src/engine/__tests__/DrawingD3B2Contracts.test.ts' `
  'src/engine/__tests__/DrawingLabelLayout.test.ts' `
  'src/engine/__tests__/DrawingD3BGeometry.test.ts' `
  'src/engine/__tests__/DrawingD3BContracts.test.ts' `
  'src/engine/__tests__/DrawingMultiAnchorGeometry.test.ts' `
  'src/engine/__tests__/DrawingD3AContracts.test.ts' `
  'src/engine/__tests__/DrawingCapabilities.test.ts' `
  'src/engine/__tests__/DrawingAdvancedGeometry.test.ts' `
  'src/engine/__tests__/DrawingD2Contracts.test.ts' `
  'src/engine/__tests__/DrawingGeometry.test.ts' `
  'src/engine/__tests__/DrawingD1Contracts.test.ts' `
  'src/engine/__tests__/DrawingWorkspaceCompatibility.test.ts' `
  'src/engine/__tests__/DrawingMagnet.test.ts' `
  'src/features/charts/__tests__/drawingTimeframeAnchorService.test.ts' `
  'src/features/charts/__tests__/drawingScopeService.test.ts' `
  'src/features/charts/__tests__/chartInstrumentDrawingScopes.test.ts' `
  'src/features/charts/__tests__/chartSheetWorkspaceService.test.ts' `
  'src/features/charts/__tests__/chartTabStateMutationService.test.ts' `
  'src/features/charts/__tests__/drawingLockProtection.test.ts' `
  'src/features/workspace/__tests__/workspacePersistence.test.ts' `
  'src/features/alerts/__tests__/eodAlerts.test.ts' `
  --exclude '**/EOD_Chart_Drawing_Tools_Phase_*/**' `
  --exclude '**/EOD_Chart_Drawing_Tool_Dock_*/**'

npm run typecheck:renderer
npm run build:renderer
```

## Validation completed before delivery

The preparation environment does not contain the project's installed npm dependency tree, so full Vitest/typecheck/build are not claimed here.

Completed package-construction checks:

- TypeScript/TSX syntax transpilation for changed/new TS files: PASS;
- group runtime harness: 9 groups / 48 unique persisted drawing tools: PASS;
- Cursor/Crosshair direct-tool contract: PASS;
- invalid last-used-value sanitization harness: PASS;
- drawing metadata coverage: 50 total tool metadata IDs (48 persisted + Cursor + Crosshair), no duplicates: PASS;
- legacy `More / Less` advanced-tool flow absent from new component: PASS;
- grouped rendering and last-used local-state hooks present: PASS;
- exact authoritative baseline SHA-256 guards: PASS;
- payload and outer ZIP integrity: PASS;
- simulated post-copy SHA-256 verification: PASS.

## Risks / limitations

This is a UI navigation change, so automated tests cannot establish visual ergonomics. Portable/manual acceptance should check flyout positioning, family selection, last-used behavior, active highlighting, dock collapse, and usability at the application's normal window sizes.

No keyboard-shortcut redesign is included. No user-reorderable groups are included. Tool families are intentionally static in V1 so later D4/D5 tools can be assigned deterministically.

## Rollback

Restore the installer-created pre-change backup. Because drawing IDs and workspace schemas are unchanged, rollback does not require workspace migration.

## Next step

After Windows automated validation, the grouped dock can be included in the next combined portable/manual build together with the deferred D3B.2 visual check and D3C manual acceptance. After dock acceptance, proceed to the separately scoped unified TradingView-style Drawing/Indicator Style settings architecture, including independent per-line/per-plot colors where applicable.
