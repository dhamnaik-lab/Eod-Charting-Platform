# Drawing Tool Name-Only Tooltips V1

**IST timestamp:** 2026-08-11 00:18 IST  
**Project:** EOD Charting Platform  
**Baseline:** accepted Phase D3A source state derived from `Eod Charting Platform Source Code 2026-08-10_201450_IST` plus validated D3A V1.1 payload  
**Scope:** drawing-tool dock tooltip text only

## Objective

Remove instructional descriptions from drawing-tool hover tooltips so every primary and advanced drawing tool shows only its tool name.

## Previous limitation

Drawing buttons used `title={`${tool.title}\\n${tool.hint}`}`, so hovering a tool displayed the tool name plus a longer usage description. Manual D3A acceptance requested a compact name-only tooltip.

## Files changed

### Modified
- `src/components/ChartToolDock.tsx`

### Created
- `src/components/__tests__/ChartToolDockTooltips.test.ts`
- `docs/changes/2026-08-11_0018_IST_DRAWING_TOOL_NAME_ONLY_TOOLTIPS_V1.md`

## Final implementation

Both primary and advanced drawing-tool button mappings now pass:

```tsx
title={tool.title}
```

The internal `hint` metadata is deliberately retained for possible future Help/Documentation use, but is no longer shown in hover tooltips.

This change affects drawing-tool buttons only. Selection/utility controls continue to expose their normal action names such as Drawing Properties, Lock/Unlock, Undo and Clear Drawings.

## Behaviour deliberately preserved

- All D1/D2/D3A drawing geometry and interaction
- Multi-anchor creation and editing
- Per-symbol/per-sheet drawing scopes
- Timeframe-stable anchors
- Lock/delete protection
- Properties/color workflow
- Extend Left / Extend Right / Show Label capabilities
- Drawing alerts
- Workspace persistence
- Existing tool metadata and help hints internally

## Validation commands

```powershell
npm test -- "src/components/__tests__/ChartToolDockTooltips.test.ts" "src/engine/__tests__/DrawingD3AContracts.test.ts"
npm run typecheck:renderer
npm run build:renderer
```

## Actual validation results

Package-construction validation performed before delivery:

- tooltip source transformation check: PASS
- primary + advanced tool mapping count: PASS (2 mappings use `title={tool.title}`)
- package baseline SHA-256 guards: PASS
- payload ZIP integrity: PASS
- outer ZIP integrity: PASS

Windows Vitest/typecheck/build remain pending until the package is applied to the user's project.

## Risks / limitations

Low risk. The change is limited to HTML button `title` values. Tool hints remain in source metadata but are intentionally no longer displayed by the dock.

## Rollback guidance

Restore the pre-change `src/components/ChartToolDock.tsx` from the installer-created backup and remove the added test/report if rollback is required.
