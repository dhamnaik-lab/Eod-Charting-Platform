# Corporate Action V1.9.1 Historical ISIN Evidence Bootstrap Audit — Design Specification

**Date:** 2026-08-16 02:28 IST  
**Status:** Approved design; documentation only  
**Scope:** Read-only diagnostic for the V1.9 `LIKELY_MISSING_EVIDENCE` population  
**Project:** EOD Charting Platform

## 1. Purpose

V1.9 established that 344 unresolved Split/Bonus imports had already-passing price validation but were blocked on identity resolution. Of those, 295 were classified `LIKELY_MISSING_EVIDENCE`: each had a unique active NSE destination candidate, but none had the exact event-date historical ISIN evidence required by the existing Quick Resolve safeguard.

V1.9.1 must determine whether the structured official Corporate Action evidence already attached to those 295 unresolved imports is sufficiently complete, internally consistent, and conflict-free to justify a later, separate bootstrap of exact-date historical ISIN evidence into the identity-history layer.

V1.9.1 is an audit only. It must not insert historical ISIN evidence, resolve identity, invoke Quick Resolve, approve Corporate Actions, create exceptions, or modify raw EOD data.

## 2. Architectural Principle

The existing Quick Resolve safety contract remains unchanged.

V1.9.1 evaluates whether official source evidence is safe to bootstrap into the evidence layer that Quick Resolve already trusts. It does not teach Quick Resolve to trust a second evidence type directly.

The intended governed sequence is:

```text
official source evidence
        ↓
V1.9.1 audited bootstrap eligibility
        ↓
future explicit historical-ISIN evidence bootstrap
        ↓
existing Quick Resolve logic unchanged
        ↓
normal Corporate Action price gate
        ↓
normal explicit Corporate Action approval
```

This avoids circularly weakening the identity-resolution safeguard simply because the required history row is absent.

## 3. Approved Approach

### 3.1 Recommended approach

Use a standalone Node/SQLite read-only diagnostic, following the successful V1.8 and V1.9 operational model.

The diagnostic consumes the latest successful V1.9 result set and targets only rows classified `LIKELY_MISSING_EVIDENCE`.

### 3.2 Rejected approaches

The following approaches are explicitly out of scope:

1. **Allow Quick Resolve to accept `corporate_action_import_evidence` directly.** This would alter the semantics of an established safety gate and create parallel evidence contracts.
2. **Automatically seed every unresolved official import into `instrument_isin_history`.** This would treat an unreviewed import as trusted identity history merely because it exists.
3. **Bulk-resolve or bulk-approve rows during the audit.** V1.9.1 is read-only and cannot perform mutations.

## 4. Target Population

The expected V1.9 baseline is:

```text
classification = LIKELY_MISSING_EVIDENCE
expected count = 295
```

The expected count is not an authorization. V1.9.1 must re-evaluate live state for every baseline row.

For each target, V1.9.1 must verify:

- still unresolved;
- still unapproved;
- still NSE;
- still `PARSED`;
- still Split or Bonus;
- latest Split/Bonus price validation still `MATCHED`;
- latest price evidence still current;
- same unique active destination still exists;
- no relevant identity/evidence state has changed in a way that invalidates the V1.9 premise.

Any row whose state no longer matches the baseline is classified `STATE_CHANGED` rather than silently excluded.

Every V1.9 baseline row must reconcile exactly once.

## 5. Classification Model

Every target row must receive exactly one classification.

| Classification | Meaning |
|---|---|
| `BOOTSTRAP_SAFE` | Official evidence independently satisfies every approved bootstrap gate |
| `SOURCE_EVIDENCE_MISMATCH` | Structured evidence contradicts the parent Corporate Action import |
| `SOURCE_EVIDENCE_INCOMPLETE` | Required provenance or identity fields are absent or unusable |
| `COMPANY_IDENTITY_MISMATCH` | Official issuer identity does not deterministically agree with the unique active instrument |
| `CONFLICTING_ISIN_HISTORY` | Existing historical ISIN data conflicts for the relevant symbol/date identity |
| `MULTIPLE_SOURCE_CONFLICT` | Multiple evidence records disagree on material event identity |
| `ACTIVE_INSTRUMENT_MISMATCH` | The destination instrument differs from the uniquely audited V1.9 destination |
| `STATE_CHANGED` | The import or price-validation state changed after V1.9 |
| `DATA_STATE_ANOMALY` | Malformed or structurally inconsistent data prevents a safe decision |

Uncertainty must fail closed. No fuzzy or heuristic path may promote a row to `BOOTSTRAP_SAFE`.

## 6. `BOOTSTRAP_SAFE` Gates

A row qualifies as `BOOTSTRAP_SAFE` only if every gate below passes simultaneously.

1. The row is still one of the V1.9 `LIKELY_MISSING_EVIDENCE` baseline targets.
2. The import is still NSE, `PARSED`, `UNRESOLVED`, unapproved, and Split/Bonus.
3. Latest Split/Bonus price validation remains current and `MATCHED`.
4. Exactly one active NSE destination instrument remains.
5. The parent import has non-empty official symbol, historical ISIN, company name, and ex-date.
6. At least one structured `corporate_action_import_evidence` row exists.
7. Evidence `symbol_seen` agrees with the official event symbol.
8. Evidence `isin_seen` exactly equals the historical official ISIN.
9. Evidence `event_date_seen` exactly equals the Corporate Action ex-date.
10. Evidence `action_type_seen` is compatible with the parsed Split/Bonus event.
11. Evidence uses a recognized official Corporate Action source already used by the platform.
12. Evidence has sufficient provenance to identify its official origin, using existing source-code/source-locator/raw-reference conventions.
13. Company identity deterministically agrees with the unique active instrument using the platform's normalized-company semantics; fuzzy similarity alone is forbidden.
14. The current destination ISIN exists and differs from the historical official ISIN.
15. No conflicting `instrument_isin_history` record exists for the relevant symbol/date identity.
16. No contradictory structured source-evidence row exists for the import.
17. Any populated evidence factor is compatible with the parsed event factor under the platform's existing Split/Bonus semantics.
18. A deterministic bootstrap evidence fingerprint can be generated from all safety-relevant state.

`BOOTSTRAP_SAFE` means only that the row is safe to consider for a future historical-ISIN evidence bootstrap. It does not mean identity is resolved and does not mean the Corporate Action is approved.

## 7. Evidence Trust Hierarchy

V1.9.1 recognizes three evidence layers.

| Layer | Role | Can independently establish bootstrap eligibility? |
|---|---|---:|
| Structured `corporate_action_import_evidence` | Primary official-event provenance | Yes, if all strict fields agree |
| Parent `corporate_action_imports` row | Parsed event state | Supports evidence, but cannot override contradictions |
| Current instrument symbol/company metadata | Corroboration | No |

The primary structured evidence should bind, where historically recorded:

```text
exchange = NSE
symbol_seen = official historical symbol
isin_seen = official historical ISIN
event_date_seen = official ex-date
action_type_seen = compatible Split/Bonus
source_code = recognized official ingestion source
source_locator/raw_reference = sufficient provenance
```

Company-name or symbol similarity alone can never prove historical identity.

## 8. Structured Evidence Validation

The audit compares structured evidence field by field against the parent import.

At minimum:

```text
parent.symbol       == evidence.symbol_seen
parent.isin         == evidence.isin_seen
parent.ex_date      == evidence.event_date_seen
parent.action_type  compatible with evidence.action_type_seen
parent.company_name deterministic-normalized with evidence.company_name_seen
```

When `factor_seen` is populated, it must be compatible with the parsed Split/Bonus factor.

The audit must distinguish:

- missing/unusable value → `SOURCE_EVIDENCE_INCOMPLETE`;
- contradictory value → `SOURCE_EVIDENCE_MISMATCH`.

A missing field and a conflicting field are different risk classes and must not be collapsed.

## 9. Multiple Evidence Records

Multiple source records are not automatically stronger evidence.

If all materially relevant evidence rows agree on event identity, the row may continue through the gates.

If relevant evidence rows conflict on symbol, historical ISIN, event date, or action identity, classify:

```text
MULTIPLE_SOURCE_CONFLICT
```

Differences limited to non-material capture metadata, such as capture timestamps, are not conflicts.

## 10. Official Source Whitelist

V1.9.1 must derive recognized official source codes from the existing Corporate Action ingestion system. It must not invent a new trusted source merely to increase the passing count.

Unknown, manual, or ad-hoc provenance cannot qualify for `BOOTSTRAP_SAFE`.

When provenance exists but is not a recognized official source, the audit must block bootstrap eligibility and explain the source failure explicitly, normally under `SOURCE_EVIDENCE_INCOMPLETE` unless the data is structurally contradictory.

## 11. Exact-Date Historical ISIN Analysis

Before declaring a row safe, V1.9.1 must inspect existing identity-history records relevant to the exact event identity.

At minimum the audit evaluates:

```text
exchange = NSE
symbol = target historical/event symbol
event date = Corporate Action ex-date
historical ISIN = official historical ISIN
```

### 11.1 No exact relevant row exists

This is the normal bootstrap scenario. If all other gates pass, the row may become `BOOTSTRAP_SAFE`.

### 11.2 Matching exact-date record already exists

This is not a bootstrap case. It indicates that V1.9 did not consume identity evidence that appears to be available, that the row is stored in a form Quick Resolve does not consume, or that state changed after V1.9.

Classify `DATA_STATE_ANOMALY` and export the exact matching history row for investigation.

### 11.3 Conflicting exact-date record exists

If an existing record anchors a different ISIN or incompatible identity at the same relevant symbol/date, classify:

```text
CONFLICTING_ISIN_HISTORY
```

No bootstrap eligibility is allowed.

### 11.4 Broader overlap/conflict

If overlapping historical identity data would make the proposed transition contradictory or non-deterministic, fail closed. The row cannot be `BOOTSTRAP_SAFE`.

## 12. Company Identity Gate

The audit must reuse or faithfully reproduce the deterministic company-name normalization semantics already used by the platform's Corporate Action identity recommendation logic.

Normalization may remove superficial differences such as:

- case;
- punctuation;
- spacing;
- common legal-form variants such as `LIMITED`, `LTD`, and `LTD.`.

It must not perform fuzzy issuer matching.

Examples:

```text
ABC INDUSTRIES LIMITED
ABC INDUSTRIES LTD
→ deterministic match
```

```text
ABC INDUSTRIES LTD
ABC INFRASTRUCTURE LTD
→ mismatch
```

A material mismatch is `COMPANY_IDENTITY_MISMATCH`.

A required company field that is absent is `SOURCE_EVIDENCE_INCOMPLETE`.

## 13. Historical and Current ISIN Relationship

For a normal bootstrap candidate:

```text
historical official ISIN != current active ISIN
```

The historical ISIN must be valid under the platform's existing ISIN handling. The active current instrument must have a current ISIN.

If the historical and current ISIN are already identical, the state is unexpected for this V1.9 population and must be classified `DATA_STATE_ANOMALY` rather than bootstrapped.

## 14. Destination Consistency

V1.9 found exactly one active NSE candidate for each `LIKELY_MISSING_EVIDENCE` row.

V1.9.1 must independently reload the live destination state. If the unique candidate changed, disappeared, multiplied, became inactive, moved exchange, or changed identity in a safety-relevant way, the row cannot remain bootstrapable.

Use `ACTIVE_INSTRUMENT_MISMATCH`, `STATE_CHANGED`, or `DATA_STATE_ANOMALY` according to the nature of the drift. The report must explain the exact failed gate.

## 15. Bootstrap Evidence Fingerprint

Every `BOOTSTRAP_SAFE` row must receive a deterministic SHA-256 fingerprint.

Fingerprint version:

```text
ca-isin-bootstrap-v1
```

The canonical payload must cover every material input whose change could make a future write unsafe.

At minimum:

```text
version
importId

parent import:
  exchange
  symbol
  historicalIsin
  companyName
  exDate
  actionType
  factor

structured evidence:
  evidenceIds
  sourceCodes
  sourceLocators
  evidenceSymbols
  evidenceIsins
  evidenceCompanies
  evidenceActionTypes
  evidenceDates
  evidenceFactors
  rawReferences

destination:
  destinationInstrumentId
  destinationSymbol
  destinationIsin
  destinationCompany
  destinationActiveState

identity-history state:
  all relevant existing ISIN-history rows considered
```

Objects must use stable property ordering. Arrays must be sorted deterministically. Equivalent live evidence must always generate the same fingerprint.

Changing any safety-relevant value, including historical ISIN, event date, source evidence, destination ISIN, or conflicting history state, must change the fingerprint.

A future write-capable bootstrap must recompute this fingerprint immediately before mutation and reject stale candidates.

## 16. Read-Only Architecture

V1.9.1 is a standalone Node/SQLite diagnostic.

It must not modify React, Rust, Tauri, or application production source.

Conceptual flow:

```text
latest V1.9 LIKELY_MISSING_EVIDENCE baseline
                │
                ▼
active market-data.sqlite3 opened read-only
                │
                ├── corporate_action_imports
                ├── corporate_action_import_evidence
                ├── latest completed official price scan
                ├── active/current instrument identity
                ├── instrument_isin_history
                └── relevant identity/alias history
                │
                ▼
V1.9.1 bootstrap classifier
                │
                ├── revalidate target state
                ├── validate official structured evidence
                ├── validate recognized source provenance
                ├── compare deterministic company identity
                ├── inspect exact-date/history conflicts
                ├── confirm unique active destination
                └── generate fingerprint
                │
                ▼
TXT + CSV + JSON + BOOTSTRAP_SAFE subset
```

The live database connection must enforce both:

```text
readOnly = true
PRAGMA query_only = 1
```

The PowerShell wrapper must hash the main SQLite database and any WAL/SHM sidecars before and after execution and require byte-for-byte equality.

## 17. Output Files

V1.9.1 must produce four timestamped audit artifacts:

```text
historical-isin-bootstrap-audit-summary.txt
historical-isin-bootstrap-audit.csv
historical-isin-bootstrap-audit.json
bootstrap-safe-candidates.csv
```

The full CSV/JSON must expose, where applicable:

- import ID;
- exchange;
- official historical/event symbol;
- historical official ISIN;
- current active ISIN;
- company names and normalized comparison result;
- ex-date;
- action type;
- parsed factor;
- price-validation status and confidence;
- evidence count;
- source code;
- source locator;
- raw reference;
- evidence symbol;
- evidence ISIN;
- evidence event date;
- evidence company;
- evidence action type;
- evidence factor;
- relevant existing exact-date/history records;
- unique active destination instrument ID/symbol/ISIN;
- classification;
- gate-by-gate results;
- classification reason;
- bootstrap fingerprint version;
- bootstrap fingerprint.

`bootstrap-safe-candidates.csv` must contain only `BOOTSTRAP_SAFE` rows.

## 18. Reconciliation Requirements

The summary must explicitly reconcile the V1.9 baseline population.

Example shape:

```text
V1.9 baseline targets:                  295
Still eligible for bootstrap audit:     ...
State changed since V1.9:               ...
Data/state anomalies:                   ...

BOOTSTRAP_SAFE:                         ...
SOURCE_EVIDENCE_MISMATCH:               ...
SOURCE_EVIDENCE_INCOMPLETE:             ...
COMPANY_IDENTITY_MISMATCH:              ...
CONFLICTING_ISIN_HISTORY:               ...
MULTIPLE_SOURCE_CONFLICT:               ...
ACTIVE_INSTRUMENT_MISMATCH:             ...
```

Every baseline row must account for exactly one output classification. Count mismatch is an audit failure.

## 19. Test Matrix

Implementation must be TDD-first using synthetic SQLite fixtures.

Minimum required cases:

1. Exact structured official evidence plus unique destination → `BOOTSTRAP_SAFE`.
2. Evidence symbol differs from parent import → `SOURCE_EVIDENCE_MISMATCH`.
3. Evidence ISIN differs from official ISIN → `SOURCE_EVIDENCE_MISMATCH`.
4. Evidence event date differs → `SOURCE_EVIDENCE_MISMATCH`.
5. Missing source provenance → `SOURCE_EVIDENCE_INCOMPLETE`.
6. Missing evidence ISIN → `SOURCE_EVIDENCE_INCOMPLETE`.
7. Deterministic normalized company match → company gate passes.
8. Material company mismatch → `COMPANY_IDENTITY_MISMATCH`.
9. No exact-date `instrument_isin_history` row → eligible to continue.
10. Existing identical exact-date history row → `DATA_STATE_ANOMALY`.
11. Existing conflicting exact-date history → `CONFLICTING_ISIN_HISTORY`.
12. Two structured evidence rows agreeing → may remain `BOOTSTRAP_SAFE`.
13. Two structured evidence rows conflicting → `MULTIPLE_SOURCE_CONFLICT`.
14. Active destination changes after V1.9 → `ACTIVE_INSTRUMENT_MISMATCH` or `STATE_CHANGED`.
15. Price scan becomes stale → `STATE_CHANGED`.
16. Current ISIN equals historical official ISIN → `DATA_STATE_ANOMALY`.
17. Unknown/non-official source evidence → cannot become `BOOTSTRAP_SAFE`.
18. Fingerprint stable for equivalent evidence.
19. Fingerprint changes when historical ISIN changes.
20. Fingerprint changes when destination ISIN changes.
21. Fingerprint changes when evidence source/date changes.
22. Every V1.9 baseline row reconciles exactly once.
23. `bootstrap-safe-candidates.csv` contains only `BOOTSTRAP_SAFE` rows.
24. SQLite write attempt fails under read-only/query-only mode.
25. CLI leaves the main database bytes unchanged.
26. WAL/SHM sidecar hashes remain unchanged.
27. Malformed V1.9 baseline is rejected instead of partially audited.

Additional tests should be added only when required by discovered schema behavior or a safety-relevant edge case.

## 20. Acceptance Criteria

V1.9.1 is accepted only when all of the following hold:

1. It consumes only V1.9 `LIKELY_MISSING_EVIDENCE` rows.
2. It revalidates current live state instead of trusting the historic count of 295.
3. Every V1.9 baseline target reconciles exactly once.
4. It never modifies identity state.
5. It never inserts historical ISIN rows.
6. It never invokes Quick Resolve.
7. It never approves Corporate Actions.
8. It never creates identity exceptions.
9. It never modifies raw EOD prices.
10. `BOOTSTRAP_SAFE` requires every approved gate.
11. Fuzzy company matching is not used.
12. Conflicting evidence always fails closed.
13. Unknown/ad-hoc source provenance cannot qualify.
14. Matching pre-existing exact-date history is surfaced as an anomaly rather than silently reused.
15. Conflicting history blocks bootstrap eligibility.
16. Fingerprints are deterministic and cover all safety-relevant state.
17. Database main file and WAL/SHM sidecars remain byte-for-byte unchanged.
18. Reports clearly explain every non-safe classification.
19. `bootstrap-safe-candidates.csv` contains only rows that passed every gate.

## 21. V1.9.1 / V1.9.2 Boundary

V1.9.1 may only:

```text
READ
VERIFY
CLASSIFY
EXPLAIN
FINGERPRINT
EXPORT
```

V1.9.1 may never:

```text
INSERT instrument_isin_history
UPDATE corporate_action_imports
resolve identity
invoke Quick Resolve
approve Corporate Actions
create exceptions
alter raw EOD
```

## 22. Future V1.9.2 Evidence Bootstrap Writer

A write-capable V1.9.2 may be considered only after V1.9.1 produces and the operator reviews a nonzero `BOOTSTRAP_SAFE` population.

Its minimum governed flow is:

```text
V1.9.1 BOOTSTRAP_SAFE candidate
        ↓
explicit operator request
        ↓
reload live import + evidence + destination + identity history
        ↓
recompute ca-isin-bootstrap-v1 fingerprint
        ↓
fingerprint identical?
      NO ─────► reject as stale
      YES
        ↓
insert exact historical ISIN evidence only
        ↓
record provenance/audit metadata
        ↓
run existing identity recheck / Quick Resolve logic unchanged
        ↓
identity resolved?
      NO ─────► stop and report
      YES
        ↓
normal Corporate Action workflow continues
```

V1.9.2 must not automatically approve Split/Bonus actions after identity resolution. Identity resolution, price validation, and Corporate Action approval remain separate operator-visible gates.

## 23. Non-Goals

V1.9.1 does not attempt to:

- solve the 49 V1.9 `NO_CANDIDATE` rows;
- repair historical symbol/merger/delisting mappings;
- modify Corporate Action parser behavior;
- fix the separate legacy compound/parser review population;
- relax Quick Resolve;
- infer identity from fuzzy company similarity;
- create a general-purpose identity-history migration;
- change chart adjustment behavior;
- change raw EOD data.

## 24. Completion Definition

V1.9.1 is complete when a live read-only run against the active database:

- reconciles the full current V1.9 `LIKELY_MISSING_EVIDENCE` baseline;
- classifies every target deterministically;
- produces the four required outputs;
- proves database and sidecar immutability;
- shows exactly which rows, if any, satisfy all `BOOTSTRAP_SAFE` gates;
- provides enough evidence detail to review those rows before any write-capable follow-on design begins.
