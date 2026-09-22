# Corporate Action Reconstruction Documentation — Supersession Addendum

**Project:** EOD Charting Platform  
**Date:** 2026-09-04 IST  
**Status:** CURRENT INTERPRETATION ADDENDUM  
**Historical reconstruction evidence:** PRESERVED / NOT REWRITTEN

## 1. Purpose

The September 1–3 Corporate Action reconstruction documents and evidence remain valuable historical records.

However, their product-direction conclusions were superseded after manual review showed that the project had drifted from incremental improvement of the existing Corporate Action tool into a broader replacement architecture.

This addendum defines how those historical documents must be interpreted in future sessions.

## 2. Precedence order

When documents conflict, use this order:

1. `2026-09-04-corporate-action-new-chat-handoff.md`
2. `2026-09-04-corporate-action-current-authority-and-incremental-improvement-policy.md`
3. `2026-09-04-corporate-action-r1c-donor-feature-inventory-and-selective-reuse-guide.md`
4. `2026-09-04_0105_IST_CORPORATE_ACTION_EXISTING_WORKFLOW_RECOVERY_MANUAL_ACCEPTANCE_CLOSEOUT.md`
5. `2026-09-04_0022_IST_CORPORATE_ACTION_EXISTING_WORKFLOW_RECOVERY_PHASE1.md`
6. older reconstruction specifications/plans/reports/evidence

Older documents remain authoritative for what was implemented and tested at that time, but not for the current product direction when contradicted by this recovery closeout.

## 3. Historical documents that must not be silently treated as current architecture

Examples include:

- `docs\superpowers\specs\2026-09-02-corporate-action-capability-preservation-matrix.md`
- reconstruction architecture/design documents dated 2026-09-02;
- reconstruction implementation plan dated 2026-09-02;
- Task 4 full-page workspace evidence;
- Task 5C Fetch/Load reconstruction evidence;
- Task 5D Review reconstruction evidence;
- Task 5E Approve reconstruction evidence;
- Task 6A Maintenance workspace/navigation evidence;
- R1C independent-window/fetch-observability evidence.

Do not delete or rewrite their historical evidence.

## 4. Statements now superseded

The following reconstruction-era conclusions are superseded as current product policy:

### 4.1 Legacy capabilities are source-present but intentionally unrouted

**Superseded.**

After recovery, the existing `CorporateActionDialog` is routed and is the active functional authority again.

### 4.2 Full-page workspace supersedes floating-window presentation

**Superseded.**

The manually accepted current Corporate Action experience is again the existing internal/floating window presentation.

The full-page workspace remains donor source only.

### 4.3 Corporate Action must be split into Normal and Maintenance products

**Superseded.**

There is currently one active Corporate Action interface.

A separate Maintenance product must not be recreated unless explicitly requested in a future design.

### 4.4 Task 6B is the automatic next implementation task

**Superseded.**

Task 6B is not the current next step.

The next step is always the user's next incremental improvement request.

### 4.5 Existing Manual / Identity / Scan / Issues controls are transitional legacy UI

**Superseded as current interpretation.**

Those capabilities are now part of the active functional baseline.

They can be improved incrementally, but they are not deletion-authorized merely because the reconstruction matrix classified them for migration.

## 5. Statements that remain useful/valid

The following reconstruction evidence remains useful:

- exhaustive capability inventory;
- 37 mapped Corporate Action API dependencies;
- backend authority and preservation constraints;
- Task 5B shared import-operation extraction;
- characterization/regression tests;
- workflow/economic-event/review/approval donor implementations;
- UI presentation experiments;
- R1C fetch observability implementation;
- R1C per-database last-success implementation;
- evidence packages and file hashes;
- fail-closed consistency and approval safeguards.

## 6. Preservation matrix interpretation

The 2026-09-02 capability preservation matrix remains a valuable **historical capability inventory**.

Its reconstruction disposition columns (`NORMAL_WORKFLOW`, `MAINTENANCE`, `AUTOMATIC_APPLICATION_RESPONSIBILITY`, migration status, future Task 6B–6E references) must no longer be interpreted as mandatory current migration instructions.

When using the matrix in a future session:

- use capability identity, source location, handler, API mapping, state/effect and behavior descriptions as historical inventory evidence;
- do not assume its migration target is still approved;
- do not assume `SOURCE_PRESENT_NOT_ROUTED_WHEN_CORPORATE_ACTION_OPEN` is current;
- consult the 2026-09-04 current-authority document before proposing changes.

## 7. Current product rule

The reconstruction is a donor library.

The existing working Corporate Action tool is the product baseline.

Future work is incremental and user-directed.
