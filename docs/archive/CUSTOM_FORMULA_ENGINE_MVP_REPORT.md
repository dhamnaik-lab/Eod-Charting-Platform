# Custom Formula Engine MVP Report

Date: 2026-04-22

## Scope

This pass added the first controlled custom-formula study foundation to the active chart pipeline without changing database/import/watchlist/sidebar/sheet/runtime behavior.

It did not add a standalone formula library, SQLite formula table, or signal-marker renderer.

## What Was Added

- A new persisted indicator kind: `CUSTOM`
- A controlled formula engine at `src/modules/formulaEngine/customFormulaEngine.ts`
- A compact chart-side add/edit dialog at `src/components/CustomFormulaDialog.tsx`
- Toolbar and pane-settings entry points for creating/editing custom formulas

## Formula MVP Capabilities

Supported:

- variable assignment
- numeric series
- boolean series for helper logic
- arithmetic: `+`, `-`, `*`, `/`
- comparisons: `>`, `<`, `>=`, `<=`, `==`, `!=`
- fields: `open`, `high`, `low`, `close`, `volume`
- functions:
  - `SMA`
  - `EMA`
  - `RSI`
  - `highest`
  - `lowest`
  - `ref`
  - `change`
  - `crossover`
  - `crossunder`
  - `abs`
  - `min`
  - `max`

Current render behavior:

- numeric assignments render as lines
- overlay formulas render on the price pane
- pane formulas render in a separate indicator pane
- boolean assignments are evaluated and reusable inside the formula, but are not yet rendered as markers/signals in this MVP

## Files Added

- `src/modules/formulaEngine/customFormulaEngine.ts`
- `src/components/CustomFormulaDialog.tsx`

## Files Modified

- `src/engine/types.ts`
- `src/engine/Indicators.ts`
- `src/indicators/catalog.ts`
- `src/store/chartStore.ts`
- `src/store/chartStoreTypes.ts`
- `src/features/charts/chartTabStateMutationService.ts`
- `src/components/Toolbar.tsx`
- `src/components/ChartPaneControlsOverlay.tsx`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`
- `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md`

## Architectural Notes

- The formula engine is intentionally isolated under `src/modules/formulaEngine/*`
- Custom formulas reuse the existing indicator persistence path instead of introducing a second study subsystem
- Workspace compatibility was preserved by persisting custom formulas inside the existing `indicators` array
- No Tauri/backend/runtime boundary changes were made

## Current Limitations

- No standalone saved formula library or SQLite `custom_formulas` table
- No signal/marker rendering for boolean outputs yet
- No multi-plot per-line color editor; the first plot uses the selected base color and additional numeric plots use a fixed fallback palette
- No advanced scripting features such as conditionals, loops, arbitrary code execution, or AFL-style editor/runtime scope

## Validation Run

Commands executed:

```powershell
npm run typecheck:renderer
npm run build
npm run tauri:portable:win
```

Results:

- `npm run typecheck:renderer` passed
- `npm run build` passed
- `npm run tauri:portable:win` passed

Portable output:

- `release/tauri-portable-win/EOD Chart Portable`

## Backup

- `backups/pre_opencode_changes_20260422_140223_formula_engine_mvp`

## Recommended Next Step

The next contained follow-up is signal rendering for boolean outputs:

- keep the current formula parser/evaluator
- add a controlled marker-render path for boolean assignments such as `BUY` / `SELL`
- optionally add a small saved-formula library only after the current chart-side editing flow is proven stable
