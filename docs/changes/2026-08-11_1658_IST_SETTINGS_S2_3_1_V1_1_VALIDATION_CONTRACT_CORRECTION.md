# Settings S2.3.1 V1.1 — Validation Contract Correction

**IST timestamp:** 2026-08-11 16:58 IST (+05:30)  
**Project:** EOD Charting Platform  
**Scope:** test-contract correction only; no production runtime/UI/renderer source change.

## Trigger

The S2.3.1 V1 guarded installer successfully:

- created its project backup;
- copied all 16 project files;
- passed post-copy SHA-256 verification.

Focused Windows Vitest then failed with exit code 1 before renderer typecheck/build ran.

The supplied failure output showed three stale source-string assertions:

1. `DrawingD3B2Contracts.test.ts` expected the pre-tabbed literal `<span>Label Position</span>`, while S2.3.1 intentionally presents the control under `Labels` with a `Position` field.
2. `DrawingD3C1Contracts.test.ts` expected `drawInlinePositionLevel` and `computeInlineHorizontalLabelLayout`, the D3C.1 split-line `--- text ---` experiment that S2.3.1 intentionally replaced with TradingView-inspired profit/risk zones and `drawPositionStatText`.
3. `DrawingD3C1Contracts.test.ts` expected the older above-line Fib label call shape, while S2.3.1 intentionally moved to endpoint-side labels with clean centered glyph placement.

These were regression tests asserting superseded implementation details. The new S2.3.1 contract test already asserted the replacement behavior.

## Files modified

- `src/engine/__tests__/DrawingD3B2Contracts.test.ts`
- `src/engine/__tests__/DrawingD3C1Contracts.test.ts`

## File created

- `docs/changes/2026-08-11_1658_IST_SETTINGS_S2_3_1_V1_1_VALIDATION_CONTRACT_CORRECTION.md`

## Corrected contracts

### D3B.2 compatibility

The test continues to verify:

- tool-specific Properties title;
- Left/Right label-position capability and persistence;
- Left and Right UI options;
- no filled numeric-label background.

It now verifies the current tabbed UI structure:

- `Labels` subsection;
- `Position` field.

It also verifies the S2.3.1 label rendering contract:

- no old `strokeText` heavy outline;
- small shadow treatment;
- normal colored `fillText` glyph rendering.

### D3C.1 compatibility

The test now treats S2.3.1 as an intentional superseding visual implementation and verifies:

- old `drawInlinePositionLevel` is absent;
- `drawPositionStatText` is present;
- reward/risk fills are present;
- Target / Entry / Stop full lines remain styled;
- LONG / SHORT / R:R statistics remain present;
- old debug-orientation text remains absent;
- Fib labels use endpoint placement, 6px separation, clean text and no old stroke halo.

## Production behavior deliberately unchanged

V1.1 changes no production source. In particular it does not modify:

- Properties tabs, dragging, resizing or bounds persistence;
- drawing color behavior;
- Fib geometry, levels, background bands or labels;
- Long/Short geometry, orientation normalization or profit/risk zones;
- Coordinates or Visibility behavior;
- drawing persistence/scopes/timeframe anchors;
- grouped tool dock;
- alerts;
- indicators.

## Preparation checks

- Updated test-file TypeScript syntax transpilation: PASS.
- Static contract evaluation against exact S2.3.1 V1 production source: PASS.
- S2.3.1 production source hash guards prepared for the V1.1 installer.
- Exact two-test baseline hashes prepared from the already-applied state.

## Required Windows validation

Run the V1.1 installer with `-RunValidation`. It reruns the complete S2.3.1 focused drawing/indicator regression set, followed by:

```powershell
npm run typecheck:renderer
npm run build:renderer
```

Do not perform portable/manual acceptance until those commands pass on Windows.
