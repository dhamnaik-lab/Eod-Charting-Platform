# Drawing Tools Phase D2.1.1 — Renderer Exhaustiveness Typecheck Fix V1

**IST timestamp:** 2026-08-10 19:56 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Parent implementation:** Drawing Tools Phase D2.1 V1 applied to `Eod Charting Platform Source Code 2026-08-10_184042_IST`

## Objective

Correct the renderer TypeScript failure found during D2.1 Windows validation without changing drawing runtime behavior.

## Validation evidence before this correction

The user's actual Windows validation produced:

- D2.1 package application: PASS — 25 files
- post-copy SHA-256 verification: PASS
- focused Vitest: PASS — 15 files
- tests: PASS — 67/67
- renderer TypeScript typecheck: FAIL with 5 errors in `src/engine/Renderer.ts`

The five errors were all caused by TypeScript narrowing `drawing` to `never` in an obsolete generic fallback block after every current `ChartDrawing.kind` had already been handled explicitly.

## Previous defect

At the end of `drawDrawing()`, the renderer retained an old generic two-anchor fallback that accessed:

- `drawing.startIndex`
- `drawing.startPrice`
- `drawing.endIndex`
- `drawing.endPrice`
- `drawing.color`

D2/D2.1 now explicitly handles every current discriminated-union drawing kind before that block, so TypeScript correctly determined that the fallback was unreachable and narrowed `drawing` to `never`.

## Files changed

### Modified

- `src/engine/Renderer.ts`

### Created

- `docs/changes/2026-08-10_1956_IST_DRAWING_TOOLS_PHASE_D2_1_1_RENDERER_EXHAUSTIVENESS_TYPECHECK_FIX_V1.md`

## Final implementation

Removed the unreachable generic renderer fallback and replaced it with a compile-time exhaustiveness guard:

```ts
const exhaustiveDrawing: never = drawing;
void exhaustiveDrawing;
ctx.restore();
```

This preserves explicit handling for every current drawing kind and makes a future unhandled `ChartDrawing.kind` fail at compile time instead of silently falling through.

## Behavior deliberately preserved

No drawing geometry or state behavior is changed. In particular this correction does not alter:

- D2.1 per-sheet/per-symbol drawing scopes
- shared Extend Left / Extend Right / Show Label capability behavior
- drawing colors/properties
- D1/D2 drawing rendering
- timeframe-stable drawing anchors
- locked-drawing deletion protection
- alert eligibility
- workspace persistence
- SMA indicator cache behavior

## Local preparation validation

Performed in the preparation environment:

- verified the exact D2.1-applied `Renderer.ts` hash before patching
- confirmed all current `ChartDrawing.kind` branches are handled before the obsolete fallback
- TypeScript transpilation/syntax check of corrected `Renderer.ts`: PASS
- package/payload SHA-256 generation and verification: PASS

Full project Vitest/typecheck/build are **not claimed** in the preparation environment.

## Required Windows validation

Run the correction installer with `-RunValidation`. It must execute:

1. the same 15 D2.1 focused test files
2. `npm run typecheck:renderer`
3. `npm run build:renderer`

The phase remains open until those actual commands pass.

## Risks / limitations

Risk is low because the removed code was unreachable for the current discriminated union. The exhaustiveness assignment intentionally causes future compile-time failures if a new drawing kind is added without explicit renderer support.

## Rollback

Use the backup created by the installer. Only `src/engine/Renderer.ts` is an existing source file modified by this correction.
