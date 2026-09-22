# Corporate Action R1C Donor Feature Inventory and Selective Reuse Guide

**Project:** EOD Charting Platform  
**Date:** 2026-09-04 IST  
**Status:** DONOR / REFERENCE INVENTORY  
**Active product authority:** existing `CorporateActionDialog`

## 1. Purpose

This document records the useful work completed during the reconstruction before the project returned to the existing Corporate Action workflow.

The objective is to prevent that work from being forgotten while also preventing it from being reactivated wholesale.

The R1C donor ZIP is the frozen authority for the reconstruction state:

```text
E:\TA Projects\EOD Charting Platform Source Audit\
CA_EXISTING_WORKFLOW_RECOVERY_PHASE0_2026-09-03_233615_IST\
Current_R1C_CA_Donor_2026-09-03_233615_IST.zip
```

SHA-256:

```text
0F55A69FD205B7F5C76372550B13B3ACC2B761FC8230EAE0CBDA2C6BA82FD094
```

## 2. Classification vocabulary

- **ACTIVE:** currently used by the restored existing workflow.
- **DONOR-SAFE-CANDIDATE:** not active, but contains a bounded idea likely useful later.
- **DONOR-CAUTION:** useful implementation work exists, but should not be ported without deeper review.
- **SUPERSEDED-AS-WHOLE:** do not restore the complete architecture; extract only explicitly approved pieces.

## 3. Inventory

| Work | Key source | Current status | What was implemented | Reuse guidance |
|---|---|---|---|---|
| Task 5B shared import boundary | `legacy/corporateActionImportOperations.ts` | **ACTIVE** | Extracted existing official fetch + list/reload and import-row loading while keeping legacy UI semantics | Keep active. This is the primary proven newer internal improvement. |
| Task 2 workflow model | `corporateActionWorkflow.ts` | DONOR-CAUTION | Derived Fetch/Load/Review/Approve stage facts and READY-only approval-candidate rules | Reuse individual pure helpers only if a future request needs them. Do not make the four-stage model product authority. |
| Task 3 economic-event view model | `corporateActionEconomicEventViewModel.ts` | DONOR-CAUTION | Grouped authoritative event keys, components, evidence and status for presentation; fail-closed consistency checks | Potentially useful for future grouped review presentation. Do not weaken consistency checks. Validate against real data first. |
| Task 4 full-page workspace shell | `workspace/CorporateActionWorkspace.tsx`, `CorporateActionWorkflowHeader.tsx`, CSS | SUPERSEDED-AS-WHOLE | Dedicated full-page Corporate Action shell and four-stage header | Do not restore as the main CA host. Individual styling ideas may be reused. |
| Task 5C normal workflow adapter | `workflow/corporateActionNormalWorkflowAdapter.ts` | DONOR-CAUTION | Connected reconstructed Fetch/Load flow to existing operation boundary and existing validation/recommendation paths | Reuse only if a future incremental feature genuinely needs an adapter. Do not restore automatic Load sequencing by default. |
| Task 5C normal workspace controller | `workspace/CorporateActionNormalWorkflowWorkspace.tsx` | DONOR-CAUTION | Presented reconstructed Fetch/Load flow and controller state | Strong donor for observability/presentation snippets; not current product workflow. |
| Task 5D Review adapter | `workflow/corporateActionNormalReviewAdapter.ts` | DONOR-CAUTION | Loaded existing event-time identity evidence, compound-validation fingerprints and review presentation facts | Useful reference for a future improvement to existing Review Issues, but preserve old specialist workflow authority. |
| Task 5D Review workspace | `workspace/CorporateActionReviewWorkspace.tsx` | DONOR-SAFE-CANDIDATE | Search/status filtering, grouped event cards and evidence-drawer presentation | Presentation ideas may be reused selectively in existing Review Issues. |
| Task 5E approval adapter | `workflow/corporateActionNormalApprovalAdapter.ts` | DONOR-CAUTION | Routed reconstructed approval stage toward existing approval authority with eligibility/idempotency preservation | Do not create a second approval algorithm. Reuse only UI orchestration if explicitly requested. |
| Task 5E approval workspace | `workspace/CorporateActionApproveWorkspace.tsx` | DONOR-SAFE-CANDIDATE | Newer approval-stage presentation | Can donate layout/presentation patterns if the old approval UX is later improved. |
| Task 6A Maintenance workspace | `maintenance/CorporateActionMaintenanceWorkspace.tsx` | SUPERSEDED-AS-WHOLE | Six-section Maintenance navigation foundation: Manual Actions, Identity & History, Official Data Fetch, Historical Backfill, Database Scan, Issue Resolution | Separate Maintenance product is not active. Section labels may help reorganize old UI only if user explicitly requests it. |
| Managed CA window host | `workspace/CorporateActionManagedWindow.tsx` | DONOR-SAFE-CANDIDATE | Managed FloatingWindow integration, stable identity, open/focus/restore behavior and state preservation | Reuse individual window-state techniques if the existing CA window needs improvement. |
| Independent Normal/Maintenance state | `uiStore.ts` + managed-window routing | SUPERSEDED-AS-WHOLE | Allowed two CA contexts to coexist and retain minimized state | Not needed while there is one active CA tool. Keep only as historical/donor implementation. |
| Editable reconstructed From/To | Normal workspace/controller | DONOR-SAFE-CANDIDATE | Editable date range with 90-day routine default | Existing Official Imports already has From/To. Reuse only default/date helper behavior if requested. |
| Exchange scope selector | Normal workspace/adapter | DONOR-SAFE-CANDIDATE | `NSE + BSE`, `NSE`, `BSE` scope mapped to existing NSE/BSE official fetch inputs | Strong candidate if user wants combined-exchange fetch in the existing Official Imports UI. |
| Durable per-exchange fetch log | Normal workspace/adapter callbacks | DONOR-SAFE-CANDIDATE | Ordered `started / completed / failed` lifecycle log for each selected exchange plus overall completion | Strong candidate for future Official Imports observability improvement. |
| Last successful fetch per database | `workflow/corporateActionNormalFetchHistory.ts` | DONOR-SAFE-CANDIDATE | Frontend `localStorage` persistence keyed by exact active database path | Strong candidate. Reuse without SQLite writes. |
| Last-fetch storage key | fetch-history module | DONOR-SAFE-CANDIDATE | `eod-chart.corporate-action.normal-last-fetch.v1` | Preserve exact key only if reusing the prior implementation. |
| Last-fetch record model | fetch-history module | DONOR-SAFE-CANDIDATE | Per DB `{ scope: 'BOTH'|'NSE'|'BSE', completedAtIso }`; write only after full selected scope succeeds | Good fail-closed semantics. Partial BOTH failure must not overwrite previous success. |
| Improved fetch error surfacing | Normal workspace/manual-checkpoint correction | DONOR-SAFE-CANDIDATE | Converted non-`Error` Tauri rejection into visible real failure text instead of generic message | Strong candidate if existing Official Imports still hides useful backend errors. |
| Load handoff | workflow reducer/controller | SUPERSEDED-AS-WHOLE | Successful Fetch set pending-load fact and advanced to Load | Do not transplant automatically. Existing workflow remains authority. |
| Distinct Maintenance minimized identity | Sidebar/managed-window donor | SUPERSEDED-AS-WHOLE | Separate minimized icon/tooltip for Maintenance | Not needed while Maintenance is inactive. |

## 4. R1C observability design worth preserving

The strongest future donor set for **Official Imports** is:

1. combined exchange scope (`NSE + BSE / NSE / BSE`);
2. ordered per-exchange lifecycle log;
3. real backend error surfacing;
4. per-database last successful fetch time;
5. success history written only after the entire selected fetch succeeds.

These can be added to the existing Official Imports page **without** bringing back the four-stage workflow.

## 5. Last-success persistence design

If selectively restored, preserve the previously approved semantics:

```text
storage key:
eod-chart.corporate-action.normal-last-fetch.v1
```

Map key:

```text
exact activeDatabasePath
```

Record:

```ts
{
  scope: 'BOTH' | 'NSE' | 'BSE';
  completedAtIso: string;
}
```

Rules:

- frontend localStorage only;
- no SQLite schema/settings write;
- update only after the full selected fetch succeeds;
- when BOTH is selected and one exchange fails, do not replace the previous successful record;
- switching active database shows that database's independent record.

Previously intended display form:

```text
Last successful fetch: NSE + BSE · DD-MM-YYYY HH:MM IST
```

or:

```text
Never for this database.
```

## 6. Durable fetch-log design

The successful R1C runtime demonstrated ordered entries conceptually like:

```text
NSE - Fetch started: <from> to <to>
NSE - Complete: <counts/cache/fetch details>
BSE - Fetch started: <from> to <to>
BSE - Complete: <counts/cache/fetch details>
All selected exchanges complete: <source row total>
```

This is a presentation/observability improvement and is a good candidate for the restored existing Official Imports page.

## 7. Known caution: economic-event Load path

Do not treat the reconstructed Load path as automatically safe merely because tests pass.

Manual runtime reached a fail-closed error for a Bonus compound event with inconsistent `shareFactor`.

The relevant economic-event model intentionally asserts consistency for duplicate same-type components. That safety rule must not be suppressed merely to make Load continue.

If grouped economic-event UI is revisited:

1. perform a read-only diagnostic on the private/test DB for the failing event;
2. classify whether the cause is source revision/duplication, grouping, imported-data inconsistency or parsing;
3. preserve fail-closed behavior;
4. decide whether grouped review should remain presentation-only.

## 8. Donor reuse rules

For any future donor reuse:

- compare against the active existing feature first;
- prefer a small UI/presentation transplant over a workflow transplant;
- do not duplicate existing backend math/identity/approval algorithms;
- do not remove existing manual CSV fallback;
- do not hide specialist issue-resolution capabilities;
- do not automatically add Maintenance as a second product;
- keep private/test DB validation separate from the user's regular database;
- stop for manual review after each incremental change.

## 9. What not to delete yet

Do not delete R1C donor source merely because it is inactive.

Retain it until:

- all desired donor ideas have either been reused or explicitly rejected;
- future cleanup is separately reviewed;
- the R1C donor ZIP and this inventory remain available.

## 10. What is currently active from the reconstruction

Only the proven internal Task 5B import-operation extraction is intentionally treated as a newer active CA implementation component.

Everything else listed above is donor/reference unless a future task explicitly promotes a bounded part.
