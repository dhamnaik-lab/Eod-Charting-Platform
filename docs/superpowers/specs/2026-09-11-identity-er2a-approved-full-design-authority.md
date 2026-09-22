# Identity ER2-A — Deterministic Resolver Contract + Rule-Matrix Design

**Status:** DESIGN AUTHORITY / USER SECTION APPROVAL COMPLETE / NOT IMPLEMENTED  
**Date:** 2026-09-11 IST  
**Active workstream:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## 1. Source authority

ER2-A must start from the verified fresh source authority:

- Snapshot: `Eod Charting Platform Source Code 2026-09-11_161601_IST.zip`
- Snapshot SHA-256: `D673BBC51B9134977D5739D8DF7988630AFDCEBD4918857CD4CE84ABFDE41C2E`
- Source fingerprint: `490D8844A47767F16DC08470839823C613D93B3A93EA92C398635BD44F3C2836`
- `Cargo.toml`: `D1199096F9EA2548FD011BC120ABD15407849A75D9AAA14240DF1D250A020D42`
- `Cargo.lock`: `670E1F7C8AF8C757122E48DFD37743D6A6CBE847A61C14E629149AAA2F5B9CCA`

Future-design authorities:

- `2026-09-06-future-identity-evidence-resolver-source-recovery-design.md`
  - SHA-256: `9DF3101384726F19150B7FA4EAD2CDA48A91A3993601D8467E53BD9280C736C9`
- `2026-09-06-future-identity-external-ai-handoff-contract.md`
  - SHA-256: `893E560697F2B9DEB6DC002115863A4EC3C9CAE51B519C9EF4EBB4BDEBD3B60C`
- `2026-09-06-future-identity-evidence-resolver-source-recovery-handoff.md`
  - SHA-256: `68C0B4CA9868BB4424D0AE4E0259FF55F4BCF97C9AC5C4184043F51A4839CBAD`

Current authority chain to preserve:

```text
I3  current-universe reviewed Preview -> Apply
I4  historical reviewed Preview -> atomic Apply
ER0 source-contract inventory / authority freeze
ER1 source-health diagnostics / validation reports
ER2-A deterministic resolver contract + rule-matrix freeze
```

ER2-A is subordinate to I3/I4 write authority. It must not create a parallel mutation path.

---

## 2. Objective

ER2-A freezes the **pure Rust deterministic Identity resolver contract** before any resolver behavior is implemented.

The deliverable is:

1. stable resolver vocabulary;
2. stable A-I versioned rule identifiers;
3. stable rule metadata and precedence;
4. stable evidence/provenance contract;
5. stable result/fail-closed contract;
6. contract-validation helpers;
7. focused Rust contract tests.

ER2-A does **not** implement Identity decision logic.

Actual deterministic rule evaluation starts in **ER2-B**.

---

## 3. Architectural boundary

Preferred module:

```text
src-tauri-shell\src\database\identity_evidence_resolver.rs
```

Existing registration owner:

```text
src-tauri-shell\src\database.rs
```

Expected meaningful production source delta:

```text
CREATED
src-tauri-shell\src\database\identity_evidence_resolver.rs

MODIFIED
src-tauri-shell\src\database.rs
  additive module/export registration only
```

No frontend file, Tauri command registration, schema file, database file, package file, or source URL configuration should change in ER2-A.

The module is pure Rust contract code. It must not depend on:

- `rusqlite::Connection`;
- Tauri state or commands;
- HTTP/network clients;
- browser/web behavior;
- AI providers;
- UI state;
- reviewed Apply functions.

Existing Serde support may be reused; ER2-A should not require a new Cargo dependency.

---

## 4. Core contract types

ER2-A freezes the following semantic types.

### 4.1 Resolver status

```text
CONFIRMED
PROBABLE_REVIEW
CONFLICT
INSUFFICIENT_EVIDENCE
SOURCE_UNAVAILABLE
```

Meaning:

- `CONFIRMED`: required official evidence deterministically establishes the conclusion.
- `PROBABLE_REVIEW`: evidence is meaningful but intentionally below deterministic confirmation.
- `CONFLICT`: available evidence contains a material Identity contradiction or unsafe ambiguity.
- `INSUFFICIENT_EVIDENCE`: required continuity/effective-date/history evidence is missing.
- `SOURCE_UNAVAILABLE`: required authoritative source/evidence cannot currently be evaluated.

`SOURCE_UNAVAILABLE` and `INSUFFICIENT_EVIDENCE` are deliberately distinct.

### 4.2 Resolver conclusion

```text
SYMBOL_CHANGE
NAME_CHANGE
SYMBOL_AND_NAME_CHANGE
ISIN_CONTINUITY
SAME_SECURITY_NO_IDENTITY_SPLIT
CONFLICTING_IDENTITY
NO_CONCLUSION
```

`status` answers **how strongly/why the resolver can decide**.  
`conclusion` answers **what Identity conclusion was established**.

### 4.3 Confidence class

Only:

```text
DETERMINISTIC
```

No numeric confidence score is allowed in ER2.

### 4.4 Authority class

```text
OFFICIAL_EXCHANGE_STRUCTURED
OFFICIAL_REGULATOR_OR_DEPOSITORY
OFFICIAL_ISSUER_FILING
EXTERNAL_DISCOVERY_CANDIDATE
```

`EXTERNAL_DISCOVERY_CANDIDATE` is candidate/discovery material only. It is not authoritative evidence until a later phase locally validates/promotes it into an accepted authority class.

### 4.5 Evidence kind

Initial V1 vocabulary:

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

### 4.6 Source availability

Resolver-facing state only:

```text
AVAILABLE
UNAVAILABLE
UNTRUSTED_OR_INVALID
```

This intentionally does not duplicate the complete ER1 source-health model.

---

## 5. Identity input contract

### 5.1 Local Identity

`IdentityResolverLocalIdentity`

Semantic fields:

```text
exchange
symbol
series
isin
company_name
lifecycle_state
effective_from
effective_to
```

Purpose: the Identity state the application currently believes.

Database paths, SQL row IDs, open connections, and mutation handles must not enter this contract.

### 5.2 Official current Identity

`IdentityResolverOfficialIdentity`

Semantic fields:

```text
exchange
symbol
series
isin
company_name
lifecycle_state
effective_date
source_id
evidence_id
```

Purpose: current authoritative official Identity state.

This value may be absent when required authority cannot be evaluated, allowing an explicit `SOURCE_UNAVAILABLE` result.

### 5.3 Historical/supporting evidence

`IdentityResolverEvidence`

Required provenance-oriented fields:

```text
evidence_id
exchange
authority_class
source_id
source_reference
content_sha256
retrieved_at_ist
effective_date

symbol
old_symbol
new_symbol
series
isin
company_name

evidence_kind
```

Fields that are genuinely unavailable should remain optional/missing. Empty strings must not be synthesized into apparent evidence.

### 5.4 Input wrapper

Conceptually:

```text
IdentityResolverInput
{
    local_identity
    official_identity?
    evidence[]
    required_source_health
}
```

---

## 6. Provenance invariants

ER2-A must freeze these invariants:

1. Every evidence item has a non-empty stable `evidence_id`.
2. Every authoritative evidence item has:
   - `source_id`;
   - `authority_class`;
   - `source_reference`;
   - `content_sha256`.
3. Temporal continuity rules require effective-date evidence where the rule contract says it is required.
4. Exchange is explicit; NSE/BSE is never inferred from symbol text.
5. Symbol text alone is never sufficient security-Identity authority.
6. ISIN disagreement remains explicit; it is never normalized away.
7. Missing evidence remains missing.
8. `EXTERNAL_DISCOVERY_CANDIDATE` cannot itself become confirmed authority.
9. Resolver input contains no Apply/database-mutation authority.
10. Resolver output may reference only evidence IDs supplied by the input.
11. Duplicate evidence IDs are structurally invalid.
12. Company-name normalization in ER2-A is limited to mechanical normalization only; fuzzy/similarity continuity is not authority.

Safe mechanical normalization may later include:

- trimming;
- case normalization;
- Unicode whitespace normalization.

ER2-A must not freeze fuzzy equivalence rules such as treating `ABC Ltd` and `ABC Industries Limited` as the same security based on textual similarity alone.

---

## 7. Frozen A-I rule IDs

The core resolver remains exchange-neutral. Exchange/provenance belongs in evidence.

| Family | Stable V1 ID | Primary successful/failed outcome |
|---|---|---|
| A | `SYMBOL_CHANGE_SAME_ISIN_OFFICIAL_HISTORY_V1` | `CONFIRMED / SYMBOL_CHANGE` |
| B | `NAME_CHANGE_SAME_IDENTITY_OFFICIAL_HISTORY_V1` | `CONFIRMED / NAME_CHANGE` |
| C | `SYMBOL_AND_NAME_CHANGE_OFFICIAL_CONTINUITY_V1` | `CONFIRMED / SYMBOL_AND_NAME_CHANGE` |
| D | `ISIN_CHANGE_REQUIRES_EXPLICIT_CONTINUITY_V1` | `CONFIRMED` only with explicit official continuity; otherwise `CONFLICT` |
| E | `ACTIVE_DUPLICATE_ISIN_CONFLICT_V1` | `CONFLICT / CONFLICTING_IDENTITY` |
| F | `DELISTED_INACTIVE_NOT_SYMBOL_CHANGE_V1` | conflict when false continuity/symbol-change interpretation is proposed |
| G | `RECYCLED_SYMBOL_REQUIRES_IDENTITY_HISTORY_V1` | conflict unless Identity/effective-date history resolves it |
| H | `SERIES_CHANGE_NOT_NEW_SECURITY_BY_DEFAULT_V1` | confirmed continuity when evidence proves same security |
| I | `INCOMPLETE_HISTORY_REQUIRES_MORE_EVIDENCE_V1` | `INSUFFICIENT_EVIDENCE / NO_CONCLUSION` |

Infrastructure/failure rule identifier:

```text
REQUIRED_OFFICIAL_SOURCE_UNAVAILABLE_V1
```

Reserved, but not enabled as a generic probable catch-all in ER2-A:

```text
NO_DETERMINISTIC_IDENTITY_RULE_MATCH_V1
```

---

## 8. Rule matrix metadata

Freeze one V1 metadata table, conceptually:

```text
IDENTITY_RESOLVER_RULE_MATRIX_V1
```

Each row records:

```text
rule_family
rule_id
precedence_class
permitted_status
permitted_conclusion
minimum_evidence_category_expectations
```

The matrix is **metadata**, not decision logic.

ER2-A may describe Rule A as requiring:

- official current Identity;
- continuous matching ISIN;
- official symbol-change evidence;
- compatible effective date.

ER2-A must not implement the algorithm that decides whether a concrete input satisfies those requirements.

That starts in ER2-B.

---

## 9. Precedence

Resolver behavior in ER2-B must obey the frozen safety precedence:

```text
1. SOURCE_UNAVAILABLE
2. hard conflict
3. explicit high-risk continuity
4. ordinary confirmed continuity
5. PROBABLE_REVIEW only for an explicitly approved/tested future pattern
6. INSUFFICIENT_EVIDENCE
```

Interpretation:

### 9.1 Source unavailable

Required authoritative source/evidence cannot be evaluated.

No lower rule may manufacture confirmation from weaker evidence.

### 9.2 Hard conflict

Includes Rule E, false-continuity cases under F/G, and Rule D without explicit official continuity.

Hard conflict dominates ordinary confirmation.

Examples:

```text
same/similar symbol + different ISIN
```

cannot be confirmed from text similarity.

```text
same ISIN + two simultaneous active symbols
```

cannot be casually confirmed by Rule A.

### 9.3 Explicit high-risk continuity

Proven Rule D may confirm continuity only when explicit official evidence establishes the ISIN transition.

### 9.4 Ordinary confirmation

Rules A/B/C/H.

### 9.5 Probable review

`PROBABLE_REVIEW` remains part of the status vocabulary, but ER2-A does not authorize an implicit catch-all path.

A future ER2-B revision may introduce a tested, explicit probable-review rule/pattern.

### 9.6 Insufficient evidence

Missing required historical/continuity link, especially Rule I.

---

## 10. Result contract

`IdentityResolverResult` conceptually contains:

```text
status
conclusion
rule_id
confidence_class
evidence_ids[]
explanation
```

`confidence_class` is always `DETERMINISTIC`.

The result must not contain:

```text
approved
apply
execute
sql
databaseMutation
sourceReplacement
```

Changing operator-facing explanation wording must not change resolver semantics.

The machine-readable semantic authority is:

```text
status
conclusion
rule_id
evidence_ids
```

---

## 11. Fail-closed result invariants

ER2-A contract validation must reject at least:

1. `CONFIRMED + CONFLICTING_IDENTITY`.
2. `CONFLICT` with a positive continuity conclusion.
3. `SOURCE_UNAVAILABLE + CONFIRMED`.
4. `INSUFFICIENT_EVIDENCE + CONFIRMED`.
5. `CONFIRMED` based only on `EXTERNAL_DISCOVERY_CANDIDATE`.
6. different ISIN confirmed without explicit official continuity evidence.
7. result evidence IDs absent from the input.
8. duplicate evidence IDs.
9. `CONFIRMED` with zero authoritative evidence IDs.
10. any mutation/apply authority entering the resolver result contract.

`SOURCE_UNAVAILABLE` may legitimately contain zero evidence IDs if no authoritative content was retrieved.

---

## 12. Contract validation helpers

ER2-A may implement only structural/contract validation logic, conceptually:

```text
validate_resolver_input_contract(...)
validate_resolver_result_contract(...)
```

These helpers:

- validate provenance;
- validate impossible status/conclusion combinations;
- validate evidence references;
- validate authority-class restrictions;
- validate structural fail-closed invariants.

They do **not** decide Identity.

ER2-A must not implement:

```text
resolve_identity(...)
```

---

## 13. Serialization stability

Rust enum variants may remain idiomatic internally:

```text
Confirmed
Conflict
SymbolChange
```

but serialized strings are frozen as stable uppercase values:

```text
"CONFIRMED"
"CONFLICT"
"SYMBOL_CHANGE"
```

ER2-A types should derive the minimum useful stable contract traits, conceptually:

```text
Debug
Clone
PartialEq
Eq
Serialize
Deserialize
```

Round-trip serialization tests are mandatory because ER2-C may later expose the frozen result through Tauri/TypeScript.

ER2-A does not create the TypeScript mirror.

---

## 14. TDD freeze

ER2-A ends GREEN.

### RED

A focused ER2-A characterization/contract test proves the resolver contract/module is absent.

### Implementation

Add:

```text
src-tauri-shell\src\database\identity_evidence_resolver.rs
```

and only the minimum additive registration/export in:

```text
src-tauri-shell\src\database.rs
```

### GREEN

Focused ER2-A contract tests prove the frozen vocabulary, rule matrix, provenance and fail-closed semantics.

No intentional RED test is left for ER2-B.

ER2-B starts a fresh RED cycle for actual deterministic rule evaluation.

---

## 15. Required ER2-A tests

### 15.1 Enum/serialization

- exactly five status values;
- exactly seven conclusion values;
- `DETERMINISTIC` stable;
- authority/evidence/source-availability strings stable;
- round-trip serialization preserves exact semantics.

### 15.2 Rule matrix

- exactly nine A-I Identity rules;
- all rule IDs unique;
- all rule IDs versioned `_V1`;
- all A-I families represented exactly once;
- hard-conflict precedence outranks ordinary confirmation;
- Rule D cannot default to ordinary continuity;
- `PROBABLE_REVIEW` has no implicit catch-all rule;
- rule IDs are exchange-neutral.

### 15.3 Provenance

- authoritative evidence requires provenance;
- exchange cannot be omitted;
- duplicate evidence IDs rejected;
- external candidate is not accepted official authority;
- missing evidence remains missing;
- ISIN disagreement remains explicit.

### 15.4 Fail-closed result contract

- `CONFIRMED` requires authoritative evidence;
- conflict cannot carry positive continuity conclusion;
- source unavailable cannot be confirmed;
- insufficient evidence cannot be confirmed;
- unknown evidence references rejected;
- mutation/apply authority is absent from result schema.

### 15.5 Compatibility

Serialization round-trip proves the V1 Rust contract can later cross an API boundary without redefining enum values.

---

## 16. Preservation boundary

ER2-A must preserve accepted behavior and authorities:

- I3 current-universe reviewed Preview -> Apply;
- I4 historical reviewed Preview -> atomic Apply;
- ER0 source-contract authority;
- ER1 source-health diagnostics;
- current Official Source Health UI/behavior;
- current frontend Identity UI;
- existing source URLs and source configuration;
- Corporate Action authority;
- `Cargo.toml`;
- `Cargo.lock`;
- `package.json`;
- `package-lock.json`;
- database schema/data.

No network access is required.

No database access is required.

No Git/source-control command is authorized.

---

## 17. Validation expectations

Minimum implementation validation:

1. Windows PowerShell runner parse check if a runner is used.
2. Focused ER2-A Rust contract tests.
3. Relevant NSE Identity regression tests.
4. Relevant BSE Identity regression tests.
5. ER1 Official Source Health regressions.
6. I3 reviewed-current-universe Apply regressions.
7. I4 historical reviewed/atomic Apply regressions.
8. `cargo check --locked` using the accepted dependency authority.
9. `Cargo.toml` and `Cargo.lock` SHA preservation.
10. frontend/package authority preservation hashes.
11. source postflight showing only the intended ER2-A module/registration plus documentation/test additions changed.
12. required IST change report/evidence.

A portable Windows build is not mandatory for ER2-A unless implementation unexpectedly crosses into runtime/Tauri/UI integration. If the scope expands that far, stop before continuing because the task has exceeded the approved ER2-A design.

---

## 18. Acceptance criteria

ER2-A closes only when:

1. the pure Rust resolver contract module exists;
2. all frozen enums/types exist;
3. the exact A-I V1 rule matrix exists;
4. precedence classes are frozen;
5. provenance requirements are enforced;
6. fail-closed result invariants are enforced;
7. serialization round-trip tests pass;
8. no Identity evaluation engine exists yet;
9. I3/I4 Apply authority is unchanged;
10. ER1 Source Health behavior is unchanged;
11. no frontend/API/Tauri contract is introduced;
12. no DB/schema/network behavior changes;
13. Cargo authority remains unchanged;
14. relevant Rust regressions and `cargo check --locked` pass;
15. required IST documentation/evidence is created.

Closure classification:

```text
IDENTITY_ER2A_DETERMINISTIC_RESOLVER_CONTRACT_RULE_MATRIX
CLOSED / GREEN / CONTRACT AUTHORITY FROZEN
```

Next authorized phase after closure:

```text
ER2-B — Deterministic Resolver Rule Evaluation TDD
```

ER2-B may not silently redefine ER2-A statuses, conclusions, rule IDs, authority classes or provenance invariants. Any required contract change must be handled as a separate ER2-A contract revision.

---

## 19. Explicit non-goals

ER2-A does not implement:

- actual Rule A-I matching/evaluation;
- `resolve_identity(...)`;
- database reads;
- database writes;
- Tauri commands;
- TypeScript mirrors;
- Identity UI changes;
- Preview changes;
- Apply changes;
- evidence collection from NSE/BSE;
- source-health fetching;
- official-domain discovery;
- source promotion/replacement;
- AI integration;
- external-result import;
- BSE historical Identity parity;
- fuzzy company-name matching;
- automatic source recovery;
- automatic Identity correction.

---

## 20. Risks

### Contract over-design

Mitigation: freeze only semantic fields required by the approved A-I rules and future evidence design. Adapter-specific fields remain outside the core contract.

### Rule metadata mistaken for decision logic

Mitigation: `IDENTITY_RESOLVER_RULE_MATRIX_V1` is descriptive/frozen metadata only. Actual matching begins in ER2-B.

### Permissive invalid states

Mitigation: structural contract validators reject impossible status/conclusion/evidence combinations.

### Lower-quality evidence accidentally gaining authority

Mitigation: `EXTERNAL_DISCOVERY_CANDIDATE` is structurally prevented from acting as sole confirmed authority.

### Future UI copy affecting semantics

Mitigation: operator explanation text is non-authoritative; machine semantics remain the frozen enum/rule/evidence fields.

---

## 21. Rollback

ER2-A has no runtime/database migration.

Rollback is:

1. remove `identity_evidence_resolver.rs`;
2. remove its additive `database.rs` registration/export;
3. restore ER2-A test/document additions as appropriate;
4. verify all preserved source/dependency hashes return to the pre-ER2-A authority.

No database rollback is required.

No URL/source configuration rollback is required.

No frontend rollback is required.
