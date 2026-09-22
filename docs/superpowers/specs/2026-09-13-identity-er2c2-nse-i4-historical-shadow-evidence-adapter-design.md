# Identity ER2-C2 — NSE I4 Historical Shadow Evidence Adapter — Formal Design Authority

**Status:** APPROVED / FROZEN DESIGN AUTHORITY — IMPLEMENTATION NOT STARTED  
**Date:** 2026-09-13 IST  
**Project / workstream:** EOD Charting Platform  
**Authorized root:** `E:\TA Projects\EOD Charting Platform`  
**Bounded problem:** ER2-C2 only — private deterministic resolver characterization of NSE I4 historical Preview evidence after rollback.  
**Production source scope:** `src-tauri-shell/src/database/nse_identity_imports.rs` only.  
**Next phases explicitly not authorized:** ER2-C3, ER2-C4, BSE resolver integration, source recovery, external-AI handoff, real-data shadow certification.

## 1. Source authority

Implementation must begin only from the verified POST-ER2-C1 / PRE-ER2-C2 source authority:

- Snapshot: `Eod Charting Platform Source Code 2026-09-13_002253_IST.zip`
- Snapshot SHA-256: `ACBB247A040B9427D5B59EF5151E8444E59FFFF20A36F83E962261EFEAAF65C9`
- Snapshot files: 935
- Source files under `scripts`, `src`, `src-tauri-shell/src`: 536
- Accepted POST-ER2-C1 canonical source fingerprint: `A66E6154F4C62D3D390617A6D35AB16F6CEF9695164A164ABB02734DB9F92E08`
- Lexical-path authority digest carried in this package: see `er2c2-source-baseline.json`.

Critical current hashes:

- `src-tauri-shell/src/database/nse_identity_imports.rs`  
  `55F30A01CF305F5F35E926F60DA577DAF55DC185D0CE31E601149AE31C800E63`
- `src-tauri-shell/src/database/identity_evidence_resolver.rs`  
  `AECC6C182D90598CDD78FB777FE4D0D3A0D15D0C73A071CE8E02456F71DFE3CD`
- `src-tauri-shell/src/database.rs`  
  `3E90B2E22CA056340F5076EBA25E0DEFE2125EE1DD467ACE7BBD4B97B65266B9`
- `src-tauri-shell/src/database/bse_identity_imports.rs`  
  `B71050D9D2FCD69491A066313EDCA3E72AFF10498D9C7FB94B7877C8732B6D6B`
- `src-tauri-shell/src/database/official_source_health.rs`  
  `0A027FE03647D2BFB10100F1DB91927664E6F9AB5BA585BACE145D78B9637DF0`
- `src-tauri-shell/Cargo.toml`  
  `D1199096F9EA2548FD011BC120ABD15407849A75D9AAA14240DF1D250A020D42`
- `src-tauri-shell/Cargo.lock`  
  `670E1F7C8AF8C757122E48DFD37743D6A6CBE847A61C14E629149AAA2F5B9CCA`
- `package.json`  
  `8C4BEBD7A534A3393939E4F99C4E3A28691D9FA7C8F85503F0565D4544C20E6F`
- `package-lock.json`  
  `08A6F8C52D4FD94A6777B5CC181F534C7D74DB6C9C10CFF73D9A95806C2C766D`

ER2-C2 is subordinate to the already accepted I4 reviewed Preview → atomic Apply authority and the closed ER2-B pure deterministic resolver.

## 2. Objective

Integrate the closed ER2-B deterministic identity resolver into NSE I4 historical Preview as a **private post-rollback shadow evaluator**.

C2 answers:

> Given the exact official historical evidence that I4 already processed, what does ER2-B conclude about identity continuity, conflict, insufficiency, or no material mismatch?

C2 does **not** answer:

> Should I4 insert/apply this historical row?

That remains I4 authority.

## 3. Core invariant

The operational flow stays:

```text
load exact I4 source snapshot
→ BEGIN IMMEDIATE
→ execute existing I4 historical plan
→ finalize existing I4 public Preview result + reviewed SHA
→ ROLLBACK
→ ER2-C2 private shadow evaluation
→ discard C2 diagnostics
→ return exact original I4 Preview result
```

Apply remains:

```text
load exact source snapshot
→ BEGIN IMMEDIATE
→ execute existing I4 plan
→ compare reviewed SHA
→ COMMIT or rollback
```

**Apply must not call C2.**

## 4. Non-goals

ER2-C2 does not:

- redesign I4;
- change historical row selection;
- change `NEW`, `DUPLICATE`, `SKIPPED`, or `ERROR` semantics;
- change public I4 result schema;
- change reviewed plan SHA;
- change I4 Apply or transaction semantics;
- modify ER2-B rules;
- add evidence kinds;
- synthesize historical ISIN/series;
- add multi-hop continuity;
- add persistence, UI, Tauri, logs, or telemetry;
- query the network;
- integrate BSE;
- operate on a real/private user database during implementation validation.

---

# Section 1 — I4 Preview-Only Post-Rollback Shadow Boundary

## 5. Integration approach

Approved approach: **post-rollback Preview-only evaluation**.

Rejected approaches:

- invoking ER2 inside `execute_nse_historical_identity_plan`;
- invoking ER2 during Apply;
- letting ER2 gate I4;
- exposing ER2 output in `NseHistoricalIdentityResult`.

## 6. Exact insertion point

Only the successful branch of:

`preview_nse_historical_identity_archive_internal(...)`

may be extended.

Current authority body SHA-256:

`D977631D16D203F360ED7E21BA740013A54415CF282B4707B279F63972320F3F`

Conceptual target:

```rust
let snapshot = load_nse_historical_identity_source_snapshot(input)?;
connection.execute_batch("BEGIN IMMEDIATE")?;

match execute_nse_historical_identity_plan(connection, &snapshot) {
    Ok(mut result) => {
        connection.execute_batch("ROLLBACK")?;
        result.applied = false;

        let shadow = evaluate_nse_i4_er2_shadow(connection, &snapshot, &result);
        let _shadow_summary = summarize_nse_i4_er2_shadow(&shadow);

        Ok(result)
    }
    Err(error) => {
        rollback_nse_historical_identity_transaction(connection);
        Err(error)
    }
}
```

Frozen ordering:

1. existing I4 execution;
2. existing I4 result/hash finalized;
3. rollback succeeds;
4. set existing `applied=false`;
5. C2 runs;
6. diagnostics are discarded;
7. unchanged public result is returned.

## 7. I4 error path

If the existing I4 operation returns `Err`, C2 does not run.

Rollback failure remains an I4 error. C2 cannot mask, replace, or reinterpret it.

## 8. Genuine local identity

For eligible historical rows, `IdentityResolverLocalIdentity` must come from the actual local instrument table **after rollback**.

For `SYMBOL_CHANGE` / `BOTH`, look up the actual `old_symbol`.

For `NAME_CHANGE`, look up the actual same/current symbol.

If no genuine local identity exists:

`NotEvaluated(NoLocalIdentity)`.

Never synthesize local identity from the I4 Preview row or the official source row.

## 9. Official current identity

Official identity comes from the I4 historical EQ authority:

`snapshot.master_rows`

—not `snapshot.current_universe_rows`.

For `SYMBOL_CHANGE` / `BOTH`, target the historical `new_symbol`.

For `NAME_CHANGE`, target the same symbol.

If the target is not in current official EQ master:

`NotEvaluated(NoOfficialCurrentIdentity)`.

## 10. No multi-hop synthesis

Given:

`OLD → MID → NEW`

C2 must not manufacture `OLD → NEW`.

Each I4 historical row is evaluated only against the exact transition represented by that source row and the genuine local/current official identities available.

## 11. I4 manual historical archive eligibility

Unlike C1, C2 accepts both managed I4 historical source roots and explicit manual historical archive roots because I4 itself accepts the manual archive as its fallback/recovery authority.

Semantic result must not depend on absolute filesystem path.

---

# Section 2 — Historical Evidence Adapter and Provenance

## 12. Reuse the same in-memory I4 snapshot

C2 receives `&NseHistoricalIdentitySourceSnapshot`.

It must not reread, reparse, or rehash source files.

The same snapshot already contains:

- exact source hashes;
- EQ master rows;
- current-universe rows;
- symbol-change rows;
- company-name-change rows.

This guarantees C2 evaluates the same exact source bytes I4 reviewed.

## 13. I4 `history_rows` decide C2 consideration

C2 traverses `result.history_rows` in order.

The Preview row is a **selection/disposition authority**, not official evidence by itself.

C2 reconstructs the exact official source row from the source snapshot.

## 14. Exact cardinality-checked historical source matching

### SYMBOL_CHANGE

Match exact:

- `old_symbol`
- `new_symbol`
- `effective_date`

against `snapshot.symbol_change_rows`.

Cardinality:

- exactly 1 → usable;
- 0 → `AdapterError(SOURCE_EVIDENCE_NOT_FOUND)`;
- >1 → `AdapterError(AMBIGUOUS_SOURCE_EVIDENCE)`.

### NAME_CHANGE

Match exact:

- `symbol`
- `old_name`
- `new_name`
- `effective_date`

against `snapshot.name_change_rows`.

Same cardinality rules.

### BOTH

Require:

- exactly one matching Symbol Change;
- exactly one matching Name Change.

Do not synthesize one combined official source row.

## 15. Current Master evidence

Every evaluated row includes Current Master evidence from `snapshot.master_rows` with:

- authority class `OFFICIAL_EXCHANGE_STRUCTURED`;
- source ID `NSE_EQUITY_MASTER`;
- source hash `snapshot.securities_available_sha256`;
- actual source symbol;
- actual source series;
- actual source ISIN;
- actual source company name.

## 16. Symbol Change evidence

Use:

- source ID `NSE_SYMBOL_CHANGE`;
- evidence kind `SYMBOL_CHANGE`;
- actual old symbol;
- actual new symbol;
- actual effective date;
- source company name only if present;
- exact `snapshot.symbol_changes_sha256`.

Must set:

```text
isin   = None
series = None
```

No Current Master borrowing.

## 17. Name Change evidence

Use:

- source ID `NSE_COMPANY_NAME_CHANGE`;
- evidence kind `NAME_CHANGE`;
- actual source symbol;
- actual old/new name;
- actual effective date;
- exact `snapshot.company_name_changes_sha256`.

Must set:

```text
isin   = None
series = None
```

## 18. BOTH evidence

BOTH supplies separate:

- Current Master;
- Symbol Change;
- Name Change.

No synthetic combined evidence kind.

## 19. Same-ISIN current peers

If current official identity has a non-empty ISIN, include other relevant active current EQ master rows sharing that ISIN so Rule E remains visible.

Do not attach the entire master.

## 20. No local DB history promotion

`instrument_identity_history` is local application state.

It may not be transformed into `OFFICIAL_EXCHANGE_STRUCTURED` evidence.

Official evidence must remain traceable to exact official source content.

## 21. Evidence IDs

Evidence IDs are deterministic and independent of:

- wall clock;
- absolute source path;
- HashMap iteration order.

They should bind:

- actual source ID;
- evidence kind;
- content SHA-256;
- canonical semantic row key.

`retrieved_at_ist` is observation metadata only and does not affect resolver semantics.

## 22. Required source health

A successfully loaded I4 snapshot may supply:

`required_source_health = Available`

without an ER1 network call.

Adapter provenance failure is an adapter error, not a fabricated `SourceUnavailable`.

---

# Section 3 — Shadow Outcome Taxonomy and Observability

## 23. I4 disposition and ER2 conclusion are different

Never equate:

- `NEW` with ER2 `CONFIRMED`;
- `DUPLICATE` with `NoMismatchToResolve`.

I4 answers historical import disposition. ER2 answers semantic identity continuity.

## 24. Private state vocabulary

Conceptually:

```rust
enum NseI4Er2ShadowState {
    Evaluated(IdentityResolverResult),
    NoMaterialResolverMismatch,
    ResolverError(NseI4Er2ShadowResolverError),
    NotEvaluated(NseI4Er2ShadowReason),
    AdapterError(String),
}
```

Resolver errors preserve:

- `InvalidInput`;
- `AmbiguousDeterministicCandidates`;
- `InvalidConstructedResult`.

`NoMismatchToResolve` maps separately to `NoMaterialResolverMismatch`.

## 25. Closed NotEvaluated reasons

Initial closed set:

```text
I4RowSkipped
I4RowError
NoLocalIdentity
NoOfficialCurrentIdentity
UnsupportedHistoricalChangeType
```

Adapter invariant failures remain `AdapterError`, not `NotEvaluated`.

## 26. Relationship taxonomy

```text
IdentityContinuitySupported
ResolverConflict
ResolverNeedsMoreEvidence
NoMaterialResolverMismatch
SourceUnavailable
ResolverError
NotEvaluated
AdapterError
```

Mapping:

- `CONFIRMED` → `IdentityContinuitySupported`;
- `CONFLICT` → `ResolverConflict`;
- `INSUFFICIENT_EVIDENCE` → `ResolverNeedsMoreEvidence`;
- `PROBABLE_REVIEW` → `ResolverNeedsMoreEvidence`;
- `SOURCE_UNAVAILABLE` → `SourceUnavailable`;
- `NoMismatchToResolve` → `NoMaterialResolverMismatch`;
- resolver internal error → `ResolverError`.

## 27. Disposition handling

- `NEW` → evaluate if eligible;
- `DUPLICATE` → evaluate if eligible;
- `SKIPPED` → `NotEvaluated(I4RowSkipped)`;
- `ERROR` → `NotEvaluated(I4RowError)`;
- unsupported future change type → fail closed privately.

## 28. Expected valid outcomes

Many Rule-I outcomes are expected and valid because NSE historical symbol/name rows do not themselves contain ISIN.

Rule D must remain visible when local/current ISIN differ without explicit continuity.

Rule E must remain visible for active duplicate current ISIN.

No material mismatch is valid for already-current duplicate history.

## 29. Manual archive path independence

The same source bytes under different managed/manual absolute paths must produce the same:

- evidence IDs;
- eligibility;
- resolver status;
- conclusion;
- rule ID;
- relationship.

Absolute path is private diagnostic context only.

## 30. Private summary

Minimum deterministic counts:

- total I4 history rows;
- NEW / DUPLICATE / SKIPPED / ERROR counts;
- eligible;
- evaluated;
- not evaluated;
- adapter errors;
- continuity supported;
- resolver conflicts;
- needs more evidence;
- no material mismatch;
- source unavailable;
- resolver errors.

No agreement percentage or certification threshold.

## 31. No runtime observability

Production C2 does not add:

- UI/Tauri output;
- logs;
- console output;
- files;
- DB rows;
- audit tables;
- persistent resolver runs;
- public warnings.

Tests inspect private helpers directly.

---

# Section 4 — TDD, Preservation and Performance Boundary

## 32. Acceptance matrix

Implementation must use strict RED → GREEN coverage for:

- T0 private vocabulary;
- T1 exact source-row reconstruction;
- T2 genuine local identity;
- T3 current EQ master provenance;
- T4 Symbol Change non-synthesis;
- T5 Name Change non-synthesis;
- T6 BOTH independent evidence;
- T7 same-ISIN current peers / Rule E;
- T8 Rule I / Rule D / no-mismatch relationship classification;
- T9 I4 disposition handling;
- T10 manual archive eligibility + path independence;
- T11 determinism;
- T12 post-rollback production Preview invocation;
- T13 full public I4 invariance and `can_apply=false` isolation;
- T14 Apply/plan-hash/atomicity preservation;
- T15 broader regressions.

## 33. Post-rollback proof

Tests must prove at C2 adapter entry:

```rust
connection.is_autocommit() == true
```

A stronger fixture must prove tentative I4 rows inserted during Preview are absent when C2 starts.

This proves C2 sees original pre-Preview local state.

## 34. Public I4 invariance

Compare legacy expected Preview result to C2-integrated result structurally/serially across all public fields.

At least one fixture must produce private ResolverConflict and one private AdapterError while the public I4 result remains unchanged.

## 35. `can_apply=false` isolation

If I4 returns a valid Preview with errors and `can_apply=false`, C2 may still characterize eligible NEW/DUPLICATE rows after rollback while ERROR/SKIPPED rows remain NotEvaluated.

C2 cannot modify:

- `can_apply`;
- error count;
- errors;
- history rows;
- plan SHA.

## 36. Hard I4 preservation authorities

Must remain byte/text identical:

- `load_nse_historical_identity_source_snapshot(...)`  
  `19F24B55AD8C810FA27CDE0938AE203B754A42AED7EA40899E3207B70911E941`
- `execute_nse_historical_identity_plan(...)`  
  `1116DD13F1B6BD3BEE7B9BA1666F922E233DA2005EB4A4AEB40961306E1C5044`
- `nse_historical_identity_plan_sha256(...)`  
  `5092727016F77F4BF2CB44B9EEF5CAF60AC4D33A2386EC6990005EE4FA632FEC`
- `apply_nse_historical_identity_archive_internal(...)`  
  `0327EF2DD0FD53A4FAFE3B80CEBB4D89DA1662D296BC1CA9916AA0A6F76BB575`

Only Preview wrapper is expected to change.

## 37. Apply non-invocation

A test-only call counter may prove:

- Preview invokes C2 exactly once after rollback;
- Apply invokes C2 zero times.

Apply source body must contain no C2 reference.

## 38. Reviewed SHA invariance

`plan_sha256` and `current_universe_plan_sha256` must be unchanged regardless of private C2 outcome.

No C2 state enters hash material.

## 39. Atomicity regressions

Existing I4 tests for transaction rollback, current-universe rollback, stale reviewed SHA, malformed SHA, duplicate/skipped rows and reviewed Apply remain GREEN.

## 40. Performance boundary

Per Preview:

- 0 C2 source-file reads;
- 0 C2 source-file parses;
- 0 C2 source-file hashes;
- 0 network calls;
- ≤1 batch read of current local NSE instrument identities;
- no per-history-row SQL;
- build lookup indexes once;
- no arbitrary latency pass/fail threshold.

---

# Section 5 — Implementation Structure, Exact Source Boundary, Stop Conditions and Closure

## 41. Production delta

Authorized production modification:

`src-tauri-shell/src/database/nse_identity_imports.rs`

No added/removed production source file.

## 42. Recommended private helper structure

Inside the NSE owner module:

```text
evaluate_nse_i4_er2_shadow
├─ build_nse_i4_er2_shadow_indexes
├─ reconstruct exact historical evidence
├─ resolve genuine local identity
├─ resolve current EQ official identity
├─ build Current Master evidence
├─ build Symbol Change evidence
├─ build Name Change evidence
├─ add same-ISIN peers
├─ build IdentityResolverInput
├─ resolve_identity
├─ classify outcome
└─ emit private evaluation

summarize_nse_i4_er2_shadow
```

## 43. Build indexes once

Indexes:

- existing local by symbol;
- EQ current master by symbol;
- EQ current master by ISIN;
- Symbol Change by exact `(old,new,date)`;
- Name Change by exact `(symbol,old_name,new_name,date)`.

## 44. No source I/O in adapter

C2 must not call:

- `fs::read`;
- source download;
- archive discovery;
- source loader;
- network client.

It consumes the already-loaded I4 snapshot.

## 45. DB boundary

C2 may batch-read current local NSE instruments after rollback.

No writes.

No explicit transaction.

No per-row query.

## 46. Do not refactor C1

Do not generalize/rename/move accepted C1 helpers merely to reduce duplication.

Small C2-specific private duplication is preferable to risking a closed C1 behavior change.

## 47. Source IDs

Keep actual official source IDs:

```text
NSE_EQUITY_MASTER
NSE_SYMBOL_CHANGE
NSE_COMPANY_NAME_CHANGE
```

C2 does not create new source authority.

## 48. Canonical source references

Use canonical relative source identity + semantic row key.

Absolute manual/managed archive paths cannot influence deterministic evidence IDs or rule behavior.

## 49. Test hooks

`#[cfg(test)]` private counters/hooks are permitted for Preview invocation and post-rollback proof.

No runtime telemetry.

## 50. Panic-free production section

C2 normal-flow production logic must not use:

- `panic!`;
- `.unwrap()`;
- `.expect()`.

Unexpected mapping conditions become private diagnostics.

## 51. Documentation

Successful implementation creates:

`docs\changes\YYYY-MM-DD_HHMM_IST_IDENTITY_ER2C2_NSE_I4_HISTORICAL_SHADOW_EVIDENCE_ADAPTER.md`

It must record source authority, final architecture, RED/GREEN proof, post-rollback proof, provenance/non-synthesis, preservation hashes, regressions, Cargo check, risks, rollback, evidence ZIP hash and future-phase boundary.

## 52. Evidence

Evidence should include authority preflight, RED/GREEN logs, focused C2 tests, ER2-B/NSE/BSE/ER1 regressions, Cargo check, preservation body evidence, source-before/after/delta manifests, private fixture summary, report, `FINAL_STATE.json` and `SUMMARY.txt`.

No real DB dump or user data.

## 53. Rollback

Restore exact pre-C2:

`nse_identity_imports.rs`  
`55F30A01CF305F5F35E926F60DA577DAF55DC185D0CE31E601149AE31C800E63`

Then verify frozen source authority.

## 54. Mandatory STOP conditions

Stop for approval if implementation requires any of:

- ER2-B resolver modification;
- new evidence kind;
- historical ISIN synthesis;
- multi-hop continuity;
- I4 disposition/selection change;
- `execute_nse_historical_identity_plan` change;
- plan-hash change;
- Apply change;
- transaction-boundary change;
- DB schema/data change;
- persistent shadow state;
- frontend/Tauri output;
- runtime logs/telemetry;
- network;
- BSE integration;
- second production module;
- real/private database requirement.

## 55. Completion classification

Only after all accepted gates:

```text
IDENTITY_ER2C2_NSE_I4_HISTORICAL_SHADOW_EVIDENCE_ADAPTER

CLOSED / GREEN / SHADOW-ONLY INTEGRATION
```

Meaning ER2-B is privately exercised against eligible NSE I4 historical Preview evidence after rollback while existing reviewed I4 Preview → atomic Apply remains operational authority.

## 56. Unauthorized after closure

C2 does not authorize:

- ER2-C3 operator-visible diagnostics;
- ER2-C4 gating/decision influence;
- BSE resolver integration;
- source recovery;
- external-AI handoff;
- real-data shadow certification.

---

# Final Design Decision

ER2-C2 is intentionally **not a rebuild**.

It is a one-file, Preview-only, post-rollback shadow integration around the accepted I4 authority.

Sections 1–5 were explicitly approved before this formal authority was produced.

**Implementation status:** NOT STARTED.
