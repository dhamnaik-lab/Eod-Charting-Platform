# Identity ER2-B — Approved Design Authority Binding

**Status:** GOVERNING EXECUTION BINDING / ORIGINAL DESIGN APPROVED IN CHAT  
**Date:** 2026-09-12 IST  
**Workstream:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Governing approved design

The full ER2-B written design was approved by the user before implementation.

Original approved design artifact:

```text
2026-09-12-identity-er2b-deterministic-rule-evaluation-design.md
SHA256:
E7A044F4142B94D20AD8C38FDB89EAB2E9E600EEA15E5193BE1F7D3DF3B9600C
```

This binding does not redefine that design. It preserves the execution authority if the exact original design file is not yet present project-locally.

## Frozen implementation boundary

ER2-B may add only pure deterministic Identity evaluation on top of the frozen ER2-A contract.

Authorized production source:

```text
src-tauri-shell\src\database\identity_evidence_resolver.rs
```

ER2-B may not silently redefine:

```text
statuses
conclusions
rule IDs
authority classes
evidence kinds
source-availability values
provenance invariants
ER2-A structural validators
```

No database, network, Tauri, frontend, Apply, source-recovery, AI, schema, Cargo-dependency, or ER2-C integration authority is granted.

## Frozen result precedence

```text
SOURCE_UNAVAILABLE
→ HARD CONFLICT
→ EXPLICIT HIGH-RISK CONTINUITY
→ ORDINARY CONFIRMATION
→ PROBABLE_REVIEW (no enabled ER2-B V1 rule)
→ INSUFFICIENT_EVIDENCE
```

Hard-conflict specificity:

```text
E ACTIVE_DUPLICATE_ISIN
> G RECYCLED_SYMBOL
> F DELISTED/INACTIVE
> D UNPROVEN_ISIN_TRANSITION
```

## Rules A-I

```text
A SYMBOL_CHANGE_SAME_ISIN_OFFICIAL_HISTORY_V1
B NAME_CHANGE_SAME_IDENTITY_OFFICIAL_HISTORY_V1
C SYMBOL_AND_NAME_CHANGE_OFFICIAL_CONTINUITY_V1
D ISIN_CHANGE_REQUIRES_EXPLICIT_CONTINUITY_V1
E ACTIVE_DUPLICATE_ISIN_CONFLICT_V1
F DELISTED_INACTIVE_NOT_SYMBOL_CHANGE_V1
G RECYCLED_SYMBOL_REQUIRES_IDENTITY_HISTORY_V1
H SERIES_CHANGE_NOT_NEW_SECURITY_BY_DEFAULT_V1
I INCOMPLETE_HISTORY_REQUIRES_MORE_EVIDENCE_V1
```

Infrastructure source-unavailable rule remains:

```text
REQUIRED_OFFICIAL_SOURCE_UNAVAILABLE_V1
```

Reserved rule remains disabled:

```text
NO_DETERMINISTIC_IDENTITY_RULE_MATCH_V1
```

## Rule-H safety condition

Same-symbol/different-series is confirmed as the same security only when exchange, symbol, non-empty ISIN, company identity and authoritative series-change evidence agree.

A different ISIN must prevent Rule H and flow into Rule D/G/E/F conflict handling as applicable.

## Error channel

Internal-only evaluation errors:

```text
INVALID_INPUT
NO_MISMATCH_TO_RESOLVE
AMBIGUOUS_DETERMINISTIC_CANDIDATES
INVALID_CONSTRUCTED_RESULT
```

They are not serialized resolver statuses or new rule IDs.

## TDD and validation

Implementation must demonstrate RED before GREEN for each behavior group, then run:

```text
full ER2 resolver tests
NSE Identity regressions
BSE Identity regressions
ER1 Source Health regressions
cargo check --locked --offline
source/hash preservation checks
```

Portable build is not required for this pure internal Rust scope.

## Completion boundary

ER2-B completion does not authorize ER2-C.
