# Corporate Action Phase 1 Controlled READY Approval V1.11 — Design Specification

**Date:** 2026-08-17  
**Project:** EOD Charting Platform  
**Phase:** Corporate Actions Phase 1  
**Mode:** GOVERNED APPROVAL WINDOW  
**Basis:** Valid V1.10 Current-State Audit  
**Immediate purpose:** Approve exactly the 283 current Split/Bonus imports proven `READY_TO_APPROVE` by V1.10, using the existing production approval workflow, with read-only preflight and post-approval reconciliation.

---

## 1. Decision

Implement **Corporate Action Phase 1 Controlled READY Approval V1.11** as a governance package around the existing production `Approve All Ready` workflow.

V1.11 must not create a new approval engine, direct SQL writer, or alternate Corporate Action approval path.

The only Corporate Action write operation in V1.11 is the existing application's normal approval flow.

V1.11 itself provides:

1. exact V1.10 authorization-set extraction;
2. fresh read-only preflight;
3. verified pre-approval SQLite-family backup;
4. operator instructions for the existing production UI;
5. fresh read-only post-approval reconciliation.

---

## 2. Authorized Population

The V1.10 audit measured:

```text
Split/Bonus total:           1433
Already approved:            1032
READY_TO_APPROVE:             283
Blocked identity:             111
Blocked parse/factor:           4
Manual price review:            3
Integrity anomalies:             0
```

Therefore the V1.11 write authorization is limited to the exact **283** V1.10 `READY_TO_APPROVE` Split/Bonus import IDs.

These 283 rows were also confirmed by V1.10 as:

```text
workflowState = PENDING
identityState = HISTORICAL_ISIN_BOOTSTRAP_CONFIRMED
priceState = PRICE_MATCHED
factorState = FACTOR_OK or COMPOUND_FACTOR_OK
v192ProvenanceState = V192_PROVENANCE_COMPLETE
approvedCorporateActionId = null
readiness = READY_TO_APPROVE
```

V1.11 authorization is **identity-bound and business-state-bound**, not count-bound.

---

## 3. Out of Scope

V1.11 must not approve or modify:

- the 111 identity-blocked Split/Bonus rows;
- the 4 parse/factor-blocked Split/Bonus rows;
- the 3 manual price-review Split/Bonus rows;
- any legacy approved-history evidence anomaly;
- Dividend;
- Rights;
- Demerger;
- Other Corporate Action types.

V1.11 must not:

- Quick Resolve;
- write historical ISIN evidence;
- modify identity history;
- override price validation;
- override compound validation;
- repair factors;
- repair parsers;
- update raw EOD data;
- alter adjustment factors;
- alter database schema;
- patch React/TypeScript/Rust/Tauri production source;
- perform Git operations.

---

## 4. Architecture

```text
VALID V1.10 REPORT SET
        │
        ▼
LOCK EXACT 283 AUTHORIZED IDs
        │
        ├─ authorization ID fingerprint
        └─ business-state fingerprint
        │
        ▼
V1.11 READ-ONLY PREFLIGHT
        │
        ├─ private SQLite snapshot
        ├─ mode=ro
        ├─ PRAGMA query_only=ON
        ├─ exact 283 still present
        ├─ exact 283 still PENDING
        ├─ exact 283 still identity acceptable
        ├─ exact 283 still PRICE_MATCHED
        ├─ exact 283 still factor/compound current
        ├─ exact 283 still V1.9.2 provenance complete
        ├─ exact 283 still READY_TO_APPROVE
        └─ zero READY rows outside authorized set
        │
        ▼
PREFLIGHT PASS
        │
        ▼
VERIFIED PRE-APPROVAL SQLITE-FAMILY BACKUP
        │
        ▼
OPEN PRODUCTION APP
        │
        ▼
Official Imports
Validate Split/Bonus
Approve All Ready
        │
        └─ existing batching ≤100
           expected 100 + 100 + 83
        ▼
CLOSE PRODUCTION APP
        │
        ▼
V1.11 READ-ONLY POST-AUDIT
        │
        ├─ 283/283 approved
        ├─ zero authorized remaining
        ├─ zero unexpected extra approvals
        ├─ zero approval-link anomalies
        └─ global Split/Bonus residual reconciliation
```

---

## 5. Input Authority

V1.11 must consume the exact valid V1.10 report set from the accepted live audit run.

Required V1.10 inputs:

```text
corporate-action-current-state-audit-summary.txt
corporate-action-split-bonus-deep-audit.csv
corporate-action-split-bonus-deep-audit.json
audit-manifest.json
```

The package must verify at minimum:

```text
auditVersion = V1.10
mode = READ ONLY CURRENT-STATE AUDIT
liveDatabaseFamilyUnchanged = true
READY_TO_APPROVE count = 283
```

The V1.10 report SHA-256 values in `audit-manifest.json` must match the supplied report files before authorization extraction.

No target row may be reconstructed from memory, count, UI display, or historical V1.9.2 candidates alone.

---

## 6. Exact Authorization Predicate

A V1.10 row is part of the V1.11 authorized set only if all conditions are true:

```text
actionType in {SPLIT, BONUS}
readiness = READY_TO_APPROVE
workflowState = PENDING
identityState = HISTORICAL_ISIN_BOOTSTRAP_CONFIRMED
priceState = PRICE_MATCHED
factorState in {FACTOR_OK, COMPOUND_FACTOR_OK}
v192ProvenanceState = V192_PROVENANCE_COMPLETE
approvedCorporateActionId = null
```

The extracted authorization set must contain exactly 283 unique `importId` values.

Any duplicate or predicate mismatch blocks V1.11.

---

## 7. Authorization Fingerprints

V1.11 stores two independent deterministic fingerprints.

### 7.1 Authorization-ID Fingerprint

Canonical input:

```text
sorted decimal importId values, one per line
```

SHA-256 over that canonical text.

Purpose: prove the authorized identity set is unchanged.

### 7.2 Business-State Fingerprint

Canonical row:

```text
importId|exchange|symbol|resolvedSymbol|actionType|exDate|factor
```

Rows:

- normalized deterministically;
- sorted by `importId`;
- line-delimited;
- UTF-8;
- canonical numeric factor formatting.

SHA-256 over the complete canonical text.

Purpose: detect relevant business-state changes even when the import ID remains unchanged.

---

## 8. Read-Only Preflight

The application must be closed.

V1.11 creates a private SQLite-family snapshot and performs all analysis against the private snapshot using:

- SQLite `mode=ro`;
- `PRAGMA query_only = ON`.

The live DB/WAL/SHM are used only for:

1. pre-hash;
2. quiescence proof;
3. snapshot capture;
4. post-hash.

### 8.1 Required Preflight Results

```text
Authorized V1.10 IDs:                         283
Current authorized rows found:                283
Currently approved:                             0
Current review_status = PENDING:              283
Current identity acceptable:                  283
Current price state = PRICE_MATCHED:          283
Current factor state acceptable:              283
Current V1.9.2 provenance complete:           283
Current readiness = READY_TO_APPROVE:         283

Current READY rows outside authorization:       0
Missing authorized IDs:                         0
Authorized rows no longer READY:                0
Changed business-state rows:                    0
Integrity anomalies:                            0
```

The live SQLite family must remain unchanged during the preflight.

Only then:

```text
V1.11 PREFLIGHT PASS
APPROVAL AUTHORIZED FOR EXACTLY 283 IMPORTS
```

---

## 9. Preflight Fail-Closed Conditions

Approval is blocked if any of these occur:

```text
282 READY
284 READY
283 READY but one different import ID
one authorized row already approved
one authorized row missing
one authorized row no longer PENDING
one authorized row no longer identity acceptable
one authorized row price state no longer MATCHED
one authorized row factor/compound context changed
one authorized row V1.9.2 provenance no longer complete
one authorized row business attributes changed
one new READY row appears outside authorization
live DB/WAL/SHM changes during preflight
V1.10 report hash or manifest mismatch
```

Failure message:

```text
V1.11 APPROVAL BLOCKED — CURRENT READY SET DIFFERS FROM APPROVED V1.10 MANIFEST
```

No backup-for-write-window or UI approval authorization is issued after such a failure.

---

## 10. Pre-Approval Backup Gate

After preflight PASS and before the application is reopened, V1.11 creates:

```text
tmp\
  corporate-action-v1-11-preapproval-backup_<timestamp>\
```

The backup includes the complete current SQLite family:

```text
market-data.sqlite3
market-data.sqlite3-wal   if present
market-data.sqlite3-shm   if present
```

The application remains closed while this backup is created.

Required backup proof:

```text
Source DB family quiescent: PASS
Backup created: PASS
Backup SHA-256 verified: PASS
Authorization-ID fingerprint recorded: PASS
Business-state fingerprint recorded: PASS
V1.10 manifest SHA-256 recorded: PASS
V1.11 preflight manifest SHA-256 recorded: PASS
```

The backup is a recovery checkpoint, not an automatic rollback instruction.

---

## 11. Production Approval Window

After preflight and backup PASS, the operator may open the production application.

The only authorized write workflow is:

```text
Corporate Actions / Official Imports
        ↓
Validate Split/Bonus
        ↓
Confirm READY count = 283
        ↓
Approve All Ready
```

The UI display becomes the final operator checkpoint.

If the UI does not show exactly 283 READY rows, stop.

Expected internal batching:

```text
Batch 1: 100
Batch 2: 100
Batch 3: 83
```

The operator clicks **Approve All Ready once** and allows the existing production flow to finish.

The acceptance criterion is not the button label or toast alone; it is the later persisted-state reconciliation.

---

## 12. Operator Instructions After Preflight

The package should print:

```text
V1.11 WRITE WINDOW AUTHORIZED.

1. Open EOD Charting Platform.
2. Open Corporate Actions / Official Imports.
3. Run Validate Split/Bonus.
4. Confirm READY TO APPROVE count is exactly 283.
5. Click Approve All Ready once.
6. Allow all batches to finish.
7. Record the application's completion/error message.
8. Close EOD Charting Platform.
9. Run V1.11 Post-Approval Audit.

Do not Quick Resolve.
Do not manually approve another category.
Do not override price/factor/identity review.
Do not retry a failed batch blindly.
```

---

## 13. Partial Commit Policy

If one or more production approval batches commit and a later batch fails:

- do not automatically restore the database;
- do not blindly click Approve All Ready again;
- close the application;
- run the V1.11 post-approval audit;
- measure exact persisted approved/unapproved IDs;
- decide recovery from actual committed state.

This preserves the same commit-versus-reporting distinction used in prior governed Corporate Actions work.

---

## 14. Post-Approval Audit

After the production approval attempt, the application must be closed.

The post-audit again uses a private snapshot with:

- `mode=ro`;
- `PRAGMA query_only = ON`;
- live DB/WAL/SHM pre/post immutability proof.

### 14.1 Authorized-Set Reconciliation

For all 283 authorized IDs, verify:

```text
import exists
approvedCorporateActionId != null
workflow state is approval-consistent
required approval linkage/decision exists
no duplicate approval contradiction
```

Required full-success result:

```text
Authorized IDs checked:          283
Authorized now approved:         283
Authorized still unapproved:       0
Missing authorized imports:        0
Approval linkage anomalies:        0
```

### 14.2 Unexpected Extra Approval Detection

The post-audit must compare the complete non-authorized population with the preflight snapshot.

Any newly approved import outside the authorized 283 set is an error:

```text
UNEXPECTED_EXTRA_APPROVAL
```

This is required even if all 283 authorized rows succeeded.

---

## 15. Global Split/Bonus Post-State

After successful approval of the 283 authorized rows, the expected current Split/Bonus state is:

```text
Total Split/Bonus:             1433
Approved:                      1315
Unapproved:                     118
READY_TO_APPROVE:                 0
Blocked identity:               111
Blocked parse/factor:             4
Manual price review:              3
```

These are **acceptance expectations**, not values the post-audit may force.

Actual measured state wins.

Any difference is surfaced explicitly.

---

## 16. Post-Audit Outcome Classification

The post-audit must emit exactly one primary outcome:

```text
FULL_SUCCESS
PARTIAL_APPROVAL
ZERO_APPROVAL
UNEXPECTED_EXTRA_APPROVAL
AUTHORIZED_ROW_CHANGED
APPROVAL_LINK_ANOMALY
GLOBAL_RESIDUAL_MISMATCH
LIVE_DATABASE_CHANGED_DURING_AUDIT
```

### 16.1 FULL_SUCCESS

```text
authorized approved = 283
authorized remaining = 0
unexpected extra approvals = 0
approval anomalies = 0
global residuals match measured expected state
```

### 16.2 PARTIAL_APPROVAL

Example:

```text
authorized approved = 200
authorized remaining = 83
```

Instruction:

```text
PARTIAL_APPROVAL — DO NOT RETRY AUTOMATICALLY
```

### 16.3 ZERO_APPROVAL

No authorized row was approved.

### 16.4 UNEXPECTED_EXTRA_APPROVAL

One or more rows outside the 283 authorization set were newly approved.

### 16.5 AUTHORIZED_ROW_CHANGED

An authorized row's business identity/state changed unexpectedly between preflight and post-audit.

### 16.6 APPROVAL_LINK_ANOMALY

The row appears approved but required approval linkage/state is contradictory or incomplete.

### 16.7 GLOBAL_RESIDUAL_MISMATCH

The exact 283 may have succeeded, but the complete Split/Bonus current-state residual does not reconcile to measured expectations.

---

## 17. Required V1.11 Outputs

### 17.1 Preflight

```text
v1-11-authorized-ready-set.csv
v1-11-preflight-summary.txt
v1-11-preflight-manifest.json
```

The preflight manifest records:

- V1.10 report/manifest hashes;
- exact 283 IDs;
- authorization-ID fingerprint;
- business-state fingerprint;
- current DB-family hashes;
- snapshot hashes;
- preflight classifier counts;
- zero-write declaration.

### 17.2 Backup

```text
v1-11-preapproval-backup-manifest.json
```

Records:

- source DB path;
- source DB/WAL/SHM hashes;
- backup DB/WAL/SHM hashes;
- authorization fingerprints;
- V1.10 manifest hash;
- V1.11 preflight manifest hash;
- timestamp.

### 17.3 Post-Approval

```text
v1-11-post-approval-reconciliation.csv
v1-11-post-approval-summary.txt
v1-11-post-approval-manifest.json
```

The post manifest records:

- authorized-set outcome;
- unexpected extra approvals;
- approval-link anomalies;
- global Split/Bonus current-state counts;
- live SQLite-family immutability proof;
- final outcome classification.

---

## 18. Package Boundary

V1.11 should be delivered as a standalone governance package.

Suggested package structure:

```text
EOD_Chart_Corporate_Action_Phase1_Controlled_Ready_Approval_V1_11_<timestamp>_IST/
├── Run-V1-11-Preflight.ps1
├── Run-V1-11-Post-Approval-Audit.ps1
├── README.txt
├── PACKAGE_CONTENT_SHA256.txt
├── audit/
│   ├── contracts.py
│   ├── authorized_set.py
│   ├── preflight.py
│   ├── post_audit.py
│   ├── reporting.py
│   └── tests/
├── tools/
│   ├── verify-v1-10-inputs.py
│   ├── verify-package.py
│   └── verify-reports.py
└── docs/
    └── CORPORATE_ACTION_PHASE1_CONTROLLED_READY_APPROVAL_V1_11.md
```

No production `src/**` or `src-tauri-shell/**` payload is included.

---

## 19. Test Strategy

Before delivery, deterministic tests must cover at minimum:

1. exact 283 authorization extraction;
2. duplicate authorized import ID → block;
3. one extra READY row → block;
4. one missing authorized row → block;
5. one authorized row already approved → block;
6. one authorized row no longer PENDING → block;
7. symbol change → block;
8. resolved-symbol change → block;
9. ex-date change → block;
10. factor change → block;
11. price state changed from `PRICE_MATCHED` → block;
12. compound fingerprint changed → block;
13. incomplete V1.9.2 provenance → block;
14. authorization-ID fingerprint determinism;
15. business-state fingerprint determinism;
16. backup SHA verification;
17. 283/283 approved → `FULL_SUCCESS`;
18. 200/283 approved → `PARTIAL_APPROVAL`;
19. 0/283 approved → `ZERO_APPROVAL`;
20. unexpected non-authorized approval → `UNEXPECTED_EXTRA_APPROVAL`;
21. approval-link contradiction → `APPROVAL_LINK_ANOMALY`;
22. exact expected residual 111 + 4 + 3 reconciliation;
23. live DB/WAL/SHM immutability during preflight;
24. live DB/WAL/SHM immutability during post-audit.

---

## 20. V1.11 Completion Definition

V1.11 closes only if the post-audit measures:

```text
Authorized V1.10 targets:     283
Approved successfully:        283
Remaining authorized:           0
Unexpected approvals:           0
Approval anomalies:             0

Current Split/Bonus total:    1433
Current Split/Bonus approved: 1315
Current Split/Bonus open:      118
Current READY:                   0

Identity blocked:              111
Parse/factor blocked:            4
Manual price review:             3

Outcome: FULL_SUCCESS
```

If the actual measured state differs, V1.11 remains open and the discrepancy is investigated before any retry or new write phase.

---

## 21. Decision After V1.11

After `FULL_SUCCESS`, the next Corporate Actions design phase addresses the remaining **118** unapproved Split/Bonus rows.

Recommended sequence:

```text
111 identity blockers
4 parse/factor blockers
3 manual price-review rows
```

Legacy approved-history evidence auditing and non-Split/Bonus Corporate Action types remain separate future workstreams.

V1.11 success itself authorizes no further writes.

---

## 22. Git Boundary

Git status/normalization remains explicitly deferred.

V1.11 must not be combined with Git cleanup.

The current safety/recovery controls remain:

- source snapshots;
- V1.10 report hashes;
- V1.11 authorization fingerprints;
- pre-approval SQLite-family backup;
- package SHA-256 manifests;
- read-only pre/post snapshots.

Git will be handled later as a separate governed maintenance phase.

---

## 23. Acceptance Summary

V1.11 is accepted only if it proves:

- the write authorization came from the exact valid V1.10 283-row READY set;
- the same exact 283 rows remained READY immediately before approval;
- no unrelated READY row existed;
- a verified pre-approval DB/WAL/SHM backup was captured;
- the existing production approval workflow was the only Corporate Action write path;
- every authorized row's persisted outcome was measured afterward;
- no unauthorized row was newly approved;
- the remaining Split/Bonus population was freshly reconciled;
- no automatic rollback or blind retry occurred after any partial commit;
- the live database was untouched by the V1.11 pre/post audit helpers.

Only a measured `FULL_SUCCESS` closes V1.11.
