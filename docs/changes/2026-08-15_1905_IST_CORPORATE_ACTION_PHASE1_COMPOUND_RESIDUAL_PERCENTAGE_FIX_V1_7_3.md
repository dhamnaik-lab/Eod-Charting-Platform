# Corporate Action Phase 1 — Compound Residual Percentage Fix V1.7.3

**IST timestamp:** 2026-08-15 19:05 IST  
**Basis:** Corporate Action Phase 1 V1.7.2 applied state

## Defect

V1.7.2 corrected compound theoretical-price evidence but returned `openResidualPct` / `closeResidualPct` as decimal ratios. `DatabaseToolsDialogs.tsx` uses the established `formatCorporatePercent()` contract, which expects percentage points. As a result, compound residuals were displayed 100× too small.

Observed examples:
- BHARATRAS: shown `+0.03%`; correct ≈ `+2.99%`.
- FCL: shown `+0.03%`; correct ≈ `+2.78%`.
- NAZARA: shown `+0.04%`; correct ≈ `+4.30%`.

## Correction

`getPresentationResidualPct()` now returns:

```text
(actual / theoretical - 1) * 100
```

This matches the pre-existing `getResidualGapPct()` unit contract and requires no global formatter change.

## Scope

Modified:
- `src/features/corporateActions/corporateActionCompoundValidation.ts`
- `src/features/corporateActions/__tests__/corporateActionCompoundValidation.test.ts`

Documentation created:
- this report
- V1.7.3 design specification
- V1.7.3 implementation plan

Explicitly unchanged:
- `src/components/DatabaseToolsDialogs.tsx`
- `src-tauri-shell/src/database/corporate_action_imports.rs`
- combined factor and fingerprint logic
- confidence and MATCH/REVIEW decisions
- approval state/batching
- identity workflows
- raw EOD data and chart adjustment mathematics

## TDD evidence

The V1.7.2 helper was first exercised with percentage-point expectations and failed with:

```text
BHARATRAS open residual pct: expected 2.9898989899, got 0.02989898989898987
```

After the minimal helper correction, the same behavior check passed for BHARATRAS, FCL, and an ordinary +5% single-action case.

## Required Windows validation

```powershell
npx vitest run `
  src/features/corporateActions/__tests__/corporateActionCompoundValidation.test.ts `
  src/features/corporateActions/__tests__/corporateActionIdentityRecommendations.test.ts `
  src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts `
  src/features/corporateActions/__tests__/corporateActionValidation.test.ts
npm run typecheck:renderer
npm run build:renderer
npm run tauri:check
```

Portable build remains a manual gate after automated PASS.
