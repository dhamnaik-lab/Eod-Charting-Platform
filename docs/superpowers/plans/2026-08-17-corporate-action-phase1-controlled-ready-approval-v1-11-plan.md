# Corporate Action Phase 1 Controlled READY Approval V1.11 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone V1.11 governance package that authorizes exactly the 283 valid V1.10 `READY_TO_APPROVE` Split/Bonus imports, proves they are still the exact current READY set, creates a verified pre-approval SQLite-family backup, delegates the only write operation to the existing production `Approve All Ready` UI, and then measures the persisted result with a read-only post-approval audit.

**Architecture:** V1.11 vendors the already-validated V1.10 read-only classifier modules as a hash-locked dependency and adds no new Corporate Action approval engine. The preflight consumes the exact valid V1.10 report set, extracts and fingerprints the 283-row authorization, reruns the same read-only classifier against a private current snapshot, and fails closed on any set/state drift. After a verified backup, the operator uses the existing UI; the post-audit compares the new persisted state against the preflight baseline and emits one deterministic outcome classification.

**Tech Stack:** PowerShell 7.6.x, Python 3 standard library (`sqlite3`, `csv`, `json`, `hashlib`, `unittest`, `pathlib`, `dataclasses`), SQLite read-only URI mode, SHA-256 manifests. The production application remains the only Corporate Action writer.

## Global Constraints

- Approved design: `docs/superpowers/specs/2026-08-17-corporate-action-phase1-controlled-ready-approval-v1-11-design.md`.
- Valid V1.10 live audit run: `tmp\corporate-action-current-state-audit_20260817_123325\reports`.
- V1.10 measured Split/Bonus total: 1,433.
- V1.10 measured already approved: 1,032.
- V1.10 measured `READY_TO_APPROVE`: exactly 283.
- V1.10 measured residual blockers: 111 identity, 4 parse/factor, 3 manual price review.
- V1.11 authorization is limited to the exact 283 V1.10 READY import IDs.
- Authorization is identity-bound and business-state-bound, not count-bound.
- All 283 authorized rows must satisfy:
  - `actionType in {SPLIT, BONUS}`;
  - `readiness = READY_TO_APPROVE`;
  - `workflowState = PENDING`;
  - `identityState = HISTORICAL_ISIN_BOOTSTRAP_CONFIRMED`;
  - `priceState = PRICE_MATCHED`;
  - `factorState in {FACTOR_OK, COMPOUND_FACTOR_OK}`;
  - `v192ProvenanceState = V192_PROVENANCE_COMPLETE`;
  - `approvedCorporateActionId = null`.
- The V1.11 helper package performs zero Corporate Action approvals.
- The V1.11 helper package performs zero Quick Resolves.
- The V1.11 helper package performs zero historical-ISIN writes.
- The V1.11 helper package performs zero identity-history writes.
- The V1.11 helper package performs zero price/factor overrides.
- The V1.11 helper package performs zero schema/raw-EOD/adjustment mutations.
- No production React/TypeScript/Rust/Tauri source is modified.
- The existing production `Approve All Ready` UI/API is the only authorized write path.
- Existing approval batching remains production-owned; expected batching for 283 is 100 + 100 + 83.
- The UI must visibly show exactly 283 READY rows immediately before the approval click.
- Do not Quick Resolve, manually approve another category, override review, or retry a failed approval batch blindly.
- Preflight and post-audit analyze private snapshots only, using SQLite `mode=ro` and `PRAGMA query_only = ON`.
- Live DB/WAL/SHM may be used by helper scripts only for discovery, hashing, snapshot/backup copy, and post-hash.
- Any live SQLite-family change during a read-only helper run invalidates that helper run.
- No automatic restore occurs after a partial production commit.
- No future residual repair is included in V1.11.
- Git status/normalization remains explicitly deferred. No Git command is permitted in this phase.
- Because Git is deferred, each implementation task ends with test evidence plus SHA-256 checkpointing instead of a commit.

---

## Locked Package Structure

Create:

```text
EOD_Chart_Corporate_Action_Phase1_Controlled_READY_Approval_V1_11_2026-08-17_1330_IST/
├── Run-V1-11-Preflight.ps1
├── Run-V1-11-Post-Approval-Audit.ps1
├── README.txt
├── PACKAGE_CONTENT_SHA256.txt
├── audit/
│   ├── __init__.py
│   ├── contracts.py
│   ├── v110/
│   │   ├── __init__.py
│   │   ├── contracts.py
│   │   ├── db.py
│   │   ├── classify.py
│   │   ├── reconcile.py
│   │   └── reporting.py
│   ├── authorized_set.py
│   ├── snapshot.py
│   ├── preflight.py
│   ├── backup.py
│   ├── post_audit.py
│   ├── reporting.py
│   └── tests/
│       ├── __init__.py
│       ├── fixture_v110_reports.py
│       ├── fixture_db.py
│       ├── test_v110_input_contract.py
│       ├── test_authorized_set.py
│       ├── test_preflight.py
│       ├── test_backup.py
│       ├── test_post_audit.py
│       ├── test_outcome_precedence.py
│       └── test_end_to_end.py
├── tools/
│   ├── verify_source_contracts.py
│   ├── verify_v110_inputs.py
│   ├── verify_package.py
│   ├── verify_preflight_reports.py
│   └── verify_post_reports.py
└── docs/
    └── CORPORATE_ACTION_PHASE1_CONTROLLED_READY_APPROVAL_V1_11.md
```

The package contains no project `src/**` or `src-tauri-shell/**` payload.

---

### Task 1: Lock V1.11 Source, Approval-Link, and V1.10 Dependency Contracts

**Files:**
- Read: `docs/superpowers/specs/2026-08-17-corporate-action-phase1-controlled-ready-approval-v1-11-design.md`
- Read: `docs/superpowers/plans/2026-08-17-corporate-action-phase1-current-state-audit-v1-10-plan.md`
- Read: current production Corporate Action approval backend/UI source
- Read: V1.10 package `audit/contracts.py`, `audit/db.py`, `audit/classify.py`, `audit/reconcile.py`, `audit/reporting.py`
- Create: `audit/contracts.py`
- Create: `tools/verify_source_contracts.py`

**Interfaces:**
- Produces `V111Contracts`.
- Produces `ApprovalLinkContract` describing the exact persisted approval linkage required after production approval.
- Produces exact SHA-256 allow-list for the vendored V1.10 read-only modules.

- [ ] **Step 1: Hash the approved V1.11 design and the exact V1.10 read-only modules**

Record SHA-256 for:

```text
docs/superpowers/specs/2026-08-17-corporate-action-phase1-controlled-ready-approval-v1-11-design.md
V1.10/audit/contracts.py
V1.10/audit/db.py
V1.10/audit/classify.py
V1.10/audit/reconcile.py
V1.10/audit/reporting.py
```

The implementation must fail if a vendored V1.10 module differs from the validated source copied into V1.11.

- [ ] **Step 2: Extract exact production approval linkage**

Inspect the current ordinary Split/Bonus approval path and record:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class ApprovalLinkContract:
    import_table: str
    import_id_column: str
    approved_id_column: str
    approved_target_table: str
    approved_target_id_column: str
    approved_review_statuses: frozenset[str]
    decision_table: str | None
    decision_import_id_column: str | None
    required_decision_types: frozenset[str]
```

Populate only from current source/schema evidence.

If production approval does not create a decision record, set `decision_table=None` and do not invent one.

- [ ] **Step 3: Verify existing production batching/Approve-All contract**

The verifier must prove current source still contains the accepted ordinary approval path and the `<=100` batch behavior used by `Approve All Ready`.

If that contract cannot be proven, stop with:

```text
V1.11 DESIGN STOP — EXISTING PRODUCTION APPROVAL CONTRACT DRIFTED.
```

- [ ] **Step 4: Define V1.11 constants**

Create:

```python
V111_VERSION = "V1.11"
V111_FORMAT = "corporate-action-controlled-ready-approval-v1"
AUTHORIZED_COUNT = 283
EXPECTED_SPLIT_BONUS_TOTAL = 1433
EXPECTED_POST_APPROVED = 1315
EXPECTED_POST_OPEN = 118
EXPECTED_POST_READY = 0
EXPECTED_POST_IDENTITY_BLOCKED = 111
EXPECTED_POST_FACTOR_BLOCKED = 4
EXPECTED_POST_MANUAL_REVIEW = 3
```

These expected values are acceptance comparisons, never values written into the database.

- [ ] **Step 5: Run source-contract verifier**

Expected:

```text
V1.11 SOURCE CONTRACT VERIFICATION PASS
V1.10 READ-ONLY DEPENDENCY HASHES PASS
PRODUCTION APPROVAL LINK CONTRACT PASS
PRODUCTION APPROVE-ALL BATCH CONTRACT PASS
```

- [ ] **Step 6: SHA checkpoint**

Write `development-checkpoint-task01.json` containing the hashes of all created package files and the current production source sentinels. No Git operation.

---

### Task 2: Vendor the Validated V1.10 Read-Only Classifier Without Semantic Changes

**Files:**
- Create: `audit/v110/__init__.py`
- Create by exact byte copy:
  - `audit/v110/contracts.py`
  - `audit/v110/db.py`
  - `audit/v110/classify.py`
  - `audit/v110/reconcile.py`
  - `audit/v110/reporting.py`
- Test: `audit/tests/test_v110_input_contract.py`

**Interfaces:**
- Produces the same read-only current-state classification behavior used by the valid V1.10 audit.
- V1.11 code may call these modules but must not modify their readiness semantics.

- [ ] **Step 1: Write the failing vendor-hash test**

```python
def test_vendored_v110_modules_match_locked_hashes(self):
    for relative_path, expected_sha in V110_VENDOR_HASHES.items():
        self.assertEqual(sha256_file(PACKAGE_ROOT / relative_path), expected_sha)
```

- [ ] **Step 2: Run RED**

Expected: FAIL because the vendored modules do not yet exist.

- [ ] **Step 3: Copy the V1.10 modules byte-for-byte**

Do not refactor imports or classifier logic. If package-relative imports require adaptation, wrap them in `audit/v110/__init__.py` or copy the same package structure rather than editing classifier semantics.

- [ ] **Step 4: Run GREEN**

Expected: all vendor-hash assertions PASS.

- [ ] **Step 5: Run the V1.10 classifier regression tests inside V1.11**

At minimum rerun the accepted cases:

```text
read-only/query_only mutation block
resolved-symbol price binding
ordinary resolved PENDING identity
unresolved exact-date identity requirement
compound fingerprint exact format
V1.9.2 complete/partial provenance
```

Expected: PASS unchanged.

- [ ] **Step 6: SHA checkpoint**

Update the task checkpoint; no Git operation.

---

### Task 3: Verify the Exact V1.10 Authoritative Report Set

**Files:**
- Create: `tools/verify_v110_inputs.py`
- Create: `audit/tests/fixture_v110_reports.py`
- Create: `audit/tests/test_v110_input_contract.py`

**Interfaces:**
- Produces `VerifiedV110ReportSet`.
- Rejects altered/incomplete/non-authoritative V1.10 inputs before any live DB access.

- [ ] **Step 1: Write a synthetic valid V1.10 report fixture**

The fixture must include all six accepted run files:

```text
corporate-action-current-state-audit-summary.txt
corporate-action-split-bonus-deep-audit.csv
corporate-action-split-bonus-deep-audit.json
corporate-action-historical-reconciliation.csv
corporate-action-all-types-health-summary.csv
audit-manifest.json
```

The synthetic manifest must use:

```json
{
  "auditVersion": "V1.10",
  "mode": "READ ONLY CURRENT-STATE AUDIT",
  "liveDatabaseFamilyUnchanged": true
}
```

and valid SHA-256 values for the five reports that V1.10 manifest binds.

- [ ] **Step 2: Write failing input-contract tests**

Tests must reject:

```text
wrong auditVersion
wrong mode
liveDatabaseFamilyUnchanged != true
report hash mismatch
missing deep CSV
missing deep JSON
CSV/JSON import-ID mismatch
READY count != 283
```

- [ ] **Step 3: Implement `verify_v110_report_set()`**

Public interface:

```python
@dataclass(frozen=True)
class VerifiedV110ReportSet:
    reports_dir: Path
    manifest: dict
    deep_rows: tuple[dict, ...]
    manifest_sha256: str
    report_sha256: dict[str, str]

def verify_v110_report_set(reports_dir: Path) -> VerifiedV110ReportSet:
    ...
```

Require the CSV and JSON to contain the same ordered unique Split/Bonus import IDs and the same authorization-relevant fields.

- [ ] **Step 4: Run GREEN**

All valid/invalid V1.10 report-contract tests PASS.

- [ ] **Step 5: Run verifier against the known live V1.10 report directory**

Default operator input:

```text
E:\TA Projects\EOD Charting Platform\tmp\corporate-action-current-state-audit_20260817_123325\reports
```

Expected:

```text
V1.10 AUTHORITATIVE REPORT SET PASS
Split/Bonus rows: 1433
READY_TO_APPROVE rows: 283
Live DB family immutability: PASS
```

No database access occurs in this task.

---

### Task 4: Extract the Exact 283 Authorization and Compute Dual Fingerprints

**Files:**
- Create: `audit/authorized_set.py`
- Create: `audit/tests/test_authorized_set.py`

**Interfaces:**
- Consumes `VerifiedV110ReportSet`.
- Produces `AuthorizedSet` with exact row identities, ID fingerprint, and business-state fingerprint.

- [ ] **Step 1: Define immutable authorization types**

```python
@dataclass(frozen=True)
class AuthorizedRow:
    import_id: int
    exchange: str
    symbol: str
    resolved_symbol: str
    action_type: str
    ex_date: str
    factor: str

@dataclass(frozen=True)
class AuthorizedSet:
    rows: tuple[AuthorizedRow, ...]
    import_ids: tuple[int, ...]
    id_fingerprint_sha256: str
    business_fingerprint_sha256: str
```

- [ ] **Step 2: Write failing exact-predicate test**

Filter only rows where:

```python
row["actionType"] in {"SPLIT", "BONUS"}
and row["readiness"] == "READY_TO_APPROVE"
and row["workflowState"] == "PENDING"
and row["identityState"] == "HISTORICAL_ISIN_BOOTSTRAP_CONFIRMED"
and row["priceState"] == "PRICE_MATCHED"
and row["factorState"] in {"FACTOR_OK", "COMPOUND_FACTOR_OK"}
and row["v192ProvenanceState"] == "V192_PROVENANCE_COMPLETE"
and row["approvedCorporateActionId"] in (None, "")
```

Require exactly 283 unique IDs.

- [ ] **Step 3: Implement canonical ID fingerprint**

Canonical bytes:

```python
("\n".join(str(i) for i in sorted(import_ids)) + "\n").encode("utf-8")
```

- [ ] **Step 4: Implement canonical business-state fingerprint**

Canonical row:

```python
f"{import_id}|{exchange}|{symbol}|{resolved_symbol}|{action_type}|{ex_date}|{factor}"
```

Normalize:
- exchange/symbol/resolved symbol/action type: trimmed uppercase;
- date: trimmed ISO string from V1.10;
- factor: decimal canonicalization without locale formatting;
- rows sorted by import ID;
- newline-terminated UTF-8.

- [ ] **Step 5: Write drift tests**

Require fingerprint change when any one of these changes while ID remains identical:

```text
symbol
resolvedSymbol
actionType
exDate
factor
```

- [ ] **Step 6: Run GREEN**

Expected: exact 283 extraction and fingerprint determinism PASS.

---

### Task 5: Implement Current Private-Snapshot Capture and Read-Only State Loading

**Files:**
- Create: `audit/snapshot.py`
- Create/update: `audit/tests/fixture_db.py`
- Create: `audit/tests/test_preflight.py`

**Interfaces:**
- PowerShell creates the private DB/WAL/SHM snapshot.
- Python opens only the private DB through vendored V1.10 `open_read_only_snapshot`.
- Produces current V1.10-style deep classification for all current Split/Bonus rows.

- [ ] **Step 1: Reuse the proven V1.10 SQLite-family state object**

PowerShell state fields:

```text
Path
Exists
Length
SHA256
```

Require two identical live-family captures separated by one second before snapshot copy.

- [ ] **Step 2: Verify private family copy hashes**

Every copied DB/WAL/SHM file must hash-identically to its source pre-state.

- [ ] **Step 3: Add a Python state-loader adapter**

Public interface:

```python
@dataclass(frozen=True)
class CurrentState:
    split_bonus_rows: tuple[dict, ...]
    all_action_health: tuple[dict, ...]
    approved_import_ids: frozenset[int]

def classify_current_snapshot(snapshot_db: Path, historical_inputs: ...) -> CurrentState:
    ...
```

Internally call the vendored V1.10 read-only schema loader/classifier; do not implement another readiness algorithm.

- [ ] **Step 4: Add read-only enforcement test**

Attempt an `INSERT` through the opened snapshot connection and require SQLite `OperationalError`.

- [ ] **Step 5: Add source DB immutability test**

Synthetic source DB SHA before/after snapshot analysis must remain identical.

---

### Task 6: Implement Exact-Set V1.11 Preflight

**Files:**
- Create: `audit/preflight.py`
- Update: `audit/tests/test_preflight.py`

**Interfaces:**
- Consumes `AuthorizedSet` and `CurrentState`.
- Produces `PreflightResult`.

- [ ] **Step 1: Define preflight result**

```python
@dataclass(frozen=True)
class PreflightResult:
    passed: bool
    authorized_count: int
    current_authorized_found: int
    current_ready_count: int
    outside_ready_ids: tuple[int, ...]
    missing_authorized_ids: tuple[int, ...]
    no_longer_ready_ids: tuple[int, ...]
    already_approved_ids: tuple[int, ...]
    changed_business_state_ids: tuple[int, ...]
    anomaly_ids: tuple[int, ...]
    current_id_fingerprint_sha256: str
    current_business_fingerprint_sha256: str
    reasons: tuple[str, ...]
```

- [ ] **Step 2: Write the exact PASS fixture**

Require:

```text
authorized IDs = 283
current authorized found = 283
current READY = 283
outside READY = 0
missing = 0
already approved = 0
changed business state = 0
anomalies = 0
```

- [ ] **Step 3: Write fail-closed tests**

Independent tests:

```text
282 current READY
284 current READY
283 count but one ID replaced
one authorized already approved
one authorized missing
one workflow no longer PENDING
one identity no longer HISTORICAL_ISIN_BOOTSTRAP_CONFIRMED
one price no longer PRICE_MATCHED
one factor state no longer acceptable
one V1.9.2 provenance incomplete
one business-state field changed
one unrelated new READY
```

Every case must set `passed=False`.

- [ ] **Step 4: Implement exact-set comparison**

Use set equality:

```python
current_ready_ids == set(authorized.import_ids)
```

Count equality alone is prohibited.

- [ ] **Step 5: Recompute business fingerprint from current rows**

The current fingerprint must equal the V1.10-authorized business fingerprint.

- [ ] **Step 6: Run GREEN**

All preflight tests PASS.

---

### Task 7: Generate Preflight Artifacts and Preserve the Complete Split/Bonus Approval Baseline

**Files:**
- Create: `audit/reporting.py`
- Create: `audit/tests/test_preflight.py`

**Interfaces:**
- Writes the three required public preflight artifacts.
- Stores complete pre-approval Split/Bonus baseline inside the manifest for later unauthorized-approval detection.

- [ ] **Step 1: Write `v1-11-authorized-ready-set.csv`**

Fixed columns:

```text
importId
exchange
symbol
resolvedSymbol
actionType
exDate
factor
```

Exactly 283 data rows, sorted by import ID.

- [ ] **Step 2: Write `v1-11-preflight-summary.txt`**

Required PASS footer:

```text
V1.11 PREFLIGHT PASS
APPROVAL AUTHORIZED FOR EXACTLY 283 IMPORTS
```

Do not print this footer unless all exact-set gates pass.

- [ ] **Step 3: Write `v1-11-preflight-manifest.json`**

Include:

```json
{
  "auditVersion": "V1.11",
  "phase": "PREFLIGHT",
  "authorizedCount": 283,
  "authorizationIdFingerprintSha256": "...",
  "businessStateFingerprintSha256": "...",
  "v110ManifestSha256": "...",
  "v110ReportSha256": {},
  "liveDatabaseFamilyPreState": [],
  "liveDatabaseFamilyPostState": [],
  "liveDatabaseFamilyUnchanged": true,
  "splitBonusBaseline": [
    {
      "importId": 1,
      "approvedCorporateActionId": null,
      "reviewStatus": "PENDING",
      "businessStateCanonical": "..."
    }
  ],
  "zeroWriteDeclaration": {
    "databaseWrites": 0,
    "approvals": 0,
    "quickResolves": 0,
    "bootstrapWrites": 0
  }
}
```

`splitBonusBaseline` must cover all 1,433 preflight Split/Bonus rows, not merely the authorized 283.

- [ ] **Step 4: Test deterministic serialization**

Fixed fixture inputs and fixed `generatedAt` must yield byte-identical artifacts across two runs.

---

### Task 8: Implement the Verified Pre-Approval SQLite-Family Backup Gate

**Files:**
- Create: `audit/backup.py`
- Create: `audit/tests/test_backup.py`
- Create/update: `Run-V1-11-Preflight.ps1`

**Interfaces:**
- Creates `tmp\corporate-action-v1-11-preapproval-backup_<timestamp>\`.
- Produces `v1-11-preapproval-backup-manifest.json`.

- [ ] **Step 1: Require preflight PASS before backup**

The backup function must accept a verified preflight manifest and reject:

```text
passed != true
liveDatabaseFamilyUnchanged != true
authorizedCount != 283
```

- [ ] **Step 2: Recheck live DB-family quiescence**

Capture the live family twice again after preflight.

Require that this new state equals the finalized preflight state. If not:

```text
V1.11 WRITE WINDOW BLOCKED — DATABASE CHANGED AFTER PREFLIGHT.
```

- [ ] **Step 3: Copy DB/WAL/SHM to the dedicated backup directory**

Copy only files that exist.

- [ ] **Step 4: Verify every backup hash**

Source and backup existence, length, and SHA-256 must match exactly.

- [ ] **Step 5: Write backup manifest**

Required fields:

```text
sourceDatabasePath
sourceDatabaseFamily
backupDatabaseFamily
authorizationIdFingerprintSha256
businessStateFingerprintSha256
v110ManifestSha256
v111PreflightManifestSha256
generatedAt
backupVerified = true
```

- [ ] **Step 6: Test corruption detection**

Modify one byte in a synthetic copied backup and require verification failure.

---

### Task 9: Build the Guarded V1.11 Preflight PowerShell Wrapper

**Files:**
- Create: `Run-V1-11-Preflight.ps1`
- Create: `tools/verify_preflight_reports.py`
- Create/update: `README.txt`

**Interfaces:**
- Operator command:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"

& ".\EOD_Chart_Corporate_Action_Phase1_Controlled_READY_Approval_V1_11_2026-08-17_1330_IST\Run-V1-11-Preflight.ps1" `
    -ProjectRoot "E:\TA Projects\EOD Charting Platform" `
    -V110ReportsDir "E:\TA Projects\EOD Charting Platform\tmp\corporate-action-current-state-audit_20260817_123325\reports" `
    -RunValidation
```

- [ ] **Step 1: Implement parameters**

```powershell
param(
    [Parameter(Mandatory=$true)][string]$ProjectRoot,
    [Parameter(Mandatory=$true)][string]$V110ReportsDir,
    [string]$DatabasePath,
    [switch]$RunValidation
)
```

- [ ] **Step 2: Require the application closed**

Use the same process/quiescence discipline as V1.10.

- [ ] **Step 3: Run in fail-closed order**

```text
verify V1.11 source contract
verify vendored V1.10 hashes
verify V1.10 report set
extract exact 283 authorization
run synthetic tests if -RunValidation
hash live DB family twice
copy private snapshot
run current read-only V1.10 classifier
run exact-set V1.11 preflight
rehash live family
finalize preflight manifest
verify preflight reports
recheck live family
create verified pre-approval backup
```

- [ ] **Step 4: Print approval instructions only after backup PASS**

Exact operator block:

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

- [ ] **Step 5: Never auto-launch the application**

V1.11 must not programmatically open the UI or click the approval button.

---

### Task 10: Implement Post-Approval Authorized-Set and Unexpected-Approval Reconciliation

**Files:**
- Create: `audit/post_audit.py`
- Create: `audit/tests/test_post_audit.py`

**Interfaces:**
- Consumes the signed-by-hash preflight/backup manifests and a fresh current `CurrentState`.
- Produces `PostAuditResult`.

- [ ] **Step 1: Define result fields**

```python
@dataclass(frozen=True)
class PostAuditResult:
    authorized_checked: int
    authorized_approved_ids: tuple[int, ...]
    authorized_unapproved_ids: tuple[int, ...]
    missing_authorized_ids: tuple[int, ...]
    changed_authorized_ids: tuple[int, ...]
    approval_link_anomaly_ids: tuple[int, ...]
    unexpected_extra_approved_ids: tuple[int, ...]
    current_split_bonus_total: int
    current_approved_count: int
    current_open_count: int
    current_ready_count: int
    current_identity_blocked: int
    current_factor_blocked: int
    current_manual_review: int
```

- [ ] **Step 2: Detect authorized persisted success**

Each authorized row must:

```text
exist
approvedCorporateActionId != null
workflow classification be approval-consistent
match the locked business-state fingerprint fields
satisfy ApprovalLinkContract
```

- [ ] **Step 3: Detect unexpected extra approvals from the full preflight baseline**

For every non-authorized Split/Bonus import:

```python
pre_approved = baseline_row["approvedCorporateActionId"] is not None
post_approved = current_row["approvedCorporateActionId"] is not None
```

If `pre_approved` is false and `post_approved` is true, add the ID to `unexpected_extra_approved_ids`.

This comparison must cover all preflight Split/Bonus rows.

- [ ] **Step 4: Detect changed authorized business state**

Recompute the 283-row business-state fingerprint after approval. Approval/status fields are excluded from this fingerprint.

If it differs, identify exact changed authorized IDs.

- [ ] **Step 5: Compute global current residuals using the vendored V1.10 classifier**

Measure actual:

```text
total
approved
open
READY
blocked identity
blocked parse/factor
manual price review
```

Do not substitute expected values.

---

### Task 11: Implement Deterministic Post-Outcome Classification and Precedence

**Files:**
- Update: `audit/post_audit.py`
- Create: `audit/tests/test_outcome_precedence.py`

**Interfaces:**
- Produces exactly one primary `PostOutcome`.

- [ ] **Step 1: Define outcomes**

```python
class PostOutcome(StrEnum):
    FULL_SUCCESS = "FULL_SUCCESS"
    PARTIAL_APPROVAL = "PARTIAL_APPROVAL"
    ZERO_APPROVAL = "ZERO_APPROVAL"
    UNEXPECTED_EXTRA_APPROVAL = "UNEXPECTED_EXTRA_APPROVAL"
    AUTHORIZED_ROW_CHANGED = "AUTHORIZED_ROW_CHANGED"
    APPROVAL_LINK_ANOMALY = "APPROVAL_LINK_ANOMALY"
    GLOBAL_RESIDUAL_MISMATCH = "GLOBAL_RESIDUAL_MISMATCH"
    LIVE_DATABASE_CHANGED_DURING_AUDIT = "LIVE_DATABASE_CHANGED_DURING_AUDIT"
```

- [ ] **Step 2: Lock precedence**

Use this precedence, highest severity first:

```text
LIVE_DATABASE_CHANGED_DURING_AUDIT
UNEXPECTED_EXTRA_APPROVAL
APPROVAL_LINK_ANOMALY
AUTHORIZED_ROW_CHANGED
ZERO_APPROVAL
PARTIAL_APPROVAL
GLOBAL_RESIDUAL_MISMATCH
FULL_SUCCESS
```

- [ ] **Step 3: Define count rules**

```python
if authorized_approved == 0:
    ZERO_APPROVAL
elif 0 < authorized_approved < 283:
    PARTIAL_APPROVAL
elif authorized_approved == 283:
    evaluate residual match, otherwise FULL_SUCCESS
```

Higher-precedence anomalies override count outcomes.

- [ ] **Step 4: Write precedence collision tests**

Examples:

```text
200 approved + 1 unexpected extra => UNEXPECTED_EXTRA_APPROVAL
283 approved + approval link anomaly => APPROVAL_LINK_ANOMALY
283 approved + changed business row => AUTHORIZED_ROW_CHANGED
283 approved + residual mismatch => GLOBAL_RESIDUAL_MISMATCH
283 approved + exact 1315/118/0/111/4/3 => FULL_SUCCESS
```

- [ ] **Step 5: Run GREEN**

All outcome/precedence tests PASS.

---

### Task 12: Generate and Verify Post-Approval Reports

**Files:**
- Update: `audit/reporting.py`
- Create: `tools/verify_post_reports.py`
- Update: `audit/tests/test_post_audit.py`

**Interfaces:**
- Writes exactly the three required public post artifacts.

- [ ] **Step 1: Write `v1-11-post-approval-reconciliation.csv`**

Fixed columns:

```text
importId
authorized
preApprovedCorporateActionId
postApprovedCorporateActionId
preReviewStatus
postReviewStatus
businessStateChanged
approvalLinkValid
result
reason
```

Include all 283 authorized IDs and any unexpected extra newly-approved IDs.

- [ ] **Step 2: Write `v1-11-post-approval-summary.txt`**

For `FULL_SUCCESS`, require:

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

- [ ] **Step 3: Write `v1-11-post-approval-manifest.json`**

Include:
- preflight manifest SHA-256;
- backup manifest SHA-256;
- V1.10 manifest SHA-256;
- authorized fingerprints;
- fresh snapshot hashes;
- live DB-family pre/post hashes;
- exact current measured counts;
- anomaly ID arrays;
- primary outcome;
- zero-write declaration for the post-audit helper.

- [ ] **Step 4: Verify deterministic report hashes**

Manifest records hashes for summary/reconciliation. The manifest does not self-hash recursively; wrapper prints its SHA separately.

---

### Task 13: Build the Guarded Post-Approval PowerShell Wrapper

**Files:**
- Create: `Run-V1-11-Post-Approval-Audit.ps1`
- Update: `README.txt`

**Interfaces:**
- Operator command uses the exact successful V1.11 preflight run directory.

- [ ] **Step 1: Implement parameters**

```powershell
param(
    [Parameter(Mandatory=$true)][string]$ProjectRoot,
    [Parameter(Mandatory=$true)][string]$PreflightRunDir,
    [string]$DatabasePath,
    [switch]$RunValidation
)
```

- [ ] **Step 2: Require application closed**

Do not post-audit while the production application is active.

- [ ] **Step 3: Verify preflight and backup lineage**

Before touching the live DB family for snapshot capture:

```text
preflight manifest exists and PASS
preflight manifest SHA matches backup manifest
backupVerified = true
authorization fingerprints agree
V1.10 manifest SHA agrees
```

- [ ] **Step 4: Capture fresh private post snapshot**

Use double-hash quiescence, private family copy, and copy-hash verification.

- [ ] **Step 5: Run read-only post reconciliation**

All analytical SQL targets the private post snapshot only.

- [ ] **Step 6: Rehash live family regardless of post-audit success/failure**

If changed:

```text
Outcome: LIVE_DATABASE_CHANGED_DURING_AUDIT
POST-AUDIT INVALID
```

Do not claim any other outcome authoritative.

- [ ] **Step 7: Print explicit retry policy**

For `PARTIAL_APPROVAL`:

```text
PARTIAL_APPROVAL — DO NOT RETRY AUTOMATICALLY
Send the post-approval reports for exact persisted-state review.
```

For any non-`FULL_SUCCESS` result, no new approval click is authorized.

---

### Task 14: Static No-Write and Package-Content Verification

**Files:**
- Create: `tools/verify_package.py`
- Create/update: `PACKAGE_CONTENT_SHA256.txt`

**Interfaces:**
- Proves V1.11 helpers contain no production write path.

- [ ] **Step 1: Reject mutating SQL in executable Python**

Forbidden executable SQL keywords:

```text
INSERT
UPDATE
DELETE
REPLACE
CREATE TABLE
ALTER TABLE
DROP TABLE
VACUUM
ATTACH
DETACH
```

The vendored V1.10 modules must already satisfy the same no-write contract.

- [ ] **Step 2: Reject application-control/write commands in wrappers**

Reject executable commands that:
- invoke a Corporate Action approval backend directly;
- invoke Quick Resolve;
- invoke historical-ISIN apply;
- execute external SQLite mutation;
- launch/click/control the production application;
- invoke Git.

- [ ] **Step 3: Enforce package allow-list**

Reject:
- `.git`;
- `__pycache__`;
- `.pyc`;
- `.sqlite`, `.sqlite3`, `.db`;
- generated live reports;
- production `src` or `src-tauri-shell` payload.

- [ ] **Step 4: Generate `PACKAGE_CONTENT_SHA256.txt`**

Hash every package file except the hash manifest itself.

- [ ] **Step 5: Extract ZIP to a clean temp directory and verify**

Expected:

```text
V1.11 PACKAGE CONTRACT PASS
NO WRITE-CAPABLE HELPER PATH FOUND
V1.10 VENDORED AUDIT HASHES PASS
```

---

### Task 15: Run the Complete Synthetic Pre-Live Verification Gate

**Files:**
- All package tests.

**Interfaces:**
- No live user DB access.

- [ ] **Step 1: Run full unit suite**

```powershell
python -m unittest discover -s audit\tests -p "test_*.py" -v
```

Expected: all PASS.

- [ ] **Step 2: Run exact 283 authorization end-to-end fixture**

Synthetic flow:

```text
valid V1.10 reports
→ exact 283 extraction
→ matching current snapshot
→ PREFLIGHT PASS
→ verified backup
```

Expected: PASS.

- [ ] **Step 3: Run drift fixtures**

At minimum:
- one extra READY;
- one missing authorized;
- one price drift;
- one factor drift;
- one business-state drift;
- one incomplete V1.9.2 provenance.

Expected: every preflight BLOCKS.

- [ ] **Step 4: Run post-audit fixtures**

Required:
- 283/283 exact success;
- 200/283 partial;
- 0/283;
- 283 + one unauthorized extra;
- 283 + approval-link anomaly;
- 283 + residual mismatch.

Expected outcomes exactly match Task 11.

- [ ] **Step 5: Verify synthetic source DB hashes unchanged by pre/post helpers**

Both read-only helper phases must leave source SQLite files byte-identical.

---

### Task 16: Execute the Live V1.11 Preflight and Open the Manual Approval Window

**Files:**
- Read: valid V1.10 report set.
- Read/hash/snapshot: live SQLite family.
- Write: V1.11 preflight reports and verified backup only.

**Interfaces:**
- No Corporate Action writes occur in this task.

- [ ] **Step 1: Close EOD Charting Platform**

Confirm the process is not active.

- [ ] **Step 2: Run `Run-V1-11-Preflight.ps1 -RunValidation`**

Expected terminal gate:

```text
V1.11 PREFLIGHT PASS
APPROVAL AUTHORIZED FOR EXACTLY 283 IMPORTS

Source DB family quiescent: PASS
Backup created: PASS
Backup SHA-256 verified: PASS

V1.11 WRITE WINDOW AUTHORIZED
```

- [ ] **Step 3: Stop if any value differs**

Do not open the application for approval unless the exact 283 gate passes.

- [ ] **Step 4: Open production application manually**

Navigate:

```text
Corporate Actions / Official Imports
→ Validate Split/Bonus
```

- [ ] **Step 5: Verify human-visible READY count**

Must show exactly:

```text
283
```

If not, close the application and return to read-only investigation.

- [ ] **Step 6: Click `Approve All Ready` once**

Allow the production UI/backend to complete its own batching.

- [ ] **Step 7: Record the UI result**

Record exact completion/error text. Do not retry on failure.

- [ ] **Step 8: Close the production application**

Only then proceed to post-audit.

---

### Task 17: Execute the Live V1.11 Post-Approval Audit

**Files:**
- Read: preflight/backup manifests.
- Read/hash/snapshot: current live SQLite family.
- Write: post-audit reports only.

**Interfaces:**
- No Corporate Action writes occur.

- [ ] **Step 1: Run the post wrapper**

```powershell
& ".\EOD_Chart_Corporate_Action_Phase1_Controlled_READY_Approval_V1_11_2026-08-17_1330_IST\Run-V1-11-Post-Approval-Audit.ps1" `
    -ProjectRoot "E:\TA Projects\EOD Charting Platform" `
    -PreflightRunDir "<exact successful V1.11 preflight run directory>" `
    -RunValidation
```

- [ ] **Step 2: Require persisted-state reconciliation**

Expected ideal result:

```text
Authorized approved: 283
Authorized remaining: 0
Unexpected extra approvals: 0
Approval-link anomalies: 0
```

- [ ] **Step 3: Require global residual reconciliation**

Expected ideal measured state:

```text
Split/Bonus total: 1433
Approved: 1315
Open: 118
READY: 0
Identity blocked: 111
Parse/factor blocked: 4
Manual price review: 3
```

- [ ] **Step 4: Accept closure only on**

```text
Outcome: FULL_SUCCESS
```

Any other outcome leaves V1.11 open.

---

### Task 18: Review V1.11 Results Before Designing the 118-Row Residual Phase

**Files:**
- Read:
  - `v1-11-authorized-ready-set.csv`
  - `v1-11-preflight-summary.txt`
  - `v1-11-preflight-manifest.json`
  - `v1-11-preapproval-backup-manifest.json`
  - `v1-11-post-approval-reconciliation.csv`
  - `v1-11-post-approval-summary.txt`
  - `v1-11-post-approval-manifest.json`

**Interfaces:**
- Produces factual evidence for a new design session only.

- [ ] **Step 1: Verify all report/manifest hashes**

No stale or mixed pre/post run directories.

- [ ] **Step 2: Confirm final primary outcome**

Only `FULL_SUCCESS` closes V1.11.

- [ ] **Step 3: Confirm no unauthorized write**

`unexpected_extra_approved_ids` must be empty.

- [ ] **Step 4: Confirm remaining measured population**

Expected:

```text
111 identity blockers
4 parse/factor blockers
3 manual price-review rows
```

- [ ] **Step 5: Begin a new design phase for the 118 residual rows**

Do not combine it with V1.11 implementation or approval.

---

## Self-Review Checklist

- [ ] Every approved V1.11 design requirement maps to a task.
- [ ] The exact valid V1.10 report set is hash-verified before authorization extraction.
- [ ] V1.10 readiness semantics are vendored/hash-locked rather than reimplemented.
- [ ] The exact authorization predicate is preserved.
- [ ] Exactly 283 unique IDs are required.
- [ ] ID and business-state fingerprints are independent and deterministic.
- [ ] Count equality alone can never authorize approval.
- [ ] Current READY set must equal the exact authorized ID set.
- [ ] No unrelated READY row is allowed.
- [ ] Preflight stores a complete 1,433-row Split/Bonus approval baseline.
- [ ] Verified DB/WAL/SHM backup occurs after preflight and before the UI write window.
- [ ] The production UI is the only approval writer.
- [ ] The helper package cannot launch/click/control the production application.
- [ ] `Approve All Ready` is clicked only once.
- [ ] Failed/partial production commit is never auto-restored or blindly retried.
- [ ] Post-audit detects unauthorized extra approvals across the full baseline.
- [ ] Approval-link semantics are extracted from production source, not invented.
- [ ] Post-outcome precedence is deterministic.
- [ ] `FULL_SUCCESS` requires exact 283/283 success and the measured 1315/118/0/111/4/3 residual state.
- [ ] Actual measured post-state wins over expected values.
- [ ] Pre/post helpers use private read-only snapshots only.
- [ ] Live DB/WAL/SHM immutability is proven for both helper runs.
- [ ] No production source edits are included.
- [ ] No Git command is included.
- [ ] No unresolved placeholder text remains.
- [ ] V1.11 success authorizes no residual repair automatically.

## Execution Handoff

Recommended execution mode: **Inline Execution**.

Reason: V1.11 has a deliberate human write boundary in the middle. The package should first be implemented and verified through the preflight/backup gate, then execution must stop for the operator's one-time production UI approval, then resume with the post-audit. Keeping this in one controlled conversation makes partial-commit handling and persisted-state review explicit.

Because Git remains explicitly deferred, task checkpoints use deterministic tests and SHA-256 manifests instead of commits.
