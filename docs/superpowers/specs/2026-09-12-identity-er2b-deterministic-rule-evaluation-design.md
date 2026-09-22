# Identity ER2-B — Deterministic Resolver Rule Evaluation Design

**Status:** PROJECT-LOCAL GOVERNING DESIGN CONSOLIDATION / ER2-B IMPLEMENTED  
**Date:** 2026-09-12 IST  
**Workstream:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Authority note

The user approved the full ER2-B design section-by-section before implementation.

Approval-time design artifact:

```text
2026-09-12-identity-er2b-deterministic-rule-evaluation-design.md
SHA256:
E7A044F4142B94D20AD8C38FDB89EAB2E9E600EEA15E5193BE1F7D3DF3B9600C
```

That exact approval-time byte artifact was not installed project-locally during the R1B implementation run. This project-local document is a semantic consolidation of the approved design decisions, the accepted execution binding, and the approved implementation plan. It **does not claim byte identity** with the approval-time artifact and does not redefine ER2-B behavior.

Governing supporting authorities:

```text
ER2-A full approved design
230EDC694E92F87E5CF9B740B39ED155AB18AA7373186FF35BC25230B885AAC6

ER2-B design execution binding
6192F9DFFE3A3535E3D3C91374DC8D77DB583A388B135FBFB3C7E7BDDEB54291

ER2-B implementation plan
99A562FCE12B53E012D91FB654856F97F82C5CBE49842C6AD937C365EB818C9A
```

## 1. Objective

ER2-B adds the first actual deterministic Identity decision engine behind the frozen ER2-A contract.

The evaluator consumes only supplied ER2-A Identity/evidence structures and returns a frozen `IdentityResolverResult` or an internal evaluation error.

It does not acquire evidence, touch a database, expose a Tauri/API route, alter frontend behavior, or Apply Identity changes.

## 2. Production boundary

Authorized production source:

```text
src-tauri-shell\src\database\identity_evidence_resolver.rs
```

No other production source file is authorized for ER2-B.

ER2-B must preserve:

```text
I3 current-universe reviewed Preview -> Apply
I4 historical reviewed Preview -> atomic Apply
ER1 Official Source Health
database.rs registration
NSE/BSE Identity import modules
Cargo/npm authorities
database/schema/data
frontend/Tauri behavior
```

## 3. Resolver entry point

```rust
pub(crate) fn resolve_identity(
    input: &IdentityResolverInput,
) -> Result<IdentityResolverResult, IdentityResolverEvaluationError>
```

The evaluator is pure with respect to external state.

## 4. Internal evaluation errors

Internal-only errors:

```text
INVALID_INPUT
NO_MISMATCH_TO_RESOLVE
AMBIGUOUS_DETERMINISTIC_CANDIDATES
INVALID_CONSTRUCTED_RESULT
```

They are not serialized resolver statuses or new ER2-A rule IDs.

Normal successful resolver outcomes remain:

```text
CONFIRMED
CONFLICT
INSUFFICIENT_EVIDENCE
SOURCE_UNAVAILABLE
```

`PROBABLE_REVIEW` remains in the frozen contract but no ER2-B V1 rule emits it automatically.

## 5. Mechanical normalization

Allowed comparison normalization:

```text
trim
case normalization
Unicode whitespace collapse for company names
```

Forbidden:

```text
fuzzy company-name matching
abbreviation expansion
similarity scoring
symbol-text inference as Identity authority
```

Normalization is comparison-only and never rewrites supplied evidence.

## 6. Date/chronology contract

Transition dates use strict Gregorian:

```text
YYYY-MM-DD
```

Malformed/impossible dates cannot confirm a transition.

Where applicable:

```text
transition date == official effective date when supplied
transition date >= local effective_to
Rule G requires old termination < new listing/effective date
```

No date-window guessing is authorized.

## 7. Authority classes

Confirming evidence may use only:

```text
OFFICIAL_EXCHANGE_STRUCTURED
OFFICIAL_REGULATOR_OR_DEPOSITORY
OFFICIAL_ISSUER_FILING
```

`EXTERNAL_DISCOVERY_CANDIDATE` remains discovery-only and cannot independently confirm Identity.

## 8. Rule A

Stable ID:

```text
SYMBOL_CHANGE_SAME_ISIN_OFFICIAL_HISTORY_V1
```

Confirm only when the exchange, series, non-empty ISIN, company identity and lifecycle are continuous and authoritative `SYMBOL_CHANGE` evidence links the local old symbol to the official current symbol with compatible chronology.

Result:

```text
CONFIRMED / SYMBOL_CHANGE
```

## 9. Rule B

Stable ID:

```text
NAME_CHANGE_SAME_IDENTITY_OFFICIAL_HISTORY_V1
```

Confirm only when exchange, symbol, series, non-empty ISIN and lifecycle are continuous and authoritative `NAME_CHANGE` evidence establishes the official current company name.

No fuzzy name inference.

Result:

```text
CONFIRMED / NAME_CHANGE
```

## 10. Rule C

Stable ID:

```text
SYMBOL_AND_NAME_CHANGE_OFFICIAL_CONTINUITY_V1
```

Require both authoritative symbol-change and name-change evidence bound to the same continuous non-empty ISIN/security.

Result:

```text
CONFIRMED / SYMBOL_AND_NAME_CHANGE
```

## 11. Rule D

Stable ID:

```text
ISIN_CHANGE_REQUIRES_EXPLICIT_CONTINUITY_V1
```

A changed non-empty ISIN is high risk.

Confirmed continuity requires a linked pair:

```text
old side: authoritative HISTORICAL_IDENTITY for local ISIN/security
new side: authoritative ISIN_CHANGE for official ISIN/security
same exchange
same source_id
same source_reference
same content_sha256
compatible chronology
```

Then:

```text
CONFIRMED / ISIN_CONTINUITY
```

Without the explicit bridge:

```text
CONFLICT / CONFLICTING_IDENTITY
```

Symbol/name similarity cannot override this rule.

## 12. Rule E

Stable ID:

```text
ACTIVE_DUPLICATE_ISIN_CONFLICT_V1
```

On the same exchange, two or more distinct current symbols authoritatively mapped to the same non-empty ISIN produce conflict.

Different series for the same symbol do not create Rule E.

Result:

```text
CONFLICT / CONFLICTING_IDENTITY
```

## 13. Rule F

Stable ID:

```text
DELISTED_INACTIVE_NOT_SYMBOL_CHANGE_V1
```

Authoritative delisting/inactive evidence binding the local security must not be reinterpreted as automatic continuity to another security when same-security/Rule-D continuity is not proven.

Result:

```text
CONFLICT / CONFLICTING_IDENTITY
```

## 14. Rule G

Stable ID:

```text
RECYCLED_SYMBOL_REQUIRES_IDENTITY_HISTORY_V1
```

Same exchange + same normalized symbol + different non-empty ISIN may be classified as proven recycled-symbol conflict only when authoritative chronology proves the old lifecycle ended before the new lifecycle began.

Absent chronology, generic Rule-D conflict still protects the changed ISIN.

Result:

```text
CONFLICT / CONFLICTING_IDENTITY
```

## 15. Rule H

Stable ID:

```text
SERIES_CHANGE_NOT_NEW_SECURITY_BY_DEFAULT_V1
```

Series continuity may be confirmed only when:

```text
same exchange
same symbol
same company identity
same non-empty ISIN
same lifecycle when supplied
different non-empty series
authoritative SERIES_CHANGE evidence
evidence binds official symbol/ISIN/current series
compatible chronology
```

Result:

```text
CONFIRMED / SAME_SECURITY_NO_IDENTITY_SPLIT
```

No series whitelist is allowed.

Required characterization includes:

```text
BE -> EQ
EQ -> BE
BZ -> EQ
future/arbitrary series values
```

Different ISIN prevents Rule H and must flow to stronger conflict handling.

## 16. Rule I

Stable ID:

```text
INCOMPLETE_HISTORY_REQUIRES_MORE_EVIDENCE_V1
```

Rule I is a fallback only when:

```text
input valid
required source AVAILABLE
official current identity present
real material mismatch remains
no A-H winner exists
```

Result:

```text
INSUFFICIENT_EVIDENCE / NO_CONCLUSION
```

Different non-empty ISIN without explicit continuity is Rule D conflict, never Rule I.

Equivalent local/current Identity returns `NO_MISMATCH_TO_RESOLVE`, not Rule I.

## 17. Source-unavailable precedence

For structurally valid input:

```text
UNAVAILABLE
UNTRUSTED_OR_INVALID
```

returns:

```text
SOURCE_UNAVAILABLE
NO_CONCLUSION
REQUIRED_OFFICIAL_SOURCE_UNAVAILABLE_V1
```

Stale matching evidence cannot salvage a confirmation when required source authority is unavailable/untrusted.

## 18. Candidate arbitration

A-H evaluate independently and produce internal candidates.

Frozen precedence:

```text
SOURCE_UNAVAILABLE
> HARD CONFLICT
> EXPLICIT HIGH-RISK CONTINUITY
> ORDINARY CONFIRMATION
> PROBABLE_REVIEW (none enabled in V1)
> INSUFFICIENT_EVIDENCE
```

Hard-conflict specificity:

```text
E > G > F > D-conflict
```

Incompatible same-precedence deterministic candidates fail closed with:

```text
AMBIGUOUS_DETERMINISTIC_CANDIDATES
```

Evaluator invocation order may not determine the outcome.

## 19. Deterministic evidence output

Final evidence IDs contain only rule-supporting supplied evidence.

Stable category order:

```text
1. official current identity evidence
2. primary transition/conflict evidence
3. supporting historical evidence
```

Equivalent duplicate facts do not increase authority. Canonical representative selection is deterministic and lexical by evidence ID after semantic/provenance equivalence.

Evidence input order, harmless case/whitespace changes and unrelated evidence must not change semantic output.

## 20. Final result validation

Every returned `IdentityResolverResult` must pass the frozen ER2-A:

```text
validate_resolver_result_contract(...)
```

A constructed result that violates ER2-A returns internal:

```text
INVALID_CONSTRUCTED_RESULT
```

No panic/unwrap/expect is normal production control flow.

## 21. TDD requirement

ER2-B must prove RED before GREEN for the bounded groups:

```text
B0 boundary/error/date foundation
B1 source unavailable
A
B
C
D
E/F/G
H
I
arbitration
deterministic evidence
```

No intentional RED remains at closeout.

## 22. Acceptance validation

Required final validation:

```text
full ER2-A + ER2-B resolver suite
NSE Identity regression
BSE Identity regression
ER1 Official Source Health regression
cargo check --locked --offline
source/hash preservation
```

Portable Windows build is not required for this pure internal Rust scope.

## 23. Explicit non-goals

ER2-B does not implement:

```text
database reads/writes
SQLite evidence loading
Tauri/API integration
TypeScript mirror
Identity UI changes
Preview changes
Apply changes
official evidence acquisition
source recovery/discovery
source replacement
external-AI integration
BSE historical parity
automatic Identity correction
ER2-C integration
```

## 24. Rollback

Restore exact ER2-A resolver preimage:

```text
E9CA8A5D20275FC0D2D17F904780F257B422E31062839B8CF36ACE3D186CFCB0
```

and verify ER2-A 536-file source fingerprint:

```text
2343703A060F5A7638D291552B88E04ED6D5132E056CC17B935A6564F243BF37
```

No DB/frontend/Tauri/dependency rollback is required.

## 25. Completion boundary

Successful ER2-B classification:

```text
IDENTITY_ER2B_DETERMINISTIC_RULE_EVALUATION
CLOSED / GREEN / PURE EVALUATOR AUTHORITY
```

ER2-B completion does **not** authorize ER2-C.
