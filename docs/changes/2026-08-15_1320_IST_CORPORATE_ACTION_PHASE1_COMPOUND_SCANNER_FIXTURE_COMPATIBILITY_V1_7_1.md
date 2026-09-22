# Corporate Action Phase 1 — Compound Scanner Fixture Compatibility V1.7.1

**IST timestamp:** 2026-08-15 13:20 IST  
**Project:** `E:\TA Projects\EOD Charting Platform`  
**Basis:** Corporate Action Phase 1 V1.7 applied state

## Objective

Correct the V1.7 regression in two pre-existing direct `scan_candidate()` unit tests without weakening same-date compound Split/Bonus validation in the real official-import workflow.

## Observed failure

V1.7 compiled and its new compound tests passed, including BHARATRAS ×4, FCL ×10 and compound fingerprint coverage. Two older scanner tests failed before their assertions because their intentionally minimal in-memory SQLite fixtures do not create `corporate_action_imports`.

The V1.7 helper `load_same_date_split_bonus_compound_context()` became an unconditional lookup dependency for every direct `scan_candidate()` call, so these fixtures received SQLite `no such table: corporate_action_imports` instead of exercising the historical single-action scanner behavior.

## Root cause

The production official-import scanner loads candidates from `corporate_action_imports`, so the table necessarily exists in the real V1.7 execution path. The two legacy scanner tests call `scan_candidate()` directly using only local-price fixture tables. V1.7 unintentionally coupled those direct scanner tests to the full official-import schema.

## Correction

`load_same_date_split_bonus_compound_context()` now checks whether `corporate_action_imports` exists before querying same-date components.

- Full application/official-import schema present: V1.7 compound grouping runs unchanged.
- Minimal direct scanner fixture without the imports table: returns `None` compound context and continues through the original single-action factor path.

This does not convert a full-schema SQL failure into success and does not alter compound factor computation, confidence thresholds, fingerprint staleness protection, approval gating, UI behavior, or adjustment mathematics.

## Regression coverage

Added Rust test:

`phase1_v171_compound_lookup_is_optional_for_minimal_scanner_fixture`

The test creates a bare in-memory SQLite connection with no `corporate_action_imports` table and requires the helper to return `Ok(None)`.

The pre-existing scanner tests that failed under V1.7 remain the primary compatibility proof when the full Corporate Action Rust suite is rerun.

## Files changed

### Modified

- `src-tauri-shell\src\database\corporate_action_imports.rs`

### Created

- `docs\changes\2026-08-15_1320_IST_CORPORATE_ACTION_PHASE1_COMPOUND_SCANNER_FIXTURE_COMPATIBILITY_V1_7_1.md`

## Preserved behavior

- BHARATRAS same-date Split ×2 + Bonus ×2 validates as combined ×4.
- FCL same-date Split ×2 + Bonus ×5 validates as combined ×10.
- Split and Bonus remain separate official/canonical actions.
- Compound fingerprint staleness guard remains active.
- Existing confidence thresholds remain unchanged.
- Raw EOD prices remain immutable.
- Ex-date genuine market movement remains untouched.
- V1.6 identity recommendations and approvals remain unchanged.
- Rights/Dividend/Demerger behavior remains unchanged.

## Required validation

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture
cargo test --manifest-path src-tauri-shell/Cargo.toml eod_data -- --nocapture
npx vitest run `
  src/features/corporateActions/__tests__/corporateActionCompoundValidation.test.ts `
  src/features/corporateActions/__tests__/corporateActionIdentityRecommendations.test.ts `
  src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts `
  src/features/corporateActions/__tests__/corporateActionValidation.test.ts
npm run typecheck:renderer
npm run build:renderer
npm run tauri:check
```

Do not build portable until all gates pass.

## Manual acceptance after automated PASS

Rebuild portable, run `Validate Split/Bonus`, and verify BHARATRAS/FCL move from false independent `NEEDS REVIEW` results to compound matched/ready results with combined theoretical prices near ₹2,475 and ₹24.86 respectively.
