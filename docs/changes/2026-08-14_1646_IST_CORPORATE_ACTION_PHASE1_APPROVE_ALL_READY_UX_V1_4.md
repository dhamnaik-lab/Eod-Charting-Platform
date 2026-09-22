# Corporate Action Phase 1 — Approve All Ready UX V1.4

**IST timestamp:** 2026-08-14 16:46 IST  
**Project:** `E:\TA Projects\EOD Charting Platform`  
**Basis:** Corporate Action Phase 1 V1.3 applied state  

## Objective

Remove the operator requirement to manually tick large numbers of READY TO APPROVE Split/Bonus rows. The UI now exposes explicit all-ready controls while preserving the V1.3 backend-safe automatic batching of at most 100 approvals per request.

## Previous limitation

V1.3 correctly processed more than 100 selected rows by sending 100/100/remainder batches, but the table-selection UX remained unclear. Operators could interpret the backend 100-row batch size as a manual selection limit and spend unnecessary time ticking rows individually.

## Files changed

- `src/components/DatabaseToolsDialogs.tsx`
- `src/features/corporateActions/corporateActionBulkApproval.ts`
- `src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts`

## Final implementation

- Adds explicit `Select All Ready (N)` / `Clear Ready Selection (N)` toolbar control.
- Adds direct `Approve All Ready (N)` action for all currently loaded/filtered rows whose effective approval state is `READY TO APPROVE`.
- `Approve All Ready` does not depend on manual checkbox selection.
- Keeps partial manual selection and `Approve Selected (N)` for targeted approval.
- Reuses the existing V1.3 chunker, so 242 ready rows are still sent as `100 + 100 + 42` backend calls.
- Keeps the Rust maximum of 100 import IDs per backend request unchanged.
- Progress wording is generalized from “selected rows” to “corporate-action rows” so it is correct for both selected and all-ready approval.
- The table header checkbox remains available, but its tooltip now explicitly states that no manual 100-row selection limit applies.

## Deliberately preserved

- Split/Bonus factor mathematics.
- Price-validation thresholds and stale-validation protection.
- Identity/ISIN approval gates.
- Exceptional price-review approval logic.
- V1.3 batching and partial-failure behavior.
- Rust backend approval limit of 100 IDs per request.
- Raw EOD data and read-time adjustment behavior.
- Rights, Dividend, Demerger, repair-preview/apply behavior.

## Validation performed while packaging

- TypeScript/TSX syntax parse using the available TypeScript compiler: PASS for all three payload source/test files.
- Pure helper execution: `Approve All Ready` target set of 242 rows resolved to 242 rows and chunked as `100 + 100 + 42`: PASS.
- Payload and baseline hash manifest generation: PASS.

Full project Vitest/typecheck/build/Tauri validation must run on the project machine after application.

## Required validation commands

```powershell
npx vitest run src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts src/features/corporateActions/__tests__/corporateActionValidation.test.ts
npm run typecheck:renderer
npm run build:renderer
npm run tauri:check
```

## Manual acceptance

1. Load and validate Split/Bonus review rows.
2. Confirm a non-zero READY TO APPROVE count.
3. Without ticking individual rows, click `Approve All Ready (N)`.
4. Verify the progress status processes all rows in automatic <=100 batches.
5. Verify final approved/linked-existing/already-approved/failed totals.
6. Confirm no generic “Could not update selected official imports” error caused by selection count.
7. Confirm partial `Approve Selected` still works when a subset is intentionally selected.

## Risks / limitations

- `Approve All Ready` applies to the currently loaded/filtered READY TO APPROVE rows; operators should use search/type filters before invoking it when they intend a narrower scope.
- The separate Review Identity window has not been redesigned in V1.4. Its UI remains an explicitly pending Corporate Action UX task.

## Rollback guidance

Restore the three modified source files from the backup directory created by the apply script. No database schema or data rollback is required merely to undo this UI/source change.
