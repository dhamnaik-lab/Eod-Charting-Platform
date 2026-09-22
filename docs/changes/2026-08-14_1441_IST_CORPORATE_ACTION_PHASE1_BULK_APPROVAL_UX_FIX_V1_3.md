# Corporate Action Phase 1 — Bulk Approval UX/Contract Fix V1.3

**IST timestamp:** 2026-08-14 14:41 IST  
**Project:** `E:\TA Projects\EOD Charting Platform`  
**Basis:** Corporate Action Phase 1 V1.2 applied state

## Objective

Correct the confirmed frontend/backend bulk-approval contract defect without weakening the Rust-side safety limit or changing Corporate Action mathematics, identity rules, price validation, storage, or repair behavior.

## Previous defect / limitation

Manual operator evidence after Phase 1 V1.2 showed:

- `Validate Split/Bonus` processed 684 loaded Split/Bonus imports.
- 592 were price-matched and 92 required price review.
- 243 rows became eligible for ordinary approval.
- The UI allowed `Approve selected (243)`.
- The Rust backend intentionally rejects a single bulk-approval request above 100 rows.
- The frontend sent all 243 IDs in one call and surfaced only `Could not update the selected official imports.`

This created two defects:

1. frontend selection size could exceed the backend request contract;
2. the useful backend rejection reason was hidden by a generic frontend fallback.

## Files changed

### Modified

- `src\components\DatabaseToolsDialogs.tsx`

### Created

- `src\features\corporateActions\corporateActionBulkApproval.ts`
- `src\features\corporateActions\__tests__\corporateActionBulkApproval.test.ts`
- `docs\changes\2026-08-14_1441_IST_CORPORATE_ACTION_PHASE1_BULK_APPROVAL_UX_FIX_V1_3.md`

## Final implementation

### Safe automatic batching

Selected ready-for-approval import IDs are deduplicated and split into frontend batches of at most 100 rows.

Example:

```text
243 selected
→ batch 1: 100
→ batch 2: 100
→ batch 3: 43
```

The existing Rust `BULK_APPROVAL_MAX_ITEMS = 100` guard remains unchanged and authoritative.

### Operator progress

During sequential approval, the status line reports:

```text
Approving 243 selected corporate-action row(s)...
Batch 2/3: 100 row(s); 100/243 processed.
```

### Aggregate result summary

After all batches complete, the UI reports combined counts across all backend calls:

- requested;
- approved;
- linked to existing canonical actions;
- already approved;
- failed;
- number of batches.

Raw EOD price data remains explicitly described as unchanged.

### Partial-batch failure behavior

If a later backend batch fails at the command level:

- already completed batches remain committed as before;
- the review list is refreshed so completed work is visible;
- unprocessed selections remain selected;
- item-level failures from completed batches remain selected when still eligible;
- the original backend/transport error is preserved in the operator-facing message.

The implementation does not pretend that a failed later batch rolled back earlier successful batches.

### Item-level failures

Backend per-item failures returned inside a successful batch are aggregated across batches. Up to three symbol/reason previews are shown in the final status. Failed IDs are retained in selection for review/retry when still eligible.

### Error transparency

The frontend now uses the existing `getErrorMessage()` utility so string errors returned by Tauri/Rust are surfaced rather than discarded in favor of the generic fallback.

## Behavior deliberately preserved

- Rust maximum 100 approvals per backend request.
- Split/Bonus `MATCHED` validation requirement for ordinary approval.
- stale validation rejection.
- ISIN/identity safeguards.
- exceptional price-review approval rules.
- Split/Bonus adjustment factors and residual-gap mathematics.
- read-time Corporate Action adjustment architecture.
- raw `.eod` prices remain unchanged.
- Rights, Dividend and Demerger behavior.
- repair-preview workflow.

## Validation performed while preparing V1.3

The packaging environment does not contain this project's installed dependencies or Rust toolchain, so full project validation was not claimed there.

Performed successfully:

- TypeScript parser/transpile syntax check for modified `DatabaseToolsDialogs.tsx`.
- TypeScript parser/transpile syntax check for the new bulk-approval helper.
- TypeScript parser/transpile syntax check for the new Vitest file.
- standalone strict TypeScript compilation of `corporateActionBulkApproval.ts`.
- direct helper behavior check confirming 243 IDs are chunked as `100 + 100 + 43`, with no batch above 100.

## Required project validation

Run on the live project after application:

```powershell
npx vitest run `
  src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts `
  src/features/corporateActions/__tests__/corporateActionValidation.test.ts

npm run typecheck:renderer
npm run build:renderer
npm run tauri:check
```

No Rust production file is modified by V1.3. The apply script verifies the V1.2 `corporate_action_imports.rs` SHA-256 before and after application.

## Manual acceptance after automated validation

1. Load the existing official Split/Bonus review queue.
2. Run bulk Split/Bonus validation if needed.
3. Select all currently ready ordinary approvals, including a set larger than 100.
4. Click `Approve selected (N)`.
5. Confirm the status line progresses through safe batches.
6. Confirm no `Bulk approval is limited to 100 items` failure occurs from a selection larger than 100.
7. Confirm the final aggregate counts are coherent.
8. Confirm failed/unprocessed rows, if any, remain available for review.
9. Confirm raw EOD prices are unchanged.

## Risks / limitations

- Multiple backend transactions are intentionally used for very large selections. Earlier completed batches cannot be atomically rolled back if a later command-level batch fails. The UI explicitly reports and refreshes this partial-progress state.
- Reloading a very large number of approved records still follows the existing refresh path. No chart/cache architecture was redesigned in V1.3.
- Review Identity UI redesign remains a separate known Corporate Action UX item.

## Rollback guidance

Before applying V1.3, the script creates a timestamped backup under:

`tmp\corporate-action-phase1-v1-3-backup_YYYYMMDD_HHMMSS`

To roll back V1.3:

1. close the application;
2. restore `src\components\DatabaseToolsDialogs.tsx` from that backup;
3. remove the two V1.3-created frontend helper/test files if they did not exist before;
4. remove the V1.3 change report if desired;
5. rerun renderer typecheck/build.

Do not modify or roll back the V1.2 Rust production state as part of this V1.3 rollback.
