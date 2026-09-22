# Corporate Action Phase 1 Identity Residual Deep Audit V1.12 Design

**Date:** 2026-08-17  
**Status:** Approved design pending written-spec review  
**Project:** EOD Charting Platform  
**Phase:** Corporate Action Phase 1  
**Version:** V1.12

## 1. Purpose

V1.12 performs a deep, reproducible, read-only identity audit of the exact 111 Split/Bonus Corporate Action imports that remain identity-blocked after V1.11 `FULL_SUCCESS`.

V1.12 does not repair, approve, Quick Resolve, bootstrap, or otherwise mutate Corporate Action state. Its purpose is to determine, with auditable evidence, which identity residuals are safely resolvable in a future controlled write phase and which must remain manual, conflicting, ambiguous, or unsupported.

The starting V1.11 population is:

| Current identity classification | Rows |
|---|---:|
| `NO_CANDIDATE` | 56 |
| `MISSING_EVENT_DATE_EVIDENCE` | 37 |
| `CONFLICTING_ISIN_HISTORY` | 9 |
| `COMPANY_IDENTITY_MISMATCH` | 9 |
| **Total** | **111** |

The 4 parse/factor blockers and 3 manual price-review rows are explicitly out of scope.

---

## 2. Non-Goals

V1.12 must not:

- write `instrument_isin_history`;
- write instrument identity/history tables;
- Quick Resolve imports;
- approve Corporate Actions;
- add or alter Corporate Action rows;
- override price review;
- repair factor/compound-factor state;
- alter raw EOD prices;
- mutate schema;
- modify production React/TypeScript/Rust/Tauri source as part of audit execution;
- perform Git operations;
- automatically authorize a later repair merely because a row is classified `SAFE_*`.

A `SAFE_*` result is an evidence-backed audit conclusion only.

---

## 3. Architecture

V1.12 uses a two-pass read-only architecture.

```text
V1.11 FULL_SUCCESS
        │
        ▼
exact 111 identity blockers
        │
        ▼
PASS 1 — LOCAL DETERMINISTIC AUDIT
        │
        ├── locally resolvable
        │
        └── EXTERNAL_EVIDENCE_REQUIRED
                    │
                    ▼
PASS 2 — TARGETED OFFICIAL EVIDENCE ENRICHMENT
                    │
                    ▼
          normalized + hashed evidence artifacts
                    │
                    ▼
          deterministic final classifier
                    │
       ┌────────────┴────────────┐
       ▼                         ▼
SAFE future candidates       manual/unresolved
       │                         │
       ▼                         └── preserved
future V1.13 only
```

The final classifier never performs network retrieval itself. It consumes normalized evidence artifacts produced by the evidence-acquisition stage. This keeps final classification deterministic, reproducible, and testable.

---

## 4. Read-Only Integrity Boundary

The local audit follows the same proven database-family integrity pattern used by V1.10/V1.11:

```text
application closed
→ live DB/WAL/SHM state capture
→ one-second quiescence recheck
→ private DB/WAL/SHM snapshot
→ copy-hash verification
→ SQLite mode=ro
→ PRAGMA query_only=ON
→ V1.12 analysis against private snapshot only
→ live DB/WAL/SHM rehash
→ byte-identical family required
```

The V1.12 helper package may read/hash/copy the live SQLite family but may not execute analytical SQL against the live database.

External evidence acquisition is file/network activity only and must not mutate the Corporate Action database.

---

## 5. Input Authority and Population Lock

V1.12 input authority is the accepted V1.11 post-approval evidence set, including:

- `v1-11-post-approval-summary.txt`;
- `v1-11-post-approval-reconciliation.csv`;
- `v1-11-post-approval-manifest.json`;
- the V1.11 preflight/backup lineage referenced by the post manifest;
- current production source-contract sentinels needed to interpret identity tables and classifiers.

Before classification V1.12 must prove:

```text
V1.11 outcome = FULL_SUCCESS
Split/Bonus total = 1433
approved = 1315
open = 118
READY_TO_APPROVE = 0
identity blocked = 111
parse/factor blocked = 4
manual price review = 3
```

The exact identity cohort must reconcile:

```text
NO_CANDIDATE = 56
MISSING_EVENT_DATE_EVIDENCE = 37
CONFLICTING_ISIN_HISTORY = 9
COMPANY_IDENTITY_MISMATCH = 9
TOTAL = 111
```

If the live/current population no longer equals this exact audited 111-row identity set, V1.12 stops before classification.

V1.12 creates two input fingerprints:

1. **Identity residual ID fingerprint** — SHA-256 over canonical sorted `importId` values.
2. **Identity residual business fingerprint** — SHA-256 over canonical sorted rows containing:

```text
importId
exchange
symbol
resolvedSymbol
actionType
exDate
historicalIsin
companyName
currentIdentityClassification
```

A future V1.13 repair phase must revalidate these fingerprints before authorizing writes.

---

## 6. Evidence Strategy

V1.12 uses **local-first, official-external-only-when-needed** evidence acquisition.

### 6.1 Local evidence sources

The local deterministic audit may use:

- current instrument master;
- instrument identity-history tables;
- historical ISIN history;
- Corporate Action imports and decisions;
- historical Corporate Action evidence;
- prior V1.9 evidence;
- V1.9.1.1 audit evidence;
- V1.9.2 bootstrap provenance;
- V1.10/V1.11 audit lineage;
- exact local symbol/ISIN/company/date relationships available in the current database and retained artifacts.

### 6.2 External evidence hierarchy

Only rows that remain locally unresolved move to targeted external evidence.

Authority order:

1. exact official NSE/BSE event-date exchange evidence;
2. official exchange historical security-master evidence;
3. official symbol/name/ISIN change notices;
4. official Corporate Action notices;
5. SEBI or other regulatory filings directly relevant to identity lineage;
6. official company filings, annual reports, or scheme-of-arrangement documents;
7. other authoritative archival material only as corroboration.

Commercial market-data sites, blogs, forums, generic finance portals, and search snippets cannot independently produce a `SAFE_*` result. They may only help locate an authoritative source.

If an official source is unavailable, V1.12 records the retrieval failure and tries another authoritative source. It must not silently substitute lower-authority evidence.

---

## 7. Evidence Precedence and Grades

### 7.1 Evidence precedence

```text
1. Exact official event-date evidence
2. Exact historical ISIN/symbol records already persisted locally
3. Official exchange identity-change notice
4. Official company/regulatory filing tied to the relevant date
5. Deterministic identity-chain evidence across symbol changes
6. Current instrument master as corroboration
7. Company-name similarity as supporting evidence only
```

Company-name similarity alone never authorizes a safe result.

Current-symbol equality alone is insufficient for a historical event.

### 7.2 Evidence grades

V1.12 uses evidence grades instead of arbitrary numeric confidence scores.

| Grade | Meaning | Safe eligibility |
|---|---|---|
| **A** | Direct official evidence tying historical identity to the event date | Eligible |
| **B** | Complete official/deterministic identity chain with no conflicting evidence | Eligible |
| **C** | Strong but incomplete corroboration | Manual only |
| **D** | Weak or ambiguous evidence | No-evidence / ambiguous |
| **X** | Contradictory or integrity-anomalous evidence | Conflict / anomaly |

Only Grade A or B may enter a `SAFE_*` final classification.

---

## 8. Event-Date Evidence Rules

Exact event-date evidence is the strongest standard.

V1.12 may also accept governed surrounding-date continuity when official records prove continuity around the Corporate Action event and no intervening identity event exists.

Example:

```text
Corporate Action ex-date: 2014-11-17

Official security master:
2014-11-14 → OLD_SYMBOL / OLD_ISIN
2014-11-18 → OLD_SYMBOL / OLD_ISIN

No intervening identity change.
```

This is classified as:

```text
CONTINUITY_AROUND_EVENT_DATE
```

It must not be mislabeled as exact-date evidence.

A wider inference without an official identity-change document is Grade C/manual review or lower.

---

## 9. Cohort-Specific Audit Logic

### 9.1 56 `NO_CANDIDATE`

Primary question: can V1.12 discover a deterministic historical-to-current identity chain?

Search dimensions:

- historical symbol;
- historical company name;
- historical ISIN;
- same exchange;
- identity-history links;
- old/new symbol chains;
- same-company ISIN changes;
- official exchange notices.

Allowed final outcomes include:

```text
SAFE_SYMBOL_CHAIN
SAFE_OFFICIAL_EXTERNAL_EVIDENCE
MANUAL_SYMBOL_REUSE_REVIEW
AMBIGUOUS_MULTIPLE_CANDIDATES
NO_EVIDENCE_FOUND
```

A multi-hop chain is acceptable when each hop is supported:

```text
OLD_SYMBOL
→ official symbol change
MID_SYMBOL
→ official ISIN change
CURRENT_SYMBOL
```

### 9.2 37 `MISSING_EVENT_DATE_EVIDENCE`

Primary question: did the historical symbol/ISIN belong to the resolved company on or immediately around the Corporate Action event date?

Direct official event-date evidence produces:

```text
SAFE_EXACT_HISTORY
```

A complete authoritative surrounding-date continuity chain may produce Grade B.

A plausible but incomplete temporal inference remains:

```text
MANUAL_COMPANY_IDENTITY_REVIEW
```

### 9.3 9 `CONFLICTING_ISIN_HISTORY`

These receive the strictest conflict handling.

V1.12 enumerates all competing records with:

- candidate ISIN;
- candidate symbol;
- effective date/range;
- company name;
- source;
- source authority;
- retrieval/hash metadata;
- current lineage.

If one authoritative source clearly supersedes/corrects another:

```text
SAFE_EXACT_HISTORY
```

or:

```text
SAFE_OFFICIAL_EXTERNAL_EVIDENCE
```

If incompatible authoritative records remain:

```text
CONFLICT_UNRESOLVED
```

V1.12 must never choose a winner merely because one candidate looks more plausible.

### 9.4 9 `COMPANY_IDENTITY_MISMATCH`

V1.12 determines whether the mismatch represents:

- company rename;
- legal-name normalization;
- symbol change;
- merger;
- reverse merger;
- demerger;
- amalgamation;
- acquisition;
- successor-security lineage;
- historical symbol reuse by an unrelated company;
- genuine bad Corporate Action association.

Safe outcomes may include:

```text
SAFE_RENAME_OR_RESTRUCTURE
SAFE_SYMBOL_CHAIN
```

Unsafe outcomes include:

```text
MANUAL_COMPANY_IDENTITY_REVIEW
MANUAL_SYMBOL_REUSE_REVIEW
CONFLICT_UNRESOLVED
```

Historical symbol reuse by an unrelated company is a high-risk case and cannot be normalized by symbol equality.

---

## 10. Final Classification Model

Every one of the 111 rows must land in exactly one final identity state.

### Safe for future controlled write

```text
SAFE_EXACT_HISTORY
SAFE_SYMBOL_CHAIN
SAFE_OFFICIAL_EXTERNAL_EVIDENCE
SAFE_RENAME_OR_RESTRUCTURE
```

### Not safe for automatic future repair

```text
MANUAL_COMPANY_IDENTITY_REVIEW
MANUAL_SYMBOL_REUSE_REVIEW
AMBIGUOUS_MULTIPLE_CANDIDATES
CONFLICT_UNRESOLVED
NO_EVIDENCE_FOUND
DATA_INTEGRITY_ANOMALY
```

The audit may be valid even if many or all rows remain non-safe. No predetermined SAFE count is permitted.

---

## 11. Safe-Row Contract

Every `SAFE_*` row must include:

```text
importId
historicalSymbol
historicalIsin
event/exDate
resolvedCurrentSymbol
resolvedCurrentIsin
companyIdentity
resolutionType
evidenceGrade
evidenceSourceIds
identityChain
conflictingEvidence = none
proposedFutureWriteType
safeForFutureWrite = true
```

A safe row also requires:

- unique target import ID;
- unambiguous historical security identity;
- unambiguous destination/current identity;
- preserved event date;
- Grade A or B evidence;
- no unresolved contradictory evidence;
- complete identity chain;
- hash-bound evidence artifacts.

If any required item is missing, the row cannot appear in the safe-candidate output.

---

## 12. Proposed Future Write Types

V1.12 may propose only explicit, auditable future actions:

```text
ADD_HISTORICAL_ISIN_EVIDENCE
LINK_EXISTING_IDENTITY_HISTORY
ADD_SYMBOL_CHANGE_LINEAGE
ADD_RENAME_LINEAGE
CORRECT_STALE_IDENTITY_ASSOCIATION
```

These are proposals only.

Generic actions such as `FIX_IDENTITY` are prohibited.

---

## 13. Manual/Unresolved Row Contract

For each non-safe row V1.12 records:

- why the SAFE gate failed;
- evidence searched;
- candidates considered;
- conflicting or missing fact;
- retrieval failures, if any;
- what additional evidence would be needed to resolve the row;
- the final manual/conflict/no-evidence state.

The audit must turn “needs review” into an actionable explanation, not another opaque bucket.

---

## 14. External Evidence Request Workflow

Pass 1 produces `EXTERNAL_EVIDENCE_REQUIRED` requests only for locally unresolved rows.

Each request identifies:

```text
requestId
importId
cohort
exchange
historicalSymbol
historicalIsin
companyName
actionType
exDate
candidateSymbols
candidateIsins
missingFact
preferredOfficialSources
searchTerms
```

External evidence acquisition then produces normalized evidence records.

Example normalized artifact:

```json
{
  "evidenceId": "V112-EVID-0001",
  "authority": "NSE",
  "documentType": "SYMBOL_ISIN_CHANGE_NOTICE",
  "reference": "...",
  "retrievedAt": "...",
  "sourceUri": "...",
  "targetImportIds": [12345],
  "historicalSymbol": "...",
  "historicalIsin": "...",
  "effectiveDate": "...",
  "newSymbol": "...",
  "newIsin": "...",
  "companyName": "...",
  "extractedFacts": ["..."],
  "artifactSha256": "...",
  "evidenceGrade": "A"
}
```

Where practical, the actual official PDF/HTML/CSV is retained beside metadata and SHA-256 hashed.

The final classifier consumes only normalized evidence artifacts. It does not browse the web.

---

## 15. Component Boundaries

Recommended components:

```text
V1.12 Authority/Lineage Verifier
        │
        ▼
111-Row Residual Extractor
        │
        ▼
Local Identity Evidence Engine
        │
        ├── Local Resolution Classifier
        │
        └── External Evidence Request Builder
                         │
                         ▼
               Official Evidence Collector
                         │
                         ▼
               Evidence Normalizer/Hasher
                         │
                         ▼
                  Final Classifier
                         │
                         ▼
                  Report Generator
```

Responsibilities remain isolated:

- **Authority/Lineage Verifier:** proves V1.11 and current-state authority.
- **Residual Extractor:** produces the exact 111-row population.
- **Local Evidence Engine:** gathers deterministic local evidence.
- **Local Classifier:** resolves rows possible from local evidence alone.
- **Request Builder:** describes unresolved evidence needs.
- **Official Evidence Collector:** obtains authoritative external evidence only.
- **Normalizer/Hasher:** converts source material into deterministic evidence records.
- **Final Classifier:** classifies from normalized evidence only.
- **Report Generator:** emits deterministic reports/manifests.

---

## 16. Required Reports

V1.12 produces:

```text
v1-12-identity-residual-summary.txt
v1-12-identity-residual-deep-audit.csv
v1-12-identity-residual-deep-audit.json
v1-12-local-evidence-findings.csv
v1-12-external-evidence-requests.csv
v1-12-external-evidence-catalog.json
v1-12-identity-chain-detail.csv
v1-12-conflict-detail.csv
v1-12-safe-future-write-candidates.csv
v1-12-manual-review-candidates.csv
audit-manifest.json
```

`v1-12-external-evidence-requests.csv` may contain fewer than 111 rows.

If Pass 1 alone is being run before evidence acquisition, the manifest must identify the run as `PASS1_LOCAL_AUDIT` rather than presenting external classification as complete.

---

## 17. Row-Level Deep-Audit Fields

Every one of the 111 rows must include at least:

```text
importId
historicalClassification
currentClassification
exchange
historicalSymbol
historicalIsin
companyName
actionType
exDate

candidateCount
selectedDestinationSymbol
selectedDestinationIsin
selectedDestinationCompany

localEvidenceState
externalEvidenceRequired
evidenceGrade
evidenceSourceIds
identityChain
conflictingEvidence

finalIdentityState
safeForFutureWrite
proposedFutureWriteType
manualReviewReason
```

No row may be silently excluded.

---

## 18. Manifest Requirements

The V1.12 manifest binds:

- V1.11 post-audit manifest SHA-256;
- V1.11 authority lineage;
- live database-family pre/post hashes;
- private snapshot hashes;
- source-contract hashes;
- historical input hashes;
- exact 111 input import IDs;
- 111-row ID fingerprint;
- 111-row business fingerprint;
- external evidence catalog SHA-256;
- retained external artifact hashes where applicable;
- all report SHA-256 values;
- zero-write declaration;
- audit mode (`PASS1_LOCAL_AUDIT` or `FINAL_IDENTITY_AUDIT`);
- final reconciliation counts.

---

## 19. Failure Handling

V1.12 fails closed for:

- input population other than 111;
- 56/37/9/9 starting cohort drift;
- duplicate import ID;
- a known identity blocker disappears unexpectedly;
- a new identity blocker appears unexpectedly;
- V1.11 post-manifest hash/authority mismatch;
- live DB/WAL/SHM changes during read-only analysis;
- source-contract drift that invalidates identity interpretation;
- historical evidence artifact hash mismatch;
- final classifier cannot parse required identity data;
- external evidence artifact cannot be verified;
- one `SAFE_*` row lacks Grade A/B evidence;
- one `SAFE_*` row contains unresolved contradictory evidence;
- one input row lacks exactly one final classification;
- report/manifest hash inconsistency.

A failed external lookup is **not** an audit failure. It is a row-level unresolved outcome.

```text
AUDIT FAILURE != ROW COULD NOT BE RESOLVED
```

---

## 20. Acceptance Criteria

V1.12 is `AUDIT VALID` only when:

```text
Input identity blockers:             111
Output audited rows:                 111
Missing input rows:                    0
Duplicate importIds:                   0
Unexpected new identity blockers:      0
Silent exclusions:                     0

Live DB/WAL/SHM changed:               0
Corporate Action writes:               0
Identity/history writes:               0
Quick Resolves:                        0
Approvals:                             0
Price/factor writes:                   0
Git operations:                        0
```

The final classification must reconcile:

```text
SAFE_* total
+ MANUAL_* total
+ AMBIGUOUS_MULTIPLE_CANDIDATES
+ CONFLICT_UNRESOLVED
+ NO_EVIDENCE_FOUND
+ DATA_INTEGRITY_ANOMALY
= 111
```

No target SAFE count is predetermined.

---

## 21. Completion Summary Contract

The final report contains:

```text
INITIAL POPULATION
------------------
NO_CANDIDATE                         56
MISSING_EVENT_DATE_EVIDENCE          37
CONFLICTING_ISIN_HISTORY              9
COMPANY_IDENTITY_MISMATCH             9
                                    ---
TOTAL                               111


FINAL V1.12 CLASSIFICATION
--------------------------
SAFE_EXACT_HISTORY                    x
SAFE_SYMBOL_CHAIN                     x
SAFE_OFFICIAL_EXTERNAL_EVIDENCE       x
SAFE_RENAME_OR_RESTRUCTURE            x
                                    ---
SAFE FOR FUTURE WRITE                 x

MANUAL_COMPANY_IDENTITY_REVIEW        x
MANUAL_SYMBOL_REUSE_REVIEW            x
AMBIGUOUS_MULTIPLE_CANDIDATES         x
CONFLICT_UNRESOLVED                   x
NO_EVIDENCE_FOUND                     x
DATA_INTEGRITY_ANOMALY                x
                                    ---
NON-SAFE                              x

TOTAL                               111
```

The values of `x` are measured results, never predefined targets.

---

## 22. Future V1.13 Boundary

If V1.12 finds safe rows, the next phase is separate:

**Corporate Action Phase 1 — Controlled Identity Residual Repair V1.13**

V1.13 authorization must bind:

```text
exact V1.12 SAFE importIds
+ exact V1.12 evidence artifacts
+ exact proposed future write type
+ row fingerprint
+ business-state fingerprint
+ fresh current DB revalidation
```

Recommended V1.13 governance pattern:

```text
read-only authorization
→ exact-set preflight
→ verified backup
→ controlled identity writes
→ read-only reconciliation
```

Manual/conflict/no-evidence V1.12 rows are excluded from V1.13.

The 4 parse/factor and 3 manual price-review rows remain outside V1.12 and V1.13.

V1.12 success authorizes no write automatically.

---

## 23. Test Requirements

At minimum, implementation must test:

- exact 111-row extraction;
- exact 56/37/9/9 cohort preservation;
- duplicate identity-row rejection;
- V1.11 authority/hash mismatch rejection;
- exact-history Grade A classification;
- complete symbol-chain Grade B classification;
- rename/restructure chain classification;
- historical symbol reuse → manual;
- multiple plausible candidates → ambiguous;
- contradictory authoritative records → conflict;
- missing exact-date but official surrounding continuity;
- weak company-name similarity cannot become SAFE;
- current-symbol equality alone cannot become SAFE;
- external artifact hash mismatch;
- official source unavailable → unresolved row, not audit failure;
- every SAFE row has Grade A/B evidence;
- every SAFE row has complete future-write proposal;
- 111 input / 111 output reconciliation;
- zero database writes;
- SQLite `mode=ro` / `query_only` enforcement;
- live database-family immutability;
- deterministic report serialization;
- deterministic ID/business fingerprints;
- final classifier performs no network access;
- package contains no write-capable Corporate Action helper.

---

## 24. Git and Documentation Boundary

Git remains explicitly deferred for this phase.

Safety and lineage use:

- accepted V1.11 manifests;
- source-contract hashes;
- input fingerprints;
- report SHA-256 manifests;
- external evidence hashes;
- private read-only SQLite snapshots;
- byte-identical live DB/WAL/SHM verification.

No Git command is permitted as part of V1.12 design, implementation, or execution unless separately approved later.
