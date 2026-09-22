# Drawing Tools Phase D3C — Position and Projection V1

**IST timestamp:** 2026-08-11 10:30 IST  
**Project:** EOD Charting Platform  
**Baseline:** accepted post-D3B.2 source state produced by the verified D3B lineage and successful D3B.2 guarded application  
**Scope:** final D3 multi-anchor drawing group

## Objective

Add three chart-planning/projection tools on the existing generalized multi-anchor architecture:

1. Long Position
2. Short Position
3. Projection

No broker execution, order placement, account-risk authority, automatic alerts, or trading-system authority is introduced.

## Previous limitation

The D3 generalized anchor model already supported channels, geometric shapes, pitchforks, and advanced Fibonacci tools, but the planned position/projection family was still absent.

## Files changed

### Modified
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartToolDock.tsx`
- `src/engine/ChartEngine.ts`
- `src/engine/DrawingCapabilities.ts`
- `src/engine/DrawingMetadata.ts`
- `src/engine/DrawingMultiAnchorGeometry.ts`
- `src/engine/Renderer.ts`
- `src/engine/__tests__/DrawingWorkspaceCompatibility.test.ts`
- `src/engine/types.ts`

### Created
- `src/engine/DrawingD3CGeometry.ts`
- `src/engine/__tests__/DrawingD3CGeometry.test.ts`
- `src/engine/__tests__/DrawingD3CContracts.test.ts`
- `docs/changes/2026-08-11_1030_IST_DRAWING_TOOLS_PHASE_D3C_POSITION_AND_PROJECTION_V1.md`

## Final implementation

### Long Position

Three anchors use the canonical order:

- Anchor 0 — Entry
- Anchor 1 — Target and shared end-time boundary
- Anchor 2 — Stop

Target and Stop are normalized to the same horizontal end-time anchor. The renderer shows reward and risk zones, Entry/Target/Stop lines, reward/risk percentages, and risk:reward. Invalid price orientation is visibly flagged but values are not silently changed.

### Short Position

Uses the same anchor contract and calculations as Long Position with short-side orientation validation. It remains a drawing/planning object only.

### Projection

Three anchors use A/B/C. Point D is derived from the complete A→B vector and repeated from C:

- projected price = C price + (B price − A price)
- projected bar index = C index + (B index − A index)

The renderer shows the reference vector, projected vector, light projection zone, connecting guides, direction arrow, projected target, percent move, and bar displacement.

### Shared D3 infrastructure

All three tools use the existing `DrawingAnchor[]` lifecycle:

- multi-click creation and live preview
- Esc cancellation
- anchor dragging
- whole-drawing dragging
- timestamp remapping across timeframes
- Renko anchor reconciliation
- per-sheet/per-symbol drawing scopes
- workspace persistence
- lock/delete protection
- common Properties color/width/style workflow

Long/Short constrain the Stop anchor to the Target/end-time x-coordinate during creation/editing so the two zones remain one coherent planning block.

### Properties

- Long Position: Show Label
- Short Position: Show Label
- Projection: Show Label + Label Position Left/Right

No Extend Left/Right control is exposed because it is not meaningful for these finite planning/projection drawings.

## Behaviour deliberately preserved

- D1/D2/D3A/D3B drawing geometry and schemas
- D3B.2 tool-specific Properties titles
- D3B.2 default-left/no-filled-background level labels
- D3A.1 name-only drawing-tool hover
- drawing alert whitelist
- symbol/sheet/timeframe/Renko persistence
- existing Forecast remains a separate manual two-point expectation tool
- existing Fibonacci Extension remains unchanged

## Validation commands for Windows

```powershell
npm test -- "src/engine/__tests__/DrawingD3CGeometry.test.ts" "src/engine/__tests__/DrawingD3CContracts.test.ts" "src/engine/__tests__/DrawingWorkspaceCompatibility.test.ts" "src/engine/__tests__/DrawingMultiAnchorGeometry.test.ts" "src/engine/__tests__/DrawingD3BGeometry.test.ts" "src/engine/__tests__/DrawingD3BContracts.test.ts" "src/engine/__tests__/DrawingD3B2Contracts.test.ts" "src/engine/__tests__/DrawingLabelLayout.test.ts" "src/engine/__tests__/DrawingCapabilities.test.ts" "src/engine/__tests__/DrawingAdvancedGeometry.test.ts" "src/engine/__tests__/DrawingD2Contracts.test.ts" "src/engine/__tests__/DrawingGeometry.test.ts" "src/engine/__tests__/DrawingD1Contracts.test.ts" "src/engine/__tests__/DrawingMagnet.test.ts" "src/features/charts/__tests__/drawingTimeframeAnchorService.test.ts" "src/features/charts/__tests__/drawingScopeService.test.ts" "src/features/charts/__tests__/chartInstrumentDrawingScopes.test.ts" "src/features/charts/__tests__/chartSheetWorkspaceService.test.ts" "src/features/charts/__tests__/chartTabStateMutationService.test.ts" "src/features/charts/__tests__/drawingLockProtection.test.ts" "src/features/workspace/__tests__/workspacePersistence.test.ts" "src/features/alerts/__tests__/eodAlerts.test.ts" "src/components/__tests__/ChartToolDockTooltips.test.ts" --exclude "**/EOD_Chart_Drawing_Tools_Phase_*/**"
npm run typecheck:renderer
npm run build:renderer
```

## Pre-delivery validation performed in the package worktree

- changed TypeScript/TSX syntax transpilation
- deterministic D3C geometry execution harness
- tool/metadata/capability registration audit
- exact baseline SHA-256 guard generation
- simulated payload application and post-copy SHA-256 verification
- payload ZIP integrity
- outer ZIP integrity

Full Windows Vitest/typecheck/build remain pending until the guarded package is applied to the user's project.

## Risks / limitations

- Position tools currently use semantic target/reward green and stop/risk red while the drawing's common color controls the entry/reference styling. Independent per-line/zone colors belong to the already-planned unified TradingView-style Style settings phase.
- Position planning does not calculate quantity, account risk, commission, lot size, or P&L currency amounts.
- D3B.2 final visual confirmation remains intentionally deferred until the next portable build.
- The current flat drawing dock remains crowded; grouped TradingView-style tool families are the planned next UI phase after D3C acceptance.

## Rollback

Restore all modified files from the installer-created pre-change backup and remove the new D3C geometry/tests/report. No workspace schema migration is required because the new drawing kinds are additive JSON-safe `ChartDrawing` members.
