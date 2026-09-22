# Corporate Action Phase 1 Current-State Audit V1.10 — Design Specification

**Date:** 2026-08-17  
**Project:** EOD Charting Platform  
**Mode:** READ-ONLY CURRENT-STATE AUDIT  
**Basis snapshot:** `Eod Charting Platform Source Code 2026-08-17_014948_IST`  
**Immediate purpose:** Measure the actual current Corporate Actions state before any further approval, identity repair, bootstrap, or database-write phase.

---

## 1. Decision

Implement **Corporate Action Phase 1 Current-State Audit V1.10** as a standalone, read-only diagnostic package.

V1.10 will:

1. perform a **deep row-level audit of Split and Bonus imports**;
2. perform a **whole-table health summary for all Corporate Action types**;
3. reconcile the current database against the historical V1.8 → V1.9 → V1.9.1.1 → V1.9.2 evidence chain;
4. produce reports only;
5. perform **zero Corporate Action approvals, zero Quick Resolves, zero historical-ISIN bootstrap writes, zero schema mutations, and zero raw EOD mutations**.

The V1.10 reports become the factual basis for the next governed Corporate Actions phase.

---

## 2. Why V1.10 Is Required

The historical evidence chain established these facts:

- V1.8 reported **401 unapproved Split/Bonus rows**, including **344 `IDENTITY_MATCH_REQUIRED__PRICE_MATCHED`** rows.
- V1.9 re-audited those 344 rows and classified:
  - 295 `LIKELY - MISSING EVIDENCE`
  - 49 `NO_CANDIDATE`
  - 0 state changes
  - 0 strict-safe direct identity resolutions.
- V1.9.1.1 reconciled the 295 missing-evidence targets and classified:
  - 283 `BOOTSTRAP_SAFE`
  - 9 `COMPANY_IDENTITY_MISMATCH`
  - 3 `CONFLICTING_ISIN_HISTORY`
  - 0 state changes/anomalies.
- V1.9.2 then handled the authorized 283 safe imports at the **historical identity-evidence layer**, deduplicating them to **281 exact historical identity tuples**.
- V1.9.2 intentionally did **not** approve Corporate Actions.
- The 9 + 3 + 49 counts are now historical evidence only. They must not be assumed to equal the current database state.

Therefore the next valid step is not another repair package. It is a fresh current-state measurement.

---

## 3. Scope

### 3.1 Deep Audit Scope — Split and Bonus

Every current Split or Bonus import row must be enumerated and classified across independent dimensions:

1. workflow state;
2. identity state;
3. latest price-validation state;
4. parse/factor/compound-event state;
5. V1.9.2 provenance state where applicable;
6. derived approval-readiness state;
7. historical transition state where the row belongs to a reviewed historical cohort.

The audit must include both approved and unapproved Split/Bonus rows so contradictions and post-bootstrap progress can be measured rather than inferred.

### 3.2 Whole Corporate Action Health Summary

For every other Corporate Action type, V1.10 reports high-level counts only:

- total rows;
- counts by `review_status`;
- approved vs unapproved;
- rows with contradictory approval/status combinations;
- obvious missing-symbol or missing-event-date anomalies where detectable from canonical fields.

This whole-table summary is diagnostic only. It does not introduce Split/Bonus approval rules into Dividend, Rights, Demerger, or other action types.

### 3.3 Explicitly Out of Scope

V1.10 must not:

- approve any Corporate Action;
- invoke bulk approval;
- invoke Quick Resolve;
- write historical ISIN evidence;
- modify `corporate_action_imports`;
- modify `corporate_action_import_decisions`;
- modify `instrument_isin_history`;
- modify Corporate Action rows;
- modify raw EOD data;
- alter adjustment factors;
- alter parser behavior;
- alter production React/TypeScript source;
- alter Tauri startup/runtime source;
- change the database schema;
- generate an apply candidate file for a future write phase;
- perform Git operations.

---

## 4. Safety Architecture

### 4.1 Required Data Flow

```text
ACTIVE market-data.sqlite3
        │
        │ require application closed / database quiescent
        ▼
hash live DB + WAL + SHM
        │
        ▼
capture consistent private SQLite-family snapshot
        │
        ▼
open PRIVATE snapshot read-only
        │
        ├─ SQLite read-only mode
        ├─ PRAGMA query_only = ON
        ├─ schema contract validation
        ├─ SELECT / PRAGMA only
        └─ zero write-capable audit API
        │
        ▼
Split/Bonus Deep Audit
        │
        ├─ workflow classifier
        ├─ identity classifier
        ├─ price-validation classifier
        ├─ compound/factor classifier
        ├─ V1.9.2 provenance classifier
        └─ readiness classifier
        │
        ├──────── Historical Cohort Reconciliation
        │
        ▼
All-Action-Type Health Summary
        │
        ▼
TXT + CSV + JSON + manifest
        │
        ▼
rehash live DB + WAL + SHM
        │
        ▼
BYTE-IDENTICAL REQUIRED
```

### 4.2 Live Database Boundary

The live database is used only to:

1. identify the database path;
2. capture pre-audit DB/WAL/SHM hashes;
3. create the private consistent snapshot;
4. capture post-audit DB/WAL/SHM hashes.

All analytical SQL must run against the private snapshot.

If the live SQLite family changes during the audit window, the run is invalid:

```text
AUDIT INVALID — LIVE DATABASE CHANGED
```

No report may be treated as authoritative from that run.

### 4.3 Read-Only Enforcement

The audit reader must use both:

- SQLite read-only open semantics; and
- `PRAGMA query_only = ON`.

The audit implementation must contain no `INSERT`, `UPDATE`, `DELETE`, `REPLACE`, schema DDL, approval API call, Quick Resolve API call, bootstrap writer, or transaction intended for mutation.

---

## 5. Current Source Contracts to Reuse

The August 17 source contains the production state needed for faithful auditing:

- `corporate_action_imports.review_status`;
- `corporate_action_imports.approved_corporate_action_id`;
- canonical Split/Bonus price-validation logic;
- latest completed scan lookup under `scope = 'official_imports'`;
- historical ISIN lookup through `instrument_isin_history`;
- Corporate Action decision audit records;
- V1.9.2 provenance identifier `HISTORICAL_ISIN_BOOTSTRAP_V1_9_2`;
- verified Quick Resolve decision type `VERIFIED_QUICK_RESOLUTION`;
- existing V1.9.2 distinction between `ALREADY_APPLIED` and `PARTIAL_PRIOR_APPLY`;
- same-date compound Split/Bonus validation behavior.

V1.10 must mirror current production eligibility semantics rather than inventing a second approval engine.

---

## 6. Split/Bonus Classification Model

Each Split/Bonus import receives exactly one value in each applicable dimension.

### 6.1 Workflow State

```text
APPROVED
PENDING
PENDING_ISIN_MISMATCH
UNRESOLVED
NEEDS_REVIEW
UNSUPPORTED
REJECTED
OTHER_STATUS
DATA_INTEGRITY_ANOMALY
```

`approved_corporate_action_id` is evaluated independently from `review_status`.

Examples of workflow anomalies include:

- approved ID present with a status that production invariants do not permit;
- `APPROVED` status without an approved Corporate Action reference where one is required;
- missing/blank workflow status;
- a row that cannot be mapped deterministically.

### 6.2 Identity State

```text
IDENTITY_OK
HISTORICAL_ISIN_BOOTSTRAP_CONFIRMED
COMPANY_IDENTITY_MISMATCH
CONFLICTING_ISIN_HISTORY
NO_CANDIDATE
AMBIGUOUS_IDENTITY
MISSING_EVENT_DATE_EVIDENCE
IDENTITY_DATA_ANOMALY
```

This dimension must use current event-date identity evidence, destination instrument identity, historical ISIN evidence, and existing decision/provenance records.

Historical V1.9/V1.9.1.1 labels remain comparison inputs; they are not copied blindly into the current classification.

### 6.3 Price-Validation State

Use only the latest completed applicable `official_imports` validation scan.

```text
PRICE_MATCHED
PRICE_REVIEW
NO_PRICE_DATA
PRICE_SCAN_MISSING
PRICE_SCAN_STALE
PRICE_CONTEXT_CHANGED
PRICE_DATA_ANOMALY
```

`PRICE_MATCHED` must reflect the current production definition of a current matched validation result.

The audit must preserve the existing principle that ordinary market gap-up/gap-down residual movement is not itself part of the Corporate Action adjustment factor.

### 6.4 Parse / Factor / Compound State

```text
FACTOR_OK
COMPOUND_FACTOR_OK
PARSE_OR_MAPPING_BLOCKED
FACTOR_CONTEXT_CHANGED
COMPOUND_CONTEXT_CHANGED
FACTOR_DATA_ANOMALY
```

For same-date Split+Bonus events, the audit must evaluate the full compound context rather than judging either component in isolation.

The current accepted compound behavior for cases such as GLOBE, GPIL, BHARATRAS, and FCL must remain compatible with the source implementation.

### 6.5 V1.9.2 Provenance State

For rows belonging to the authorized V1.9.2 safe cohort:

```text
V192_PROVENANCE_COMPLETE
V192_HISTORY_MISSING
V192_BOOTSTRAP_DECISION_MISSING
V192_QUICK_RESOLVE_DECISION_MISSING
V192_FINGERPRINT_CONFLICT
V192_WORKFLOW_STATE_ANOMALY
V192_PARTIAL_PRIOR_APPLY
NOT_V192_TARGET
```

A complete V1.9.2 provenance check requires the expected reviewed identity transition to be represented consistently by:

- the exact historical ISIN evidence;
- `HISTORICAL_ISIN_BOOTSTRAP_V1_9_2` provenance;
- `VERIFIED_QUICK_RESOLUTION` where the V1.9.2 path required it;
- a legitimate current workflow state.

The audit must not convert incomplete provenance into success.

### 6.6 Derived Approval Readiness

This is a read-only conclusion, never an action:

```text
ALREADY_APPROVED
READY_TO_APPROVE
BLOCKED_IDENTITY
BLOCKED_PRICE
BLOCKED_PARSE_OR_FACTOR
REVIEW_REQUIRED
DATA_INTEGRITY_ANOMALY
```

`READY_TO_APPROVE` must be derived by mirroring the current production approval gates.

No new exception policy is permitted in V1.10.

---

## 7. Historical Reconciliation

V1.10 must reconcile four historical cohorts.

### 7.1 V1.9.2 Authorized Safe Cohort

Historical input population:

```text
283 imports
281 exact historical identity tuples
```

Every one of the 283 historical import IDs must reconcile exactly once.

For each import report:

```text
importId
historicalClassification
currentWorkflowState
currentIdentityState
currentPriceState
currentFactorState
currentV192ProvenanceState
currentReadiness
transition
transitionReason
```

### 7.2 Historical `COMPANY_IDENTITY_MISMATCH`

Historical baseline: **9 rows**.

### 7.3 Historical `CONFLICTING_ISIN_HISTORY`

Historical baseline: **3 rows**.

### 7.4 Historical `NO_CANDIDATE`

Historical baseline: **49 rows**.

For the 9 + 3 + 49 cohorts, the valid transition vocabulary is:

```text
UNCHANGED
NOW_IDENTITY_OK
NOW_READY
NOW_APPROVED
MOVED_TO_OTHER_BLOCKER
NO_LONGER_PRESENT
DATA_ANOMALY
```

These counts are historical reconciliation inputs only. The current-state totals are determined by V1.10.

---

## 8. Whole-Table Health Summary

For each current Corporate Action `action_type`, emit:

```text
actionType
totalRows
approvedRows
unapprovedRows
statusCounts
missingSymbolRows
missingEventDateRows
approvalStatusContradictions
```

The report must include Split and Bonus so the whole-table totals can be reconciled with the deep audit.

For non-Split/Bonus types, V1.10 must not infer readiness using Split/Bonus-only price gates.

---

## 9. Required Output Artifacts

A successful run produces exactly these primary reports:

```text
corporate-action-current-state-audit-summary.txt
corporate-action-split-bonus-deep-audit.csv
corporate-action-split-bonus-deep-audit.json
corporate-action-historical-reconciliation.csv
corporate-action-all-types-health-summary.csv
audit-manifest.json
```

### 9.1 Summary Report

The summary must contain, at minimum:

```text
Mode
Database source path
Private snapshot path
Generated timestamp
Schema contract result
Read-only result

Split/Bonus total
Approved
Pending / open by workflow status
Ready to approve
Blocked by identity
Blocked by price
Blocked by parse/factor
Review required
Data-integrity anomalies

V1.9.2 historical 283-import reconciliation
Historical 9 mismatch reconciliation
Historical 3 conflict reconciliation
Historical 49 no-candidate reconciliation

All-action-type health totals

Live DB unchanged
Live WAL unchanged / not present
Live SHM unchanged / not present

Database writes: 0
Approvals: 0
Quick Resolves: 0
Bootstrap writes: 0
```

### 9.2 Deep Audit CSV/JSON

Each row should retain enough evidence to independently review the classification, including:

- import ID;
- exchange;
- source symbol;
- resolved symbol;
- ISIN;
- company name;
- action type;
- ex/record date;
- parsed factor;
- workflow status;
- approved Corporate Action ID;
- latest scan identity;
- latest validation result;
- relevant price evidence;
- residual percentage where available;
- current identity evidence summary;
- V1.9.2 provenance state;
- each classifier result;
- final readiness result;
- anomaly/reason text.

### 9.3 Audit Manifest

The manifest records:

- audit version;
- fingerprint/schema version;
- live DB/WAL/SHM pre-hashes;
- live DB/WAL/SHM post-hashes;
- private snapshot hashes;
- input historical artifact hashes;
- source-basis sentinel hashes;
- row counts;
- report SHA-256 hashes;
- zero-write declaration.

---

## 10. Input Evidence and Provenance

V1.10 must consume or package exact historical inputs sufficient to identify:

1. the V1.8 reviewed target population;
2. the V1.9 identity-audit classifications;
3. the V1.9.1.1 bootstrap-audit classifications;
4. the V1.9.2 authorized 283-import safe cohort.

The implementation must fail closed if an expected historical artifact:

- is missing;
- has an unexpected schema;
- has duplicate import IDs where uniqueness is required;
- produces a cohort count inconsistent with the locked historical baseline;
- cannot be fingerprinted deterministically.

Historical artifact hashes must be recorded in `audit-manifest.json`.

---

## 11. Schema Contract

Before classification, V1.10 validates the existence and required columns of all tables it depends on.

At minimum this includes the structures that provide:

- Corporate Action imports;
- Corporate Action decision records;
- structured source/evidence rows used by current identity logic;
- official-import price-validation scans/results;
- instrument identity;
- historical ISIN evidence.

If a required schema contract fails:

```text
AUDIT BLOCKED — SCHEMA CONTRACT FAILED
```

No partial authoritative report is produced.

---

## 12. Conservation and Consistency Invariants

A successful audit must prove:

1. every current Split/Bonus import appears exactly once in the deep audit;
2. every deep-audit row has exactly one workflow classification;
3. every deep-audit row has exactly one readiness classification;
4. all applicable classifier dimensions are deterministic;
5. approved + unapproved Split/Bonus counts reconcile to the deep-audit total;
6. action-type summary totals reconcile to the total current Corporate Action population;
7. every V1.9.2 historical import reconciles exactly once;
8. historical 9 + 3 + 49 cohort import IDs reconcile exactly once each;
9. duplicate import IDs are rejected;
10. contradictory status/provenance states are surfaced as anomalies rather than normalized away.

---

## 13. Failure Policy

V1.10 fails closed on:

- application/database not quiescent when required for snapshot safety;
- private snapshot failure;
- DB/WAL/SHM hash inconsistency;
- schema contract failure;
- missing historical input;
- historical cohort count/fingerprint mismatch;
- duplicate current or historical import IDs;
- classifier non-determinism;
- count-conservation failure;
- partial V1.9.2 provenance where the row cannot be safely characterized;
- any detected write attempt;
- live DB/WAL/SHM mutation during the audit;
- report serialization failure.

A failed audit may retain diagnostic logs, but must clearly mark the run non-authoritative.

---

## 14. Implementation Boundary

V1.10 should be delivered as a standalone audit package.

The package may contain:

- a PowerShell orchestration wrapper;
- a dedicated read-only audit implementation;
- deterministic fixtures/tests;
- historical evidence inputs or exact verified references;
- reporting helpers;
- package manifests and SHA-256 contracts;
- a dated change/audit document.

The implementation must **not require production-source edits** to answer the current-state question.

If implementation discovers that faithful classification cannot be achieved without reusing production Rust logic, stop and return for design review rather than silently creating duplicate semantics.

---

## 15. Test Strategy

Before any live run, deterministic fixtures must prove at minimum:

1. SQLite read-only open;
2. `PRAGMA query_only = ON`;
3. mutating SQL is rejected;
4. approved Split;
5. approved Bonus;
6. pending/open Split/Bonus;
7. `PENDING_ISIN_MISMATCH`;
8. unresolved identity;
9. current `PRICE_MATCHED`;
10. price review;
11. no-price-data;
12. missing scan;
13. stale/context-changed scan;
14. company identity mismatch;
15. conflicting ISIN history;
16. no candidate;
17. complete V1.9.2 provenance;
18. deliberately partial V1.9.2 provenance;
19. same-date compound Split+Bonus;
20. parse/factor blocker;
21. READY versus blocked derivation;
22. approved/readiness exclusion;
23. non-Split/Bonus health summary without Split/Bonus readiness semantics;
24. historical transition reconciliation;
25. duplicate-ID rejection;
26. count conservation;
27. live SQLite-family immutability guard;
28. report determinism.

---

## 16. Live Acceptance Gate

A valid operator run must end with evidence equivalent to:

```text
EOD Chart Corporate Action Phase 1 - Current-State Audit V1.10
Mode: READ ONLY CURRENT-STATE AUDIT

Private snapshot created: PASS
SQLite read-only: PASS
PRAGMA query_only: PASS
Schema contract: PASS

Split/Bonus rows reconciled exactly: PASS
V1.9.2 283-import cohort reconciled exactly: PASS
Historical 9 / 3 / 49 cohorts reconciled exactly: PASS
All-action-type health summary: PASS

Required reports written: PASS
Report hashes recorded: PASS

Live DB unchanged: PASS
Live WAL unchanged: PASS / NOT PRESENT
Live SHM unchanged: PASS / NOT PRESENT

Database writes: 0
Approvals: 0
Quick Resolves: 0
Bootstrap writes: 0

AUDIT VALID
```

Anything less is not sufficient to proceed to a write phase.

---

## 17. Decision After V1.10

V1.10 does not pre-select the next implementation.

After the reports are reviewed, the remaining current population will be divided according to measured evidence. Possible later work may include:

- ordinary existing approval flow for genuinely READY rows;
- a narrowly scoped identity-repair phase;
- a conflicting-history investigation;
- no-candidate investigation;
- parse/factor repair;
- price-evidence repair;
- integrity cleanup.

The next phase number, scope, and write permissions are decided only after V1.10 results are inspected.

---

## 18. Git Boundary

Git status/normalization remains explicitly deferred.

V1.10 design, implementation, and audit execution must not be combined with Git cleanup. The current recovery/safety mechanism remains:

- fresh source snapshots;
- database backups/snapshots;
- package manifests;
- SHA-256 source/input/output guards.

Git will be handled later as a separate governed maintenance phase.

---

## 19. Acceptance Summary

V1.10 is accepted only if it answers, from the current database and without mutation:

- What is the exact current Split/Bonus population?
- What is already approved?
- What is genuinely READY now?
- What is blocked, and by which independent gate?
- What became of all 283 V1.9.2 safe imports?
- What became of the historical 9 company mismatches?
- What became of the historical 3 ISIN-history conflicts?
- What became of the historical 49 no-candidate rows?
- Are there any contradictory or partially applied states?
- What is the health/backlog summary for every other Corporate Action type?
- Can we prove the live SQLite family was unchanged throughout the audit?

Only after those questions are answered is a new Corporate Actions write phase permitted.
