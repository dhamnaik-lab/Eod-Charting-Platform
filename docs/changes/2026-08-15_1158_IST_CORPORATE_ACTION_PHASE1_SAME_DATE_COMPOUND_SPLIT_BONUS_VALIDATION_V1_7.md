# Corporate Action Phase 1 — Same-Date Compound Split/Bonus Validation V1.7

**IST timestamp:** 2026-08-15 11:58 IST  
**Project:** `E:\TA Projects\EOD Charting Platform`  
**Basis:** Corporate Action Phase 1 V1.6 applied state

## Objective

Correct false `NEEDS REVIEW` price-validation outcomes when two or more valid Split/Bonus actions affect the same resolved instrument on the same ex-date. Preserve the official actions as separate records while validating the market discontinuity against their combined share multiplier.

## Operator evidence driving V1.7

### BHARATRAS — 2025-12-12

Official same-date actions:

- Split face value 10 → 5: share multiplier `×2`.
- Bonus 1 for every 1 held: share multiplier `×2`.

Current individual validation compared each `×2` row against previous close `₹9,900` and ex-date open `₹2,549`, incorrectly producing `NEEDS REVIEW` for each row.

```text
×2 × ×2 = ×4
₹9,900 / 4 = ₹2,475 theoretical
₹2,549 actual open
opening residual ≈ +2.99%
```

### FCL — 2025-10-31

Official same-date actions:

- Split face value 2 → 1: share multiplier `×2`.
- Bonus 4 for every 1 held: share multiplier `×5`.

```text
×2 × ×5 = ×10
₹248.60 / 10 = ₹24.86 theoretical
₹25.55 actual open
opening residual ≈ +2.78%
```

Both are strong combined-factor matches while the old scanner reviewed the components independently.

## Files modified by V1.7

- `src-tauri-shell\src\database\corporate_action_imports.rs`
- `src\components\DatabaseToolsDialogs.tsx`

## Files created by V1.7

- `src\features\corporateActions\corporateActionCompoundValidation.ts`
- `src\features\corporateActions\__tests__\corporateActionCompoundValidation.test.ts`
- this change report

## Implementation

### Same-date compound discovery

For each official Split/Bonus candidate, validation queries parsed, non-rejected Split/Bonus imports with the exact same exchange, resolved symbol and ex-date. A group is compound only when at least two valid positive factors exist.

### Combined validation factor

```text
combined_factor = factor_1 × factor_2 × ... × factor_n
```

The existing local price-window loader is reused. The observed open/close factors remain `previous_close / ex_date_open` and `previous_close / ex_date_close`. Existing confidence thresholds are preserved; only the expected validation factor becomes the same-date combined factor.

### Separate official actions preserved

V1.7 does not merge the underlying actions. FCL still remains separate `SPLIT ×2` and `BONUS ×5` official/canonical rows. The `×10` exists only as market-price validation evidence.

### Existing approval contract preserved

Each stored scan result retains the component row's individual `expected_factor`, so the existing component-level approval contract remains intact. Compound metadata is embedded in the scan evidence message with combined factor, component count, and a deterministic component ID/factor fingerprint.

### Compound stale-evidence protection

Before approving a Split/Bonus whose latest scan contains V1.7 compound metadata, the backend recomputes the same-date fingerprint. Approval fails closed and requires revalidation if the component set or any component factor changed.

### Compound-aware theoretical price UI

The frontend parses V1.7 compound metadata and substitutes the combined factor only for theoretical-price/residual display. The action's own Share/Price multiplier remains individual and authoritative.

### Adjustment engine unchanged

`apply_corporate_adjustments()` is not modified. Once the separate components are approved, the existing read-time adjustment engine naturally applies both factors to prior history. Raw `.eod` prices remain unchanged and genuine ex-date movement remains visible.

## Deliberately preserved

- identity/ISIN safeguards and V1.6 recommendations;
- V1.5.1 Review Identity workbench;
- V1.4 Approve All Ready;
- V1.3 ≤100 backend batching;
- individual official action factors;
- duplicate/idempotent approval behavior;
- price-review exception path;
- Rights, Dividend and Demerger behavior;
- historical repair workflow;
- raw/binary EOD storage;
- chart adjustment mathematics.

## Tests added

Rust tests added in `corporate_action_imports.rs`:

- BHARATRAS `×2 × ×2 = ×4`, theoretical `₹2,475`, residual ≈ `+2.99%`;
- FCL `×2 × ×5 = ×10`, theoretical `₹24.86`, residual ≈ `+2.78%`;
- compound fingerprint changes when a component factor changes.

Frontend tests cover compound metadata parsing, `×4`, `×10`, ordinary single-action fallback and malformed metadata rejection.

## Packaging validation performed

- new TypeScript helper syntax parse: PASS;
- new Vitest source syntax parse: PASS;
- V1.7 Node patcher syntax: PASS;
- synthetic V1.6-compatible Rust/UI patch simulation: PASS;
- synthetic post-patch source verification: PASS.

Rust compilation and dependency-backed project validation are not available in the packaging environment and are **not claimed**.

## Required Windows validation

```powershell
npx vitest run `
  src/features/corporateActions/__tests__/corporateActionCompoundValidation.test.ts `
  src/features/corporateActions/__tests__/corporateActionIdentityRecommendations.test.ts `
  src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts `
  src/features/corporateActions/__tests__/corporateActionValidation.test.ts

cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture
cargo test --manifest-path src-tauri-shell/Cargo.toml eod_data -- --nocapture
npm run typecheck:renderer
npm run build:renderer
npm run tauri:check
```

Do not build portable until these gates pass.

## Manual acceptance

1. Reopen the review queue and run `Validate Split/Bonus`.
2. BHARATRAS Split/Bonus should no longer remain false independent review cases when identity permits.
3. FCL Split/Bonus should likewise become matched/ready.
4. Price evidence should use BHARATRAS theoretical ≈ `₹2,475` and FCL theoretical ≈ `₹24.86`.
5. Approve through the ordinary ready workflow, not `Approve with Exception`.
6. Confirm adjusted charts become continuous while ex-date/post-event bars remain actual.

## Risks / limitations

- Only Split/Bonus are compounded in V1.7. Same-date Rights, Dividend, Demerger or other action families remain outside this calculation.
- The existing import dedupe model remains responsible for preventing duplicate official event rows from being counted twice.
- Existing confidence thresholds are preserved.

## Rollback

The apply script creates `tmp\corporate-action-phase1-v1-7-backup_YYYYMMDD_HHMMSS`. Restore the two modified source files from that backup and remove the V1.7-created helper/test/report if rollback is required. V1.6 is the rollback target.
