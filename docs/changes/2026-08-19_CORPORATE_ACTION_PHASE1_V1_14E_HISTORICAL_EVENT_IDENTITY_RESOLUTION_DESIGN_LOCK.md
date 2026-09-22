# Corporate Action Phase 1 — V1.14E Historical Event Identity Resolution Design Lock

**Date:** 2026-08-19 IST  
**Mode:** DOCUMENTATION / DESIGN AUTHORITY ONLY  
**Implementation:** NOT IMPLEMENTED  
**Mutation authorization:** NONE

## Basis

This design lock is bound to the reviewed V1.14D.1 report set:

```text
Run: corporate-action-v1-14d-1-raw-nse-identity-source_20260819_015801_079
Status: SOURCE_VERIFICATION_COMPLETE
Chains: 44
Events: 184
Exact raw NSE identity matches: 44
Mismatches: 0
Missing: 0
Provenance complete: true
```

Raw NSE identity authority:

```text
E:\TA Projects\Corporate Actions Raw\NSE\Identity\SymbolChanges\nse_identity_symbol_changes.csv
SHA-256: 921bd8679e7dff909b12efd152fe64b91a26b124976e919f120a2de1db3221e6
Bytes: 66836
Schema: HEADERLESS_NSE_4_COLUMN
Parsed rows: 1030
```

## Locked architecture decision

V1.14E selects:

```text
DEDICATED CORPORATE ACTION EVENT-IDENTITY RESOLUTION TABLE
+
CENTRAL EFFECTIVE EVENT-IDENTITY PROJECTION
```

It rejects:

```text
rewriting raw corporate_action_imports.symbol
using corporate_action_import_decisions as the canonical resolved-symbol store
```

The existing decision table remains suitable for audit provenance. A future V1.14E apply may
record an explicit resolution decision there, but consumers must read structured resolution
state from the dedicated resolution model.

## First-tranche meaning

The 184-row first tranche establishes only an event-time **symbol** when the event predates an
exact NSE-verified symbol transition.

A symbol transition is not sufficient proof of historical ISIN.

Therefore:

```text
event_symbol = verified historical old symbol
event_isin   = nullable
```

where independent historical-ISIN evidence is not sufficient.

## Safety boundary

This package performs documentation/evidence writes only.

It does not:

- open SQLite;
- patch Rust/TypeScript/React production source;
- change database schema;
- create resolution rows;
- Quick Resolve imports;
- approve Corporate Actions;
- change identity/ISIN history;
- change EOD data;
- perform Git operations.

## Next gate

Before implementation planning is finalized, review a fresh source snapshot containing the
current Corporate Action backend, schema owner, Tauri boundary, and Official Imports UI.

Only after the written V1.14E design is reviewed/approved should an implementation plan be
created.
