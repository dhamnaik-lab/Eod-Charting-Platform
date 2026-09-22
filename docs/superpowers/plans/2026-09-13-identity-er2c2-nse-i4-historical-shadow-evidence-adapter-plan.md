# Identity ER2-C2 — NSE I4 Historical Shadow Evidence Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Privately run the closed ER2-B deterministic identity resolver against eligible NSE I4 historical Preview rows after rollback, while preserving the existing I4 reviewed Preview → atomic Apply behavior byte-for-byte outside the Preview wrapper.

**Architecture:** Keep all implementation in `src-tauri-shell/src/database/nse_identity_imports.rs`. Reuse the already-loaded `NseHistoricalIdentitySourceSnapshot`, batch-read local NSE instruments once after I4 rollback, build deterministic lookup indexes, construct only Current Master / Symbol Change / Name Change evidence, run `resolve_identity`, summarize privately, discard all diagnostics, and return the original I4 result unchanged.

**Tech Stack:** Rust, rusqlite, existing ER2-B resolver module, existing NSE I4 Identity importer, Cargo tests/check.

**Spec:** `docs/superpowers/specs/2026-09-13-identity-er2c2-nse-i4-historical-shadow-evidence-adapter-design.md`

## Global Constraints

- Authorized root: `E:\TA Projects\EOD Charting Platform`.
- Source authority: POST-ER2-C1 / PRE-ER2-C2 snapshot SHA-256 `ACBB247A040B9427D5B59EF5151E8444E59FFFF20A36F83E962261EFEAAF65C9`.
- Preimage `src-tauri-shell/src/database/nse_identity_imports.rs` SHA-256: `55F30A01CF305F5F35E926F60DA577DAF55DC185D0CE31E601149AE31C800E63`.
- Modify production source only in `src-tauri-shell/src/database/nse_identity_imports.rs`.
- Do not modify `identity_evidence_resolver.rs`, `database.rs`, BSE Identity, ER1 Source Health, Cargo/npm dependency files, frontend/Tauri, DB schema/data, I4 plan hashing, or reviewed Apply.
- C2 executes only after successful I4 Preview rollback.
- C2 never executes during Apply.
- No source-file I/O inside C2; consume the already-loaded I4 snapshot.
- No network.
- No real/private project database; use fixture source archives + in-memory SQLite only.
- No runtime logs/telemetry/persistence/public result changes.
- Symbol/name historical evidence must not synthesize ISIN or series.
- No multi-hop continuity synthesis.
- Manual I4 archive override is valid C2 provenance when I4 successfully loads/hashes it.
- Production C2 logic must avoid normal-flow `panic!`, `.unwrap()`, `.expect()`.
- User policy forbids Git/source-control commands unless explicitly authorized. **Do not add commit steps to this plan.** Use evidence checkpoints instead.
- PowerShell execution runners must use guard clauses/separate `if` blocks only; no `else`/`elseif`.

## Frozen I4 Preservation Authorities

The following function bodies must remain text-identical:

- `load_nse_historical_identity_source_snapshot`  
  `19F24B55AD8C810FA27CDE0938AE203B754A42AED7EA40899E3207B70911E941`
- `execute_nse_historical_identity_plan`  
  `1116DD13F1B6BD3BEE7B9BA1666F922E233DA2005EB4A4AEB40961306E1C5044`
- `nse_historical_identity_plan_sha256`  
  `5092727016F77F4BF2CB44B9EEF5CAF60AC4D33A2386EC6990005EE4FA632FEC`
- `apply_nse_historical_identity_archive_internal`  
  `0327EF2DD0FD53A4FAFE3B80CEBB4D89DA1662D296BC1CA9916AA0A6F76BB575`

Expected-to-change function:

- `preview_nse_historical_identity_archive_internal`  
  pre-C2 SHA-256 `D977631D16D203F360ED7E21BA740013A54415CF282B4707B279F63972320F3F`

---

### Task 1: Add private C2 vocabulary and RED taxonomy tests

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`
- Test: existing `#[cfg(test)] mod tests` in the same file

**Interfaces:**
- Produces private enums/structs used by all later tasks:
  - `NseI4Er2ShadowResolverError`
  - `NseI4Er2ShadowState`
  - `NseI4Er2ShadowReason`
  - `NseI4Er2ShadowRelationship`
  - `NseI4Er2ShadowEvaluation`
  - `NseI4Er2ShadowSummary`

- [ ] **Step 1: Write T0 failing tests before the production vocabulary exists**

Add focused tests with names beginning `er2c2_t0_` that compile-reference the proposed private state and assert:

```rust
let state = NseI4Er2ShadowState::NoMaterialResolverMismatch;
assert_eq!(
    nse_i4_er2_shadow_relationship(&state),
    NseI4Er2ShadowRelationship::NoMaterialResolverMismatch,
);
```

Also test resolver error mapping:

```rust
let state = classify_nse_i4_er2_resolver_outcome(
    Err(IdentityResolverEvaluationError::NoMismatchToResolve),
);
assert_eq!(state, NseI4Er2ShadowState::NoMaterialResolverMismatch);
```

- [ ] **Step 2: Run RED**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c2_t0_ -- --nocapture
```

Expected: compile/test failure because the C2 vocabulary/helpers are absent.

- [ ] **Step 3: Add the minimal private vocabulary**

Use these semantics:

```rust
#[derive(Clone, Debug, PartialEq, Eq)]
enum NseI4Er2ShadowResolverError {
    InvalidInput(String),
    AmbiguousDeterministicCandidates { rule_ids: Vec<IdentityResolverRuleId> },
    InvalidConstructedResult(String),
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum NseI4Er2ShadowState {
    Evaluated(IdentityResolverResult),
    NoMaterialResolverMismatch,
    ResolverError(NseI4Er2ShadowResolverError),
    NotEvaluated(NseI4Er2ShadowReason),
    AdapterError(String),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum NseI4Er2ShadowReason {
    I4RowSkipped,
    I4RowError,
    NoLocalIdentity,
    NoOfficialCurrentIdentity,
    UnsupportedHistoricalChangeType,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum NseI4Er2ShadowRelationship {
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

Implement `classify_nse_i4_er2_resolver_outcome(...)` and `nse_i4_er2_shadow_relationship(...)` by mirroring the already accepted C1 semantics without refactoring C1.

- [ ] **Step 4: Run T0 GREEN**

Same command. Expected: all `er2c2_t0_` tests PASS.

- [ ] **Step 5: Evidence checkpoint**

Record focused output and confirm no non-NSE file changed.

---

### Task 2: Exact source-row reconstruction and archive-path independence

**Files:**
- Modify/Test: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Produces:
  - `NseI4Er2HistoricalEvidenceMatch`
  - exact-key historical indexes
  - `reconstruct_nse_i4_er2_historical_evidence(...)`

Recommended private data shape:

```rust
#[derive(Clone, Debug)]
struct NseI4Er2HistoricalEvidenceMatch {
    symbol_change: Option<NseSymbolChangeRow>,
    name_change: Option<NseNameChangeRow>,
}
```

- [ ] **Step 1: Write T1 RED fixtures**

Add `er2c2_t1_...` tests for:
- exactly one Symbol Change match;
- zero Symbol Change match → AdapterError;
- duplicate exact Symbol Change match → AdapterError;
- exactly one Name Change match;
- duplicate exact Name Change match → AdapterError;
- BOTH requires exactly one of each.

Use the actual `NseHistoricalIdentityPreviewRow` fields:

```rust
NseHistoricalIdentityPreviewRow {
    disposition: "NEW".to_string(),
    change_type: "SYMBOL_CHANGE".to_string(),
    effective_date: Some("2026-01-01".to_string()),
    old_symbol: Some("OLD".to_string()),
    new_symbol: Some("NEW".to_string()),
    current_symbol: Some("NEW".to_string()),
    old_name: None,
    new_name: None,
    source_file: "...".to_string(),
    detail: "...".to_string(),
}
```

- [ ] **Step 2: Run RED**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c2_t1_ -- --nocapture
```

Expected: missing reconstruction/index helpers.

- [ ] **Step 3: Add exact-key indexes**

Use canonicalized code strings for symbol lookup, preserving exact effective dates and names:

```rust
type SymbolChangeKey = (String, String, String);
type NameChangeKey = (String, String, String, String);
```

Build:

```rust
symbol_changes_by_exact_key: HashMap<SymbolChangeKey, Vec<NseSymbolChangeRow>>
name_changes_by_exact_key: HashMap<NameChangeKey, Vec<NseNameChangeRow>>
```

Do not silently select `rows[0]`; enforce cardinality.

- [ ] **Step 4: Implement reconstruction**

Map:
- `SYMBOL_CHANGE` → one exact Symbol Change;
- `NAME_CHANGE` → one exact Name Change;
- `BOTH` → one exact of each;
- any other type → `NotEvaluated(UnsupportedHistoricalChangeType)`.

Keep AdapterError separate from NotEvaluated.

- [ ] **Step 5: Add path-independence unit test**

Create equivalent snapshots with differing `archive_root_path`, `symbol_changes_path`, and `company_name_changes_path` but identical semantic rows/hashes. Reconstruction semantics must remain equal.

- [ ] **Step 6: Run T1 GREEN**

Expected: all source matching/path-independence tests PASS.

---

### Task 3: Build genuine local/current official identity indexes

**Files:**
- Modify/Test: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Produces:
  - `NseI4Er2ShadowIndexes`
  - `build_nse_i4_er2_shadow_indexes(...)`
  - `build_nse_i4_er2_local_identity(...)`
  - current EQ official lookup

Recommended shape:

```rust
struct NseI4Er2ShadowIndexes {
    observed_at_ist: String,
    existing_by_symbol: HashMap<String, ExistingNseInstrumentRow>,
    current_master_by_symbol: HashMap<String, NseSecurityMasterRow>,
    current_master_by_isin: HashMap<String, Vec<NseSecurityMasterRow>>,
    symbol_changes_by_exact_key: HashMap<SymbolChangeKey, Vec<NseSymbolChangeRow>>,
    name_changes_by_exact_key: HashMap<NameChangeKey, Vec<NseNameChangeRow>>,
}
```

- [ ] **Step 1: Write T2/T3 RED tests**

Cases:
- Symbol Change local identity uses actual `old_symbol` DB row;
- Name Change local identity uses actual same-symbol DB row;
- absent local row → `NoLocalIdentity`;
- official target comes from `snapshot.master_rows`;
- target existing only in `current_universe_rows` but not `master_rows` → `NoOfficialCurrentIdentity`;
- inactive local row maps lifecycle state `INACTIVE`;
- local `effective_from/effective_to` remain `None`.

- [ ] **Step 2: Run RED**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c2_t2_ er2c2_t3_ -- --nocapture
```

If Cargo accepts only one filter at a time, run each prefix separately.

- [ ] **Step 3: Implement one batch local read**

At shadow-index construction time call the existing read-only helper once:

```rust
let existing_rows = load_existing_nse_instrument_rows(connection)?;
```

Build `existing_by_symbol` once. Do not query per history row.

- [ ] **Step 4: Build EQ current-master indexes from `snapshot.master_rows` only**

Build by symbol and by non-empty ISIN. Do not populate official identity from `snapshot.current_universe_rows`.

- [ ] **Step 5: Implement local identity mapper**

Use actual DB fields:

```rust
IdentityResolverLocalIdentity {
    exchange: NSE_EXCHANGE.to_string(),
    symbol: row.symbol.clone(),
    series: row.series.clone(),
    isin: row.isin.clone(),
    company_name: row.name.clone(),
    lifecycle_state: Some(if row.is_active { "ACTIVE" } else { "INACTIVE" }.to_string()),
    effective_from: None,
    effective_to: None,
}
```

- [ ] **Step 6: Run T2/T3 GREEN**

Expected: all eligibility/provenance tests PASS.

---

### Task 4: Add provenance-correct evidence builders with no synthesis

**Files:**
- Modify/Test: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Produces deterministic builders:
  - `build_nse_i4_er2_current_master_evidence(...)`
  - `build_nse_i4_er2_symbol_change_evidence(...)`
  - `build_nse_i4_er2_name_change_evidence(...)`
  - `build_nse_i4_er2_official_identity(...)`
  - deterministic evidence ID helper

- [ ] **Step 1: Write T4/T5/T6 RED tests**

Assert:
- Current Master evidence uses `NSE_EQUITY_MASTER` + `securities_available_sha256`;
- Symbol Change evidence uses `NSE_SYMBOL_CHANGE` + `symbol_changes_sha256`;
- Name Change evidence uses `NSE_COMPANY_NAME_CHANGE` + `company_name_changes_sha256`;
- Symbol/Name history evidence has `isin == None` and `series == None`;
- BOTH emits exactly Current Master + Symbol Change + Name Change;
- no C2 evidence kind outside CurrentMaster/SymbolChange/NameChange.

- [ ] **Step 2: Run RED**

Run each prefix `er2c2_t4_`, `er2c2_t5_`, `er2c2_t6_`.

- [ ] **Step 3: Implement deterministic evidence IDs**

Use SHA-256 over length-delimited semantic parts, e.g.:

```rust
fn er2c2_evidence_id(parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update((part.len() as u64).to_le_bytes());
        hasher.update(part.as_bytes());
    }
    format!("ER2C2-{:x}", hasher.finalize())
}
```

Do not include wall-clock time or absolute path.

- [ ] **Step 4: Implement canonical source references**

Use canonical relative source identifiers and semantic keys. Absolute archive roots may not influence evidence identity.

- [ ] **Step 5: Implement evidence builders**

Historical source evidence must preserve missing fields rather than borrow current master fields.

- [ ] **Step 6: Add observation-time independence test**

Build the same evidence with two different `retrieved_at_ist` values. Require equal evidence IDs.

- [ ] **Step 7: Run T4/T5/T6 GREEN**

Expected: all provenance/non-synthesis tests PASS.

---

### Task 5: Build resolver inputs, Rule-E peers, and relationship classification

**Files:**
- Modify/Test: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Produces:
  - `build_nse_i4_er2_input(...)`
  - resolver outcome classification
  - per-row `NseI4Er2ShadowEvaluation`

- [ ] **Step 1: Write T7/T8 RED tests**

Fixtures:
1. two active EQ current-master rows share same non-empty ISIN → Rule E conflict;
2. Symbol Change without source-row ISIN continuity → Rule I / ResolverNeedsMoreEvidence;
3. Name Change without historical ISIN continuity → Rule I / ResolverNeedsMoreEvidence;
4. different non-empty local/current ISIN without explicit bridge → Rule D / ResolverConflict;
5. local/current identity equivalent → NoMaterialResolverMismatch.

- [ ] **Step 2: Run RED**

Run `er2c2_t7_` and `er2c2_t8_`.

- [ ] **Step 3: Implement relevant peer expansion**

For current official non-empty ISIN, add only Current Master peer evidence from `current_master_by_isin[isin]`.

Sort resulting evidence by deterministic `evidence_id` before `resolve_identity`.

- [ ] **Step 4: Build `IdentityResolverInput`**

Set:

```rust
IdentityResolverInput {
    local_identity,
    official_identity: Some(official),
    evidence,
    required_source_health: IdentityResolverSourceAvailability::Available,
}
```

- [ ] **Step 5: Classify ER2 outcome**

Map:
- Confirmed → continuity supported;
- Conflict → resolver conflict;
- InsufficientEvidence / ProbableReview → needs more evidence;
- SourceUnavailable → source unavailable;
- NoMismatchToResolve → no material mismatch;
- resolver internal errors → resolver error.

- [ ] **Step 6: Run T7/T8 GREEN**

Expected: Rule E/D/I/no-mismatch fixtures PASS.

---

### Task 6: Handle I4 dispositions and deterministic summary

**Files:**
- Modify/Test: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Produces:
  - `evaluate_nse_i4_er2_shadow_row(...)`
  - `summarize_nse_i4_er2_shadow(...)`

- [ ] **Step 1: Write T9 RED tests**

Assert:
- `NEW` evaluates when eligible;
- `DUPLICATE` evaluates when eligible;
- `SKIPPED` → `NotEvaluated(I4RowSkipped)`;
- `ERROR` → `NotEvaluated(I4RowError)`;
- NEW does not imply Confirmed;
- DUPLICATE does not imply NoMismatch.

- [ ] **Step 2: Run RED**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c2_t9_ -- --nocapture
```

- [ ] **Step 3: Implement disposition guard**

Check I4 disposition before source reconstruction. Preserve input order.

- [ ] **Step 4: Implement summary accounting**

At minimum count:
- total;
- NEW/DUPLICATE/SKIPPED/ERROR;
- evaluated/not-evaluated/adapter-error;
- each relationship family.

Assert:

```rust
assert_eq!(
    summary.history_rows,
    summary.evaluated_rows + summary.not_evaluated_rows + summary.adapter_error_rows
);
```

Keep this invariant in tests, not as a production panic.

- [ ] **Step 5: Run T9 GREEN**

Expected: all disposition/summary tests PASS.

---

### Task 7: Prove manual archive equivalence and semantic determinism

**Files:**
- Modify/Test: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Uses all prior helpers without adding operational authority.

- [ ] **Step 1: Write T10/T11 RED tests**

Create two fixture archive roots containing identical source bytes. Run I4 snapshot load and C2 private evaluation for each.

Require identical:
- eligibility;
- evidence IDs;
- resolver status;
- conclusion;
- rule ID;
- relationship.

Also vary:
- observation timestamp;
- source vector order;
- evidence insertion order;
- irrelevant source rows.

- [ ] **Step 2: Run RED**

Run `er2c2_t10_` and `er2c2_t11_`.

- [ ] **Step 3: Make only deterministic-order corrections needed**

Sort:
- same-ISIN peer rows;
- evidence IDs;
- exact-key row vectors where duplicate cardinality diagnostics need stable reporting.

Do not alter I4 source snapshot ordering or public result.

- [ ] **Step 4: Run T10/T11 GREEN**

Expected: managed/manual path and ordering changes do not alter semantic output.

---

### Task 8: Integrate C2 into production I4 Preview after rollback

**Files:**
- Modify/Test: `src-tauri-shell/src/database/nse_identity_imports.rs`

**Interfaces:**
- Produces final private entrypoint:

```rust
fn evaluate_nse_i4_er2_shadow(
    connection: &Connection,
    snapshot: &NseHistoricalIdentitySourceSnapshot,
    result: &NseHistoricalIdentityResult,
) -> Vec<NseI4Er2ShadowEvaluation>
```

- [ ] **Step 1: Add `#[cfg(test)]` call-count/post-rollback hooks**

Use thread-local counters/flags only under tests.

- [ ] **Step 2: Write T12 RED test**

Call `preview_nse_historical_identity_archive_internal(...)` and require:
- C2 call count = 1;
- adapter observed `connection.is_autocommit() == true`.

A stronger test should arrange a tentative I4 insertion and require that C2's post-rollback lookup cannot observe that tentative row.

- [ ] **Step 3: Run RED**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c2_t12_ -- --nocapture
```

Expected: production Preview does not yet invoke C2.

- [ ] **Step 4: Modify only the successful Preview branch**

After `ROLLBACK` succeeds and `result.applied=false` is set:

```rust
let er2c2_shadow = evaluate_nse_i4_er2_shadow(connection, &snapshot, &result);
let _er2c2_shadow_summary = summarize_nse_i4_er2_shadow(&er2c2_shadow);
```

Do not recalculate `plan_sha256`. Do not mutate result from shadow data.

- [ ] **Step 5: Make adapter failure non-propagating**

`evaluate_nse_i4_er2_shadow` returns private evaluations; internal row-level problems become private states. It must not return `AppResult` into the Preview wrapper.

- [ ] **Step 6: Run T12 GREEN**

Expected: one call, post-rollback autocommit true, tentative I4 state absent.

---

### Task 9: Prove complete public I4 invariance and Apply preservation

**Files:**
- Modify/Test: `src-tauri-shell/src/database/nse_identity_imports.rs`
- Evidence: preservation body files/hashes

- [ ] **Step 1: Write T13 public-invariance tests**

Build a legacy expected result by directly invoking existing snapshot + transaction + `execute_nse_historical_identity_plan` + rollback without C2, then compare with `preview_nse_historical_identity_archive_internal`.

Require full `serde_json::to_value` equality where serialization is available; otherwise compare every public field explicitly.

Include fixtures where private C2 produces:
- ResolverConflict;
- AdapterError;
- `can_apply=false`.

- [ ] **Step 2: Run T13 GREEN after integration**

Public result must remain identical.

- [ ] **Step 3: Add Apply non-invocation test**

Reset C2 test counter; call `apply_nse_historical_identity_archive_internal` with a matching reviewed SHA. Require C2 call count remains zero.

- [ ] **Step 4: Re-run existing I4 atomicity tests**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline i4_historical_ -- --nocapture
```

Expected: all existing I4 historical tests GREEN.

- [ ] **Step 5: Verify function-body hashes**

Extract and hash the exact function bodies. Require the frozen four preservation authorities remain unchanged.

Preview wrapper may change; Apply/execute/hash/source-loader may not.

- [ ] **Step 6: Verify no C2 symbol occurs inside Apply body**

Static source assertion: `apply_nse_historical_identity_archive_internal` body contains no `er2c2` / `nse_i4_er2` reference.

---

### Task 10: Run broader regressions, source-boundary postflight, documentation, and evidence

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`
- Create: `docs/changes/YYYY-MM-DD_HHMM_IST_IDENTITY_ER2C2_NSE_I4_HISTORICAL_SHADOW_EVIDENCE_ADAPTER.md`
- External evidence: EOD Charting Platform Source Audit root

- [ ] **Step 1: Run complete C2 focused suite**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c2_ -- --nocapture
```

Expected: all C2 tests PASS; zero ignored C2 tests unless explicitly documented.

- [ ] **Step 2: Run ER2-B regression**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline database::identity_evidence_resolver::tests -- --nocapture
```

Expected: existing ER2-B suite PASS.

- [ ] **Step 3: Run full NSE Identity owner regression**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline database::nse_identity_imports::tests -- --nocapture
```

Expected: all existing I3/I4/C1 plus new C2 owner tests PASS.

- [ ] **Step 4: Run BSE Identity regression**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline database::bse_identity_imports::tests -- --nocapture
```

Expected: PASS.

- [ ] **Step 5: Run ER1 Source Health regression**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline database::official_source_health::tests -- --nocapture
```

Expected: PASS.

- [ ] **Step 6: Run Rust check**

```powershell
cargo check --manifest-path src-tauri-shell/Cargo.toml --locked --offline
```

Expected: exit 0.

No frontend typecheck/build/portable build is required if the bounded Rust-private scope stayed intact.

- [ ] **Step 7: Verify exact production source delta**

Required:

```text
modified:
src-tauri-shell/src/database/nse_identity_imports.rs

added production source:
0

removed production source:
0
```

Verify protected source/dependency hashes remain equal to the formal design authority.

- [ ] **Step 8: Static C2 production safety scan**

Between the C2 production marker and Preview wrapper, require:
- no `panic!`;
- no `.unwrap(`;
- no `.expect(`;
- no DB `.execute(` writes;
- no `fs::read`;
- no HTTP/network token;
- exactly one `resolve_identity(` call in the row-evaluation path.

Use structural/source evidence in addition to tests.

- [ ] **Step 9: Write the mandatory change report**

Record:
- source authority;
- exact behavior changed;
- behavior preserved;
- TDD RED proof;
- focused/broader commands and actual results;
- post-rollback proof;
- provenance/non-synthesis guarantees;
- preserved function hashes;
- source-before/after canonical manifests;
- risks/limitations;
- rollback command/authority;
- evidence ZIP SHA;
- C3/C4/BSE not authorized.

- [ ] **Step 10: Create final evidence package**

Include:
- authority preflight;
- RED/GREEN logs;
- focused C2 log;
- resolver/NSE/BSE/ER1 regressions;
- Cargo check;
- preservation body evidence;
- source-before/source-after/source-delta;
- deterministic fixture characterization summary;
- change report;
- `FINAL_STATE.json`;
- `SUMMARY.txt`.

Do not include real DB files or user data.

- [ ] **Step 11: Final closure gate**

Only classify:

```text
IDENTITY_ER2C2_NSE_I4_HISTORICAL_SHADOW_EVIDENCE_ADAPTER
CLOSED / GREEN / SHADOW-ONLY INTEGRATION
```

when every required command and preservation gate has actual PASS evidence.

## Mandatory STOP Conditions

Stop before continuing if implementation appears to require:
- resolver source/rule changes;
- new evidence kinds;
- historical ISIN/series synthesis;
- multi-hop continuity;
- I4 selection/disposition changes;
- execute/hash/Apply/transaction changes;
- DB schema/data changes;
- persistent/public resolver output;
- frontend/Tauri changes;
- runtime logs;
- network;
- BSE integration;
- another production module;
- real/private DB validation.

Such a requirement is a new bounded problem and needs explicit approval.

## Execution Handoff

Formal plan is complete only after it is installed beside the approved spec and source authority is reverified. After installation, implementation should use the strict TDD sequence above and remain on ER2-C2 only. No ER2-C3/C4/BSE work is implied or authorized.
