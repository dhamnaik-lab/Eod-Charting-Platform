# Identity ER2-C1 — NSE I3 Shadow Evidence Adapter Design

**Status:** APPROVED / FROZEN DESIGN AUTHORITY  
**Date:** 2026-09-12 IST  
**Workstream:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Phase:** ER2-C1  
**Implementation status:** NOT STARTED BY THIS DOCUMENT

## 1. Authority chain

ER2-C1 is the first integration slice after the closed ER2-A/ER2-B deterministic resolver work. It is bound to the following source and design authorities:

```text
POST-ER2-B / PRE-ER2-C source snapshot
Eod Charting Platform Source Code 2026-09-12_141501_IST.zip
SHA256: D14ABCAF8B067A6474786571272C28F8C1267595EF656D1B6B78C76CE54DD822

536-source-file fingerprint
SHA256: 8E6011E50CF64CF1F7179EF435A49F8F6EF9B57A1C5B16F0C4CA194740E7A037

ER2-A full approved design
SHA256: 230EDC694E92F87E5CF9B740B39ED155AB18AA7373186FF35BC25230B885AAC6

ER2-B approval-time design artifact
SHA256: E7A044F4142B94D20AD8C38FDB89EAB2E9E600EEA15E5193BE1F7D3DF3B9600C

ER2-B final resolver
src-tauri-shell\src\database\identity_evidence_resolver.rs
SHA256: AECC6C182D90598CDD78FB777FE4D0D3A0D15D0C73A071CE8E02456F71DFE3CD

ER2-B implementation evidence
SHA256: B3D251F69979A2A0EE100B78E8909D339400C12D592EF9AD4ED2A9FBB97D1FED

ER2-B documentation closeout evidence
SHA256: 5EF95055C65EF209F7D7466F68EEBAEAC96F5FD0D894B5BCF2D18BE369CADE0A

Long-term Identity evidence/source-recovery design
SHA256: 9DF3101384726F19150B7FA4EAD2CDA48A91A3993601D8467E53BD9280C736C9
```

The ER2-C1 design was reviewed in five sections and explicitly approved section-by-section before this document was created.

## 2. Objective

Connect the existing NSE I3 current-universe Preview flow to the closed ER2-B deterministic resolver as a **shadow-only, read-only diagnostic integration**.

ER2-C1 must prove that real I3 local/current official evidence can be translated into the frozen ER2 resolver contract without changing accepted I3 product behavior.

ER2-C1 does **not** promote ER2 results into operational authority.

## 3. Current accepted I3 authority

The current NSE I3 flow remains authoritative:

```text
build_nse_current_universe_sync_plan(...)
        ↓
nse_current_universe_plan_sha256(...)
        ↓
operator Preview / review
        ↓
apply_nse_current_universe_sync_reviewed_internal(...)
        ↓
rebuild plan
        ↓
compare reviewed SHA-256
        ↓
existing Apply behavior
```

ER2-C1 must preserve this chain exactly.

Current preservation sentinels:

```text
nse_identity_imports.rs
100F27D48F85570EE45C3EA0E3522E60742C5188E474858B0EDE61F19EE2F598

nse_current_universe_plan_sha256(...) body
E1E528547427A529771B5BFEAA63985CBA4DC8CF26EBF232661A82B5C1A3A1E7

plan_into_result(...) body
3DEED9F0D44F30DEEFC5ED8A2A643BF772746579138B4960057D16D5F78BA05F

apply_nse_current_universe_sync_reviewed_internal(...) body
B3297AC350E262CBAA8D4F824728C70C7EC0721271DDD910BF3AB5BF22CE4981
```

The Apply function body is a hard preservation authority for C1.

## 4. Production-source boundary

Preferred and approved production delta:

```text
MODIFY ONLY
src-tauri-shell\src\database\nse_identity_imports.rs
```

No planned production modification to:

```text
src-tauri-shell\src\database\identity_evidence_resolver.rs
src-tauri-shell\src\database.rs
src-tauri-shell\src\database\bse_identity_imports.rs
src-tauri-shell\src\database\official_source_health.rs
src-tauri-shell\Cargo.toml
src-tauri-shell\Cargo.lock
package.json
package-lock.json
frontend / TypeScript
Tauri command/result contracts
SQLite schema/data
```

If maintainable C1 implementation cannot remain inside the single NSE Identity owner file, stop before creating another production module and request architectural approval.

## 5. Shadow integration point

C1 runs only in the existing NSE current-universe **Preview** path.

Frozen ordering:

```text
1. Build legacy I3 plan.
2. Compute the existing legacy I3 reviewed plan SHA-256.
3. Run ER2-C1 shadow evaluation against that already-built plan.
4. Discard shadow diagnostics from the public result.
5. Convert the unchanged legacy plan into the existing public Preview result.
```

Conceptually:

```rust
let plan = build_nse_current_universe_sync_plan(...)?;
let plan_sha256 = nse_current_universe_plan_sha256(&plan);
let _shadow = evaluate_nse_i3_er2_shadow(...);
Ok(plan_into_result(plan, false, plan_sha256))
```

The final implementation must follow the exact current function signature/style rather than forcing this pseudocode literally.

Forbidden orderings include:

```text
shadow → mutate plan → hash
shadow → change plan SHA
shadow → change actions/reasons/counts
shadow → change can-Apply semantics
```

## 6. No Apply integration

ER2-C1 must add no resolver/shadow call inside:

```text
apply_nse_current_universe_sync_internal(...)
apply_nse_current_universe_sync_reviewed_internal(...)
apply_nse_current_universe_sync_plan(...)
```

The reviewed Apply function body must remain byte/text identical to the pre-C1 authority hash `B3297AC350E262CBAA8D4F824728C70C7EC0721271DDD910BF3AB5BF22CE4981`.

## 7. No public result change

Do not modify or extend:

```text
NseCurrentUniverseSyncInput
NseCurrentUniverseApplyInput
NseCurrentUniverseSyncPreviewRow
NseCurrentUniverseSyncResult
Tauri command signatures
frontend types
operator messages
reviewed plan hash material
```

C1 diagnostics are private Rust values only. They are not serialized, persisted, logged, returned to the UI, written to the database, or included in the plan fingerprint.

## 8. Private shadow vocabulary

C1 introduces private NSE-owner vocabulary conceptually equivalent to:

```rust
enum NseI3Er2ShadowResolverError {
    InvalidInput(String),
    AmbiguousDeterministicCandidates { rule_ids: Vec<IdentityResolverRuleId> },
    InvalidConstructedResult(String),
}

enum NseI3Er2ShadowState {
    Evaluated(IdentityResolverResult),
    NoMaterialResolverMismatch,
    ResolverError(NseI3Er2ShadowResolverError),
    NotEvaluated(NseI3Er2ShadowReason),
    AdapterError(String),
}

enum NseI3Er2ShadowReason {
    NoLocalIdentity,
    NoOfficialCurrentIdentity,
    NonManagedSourceProvenance,
    AdapterProvenanceUnavailable,
    SourceChangedDuringShadowSnapshot,
    LegacyPreviewRowNotSupported,
}

enum NseI3Er2ShadowRelationship {
    IdentityContinuitySupported,
    ResolverConflict,
    ResolverNeedsMoreEvidence,
    NoMaterialResolverMismatch,
    SourceUnavailable,
    ResolverError,
    NotEvaluated,
    AdapterError,
}
```

Equivalent private structs may include:

```text
NseI3Er2ShadowSourceSnapshot
NseI3Er2ShadowEvaluation
NseI3Er2ShadowSummary
```

They remain private to `nse_identity_imports.rs`.

## 9. Eligible legacy I3 rows

C1 evaluates only Preview rows for which both a real local Identity and a current official Identity can be proven.

| Existing I3 row | C1 behavior |
|---|---|
| `UPDATE` exact existing symbol | Evaluate |
| `REACTIVATE` exact existing symbol | Evaluate |
| `INSERT` whose `matched_symbol` resolves to a real existing NSE instrument | Evaluate |
| `INSERT` with no real existing local row | `NOT_EVALUATED / NO_LOCAL_IDENTITY` |
| `OLD_SYMBOL` | `NOT_EVALUATED / NO_OFFICIAL_CURRENT_IDENTITY` |
| `DELISTED` | `NOT_EVALUATED / NO_OFFICIAL_CURRENT_IDENTITY` |
| `UNKNOWN_INACTIVE` | `NOT_EVALUATED / NO_OFFICIAL_CURRENT_IDENTITY` |

Unchanged active current instruments that do not produce an I3 Preview row are outside C1.

Do not manufacture placeholder local/official identities simply to increase coverage.

## 10. Managed-Official provenance gate

C1 evaluates only the managed NSE Official source path used by routine I3 Preview.

If `NseCurrentUniverseSyncInput.archive_root_path` supplies a non-empty manual override:

```text
legacy I3 behavior: unchanged
ER2-C1: NOT_EVALUATED / NON_MANAGED_SOURCE_PROVENANCE
```

C1 does not upgrade a manually selected archive into official resolver provenance merely because the files parse.

No network health call is introduced.

## 11. Shadow source snapshot and race protection

After the legacy plan has been built, C1 re-reads the already-local managed source files once and captures exact hashes/provenance.

The current master must be reconstructed with the same semantics as legacy I3:

```text
Equity supported-series rows first
SME supported-series rows second
first symbol occurrence wins
final rows sorted by symbol
```

The canonical shadow current-master rows must equal `plan.current_rows` semantically.

If they differ:

```text
NOT_EVALUATED / SOURCE_CHANGED_DURING_SHADOW_SNAPSHOT
```

No resolver result may be attributed to source bytes that differ from those underlying the reviewed legacy plan.

## 12. Source-read performance boundary

Per Preview shadow batch:

```text
Equity master       ≤ 1 read/parse/hash
SME master          ≤ 1 read/parse/hash
Symbol Change       ≤ 1 read/parse/hash
Company Name Change ≤ 1 read/parse/hash
Existing NSE rows   ≤ 1 database load
```

Build in-memory indexes once. No per-preview-row filesystem read, no per-row database query and no network request.

## 13. Local Identity mapping

Map the actual existing NSE instrument row mechanically:

```text
exchange         = NSE
symbol           = existing.symbol
series           = existing.series
isin             = existing.isin
company_name     = existing.name
lifecycle_state  = ACTIVE when is_active=true, otherwise INACTIVE
effective_from   = None
effective_to     = None
```

Do not invent chronology absent from the current I3 source.

For an eligible Preview row, prefer its real `matched_symbol` when present; otherwise resolve the exact existing official symbol. If no actual local row exists, do not evaluate.

## 14. Official current Identity mapping

Map the current NSE master row:

```text
exchange         = NSE
symbol           = official symbol
series           = official series
isin             = official ISIN
company_name     = official company name
lifecycle_state  = ACTIVE
effective_date   = None
```

The `source_id` and `evidence_id` must point to the exact Current Master evidence item supplied to the resolver input.

## 15. Frozen ER1 source identifiers

C1 reuses the existing ER1 vocabulary exactly:

```text
NSE_EQUITY_MASTER
NSE_SME_MASTER
NSE_SYMBOL_CHANGE
NSE_COMPANY_NAME_CHANGE
```

Because these are not exported constants from `official_source_health.rs`, C1 may define private NSE-owner constants containing these exact strings. It must not invent synonymous source IDs.

## 16. Current Master evidence

Each evaluated official current Identity receives authoritative `CURRENT_MASTER` evidence:

```text
authority_class = OFFICIAL_EXCHANGE_STRUCTURED
evidence_kind   = CURRENT_MASTER
source_id       = NSE_EQUITY_MASTER or NSE_SME_MASTER
content_sha256  = exact complete source-file SHA-256
symbol          = exact parsed symbol
series          = exact parsed series
isin            = exact parsed ISIN
company_name    = exact parsed company name
```

Source origin must respect the current merge behavior: an Equity row owns a duplicate symbol before SME; SME owns only symbols not already supplied by Equity.

`source_reference` is a deterministic managed-relative file/semantic-row reference. It must not claim a URL or row number that the adapter cannot prove.

## 17. Deterministic evidence IDs

Evidence IDs must be stable across equivalent runs and must not include wall-clock time.

The ID must deterministically bind at least:

```text
ER2-C1 evidence-ID version
source_id
evidence_kind
content_sha256
canonical semantic row fields
```

SHA-256 encoding may be used for compactness.

Changing `retrieved_at_ist` alone must not change evidence identity or resolver semantics.

## 18. `retrieved_at_ist`

C1 records the time at which it observed the exact local hashed source snapshot.

It does not claim to be the original NSE HTTP-download timestamp.

The implementation must produce an IST offset-aware timestamp without `unwrap()`/`expect()` normal production control flow. Timestamp construction failure becomes shadow AdapterError and cannot fail Preview.

## 19. Duplicate current ISIN expansion

For an evaluated row with a non-empty official ISIN, include all relevant authoritative current-master rows on NSE that share that ISIN.

This enables ER2-B Rule E:

```text
ACTIVE_DUPLICATE_ISIN_CONFLICT_V1
```

Do not pass the entire NSE master to every resolver invocation; include only the target current row plus relevant same-ISIN peers.

Same symbol/different series is not Rule E.

## 20. Symbol-change evidence

When the managed official symbol-change source exists locally and parses successfully, C1 may emit:

```text
evidence_kind   = SYMBOL_CHANGE
source_id       = NSE_SYMBOL_CHANGE
authority_class = OFFICIAL_EXCHANGE_STRUCTURED
old_symbol      = actual official old symbol
new_symbol      = actual official new symbol
effective_date  = actual official effective date
company_name    = only the value actually supplied by the row
content_sha256  = exact symbol-change file SHA-256
```

The current NSE symbol-change row does not provide ISIN. Therefore:

> C1 MUST NOT copy ISIN from Current Master/local DB into SYMBOL_CHANGE evidence.

That non-synthesis rule is mandatory even when it causes Rule A to remain Rule I.

## 21. Company-name-change evidence

When the managed official company-name-change source exists locally and parses successfully, C1 may emit:

```text
evidence_kind   = NAME_CHANGE
source_id       = NSE_COMPANY_NAME_CHANGE
authority_class = OFFICIAL_EXCHANGE_STRUCTURED
symbol          = actual official symbol
company_name    = actual official new company name
effective_date  = actual official effective date
content_sha256  = exact name-change file SHA-256
```

The row does not prove an ISIN. C1 MUST NOT borrow one from Current Master or the database to force Rule B/C confirmation.

## 22. Local database history is not official evidence

`instrument_identity_history` may continue to influence the existing legacy I3 `matched_symbol`/history-hint logic.

C1 must not re-emit those local rows as `OFFICIAL_EXCHANGE_STRUCTURED` resolver evidence because the current DB row does not independently preserve the exact official content provenance required by ER2.

This prevents circular authority.

## 23. Evidence kinds absent from C1 V1

C1 generates only:

```text
CURRENT_MASTER
SYMBOL_CHANGE
NAME_CHANGE
```

C1 does not manufacture:

```text
ISIN_CHANGE
SERIES_CHANGE
DELISTING
LISTING
LIFECYCLE_STATUS
HISTORICAL_IDENTITY
```

Adding any of these requires a separate approved evidence-source design.

## 24. Source availability semantics

When managed Current Master bytes exist, parse successfully, satisfy current I3 freshness/population requirements, match `plan.current_rows`, and carry exact local provenance, resolver input may use:

```text
required_source_health = AVAILABLE
```

Missing optional Symbol/Name history does not make Current Master unavailable. It simply leaves evidence incomplete and may produce Rule I.

If trustworthy Current Master provenance cannot be constructed, C1 does not guess `AVAILABLE`; it records an adapter/not-evaluated state and preserves Preview.

## 25. Resolver outcome taxonomy

Normal ER2 result:

```text
Evaluated(IdentityResolverResult)
```

ER2 `NoMismatchToResolve`:

```text
NoMaterialResolverMismatch
```

ER2 internal failures:

```text
InvalidInput
AmbiguousDeterministicCandidates
InvalidConstructedResult
```

map to private `ResolverError` rather than Preview failure.

Adapter/source construction failures map to private `AdapterError`/`NotEvaluated` reasons.

## 26. Relationship classification

Do not compare legacy action strings directly to resolver conclusions.

Map semantic relationship:

```text
CONFIRMED positive continuity conclusion
→ IdentityContinuitySupported

CONFLICT / CONFLICTING_IDENTITY
→ ResolverConflict

INSUFFICIENT_EVIDENCE / NO_CONCLUSION
→ ResolverNeedsMoreEvidence

NoMismatchToResolve
→ NoMaterialResolverMismatch

SOURCE_UNAVAILABLE
→ SourceUnavailable

resolver internal error
→ ResolverError

ineligible row
→ NotEvaluated

adapter failure
→ AdapterError
```

`IdentityContinuitySupported` does not mean the operational legacy action is approved.

## 27. Expected characterization cases

C1 must explicitly characterize at least:

```text
Exact-symbol changed non-empty ISIN, no Rule-D bridge
→ ResolverConflict

Old/new symbol + legacy history hint + symbol-change row without ISIN
→ ResolverNeedsMoreEvidence; no synthesized Rule-A confirmation

Name change row without ISIN
→ ResolverNeedsMoreEvidence when no stronger rule exists

Same symbol + same ISIN + different series, no SERIES_CHANGE evidence
→ ResolverNeedsMoreEvidence; Rule H must not confirm

Inactive local + otherwise equivalent current official
→ ResolverNeedsMoreEvidence; no invented reactivation rule

Harmless company-name case/whitespace difference
→ NoMaterialResolverMismatch

Duplicate active current symbols sharing ISIN
→ Rule-E ResolverConflict
```

## 28. Failure isolation

The strongest C1 invariant:

```text
legacy Preview plan succeeds
        ↓
ANY C1 shadow outcome
        ↓
public legacy Preview still succeeds and remains identical
```

C1 must never allow resolver conflict, Rule I, ambiguity, provenance error, missing history or adapter error to escape as a public I3 error.

Production C1 code must not use `panic!`, `.unwrap()` or `.expect()` for normal shadow control flow.

## 29. No production telemetry or persistence

C1 adds no normal-runtime:

```text
console dump
file report
JSON result
SQLite table
Tauri field
frontend field
audit row
persistent resolver run
```

Shadow results exist only in memory and are discarded.

Real-data shadow certification, if wanted later, is a separate explicitly approved read-only diagnostic slice.

## 30. Determinism

Semantic output must remain invariant under:

```text
Current Master input order
optional history row order
filesystem enumeration order
evidence vector order
harmless case/whitespace normalization
different observation timestamps
irrelevant source rows
```

Stable output includes:

```text
eligibility
relationship
ER2 status
conclusion
rule ID
evidence IDs
```

## 31. Aggregate characterization

Private test/fixture summaries may count:

```text
legacy_preview_rows
eligible_rows
evaluated_rows
not_evaluated_rows
continuity_supported
resolver_conflicts
needs_more_evidence
no_material_mismatch
source_unavailable
resolver_errors
adapter_errors
```

Counts must reconcile exactly. No row silently disappears.

No agreement-percentage threshold is introduced.

## 32. TDD acceptance matrix

Required RED → GREEN groups:

```text
C1-T0  private vocabulary and classification
C1-T1  managed-source provenance gate
C1-T2  Current Master provenance/evidence identity
C1-T3  local/official mapping and eligibility
C1-T4  Symbol Change evidence/non-synthesis
C1-T5  Company Name Change evidence/non-synthesis
C1-T6  same-ISIN current-peer expansion / Rule E
C1-T7  resolver relationship classification
C1-T8  Rule-D / Rule-H / reactivation / normalization characterization
C1-T9  source-race and deterministic output
C1-T10 production Preview shadow invocation
C1-T11 public output, plan-SHA and Apply preservation
C1-T12 broader regressions and Cargo check
```

Every new behavior must demonstrate intended RED before its corresponding production behavior.

## 33. Public invariance proof

Given the same plan/source/database fixture, public Preview output before and after C1 must be structurally/JSON equivalent across all existing fields.

At least one invariance test must include an ER2 `CONFLICT` shadow result while legacy I3 retains its original public action.

That proves C1 is genuinely shadow-only.

## 34. Plan-SHA preservation

ER2 shadow state/evidence must never enter `nse_current_universe_plan_sha256(...)`.

The current function body hash `E1E528547427A529771B5BFEAA63985CBA4DC8CF26EBF232661A82B5C1A3A1E7` is a preservation sentinel and is expected unchanged.

Same legacy plan before/after C1 must produce the same reviewed plan SHA regardless of shadow outcome.

## 35. Apply preservation

`apply_nse_current_universe_sync_reviewed_internal(...)` current body hash:

```text
B3297AC350E262CBAA8D4F824728C70C7EC0721271DDD910BF3AB5BF22CE4981
```

must remain identical.

If C1 implementation requires editing that function, stop and request scope expansion.

## 36. Required validation

Minimum closeout validation after focused TDD:

```text
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline database::nse_identity_imports::tests -- --nocapture
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline database::identity_evidence_resolver::tests -- --nocapture
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline database::bse_identity_imports::tests -- --nocapture
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline database::official_source_health::tests -- --nocapture
cargo check --manifest-path src-tauri-shell/Cargo.toml --locked --offline
```

Actual counts/results must be taken from command output.

Frontend typecheck/build and portable packaging are not required if C1 remains exactly private Rust-only shadow integration. Any public/Tauri/frontend expansion requires stopping first.

## 37. Preservation authorities

Expected unchanged hashes after C1:

```text
identity_evidence_resolver.rs  AECC6C182D90598CDD78FB777FE4D0D3A0D15D0C73A071CE8E02456F71DFE3CD
database.rs                    3E90B2E22CA056340F5076EBA25E0DEFE2125EE1DD467ACE7BBD4B97B65266B9
bse_identity_imports.rs        B71050D9D2FCD69491A066313EDCA3E72AFF10498D9C7FB94B7877C8732B6D6B
official_source_health.rs      0A027FE03647D2BFB10100F1DB91927664E6F9AB5BA585BACE145D78B9637DF0
Cargo.toml                      D1199096F9EA2548FD011BC120ABD15407849A75D9AAA14240DF1D250A020D42
Cargo.lock                      670E1F7C8AF8C757122E48DFD37743D6A6CBE847A61C14E629149AAA2F5B9CCA
package.json                    8C4BEBD7A534A3393939E4F99C4E3A28691D9FA7C8F85503F0565D4544C20E6F
package-lock.json               08A6F8C52D4FD94A6777B5CC181F534C7D74DB6C9C10CFF73D9A95806C2C766D
```

Expected source delta:

```text
MODIFIED: src-tauri-shell/src/database/nse_identity_imports.rs
ADDED production source: none
REMOVED production source: none
```

## 38. Performance evidence

C1 may record diagnostic timing in test/evidence output, but no arbitrary latency threshold is frozen in this phase.

Implementation must structurally prevent per-row I/O and must report:

```text
legacy preview row count
eligible shadow row count
source row counts
shadow elapsed time where practical
```

If real runtime overhead later proves material, optimize as a separate bounded task without weakening provenance semantics.

## 39. Change report and evidence

Successful implementation must create:

```text
docs\changes\YYYY-MM-DD_HHMM_IST_IDENTITY_ER2C1_NSE_I3_SHADOW_EVIDENCE_ADAPTER.md
```

Recommended evidence package includes authority preflight, staged RED/GREEN logs, focused/broader regression logs, Apply-body preservation, source-before/after/delta, fixture-only shadow characterization, final report, `FINAL_STATE.json` and `SUMMARY.txt`.

No private real-database Identity rows belong in C1 evidence.

## 40. Rollback

Rollback is source-only:

```text
restore exact pre-C1 nse_identity_imports.rs
verify all unchanged preservation authorities
remove only C1-created documentation/evidence if rollback requires it
```

No database, frontend, resolver or dependency rollback is needed.

## 41. Explicit stop conditions

Stop before continuing if implementation would require any of:

```text
identity_evidence_resolver.rs change
ER2-A/B rule-contract change
SERIES_CHANGE acquisition
ISIN_CHANGE schema/evidence expansion
I3 plan-hash change
I3 Apply change
database/schema/data write
Tauri/public result change
frontend change
I4 integration
BSE integration
runtime persistence/logging/telemetry
network access
new production module
```

Each is a separate bounded problem requiring approval.

## 42. Closure definition

ER2-C1 may close only as:

```text
IDENTITY_ER2C1_NSE_I3_SHADOW_EVIDENCE_ADAPTER
CLOSED / GREEN / SHADOW-ONLY INTEGRATION
```

Meaning:

```text
ER2-B resolver is exercised by real NSE I3 Preview integration
BUT
legacy I3 remains operational authority
reviewed plan SHA remains authority
reviewed Apply remains write authority
shadow findings have zero product authority
```

## 43. Deferred and unauthorized phases

C1 completion does not authorize:

```text
ER2-C2 — NSE I4 historical shadow integration
ER2-C3 — operator-visible resolver diagnostics
ER2-C4 — resolver-gated operational decisions
BSE resolver integration
ER3 official-domain evidence/source discovery
```

Each requires separate design approval.
