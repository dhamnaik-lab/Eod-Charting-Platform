# Corporate Action UI/UX Modernization — Product Decision Record

**Decision authority:** User-approved Phase A discussion  
**Project:** `E:\TA Projects\EOD Charting Platform`  
**Status:** Approved product decisions; implementation not yet authorized

## Decision Summary

| ID | Decision | Approved choice | Binding consequence |
|---|---|---|---|
| CA-UX-001 | Primary interaction model | **Option B workflow-centric** | Normal workflow is Fetch → Load → Review → Approve |
| CA-UX-002 | Review default | **Exceptions-first** | Open Needs Review and Conflicts; Ready is summarized |
| CA-UX-003 | Exception handling | **Evidence-only** | Normal users cannot repair/resolve; exception remains excluded |
| CA-UX-004 | Approve behavior | **One-click all Ready** | No row selection or Select All Ready control |
| CA-UX-005 | Advanced Maintenance location | **Database Tools** | Specialist controls are entirely outside normal workflow |
| CA-UX-006 | Review object | **Grouped economic event** | Company/date event cards replace source-row decisions |
| CA-UX-007 | Fetch behavior | **One-click automatic catch-up** | App chooses source and missing ranges |
| CA-UX-008 | Load behavior | **One-click load + processing** | Matching, dedupe, compound, validation, classification are automatic |
| CA-UX-009 | No-exception Review | **Explicit concise checkpoint** | Review is not silently skipped |
| CA-UX-010 | Workspace reopen behavior | **Automatic resume** | App opens the next required stage from persisted state |
| CA-UX-011 | Unresolved after approval | **Carry forward** | Exceptions do not block current/future Ready work |
| CA-UX-012 | Repeated unresolved items | **Always visible, separated** | New and previously reviewed exceptions are distinct |
| CA-UX-013 | Workspace form | **Dedicated full-page workspace** | Corporate Actions stops being a crowded dialog |
| CA-UX-014 | Evidence presentation | **Right-side drawer** | Evidence remains visible without leaving Review |
| CA-UX-015 | Status model | **Five plain-language statuses** | Ready, Needs Review, Conflict, Approved, Already Processed |
| CA-UX-016 | Review-to-Approve handoff | **One explicit handoff** | No per-event acknowledgement or batch checkbox |
| CA-UX-017 | Final recheck mismatch | **Partial success, fail closed** | Approve still-valid events; return changed events to Review |
| CA-UX-018 | Documentation gate | **Documents before implementation** | No source edit before design, matrix, data flow, plan, report review |

## Detailed Records

### CA-UX-001 — Workflow-Centric Option B

**Decision:** Use `Fetch Data → Load & automatic processing → Review → Approve`.

**Reason:** The user should not choose internal Corporate Action operations. Existing engine work remains application responsibility.

**Rejected:** Improved table-only modernization and an all-controls dashboard.

### CA-UX-002 — Exceptions-First Review

**Decision:** Review opens on Needs Review and Conflicts. Ready events are summarized and optionally inspectable.

**Reason:** Routine verified events should not create repetitive manual work.

### CA-UX-003 — Evidence-Only Exceptions

**Decision:** Normal Review provides evidence and exclusion reason only.

**Reason:** Identity repair and technical reconciliation are specialist tasks. Exposing them would recreate current complexity.

### CA-UX-004 — One-Click Ready Approval

**Decision:** One primary action approves the current Ready set after confirmation.

**Reason:** Selection and batching are application mechanics. Backend eligibility remains authoritative.

### CA-UX-005 — Separate Maintenance Area

**Decision:** Existing repair, backfill, scan, manual-entry, and diagnostic capabilities move under `Database Tools → Corporate Action Maintenance`.

**Reason:** Preserve capability without exposing it to normal operators.

### CA-UX-006 — Economic-Event Cards

**Decision:** Present one company/date economic event. Show source rows only in evidence.

**Reason:** Split + Bonus, equivalent duplicates, and source provenance are evidence components, not separate user decisions.

### CA-UX-007 — Automatic Catch-Up Fetch

**Decision:** Normal Fetch determines missing dates and official source automatically.

**Reason:** Date/source mechanics belong to application and maintenance tooling.

### CA-UX-008 — Automatic Load Processing

**Decision:** One Load action runs normalization, identity, dedupe, grouping, compound, price validation, and classification.

**Reason:** The user wants a process result, not a pipeline configuration surface.

### CA-UX-009 — Explicit No-Exception Review

**Decision:** Show a concise Review result even when there are zero exceptions.

**Reason:** Preserve the four-stage mental model and a conscious pre-approval checkpoint.

### CA-UX-010 — Automatic Resume

**Decision:** Reopening Corporate Actions derives and opens the next stage.

**Reason:** The user should not remember or select workflow state.

### CA-UX-011 — Carry Exceptions Forward

**Decision:** Approval completes for Ready events while unresolved items stay excluded and visible in future cycles.

**Reason:** Exceptions cannot block newer safe work and cannot disappear silently.

### CA-UX-012 — Separate New vs Previously Reviewed

**Decision:** Repeated unresolved items remain visible with first/last review context.

**Reason:** Prevent forgotten exceptions without presenting them as new each cycle.

### CA-UX-013 — Full-Page Workspace

**Decision:** Use a full application workspace, preserving/restoring chart state.

**Reason:** Cards, evidence, progress, and approval summaries require more space than a modal.

### CA-UX-014 — Right-Side Evidence Drawer

**Decision:** Keep event list visible while technical evidence opens beside it.

**Reason:** Preserve context and avoid excessively tall inline expansion.

### CA-UX-015 — Five Statuses

**Decision:** Use `READY`, `NEEDS REVIEW`, `CONFLICT`, `APPROVED`, and `ALREADY PROCESSED`.

**Reason:** Preserve the distinction between uncertainty and conflict without leaking technical state names.

### CA-UX-016 — Direct Review Handoff

**Decision:** `Continue to Approve N` is the only Review completion action.

**Reason:** Users cannot resolve normal exceptions, so per-item acknowledgement creates false work.

### CA-UX-017 — Partial Success at Backend Recheck

**Decision:** Approve still-valid events and return changed events to Review.

**Reason:** Preserve backend revalidation and existing batch semantics without failing a large safe set because a subset changed.

### CA-UX-018 — Documentation First

**Decision:** Create and approve Phase A documents before source implementation.

**Reason:** Lock product, safety, component, data-flow, test, and rollback boundaries before modifying the high-consequence Corporate Action workflow.
