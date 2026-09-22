# Corporate Action V1.9 — Bulk Historical Identity Resolution Audit Design

**Project:** EOD Charting Platform  
**Area:** Corporate Actions — Phase 1 Split/Bonus  
**Version:** V1.9  
**Date:** 2026-08-16 IST  
**Status:** Approved design; implementation not started  

## 1. Purpose

V1.9 is a standalone, read-only diagnostic for the remaining Corporate Action identity backlog after V1.7.3.1 compound validation and bulk approval.

The immediate target is the population classified by V1.8 as:

`IDENTITY_MATCH_REQUIRED__PRICE_MATCHED`

V1.8 reported 344 such rows. These rows already have current passing Split/Bonus price evidence, but remain blocked on historical instrument identity resolution.

V1.9 answers one question:

> Of the unresolved, price-matched Split/Bonus imports, which rows are provably safe to resolve under the platform's existing identity safeguards, and why are the rest blocked?

V1.9 must not resolve, approve, mutate, or exception any row.

## 2. Scope

### In scope

- Unapproved Split/Bonus official imports currently blocked by identity resolution.
- Revalidation of row state and current price-validation evidence before identity analysis.
- Exact event-date historical ISIN evidence.
- NSE-scoped historical identity/alias chains, including deterministic multi-hop chains.
- Active destination candidate enumeration.
- Conflict and ambiguity detection.
- Deterministic classification.
- Deterministic evidence fingerprinting for rows that pass every strict gate.
- Read-only TXT, CSV, and JSON audit outputs.

### Out of scope

- Identity resolution writes.
- Corporate Action approval.
- Price exceptions.
- Historical ISIN exceptions.
- Symbol/ISIN updates.
- Raw EOD changes.
- Adjustment-engine changes.
- Corporate Action factor changes.
- Parser repairs for the separate 42-row complex-action backlog.
- No-price-data repair/backfill.
- UI changes.

## 3. Design Principle

V1.9 reuses the safety philosophy already present in the backend Quick Resolve path rather than inventing a looser parallel rule.

A row may be classified as **STRICT SAFE** only when a deterministic, evidence-backed historical identity lineage resolves to exactly one active current NSE instrument.

Symbol similarity, company-name similarity, or operator intuition alone can never establish STRICT SAFE.

Any uncertainty fails closed.

## 4. Classification Model

Every eligible row must land in exactly one deterministic classification.

### 4.1 STRICT SAFE

Requirements:

- Corporate Action import is still unresolved and unapproved.
- Action type is Split or Bonus.
- Latest completed official-import price scan is current and passing.
- Official event identity is available.
- Exact event-date historical ISIN evidence exists.
- Historical identity chain remains NSE-scoped.
- Valid multi-hop lineage is allowed when deterministic.
- Exactly one active current destination remains.
- No conflicting active candidate is supported by valid evidence.
- Deterministic evidence fingerprint can be constructed.

Future implication: candidate for a separate, explicitly approved V1.10 bulk identity-resolution workflow. V1.9 itself performs no resolution.

### 4.2 LIKELY — MISSING EVIDENCE

A unique or strong candidate appears plausible, but the exact evidence required by the existing safeguard is absent or insufficient.

Examples:

- Unique active symbol/company candidate but no exact event-date ISIN evidence.
- Historical lineage appears plausible but has an evidentiary gap.

These rows are not actionable. They should drive identity-evidence backfill work.

### 4.3 AMBIGUOUS

Two or more plausible destinations remain, or evidence conflicts.

Examples:

- Multiple active candidates.
- Conflicting ISIN paths.
- Identity graph cycle.
- Multi-hop lineage branches into multiple current instruments.

These rows require manual identity investigation or better historical evidence.

### 4.4 NO CANDIDATE

No usable active current destination can be established from available evidence.

Likely causes include delisting, incomplete historical identity coverage, symbol lineage gaps, or missing master data.

### 4.5 DATA/STATE ANOMALY

The row or supporting evidence violates V1.9 assumptions.

Examples:

- Latest price evidence became stale.
- Missing/malformed identity data.
- Cross-exchange lineage.
- Impossible or inconsistent dates.
- Structural database inconsistency.
- Fingerprint cannot be built deterministically.

### 4.6 STATE CHANGED

A V1.8 target row is no longer an active V1.9 target because it was resolved, approved, or otherwise changed after V1.8.

STATE CHANGED is reported separately and is not counted as an actively analyzed unresolved row.

## 5. Target Population and Drift Protection

V1.9 must not blindly assume the V1.8 count remains 344.

At runtime it must:

1. Locate unresolved, unapproved Split/Bonus imports matching the V1.8 identity-only/price-matched profile.
2. Re-check the latest completed official-import price scan.
3. Re-check scan freshness using symbol, exchange, factor, date window, and compound metadata/fingerprint where applicable.
4. Separate state-changed or stale rows before identity classification.

The summary must reconcile the expected V1.8 population against current live state, for example:

```text
Expected V1.8 target population: 344
Still eligible for V1.9 analysis: 342
State changed since V1.8: 2
Price evidence stale/anomalous: 0

STRICT SAFE: ...
LIKELY — MISSING EVIDENCE: ...
AMBIGUOUS: ...
NO CANDIDATE: ...
DATA/STATE ANOMALY: ...
```

## 6. Evidence Data Flow

For each target row:

```text
Unresolved official Split/Bonus import
        │
        ├── verify unresolved/unapproved state
        ├── verify latest official price scan is MATCHED
        ├── verify scan is current
        │
        ▼
Official event identity
(exchange + event symbol + official ISIN + ex-date)
        │
        ▼
Exact event-date historical identity evidence
        │
        ├── absent ───────────────► LIKELY / NO CANDIDATE
        ├── conflicting ──────────► AMBIGUOUS
        │
        ▼
Historical NSE identity/alias graph
        │
        ├── follow deterministic multi-hop lineage
        ├── reject cross-exchange paths
        ├── reject conflicting ISIN paths
        ├── reject unrelated/stale evidence
        ▼
Current destination candidates
        │
        ├── exactly one active + fully proven ─► STRICT SAFE
        ├── multiple plausible active ─────────► AMBIGUOUS
        └── none usable ───────────────────────► NO CANDIDATE
```

## 7. Multi-Hop Historical Identity

V1.9 must support deterministic historical chains such as:

```text
OLD_SYMBOL_A / ISIN-A
        ↓
OLD_SYMBOL_B / ISIN-B
        ↓
CURRENT_SYMBOL / ISIN-C
```

A multi-hop path may qualify as STRICT SAFE only when:

- the Corporate Action's event-date identity is anchored by exact event-date evidence;
- every hop is supported by the platform's known identity-history relationships;
- the path remains exchange-consistent;
- the path terminates in exactly one active current destination;
- no conflicting path supports another active candidate.

Textual equality of old and current symbols is not required.

## 8. Candidate Rejection Evidence

For audit transparency, each row should include not only the selected destination, if any, but also competing candidates and why they were rejected.

Possible rejection reasons include:

- wrong exchange;
- inactive historical-only symbol;
- event-date ISIN mismatch;
- conflicting lineage;
- evidence date does not cover event date;
- duplicate active candidate;
- company-name similarity only, with no identity proof;
- unsupported graph hop.

## 9. Deterministic Evidence Fingerprint

Every STRICT SAFE row must receive a deterministic evidence fingerprint.

The fingerprint input should include, in canonical sorted form:

- Corporate Action import ID;
- exchange;
- official event symbol;
- official event ISIN;
- ex-date;
- action type;
- current passing scan identity/freshness fields needed to bind the audit to the validated event;
- exact event-date evidence identifiers and normalized values;
- ordered identity-chain nodes/hops;
- final active destination symbol and ISIN;
- relevant candidate-set identity so a newly appearing competing candidate changes the fingerprint.

The fingerprint algorithm should be SHA-256 over a canonical UTF-8 serialization.

The fingerprint must be stable when evidence is unchanged and must change whenever any safety-relevant evidence changes.

V1.9 fingerprints are evidence snapshots only; they confer no write authority.

## 10. Read-Only Architecture

Recommended implementation: standalone Node.js + SQLite diagnostic, following the operational model established by V1.8.

Reasons:

- no production source modification;
- smallest blast radius;
- easy to run against the active database;
- easy to prove query-only behavior;
- suitable for exploratory backlog classification before designing any mutation path.

### Runtime guarantees

The diagnostic must:

- open SQLite with a read-only connection;
- set and verify `PRAGMA query_only = 1`;
- abort if required tables/columns are unavailable;
- perform no live-database schema changes;
- perform no live-database transaction containing writes;
- write output files only to a timestamped `tmp` audit directory.

## 11. Output Artifacts

V1.9 should produce four files.

### 11.1 `identity-resolution-audit-summary.txt`

Human-readable totals, reconciliation, classification counts, anomalies, and selected STRICT SAFE evidence summaries.

### 11.2 `identity-resolution-audit.csv`

One row per active analyzed Corporate Action, suitable for spreadsheet review.

Recommended fields:

- import ID;
- exchange;
- official symbol;
- official ISIN;
- company name;
- ex-date;
- action type;
- price scan status/confidence;
- price-scan currentness;
- classification;
- classification reason;
- exact event-date evidence found?;
- evidence source/date/ISIN;
- identity-chain depth;
- normalized identity-chain path;
- active candidate count;
- candidate symbols/ISINs;
- selected destination symbol/ISIN;
- rejected candidates/reasons;
- evidence fingerprint;
- STRICT SAFE boolean.

### 11.3 `identity-resolution-audit.json`

Full machine-readable evidence, including structured chain nodes, candidate records, rejected-candidate reasons, and fingerprint inputs.

### 11.4 `strict-safe-candidates.csv`

Contains only rows that passed every STRICT SAFE gate.

This file is an audit output only. It must not be accepted by any mutation path without live backend revalidation in a future version.

## 12. Failure Handling

V1.9 fails closed.

| Condition | Required behavior |
|---|---|
| No exact event-date ISIN evidence | LIKELY — MISSING EVIDENCE or NO CANDIDATE |
| Multiple active candidates | AMBIGUOUS |
| Conflicting historical ISIN paths | AMBIGUOUS |
| Graph loop/cycle | AMBIGUOUS or DATA/STATE ANOMALY |
| Cross-exchange path | DATA/STATE ANOMALY |
| Latest price evidence stale | DATA/STATE ANOMALY |
| Corporate Action resolved since V1.8 | STATE CHANGED |
| Missing required database structure | Abort audit |
| Cannot prove query-only connection | Abort audit |
| Fingerprint not deterministic | Cannot be STRICT SAFE |
| Malformed dates/identity fields | DATA/STATE ANOMALY |

A partial audit must never be reported as a complete successful audit if structural database failure prevented evaluation.

## 13. Testing Requirements

Before use against the live database, synthetic fixtures must cover at least:

1. Direct exact historical match → STRICT SAFE.
2. Valid deterministic multi-hop lineage → STRICT SAFE.
3. Unique candidate but no event-date evidence → LIKELY — MISSING EVIDENCE.
4. Two active candidates → AMBIGUOUS.
5. Conflicting historical ISIN paths → AMBIGUOUS.
6. No destination candidate → NO CANDIDATE.
7. Stale price scan → DATA/STATE ANOMALY.
8. Already-resolved import → STATE CHANGED/excluded from active target.
9. Cross-exchange candidate → must not qualify.
10. Identity graph cycle → AMBIGUOUS or anomaly.
11. Fingerprint stability with unchanged evidence.
12. Fingerprint change when evidence changes.
13. Read-only mutation attempt is impossible.
14. Classification totals reconcile exactly with the analyzed population.
15. STRICT SAFE export contains only rows passing every gate.
16. Company-name or symbol similarity alone cannot create STRICT SAFE.
17. Competing candidate introduction changes the fingerprint or removes STRICT SAFE status.

## 14. Acceptance Criteria

V1.9 is accepted only when all of the following hold:

1. It targets the identity-only, price-matched unresolved Split/Bonus population.
2. It revalidates current state rather than assuming the V1.8 count.
3. Every active analyzed row receives exactly one deterministic classification.
4. STRICT SAFE uses the full existing identity-safeguard philosophy.
5. Exact event-date identity evidence is mandatory for STRICT SAFE.
6. Deterministic multi-hop identity chains are supported.
7. Ambiguous or conflicting chains cannot qualify.
8. Same/similar company name or symbol alone cannot qualify.
9. Every STRICT SAFE row has one active destination and zero unresolved competing candidates.
10. Every STRICT SAFE row has an auditable evidence chain and deterministic SHA-256 fingerprint.
11. Read-only database behavior is explicitly verified.
12. Live database state is unchanged before/after the diagnostic.
13. Output counts reconcile exactly.
14. `strict-safe-candidates.csv` contains only rows passing all strict gates.
15. No approval, identity-resolution, exception, or EOD mutation capability exists in V1.9.

## 15. V1.9 / V1.10 Boundary

V1.9 may only:

```text
READ
CLASSIFY
EXPLAIN
FINGERPRINT
EXPORT
```

V1.9 may not:

```text
RESOLVE IDENTITY
UPDATE IMPORTS
APPROVE ACTIONS
WRITE EXCEPTIONS
CHANGE SYMBOLS
CHANGE ISINs
CHANGE EOD DATA
```

A future V1.10 Bulk Historical Identity Resolver must be a separate implementation and separately approved design.

Minimum V1.10 safety boundary, if later approved:

```text
V1.9 STRICT SAFE candidate
        ↓
explicit operator action
        ↓
backend reloads current live evidence
        ↓
backend recomputes V1.9 evidence fingerprint
        ↓
fingerprint identical?
   YES ─────► continue
   NO  ─────► reject as stale
        ↓
re-check price-validation gate
        ↓
identity resolution only
        ↓
Corporate Action remains subject to normal approval workflow
```

Identity resolution and Corporate Action approval must not be collapsed into one uncontrolled operation.

## 16. Recommended Implementation Approach

Three approaches were considered:

1. **Standalone Node/SQLite diagnostic — selected.** Lowest risk and no production-source change.
2. Rust diagnostic command inside the application. Better direct backend reuse, but unnecessary production-code surface for an exploratory read-only audit.
3. Temporary UI audit panel. Useful only after the workflow is proven; excessive for first-pass backlog analysis.

V1.9 will use approach 1.

## 17. Implementation Preconditions

Implementation must not begin until:

- this design is reviewed and accepted by the user;
- the implementation plan is written separately;
- the current database schema and identity-history query paths are inspected from the fresh project source;
- the V1.8 live audit outputs remain available as a comparison baseline.

## 18. Design Self-Review

- **Placeholders:** none.
- **Contradictions:** none identified.
- **Scope:** limited to a read-only identity-resolution audit.
- **Ambiguity:** STRICT SAFE requirements, mutation boundary, state drift, and fingerprint behavior are explicit.
- **Safety posture:** fail closed; no write authority is created by audit outputs.

