# Identity ER2-A — Deterministic Resolver Contract + Rule-Matrix Design

**Status:** APPROVED WRITTEN DESIGN / IMPLEMENTATION AUTHORITY  
**Date:** 2026-09-11 IST  
**Active workstream:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## 1. Source authority

ER2-A starts from:

- source snapshot: `Eod Charting Platform Source Code 2026-09-11_161601_IST.zip`;
- snapshot SHA-256: `D673BBC51B9134977D5739D8DF7988630AFDCEBD4918857CD4CE84ABFDE41C2E`;
- source fingerprint: `490D8844A47767F16DC08470839823C613D93B3A93EA92C398635BD44F3C2836` / 535 files;
- `Cargo.toml`: `D1199096F9EA2548FD011BC120ABD15407849A75D9AAA14240DF1D250A020D42`;
- `Cargo.lock`: `670E1F7C8AF8C757122E48DFD37743D6A6CBE847A61C14E629149AAA2F5B9CCA`.

Future-design authorities:

- source-recovery design SHA-256: `9DF3101384726F19150B7FA4EAD2CDA48A91A3993601D8467E53BD9280C736C9`;
- external-AI handoff contract SHA-256: `893E560697F2B9DEB6DC002115863A4EC3C9CAE51B519C9EF4EBB4BDEBD3B60C`;
- source-recovery handoff SHA-256: `68C0B4CA9868BB4424D0AE4E0259FF55F4BCF97C9AC5C4184043F51A4839CBAD`.

Preserved authority chain:

```text
I3 current-universe reviewed Preview -> Apply
I4 historical reviewed Preview -> atomic Apply
ER0 source-contract authority
ER1 source-health diagnostics
ER2-A resolver contract + rule-matrix authority
```

ER2-A remains subordinate to I3/I4 write authority.

## 2. Objective and boundary

ER2-A freezes a pure Rust deterministic Identity resolver contract before any Identity evaluation logic exists.

It contains only:

1. stable resolver vocabulary;
2. stable A-I versioned rule IDs;
3. stable precedence/rule metadata;
4. stable input/evidence/provenance structures;
5. stable result structures;
6. structural fail-closed validators;
7. contract and serialization tests.

It must not implement `resolve_identity(...)` or any matching/evaluation algorithm. Actual A-I rule evaluation starts in ER2-B.

## 3. Module structure

Create:

```text
src-tauri-shell\src\database\identity_evidence_resolver.rs
```

Modify only additively:

```text
src-tauri-shell\src\database.rs
```

Registration:

```rust
pub(crate) mod identity_evidence_resolver;
```

The module is internal to the Rust crate. ER2-A adds no Tauri command, desktop API, TypeScript mirror, UI route, production database query, database mutation, network request, AI integration or source-replacement path. Existing regression tests may create isolated temporary SQLite fixtures; no user/live database path is accepted by the implementation runner.

## 4. Core vocabulary

### Status

```text
CONFIRMED
PROBABLE_REVIEW
CONFLICT
INSUFFICIENT_EVIDENCE
SOURCE_UNAVAILABLE
```

`SOURCE_UNAVAILABLE` means required authority cannot currently be evaluated. `INSUFFICIENT_EVIDENCE` means the relevant authority was evaluated but the required continuity/history link is missing.

### Conclusion

```text
SYMBOL_CHANGE
NAME_CHANGE
SYMBOL_AND_NAME_CHANGE
ISIN_CONTINUITY
SAME_SECURITY_NO_IDENTITY_SPLIT
CONFLICTING_IDENTITY
NO_CONCLUSION
```

### Confidence class

Only:

```text
DETERMINISTIC
```

Numeric confidence is forbidden.

### Authority class

```text
OFFICIAL_EXCHANGE_STRUCTURED
OFFICIAL_REGULATOR_OR_DEPOSITORY
OFFICIAL_ISSUER_FILING
EXTERNAL_DISCOVERY_CANDIDATE
```

External discovery material is never direct Identity authority.

### Evidence kind

```text
CURRENT_MASTER
SYMBOL_CHANGE
NAME_CHANGE
ISIN_CHANGE
SERIES_CHANGE
DELISTING
LISTING
LIFECYCLE_STATUS
HISTORICAL_IDENTITY
OTHER_OFFICIAL
```

### Required source availability

```text
AVAILABLE
UNAVAILABLE
UNTRUSTED_OR_INVALID
```

This is a narrow resolver-facing state and does not duplicate ER1's complete health model.

## 5. Input/evidence structures

`IdentityResolverLocalIdentity` contains semantic local facts:

```text
exchange, symbol, series?, isin?, company_name?, lifecycle_state?,
effective_from?, effective_to?
```

`IdentityResolverOfficialIdentity` contains current official facts and provenance linkage:

```text
exchange, symbol, series?, isin?, company_name?, lifecycle_state?,
effective_date?, source_id, evidence_id
```

`IdentityResolverEvidence` contains:

```text
evidence_id, exchange, authority_class, source_id, source_reference,
content_sha256, retrieved_at_ist, effective_date?, symbol?, old_symbol?,
new_symbol?, series?, isin?, company_name?, evidence_kind
```

`IdentityResolverInput` contains:

```text
local_identity
official_identity?
evidence[]
required_source_health
```

Database row IDs, SQL, open connections and mutation handles are excluded.

## 6. Provenance invariants

1. Every evidence item has a non-empty stable evidence ID.
2. Evidence IDs are unique within an input.
3. Exchange is explicit; it is not inferred from symbol text.
4. Every authoritative evidence item has source ID, source reference and content SHA-256.
5. Every evidence item has retrieval-time provenance.
6. An official Identity references an evidence item present in the input.
7. That referenced item is authoritative and consistent with the official Identity's exchange/source ID.
8. External discovery candidates cannot become sole confirmed authority.
9. Missing optional evidence remains missing; empty strings are not synthesized into facts.
10. Symbol alone is never permanent security Identity authority.
11. ISIN differences remain explicit and are not normalized away.
12. Result evidence IDs may reference only evidence supplied in the input.
13. Name normalization is limited to mechanical normalization; textual similarity is not continuity authority.

## 7. Frozen A-I rule IDs

| Family | Stable V1 ID | Contract outcome |
|---|---|---|
| A | `SYMBOL_CHANGE_SAME_ISIN_OFFICIAL_HISTORY_V1` | confirmed symbol change |
| B | `NAME_CHANGE_SAME_IDENTITY_OFFICIAL_HISTORY_V1` | confirmed name change |
| C | `SYMBOL_AND_NAME_CHANGE_OFFICIAL_CONTINUITY_V1` | confirmed symbol-and-name change |
| D | `ISIN_CHANGE_REQUIRES_EXPLICIT_CONTINUITY_V1` | explicit continuity only; otherwise conflict |
| E | `ACTIVE_DUPLICATE_ISIN_CONFLICT_V1` | conflict |
| F | `DELISTED_INACTIVE_NOT_SYMBOL_CHANGE_V1` | conflict against false continuity |
| G | `RECYCLED_SYMBOL_REQUIRES_IDENTITY_HISTORY_V1` | conflict unless another proven continuity rule resolves the case |
| H | `SERIES_CHANGE_NOT_NEW_SECURITY_BY_DEFAULT_V1` | same security/no split when officially proven |
| I | `INCOMPLETE_HISTORY_REQUIRES_MORE_EVIDENCE_V1` | insufficient evidence |

Infrastructure rule:

```text
REQUIRED_OFFICIAL_SOURCE_UNAVAILABLE_V1
```

Reserved but not enabled as a catch-all:

```text
NO_DETERMINISTIC_IDENTITY_RULE_MATCH_V1
```

## 8. Precedence

Safety precedence is frozen as:

```text
SOURCE_UNAVAILABLE
-> HARD_CONFLICT
-> EXPLICIT_HIGH_RISK_CONTINUITY
-> ORDINARY_CONFIRMATION
-> PROBABLE_REVIEW
-> INSUFFICIENT_EVIDENCE
```

A lower-risk continuity pattern may never override a higher-risk conflict.

`PROBABLE_REVIEW` remains part of the stable vocabulary but ER2-A enables no implicit probable-review rule. A later ER2 revision must introduce an explicit tested evidence pattern before that status can be emitted.

## 9. Rule metadata

`IDENTITY_RESOLVER_RULE_MATRIX_V1` contains exactly nine A-I metadata rows. Each row freezes:

```text
family
rule_id
precedence
permitted_statuses
permitted_conclusions
minimum_evidence_kinds
```

The matrix is descriptive contract metadata, not an evaluator. It contains no predicates and chooses no winning rule.

## 10. Result contract

`IdentityResolverResult` contains only:

```text
status
conclusion
rule_id
confidence_class
evidence_ids[]
explanation
```

Machine semantics are status, conclusion, rule ID and evidence IDs. Explanation wording is operator-facing and is not independent authority.

The result contains no `approved`, `apply`, `execute`, SQL, database mutation or source-replacement instruction.

## 11. Structural validation

ER2-A may implement:

```text
validate_resolver_input_contract(...)
validate_resolver_result_contract(...)
```

These functions validate structure only. They do not evaluate Identity.

The validators reject at least:

- empty required local Identity fields;
- missing/duplicate evidence IDs;
- authoritative evidence without provenance;
- official Identity without matching authoritative evidence;
- unknown or duplicate result evidence references;
- conflict with a positive continuity conclusion;
- confirmed conflicting/no-conclusion result;
- confirmed result without an available source and referenced authoritative evidence;
- external-discovery-only confirmation;
- different local/current ISIN confirmed without the explicit Rule D ID and authoritative effective-date `ISIN_CHANGE` evidence;
- use of the reserved no-match rule before a future explicit rule is approved.

A valid source-unavailable result may have no evidence when no authoritative content was retrieved.

## 12. Serialization

Rust uses idiomatic variant names internally but serializes exact uppercase stable strings. Per-variant Serde renames are used instead of relying on inferred case conversion.

Contract types derive the minimum stable traits needed for pure testing and later transport:

```text
Clone, Copy where applicable, Debug, PartialEq, Eq, Serialize, Deserialize
```

Round-trip tests freeze future ER2-C transport compatibility without introducing TypeScript in ER2-A.

## 13. TDD sequence

The strict approved sequence is:

1. install a test-only module registration and a RED test that references the missing contract;
2. run focused Cargo test and require the expected missing-type compile failure;
3. replace the temporary RED state with the pure GREEN module and additive internal registration;
4. run focused contract tests GREEN;
5. run relevant NSE Identity, BSE Identity and ER1 Source Health regressions;
6. run locked/offline Cargo check;
7. verify all preserved authorities and intended source delta;
8. write the required IST report and evidence.

No intentional RED remains after ER2-A.

## 14. Preservation and non-goals

ER2-A preserves:

- I3 reviewed current-universe Preview -> Apply;
- I4 reviewed historical Preview -> atomic Apply;
- ER1 source-health behavior;
- current official-source registry/URLs;
- frontend Identity and Corporate Action behavior;
- database schema/data;
- Cargo/npm dependencies.

ER2-A does not implement:

- A-I decision evaluation;
- `resolve_identity`;
- database reads/writes;
- Tauri commands;
- frontend/API types;
- source discovery/recovery;
- AI handoff/import;
- automatic Identity correction;
- fuzzy company-name continuity;
- BSE historical parity work.

## 15. Acceptance

ER2-A closes only after actual output confirms focused contract tests, relevant regressions, locked/offline Cargo check, source/dependency preservation and documentation/evidence creation.

Closure classification:

```text
IDENTITY_ER2A_DETERMINISTIC_RESOLVER_CONTRACT_RULE_MATRIX
CLOSED / GREEN / CONTRACT AUTHORITY FROZEN
```

Next gate:

```text
ER2-B — Deterministic Resolver Rule Evaluation TDD
```

ER2-B may not silently redefine the frozen V1 vocabulary or rule IDs.
