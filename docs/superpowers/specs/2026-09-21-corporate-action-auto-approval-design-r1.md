# Corporate Action — Auto-Approval Design R1

**Status:** APPROVED DESIGN / WRITTEN AUTHORITY / SOURCE IMPLEMENTATION NOT YET AUTHORIZED  
**Date:** 2026-09-21 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Current source authority:** `Eod Charting Platform Source Code 2026-09-21_142059_IST.zip`  
**Current snapshot SHA-256:** `5469014EE9588B1B83ACCB7F853F97B0FFFB27BA7C39B4BD610A91DC0CC6C010`  
**Current live source authority:** `560` exact `src + src-tauri-shell` files / `554` protected source files

## Objective

Add a new, backend-owned Corporate Action auto-approval authority for a deliberately narrow safe subset of ordinary official imports. R1 automates the final approval step only when the existing application has already established a strong machine-verifiable identity and a strong current Split/Bonus price-validation match.

R1 must not weaken any existing approval safeguards. Rows outside the strict policy continue through the existing manual `Apply Selected` / `Apply All Ready` / exceptional-review paths.

## Approved R1 policy

A row may be auto-approved only when **all** of the following are true immediately before the write:

1. exchange is exactly `NSE`;
2. action type is exactly `SPLIT` or `BONUS`;
3. row is `PARSED`;
4. row review status is exactly ordinary `PENDING`;
5. `approved_corporate_action_id` is null;
6. symbol, ex-date and parsed factor are present and valid;
7. identity is machine-proven under the policy below;
8. the latest `official_imports` Split/Bonus validation exists and is current;
9. validation `scan_status` is exactly `MATCHED`;
10. validation confidence is **>= 0.95** (`STRONG MATCH`);
11. scan factor/date/symbol/exchange fingerprints remain current;
12. the row has no manual or exceptional approval provenance;
13. the action is not an excluded same-date compound Split/Bonus event in R1;
14. the active database still matches the completed Load & Prepare database context;
15. the row still belongs to the caller-provided completed preparation scope.

Anything failing one requirement is **not** auto-approved. It remains available to the existing manual review/approval workflow when that workflow permits it.

## Machine-proven identity policy

R1 may accept either of these identity classes:

### A. Ordinary exact current identity

The resolved row must identify exactly one active current instrument for the same exchange/symbol, with the official/raw ISIN consistent with the active current instrument identity and no exceptional identity decision on the import.

### B. Existing machine-resolution authority

A previously resolved row may be accepted only when its recorded machine provenance is one of the approved automatic decision authorities, including as applicable:

- `VERIFIED_QUICK_RESOLUTION`;
- `VERIFIED_EVENT_IDENTITY_RESOLUTION`;
- `VERIFIED_HISTORICAL_ISIN_TRANSITION`.

The row must still satisfy the current action/date/exchange/symbol/ISIN evidence owned by that proof. A stale or contradictory resolution must fail closed.

The historical-transition decision is preserved for authority consistency even though the currently implemented 20MICRONS proof is DIVIDEND-only and therefore cannot itself qualify for Split/Bonus R1 auto-approval.

## Absolute exclusions

R1 must never auto-approve:

- `DIVIDEND`;
- `RIGHTS`;
- `OTHER`, AGM or informational announcements;
- BSE actions;
- `UNRESOLVED` rows;
- `PENDING_ISIN_MISMATCH` rows;
- unsupported/unparsed rows;
- missing-symbol or missing-date rows;
- `NO_PRICE_DATA` scans;
- `REVIEW` or any non-`MATCHED` scan;
- `MATCHED` scans below confidence `0.95`;
- stale validation results;
- same-date compound Split/Bonus rows in R1;
- rows involving manual resolution or exceptional approval authority;
- rows with any `MANUAL_RESOLUTION` provenance;
- rows with `ISIN_MISMATCH_APPROVAL` provenance;
- rows with `PRICE_VALIDATION_EXCEPTION` provenance;
- rows outside the completed preparation scope;
- rows from a changed active database context.

`INDETERMINATE`, exceptional, ambiguous or conflicting evidence always remains manual/blocked.

## Authority ownership

### New owner

R1 should introduce one narrow private policy/orchestration owner:

`src-tauri-shell\src\database\corporate_action_imports\auto_approval.rs`

It owns only:

- eligibility evaluation;
- automatic-scope filtering;
- fail-closed disposition reasons;
- `AUTO_APPROVAL_SAFE_V1` audit creation;
- orchestration into the existing approval writer.

### Existing writer remains authoritative

R1 must reuse the current ordinary approval mutation path:

`approve_corporate_action_import_without_transaction(...)`

which already delegates canonical action creation to:

`apply_corporate_action_internal(...)`

The new module must not create a second Corporate Action writer, duplicate factor logic, bypass existing price-validation checks, or directly write canonical `corporate_actions` rows.

## Backend-owned decision

The frontend may provide only the **completed preparation scope**. It does not decide which rows are safe.

The backend must independently reload and re-evaluate every scoped row immediately before mutation. A caller-provided list of IDs is therefore a scope boundary, not approval authority.

The request must bind the expected active database path so that a database switch after Load & Prepare fails before any write.

## Trigger semantics

R1 must not approve during:

- Fetch;
- CSV import;
- application startup;
- simple list/load operations;
- a partially completed or cancelled preparation.

The automatic trigger belongs only after a successful explicit **Load & Prepare** sequence has completed all matching and validation stages for the same active database context.

Recommended flow:

```text
Fetch / staged data
        -> Load & Prepare
        -> strict automatic identity work
        -> Split/Bonus validation
        -> preparation COMPLETE
        -> backend Auto-Approval Safe V1
             SAFE      -> ordinary approval writer
             NOT SAFE  -> remain in manual review queue
        -> refresh prepared rows/status
```

This preserves an explicit operator action (`Load & Prepare`) before autonomous mutation without requiring a second approval click for the strict safe subset.

## Batch and transaction policy

Reuse the existing bulk-lock discipline. Auto-approval may process preparation scope in bounded chunks no larger than the existing bulk approval limit (`100`).

Within each backend chunk:

- eligibility is recomputed from current DB state;
- each eligible item uses the existing ordinary approval writer;
- savepoints isolate per-item failure where appropriate;
- one failing row must not cause unsafe approval of another row;
- failed/skipped rows remain available for manual review;
- no exceptional approval path is called.

The result must distinguish at least:

- auto-approved;
- linked to an existing canonical action;
- already approved;
- skipped as R1-ineligible, with deterministic reason;
- failed, with error.

## Audit authority

Every successful autonomous approval must append a Corporate Action decision record using the existing `corporate_action_import_decisions` table.

Exact decision type:

`AUTO_APPROVAL_SAFE_V1`

The reason/evidence string must bind enough information to reconstruct why human confirmation was not required, including at minimum:

- import ID;
- exchange/symbol;
- action type;
- ex-date;
- parsed factor;
- identity proof class / relevant decision provenance;
- validation scan ID;
- scan timestamp;
- scan status;
- confidence;
- expected factor;
- current active database context/fingerprint where available;
- resulting canonical Corporate Action ID;
- policy version `AUTO_APPROVAL_SAFE_V1`.

No schema migration is authorized for R1.

## Manual workflow preservation

The current manual operations remain valid and unchanged for all non-auto-approved rows:

- `Apply Selected`;
- `Apply All Ready`;
- individual ordinary approval;
- identity review;
- price review;
- exceptional ISIN-mismatch approval;
- audited price-validation exception approval;
- historical backfill/review workflows.

Manual-ready does **not** imply machine-auto-approval eligibility. Auto-approval is intentionally a stricter subset.

## Frontend behavior

R1 should make the smallest observable change required to connect the new backend policy to completed preparation.

The existing `Load & Prepare` workflow remains the trigger. After backend auto-approval returns, the prepared queue is refreshed so the operator can see:

- rows that were automatically approved;
- rows still ready for explicit approval;
- rows requiring review/attention.

No new expert control surface is required for R1. Existing detailed evidence remains available. The implementation must not remove manual Apply controls.

## Adjustment behavior preserved

Auto-approval changes only who authorizes the canonical Corporate Action write for the strict R1 subset. It does not redesign price adjustment.

Preserve exactly:

- raw EOD prices are not rewritten;
- canonical approved actions remain the adjustment authority;
- adjustment occurs through the existing adjustment-on-read path;
- Raw mode remains raw;
- existing chart settings remain unchanged;
- no auto-approval operation silently changes chart preferences.

## Closed authorities preserved

R1 must not reopen or alter:

- AUTO-ID1 `CLOSED / CURRENT`;
- exact-event-date historical-ISIN Quick Resolve;
- 20MICRONS historical-ISIN transition-window `CLOSED / CURRENT`;
- `PENDING_ISIN_MISMATCH` boundary;
- post-transition stale-ISIN rows;
- explicit exceptional approval ownership;
- existing source/identity provenance;
- chart/raw-price behavior.

## Deferred stages

### Dividend auto-approval

Deferred. Mathematical factor computability from cash amount and previous close is not by itself sufficient evidence to autonomously approve the official event.

### Rights auto-approval

Deferred. TERP computability is not by itself sufficient autonomous event-validation authority.

### BSE

Deferred and separately gated.

## R1 acceptance principles

R1 is acceptable only when the implementation proves:

1. the safe subset is narrower than ordinary manual Ready;
2. confidence `0.95` is enforced in backend authority, not merely UI classification;
3. all manual/exception provenance is rejected;
4. stale/changed DB or validation evidence fails before mutation;
5. existing ordinary writer is reused;
6. every autonomous approval records `AUTO_APPROVAL_SAFE_V1`;
7. manual approval still works for skipped rows;
8. no Dividend/Rights/BSE/compound action is auto-approved;
9. raw prices and adjustment behavior are unchanged;
10. no unintended approvals occur in controlled TEST-DB acceptance.

## Current authorization boundary

This written design does **not** authorize source implementation yet.

The next permitted action after this Design R1 and its Implementation Plan R1 are installed/accepted is an explicit user authorization to execute the source implementation plan.
