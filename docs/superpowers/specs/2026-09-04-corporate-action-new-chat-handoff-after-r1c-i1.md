# Corporate Action New-Chat Handoff After R1C-I1

Status: READ THIS FIRST FOR CURRENT CORPORATE ACTION WORK  
Date: 2026-09-04

## Current state in one paragraph

Corporate Action recovery is complete, and the restored existing `CorporateActionDialog` remains the active product authority. R1C reconstruction remains donor/reference code, except for five low-risk Official Imports improvements that have now been selectively promoted into the existing dialog and manually accepted: combined `NSE + BSE / NSE / BSE` direct fetch, ordered per-exchange lifecycle logging, per-active-database last-success display, improved real error surfacing, and From/To validation. Force Re-fetch, CSV fallback, Historical Backfill, Review/Issues, identity, scan, and approval behavior remain the existing workflow.

## Read order

For current work, use this order:

1. `docs\superpowers\specs\2026-09-04-corporate-action-new-chat-handoff-after-r1c-i1.md`
2. `docs\superpowers\specs\2026-09-04-corporate-action-current-authority-after-r1c-i1.md`
3. `docs\changes\2026-09-04_1657_IST_CORPORATE_ACTION_R1C_I1_MANUAL_ACCEPTANCE_CLOSEOUT.md`
4. `docs\superpowers\specs\2026-09-04-corporate-action-r1c-donor-inventory-i1-promotion-addendum.md`
5. earlier recovery current-authority policy and donor inventory
6. Phase 1 recovery report
7. older reconstruction documents as historical evidence

The earlier `2026-09-04-corporate-action-new-chat-handoff.md` remains valid for the recovery baseline, but this post-I1 handoff is newer current-state authority.

## Project root

`E:\TA Projects\EOD Charting Platform`

## Fresh post-rollback basis snapshot

`Eod Charting Platform Source Code 2026-09-04_135301_IST After CA RollBack.zip`

SHA-256:

`011E11CE3752CDDD64F459EA08DD82D0DE84628C67E21E0E7F59EE464030184D`

This was the basis for R1C-I1.

## Active route

`Database -> Corporate Actions / Identity -> DatabaseToolsDialogs -> CorporateActionDialog`

Do not reroute Corporate Actions to the reconstructed Normal workspace or Maintenance workspace unless explicitly requested later.

## R1C-I1 accepted authorities

### Production source

`src\components\DatabaseToolsDialogs.tsx`

Accepted post-I1 SHA-256:

`8FC0CA2056D1E471D0602C123A2B73F249D4936CBB3843920A92F396F98F8DF2`

### Focused test

`src\features\corporateActions\__tests__\corporateActionLegacyOfficialFetchImprovements.test.ts`

SHA-256:

`4F3A7B42F016264AEB0BDDB1C343147FC525947892FDDB89ECD4BB54697E75DF`

### Task 5B active internal boundary

`src\features\corporateActions\legacy\corporateActionImportOperations.ts`

SHA-256:

`71AB68E06056B0A147AE6139D6CD327873B1116ED3B4BF6B85456F70E2721709`

### Last-success helper now selectively active

`src\features\corporateActions\workflow\corporateActionNormalFetchHistory.ts`

SHA-256:

`BA0333C848062896C93C01E9CE9EA5D1EDF11326E2CB956ECB0B6475CCEAB8CF`

Its use is limited to the promoted last-success behavior. This does not make the reconstructed Normal workflow active.

### Portable

`E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

SHA-256:

`64DFFA9C9748D6B12CBD781A1A2FFA29F0E306410CE4403299D947BAFE6AA7E3`

### Automated evidence

`E:\TA Projects\EOD Charting Platform Source Audit\CA_R1C_I1_OFFICIAL_IMPORTS_FETCH_2026-09-04_155934_IST_evidence.zip`

SHA-256:

`D6133E04347F84E645BF56E7E4D05F951633EB342041E66307EE2EE61C127F6A`

Automated results:

- focused suite: 5 files / 13 tests passed
- full Corporate Action suite: 25 files / 128 tests passed
- renderer typecheck passed
- renderer build passed
- portable build passed
- no DB access by runner
- no Git command by runner

## R1C-I1 active behavior to preserve

### Direct fetch

Scope options:

- `NSE + BSE`
- `NSE`
- `BSE`

For BOTH, execution order is NSE then BSE.

### Lifecycle log

Expected success sequence:

1. NSE started
2. NSE complete
3. BSE started
4. BSE complete
5. overall selected exchanges complete

Failure sequence stops at the exchange failure and does not record overall completion.

### Last successful fetch

Stored in localStorage under:

`eod-chart.corporate-action.normal-last-fetch.v1`

Keyed by exact active database path.

Updated only after full selected-scope success.

A partial combined failure must preserve the previous record.

### CSV fallback

The CSV fallback remains independent.

CSV exchange options remain:

- NSE
- BSE

Never pass `BOTH` to CSV import.

### Force Re-fetch

Force Re-fetch remains active for NSE, BSE, and BOTH.

### Error surface

Preserve real backend/request detail when available.

A manual forced BOTH run surfaced a real BSE request error and correctly left the prior full-success record unchanged.

### Date range

Preserve From <= To validation and reciprocal date bounds.

### Review-first behavior

Fetched/imported rows are not automatically approved.

## Manual checkpoint findings

The manual private/test-database checkpoint demonstrated:

- NSE normal fetch success
- BSE direct-fetch activity
- successful combined NSE+BSE cached run
- combined lifecycle order
- last-success update to BOTH
- forced combined partial BSE failure
- real BSE error surfacing
- previous last-success preserved after partial failure
- Force Re-fetch preserved
- independent NSE/BSE CSV fallback selector
- Review Queue still populated
- Historical Backfill still functional
- TCS historical pilot read 3 rows and identified all 3 as duplicates with zero errors
- Review Issues still reachable
- all original top-level Corporate Action capability areas still reachable

Cross-database last-success independence was not separately manually exercised in this checkpoint; helper tests cover the exact-path keyed behavior.

## R1C remainder status

Still donor/reference only:

- Normal workspace
- Review workspace
- Approve workspace
- Maintenance workspace
- managed-window reconstruction
- workflow adapters
- economic-event view model

Still blocked from wholesale return:

- Fetch -> Load -> Review -> Approve
- separate Maintenance product
- automatic Load & Process
- separate Normal/Maintenance navigation

Still diagnostic before reuse:

- economic-event grouping
- compound Bonus/Split `shareFactor` assumptions
- approval recheck path coupled to the reconstructed Load model

## Next phase

The next requested phase is **Corporate Action UI/UX review and improvement**.

Start UI/UX work by inspecting the accepted current UI and preserving all accepted behavior before changing presentation.

Observed presentation issues that may be discussed during UI/UX review:

- dense horizontal action toolbars
- long status lines
- raw long backend URLs dominating operator-visible error text
- Review controls competing for horizontal space
- large tables and specialist controls that could benefit from clearer information hierarchy

These are observations only. No UI/UX change is authorized by this handoff itself.

## Working rules for next changes

- inspect current implementation first
- use the newest confirmed source
- preserve working behavior unless explicitly changed
- prefer the smallest maintainable change
- one bounded change at a time
- TDD for behavior changes
- private/test database first for manual Corporate Action checks
- no Git staging/commit unless explicitly authorized
- PowerShell runners: guard clauses and separate `if` blocks only; no `else` / `elseif`
- parse every Windows PowerShell 5.1 runner before execution
- do not weaken validation to make reconstructed economic-event code pass
