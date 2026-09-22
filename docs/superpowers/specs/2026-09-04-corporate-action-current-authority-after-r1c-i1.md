# Corporate Action Current Authority After R1C-I1

Status: CURRENT AUTHORITY ADDENDUM  
Date: 2026-09-04

## Purpose

This document updates the Corporate Action authority after manual acceptance of **R1C-I1 — Official Imports Fetch Improvements**.

It is additive. Earlier recovery documents and evidence remain preserved as historical authority for how the existing workflow was restored.

## Current active product authority

The active Corporate Action product remains:

`Database -> Corporate Actions / Identity -> DatabaseToolsDialogs -> CorporateActionDialog`

The restored existing workflow is still the functional authority for business behavior.

The following capability areas remain active inside the same Corporate Action managed window:

- Manual Entry
- Identity Import
- Official Imports
- Scan Database
- Review Issues

Within Official Imports, the active task areas remain:

- Review
- Fetch & Import
- Historical Backfill

## Newly active R1C-I1 promotions

The following items are no longer donor-only candidates. They are now active functionality inside the existing `CorporateActionDialog`.

### 1. Combined direct-fetch scope

Official direct fetch supports:

- `NSE + BSE`
- `NSE`
- `BSE`

The combined scope runs NSE first and BSE second.

### 2. Ordered per-exchange lifecycle log

The direct-fetch UI records operator-visible lifecycle entries:

- exchange fetch started
- exchange completed
- exchange failed
- overall selected-scope complete

Overall completion is recorded only after every selected exchange succeeds.

The lifecycle log is session/UI state. It is not intended as durable database history.

### 3. Last successful fetch per active database

The existing R1C localStorage helper is now active.

Storage key:

`eod-chart.corporate-action.normal-last-fetch.v1`

Record shape:

```ts
{
  scope: 'BOTH' | 'NSE' | 'BSE',
  completedAtIso: string
}
```

Records are keyed by the exact active database path.

The record is updated only after the entire selected direct-fetch scope succeeds.

A partial `NSE + BSE` failure must not overwrite the previous full-success record.

No SQLite setting or schema is used for this feature.

### 4. Improved error surfacing

Official direct-fetch errors now preserve useful operator-facing detail from:

- `Error`
- non-empty string failures
- object failures containing a string `message`
- a fallback only when no usable message exists

Real BSE request failure text was observed during the manual checkpoint.

### 5. From/To date validation

Official direct fetch now enforces:

- From <= To
- reciprocal date input bounds
- disabled fetch controls for invalid range
- explicit runtime rejection if an invalid range still reaches the fetch function

## Existing behavior explicitly preserved

R1C-I1 did not replace these existing capabilities:

- Force Re-fetch
- manual official-source CSV fallback
- CSV exchange limited to NSE/BSE
- Historical Backfill
- Review Queue
- Approved view
- Split/Bonus validation
- identity resolution
- Review Issues
- database scan
- bulk approval
- manual Corporate Action entry
- identity import
- review-first / no automatic approval behavior

Task 5B remains active through:

`src/features/corporateActions/legacy/corporateActionImportOperations.ts`

## R1C module status after I1

### Active

- `legacy/corporateActionImportOperations.ts`
- existing validation/identity/bulk-approval helpers already used by the restored workflow
- `workflow/corporateActionNormalFetchHistory.ts`, now used only for the promoted per-database last-success behavior
- the five R1C-I1 improvements listed above

### Preserved donor/reference only

These reconstructed modules remain physically present but are not the active Corporate Action product route:

- `corporateActionWorkflow.ts`
- `corporateActionEconomicEventViewModel.ts`
- `workflow/corporateActionNormalWorkflowAdapter.ts`
- `workflow/corporateActionNormalReviewAdapter.ts`
- `workflow/corporateActionNormalApprovalAdapter.ts`
- `workspace/CorporateActionWorkspace.tsx`
- `workspace/CorporateActionWorkflowHeader.tsx`
- `workspace/CorporateActionNormalWorkflowWorkspace.tsx`
- `workspace/CorporateActionReviewWorkspace.tsx`
- `workspace/CorporateActionApproveWorkspace.tsx`
- `workspace/CorporateActionManagedWindow.tsx`
- `maintenance/CorporateActionMaintenanceWorkspace.tsx`
- related reconstruction tests and inactive state support

### Still not authorized for reactivation

Do not restore as a whole without an explicit later requirement:

- Fetch -> Load -> Review -> Approve replacement architecture
- automatic Load & Process stage
- separate Corporate Action Maintenance product
- independent Normal/Maintenance product windows
- automatic economic-event processing in the active fetch path

### Still diagnostic/caution before reuse

- economic-event grouping
- same-action compound share-factor assumptions
- reconstructed approval recheck path that invokes the Load/economic-event model

The prior real-data Bonus `shareFactor` consistency blocker remains a caution. Validation must not be weakened to make that path pass.

## Manual acceptance authority

Accepted portable:

`E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

SHA-256:

`64DFFA9C9748D6B12CBD781A1A2FFA29F0E306410CE4403299D947BAFE6AA7E3`

Automated evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\CA_R1C_I1_OFFICIAL_IMPORTS_FETCH_2026-09-04_155934_IST_evidence.zip`

SHA-256:

`D6133E04347F84E645BF56E7E4D05F951633EB342041E66307EE2EE61C127F6A`

Manual closeout:

`docs\changes\2026-09-04_1657_IST_CORPORATE_ACTION_R1C_I1_MANUAL_ACCEPTANCE_CLOSEOUT.md`

## Authority rule for the UI/UX phase

The next UI/UX phase may reorganize, simplify, restyle, or improve presentation, but the accepted R1C-I1 functional behavior is now part of the preservation baseline.

UI/UX work must not silently:

- remove combined exchange fetch
- couple the CSV selector back to the direct-fetch scope
- remove Force Re-fetch
- remove the lifecycle log
- overwrite last-success on partial failure
- remove real error detail
- weaken date validation
- remove review-first behavior
- remove Historical Backfill or existing specialist workflows

Business behavior changes require separate explicit approval and separate tests.
