# Corporate Action Phase 1 V1.14E — Historical Event Identity Resolution Design

**Project:** EOD Charting Platform  
**Version:** V1.14E  
**Date:** 2026-08-19 IST  
**Status:** Design locked; implementation not started  
**Mutation authorization:** NONE

## 1. Purpose

V1.14E defines how the platform should represent a historical Corporate Action whose
official retained/API symbol has been normalized to a later/current symbol even though the
event occurred while an older NSE symbol was in force.

The design is based on the reviewed V1.14D.1 authority:

- 184 Corporate Action events;
- 44 distinct symbol-transition chains;
- 44 exact raw NSE identity-source matches;
- 0 raw mismatches;
- 0 raw missing transitions;
- complete source provenance;
- raw identity source SHA-256
  `921bd8679e7dff909b12efd152fe64b91a26b124976e919f120a2de1db3221e6`.

V1.14E does not authorize database mutation and does not implement the model.

## 2. Problem Statement

For the reviewed V1.14C/V1.14D.1 cohort, the retained Corporate Action source represents
historical events using the later/current API symbol. The NSE identity source independently
proves that the older symbol was in force before a verified symbol-change effective date.

The platform therefore needs to represent two different facts simultaneously:

```text
raw source identity
    symbol / ISIN exactly as retained from Corporate Action ingestion

historical event identity
    symbol valid for event-time matching and historical market-data lookup
```

Collapsing those facts into one mutable `symbol` field would destroy source provenance.

## 3. Existing Contracts to Preserve

The existing Corporate Action architecture already treats identity, price validation, and
approval as separate gates. Existing decision records are used as an audit trail for actions
such as price-validation exceptions, historical-ISIN bootstrap decisions, and verified Quick
Resolve decisions.

V1.14E preserves those contracts:

- raw Corporate Action imports remain source provenance;
- decision records remain audit/history records;
- identity resolution does not imply approval;
- price validation remains independent;
- existing ISIN mismatch safeguards remain independent;
- raw EOD remains immutable;
- Corporate Action adjustments remain read-time behavior.

## 4. Approaches Considered

### 4.1 Rewrite `corporate_action_imports.symbol`

**Rejected.**

Advantages:

- smallest apparent schema surface;
- existing readers would immediately see the historical symbol.

Problems:

- destroys the exact symbol retained from the official Corporate Action source;
- makes later provenance review ambiguous;
- conflates source truth with derived event-time interpretation;
- complicates idempotency and re-import/dedupe behavior;
- does not solve independent historical-ISIN uncertainty.

### 4.2 Store the resolved symbol only in `corporate_action_import_decisions`

**Rejected as canonical state.**

Advantages:

- uses an existing audit mechanism;
- no dedicated resolution table.

Problems:

- decision rows are an audit log, not a structured current-state projection;
- consumers would need to parse reason text or select competing decision rows;
- indexing and deterministic event-symbol lookup would be poor;
- correction/supersession semantics become implicit;
- scanner/UI/backend could interpret the log differently.

A V1.14E apply may still record a decision entry for audit provenance, but the decision log
must not be the canonical event-identity store.

### 4.3 Dedicated event-identity resolution table + central projection

**Selected.**

A dedicated structured row preserves the raw import while giving every consumer one explicit,
queryable event-time identity projection.

This is the smallest model that cleanly separates:

```text
raw official import
current/canonical instrument identity
historical event-time identity
decision/audit history
```

## 5. Recommended Data Model

Implementation should introduce a table conceptually named:

```text
corporate_action_event_identity_resolutions
```

The final migration spelling must be source-reviewed before implementation, but the semantic
columns are locked as follows:

```text
id                              INTEGER PRIMARY KEY
import_id                       INTEGER NOT NULL UNIQUE
exchange                        TEXT NOT NULL

raw_symbol                      TEXT NOT NULL
raw_isin                        TEXT

event_symbol                    TEXT NOT NULL
event_isin                      TEXT NULL

resolution_type                 TEXT NOT NULL
resolution_authority            TEXT NOT NULL

chain_id                        TEXT NOT NULL
transition_old_symbol           TEXT NOT NULL
transition_new_symbol           TEXT NOT NULL
transition_effective_date       TEXT NOT NULL

raw_identity_source_ref         TEXT NOT NULL
raw_identity_source_sha256      TEXT NOT NULL
raw_identity_source_line_number INTEGER NOT NULL

v114d1_evidence_sha256          TEXT NOT NULL
resolution_fingerprint          TEXT NOT NULL

created_at                      TEXT NOT NULL
```

### 5.1 First-tranche resolution type

The first writable tranche uses a specific semantic class, conceptually:

```text
NSE_VERIFIED_PRE_TRANSITION_EVENT_SYMBOL
```

It means only:

> The Corporate Action event predates an NSE-verified symbol transition, therefore the
> event-time symbol is the verified old symbol.

It does not establish a historical ISIN by itself.

### 5.2 `event_isin` is nullable by design

V1.14E must not derive or fabricate historical ISIN solely from a symbol-change row.

For the reviewed cohort, some rows have historical-ISIN evidence that is incomplete or
conflicting. Therefore the first tranche may write:

```text
event_symbol = verified historical symbol
event_isin   = NULL
```

unless an independently authorized exact historical-ISIN source proves the value.

This is intentional. Symbol resolution and ISIN resolution are separate dimensions.

## 6. Immutable Raw Import Contract

V1.14E must never rewrite these source-provenance fields merely to make historical matching
easier:

```text
corporate_action_imports.symbol
corporate_action_imports.isin
corporate_action_imports.source
corporate_action_imports.purpose_raw
corporate_action_import_evidence
```

The raw/API symbol remains visible as the source supplied it.

## 7. Effective Event Identity Projection

Production code should gain one centralized resolver conceptually equivalent to:

```text
load_effective_corporate_action_event_identity(import_id)
```

It returns a projection, not a mutation:

```text
importId
exchange
rawSymbol
rawIsin
eventSymbol
eventIsin
resolutionType
resolutionAuthority
resolutionFingerprint
remainingIsinReviewState
```

Rules:

1. If no approved event-identity resolution exists, `eventSymbol = rawSymbol`.
2. If an exact V1.14E resolution exists, `eventSymbol = resolution.event_symbol`.
3. `eventIsin` remains nullable and does not silently fall back to an unrelated conflicting
   historical-ISIN row.
4. The projection must expose both raw and event-time identities to callers.
5. Callers must not independently reimplement V1.14E date/transition logic.

## 8. Date-Gating Rule

The V1.14E first tranche is valid only when:

```text
Corporate Action event date < verified NSE transition effective date
```

If:

```text
event date == transition date
```

or:

```text
event date > transition date
```

the old symbol cannot be assigned by this rule.

Such a row must fail closed and require explicit review or a different identity rule.

The implementation must not assume that every event associated with a chain belongs to the
old symbol.

## 9. Authority Rule

A first-tranche resolution requires all of the following:

```text
import is one of the exact reviewed 184 events
chain is one of the exact reviewed 44 V1.14C chains
V1.14D.1 disposition = RAW_NSE_IDENTITY_EXACT_MATCH
exact raw match count = 1
raw source provenance complete = true
raw source SHA-256 exact
event date precedes transition date
raw/current API symbol matches the frozen V1.14C authority
old/new/effective-date tuple matches the frozen V1.14D.1 authority
```

No apply-time auto-discovery may add a 185th row.

## 10. Resolution Fingerprint

Each import must receive a deterministic SHA-256 fingerprint over all safety-relevant state,
including at minimum:

```text
version
import ID
exchange
raw symbol
raw ISIN
Corporate Action event date
event symbol
event ISIN/null marker
chain ID
transition old symbol
transition new symbol
transition effective date
V1.14D.1 chain-report row identity
raw identity source path
raw identity source SHA-256
raw identity line number
resolution type
resolution authority
```

Equivalent data must produce the same fingerprint regardless of map/object ordering.

Any changed safety-relevant field invalidates Preview authorization.

## 11. Consumer Semantics

### 11.1 Historical market-data lookup and validation

Where Corporate Action logic needs the trading symbol that was valid on the event date, it
should consume `eventSymbol` from the centralized projection.

This is the primary benefit of V1.14E.

### 11.2 Raw-source display and provenance

UI/details must continue to show the raw source identity separately.

Recommended labels:

```text
Raw NSE/API symbol       NAVA
Historical event symbol  NBVENTURES
Identity basis           NSE symbol change
Transition effective     2022-07-29
```

Do not silently replace the displayed source symbol.

### 11.3 Current/canonical destination instrument

V1.14E does not redefine how an approved Corporate Action links to the current canonical
instrument. That behavior must be inspected in the fresh production source before
implementation and preserved unless a separate redesign is approved.

### 11.4 ISIN safeguards

A verified historical symbol does not override an unresolved or conflicting ISIN condition.

Rows may therefore become:

```text
event symbol resolved
ISIN still requires review
```

That is a valid state.

## 12. Workflow and Quick Resolve

V1.14E must not make Quick Resolve an implicit side effect of inserting an event-identity
resolution row.

Implementation should perform identity re-evaluation through one canonical backend path after
resolution insertion.

Permitted outcome classes should include:

```text
IDENTITY_READY
IDENTITY_READY_ISIN_REVIEW_REMAINS
STATE_CHANGED
BLOCKED
```

Only if the existing, source-reviewed identity recheck concludes that all normal identity
requirements are satisfied may a targeted workflow transition occur.

If the implementation reuses existing Quick Resolve, it must:

- invoke it only for explicitly authorized import IDs;
- run it after the resolution record exists;
- require the expected result;
- roll back the entire transaction on an unexpected result;
- never auto-approve the Corporate Action.

The design deliberately does not hard-code that all 184 rows must become `PENDING`.

## 13. Approval Boundary

V1.14E identity resolution is not Corporate Action approval.

After successful identity resolution, normal gates remain authoritative:

```text
parse/factor state
identity state
ISIN safeguards
price validation where applicable
compound-event validation where applicable
operator approval policy
```

No V1.14E maintenance command may call an approval API.

## 14. First Writable Tranche

The first writable implementation may target only the exact frozen population:

```text
184 Corporate Action imports
44 verified NSE symbol chains
```

It must not target:

- the four successor/restructure cases;
- missing-historical-symbol cases;
- ambiguous event-time identity cases;
- future newly discovered normalized events;
- any row not fingerprint-bound to the reviewed authority.

A future generalized event-time resolver is a separate version and design.

## 15. Preview → Apply Safety Architecture

A future implementation must use the established controlled-write pattern.

### 15.1 Preview

Preview must:

- require the application/database to be quiescent;
- hash/copy the live SQLite family to a private snapshot;
- open only the private snapshot for analysis;
- verify exact V1.14D.1 authority;
- re-read all 184 imports;
- validate event dates and raw symbols;
- validate that no existing resolution conflicts;
- build all 184 resolution fingerprints;
- produce a deterministic apply-plan fingerprint;
- perform zero writes.

Preview status is `READY` only when all 184 authorized rows reconcile.

### 15.2 Apply

Apply must:

- require an explicitly reviewed READY Preview manifest;
- require the exact live database family represented by Preview;
- create and hash-verify a pre-write backup;
- open one outer SQLite write transaction;
- re-read/revalidate all 184 targets inside the transaction;
- recompute candidate and plan fingerprints;
- abort before the first write on any drift;
- insert the dedicated resolution records;
- record audit decisions if implemented;
- perform only the approved targeted identity re-evaluation;
- commit once, after all authorized rows succeed.

Logical batches may be used for reporting/progress but must not create partial commits.

## 16. Idempotency

A rerun after a successful apply may report `ALREADY_APPLIED` only when the existing
resolution row has:

- the same import ID;
- the same event symbol;
- the same raw-source authority;
- the same chain/effective date;
- the same resolution fingerprint;
- matching apply provenance.

If a row exists with different material content:

```text
CONFLICTING_PRIOR_RESOLUTION
```

and the complete apply must stop.

V1.14E must not overwrite or silently update a conflicting resolution.

## 17. Decision Audit

The existing `corporate_action_import_decisions` table should remain an audit log.

A future apply may record a decision type such as:

```text
HISTORICAL_EVENT_IDENTITY_RESOLUTION_V1_14E
```

with the resolution fingerprint, chain ID, raw-source SHA-256, and apply-plan fingerprint.

This decision is corroborating audit provenance. It is not the canonical event-symbol store.

## 18. Protected Tables and State

A V1.14E apply must not directly mutate:

```text
corporate_actions
corporate_action_import_evidence
instrument_identity_history
instrument_isin_history
instruments
scan_runs
corporate_action_scan_results
eod_prices
raw/binary EOD data
```

It must not alter:

```text
Corporate Action factors
price-validation evidence
compound-event factors
approval exceptions
approved Corporate Action IDs
```

Any import workflow update must occur only through the separately source-reviewed identity
recheck/Quick Resolve path and only for authorized import IDs.

## 19. Post-Apply Independent Audit

A separate read-only post-audit must be ready before live Apply is authorized.

It must prove:

- exactly the authorized resolution rows were added;
- raw import symbols/ISINs are unchanged;
- protected tables are unchanged;
- no Corporate Action approvals occurred;
- no unexpected workflow rows changed;
- each inserted row exactly matches its frozen authority and fingerprint;
- database integrity and foreign-key checks pass.

As with V1.13, the post-audit must be independent of the write orchestrator.

## 20. UI Design

The Official Imports detail view should eventually distinguish:

```text
Source identity
  Raw symbol              NAVA
  Raw ISIN                <retained source value>

Event-time identity
  Historical symbol       NBVENTURES
  Historical ISIN         unknown / verified value
  Resolution              NSE VERIFIED SYMBOL TRANSITION
  Transition              NBVENTURES -> NAVA
  Effective date          2022-07-29

Workflow
  Identity                SYMBOL RESOLVED
  ISIN                    MATCHED / REVIEW REQUIRED
  Price validation        existing state
  Approval                existing state
```

A bulk action must not be introduced until the backend controlled workflow is proven.

## 21. Test Strategy

Implementation must be TDD-first.

Minimum test matrix:

1. exact reviewed pre-transition event resolves to old symbol;
2. event exactly on transition date fails closed;
3. event after transition date fails closed;
4. raw import symbol remains byte/field identical;
5. raw import ISIN remains unchanged;
6. resolution row stores exact raw-source SHA-256 and line number;
7. resolution fingerprint is deterministic;
8. fingerprint changes when event date changes;
9. fingerprint changes when transition date changes;
10. fingerprint changes when event symbol changes;
11. import outside the frozen 184 is rejected;
12. duplicate exact resolution is idempotent only with matching provenance;
13. conflicting prior resolution blocks the complete apply;
14. no event ISIN is fabricated from symbol transition alone;
15. rows with historical-ISIN conflicts retain ISIN-review state;
16. scanner/history lookup consumes event symbol through one projection;
17. raw/API symbol remains available for provenance/UI;
18. no Corporate Action approval occurs;
19. no `instrument_isin_history` mutation occurs;
20. no `instrument_identity_history` mutation occurs;
21. no raw EOD mutation occurs;
22. one candidate failure rolls back all V1.14E writes;
23. Preview writes zero rows;
24. Apply without exact READY manifest is impossible;
25. database-family drift requires a new Preview;
26. post-audit detects any protected-table change.

## 22. Source Files to Inspect Before Implementation

A fresh production-source snapshot is mandatory before implementation planning is finalized.

At minimum inspect:

```text
src-tauri-shell/src/database/corporate_action_imports.rs
src-tauri-shell/src/database/instrument_mutations.rs
src-tauri-shell/src/database.rs
src-tauri-shell/src/main.rs
src-tauri-shell/src/database/corporate_action_imports/controlled_identity_repair.rs
src/platform/types.ts
src/types/desktop.ts
src/platform/tauriDesktop.ts
src/components/DatabaseToolsDialogs.tsx
src/features/corporateActions/corporateActionValidation.ts
src/features/corporateActions/corporateActionIdentityRecommendations.ts
```

Also inspect the schema/migration owner for `corporate_action_import_decisions` and the Corporate
Action import tables.

The implementation plan must use exact current function/type/schema names from that fresh
source. This design deliberately does not guess migration function locations or current row
struct field names.

## 23. Risks

### Risk: treating a rename as an ISIN proof

Mitigation: first tranche resolves only event symbol; `event_isin` remains nullable.

### Risk: destroying source provenance

Mitigation: raw import symbol/ISIN are immutable under V1.14E.

### Risk: competing identity engines

Mitigation: one centralized effective-event-identity projection; consumers do not independently
traverse symbol history.

### Risk: using decision text as data

Mitigation: dedicated structured resolution table; decisions remain audit provenance.

### Risk: auto-resolving newly discovered rows

Mitigation: first write package is hard-bound to the reviewed 184 import IDs and fingerprints.

### Risk: identity resolution accidentally approves actions

Mitigation: explicit approval prohibition plus protected-table post-audit.

## 24. Acceptance Criteria for the Future Implementation

Implementation may be considered complete only when:

1. exact V1.14D.1 authority is hash-bound;
2. all 184 candidates reconcile before write;
3. raw Corporate Action import identity is unchanged;
4. a dedicated structured event-identity resolution exists per authorized row;
5. event-time symbol is date-gated by the verified transition;
6. historical ISIN is never invented from a symbol transition;
7. decisions are audit records, not canonical resolution state;
8. one central projection drives event-time symbol consumption;
9. approval remains a separate gate;
10. protected tables remain unchanged except separately authorized targeted workflow status;
11. apply is one all-or-rollback transaction;
12. independent post-audit reports full success.

## 25. Design Self-Review

- **Placeholders:** none in the semantic design.
- **Contradictions:** none identified.
- **Scope:** first writable model is limited to the exact 184-event/44-chain authority.
- **Ambiguity:** event-date boundary, raw/source immutability, nullable event ISIN, approval
  separation, idempotency, and mutation boundaries are explicit.
- **Implementation dependency:** exact source locations/names require a fresh source snapshot
  before the implementation plan is finalized.
- **Mutation authority:** NONE.
