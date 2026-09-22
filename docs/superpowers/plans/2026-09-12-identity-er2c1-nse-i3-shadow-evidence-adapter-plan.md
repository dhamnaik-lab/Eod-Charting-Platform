# Identity ER2-C1 — NSE I3 Shadow Evidence Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Project policy overrides the generic skill:** do not run Git/source-control commands unless the user explicitly authorizes them.

**Goal:** Integrate the closed ER2-B deterministic resolver into NSE I3 current-universe Preview as provenance-correct, in-memory shadow diagnostics with zero change to public I3 Preview/Apply behavior.

**Architecture:** Keep all production work inside `src-tauri-shell/src/database/nse_identity_imports.rs`. Build one managed-source snapshot per Preview batch, construct minimal ER2 inputs only for eligible I3 Preview rows, classify resolver outcomes privately, and discard diagnostics before returning the existing public result. Preserve the existing reviewed plan SHA and Apply body byte-for-byte.

**Tech Stack:** Rust, rusqlite read paths already used by NSE Identity, csv, sha2, chrono (already present), Cargo test/check in locked offline mode.

**Spec:** `docs/superpowers/specs/2026-09-12-identity-er2c1-nse-i3-shadow-evidence-adapter-design.md`

## Global Constraints

- Active root: `E:\TA Projects\EOD Charting Platform`.
- Source authority ZIP SHA-256: `D14ABCAF8B067A6474786571272C28F8C1267595EF656D1B6B78C76CE54DD822`.
- Pre-C1 `nse_identity_imports.rs` SHA-256: `100F27D48F85570EE45C3EA0E3522E60742C5188E474858B0EDE61F19EE2F598`.
- ER2-B resolver SHA-256: `AECC6C182D90598CDD78FB777FE4D0D3A0D15D0C73A071CE8E02456F71DFE3CD`; do not modify it.
- Expected production delta: exactly one existing file, `src-tauri-shell/src/database/nse_identity_imports.rs`.
- No database/schema/data writes beyond the existing legacy I3 behavior; C1 itself is read-only.
- No network access.
- No frontend/Tauri/public result changes.
- No I4 or BSE integration.
- No runtime logging/persistence/telemetry of shadow results.
- No new production module.
- No `panic!`, `.unwrap()` or `.expect()` in normal production shadow control flow.
- `nse_current_universe_plan_sha256(...)` must remain unchanged; current body SHA-256 `E1E528547427A529771B5BFEAA63985CBA4DC8CF26EBF232661A82B5C1A3A1E7`.
- `plan_into_result(...)` must remain unchanged; current body SHA-256 `3DEED9F0D44F30DEEFC5ED8A2A643BF772746579138B4960057D16D5F78BA05F`.
- `apply_nse_current_universe_sync_reviewed_internal(...)` must remain unchanged; current body SHA-256 `B3297AC350E262CBAA8D4F824728C70C7EC0721271DDD910BF3AB5BF22CE4981`.
- No Git/source-control commands unless separately authorized.

---

## File map before implementation

**Modify**
- `src-tauri-shell/src/database/nse_identity_imports.rs`
  - current private I3 row/plan types: preimage lines ~81–140
  - current plan build owner: `build_nse_current_universe_sync_plan(...)` around preimage line 896
  - current plan SHA owner: `nse_current_universe_plan_sha256(...)` around preimage line 1018 — preserve
  - current public-result conversion: `plan_into_result(...)` around preimage line 1208 — preserve
  - current Preview integration point: `preview_nse_current_universe_sync_internal(...)` around preimage line 1398
  - reviewed Apply owner: `apply_nse_current_universe_sync_reviewed_internal(...)` around preimage line 1419 — preserve
  - local instrument loader: `load_existing_nse_instrument_rows(...)` around preimage line 1921
  - existing tests: `#[cfg(test)] mod tests` begins around preimage line 2836

**Preserve byte-for-byte / hash-verify**
- `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/bse_identity_imports.rs`
- `src-tauri-shell/src/database/official_source_health.rs`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/Cargo.lock`
- `package.json`
- `package-lock.json`

**Create at closeout only**
- `docs/changes/YYYY-MM-DD_HHMM_IST_IDENTITY_ER2C1_NSE_I3_SHADOW_EVIDENCE_ADAPTER.md`
- external evidence ZIP under the declared EOD Charting Platform Source Audit location.

---

### Task 1: Freeze private shadow vocabulary and relationship mapping

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs` near the current private I3 structs and existing I3 tests.

**Interfaces:**
- Import from sibling owner with `use super::identity_evidence_resolver::{...};`; do not re-export C1 types through `database.rs`.
- Consumes: `IdentityResolverResult`, `IdentityResolverEvaluationError`, `IdentityResolverStatus`, `IdentityResolverConclusion`, `IdentityResolverRuleId` from the sibling resolver module.
- Produces: private `NseI3Er2ShadowState`, `NseI3Er2ShadowReason`, `NseI3Er2ShadowRelationship`, `NseI3Er2ShadowEvaluation`, `NseI3Er2ShadowSummary`.

- [ ] **Step 1: Add RED tests for the closed taxonomy**

Add focused tests inside the existing `mod tests` proving each resolver outcome maps to one and only one relationship and summary counts reconcile.

```rust
#[test]
fn er2c1_t0_relationship_taxonomy_is_closed_and_reconciles() {
    let states = vec![
        NseI3Er2ShadowRelationship::IdentityContinuitySupported,
        NseI3Er2ShadowRelationship::ResolverConflict,
        NseI3Er2ShadowRelationship::ResolverNeedsMoreEvidence,
        NseI3Er2ShadowRelationship::NoMaterialResolverMismatch,
        NseI3Er2ShadowRelationship::SourceUnavailable,
        NseI3Er2ShadowRelationship::ResolverError,
        NseI3Er2ShadowRelationship::NotEvaluated,
        NseI3Er2ShadowRelationship::AdapterError,
    ];
    assert_eq!(states.len(), 8);
}
```

Add an explicit test that `IdentityResolverEvaluationError::NoMismatchToResolve` maps to `NoMaterialResolverMismatch` and not `ResolverError`.

- [ ] **Step 2: Run the focused RED**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t0_ -- --nocapture
```

Expected: compile/test RED because the C1 private types/classifier do not yet exist.

- [ ] **Step 3: Implement the minimal private types/classifier**

Use private derives only as needed for tests, e.g. `Clone, Debug, PartialEq, Eq`. Do not derive `Serialize` for production shadow values.

```rust
fn classify_nse_i3_er2_resolver_outcome(
    outcome: Result<IdentityResolverResult, IdentityResolverEvaluationError>,
) -> NseI3Er2ShadowState {
    match outcome {
        Ok(result) => NseI3Er2ShadowState::Evaluated(result),
        Err(IdentityResolverEvaluationError::NoMismatchToResolve) =>
            NseI3Er2ShadowState::NoMaterialResolverMismatch,
        Err(IdentityResolverEvaluationError::InvalidInput(message)) =>
            NseI3Er2ShadowState::ResolverError(
                NseI3Er2ShadowResolverError::InvalidInput(message),
            ),
        Err(IdentityResolverEvaluationError::AmbiguousDeterministicCandidates { rule_ids }) =>
            NseI3Er2ShadowState::ResolverError(
                NseI3Er2ShadowResolverError::AmbiguousDeterministicCandidates { rule_ids },
            ),
        Err(IdentityResolverEvaluationError::InvalidConstructedResult(message)) =>
            NseI3Er2ShadowState::ResolverError(
                NseI3Er2ShadowResolverError::InvalidConstructedResult(message),
            ),
    }
}
```

Define `NseI3Er2ShadowResolverError` with exactly the three ER2 internal-error families above. Do not stringify them into one generic error and do not add `NoMismatchToResolve` to that error enum.

- [ ] **Step 4: Run T0 GREEN**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t0_ -- --nocapture
```

Expected: PASS.

- [ ] **Step 5: Record a review checkpoint**

Record changed symbols and focused test output in implementation evidence. Do not commit/stage source.

---

### Task 2: Add managed-source gate and one-read shadow snapshot

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`.

**Interfaces:**
- Consumes: current `resolve_nse_current_universe_archive_root`, `resolve_current_universe_master_paths`, current parsers, `sha256_hex_bytes`.
- Produces: private `NseI3Er2ShadowSourceSnapshot` containing canonical current rows with source provenance plus optional parsed Symbol/Name histories.

- [ ] **Step 1: Write RED tests for managed vs manual provenance**

```rust
#[test]
fn er2c1_t1_manual_archive_override_is_not_shadow_evaluated() {
    let input = NseCurrentUniverseSyncInput {
        archive_root_path: Some(r"E:\manual-nse".to_string()),
    };
    assert_eq!(
        classify_er2c1_source_mode(&input),
        NseI3Er2ShadowReason::NonManagedSourceProvenance,
    );
}
```

Also test that `archive_root_path: None` with a supplied managed default is eligible for snapshot construction.

- [ ] **Step 2: Run T1 RED**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t1_ -- --nocapture
```

Expected: RED because managed-source C1 helpers do not exist.

- [ ] **Step 3: Implement managed-source gating**

Treat any non-empty explicit `archive_root_path` as manual for C1, even though legacy I3 continues to accept it.

- [ ] **Step 4: Implement batch source snapshot**

Read/hash/parse each managed file no more than once. Preserve exact current-master merge semantics by annotating rows before merge:

```rust
struct NseI3Er2CurrentMasterRow {
    row: NseSecurityMasterRow,
    source_id: &'static str,
    source_reference: String,
    content_sha256: String,
}
```

Use exact frozen source IDs:

```rust
const ER2C1_NSE_EQUITY_MASTER: &str = "NSE_EQUITY_MASTER";
const ER2C1_NSE_SME_MASTER: &str = "NSE_SME_MASTER";
const ER2C1_NSE_SYMBOL_CHANGE: &str = "NSE_SYMBOL_CHANGE";
const ER2C1_NSE_COMPANY_NAME_CHANGE: &str = "NSE_COMPANY_NAME_CHANGE";
```

Equity owns duplicate symbols before SME, matching current `load_current_universe_master_rows(...)`.

- [ ] **Step 5: Add source-race comparison helper**

Normalize the annotated rows back to `Vec<NseSecurityMasterRow>` and compare against `plan.current_rows`. A mismatch must produce `SourceChangedDuringShadowSnapshot`; it must not call ER2.

- [ ] **Step 6: Run T1 GREEN**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t1_ -- --nocapture
```

Expected: PASS.

---

### Task 3: Build deterministic Current Master evidence and identity mapping

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`.

**Interfaces:**
- Consumes: Task 2 snapshot, current `ExistingNseInstrumentRow`, ER2 `IdentityResolverLocalIdentity`, `IdentityResolverOfficialIdentity`, `IdentityResolverEvidence`, `IdentityResolverInput`.
- Produces: eligible per-row resolver inputs carrying Current Master provenance.

- [ ] **Step 1: Add RED eligibility/local mapping tests**

Cover exactly:

```text
UPDATE → eligible
REACTIVATE → eligible
INSERT + real matched_symbol → eligible
INSERT without local row → NO_LOCAL_IDENTITY
OLD_SYMBOL/DELISTED/UNKNOWN_INACTIVE → NO_OFFICIAL_CURRENT_IDENTITY
```

Example:

```rust
#[test]
fn er2c1_t3_local_identity_preserves_actual_fields_without_invented_dates() {
    let local = ExistingNseInstrumentRow {
        symbol: "ABC".into(),
        isin: Some("INE000A01001".into()),
        name: Some("ABC Limited".into()),
        series: Some("EQ".into()),
        is_active: false,
    };
    let mapped = build_nse_i3_er2_local_identity(&local);
    assert_eq!(mapped.lifecycle_state.as_deref(), Some("INACTIVE"));
    assert_eq!(mapped.effective_from, None);
    assert_eq!(mapped.effective_to, None);
}
```

- [ ] **Step 2: Run T3 RED**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t3_ -- --nocapture
```

- [ ] **Step 3: Implement deterministic evidence-ID helper**

Use `Sha256` already imported by the file. The ID input must not include observation time.

```rust
fn er2c1_evidence_id(parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update((part.len() as u64).to_le_bytes());
        hasher.update(part.as_bytes());
    }
    format!("ER2C1-{:x}", hasher.finalize())
}
```

- [ ] **Step 4: Implement IST observation-time helper without panic control flow**

Use existing `chrono` dependency only:

```rust
fn er2c1_observed_at_ist() -> Result<String, String> {
    let offset = chrono::FixedOffset::east_opt(19_800)
        .ok_or_else(|| "ER2C1_IST_OFFSET_UNAVAILABLE".to_string())?;
    Ok(chrono::Utc::now().with_timezone(&offset).to_rfc3339())
}
```

- [ ] **Step 5: Build Current Master evidence and official identity**

Current evidence must include exact file SHA and actual parsed fields. `retrieved_at_ist` may vary; evidence ID must not.

- [ ] **Step 6: Add deterministic-ID tests**

Construct identical evidence twice with different observation timestamps and assert identical `evidence_id` and resolver semantics.

- [ ] **Step 7: Run T3 GREEN**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t3_ -- --nocapture
```

---

### Task 4: Add Symbol/Name evidence with strict non-synthesis

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`.

**Interfaces:**
- Consumes: parsed `NseSymbolChangeRow`, `NseNameChangeRow` from Task 2 snapshot.
- Produces: minimal authoritative `SYMBOL_CHANGE` and `NAME_CHANGE` ER2 evidence.

- [ ] **Step 1: Write RED Symbol Change non-synthesis test**

Fixture: local `OLDABC`, current `NEWABC`, same ISIN in local/current master, official Symbol Change `OLDABC → NEWABC`, but the symbol-change row itself has no ISIN.

```rust
#[test]
fn er2c1_t4_symbol_change_does_not_borrow_current_master_isin() {
    let evidence = build_nse_i3_er2_symbol_change_evidence(/* fixture */)
        .expect("fixture evidence");
    assert_eq!(evidence.evidence_kind, IdentityResolverEvidenceKind::SymbolChange);
    assert_eq!(evidence.isin, None);
}
```

Then run the constructed input through `resolve_identity` and require Rule I/insufficient evidence when no stronger rule exists.

- [ ] **Step 2: Run T4 RED**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t4_ -- --nocapture
```

- [ ] **Step 3: Implement Symbol Change evidence mapping**

Map only fields that exist in `NseSymbolChangeRow`: company name, old symbol, new symbol, effective date, provenance. Leave `isin` and `series` absent unless the source row itself gains those fields in a separately approved phase.

- [ ] **Step 4: Write RED/then GREEN Name Change non-synthesis test**

Require `NAME_CHANGE` evidence to carry symbol/new name/date/provenance but no borrowed ISIN.

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t5_ -- --nocapture
```

- [ ] **Step 5: Assert generated evidence-kind whitelist**

Across fixture inputs, require adapter-generated kinds to be a subset of:

```rust
[
    IdentityResolverEvidenceKind::CurrentMaster,
    IdentityResolverEvidenceKind::SymbolChange,
    IdentityResolverEvidenceKind::NameChange,
]
```

No `IsinChange`, `SeriesChange`, `HistoricalIdentity`, `Delisting`, `Listing` or `LifecycleStatus` may be synthesized.

---

### Task 5: Expand relevant same-ISIN peers and prove Rule E

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`.

**Interfaces:**
- Consumes: Task 2 Current Master index by ISIN.
- Produces: minimal resolver evidence set containing target current row plus relevant same-ISIN peers.

- [ ] **Step 1: Write Rule-E RED test**

Use two distinct active official symbols with the same non-empty ISIN.

```rust
#[test]
fn er2c1_t6_same_isin_current_peers_enable_rule_e_conflict() {
    let result = resolve_identity(&build_er2c1_duplicate_isin_fixture())
        .expect("resolver should return deterministic conflict");
    assert_eq!(result.status, IdentityResolverStatus::Conflict);
    assert_eq!(
        result.rule_id,
        IdentityResolverRuleId::ActiveDuplicateIsinConflictV1,
    );
}
```

- [ ] **Step 2: Run T6 RED**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t6_ -- --nocapture
```

- [ ] **Step 3: Implement same-ISIN peer selection**

Do not attach unrelated Current Master rows. Same-symbol/different-series must not be converted into a duplicate-symbol Rule-E fact.

- [ ] **Step 4: Run T6 GREEN**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t6_ -- --nocapture
```

---

### Task 6: Characterize critical resolver disagreements without changing I3

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs` tests/private classifiers only.

**Interfaces:**
- Consumes: completed per-row input builder and ER2-B resolver.
- Produces: tested relationship classification for safety-critical C1 scenarios.

- [ ] **Step 1: Write Rule-D conflict characterization**

Local/current exact symbol with changed non-empty ISIN and no official Rule-D bridge must yield:

```text
CONFLICT / ISIN_CHANGE_REQUIRES_EXPLICIT_CONTINUITY_V1
→ ResolverConflict
```

- [ ] **Step 2: Write Rule-H missing-evidence characterization**

Same symbol/company/ISIN but `BE → EQ`, with no `SERIES_CHANGE` evidence, must yield Rule I and explicitly **not** `SERIES_CHANGE_NOT_NEW_SECURITY_BY_DEFAULT_V1`.

- [ ] **Step 3: Write reactivation-gap characterization**

Same Identity except local `INACTIVE` vs official `ACTIVE` must remain Rule I; do not introduce a reactivation rule.

- [ ] **Step 4: Write normalization divergence characterization**

Harmless case/whitespace-only company-name difference must map ER2 `NoMismatchToResolve` to `NoMaterialResolverMismatch` even if legacy I3 performs an exact-string metadata `UPDATE`.

- [ ] **Step 5: Run T7/T8 tests RED then GREEN**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t7_ -- --nocapture
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t8_ -- --nocapture
```

No production legacy action logic is changed to make these tests pass.

---

### Task 7: Prove source-race protection and deterministic output

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`.

**Interfaces:**
- Consumes: batch snapshot/evidence builder.
- Produces: deterministic shadow evaluations in existing `plan.preview_rows` order.

- [ ] **Step 1: Write source-race RED test**

Build a legacy plan from source bytes A; rewrite the fixture managed master to bytes B before shadow capture; require `SourceChangedDuringShadowSnapshot` and no ER2 evaluation.

- [ ] **Step 2: Write order/timestamp determinism RED tests**

Shuffle Current Master and optional history input order and vary observation timestamp. Require stable:

```text
eligibility
relationship
status
conclusion
rule ID
evidence IDs
```

- [ ] **Step 3: Implement deterministic indexes/output order**

Traverse `plan.preview_rows` in its existing order. Sort/canonicalize only internal evidence collections where necessary; do not create a second public ordering.

- [ ] **Step 4: Run T9 GREEN**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t9_ -- --nocapture
```

---

### Task 8: Insert the shadow call into Preview and prove public invariance

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`, specifically `preview_nse_current_universe_sync_internal(...)` plus tests.

**Interfaces:**
- Consumes: completed `evaluate_nse_i3_er2_shadow(...)` batch helper.
- Produces: production Preview executes C1 shadow but returns the unchanged legacy result.

- [ ] **Step 1: Capture pre-edit preservation text/hashes**

Before editing Preview integration, extract and hash:

```text
nse_current_universe_plan_sha256(...)
plan_into_result(...)
apply_nse_current_universe_sync_reviewed_internal(...)
```

Require the preimage hashes from Global Constraints.

- [ ] **Step 2: Write public-invariance RED test**

Construct a fixture that produces a legacy `UPDATE` but an ER2 Rule-D `CONFLICT`. Compare the result that legacy `plan_into_result(...)` would return with `preview_nse_current_universe_sync_internal(...)` after shadow integration via structural/JSON equality.

```rust
assert_eq!(
    serde_json::to_value(actual_preview).unwrap(),
    serde_json::to_value(expected_legacy_preview).unwrap(),
);
```

`unwrap()` is acceptable in this test fixture, not production shadow control flow.

- [ ] **Step 3: Run T10/T11 RED**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t10_ -- --nocapture
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t11_ -- --nocapture
```

Expected: RED because Preview does not yet call the shadow adapter.

- [ ] **Step 4: Add the single production integration call after legacy plan SHA creation**

The outer shadow path must convert every expected adapter/resolver problem into private state and never return `Err` to Preview.

Do not touch Apply functions, plan hash material or result conversion.

- [ ] **Step 5: Prove public Preview invariance and plan-SHA invariance GREEN**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t10_ -- --nocapture
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_t11_ -- --nocapture
```

Expected: PASS with unchanged public result despite shadow conflict.

- [ ] **Step 6: Re-hash preservation function bodies**

Require exact equality to:

```text
plan hash body:  E1E528547427A529771B5BFEAA63985CBA4DC8CF26EBF232661A82B5C1A3A1E7
result body:     3DEED9F0D44F30DEEFC5ED8A2A643BF772746579138B4960057D16D5F78BA05F
Apply body:      B3297AC350E262CBAA8D4F824728C70C7EC0721271DDD910BF3AB5BF22CE4981
```

A mismatch is a hard failure; do not continue.

---

### Task 9: Run broader regressions and structural/panic scan

**Files:**
- No additional production file unless a failing test proves a C1 defect inside the authorized NSE owner.

- [ ] **Step 1: Run the complete NSE Identity test owner**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline database::nse_identity_imports::tests -- --nocapture
```

Expected: exit 0; record actual test count/output.

- [ ] **Step 2: Run the frozen ER2 resolver regression**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline database::identity_evidence_resolver::tests -- --nocapture
```

Expected: exit 0; record actual test count/output.

- [ ] **Step 3: Run BSE Identity preservation regression**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline database::bse_identity_imports::tests -- --nocapture
```

- [ ] **Step 4: Run ER1 source-health regression**

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline database::official_source_health::tests -- --nocapture
```

- [ ] **Step 5: Run locked offline Cargo check**

```powershell
cargo check --manifest-path src-tauri-shell/Cargo.toml --locked --offline
```

- [ ] **Step 6: Scan the production C1 section for forbidden normal-flow constructs**

Verify no C1 production helper uses `panic!`, `.unwrap()` or `.expect()` for normal control flow. Test-only uses are excluded.

- [ ] **Step 7: Verify exact production source delta**

Expected:

```text
modified = [src-tauri-shell/src/database/nse_identity_imports.rs]
added production source = []
removed production source = []
```

Verify all Global Constraints preservation hashes unchanged.

---

### Task 10: Produce change report and closeout evidence

**Files:**
- Create: `docs/changes/YYYY-MM-DD_HHMM_IST_IDENTITY_ER2C1_NSE_I3_SHADOW_EVIDENCE_ADAPTER.md`
- Create external evidence ZIP under the approved EOD Charting Platform Source Audit root.

**Interfaces:**
- Consumes: all command output and hash/source evidence from Tasks 1–9.
- Produces: immutable C1 closeout evidence and final classification; no runtime API.

- [ ] **Step 1: Write the required IST change report**

Include objective, previous limitation, exact source delta, evidence mapping, non-synthesis guarantees, behavior preserved, actual validation commands/results, performance structure/timing, risks, rollback and authority hashes.

- [ ] **Step 2: Create fixture-only shadow characterization JSON**

Include aggregate counts by relationship/rule from deterministic test fixtures only. Do not include real private database instrument identities.

- [ ] **Step 3: Build evidence ZIP**

Include at least:

```text
00-authority-preflight.json
01-c1-tdd-red-green.log
02-focused-shadow-tests.log
03-i3-public-invariance.log
04-er2-resolver-regression.log
05-nse-identity-regression.log
06-bse-identity-regression.log
07-er1-source-health-regression.log
08-cargo-check-locked-offline.log
09-apply-body-preservation.json
10-source-before.json
11-source-after.json
12-source-delta.json
13-preservation-authorities.json
14-shadow-characterization-summary.json
15-change-report.md
FINAL_STATE.json
SUMMARY.txt
```

- [ ] **Step 4: Independently verify the evidence ZIP hash and contents**

Record ZIP SHA-256 and verify every file is readable before claiming completion.

- [ ] **Step 5: Final classification**

Only after every requested automated gate is proven by actual output, classify:

```text
IDENTITY_ER2C1_NSE_I3_SHADOW_EVIDENCE_ADAPTER
CLOSED / GREEN / SHADOW-ONLY INTEGRATION
```

Explicitly state that ER2-C2/C3/C4 and BSE integration remain unauthorized.

---

## Plan self-review result

- Spec Sections 1–5 / formal requirements: covered by Tasks 1–10.
- One production-file boundary: preserved.
- Managed-only provenance and source-race protection: Tasks 2 and 7.
- Current Master / Symbol / Name evidence and non-synthesis: Tasks 3–5.
- Rule-D, Rule-H, reactivation and normalization characterization: Task 6.
- Preview-only insertion/public invariance/plan SHA/Apply preservation: Task 8.
- Broader validation/preservation: Task 9.
- Documentation/evidence/rollback/unauthorized-next-phase boundary: Task 10.
- No placeholders/TODOs remain.
- No Git/source-control step is included because project policy does not authorize it.
