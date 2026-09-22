# Corporate Action Phase 1 — Bulk Identity Recommendations V1.6

**IST timestamp:** 2026-08-14 20:36 IST  
**Project:** `E:\TA Projects\EOD Charting Platform`  
**Basis:** Corporate Action Phase 1 V1.5.1 applied state

## Objective

Reduce manual Review Identity work for obvious historical-ISIN drift cases without silently resolving or approving any official Corporate Action row.

The operator should be able to:

1. validate Split/Bonus prices in bulk;
2. check identity recommendations in bulk;
3. explicitly approve all rows that meet a strict backend recommendation rule;
4. leave ambiguous rows for manual Review Identity.

## Previous limitation

After V1.5.1, Review Identity became usable, but hundreds of `PENDING_ISIN_MISMATCH` rows could still require one-by-one review even when the evidence pattern was straightforward:

- exact exchange;
- exact symbol;
- exact normalized company name;
- exactly one active identity-history candidate;
- attached official evidence;
- official ISIN differs from the current database ISIN.

The main review table also still exposed a large native status tooltip on hover.

## Strict recommendation rule

V1.6 recommends a historical-ISIN exception only when **all** of the following are true:

- review status is `PENDING_ISIN_MISMATCH`;
- action type is `SPLIT` or `BONUS`;
- exactly one active identity-history suggestion exists;
- suggested exchange exactly matches the official exchange;
- suggested symbol exactly matches the official symbol;
- normalized company names exactly match;
- an official ISIN exists;
- a current candidate ISIN exists;
- official and current ISINs are different;
- at least one official evidence record is attached.

This is deliberately conservative. It does not treat loose name similarity, multiple active candidates, missing ISINs, missing evidence, or cross-symbol mapping as safe bulk recommendations.

## Explicit operator action remains mandatory

Nothing is resolved or approved automatically.

The review toolbar adds:

- `Check Identity Recommendations (N)`
- `Approve All Recommended Identities (N)`

The second button is shown only after recommendation evidence has been checked. A single Review Identity workbench can also show `Confirm Recommended Identity` when that row independently satisfies the same backend rule.

## Server-side revalidation

The frontend recommendation is not authoritative.

At approval time the Rust backend reloads the import row, recomputes the identity-history suggestions, and rechecks the strict recommendation rule. A stale or changed row fails instead of being force-approved.

## Audit trail

Recommended bulk approval uses the existing exceptional ISIN-mismatch approval path. Each accepted row records an `ISIN_MISMATCH_APPROVAL` decision with a standardized reason that states:

- exact exchange/symbol/company match;
- exactly one active identity-history candidate;
- number of attached evidence records;
- official ISIN;
- current candidate ISIN.

No manual free-text reason is required for this strictly recommended path because the backend generates a deterministic evidence-based audit reason. Manual/non-recommended exceptions still use the existing reason requirement.

## Split/Bonus price-validation safeguard preserved

V1.6 does not bypass Phase 1 price validation. The existing Split/Bonus approval gate still requires current `MATCHED` price-validation evidence. Therefore a row can be identity-recommended yet still fail approval if its price evidence is stale, missing, or `NEEDS REVIEW`.

## Backend batching

The new recommended-identity approval command accepts at most 100 rows per backend request, matching the existing safety approach. The frontend automatically chunks larger explicit approvals into batches of at most 100.

Example:

```text
243 recommended rows
→ 100 + 100 + 43
```

The operator never manually counts 100 rows.

## Files modified

- `src-tauri-shell\src\database.rs`
- `src-tauri-shell\src\database\corporate_action_imports.rs`
- `src-tauri-shell\src\main.rs`
- `src\types\desktop.ts`
- `src\platform\types.ts`
- `src\platform\tauriDesktop.ts`
- `src\components\DatabaseToolsDialogs.tsx`

## Files created

- `src\features\corporateActions\corporateActionIdentityRecommendations.ts`
- `src\features\corporateActions\__tests__\corporateActionIdentityRecommendations.test.ts`
- `docs\changes\2026-08-14_2036_IST_CORPORATE_ACTION_PHASE1_BULK_IDENTITY_RECOMMENDATIONS_V1_6.md`

## UI changes

### Official Imports → Review

Adds bulk recommendation controls for loaded `PENDING_ISIN_MISMATCH` rows.

### Review Identity workbench

A row that meets the strict rule shows a `Recommended identity match` banner and a primary `Confirm Recommended Identity` button. Existing manual actions remain available.

### Main-table tooltip cleanup

Native `title` usage on Corporate Action review-status text is replaced with an accessibility label, preventing the oversized hover tooltip from covering the review table.

## Behavior deliberately preserved

- no automatic approval;
- V1.5.1 Review Identity layout;
- V1.4 Approve All Ready workflow;
- V1.3 <=100 ordinary bulk-approval batching;
- Split/Bonus price-validation thresholds and freshness checks;
- genuine ex-date gap preservation;
- raw `.eod` prices remain unchanged;
- existing manual identity mapping and manual ISIN exception path;
- Rights, Dividend and Demerger behavior;
- historical repair-preview behavior.

## Tests added

### Rust

- strict recommended identity fields produce a recommendation;
- company mismatch is rejected;
- multiple active candidates are rejected;
- missing official evidence is rejected.

### TypeScript

- 243 recommendation IDs chunk to `100 + 100 + 43`;
- duplicate IDs are removed;
- invalid IDs are not sent;
- frontend cannot request a batch larger than 100.

## Validation commands

```powershell
npx vitest run `
  src/features/corporateActions/__tests__/corporateActionIdentityRecommendations.test.ts `
  src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts `
  src/features/corporateActions/__tests__/corporateActionValidation.test.ts

cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture

npm run typecheck:renderer
npm run build:renderer
npm run tauri:check
```

## Packaging-environment validation

Before handoff, the V1.6 patcher was applied to a simulated V1.5.1 source baseline. The following passed:

- V1.6 compatibility check;
- patch application;
- post-patch marker verification;
- TypeScript/TSX parser checks for modified frontend contracts/UI;
- standalone strict TypeScript compilation of the new batching helper;
- `243 -> 100 + 100 + 43` helper behavior.

The packaging environment has no Rust toolchain and does not contain the project's installed dependencies, so full Rust/project validation is **not claimed** until the live project runs the commands above.

## Manual acceptance

1. Rebuild portable after automated validation.
2. Open Official Imports → Review.
3. Load and validate Split/Bonus.
4. Click `Check Identity Recommendations (N)`.
5. Verify a TEMBO-style exact exchange/symbol/company case becomes recommended.
6. Verify ambiguous/multiple-active/different-company cases remain manual.
7. Before bulk approval, inspect at least one recommended row in Review Identity.
8. Click `Approve All Recommended Identities (N)` only after the recommendation count looks reasonable.
9. Confirm multi-batch progress and final counts.
10. Confirm failures remain in the review queue with real reasons.
11. Confirm approved rows retain Corporate Action price-validation behavior and raw EOD data is unchanged.

## Risks / limitations

- The recommendation is intentionally conservative and may leave many safe rows for manual review if company-name text differs even slightly.
- BSE currently has no structured resolution suggestions in the existing suggestion loader, so this workflow primarily benefits NSE rows.
- A recommended identity is not equivalent to price-validation readiness; the existing price gate remains authoritative.
- Very large approvals use multiple backend transactions. Earlier successful batches cannot be atomically rolled back if a later batch fails; the UI reports aggregate results.

## Rollback guidance

The apply script creates a timestamped backup under:

`tmp\corporate-action-phase1-v1-6-backup_YYYYMMDD_HHMMSS`

To roll back V1.6:

1. close the application;
2. restore the seven modified files from the backup;
3. remove the two V1.6-created frontend helper/test files;
4. remove the V1.6 change report if desired;
5. rerun renderer typecheck/build and `tauri:check`.
