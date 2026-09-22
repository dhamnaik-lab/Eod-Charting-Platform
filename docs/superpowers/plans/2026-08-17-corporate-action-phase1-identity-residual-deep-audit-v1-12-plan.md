# Corporate Action Phase 1 Identity Residual Deep Audit V1.12 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-pass, zero-write V1.12 audit that locks the exact 111 V1.11 identity residuals, exhausts deterministic local identity evidence first, emits targeted official-evidence requests for unresolved rows, then consumes a hash-bound external evidence bundle to classify every row as safely repairable or explicitly unresolved.

**Architecture:** Pass 1 reuses the proven V1.10/V1.11 read-only SQLite snapshot discipline and identity semantics, then builds a local identity-evidence graph over the exact 111-row population. Pass 2 performs no network access; it consumes only normalized, hash-verified official evidence artifacts and produces the final deterministic V1.12 classification. External collection itself remains a separate evidence-acquisition activity driven by Pass 1 requests, avoiding a fragile or opaque in-package web scraper.

**Tech Stack:** PowerShell 7.6.x; Python 3 standard library (`sqlite3`, `csv`, `json`, `hashlib`, `urllib.parse`, `dataclasses`, `enum`, `decimal`, `unittest`, `pathlib`); SQLite read-only URI mode; SHA-256 evidence/report manifests. No new runtime dependency and no production application source change.

## Global Constraints

- Approved design: `docs/superpowers/specs/2026-08-17-corporate-action-phase1-identity-residual-deep-audit-v1-12-design.md`.
- Accepted V1.11 post-audit manifest SHA-256: `01c1212cad69c642a4a432f4a6753142dab2b6f45590663d167d8bc5a87c7ebb`.
- Accepted internal V1.10 manifest SHA-256: `99fd1474bb2a8a266bf57fa109c23481fd0ab53db217d29a78aec34af8c28c7a`.
- Accepted V1.11 outcome: `FULL_SUCCESS`.
- Accepted Split/Bonus total: `1433`.
- Accepted approved Split/Bonus: `1315`.
- Accepted open Split/Bonus: `118`.
- Accepted `READY_TO_APPROVE`: `0`.
- Accepted identity blockers: `111`.
- Accepted parse/factor blockers: `4`; they are out of V1.12 scope.
- Accepted manual price-review rows: `3`; they are out of V1.12 scope.
- Exact starting identity cohorts:
  - `NO_CANDIDATE = 56`;
  - `MISSING_EVENT_DATE_EVIDENCE = 37`;
  - `CONFLICTING_ISIN_HISTORY = 9`;
  - `COMPANY_IDENTITY_MISMATCH = 9`.
- Exact 111-row authorization-ID fingerprint: `8a42afa94287f2c80531020d6df80030229f647f86d3419a55ab94d8d5272bef`.
- Exact 111-row business fingerprint: `2e53917f05386379e4fb034f8a2e7a814bd4bca33ec6fa84e44668bb52482b72`.
- Business fingerprint canonical fields, in order:
  `importId|exchange|symbol|resolvedSymbol|actionType|exDate|historicalIsin|companyName|currentIdentityClassification`.
- String normalization for fingerprinting:
  `exchange`, `symbol`, `resolvedSymbol`, `actionType`, `historicalIsin`, `currentIdentityClassification` are trimmed uppercase; `companyName` is trimmed but case-preserved; `exDate` is trimmed ISO text; rows sort by integer `importId`; UTF-8 payload is newline-terminated.
- V1.12 is read-only with respect to the application database.
- Corporate Action writes: `0`.
- identity/history writes: `0`.
- Quick Resolves: `0`.
- approvals: `0`.
- price/factor writes: `0`.
- schema writes: `0`.
- raw EOD writes: `0`.
- Git operations: `0`.
- All analytical SQL runs only against a private snapshot opened with SQLite `mode=ro` and `PRAGMA query_only=ON`.
- Live DB/WAL/SHM may only be discovered, hashed, and copied by the PowerShell wrapper.
- Live DB/WAL/SHM must be byte-identical before and after each V1.12 local/final audit run.
- Pass 1 may produce `EXTERNAL_EVIDENCE_REQUIRED`; this is not an audit failure.
- Pass 2 final classifier performs no network access.
- Commercial market-data sites, blogs, forums, generic finance portals, and search snippets cannot independently yield `SAFE_*`.
- Only evidence Grade `A` or `B` may yield a `SAFE_*` result.
- Company-name similarity alone cannot yield `SAFE_*`.
- Current-symbol equality alone cannot yield `SAFE_*`.
- A failed external lookup remains an unresolved row, not an audit failure.
- V1.12 success authorizes no write automatically.
- A future V1.13 may consume only exact V1.12 `SAFE_*` rows through a new separately approved write design.
- No production React/TypeScript/Rust/Tauri source payload is included in the V1.12 package.
- Because Git is deferred, task completion uses test evidence and SHA-256 checkpoints rather than commits.

---

## Locked Package Structure

Create one standalone package:

```text
EOD_Chart_Corporate_Action_Phase1_Identity_Residual_Deep_Audit_V1_12_<timestamp>_IST/
├── Run-V1-12-Pass1-Local-Audit.ps1
├── Run-V1-12-Final-Identity-Audit.ps1
├── README.txt
├── PACKAGE_CONTENT_SHA256.txt
├── audit/
│   ├── __init__.py
│   ├── contracts.py
│   ├── util.py
│   ├── authority.py
│   ├── snapshot.py
│   ├── residuals.py
│   ├── local_evidence.py
│   ├── identity_graph.py
│   ├── local_classifier.py
│   ├── external_requests.py
│   ├── evidence_contracts.py
│   ├── evidence_bundle.py
│   ├── final_classifier.py
│   ├── reporting.py
│   ├── cli.py
│   ├── v110/
│   │   ├── __init__.py
│   │   ├── contracts.py
│   │   ├── db.py
│   │   ├── classify.py
│   │   ├── reconcile.py
│   │   ├── reporting.py
│   │   └── run_audit.py
│   └── tests/
│       ├── __init__.py
│       ├── fixture_v111.py
│       ├── fixture_identity_db.py
│       ├── fixture_evidence.py
│       ├── test_authority.py
│       ├── test_residuals.py
│       ├── test_identity_graph.py
│       ├── test_local_classifier.py
│       ├── test_external_requests.py
│       ├── test_evidence_bundle.py
│       ├── test_final_classifier.py
│       ├── test_reporting.py
│       ├── test_read_only.py
│       └── test_end_to_end.py
├── schemas/
│   ├── v1-12-external-evidence-item.schema.json
│   └── v1-12-external-evidence-catalog.schema.json
├── evidence-template/
│   ├── README.txt
│   ├── evidence-catalog.json
│   └── artifacts/
│       └── .keep
├── tools/
│   ├── verify_source_contracts.py
│   ├── verify_v111_authority.py
│   ├── verify_evidence_bundle.py
│   ├── verify_pass1_reports.py
│   ├── verify_final_reports.py
│   └── verify_package.py
└── docs/
    ├── superpowers/
    │   ├── specs/
    │   │   └── 2026-08-17-corporate-action-phase1-identity-residual-deep-audit-v1-12-design.md
    │   └── plans/
    │       └── 2026-08-17-corporate-action-phase1-identity-residual-deep-audit-v1-12-plan.md
    └── changes/
        └── 2026-08-17_CORPORATE_ACTION_PHASE1_IDENTITY_RESIDUAL_DEEP_AUDIT_V1_12.md
```

The package must not contain a live database, a prior snapshot, generated user reports, or downloaded external evidence.

---

### Task 1: Lock V1.12 Authority, Existing Source Contracts, and Vendored Read-Only Dependencies

**Files:**
- Read: accepted V1.11 post-audit ZIP/reports.
- Read: current production Corporate Action/identity schema and source.
- Read: V1.10/V1.11 read-only classifier package.
- Create: `audit/contracts.py`
- Create: `audit/authority.py`
- Create: `tools/verify_source_contracts.py`
- Test: `audit/tests/test_authority.py`

**Interfaces:**
- Produces `V112Authority`.
- Produces an exact hash allow-list for vendored V1.10 classifier modules.
- Produces current-source sentinels proving the identity tables/columns consumed by V1.12 still mean what the audit expects.

- [ ] **Step 1: Write the failing accepted-authority test**

```python
def test_v111_post_manifest_must_be_exact_accepted_authority(self):
    authority = verify_v111_authority(self.accepted_reports)
    self.assertEqual(
        authority.manifest_sha256,
        "01c1212cad69c642a4a432f4a6753142dab2b6f45590663d167d8bc5a87c7ebb",
    )
    self.assertEqual(authority.outcome, "FULL_SUCCESS")
    self.assertEqual(authority.current_counts["identityBlocked"], 111)
```

- [ ] **Step 2: Run RED**

Expected failure: V1.12 authority verifier does not exist.

- [ ] **Step 3: Implement immutable authority constants**

```python
V112_VERSION = "V1.12"
V112_FORMAT = "corporate-action-identity-residual-deep-audit-v1"

ACCEPTED_V111_POST_MANIFEST_SHA256 = (
    "01c1212cad69c642a4a432f4a6753142dab2b6f45590663d167d8bc5a87c7ebb"
)
ACCEPTED_V110_MANIFEST_SHA256 = (
    "99fd1474bb2a8a266bf57fa109c23481fd0ab53db217d29a78aec34af8c28c7a"
)
AUTHORIZED_ID_FINGERPRINT_SHA256 = (
    "8a42afa94287f2c80531020d6df80030229f647f86d3419a55ab94d8d5272bef"
)
AUTHORIZED_BUSINESS_FINGERPRINT_SHA256 = (
    "2e53917f05386379e4fb034f8a2e7a814bd4bca33ec6fa84e44668bb52482b72"
)
AUTHORIZED_COUNT = 111

EXPECTED_COHORTS = {
    "NO_CANDIDATE": 56,
    "MISSING_EVENT_DATE_EVIDENCE": 37,
    "CONFLICTING_ISIN_HISTORY": 9,
    "COMPANY_IDENTITY_MISMATCH": 9,
}
```

- [ ] **Step 4: Implement `verify_v111_authority()`**

```python
@dataclass(frozen=True)
class V112Authority:
    reports_dir: Path
    manifest: dict
    manifest_sha256: str
    report_sha256: dict[str, str]
    v110_manifest_sha256: str
    outcome: str
    current_counts: dict[str, int]

def verify_v111_authority(reports_dir: Path) -> V112Authority:
    ...
```

Require:
- exact V1.11 post manifest SHA;
- `auditVersion == "V1.11"`;
- `phase == "POST_APPROVAL"`;
- `outcome == "FULL_SUCCESS"`;
- `liveDatabaseFamilyUnchanged is True`;
- exact current counts `1433/1315/118/0/111/4/3`;
- exact V1.10 manifest SHA;
- both V1.11 public report hashes match the manifest;
- zero-write declaration from the post-audit helper.

- [ ] **Step 5: Inspect and lock current identity source/schema sentinels**

The verifier must locate, hash, and prove the current source/schema markers for:
- `corporate_action_imports.id`;
- `corporate_action_imports.symbol`;
- `corporate_action_imports.resolved_symbol`;
- `corporate_action_imports.isin`;
- `corporate_action_imports.company_name`;
- `corporate_action_imports.action_type`;
- `corporate_action_imports.ex_date`;
- identity-history table(s) actually used by current production;
- historical ISIN table(s) actually used by current production;
- current instrument/security master identity fields.

Do not guess table names. Extract them from current production source and SQLite schema during implementation.

- [ ] **Step 6: Hash-lock the exact V1.10 read-only modules**

Copy the validated V1.10 modules byte-for-byte into `audit/v110/`, store their expected SHA-256 values in `contracts.py`, and fail package validation if any differs.

- [ ] **Step 7: Run GREEN**

Expected:

```text
V1.12 AUTHORITY CONTRACT PASS
V1.11 FULL_SUCCESS AUTHORITY PASS
V1.10 READ-ONLY DEPENDENCY HASHES PASS
IDENTITY SOURCE/SCHEMA CONTRACT PASS
```

- [ ] **Step 8: SHA checkpoint**

Write `development-checkpoint-task01.json`; no Git command.

---

### Task 2: Extract and Fingerprint the Exact 111 Residual Population

**Files:**
- Create: `audit/residuals.py`
- Create: `audit/tests/fixture_v111.py`
- Create: `audit/tests/test_residuals.py`

**Interfaces:**
- Consumes the accepted V1.11 internal V1.10 deep-audit rows or an exactly equivalent recomputation from the private current snapshot.
- Produces `ResidualSet`.

- [ ] **Step 1: Define immutable residual types**

```python
@dataclass(frozen=True)
class ResidualRow:
    import_id: int
    exchange: str
    symbol: str
    resolved_symbol: str
    action_type: str
    ex_date: str
    historical_isin: str
    company_name: str
    current_identity_classification: str

@dataclass(frozen=True)
class ResidualSet:
    rows: tuple[ResidualRow, ...]
    import_ids: tuple[int, ...]
    cohort_counts: dict[str, int]
    id_fingerprint_sha256: str
    business_fingerprint_sha256: str
```

- [ ] **Step 2: Write exact cohort/fingerprint tests**

Require:

```python
self.assertEqual(len(residual.rows), 111)
self.assertEqual(residual.cohort_counts, {
    "NO_CANDIDATE": 56,
    "MISSING_EVENT_DATE_EVIDENCE": 37,
    "CONFLICTING_ISIN_HISTORY": 9,
    "COMPANY_IDENTITY_MISMATCH": 9,
})
self.assertEqual(
    residual.id_fingerprint_sha256,
    "8a42afa94287f2c80531020d6df80030229f647f86d3419a55ab94d8d5272bef",
)
self.assertEqual(
    residual.business_fingerprint_sha256,
    "2e53917f05386379e4fb034f8a2e7a814bd4bca33ec6fa84e44668bb52482b72",
)
```

- [ ] **Step 3: Implement canonical ID fingerprint**

```python
payload = ("\n".join(str(i) for i in sorted(import_ids)) + "\n").encode("utf-8")
```

- [ ] **Step 4: Implement canonical business fingerprint**

Canonical row:

```python
"|".join([
    str(import_id),
    exchange.strip().upper(),
    symbol.strip().upper(),
    resolved_symbol.strip().upper(),
    action_type.strip().upper(),
    ex_date.strip(),
    historical_isin.strip().upper(),
    company_name.strip(),
    current_identity_classification.strip().upper(),
])
```

Rows sort by integer `importId`; payload is newline-terminated UTF-8.

- [ ] **Step 5: Write fail-closed drift tests**

Reject:
- 110 rows;
- 112 rows;
- duplicate `importId`;
- one replaced ID but still 111 total;
- one changed symbol;
- one changed resolved symbol;
- one changed ISIN;
- one changed ex-date;
- one changed company name;
- one changed identity cohort.

- [ ] **Step 6: Run GREEN**

Exact 111 population and both fingerprints PASS.

---

### Task 3: Reuse the Proven Private-Snapshot and V1.10 Current-State Classifier

**Files:**
- Create: `audit/snapshot.py`
- Use: `audit/v110/*`
- Create: `audit/tests/test_read_only.py`

**Interfaces:**
- PowerShell owns live family discovery/hash/copy.
- Python opens only the private snapshot.
- Produces `CurrentCorporateActionState`.

- [ ] **Step 1: Write read-only mutation rejection test**

```python
def test_private_snapshot_connection_rejects_insert(self):
    conn = open_read_only_snapshot(self.fixture_db)
    with self.assertRaises(sqlite3.OperationalError):
        conn.execute("INSERT INTO corporate_action_imports(id) VALUES (999)")
```

- [ ] **Step 2: Implement snapshot classifier adapter**

```python
@dataclass(frozen=True)
class CurrentCorporateActionState:
    split_bonus_rows: tuple[dict, ...]
    identity_blocked_rows: tuple[dict, ...]
    all_action_health: tuple[dict, ...]
    internal_v110_manifest: dict

def classify_snapshot(...) -> CurrentCorporateActionState:
    ...
```

The adapter must call the vendored V1.10 classifier rather than reimplement current readiness/identity semantics.

- [ ] **Step 3: Reconcile current snapshot with accepted 111 set**

Pass 1 proceeds only if current residual ID and business fingerprints equal the locked accepted values.

- [ ] **Step 4: Add source-family immutability synthetic test**

Source DB bytes before/after private-snapshot analysis must be identical.

---

### Task 4: Model Local Identity Evidence as Explicit Facts and Edges

**Files:**
- Create: `audit/local_evidence.py`
- Create: `audit/identity_graph.py`
- Create: `audit/tests/fixture_identity_db.py`
- Create: `audit/tests/test_identity_graph.py`

**Interfaces:**
- Consumes one residual row plus read-only local identity/history tables.
- Produces `LocalEvidenceSet` and deterministic `IdentityGraph`.

- [ ] **Step 1: Define evidence types**

```python
class LocalEvidenceKind(StrEnum):
    EXACT_EVENT_DATE_HISTORY = "EXACT_EVENT_DATE_HISTORY"
    CONTINUITY_AROUND_EVENT_DATE = "CONTINUITY_AROUND_EVENT_DATE"
    HISTORICAL_ISIN_RECORD = "HISTORICAL_ISIN_RECORD"
    SYMBOL_CHANGE = "SYMBOL_CHANGE"
    ISIN_CHANGE = "ISIN_CHANGE"
    COMPANY_RENAME = "COMPANY_RENAME"
    CORPORATE_RESTRUCTURE = "CORPORATE_RESTRUCTURE"
    CURRENT_MASTER_CORROBORATION = "CURRENT_MASTER_CORROBORATION"
    NAME_SIMILARITY_ONLY = "NAME_SIMILARITY_ONLY"
    CONFLICTING_HISTORY = "CONFLICTING_HISTORY"
```

- [ ] **Step 2: Define immutable fact/edge records**

```python
@dataclass(frozen=True)
class IdentityFact:
    fact_id: str
    kind: LocalEvidenceKind
    source_table: str
    source_row_key: str
    symbol: str
    isin: str
    company_name: str
    effective_from: str
    effective_to: str
    authority_rank: int
    exact_event_date: bool

@dataclass(frozen=True)
class IdentityEdge:
    from_identity: str
    to_identity: str
    relation: str
    fact_ids: tuple[str, ...]
```

- [ ] **Step 3: Implement table adapters, not one monolithic query**

Each production identity/history table gets one loader function. Examples are named only after the current schema has been inspected in Task 1.

- [ ] **Step 4: Implement deterministic graph construction**

Graph nodes use canonical security identity:

```text
EXCHANGE|SYMBOL|ISIN
```

Relations include:

```text
SAME_SECURITY
SYMBOL_CHANGED_TO
ISIN_CHANGED_TO
RENAMED_TO
SUCCESSOR_SECURITY
```

- [ ] **Step 5: Test multi-hop identity chain**

Fixture:

```text
OLD / ISIN1
→ SYMBOL_CHANGED_TO MID / ISIN1
→ ISIN_CHANGED_TO MID / ISIN2
→ SYMBOL_CHANGED_TO NEW / ISIN2
```

Require a deterministic path from historical to current identity.

- [ ] **Step 6: Test symbol reuse isolation**

Two unrelated securities that share a symbol at different periods must not be joined solely by symbol equality.

---

### Task 5: Implement Event-Date Continuity and Evidence-Grade Rules

**Files:**
- Update: `audit/local_evidence.py`
- Create/update: `audit/tests/test_identity_graph.py`

**Interfaces:**
- Produces event-date evidence strength and grade candidates.

- [ ] **Step 1: Test exact event-date evidence**

A local historical row whose effective range contains `exDate` and whose security identity matches exactly yields Grade A candidate evidence.

- [ ] **Step 2: Test governed surrounding-date continuity**

Fixture:

```text
2014-11-14 OLD/ISIN1
exDate = 2014-11-17
2014-11-18 OLD/ISIN1
no intervening identity edge
```

Require:

```text
evidenceKind = CONTINUITY_AROUND_EVENT_DATE
gradeCandidate = B
```

- [ ] **Step 3: Test wide-gap inference**

If only remote historical records exist and no official/local lineage closes the date gap, result cannot exceed Grade C.

- [ ] **Step 4: Test company-name-only rejection**

Name similarity without a security identity edge cannot produce Grade A/B.

- [ ] **Step 5: Test current-symbol-only rejection**

Same current symbol without historical ISIN/date evidence cannot produce Grade A/B.

---

### Task 6: Implement Cohort-Specific Pass 1 Local Classification

**Files:**
- Create: `audit/local_classifier.py`
- Create: `audit/tests/test_local_classifier.py`

**Interfaces:**
- Consumes `ResidualRow`, `LocalEvidenceSet`, `IdentityGraph`.
- Produces `LocalClassification`.

- [ ] **Step 1: Define Pass 1 states**

```python
class LocalAuditState(StrEnum):
    LOCALLY_SAFE_EXACT_HISTORY = "LOCALLY_SAFE_EXACT_HISTORY"
    LOCALLY_SAFE_SYMBOL_CHAIN = "LOCALLY_SAFE_SYMBOL_CHAIN"
    LOCALLY_SAFE_RENAME_OR_RESTRUCTURE = "LOCALLY_SAFE_RENAME_OR_RESTRUCTURE"
    EXTERNAL_EVIDENCE_REQUIRED = "EXTERNAL_EVIDENCE_REQUIRED"
    MANUAL_SYMBOL_REUSE_REVIEW = "MANUAL_SYMBOL_REUSE_REVIEW"
    AMBIGUOUS_MULTIPLE_CANDIDATES = "AMBIGUOUS_MULTIPLE_CANDIDATES"
    CONFLICT_UNRESOLVED = "CONFLICT_UNRESOLVED"
    DATA_INTEGRITY_ANOMALY = "DATA_INTEGRITY_ANOMALY"
```

- [ ] **Step 2: Define classification result**

```python
@dataclass(frozen=True)
class LocalClassification:
    import_id: int
    state: LocalAuditState
    candidate_count: int
    selected_destination_symbol: str
    selected_destination_isin: str
    selected_destination_company: str
    evidence_grade: str
    evidence_fact_ids: tuple[str, ...]
    identity_chain: tuple[str, ...]
    conflicting_fact_ids: tuple[str, ...]
    missing_fact: str
    proposed_future_write_type: str
```

- [ ] **Step 3: Implement `NO_CANDIDATE` rules**

Safe locally only if a unique Grade A/B identity path exists. Multiple plausible destinations → `AMBIGUOUS_MULTIPLE_CANDIDATES`; no sufficient path → `EXTERNAL_EVIDENCE_REQUIRED`.

- [ ] **Step 4: Implement `MISSING_EVENT_DATE_EVIDENCE` rules**

Exact local event-date history → `LOCALLY_SAFE_EXACT_HISTORY`; governed continuity → safe only if complete unconflicted Grade B path exists; otherwise external evidence required.

- [ ] **Step 5: Implement `CONFLICTING_ISIN_HISTORY` rules**

Enumerate all conflicts. Local safe classification is allowed only if current/local authoritative evidence clearly marks one record as superseded/corrected. Otherwise `CONFLICT_UNRESOLVED` or external evidence required if an official source could resolve authority.

- [ ] **Step 6: Implement `COMPANY_IDENTITY_MISMATCH` rules**

Recognize only explicit rename/restructure/successor edges. Historical symbol reuse → manual. No explicit lineage → external evidence required/manual.

- [ ] **Step 7: Test no predetermined SAFE count**

The classifier must derive counts from evidence; no constant or target percentage may control classification.

---

### Task 7: Build the Targeted External Evidence Request Set

**Files:**
- Create: `audit/external_requests.py`
- Create: `audit/tests/test_external_requests.py`

**Interfaces:**
- Consumes Pass 1 classifications.
- Produces deterministic `EvidenceRequest` rows only for unresolved evidence needs.

- [ ] **Step 1: Define request contract**

```python
@dataclass(frozen=True)
class EvidenceRequest:
    request_id: str
    import_id: int
    cohort: str
    exchange: str
    historical_symbol: str
    historical_isin: str
    company_name: str
    action_type: str
    ex_date: str
    candidate_symbols: tuple[str, ...]
    candidate_isins: tuple[str, ...]
    missing_fact: str
    preferred_official_sources: tuple[str, ...]
    search_terms: tuple[str, ...]
```

- [ ] **Step 2: Generate stable request IDs**

```text
V112-REQ-<zero-padded importId>
```

- [ ] **Step 3: Require source preferences by exchange/cohort**

For NSE rows, prefer NSE official archives/notices before company/regulatory corroboration. For BSE rows, prefer BSE. Do not emit commercial sources.

- [ ] **Step 4: Test resolved-local rows produce no request**

Only rows whose remaining evidence requirement can plausibly be satisfied externally are requested.

- [ ] **Step 5: Test conflict requests describe the conflict**

A conflict request must include all competing ISIN/symbol candidates, not a preselected winner.

---

### Task 8: Define the External Evidence Bundle Contract

**Files:**
- Create: `audit/evidence_contracts.py`
- Create: `schemas/v1-12-external-evidence-item.schema.json`
- Create: `schemas/v1-12-external-evidence-catalog.schema.json`
- Create: `evidence-template/README.txt`
- Create: `evidence-template/evidence-catalog.json`
- Create: `audit/tests/fixture_evidence.py`
- Create: `audit/tests/test_evidence_bundle.py`

**Interfaces:**
- Defines a portable evidence bundle independent of web collection tooling.

- [ ] **Step 1: Define normalized item**

```python
@dataclass(frozen=True)
class ExternalEvidenceItem:
    evidence_id: str
    authority: str
    document_type: str
    reference: str
    retrieved_at: str
    source_uri: str
    target_import_ids: tuple[int, ...]
    historical_symbol: str
    historical_isin: str
    effective_date: str
    new_symbol: str
    new_isin: str
    company_name: str
    extracted_facts: tuple[str, ...]
    artifact_relative_path: str
    artifact_sha256: str
    evidence_grade: str
```

- [ ] **Step 2: Enforce authority and grade**

Allowed independent safe authorities are official exchange, regulator, or official issuer filing as defined in the spec. Grade must be `A`, `B`, `C`, `D`, or `X`.

- [ ] **Step 3: Require retained artifact hash when artifact exists**

If `artifact_relative_path` is non-empty, the file must exist inside the evidence bundle and match `artifact_sha256`.

- [ ] **Step 4: Support source-reference-only evidence explicitly**

If legal/technical restrictions prevent retaining the official artifact, allow empty artifact path only when:
- `source_uri` is an official source;
- `reference` is non-empty;
- `extracted_facts` are non-empty;
- evidence cannot exceed Grade B;
- manifest records `retainedArtifact = false`.

- [ ] **Step 5: Reject unsupported authority escalation**

A commercial or search-snippet source may be retained as locator metadata but cannot carry Grade A/B and cannot independently satisfy a safe gate.

---

### Task 9: Implement Evidence Bundle Verification and No-Network Finalizer Boundary

**Files:**
- Create: `audit/evidence_bundle.py`
- Create: `tools/verify_evidence_bundle.py`
- Update: `audit/tests/test_evidence_bundle.py`

**Interfaces:**
- Produces `VerifiedEvidenceBundle`.
- Final audit receives only verified normalized items.

- [ ] **Step 1: Define verified bundle**

```python
@dataclass(frozen=True)
class VerifiedEvidenceBundle:
    bundle_dir: Path
    catalog_sha256: str
    items: tuple[ExternalEvidenceItem, ...]
    artifact_sha256: dict[str, str]
```

- [ ] **Step 2: Verify request linkage**

Every `targetImportId` must belong to the locked 111 set. Evidence may target more than one residual row only if the source fact genuinely applies to all listed rows.

- [ ] **Step 3: Verify catalog/artifact hashes**

One altered byte must invalidate the bundle.

- [ ] **Step 4: Prove final-classifier module has no network imports**

Static verification rejects network-capable imports in `final_classifier.py`, including:
`requests`, `urllib.request`, `http.client`, `socket`, browser automation modules, or subprocess-based curl/wget invocation.

`urllib.parse` is allowed for URI syntax validation only.

- [ ] **Step 5: Test official-source unavailable**

An evidence request with no returned evidence is valid input; the row remains unresolved. The bundle itself may still verify.

---

### Task 10: Implement the Deterministic Final Classification Model

**Files:**
- Create: `audit/final_classifier.py`
- Create: `audit/tests/test_final_classifier.py`

**Interfaces:**
- Consumes Pass 1 local results + verified external evidence bundle.
- Produces exactly one `FinalIdentityState` per residual row.

- [ ] **Step 1: Define final states**

```python
class FinalIdentityState(StrEnum):
    SAFE_EXACT_HISTORY = "SAFE_EXACT_HISTORY"
    SAFE_SYMBOL_CHAIN = "SAFE_SYMBOL_CHAIN"
    SAFE_OFFICIAL_EXTERNAL_EVIDENCE = "SAFE_OFFICIAL_EXTERNAL_EVIDENCE"
    SAFE_RENAME_OR_RESTRUCTURE = "SAFE_RENAME_OR_RESTRUCTURE"
    MANUAL_COMPANY_IDENTITY_REVIEW = "MANUAL_COMPANY_IDENTITY_REVIEW"
    MANUAL_SYMBOL_REUSE_REVIEW = "MANUAL_SYMBOL_REUSE_REVIEW"
    AMBIGUOUS_MULTIPLE_CANDIDATES = "AMBIGUOUS_MULTIPLE_CANDIDATES"
    CONFLICT_UNRESOLVED = "CONFLICT_UNRESOLVED"
    NO_EVIDENCE_FOUND = "NO_EVIDENCE_FOUND"
    DATA_INTEGRITY_ANOMALY = "DATA_INTEGRITY_ANOMALY"
```

- [ ] **Step 2: Define final row**

```python
@dataclass(frozen=True)
class FinalIdentityResult:
    import_id: int
    historical_classification: str
    current_classification: str
    local_evidence_state: str
    external_evidence_required: bool
    evidence_grade: str
    evidence_source_ids: tuple[str, ...]
    identity_chain: tuple[str, ...]
    conflicting_evidence: tuple[str, ...]
    final_identity_state: FinalIdentityState
    safe_for_future_write: bool
    proposed_future_write_type: str
    manual_review_reason: str
```

- [ ] **Step 3: Implement safe invariant**

For every `safe_for_future_write=True` result require:

```python
assert evidence_grade in {"A", "B"}
assert evidence_source_ids
assert identity_chain
assert not conflicting_evidence
assert proposed_future_write_type in {
    "ADD_HISTORICAL_ISIN_EVIDENCE",
    "LINK_EXISTING_IDENTITY_HISTORY",
    "ADD_SYMBOL_CHANGE_LINEAGE",
    "ADD_RENAME_LINEAGE",
    "CORRECT_STALE_IDENTITY_ASSOCIATION",
}
```

- [ ] **Step 4: Implement external escalation rules**

Official external evidence may promote an unresolved local row to:
- `SAFE_EXACT_HISTORY`;
- `SAFE_OFFICIAL_EXTERNAL_EVIDENCE`;
- `SAFE_RENAME_OR_RESTRUCTURE`;
- `SAFE_SYMBOL_CHAIN`.

Contradictory authoritative external evidence forces `CONFLICT_UNRESOLVED` or `DATA_INTEGRITY_ANOMALY`, never SAFE.

- [ ] **Step 5: Implement no-evidence terminal rule**

If local evidence is insufficient and the evidence request returns no qualifying evidence, classify `NO_EVIDENCE_FOUND` or the appropriate manual/conflict state based on the known local problem.

- [ ] **Step 6: Require one and only one result for all 111**

No missing, duplicate, or silently dropped import ID.

---

### Task 11: Implement Pass 1 and Final Report Generation

**Files:**
- Create: `audit/reporting.py`
- Create: `audit/tests/test_reporting.py`

**Interfaces:**
- Produces deterministic Pass 1 and final report sets.

- [ ] **Step 1: Implement Pass 1 outputs**

Write:

```text
v1-12-identity-residual-summary.txt
v1-12-identity-residual-deep-audit.csv
v1-12-identity-residual-deep-audit.json
v1-12-local-evidence-findings.csv
v1-12-external-evidence-requests.csv
v1-12-identity-chain-detail.csv
v1-12-conflict-detail.csv
audit-manifest.json
```

Pass 1 manifest mode:

```text
PASS1_LOCAL_AUDIT
```

- [ ] **Step 2: Implement final outputs**

Final run additionally writes:

```text
v1-12-external-evidence-catalog.json
v1-12-safe-future-write-candidates.csv
v1-12-manual-review-candidates.csv
```

Final manifest mode:

```text
FINAL_IDENTITY_AUDIT
```

- [ ] **Step 3: Define deep-audit fixed fields**

Use exactly the row-level contract from the approved spec, including candidate count, selected destination, local state, external requirement, evidence grade/source IDs, identity chain, conflict detail, final state, safe flag, future write type, and manual reason.

- [ ] **Step 4: Ensure Pass 1 does not fabricate final external results**

Before an evidence bundle exists, unresolved rows retain a Pass 1 state and `externalEvidenceRequired=true`. They are not relabeled `NO_EVIDENCE_FOUND` merely because collection has not occurred yet.

- [ ] **Step 5: Test deterministic serialization**

Fixed inputs + fixed timestamp must produce byte-identical CSV/JSON/TXT outputs.

---

### Task 12: Implement V1.12 Manifest and Reconciliation Contracts

**Files:**
- Update: `audit/reporting.py`
- Create: `tools/verify_pass1_reports.py`
- Create: `tools/verify_final_reports.py`
- Update: `audit/tests/test_reporting.py`

**Interfaces:**
- Proves audit completeness and lineage.

- [ ] **Step 1: Include mandatory manifest lineage**

```json
{
  "auditVersion": "V1.12",
  "mode": "PASS1_LOCAL_AUDIT | FINAL_IDENTITY_AUDIT",
  "v111PostManifestSha256": "01c121...",
  "v110ManifestSha256": "99fd14...",
  "residualIdFingerprintSha256": "8a42af...",
  "residualBusinessFingerprintSha256": "2e5391...",
  "inputCount": 111,
  "inputCohorts": {
    "NO_CANDIDATE": 56,
    "MISSING_EVENT_DATE_EVIDENCE": 37,
    "CONFLICTING_ISIN_HISTORY": 9,
    "COMPANY_IDENTITY_MISMATCH": 9
  },
  "liveDatabaseFamilyUnchanged": true,
  "reportSha256": {},
  "zeroWriteDeclaration": {
    "databaseWrites": 0,
    "identityHistoryWrites": 0,
    "quickResolves": 0,
    "approvals": 0,
    "priceFactorWrites": 0
  }
}
```

- [ ] **Step 2: Final manifest binds evidence bundle**

Include catalog SHA and every retained evidence artifact SHA.

- [ ] **Step 3: Reconcile final result**

Require:

```python
safe_count + non_safe_count == 111
```

and exactly one final state for each input ID.

- [ ] **Step 4: Do not require a minimum SAFE count**

Zero SAFE is a valid evidence outcome if every row is accounted for and audit integrity passes.

---

### Task 13: Build the Pass 1 Local-Audit CLI

**Files:**
- Create: `audit/cli.py`
- Test: `audit/tests/test_end_to_end.py`

**Interfaces:**
- Command:

```text
python -m audit.cli pass1 ...
```

- [ ] **Step 1: Define required inputs**

```text
--project-root
--snapshot-db
--work-dir
--output-dir
--generated-at
--source-sentinel-manifest
--run-context
--v111-post-reports-dir
```

- [ ] **Step 2: Execute in fail-closed order**

```text
verify source/schema contract
verify V1.11 authority
run vendored V1.10 current classification
extract current 111 set
verify ID/business fingerprints
load local identity evidence
build graph
classify locally
build evidence requests
write deterministic Pass 1 reports
```

- [ ] **Step 3: Return nonzero for audit structural failure**

An unresolved row is not a CLI failure. Population/hash/source/read-only/report-contract failure is.

---

### Task 14: Build the Final Identity-Audit CLI

**Files:**
- Update: `audit/cli.py`
- Test: `audit/tests/test_end_to_end.py`

**Interfaces:**
- Command:

```text
python -m audit.cli final ...
```

- [ ] **Step 1: Require exact Pass 1 lineage**

Inputs include:

```text
--pass1-reports-dir
--evidence-bundle-dir
```

Verify Pass 1 manifest/report hashes before finalization.

- [ ] **Step 2: Recompute current 111 set from a fresh private snapshot**

Final audit must not assume the database remained unchanged since Pass 1. Current residual ID/business fingerprints must still equal the locked accepted set.

- [ ] **Step 3: Verify evidence bundle**

Reject altered catalog/artifact, invalid target IDs, authority/grade violations, or catalog schema failure.

- [ ] **Step 4: Run deterministic final classifier**

No network access.

- [ ] **Step 5: Write and verify final report set**

`FINAL_IDENTITY_AUDIT` only.

---

### Task 15: Build the Guarded Pass 1 PowerShell Wrapper

**Files:**
- Create: `Run-V1-12-Pass1-Local-Audit.ps1`
- Create: `README.txt`

**Interfaces:**
- Operator command:

```powershell
& ".\EOD_Chart_Corporate_Action_Phase1_Identity_Residual_Deep_Audit_V1_12_<timestamp>_IST\Run-V1-12-Pass1-Local-Audit.ps1" `
    -ProjectRoot "E:\TA Projects\EOD Charting Platform" `
    -V111PostReportsDir "E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-11-post_20260817_142307\reports" `
    -RunValidation
```

- [ ] **Step 1: Require application closed**

Fail if EOD Charting Platform is running.

- [ ] **Step 2: Resolve active database using the established project registry logic**

Allow optional explicit `-DatabasePath`.

- [ ] **Step 3: Verify package/source/V1.11 authority before snapshot**

No audit proceeds on stale authority.

- [ ] **Step 4: Run full synthetic suite when `-RunValidation` is supplied**

- [ ] **Step 5: Double-hash live DB/WAL/SHM, copy private snapshot, verify copy hashes**

- [ ] **Step 6: Invoke Pass 1 CLI**

- [ ] **Step 7: Rehash live DB/WAL/SHM in a `finally`-equivalent path**

Even classifier/report failure must not skip live-family post-state verification.

- [ ] **Step 8: Finalize manifest only if live family is unchanged**

Print:

```text
V1.12 PASS 1 AUDIT VALID
Input identity blockers: 111
Output audited rows: 111
Database writes: 0
```

Then print counts of locally safe/manual/conflict/external-evidence-required rows and the exact evidence-request CSV path.

---

### Task 16: Build the Guarded Final-Audit PowerShell Wrapper

**Files:**
- Create: `Run-V1-12-Final-Identity-Audit.ps1`
- Update: `README.txt`

**Interfaces:**
- Operator command:

```powershell
& ".\...\Run-V1-12-Final-Identity-Audit.ps1" `
    -ProjectRoot "E:\TA Projects\EOD Charting Platform" `
    -Pass1ReportsDir "<exact PASS1 reports directory>" `
    -EvidenceBundleDir "<exact normalized V1.12 evidence bundle>" `
    -V111PostReportsDir "E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-11-post_20260817_142307\reports" `
    -RunValidation
```

- [ ] **Step 1: Verify Pass 1 and evidence lineage before current DB snapshot**

- [ ] **Step 2: Require application closed and current database path consistent**

- [ ] **Step 3: Fresh DB/WAL/SHM double-hash and private snapshot**

- [ ] **Step 4: Revalidate exact 111 ID/business fingerprints**

- [ ] **Step 5: Invoke final CLI**

- [ ] **Step 6: Rehash live family and invalidate final audit on any change**

- [ ] **Step 7: Print measured classification totals**

No fixed SAFE target.

---

### Task 17: Implement Static No-Write and Package Verification

**Files:**
- Create: `tools/verify_package.py`
- Create: `PACKAGE_CONTENT_SHA256.txt`

**Interfaces:**
- Proves the package cannot mutate Corporate Action/identity state.

- [ ] **Step 1: Reject mutating SQL in executable audit modules**

Reject executable SQL containing:

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

Synthetic fixture/test SQL may be exempt only under `audit/tests/`.

- [ ] **Step 2: Reject network-capable imports from final classifier path**

`final_classifier.py` and its direct finalization-only dependencies must not import network clients.

- [ ] **Step 3: Reject write/approval/Quick Resolve commands in wrappers**

Reject direct calls to production Corporate Action writers or native SQLite mutation tools.

- [ ] **Step 4: Reject package contaminants**

Reject:
- `.git`;
- `__pycache__`;
- `.pyc`/`.pyo`;
- SQLite/database files;
- user-generated reports;
- downloaded evidence artifacts;
- project `src/` and `src-tauri-shell/` payload.

- [ ] **Step 5: Generate and verify package SHA manifest**

Hash all package files except the manifest itself.

---

### Task 18: Run the Complete Synthetic TDD Verification Gate

**Files:**
- All `audit/tests/*`.

**Interfaces:**
- No user live DB and no internet access.

- [ ] **Step 1: Run full suite**

```powershell
python -m unittest discover -s audit\tests -p "test_*.py" -v
```

- [ ] **Step 2: Verify required scenarios**

At minimum:
- exact 111 / 56+37+9+9;
- duplicate rejection;
- exact Grade A history;
- Grade B symbol chain;
- rename/restructure;
- surrounding-date continuity;
- wide-gap manual;
- company-name-only not safe;
- current-symbol-only not safe;
- historical symbol reuse manual;
- multiple candidates ambiguous;
- conflicting official evidence conflict;
- external artifact hash mismatch;
- source unavailable unresolved;
- safe invariant Grade A/B;
- 111 in / 111 out;
- deterministic serialization;
- final classifier no network;
- zero-write SQL scan;
- source-family immutability.

- [ ] **Step 3: Run end-to-end Pass 1 fixture**

Expected:
`111 in → 111 local results → deterministic external requests`.

- [ ] **Step 4: Run end-to-end final fixture**

Expected:
`same 111 → verified evidence bundle → exactly 111 final states`.

---

### Task 19: Execute the Live V1.12 Pass 1 Local Audit

**Files:**
- Read: accepted V1.11 reports.
- Read/hash/snapshot: live SQLite family.
- Write: V1.12 reports only.

**Interfaces:**
- Zero Corporate Action/identity writes.

- [ ] **Step 1: Close EOD Charting Platform**

- [ ] **Step 2: Run Pass 1 wrapper with `-RunValidation`**

Require terminal gates:

```text
V1.11 AUTHORITY PASS
CURRENT 111 RESIDUAL SET MATCHES ACCEPTED FINGERPRINTS
LIVE DB FAMILY IMMUTABILITY PASS
V1.12 PASS 1 AUDIT VALID
```

- [ ] **Step 3: Review measured Pass 1 buckets**

Do not assume how many will resolve locally.

- [ ] **Step 4: Export exact external-evidence request CSV**

This becomes the sole work queue for targeted web/offline research.

---

### Task 20: Acquire Targeted Official External Evidence Outside the Classifier

**Files:**
- Input: `v1-12-external-evidence-requests.csv`.
- Produce: a separate V1.12 evidence bundle matching `schemas/*`.

**Interfaces:**
- This is evidence research, not database implementation.
- It may be performed with web research/manual official archive retrieval after Pass 1 produces the exact request list.

- [ ] **Step 1: Process only Pass 1 request rows**

No broad re-research of locally settled rows unless contradictory evidence is discovered.

- [ ] **Step 2: Search official authority in precedence order**

For each request:
1. NSE/BSE official archive/master/notice;
2. official Corporate Action or identity-change notice;
3. SEBI/regulatory filing;
4. official issuer filing;
5. authoritative archive only as corroboration.

- [ ] **Step 3: Retain and hash artifacts where practical**

Save official PDF/HTML/CSV under `artifacts/`, calculate SHA-256, and record normalized extracted facts.

- [ ] **Step 4: Record unavailable evidence explicitly**

Do not fabricate success. A request may return zero evidence items with a documented retrieval outcome.

- [ ] **Step 5: Validate the evidence bundle before final audit**

Run:

```text
tools/verify_evidence_bundle.py
```

No database operation is involved.

---

### Task 21: Execute the Live V1.12 Final Identity Audit

**Files:**
- Read: accepted V1.11 authority.
- Read: exact Pass 1 reports.
- Read: verified external evidence bundle.
- Read/hash/snapshot: fresh live SQLite family.
- Write: V1.12 final reports only.

**Interfaces:**
- Zero application/database writes.

- [ ] **Step 1: Close EOD Charting Platform**

- [ ] **Step 2: Run final wrapper with `-RunValidation`**

- [ ] **Step 3: Require exact 111 current fingerprint revalidation**

If one audited row drifted since Pass 1, stop and do not finalize against stale evidence.

- [ ] **Step 4: Require 111 final outputs**

```text
SAFE + NON-SAFE = 111
```

- [ ] **Step 5: Require zero-write/live-family integrity**

- [ ] **Step 6: Review final buckets**

Expected form only:

```text
SAFE_EXACT_HISTORY                  measured
SAFE_SYMBOL_CHAIN                   measured
SAFE_OFFICIAL_EXTERNAL_EVIDENCE     measured
SAFE_RENAME_OR_RESTRUCTURE          measured
MANUAL_COMPANY_IDENTITY_REVIEW      measured
MANUAL_SYMBOL_REUSE_REVIEW          measured
AMBIGUOUS_MULTIPLE_CANDIDATES       measured
CONFLICT_UNRESOLVED                 measured
NO_EVIDENCE_FOUND                   measured
DATA_INTEGRITY_ANOMALY              measured
TOTAL                               111
```

No class count is predetermined.

---

### Task 22: V1.12 Closure Review and V1.13 Gate

**Files:**
- Read all final V1.12 reports/manifests/evidence hashes.

**Interfaces:**
- Produces evidence for a new design cycle only.

- [ ] **Step 1: Verify every final report hash and evidence artifact hash**

- [ ] **Step 2: Confirm `AUDIT VALID` structural criteria**

111 input, 111 output, no duplicates/missing rows, live family unchanged, zero writes.

- [ ] **Step 3: Review `v1-12-safe-future-write-candidates.csv`**

Each row must independently satisfy Grade A/B, no conflict, complete identity chain, exact future write type.

- [ ] **Step 4: Preserve all non-safe rows**

No automatic carry-over into a write package.

- [ ] **Step 5: Begin separate V1.13 design only if SAFE rows exist**

V1.12 completion itself authorizes no writes.

---

## Self-Review Checklist

- [ ] Every approved V1.12 design requirement maps to an implementation task.
- [ ] Accepted V1.11 post manifest SHA is exact and locked.
- [ ] Accepted V1.10 manifest SHA is exact and locked.
- [ ] The exact 111-row ID fingerprint is locked.
- [ ] The exact 111-row business fingerprint is locked.
- [ ] The 56/37/9/9 cohorts are exact starting constraints.
- [ ] The 4 parse/factor and 3 manual price-review rows remain excluded.
- [ ] Pass 1 and final audit each revalidate the current 111 population.
- [ ] V1.10 current-state semantics are reused, not reimplemented.
- [ ] Local identity evidence is modeled as explicit facts/edges.
- [ ] Historical symbol reuse cannot be resolved by symbol equality.
- [ ] Company-name similarity alone cannot be safe.
- [ ] Current-symbol equality alone cannot be safe.
- [ ] Exact-date and surrounding-date continuity are distinct.
- [ ] Only Grade A/B may yield SAFE.
- [ ] Conflicting authoritative evidence cannot yield SAFE.
- [ ] External evidence collection is outside the deterministic classifier.
- [ ] Final classifier performs no network access.
- [ ] Commercial/search sources cannot independently produce SAFE.
- [ ] Missing official evidence is a row-level unresolved result, not audit failure.
- [ ] Pass 1 does not prematurely classify unresearched requests as `NO_EVIDENCE_FOUND`.
- [ ] Every one of the 111 rows gets exactly one final state.
- [ ] No predetermined SAFE count exists.
- [ ] Safe rows have explicit future write types.
- [ ] Evidence catalog and retained artifacts are hash-bound.
- [ ] Pre/post live DB/WAL/SHM identity is required on both audit passes.
- [ ] Corporate Action writes remain zero.
- [ ] Identity/history writes remain zero.
- [ ] Quick Resolves and approvals remain zero.
- [ ] No production source modification is included.
- [ ] No Git operation is included.
- [ ] No unresolved placeholder text remains.
- [ ] V1.12 success authorizes no write automatically.

## Execution Handoff

Recommended execution mode: **Inline Execution**.

Reason: V1.12 has two deliberate evidence gates. First, implementation and Pass 1 produce the exact external-evidence request set. Then targeted official-source research produces a separate evidence bundle. Only after that bundle is reviewed and verified should the same session execute the final deterministic audit. This keeps evidence provenance, stale-state detection, and the future V1.13 authorization boundary explicit.

Because Git remains explicitly deferred, task checkpoints use deterministic tests and SHA-256 manifests instead of commits.
