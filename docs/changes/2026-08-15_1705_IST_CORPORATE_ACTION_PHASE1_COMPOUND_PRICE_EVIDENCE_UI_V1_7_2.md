# Corporate Action Phase 1 — Compound Price Evidence UI V1.7.2

**IST timestamp:** 2026-08-15 17:05 IST  
**Project:** `E:\TA Projects\EOD Charting Platform`  
**Fresh source basis:** `Eod Charting Platform Source Code 2026-08-15_164109_IST`  
**Required baseline:** Corporate Action Phase 1 V1.7.1 applied state

## Objective

Correct the remaining V1.7/V1.7.1 evidence-display inconsistency for same-date compound Split/Bonus validation.

The backend already validates compound events against the product of their same-date component factors. Before V1.7.2, Official Imports `Price Check` and the `Price Review` panel still calculated their displayed theoretical price and residual from the individual row factor, so the UI could show a very large negative residual beside `STRONG MATCH / READY TO APPROVE`.

V1.7.2 changes presentation only. It does not change the compound scanner, approval gate, adjustment engine, identity logic, or official component factors.

## Confirmed examples before correction

### BHARATRAS — 2025-12-12

Official components remain separate:

- Split: Share ×2
- Bonus 1:1: Share ×2
- Combined validation factor: ×4

Before V1.7.2 the Split row could display:

```text
₹9,900 → ₹4,950 → ₹2,549
Open residual -48.51%
STRONG MATCH / READY TO APPROVE
```

The V1.7/V1.7.1 scanner actually matched the combined event:

```text
₹9,900 → ₹2,475 → ₹2,549
Open residual +2.99%
```

### FCL — 2025-10-31

Official components remain separate:

- Split 2 → 1: Share ×2
- Bonus 4 for 1: Share ×5
- Combined validation factor: ×10

Before V1.7.2 the Split row could display:

```text
₹248.60 → ₹124.30 → ₹25.55
Open residual -79.44%
STRONG MATCH / READY TO APPROVE
```

The actual compound evidence is:

```text
₹248.60 → ₹24.86 → ₹25.55
Open residual +2.78%
```

## Implementation

### Shared frontend presentation model

`src/features/corporateActions/corporateActionCompoundValidation.ts` now exports:

- `CorporateActionPriceValidationPresentation`
- `getCorporateActionPriceValidationPresentation(scan)`

The helper:

1. parses the existing `[CA_COMPOUND_V1 ...]` metadata;
2. uses `combinedFactor` only when metadata is valid;
3. otherwise falls back to `scan.expectedFactor` exactly as ordinary validation did;
4. derives theoretical price, open residual and close residual once;
5. returns `null` numeric evidence when required prices/factors are absent or invalid rather than manufacturing `NaN`/infinite values.

### Official Imports → Price Check

For a valid compound scan, the cell now shows a context line such as:

```text
Compound 2-action factor ×4.000000
₹9,900 → ₹2,475 → ₹2,549
Open residual +2.99%
```

The separate `Multipliers` column continues to show each official row's own factor (`×2`, `×5`, etc.).

### Price Review

The panel now uses the same shared presentation helper and adds a visible validation context line for compound rows, while retaining the official row description and multiplier.

### Standalone scan table

No regression was introduced. Its existing `getCorporateActionEffectiveValidationFactor(...)` path remains unchanged and compound-aware.

## Files modified

- `src\components\DatabaseToolsDialogs.tsx`
- `src\features\corporateActions\corporateActionCompoundValidation.ts`
- `src\features\corporateActions\__tests__\corporateActionCompoundValidation.test.ts`

## Files created

- `docs\changes\2026-08-15_1705_IST_CORPORATE_ACTION_PHASE1_COMPOUND_PRICE_EVIDENCE_UI_V1_7_2.md`

## Production Rust guard

V1.7.2 does **not** modify:

`src-tauri-shell\src\database\corporate_action_imports.rs`

Required V1.7.1 fresh-snapshot SHA-256:

```text
d7b50de1e0afeebd7e99e7cc840ae09caf51f35d1d1ee2f3357d4c392d46b23c
```

The apply script checks this before application and again after writing the frontend payload.

## Tests added/expanded

`corporateActionCompoundValidation.test.ts` now covers:

- BHARATRAS ×4 theoretical price/open/close residual evidence;
- FCL ×10 theoretical price/open residual evidence;
- ordinary single-action fallback;
- malformed compound-metadata fallback;
- missing-price null handling;
- pre-existing metadata parsing/effective-factor behavior.

## Packaging-environment verification

Completed before handoff:

- fresh snapshot baseline/hash inspection: **PASS**;
- TypeScript helper syntax: **PASS**;
- TypeScript test syntax: **PASS**;
- DatabaseToolsDialogs TSX parse: **PASS**;
- direct helper runtime verification for BHARATRAS/FCL: **PASS**;
- ordinary/malformed/missing-data fallback runtime verification: **PASS**;
- exact baseline/payload hash packaging: **PASS**;
- simulated package application to a clean V1.7.1 snapshot: **PASS**;
- post-simulation Rust hash unchanged: **PASS**.

The extracted source snapshot does not contain installed Node dependencies or a Rust build cache, so full Vitest/build/Tauri validation is intentionally delegated to the live Windows project by `-RunValidation`.

## Required live validation

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

Portable build remains a separate post-validation gate.

## Manual acceptance before approving READY compound rows

After rebuilding portable:

1. Run `Official Imports → Review → Load → Validate Split/Bonus` if current validation evidence is not already present.
2. Inspect BHARATRAS Split and Bonus:
   - individual multipliers stay ×2 and ×2;
   - Price Check shows compound ×4;
   - theoretical price ≈ ₹2,475;
   - open residual ≈ +2.99%.
3. Inspect FCL Split and Bonus:
   - individual multipliers stay ×2 and ×5;
   - Price Check shows compound ×10;
   - theoretical price ≈ ₹24.86;
   - open residual ≈ +2.78%.
4. Inspect NAZARA same-date Split/Bonus and confirm combined ×4 evidence is used while official component multipliers remain separate.
5. Inspect one ordinary single Split/Bonus row and confirm its Price Check remains ordinary/non-compound.
6. Open Price Review only for inspection if a compound row is still reviewable and confirm it reports the same combined theoretical/residual context.
7. Only after these checks pass should the existing `Approve All Ready` workflow be used.

## Preservation guarantees

```text
Rust production file changed by V1.7.2: NO
Compound validation algorithm changed: NO
Compound fingerprint/staleness changed: NO
Approval gate changed: NO
Identity workflow changed: NO
Raw EOD data changed: NO
Adjusted-history mathematics changed: NO
Official component multipliers merged: NO
Displayed compound evidence coherent with validation: YES
```
