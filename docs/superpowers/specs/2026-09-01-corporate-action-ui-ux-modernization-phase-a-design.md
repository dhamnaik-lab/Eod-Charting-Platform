# Corporate Action UI/UX Modernization — Phase A Audit and Approved Design Specification

**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Phase:** Documentation-only UX audit and design  
**Approved workflow:** `Fetch Data → Load & automatic processing → Review → Approve`  
**Engine authority:** V1.14AD commit `2103e9ffcaaad28bd903c9cb71310316c68f2ffd`  
**Tree authority:** `6bc7dd2b393b3baf78ff97539c9eb7b8c8f42c77`  
**Implementation status:** BLOCKED pending explicit approval of these documents

## 1. Goal

Replace the current control-heavy Corporate Action workbench with a dedicated full-page workspace that exposes only four normal-user stages:

```text
FETCH DATA
    ↓
LOAD & AUTOMATIC PROCESSING
    ↓
REVIEW
    ↓
APPROVE
```

The application, not the user, owns source selection, missing-range calculation, identity matching, historical identity evidence, equivalent-event deduplication, compound-event calculation, price validation, status classification, approval eligibility, backend recheck, batching, idempotency, and audit evidence.

## 2. Scope

Phase A authorizes documentation only. It defines:

- the normal-user information architecture;
- the current-state UX defects;
- the four-stage workflow contract;
- economic-event grouping and evidence presentation;
- status vocabulary;
- exception and approval behavior;
- the boundary between normal workflow and Advanced Maintenance;
- component and data-flow boundaries;
- implementation sequencing and regression gates.

Phase A does **not** authorize:

- source edits;
- backend logic changes;
- database schema or data writes;
- Corporate Action approval;
- Git staging or commit;
- tests, builds, packaging, or portable promotion.

## 3. Confirmed Current-State UX Defects

### 3.1 Normal and specialist operations are mixed

The current Corporate Action area exposes routine work alongside technical maintenance controls such as identity repair, historical evidence maintenance, scanning, backfill, manual resolution, and diagnostics. The operator must understand implementation mechanics to complete a normal import cycle.

### 3.2 Too many competing actions

The current surface has included actions such as:

- Load / Load More;
- Validate Split/Bonus;
- Resolve Multiple;
- Quick Resolve;
- Recheck Selected;
- Select All Ready;
- Approve All Ready;
- Save 1 Active / Save Multiple / Save No Active / Save No Hint;
- database scans, backfills, and manual-entry paths.

These actions represent internal state transitions rather than the user’s actual objective.

### 3.3 Source-row presentation obscures the economic event

Split and Bonus components, equivalent duplicate rows, identity evidence, price evidence, and approval state are displayed as technical rows. The user must reconstruct the company/date economic event mentally.

### 3.4 Multiline table content is not reliably readable

Runtime screenshots showed vertically crowded or overlapping text in Instrument, Price Check, and Validation/Approval columns. This is a safety and comprehension defect, not only a cosmetic issue.

### 3.5 Workflow state is unclear

The current UI does not clearly answer:

- What has been fetched?
- What is waiting to load?
- What has been processed automatically?
- Which events need attention?
- Which events are safe to approve?
- What should the operator do next?

### 3.6 Technical states leak into the user vocabulary

Matched, parsed, recommendation strength, scan states, identity bindings, stale evidence, compound fingerprints, and price-validation details appear as operator-facing concepts. These remain necessary internally but should not compete as primary statuses.

## 4. Design Principles

1. **One primary action per stage.**
2. **Application-owned complexity.** Normal users do not orchestrate matching, validation, deduplication, or batching.
3. **Economic event, not source row.** The primary review object is one company/date economic event.
4. **Exceptions first.** Routine Ready events are summarized, not forced through manual inspection.
5. **Evidence is available, not mandatory.** Technical evidence is read-only in a drawer.
6. **Backend authority remains final.** UI status and counts never bypass backend eligibility recheck.
7. **No automatic approval.** Approval always requires an explicit user action and confirmation.
8. **Fail closed.** Incomplete, stale, or conflicting evidence stays excluded.
9. **Resume automatically.** The workspace derives the next required stage from persisted backend/import state.
10. **Maintenance is separate.** Specialist tools are outside the normal workspace.

## 5. Target Workspace

Corporate Actions becomes a dedicated full-page workspace:

```text
┌──────────────────────────────────────────────────────────────┐
│ Corporate Actions                                  [Close]   │
│ Active database: NSE · Data current through 28 Aug 2026     │
├──────────────────────────────────────────────────────────────┤
│  ✓ Fetch       ✓ Load       3 Review       4 Approve        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    Current-stage content                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Opening the workspace preserves the existing chart workspace state. Closing it restores the same chart, symbol, timeframe, drawings, sheets, and tabs.

Completed stages are readable summaries. Future stages are disabled until prerequisites are satisfied. The current stage has one primary action.

## 6. Stage Contracts

### 6.1 Fetch Data

Normal UI:

```text
FETCH DATA

Last successful fetch     28 Aug 2026
Data current through      28 Aug 2026

[ Fetch Latest Corporate Actions ]
```

The application automatically determines:

- official source and exchange scope;
- last successfully covered date;
- missing date ranges;
- retry behavior;
- duplicate-download avoidance;
- source parsing and no-data dates.

Results:

```text
FETCH COMPLETE

74 new records fetched
18 already known
2 dates contained no records

[ Continue to Load ]
```

A partial failure stays in Fetch with one `Retry Fetch` primary action and read-only error details. Custom date ranges, source overrides, and historical backfill move to Advanced Maintenance.

### 6.2 Load & Automatic Processing

Normal UI:

```text
LOAD

74 fetched records are ready.

[ Load Fetched Data ]
```

One click performs the existing internal pipeline:

```text
Import into staging
      ↓
Normalize symbols and action types
      ↓
Match current and historical identities
      ↓
Consolidate equivalent duplicate evidence
      ↓
Group rows into economic events
      ↓
Calculate genuine compound factors
      ↓
Run price validation
      ↓
Classify user-facing status
```

Progress is descriptive, not configurable. Re-running Load is idempotent and cannot create duplicate imported evidence.

Completion:

```text
LOAD & PROCESS COMPLETE

74 source records loaded
61 economic events identified

43  Ready
12  Need review
 2  Conflicts
 4  Already processed

[ Continue to Review ]
```

### 6.3 Review

Review is exceptions-first. It opens with:

```text
NEEDS REVIEW

New exceptions                 3
Previously reviewed           16
Conflicts                      1

Ready                         531
Already processed             25
```

Ready events are summarized and optionally inspectable. The user is not required to inspect them individually.

If there are no exceptions, Review remains an explicit lightweight checkpoint:

```text
REVIEW

✓ No exceptions found

531 events passed all automatic checks.
25 events were already processed.

[ View Ready Summary ]        [ Continue to Approve ]
```

If exceptions exist:

```text
20 events will remain excluded.
531 verified events are ready.

[ Continue to Approve 531 ]
```

No per-event acknowledgement is required. The application records that the exclusion summary was shown.

### 6.4 Approve

Approve shows one action for the current Ready set:

```text
APPROVE

Ready to approve          531
Needs review               16   Excluded
Conflicts                   1   Excluded
Already processed          25   No action

[ Approve 531 Ready Events ]
```

Confirmation:

```text
Approve 531 verified Corporate Action events?

✓ Identity checks passed
✓ Equivalent duplicates consolidated
✓ Compound events calculated
✓ Price validation passed
✓ Unresolved and conflicting events excluded

[ Cancel ]                           [ Approve 531 ]
```

The backend rechecks eligibility immediately before each existing approval mutation. If eligibility changes:

```text
APPROVAL COMPLETE

528 events approved
3 returned to Review because their eligibility changed
20 existing exceptions remain excluded

[ Done ]
```

Still-valid events are approved. Changed events fail closed and return to Needs Review or Conflict. Internal batching remains hidden.

## 7. Economic-Event Presentation

The normal Review object is one `CorporateActionEventViewModel`, representing one validated economic event, not an arbitrary source row.

Example:

```text
BHARATRAS
12 Dec 2025 · Split + Bonus

Combined adjustment        ×4
Previous close             ₹9,900
Expected adjusted price    ₹2,475
Observed price             ₹2,549
Difference                 +2.99%

Identity                   Confirmed
Validation                 Passed
Status                     READY

[ View Evidence ]
```

Rules:

- genuine same-date Split + Bonus components remain distinct evidence under one compound event;
- equivalent duplicate source rows are consolidated evidence and cannot become separate approval decisions;
- non-equivalent or conflicting rows cannot be merged by UI inference;
- grouping uses existing validated backend evidence/fingerprints where available;
- absent validated grouping metadata, one source action becomes one event rather than guessing.

## 8. Evidence Drawer

`View Evidence` opens a right-side read-only drawer while keeping the event list visible.

Drawer sections:

1. event summary;
2. source actions and official records;
3. equivalent evidence consolidated;
4. identity / ISIN / historical identity evidence;
5. compound-factor derivation;
6. price calculation and residuals;
7. approval eligibility and exclusion reason;
8. audit history and internal IDs.

The drawer contains no repair, resolve, backfill, or approval controls.

On narrow displays it becomes a full-width overlay with the same hierarchy.

## 9. User-Facing Status Vocabulary

Only five statuses appear in the normal workspace:

| Status | User meaning | Approval treatment |
|---|---|---|
| **READY** | All automatic checks passed | Included |
| **NEEDS REVIEW** | Evidence incomplete or uncertain | Excluded |
| **CONFLICT** | Evidence materially disagrees | Fail-closed and excluded |
| **APPROVED** | Approved in this or a completed cycle | No action |
| **ALREADY PROCESSED** | Previously handled/imported | No action |

Technical states remain inside evidence details.

## 10. Exception Lifecycle

- Exceptions are evidence-only in the normal workflow.
- They remain excluded from approval.
- They carry forward into future Fetch/Load cycles.
- New and previously reviewed exceptions are separated visually.
- Previously reviewed exceptions retain first-detected and last-reviewed timestamps.
- They do not block later Ready events or later workflow cycles.
- They leave Review only after specialist maintenance resolves the underlying evidence and the backend reclassifies them.

## 11. Automatic Resume

The workspace derives the stage from persisted backend/import state:

```text
No fetched work pending                        → Fetch
Fetched records waiting                        → Load
Processing complete / exceptions unreviewed    → Review
Review checkpoint complete / Ready set exists  → Approve
Approval cycle complete / no pending work       → Fetch
```

Interrupted states:

```text
Partial fetch failure       → Fetch / Retry Fetch
Interrupted load            → Load / Resume Processing
Partial approval            → Approve remaining eligible set
```

There is no normal-user stage picker or `Start Over` control.

## 12. Advanced Maintenance Boundary

Specialist operations move under:

```text
Database Tools
└── Corporate Action Maintenance
```

This area contains existing technical capabilities such as:

- identity repair and candidate resolution;
- historical identity evidence and backfill;
- database scans and repair diagnostics;
- manual entry;
- technical import/source overrides;
- reconciliation and forensic tools.

The normal Corporate Action workspace contains no visible `Advanced` shortcut.

## 13. Behavior Preservation Requirements

Implementation must preserve without semantic change:

- raw EOD immutability;
- current and historical identity matching;
- ISIN evidence and fail-closed mismatch handling;
- Split/Bonus validation math;
- genuine compound event handling;
- equivalent-event deduplication;
- stale scan/evidence rejection;
- Rights, Dividend, Demerger, and exception semantics;
- approval eligibility, idempotency, and provenance;
- backend recheck before mutation;
- internal approval chunking at no more than 100 per batch;
- no automatic approval;
- unresolved/conflicting events excluded from every Ready set;
- live database safety and existing audit history.

## 14. Accessibility and Readability

Minimum UI acceptance:

- no fixed-height row containing wrapped text;
- no vertical text overlap at supported desktop zoom levels;
- event card content remains readable at 125% and 150% Windows scaling;
- primary actions have clear accessible names and disabled reasons;
- keyboard focus order follows stage → cards → evidence drawer → primary action;
- status is communicated by text, not color alone;
- evidence drawer is dismissible by button and Escape;
- destructive/mutating confirmation identifies exact event count.

## 15. Non-Goals

Phase A and the first modernization implementation do not:

- redesign Corporate Action engine semantics;
- create new auto-resolution rules;
- auto-approve events;
- repair the unresolved historical identity backlog;
- change corporate-action database schemas unless later proven strictly necessary and separately approved;
- alter raw or adjusted EOD mathematics;
- remove specialist maintenance capability.

## 16. Implementation Discovery Gates

Before source modification, the implementing agent must verify in the live repository:

1. current `HEAD`, tree, index, and working-tree state;
2. exact current signatures in `DatabaseToolsDialogs.tsx` and the desktop bridge;
3. existing full-page workspace routing/host pattern;
4. existing persisted fields sufficient to derive workflow stage;
5. exact current approval batching API and result shape;
6. exact current fetch/missing-range APIs;
7. all focused Corporate Action tests and current full-suite inventory.

The first implementation must prefer derived workflow state and existing APIs. New database schema or backend mutation commands require a separate design amendment.

## 17. Acceptance Criteria

Phase A design is implemented successfully only when:

- the normal user sees only Fetch, Load, Review, and Approve;
- one primary action exists per stage;
- Review opens exceptions-first;
- no-exception Review remains explicit and concise;
- one event card represents one economic event;
- evidence opens in a right-side drawer;
- only five user statuses appear;
- unresolved and conflicting events remain excluded and carry forward;
- one-click Approve uses backend recheck and partial-success behavior;
- the app resumes the next required stage after restart;
- Advanced Maintenance is outside the normal workspace;
- all preservation-matrix tests pass;
- manual runtime acceptance confirms no overlapping content and no hidden engine regression.
