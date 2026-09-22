# Corporate Action — New Chat Handoff

**Project:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Date:** 2026-09-04 IST  
**Status:** RECOVERY COMPLETE / MANUALLY ACCEPTED / WAITING FOR FIRST INCREMENTAL IMPROVEMENT

---

## START HERE IN A NEW CHAT

If this document is being read in a fresh session, do **not** resume the September 1–3 Corporate Action reconstruction roadmap.

The project deliberately returned to the existing working Corporate Action tool.

The user will request future changes **one at a time**.

Before modifying Corporate Actions, read:

1. this handoff;
2. `2026-09-04-corporate-action-current-authority-and-incremental-improvement-policy.md`;
3. `2026-09-04-corporate-action-r1c-donor-feature-inventory-and-selective-reuse-guide.md`;
4. `2026-09-04-corporate-action-reconstruction-documentation-supersession-addendum.md`;
5. `docs\changes\2026-09-04_0105_IST_CORPORATE_ACTION_EXISTING_WORKFLOW_RECOVERY_MANUAL_ACCEPTANCE_CLOSEOUT.md`;
6. `docs\changes\2026-09-04_0022_IST_CORPORATE_ACTION_EXISTING_WORKFLOW_RECOVERY_PHASE1.md`.

## 1. Current active state

Corporate Actions / Identity opens the existing `CorporateActionDialog` through `DatabaseToolsDialogs`.

Active top-level areas:

```text
Manual Entry
Identity Import
Official Imports
Scan Database
Review Issues
```

The restored old/current interface was manually accepted by the user.

Official Imports visibly includes:

```text
Review
Fetch & Import
Historical Backfill

Exchange
From
To
Fetch Official
Force Re-fetch

Split
Bonus
Rights
Dividend
Other

CSV fallback
Browse
Import CSV
```

The existing internal window has minimize, maximize/restore and close controls.

## 2. What is active from newer work

The important newer internal improvement intentionally kept active is:

```text
src\features\corporateActions\legacy\corporateActionImportOperations.ts
```

SHA-256 at recovery:

```text
71AB68E06056B0A147AE6139D6CD327873B1116ED3B4BF6B85456F70E2721709
```

The active current dialog file is:

```text
src\components\DatabaseToolsDialogs.tsx
```

SHA-256 at recovery:

```text
F96BBD084058C95BC019EA5D5F8B1AE56DA75614CE6265396996F707A27773C1
```

Do not replace it with the older historical `1CEFF93C...` version; the F96 version contains the accepted Task 5B extraction while preserving legacy behavior.

## 3. What was rolled back from active routing but preserved

The reconstructed Normal/Maintenance system remains in source and in the frozen R1C donor ZIP.

It is **not active product architecture**.

Important donor components include:

```text
src\features\corporateActions\corporateActionWorkflow.ts
src\features\corporateActions\corporateActionEconomicEventViewModel.ts

src\features\corporateActions\workflow\corporateActionNormalWorkflowAdapter.ts
src\features\corporateActions\workflow\corporateActionNormalReviewAdapter.ts
src\features\corporateActions\workflow\corporateActionNormalApprovalAdapter.ts
src\features\corporateActions\workflow\corporateActionNormalFetchHistory.ts

src\features\corporateActions\workspace\CorporateActionWorkspace.tsx
src\features\corporateActions\workspace\CorporateActionWorkflowHeader.tsx
src\features\corporateActions\workspace\CorporateActionNormalWorkflowWorkspace.tsx
src\features\corporateActions\workspace\CorporateActionReviewWorkspace.tsx
src\features\corporateActions\workspace\CorporateActionApproveWorkspace.tsx
src\features\corporateActions\workspace\CorporateActionManagedWindow.tsx

src\features\corporateActions\maintenance\CorporateActionMaintenanceWorkspace.tsx
```

Exact donor availability should be verified against the R1C donor ZIP before reuse.

## 4. Best donor features for likely future use

The strongest bounded improvements already implemented during R1C are:

### Official Imports observability
- `NSE + BSE / NSE / BSE` exchange scope;
- per-exchange started/completed/failed log;
- total completion entry;
- better real error surfacing.

### Fetch history
- per-active-database last successful fetch;
- localStorage only;
- no SQLite write;
- full-scope success required before updating history.

Storage key:

```text
eod-chart.corporate-action.normal-last-fetch.v1
```

### Presentation ideas
- newer Review event-card/evidence-drawer presentation;
- newer Approve presentation;
- managed-window focus/restore techniques.

These are donor ideas only. Port one bounded feature at a time into the existing active workflow.

## 5. What must NOT be re-enabled automatically

Do not restore these as a package:

```text
Fetch -> Load -> Review -> Approve
```

Do not automatically restore a separate:

```text
Corporate Action Maintenance
```

Do not continue Task 6B merely because old reconstruction documents name it as next.

Do not delete or hide:

- Manual Entry;
- Identity Import;
- CSV fallback;
- Historical Backfill;
- Scan Database;
- Review Issues;
- specialist identity/exception controls.

## 6. Known donor runtime issue

When the reconstructed R1C flow was manually tested, Fetch succeeded and advanced to Load, but Load hit a fail-closed error for a Bonus compound event with inconsistent `shareFactor`.

That validation was not weakened.

The issue was not repaired before recovery because the project changed direction.

Therefore:

- do not reactivate reconstructed Load wholesale;
- if economic-event grouping is reused, diagnose real-data consistency separately and read-only first.

## 7. Recovery authorities

### Before-CA-UX historical ZIP

SHA-256:

```text
37437F713C20FD4C6419FFEA5D711C2108A82188678FDB697BB3B2AE79118C8F
```

### Frozen R1C donor ZIP

```text
E:\TA Projects\EOD Charting Platform Source Audit\
CA_EXISTING_WORKFLOW_RECOVERY_PHASE0_2026-09-03_233615_IST\
Current_R1C_CA_Donor_2026-09-03_233615_IST.zip
```

SHA-256:

```text
0F55A69FD205B7F5C76372550B13B3ACC2B761FC8230EAE0CBDA2C6BA82FD094
```

### Phase 1 evidence

```text
E:\TA Projects\EOD Charting Platform Source Audit\
CA_EXISTING_WORKFLOW_RECOVERY_PHASE1_2026-09-04_002209_IST_evidence.zip
```

SHA-256:

```text
72A3441FB9067EEC175F8D79F3A58B77FE7CC0EBB468A057E163B5E3B3271F16
```

### Accepted portable

```text
E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\
EOD Chart Portable\EOD Chart.exe
```

SHA-256:

```text
D4E7E3EFA9A6E2CC663F22E145ABB2CD3B3487EB8B4F760AD0A01C8EBCB99808
```

## 8. Phase 1 automated certification

Phase 1 proved:

- existing workflow recovery GREEN;
- Task 5B legacy boundary passing;
- reconstruction donor tests passing after host-contract rebasing;
- full Corporate Action suite: 24 files / 125 tests PASS;
- renderer typecheck PASS;
- renderer build PASS;
- Cargo check PASS;
- portable build PASS;
- no SQLite access by the runner;
- package files preserved;
- Git HEAD/tree/index/staged set preserved.

Manual review then accepted the restored window.

## 9. User/project operating rules

### PowerShell
Use guard clauses and separate `if` blocks only.

**Do not use `else` or `elseif`.**

### Git
Do not stage or commit unless explicitly authorized.

### Database
The user has a private/test database used for Corporate Action experimentation and a separate regular database.

Do not assume one path is the other.

Use the private/test DB for manual CA testing unless explicitly instructed otherwise.

### Scale
100% / 125% / 150% scale testing is currently deferred.

### Workflow
After each incremental CA change:
- test;
- build portable;
- user manually checks;
- stop.

## 10. Immediate next step

There is no pre-authorized implementation task.

Ask for or follow the user's **first incremental Corporate Action improvement request**.

Do not propose a broad redesign unless the user explicitly asks for one.

## 11. Suggested new-chat opening instruction

The user can start a future chat with:

```text
Resume Corporate Action incremental improvement.
Read docs/superpowers/specs/2026-09-04-corporate-action-new-chat-handoff.md
and its referenced 2026-09-04 authority/donor/supersession documents first.
The existing CorporateActionDialog is the active functional authority.
Do not resume the Fetch->Load->Review->Approve reconstruction or Task 6B.
I will give changes one at a time.
```
