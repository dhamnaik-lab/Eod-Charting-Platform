# Corporate Action V1.9.2 Controlled Historical ISIN Bootstrap + Identity Recheck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a guarded Preview→Apply maintenance workflow that revalidates the 283 V1.9.1.1 `BOOTSTRAP_SAFE` imports, writes at most 281 deduplicated exact-date historical ISIN evidence rows, quick-resolves only those audited imports, and stops before any Corporate Action approval.

**Architecture:** Preview is zero-write and runs against a private DB+WAL snapshot. Apply is explicit, requires the successful Preview manifest, creates a verified live DB-family backup, then revalidates the complete plan inside one SQLite write transaction before any mutation. A new strict insert-only ISIN-history helper avoids the existing unrelated-import promotion side effect; the existing Quick Resolve implementation remains unchanged and is invoked only for the audited target imports.

**Tech Stack:** Rust, `rusqlite`, existing `csv` crate, `serde`/`serde_json`, SHA-256 support already available in the project or the smallest existing hashing dependency, PowerShell 7.x, Tauri 2 maintenance binary branch, Vitest/TypeScript regression suite.

## Global Constraints

- Candidate authorization source is the reviewed `bootstrap-safe-candidates.csv` with SHA-256 `ea196dbbfeb344eccab4e9077b101d0eb56827dd508c3092f937d6a0a2a603a7`.
- Expected unchanged-state population is 283 Corporate Action imports and 281 unique historical identity tuples; these are reconciliation expectations, not hard-coded authorization substitutes.
- Exclude all 9 `COMPANY_IDENTITY_MISMATCH`, all 3 `CONFLICTING_ISIN_HISTORY`, all 49 earlier `NO_CANDIDATE`, and every row not present in the authorized candidate artifact.
- `ca-isin-bootstrap-v1` fingerprint parity with V1.9.1.1 is mandatory before a candidate is `READY`.
- Preview must never open the live SQLite database; it opens only a private main DB + optional WAL snapshot and does not copy live SHM.
- Apply requires `-Apply` and an explicit successful Preview manifest; there is no implicit Preview→Apply transition.
- Apply must create and verify a pre-write backup of live DB/WAL/SHM before opening the live SQLite write connection.
- Apply performs all safety revalidation and mutations inside one outer SQLite transaction. Logical batches are at most 100 import IDs but never create partial commits.
- The strict history writer must not call `promote_matching_pending_isin_mismatch_imports` and must not update unrelated Corporate Action imports.
- Existing `quick_resolve_corporate_action_import_internal(...)` behavior is reused unchanged for target resolution.
- V1.9.2 may intentionally mutate only `instrument_isin_history`, the 283 target rows in `corporate_action_imports` through existing Quick Resolve, and `corporate_action_import_decisions`.
- V1.9.2 must not approve Corporate Actions, write `corporate_actions`, change factors, change price-validation evidence, create approval exceptions, modify instruments/identity history, or change raw/binary EOD data.
- Any Apply safety mismatch before mutation aborts. Any unexpected failure after the transaction begins rolls back the entire transaction.
- If the database commits but final report writing fails, surface `COMMITTED_REPORT_FAILURE`; never claim rollback after commit.
- No React/TypeScript UI source change is required.

---

## File Structure and Responsibilities

**Create:**

- `docs/changes/2026-08-16_CORPORATE_ACTION_PHASE1_CONTROLLED_HISTORICAL_ISIN_BOOTSTRAP_V1_9_2.md` — change record, operator contract, allowed/forbidden mutations, validation evidence.
- `EOD_Chart_Corporate_Action_Phase1_Controlled_Historical_ISIN_Bootstrap_V1_9_2_<STAMP>_IST/Run-EOD-Corporate-Action-Historical-ISIN-Bootstrap-V1-9-2.ps1` — guarded Preview/Apply operator wrapper.
- `EOD_Chart_Corporate_Action_Phase1_Controlled_Historical_ISIN_Bootstrap_V1_9_2_<STAMP>_IST/payload/...` — guarded source patch payload and tests/change doc used by the apply wrapper, following prior Corporate Action package conventions.

**Modify:**

- `src-tauri-shell/src/database/instrument_mutations.rs` — add strict insert-only history helper and tests proving no promotion side effect.
- `src-tauri-shell/src/database/corporate_action_imports.rs` — candidate CSV contract, V1.9.1.1 fingerprint parity, tuple grouping, Preview planner, Apply transaction orchestration, explicit bootstrap decision audit, idempotency detection, output models, focused tests.
- `src-tauri-shell/src/database.rs` — re-export the maintenance entrypoint used by `main.rs`.
- `src-tauri-shell/src/main.rs` — parse the explicit maintenance CLI branch before `tauri::Builder`; normal startup remains unchanged when the maintenance flag is absent.

**Regression-only; do not modify unless a genuine regression is discovered:**

- `src/features/corporateActions/__tests__/corporateActionValidation.test.ts`
- `src/features/corporateActions/__tests__/corporateActionCompoundValidation.test.ts`
- `src/features/corporateActions/__tests__/corporateActionIdentityRecommendations.test.ts`
- `src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts`
- `src-tauri-shell/src/database/eod_data.rs`

---

### Task 1: Candidate Contract, Canonicalization, and V1.9.1.1 Fingerprint Parity

**Files:**
- Modify: `src-tauri-shell/src/database/corporate_action_imports.rs` near the existing Corporate Action constants/types and test module.
- Test fixture: embed a minimal reviewed-candidate golden vector in the Rust test module; do not put the full 283-row production CSV into runtime source.

**Interfaces:**
- Consumes: reviewed `bootstrap-safe-candidates.csv` columns from V1.9.1.1.
- Produces:
  - `const HISTORICAL_ISIN_BOOTSTRAP_FINGERPRINT_VERSION: &str = "ca-isin-bootstrap-v1";`
  - `const HISTORICAL_ISIN_BOOTSTRAP_PLAN_FINGERPRINT_VERSION: &str = "ca-isin-bootstrap-apply-plan-v1";`
  - `struct HistoricalIsinBootstrapCandidate`
  - `struct HistoricalIsinBootstrapLiveEvidence`
  - `fn load_historical_isin_bootstrap_candidates(path: &Path) -> AppResult<Vec<HistoricalIsinBootstrapCandidate>>`
  - `fn build_historical_isin_bootstrap_fingerprint_payload(...) -> AppResult<serde_json::Value>`
  - `fn compute_historical_isin_bootstrap_fingerprint(...) -> AppResult<String>`
  - `fn revalidate_historical_isin_bootstrap_candidate(connection: &Connection, candidate: &HistoricalIsinBootstrapCandidate) -> AppResult<HistoricalIsinBootstrapLiveEvidence>`

- [ ] **Step 1: Write failing candidate-contract tests**

Add focused Rust tests covering exact CSV names and authorization constraints:

```rust
#[test]
fn phase1_v192_candidate_parser_accepts_reviewed_bootstrap_safe_shape() {
    let csv = concat!(
        "importId,exchange,officialSymbol,historicalOfficialIsin,currentIsin,companyName,destinationCompanyName,normalizedOfficialCompany,normalizedDestinationCompany,companyMatch,exDate,actionType,factor,priceValidationLabel,priceConfidencePct,sourceEvidenceCount,sourceCodes,sourceLocators,rawReferences,evidenceSymbols,evidenceIsins,evidenceEventDates,evidenceCompanies,evidenceActionTypes,evidenceFactors,exactDateIsinHistoryCount,exactDateIsinHistoryJson,destinationInstrumentId,destinationSymbol,destinationIsin,classification,classificationReason,failedGates,gateResultsJson,bootstrapFingerprintVersion,bootstrapFingerprint\n",
        "2656,NSE,BIGBLOC,INE412U01017,INE412U01025,Bigbloc Construction Limited,Bigbloc Construction Limited,BIGBLOC CONSTRUCTION LTD,BIGBLOC CONSTRUCTION LTD,true,2021-11-15,SPLIT,5,MATCH,94.52261306532664,1,NSE_API,https://www.nseindia.com/api/corporates-corporateActions,{},BIGBLOC,INE412U01017,2021-11-15,Bigbloc Construction Limited,SPLIT,5,0,[], ,BIGBLOC,INE412U01025,BOOTSTRAP_SAFE,ALL_STRICT_BOOTSTRAP_GATES_PASS,,{},ca-isin-bootstrap-v1,13dcc913479a3da50b951032cf2d6e0456dc9d453c01c7e292230d441c62464e\n"
    );
    let candidates = parse_historical_isin_bootstrap_candidates(csv.as_bytes()).unwrap();
    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].import_id, 2656);
}
```

Add separate tests rejecting:

```text
classification != BOOTSTRAP_SAFE
bootstrapFingerprintVersion != ca-isin-bootstrap-v1
invalid/non-64-hex bootstrapFingerprint
exchange != NSE
importId <= 0
historicalOfficialIsin missing
currentIsin missing
historicalOfficialIsin == currentIsin
sourceEvidenceCount < 1
duplicate importId
malformed exDate
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run from `src-tauri-shell`:

```powershell
cargo test phase1_v192_candidate_ -- --nocapture
```

Expected: compilation/test failure because V1.9.2 candidate types/parser do not exist.

- [ ] **Step 3: Implement the minimal candidate parser and validation**

Use `csv::ReaderBuilder` with headers and `serde::Deserialize` for a dedicated row DTO. Convert DTOs into validated `HistoricalIsinBootstrapCandidate` values. Validation must be strict and fail the whole artifact on malformed or unauthorized rows. Never auto-discover candidates from the DB.

Model at minimum:

```rust
#[derive(Clone, Debug)]
struct HistoricalIsinBootstrapCandidate {
    import_id: i64,
    exchange: String,
    official_symbol: String,
    historical_isin: String,
    current_isin: String,
    company_name: String,
    destination_company_name: String,
    ex_date: String,
    action_type: String,
    factor: f64,
    source_evidence_count: usize,
    audited_fingerprint: String,
}
```

Preserve the additional reviewed CSV fields needed for parity/reporting instead of discarding them if they participate in canonical payload construction.

- [ ] **Step 4: Write failing golden-vector fingerprint tests**

Use at least two reviewed rows, including BIGBLOC and IRCTC, with their reviewed V1.9.1.1 fingerprints:

```text
BIGBLOC import 2656 -> 13dcc913479a3da50b951032cf2d6e0456dc9d453c01c7e292230d441c62464e
IRCTC   import 2557 -> 7bdfdd0b9524efa732f2b186588610cb72a431f46916f9e2cc8f3974a703707a
```

Build synthetic database fixtures that reproduce the audited parent import, structured evidence, active destination, and empty exact-date ISIN history. Assert the Rust recomputation exactly equals the reviewed fingerprint.

- [ ] **Step 5: Run golden tests and verify RED**

```powershell
cargo test phase1_v192_fingerprint_ -- --nocapture
```

Expected: FAIL until canonicalization exactly matches V1.9.1.1.

- [ ] **Step 6: Implement canonical payload and deterministic SHA-256 parity**

The canonical payload must cover the same V1.9.1.1 safety state: parent import identity/event/factor, all structured evidence ordered deterministically, unique active destination/current identity, and relevant ISIN-history state. Sort arrays by stable keys before serialization. Serialize objects with deterministic property ordering rather than relying on arbitrary map iteration.

For JSON canonicalization, use typed serializable structs with declaration-order fields or a helper that recursively emits sorted object keys. Reject non-finite numbers.

- [ ] **Step 7: Add change-sensitivity tests**

Assert fingerprint changes when any of these changes:

```text
historical ISIN
ex-date
factor
source evidence ID/source locator/evidence date
destination current ISIN
relevant history state
```

Assert equivalent evidence insertion ordering produces the same fingerprint.

- [ ] **Step 8: Run Task 1 tests GREEN**

```powershell
cargo test phase1_v192_candidate_ -- --nocapture
cargo test phase1_v192_fingerprint_ -- --nocapture
```

Expected: PASS.

- [ ] **Step 9: Review checkpoint / commit**

Review only candidate scope and fingerprint parity. If the project is a Git working tree:

```powershell
git add src-tauri-shell/src/database/corporate_action_imports.rs
git commit -m "test: lock v1.9.2 bootstrap candidate contract"
```

If the live project has no `.git`, record the pre/post SHA-256 of the modified file in the V1.9.2 change document instead of inventing repository history.

---

### Task 2: Strict Historical ISIN Insert Helper With No Promotion Side Effect

**Files:**
- Modify: `src-tauri-shell/src/database/instrument_mutations.rs:968-1076` adjacent to `upsert_instrument_isin_history_evidence`.
- Test: existing `#[cfg(test)]` module in `instrument_mutations.rs` near the current upsert/promotion tests.

**Interfaces:**
- Consumes: normalized exchange, symbol, historical ISIN, exact event date, official source/provenance/note.
- Produces:

```rust
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum StrictHistoricalIsinInsertOutcome {
    Inserted(i64),
    MatchingV192Row(i64),
    ExistingExternalMatch(i64),
    Conflict { existing_id: i64, existing_isin: String },
}

pub(super) fn insert_historical_isin_evidence_strict_no_promotion(
    connection: &Connection,
    exchange: &str,
    symbol: &str,
    isin: &str,
    effective_date: &str,
    source: &str,
    source_ref: Option<&str>,
    note: &str,
) -> AppResult<StrictHistoricalIsinInsertOutcome>
```

`MatchingV192Row` is returned only when exact row provenance proves a prior V1.9.2 operation. `ExistingExternalMatch` is a changed-state condition for the orchestrator; this helper must not overwrite it.

- [ ] **Step 1: Write failing strict-insert tests**

Create fixture tables `instrument_isin_history` and `corporate_action_imports`. Add tests proving:

```rust
#[test]
fn phase1_v192_strict_insert_adds_exact_history_without_promoting_imports() { /* ... */ }

#[test]
fn phase1_v192_strict_insert_rejects_conflicting_exact_date_isin() { /* ... */ }

#[test]
fn phase1_v192_strict_insert_does_not_modify_unrelated_pending_isin_mismatch() { /* ... */ }

#[test]
fn phase1_v192_normal_upsert_still_preserves_existing_promotion_behavior() { /* call old helper */ }
```

The first test must place a matching `PENDING_ISIN_MISMATCH` import in the fixture and assert its status remains unchanged after the strict helper inserts history.

- [ ] **Step 2: Run strict-helper tests and verify RED**

```powershell
cargo test phase1_v192_strict_insert_ -- --nocapture
```

Expected: FAIL because the strict helper/outcome type do not exist.

- [ ] **Step 3: Implement strict insert without calling the normal upsert**

Normalize via the same existing functions used by `upsert_instrument_isin_history_evidence`. Query all exact `exchange + symbol + effective_date` rows first. Apply these rules:

```text
0 rows                         -> INSERT exact history row; return Inserted(id)
1 row, same ISIN, V1.9.2 note  -> MatchingV192Row(id)
1 row, same ISIN, other source -> ExistingExternalMatch(id)
1 row, different ISIN          -> Conflict
>1 relevant rows               -> error/data-state anomaly
```

Never execute `UPDATE instrument_isin_history`. Never call `promote_matching_pending_isin_mismatch_imports`.

- [ ] **Step 4: Run strict-helper and existing promotion regression tests GREEN**

```powershell
cargo test phase1_v192_strict_insert_ -- --nocapture
cargo test upsert_instrument_isin_history_evidence_ -- --nocapture
```

Expected: both new and old behavior PASS.

- [ ] **Step 5: Review checkpoint / commit**

Verify diff contains no call from the strict helper to `promote_matching_pending_isin_mismatch_imports`. If Git exists:

```powershell
git add src-tauri-shell/src/database/instrument_mutations.rs
git commit -m "feat: add strict no-promotion ISIN history insert"
```

Otherwise record the file hashes in the change doc.

---

### Task 3: Tuple Deduplication, Preview Revalidation, and Apply-Plan Fingerprint

**Files:**
- Modify: `src-tauri-shell/src/database/corporate_action_imports.rs`.

**Interfaces:**
- Consumes Task 1 candidate/live-evidence models.
- Produces:

```rust
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize)]
struct HistoricalIsinBootstrapTupleKey {
    exchange: String,
    symbol: String,
    historical_isin: String,
    ex_date: String,
    current_isin: String,
}

#[derive(Clone, Debug, Serialize)]
struct HistoricalIsinBootstrapTuplePlan {
    key: HistoricalIsinBootstrapTupleKey,
    import_ids: Vec<i64>,
    evidence_ids: Vec<i64>,
    candidate_fingerprints: Vec<String>,
    source_code: String,
    source_ref: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct HistoricalIsinBootstrapPreviewManifest { /* exact manifest fields from spec */ }

fn build_historical_isin_bootstrap_tuple_plan(...) -> AppResult<Vec<HistoricalIsinBootstrapTuplePlan>>
fn compute_historical_isin_bootstrap_apply_plan_fingerprint(...) -> AppResult<String>
fn preview_historical_isin_bootstrap_internal(...) -> AppResult<HistoricalIsinBootstrapPreviewResult>
```

- [ ] **Step 1: Write failing tuple-dedup tests**

Add tests for:

```text
GLOBE imports 1274 + 1275 -> one tuple
GPIL imports 2541 + 2548 -> one tuple
unrelated dates/symbols/ISIN transitions -> separate tuples
deterministic tuple/import/evidence ordering
```

Add a reviewed-artifact fixture test that parses the actual test fixture subset representing 283 import IDs and asserts deterministic reconciliation to 281 tuple keys. The test data may be generated from a compact checked-in test fixture or constructed in code; production runtime must still read the operator-provided candidate CSV.

- [ ] **Step 2: Run tuple tests RED**

```powershell
cargo test phase1_v192_tuple_ -- --nocapture
```

- [ ] **Step 3: Implement tuple key/grouping**

Sort candidates by `import_id`, group on the five-part key, sort each group’s `import_ids`, `evidence_ids`, and candidate fingerprints, and sort final tuples lexicographically by exchange/symbol/ex-date/historical/current ISIN.

- [ ] **Step 4: Write failing Preview state tests**

Synthetic fixtures must cover:

```text
all live gates unchanged -> READY
review_status changed -> STATE_CHANGED
approved import -> STATE_CHANGED
latest price scan changed/stale -> PRICE_VALIDATION_CHANGED
compound context fingerprint changed -> PRICE_VALIDATION_CHANGED
source evidence changed -> SOURCE_EVIDENCE_CHANGED
unique destination changed -> DESTINATION_CHANGED
new external exact history row -> HISTORY_CONFLICT/STATE_CHANGED
recomputed candidate fingerprint mismatch -> STALE_FINGERPRINT
```

Preview must return a reconciled row for every authorized import and perform zero writes.

- [ ] **Step 5: Run Preview tests RED**

```powershell
cargo test phase1_v192_preview_ -- --nocapture
```

- [ ] **Step 6: Implement Preview planner**

Reuse existing Corporate Action loaders and Quick Resolve suggestion semantics rather than inventing a second identity algorithm. Preview must not invoke strict insert or Quick Resolve. Build explicit result classifications and blocking reasons.

Successful Preview invariants:

```text
candidate_count = 283 under reviewed unchanged state
ready_count = candidate_count
blocking_count = 0
unique_tuple_count = 281
```

Do not hard-code those numbers into authorization logic; calculate and report them.

- [ ] **Step 7: Write and implement deterministic apply-plan fingerprint tests**

Plan payload must include candidate CSV SHA-256, ordered import IDs/fingerprints, ordered tuple plans and provenance, current relevant history state, and live DB-family hashes supplied by the wrapper. Assert changes to any of those produce a different `ca-isin-bootstrap-apply-plan-v1` fingerprint.

- [ ] **Step 8: Implement Preview manifest serialization**

Manifest exact fields:

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoricalIsinBootstrapPreviewManifest {
    format_version: String,
    mode: String,
    candidate_csv_path: String,
    candidate_csv_sha256: String,
    candidate_count: usize,
    unique_tuple_count: usize,
    import_ids: Vec<i64>,
    candidate_fingerprints: Vec<String>,
    unique_tuples: Vec<HistoricalIsinBootstrapTuplePlan>,
    live_database_family_hashes: HistoricalIsinBootstrapDatabaseFamilyHashes,
    plan_fingerprint_version: String,
    plan_fingerprint: String,
    created_at: String,
    preview_status: String,
    blocking_rows: Vec<HistoricalIsinBootstrapImportResult>,
}
```

A successful manifest uses `mode = "PREVIEW"` and `preview_status = "READY"`.

- [ ] **Step 9: Run Task 3 tests GREEN**

```powershell
cargo test phase1_v192_tuple_ -- --nocapture
cargo test phase1_v192_preview_ -- --nocapture
cargo test phase1_v192_apply_plan_ -- --nocapture
```

- [ ] **Step 10: Review checkpoint / commit**

Review that Preview code has no mutating SQL path. If Git exists, commit the Preview planner separately.

---

### Task 4: Atomic Apply Orchestrator, Targeted Quick Resolve, Decision Audit, and Idempotency

**Files:**
- Modify: `src-tauri-shell/src/database/corporate_action_imports.rs`.
- Modify import list at top of file to use `insert_historical_isin_evidence_strict_no_promotion` and `StrictHistoricalIsinInsertOutcome` from Task 2.

**Interfaces:**
- Consumes: candidate artifact, successful Preview manifest, current live connection, Task 3 plan builder.
- Produces:

```rust
fn apply_historical_isin_bootstrap_internal(
    connection: &mut Connection,
    candidates_path: &Path,
    preview_manifest: &HistoricalIsinBootstrapPreviewManifest,
    output_context: &HistoricalIsinBootstrapRunContext,
) -> AppResult<HistoricalIsinBootstrapApplyResult>
```

Public maintenance entrypoint to be exported later:

```rust
pub(crate) fn run_historical_isin_bootstrap_maintenance(
    input: HistoricalIsinBootstrapMaintenanceInput,
) -> AppResult<HistoricalIsinBootstrapMaintenanceResult>
```

Add result/outcome types for tuple and import reporting, including `READY`, `STALE_FINGERPRINT`, `STATE_CHANGED`, `HISTORY_CONFLICT`, `DESTINATION_CHANGED`, `PRICE_VALIDATION_CHANGED`, `SOURCE_EVIDENCE_CHANGED`, `MALFORMED_CANDIDATE`, `ALREADY_APPLIED`, `PARTIAL_PRIOR_APPLY`, `INSERTED`, `QUICK_RESOLVED`, `FAILED`.

- [ ] **Step 1: Write failing transaction atomicity tests**

Use a temp SQLite fixture and `Connection::transaction()`-compatible setup. Add tests proving:

```text
one strict insert conflict -> no history rows committed
one Quick Resolve failure -> no history rows/import status/decisions committed
one bootstrap decision insert failure -> all V1.9.2 changes roll back
logical batches of <=100 do not commit separately
successful synthetic run commits expected tuple/import counts
```

For the large synthetic case, generate 203 import IDs with one duplicate tuple group so batching crosses 100 twice; this proves batching logic without requiring the entire reviewed 283-row production data in a unit test.

- [ ] **Step 2: Run atomicity tests RED**

```powershell
cargo test phase1_v192_apply_atomic_ -- --nocapture
```

- [ ] **Step 3: Implement one outer transaction and second in-transaction revalidation**

The first operations after beginning the transaction are reads only:

```rust
let transaction = connection.transaction().map_err(|e| e.to_string())?;
let transactional_plan = build_live_historical_isin_bootstrap_plan(&transaction, ...)?;
require_candidate_fingerprints_match(...)?;
require_plan_fingerprint_matches_manifest(...)?;
```

Do not insert anything until all candidates and the complete plan pass inside this transaction.

- [ ] **Step 4: Implement deterministic logical batches <=100**

Build `Vec<Vec<i64>>` from sorted authorized import IDs with `.chunks(100)`. Batches are reporting/progress boundaries only. Tuple insert planning happens globally before batches so GLOBE/GPIL shared tuples can never be inserted twice.

- [ ] **Step 5: Implement strict tuple insertion with deterministic provenance**

For each tuple, build note text in deterministic order:

```text
V1.9.2 controlled historical-ISIN bootstrap; importIds=1274,1275; evidenceIds=<sorted>; candidateFingerprints=<sorted>; planFingerprint=<64hex>
```

Use audited official `source = NSE_API` and source locator as `source_ref` when available. Handle `StrictHistoricalIsinInsertOutcome`:

```text
Inserted                 -> continue
MatchingV192Row          -> idempotency path only if decisions/fingerprints also match
ExistingExternalMatch    -> abort changed-state apply
Conflict                 -> abort
```

- [ ] **Step 6: Write failing targeted Quick Resolve + decision tests**

Assert inserted exact-date evidence allows the unchanged `quick_resolve_corporate_action_import_internal(...)` to transition a target from `UNRESOLVED` to `PENDING` and record `VERIFIED_QUICK_RESOLUTION`.

Add a test with an unrelated unresolved/mismatch import that would also match the historical tuple and assert it remains unchanged because the strict writer does not auto-promote and the orchestrator calls Quick Resolve only on authorized import IDs.

- [ ] **Step 7: Implement explicit bootstrap decision before/after Quick Resolve within same transaction**

Use existing `record_corporate_action_import_decision(...)` with decision type:

```text
HISTORICAL_ISIN_BOOTSTRAP_V1_9_2
```

Reason text must include candidate fingerprint, plan fingerprint, tuple identity, and structured evidence IDs. Then call:

```rust
quick_resolve_corporate_action_import_internal(
    &transaction,
    &CorporateActionImportQuickResolveInput { import_id },
)?;
```

Require the resulting import status to be exactly `PENDING`. Any error/status mismatch returns `Err`, causing outer rollback.

- [ ] **Step 8: Write failing idempotency tests**

Cover:

```text
exact V1.9.2 history provenance + matching bootstrap decision + matching Quick Resolve decision + expected later state -> ALREADY_APPLIED
history row exists but bootstrap decision missing -> PARTIAL_PRIOR_APPLY
bootstrap decision fingerprint mismatch -> PARTIAL_PRIOR_APPLY
external same-ISIN exact-date row -> changed-state block, not ALREADY_APPLIED
```

- [ ] **Step 9: Implement idempotency detector**

Idempotency must be evidence-based, not inferred only from `PENDING`. Parse the deterministic V1.9.2 provenance note and matching decision rows. Later normal states such as approved/linkage may be accepted as “already applied” only when V1.9.2 provenance/decisions prove the bootstrap completed; V1.9.2 itself still performs no approval.

- [ ] **Step 10: Commit only after full transaction success**

Call `transaction.commit()` only after all tuple writes, all 283 targeted Quick Resolve operations, and all decision records succeed. Populate `transaction_committed = true` immediately after successful commit so reporting can distinguish post-commit failures.

- [ ] **Step 11: Run Task 4 tests GREEN**

```powershell
cargo test phase1_v192_apply_atomic_ -- --nocapture
cargo test phase1_v192_quick_resolve_ -- --nocapture
cargo test phase1_v192_idempotency_ -- --nocapture
```

- [ ] **Step 12: Add forbidden-mutation assertions**

In successful and failed fixture tests, hash/count relevant tables before and after and assert no mutation to:

```text
corporate_actions
corporate_action_import_evidence
instruments
instrument_identity_history
scan_runs
corporate_action_scan_results
eod_prices
```

Also assert only authorized import IDs can differ in `corporate_action_imports`.

- [ ] **Step 13: Review checkpoint / commit**

This is the highest-risk review gate. Review transaction boundaries, targeted import set, and mutation-table assertions before proceeding to CLI/wrapper work.

---

### Task 5: Rust Maintenance CLI and Machine-Readable Reports

**Files:**
- Modify: `src-tauri-shell/src/database.rs`.
- Modify: `src-tauri-shell/src/main.rs` before `tauri::Builder::default()`.
- Modify: `src-tauri-shell/src/database/corporate_action_imports.rs` for file report writer if kept with the maintenance implementation.

**Interfaces:**
- Produces CLI contract:

```text
--maintenance-corporate-action-isin-bootstrap
--mode preview|apply
--database-file <path>
--candidates <path>
--preview-manifest <path>     # apply only
--output <path>
--candidate-sha256 <hash>
--live-main-sha256 <hash>
--live-wal-sha256 <hash-or-empty>
--live-shm-sha256 <hash-or-empty>
```

Preview uses a snapshot database path supplied by PowerShell; Apply uses the live path only after the wrapper backup gates have passed.

- [ ] **Step 1: Write failing CLI argument parser tests**

Extract argument parsing into a pure function callable from tests, for example:

```rust
fn parse_historical_isin_bootstrap_maintenance_args(
    args: impl IntoIterator<Item = String>,
) -> AppResult<Option<HistoricalIsinBootstrapMaintenanceInput>>
```

Tests must prove:

```text
no maintenance flag -> Ok(None)
preview requires db/candidates/output/hash inputs
apply requires preview-manifest too
invalid mode rejected
-Apply-equivalent cannot be inferred from presence of a manifest alone
```

- [ ] **Step 2: Run CLI tests RED**

```powershell
cargo test phase1_v192_maintenance_args_ -- --nocapture
```

- [ ] **Step 3: Implement maintenance branch before Tauri startup**

At the top of `main()`:

```rust
fn main() {
    match database::try_run_historical_isin_bootstrap_maintenance(std::env::args()) {
        Ok(Some(exit_code)) => std::process::exit(exit_code),
        Ok(None) => {}
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }

    let result = tauri::Builder::default()
        // existing startup unchanged
```

The maintenance branch must return before Tauri UI initialization.

- [ ] **Step 4: Implement Preview outputs**

Write exactly:

```text
historical-isin-bootstrap-preview-summary.txt
historical-isin-bootstrap-preview.csv
historical-isin-bootstrap-preview.json
historical-isin-bootstrap-preview-manifest.json
```

Write the manifest last, only when Preview is fully reconciled. If blocking rows exist, report them and set manifest `previewStatus != READY`; Apply must reject it.

- [ ] **Step 5: Implement Apply outputs with commit-state distinction**

Write exactly:

```text
historical-isin-bootstrap-apply-summary.txt
historical-isin-bootstrap-apply-imports.csv
historical-isin-bootstrap-apply-tuples.csv
historical-isin-bootstrap-apply.json
```

If DB commit succeeds but a report write fails, emit to stderr/stdout:

```text
COMMITTED_REPORT_FAILURE
Database transaction committed successfully; final report writing failed. Do not restore automatically. Re-run Preview/Apply idempotency check.
```

Use a distinct nonzero exit code from pre-commit failures.

- [ ] **Step 6: Add CLI integration tests against temp SQLite databases**

Launch the compiled testable maintenance entrypoint/function with temp paths and assert:

```text
Preview -> zero DB bytes/table changes + four Preview artifacts
Apply without READY manifest -> rejected before write
Apply with changed candidate hash -> rejected
Apply with plan mismatch -> transaction rollback
successful Apply -> correct four artifacts + expected DB mutations only
```

- [ ] **Step 7: Run Task 5 tests GREEN**

```powershell
cargo test phase1_v192_maintenance_ -- --nocapture
cargo test phase1_v192_report_ -- --nocapture
```

- [ ] **Step 8: Review checkpoint / commit**

Confirm normal Tauri startup diff is only the early optional maintenance branch.

---

### Task 6: PowerShell Preview/Apply Guard, Snapshot, Backup, and Hash Binding

**Files:**
- Create package wrapper: `EOD_Chart_Corporate_Action_Phase1_Controlled_Historical_ISIN_Bootstrap_V1_9_2_<STAMP>_IST/Run-EOD-Corporate-Action-Historical-ISIN-Bootstrap-V1-9-2.ps1`.
- Create package payload/check files following the previous guarded Corporate Action patch packages.
- Create or update: `docs/changes/2026-08-16_CORPORATE_ACTION_PHASE1_CONTROLLED_HISTORICAL_ISIN_BOOTSTRAP_V1_9_2.md`.

**Interfaces:**

```powershell
param(
    [string]$ProjectRoot = 'E:\TA Projects\EOD Charting Platform',
    [string]$CandidatesCsv,
    [string]$PreviewManifest,
    [switch]$Apply,
    [switch]$RunValidation
)
```

No `-Apply` means Preview.

- [ ] **Step 1: Write wrapper contract tests/static guards before implementation**

Use a Node or PowerShell test script in the package to inspect the wrapper text and assert it contains:

```text
Get-FileHash
_private-sqlite-snapshot
market-data.sqlite3-wal
market-data.sqlite3-shm
-Apply
-PreviewManifest
preapply-backup
historical-isin-bootstrap-preview-manifest.json
--maintenance-corporate-action-isin-bootstrap
```

Assert Preview invocation passes the snapshot DB path, never the live DB path. Assert Apply invocation passes the live DB path only inside the explicit `$Apply` branch after backup verification.

- [ ] **Step 2: Implement common live-state discovery and process guard**

Reuse the proven V1.9.1.1 patterns:

```text
resolve active database folder from profile registry
resolve market-data.sqlite3/database.json
assert EOD Chart/Tauri process closed
hash main DB and optional WAL/SHM
```

Do not delete/checkpoint sidecars.

- [ ] **Step 3: Implement Preview private-snapshot mode**

Preview sequence must be exact:

```text
hash live DB/WAL/SHM
copy DB + optional WAL to output/_private-sqlite-snapshot
never copy live SHM
rehash live family and require unchanged
verify copied DB/WAL hashes
run maintenance CLI with --mode preview against snapshot path
rehash live family after CLI and require unchanged
remove private snapshot in finally
```

The candidate CSV hash passed to Rust must be calculated by the wrapper.

- [ ] **Step 4: Implement Apply preview-manifest gates**

Before any live SQLite connection:

```text
require -Apply
require -PreviewManifest path
parse manifest JSON
require mode PREVIEW
require previewStatus READY
hash CandidatesCsv == manifest candidateCsvSha256
hash live DB/WAL/SHM == manifest liveDatabaseFamilyHashes
assert EOD Chart process closed again
```

If live hashes differ by even one byte or sidecar appearance/disappearance, abort and require a new Preview.

- [ ] **Step 5: Implement verified pre-write backup**

Create:

```text
tmp\corporate-action-v1-9-2-preapply-backup_<timestamp>\
```

Copy main DB, optional WAL, optional SHM, and `database.json` if present. After copy:

```text
rehash live family -> must equal pre-backup hashes
hash backup family -> must equal source hashes
print backup directory prominently
```

Only after these gates may wrapper invoke Rust `--mode apply` on the live DB path.

- [ ] **Step 6: Implement exit/commit-report behavior**

If Rust exits with the dedicated `COMMITTED_REPORT_FAILURE` code, wrapper must print a high-visibility warning and the backup path but must not restore automatically. For ordinary pre-commit failure, print failure and leave backup intact.

- [ ] **Step 7: Add PowerShell self-test cases**

Use temporary fake DB family files and a mock maintenance executable/command to prove:

```text
Preview does not pass live DB path
Preview tolerates persistent WAL/SHM and copies only DB+WAL
live hash drift during snapshot -> abort
Apply without manifest -> abort
candidate hash drift -> abort
live DB-family drift since Preview -> abort
backup hash mismatch -> abort before maintenance Apply invocation
successful gates invoke Apply exactly once
```

- [ ] **Step 8: Run wrapper tests GREEN**

Run the package self-test directly in PowerShell 7.6.x. Expected: all guard tests PASS.

- [ ] **Step 9: Review checkpoint**

Inspect wrapper for accidental commands that could delete/checkpoint/restore live SQLite files. `Remove-Item` is permitted only for the private snapshot directory created by the wrapper, never the live DB family or backup.

---

### Task 7: Full Regression Validation and Source-Level Mutation Audit

**Files:**
- No intended source changes unless validation exposes a V1.9.2 defect.
- Update final validation evidence in `docs/changes/2026-08-16_CORPORATE_ACTION_PHASE1_CONTROLLED_HISTORICAL_ISIN_BOOTSTRAP_V1_9_2.md`.

**Interfaces:**
- Consumes completed Tasks 1–6.
- Produces green source-validation evidence before any live Preview/Apply.

- [ ] **Step 1: Run all V1.9.2 focused Rust tests**

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform\src-tauri-shell"
cargo test phase1_v192_ -- --nocapture
```

Expected: all V1.9.2 tests PASS.

- [ ] **Step 2: Run the focused Corporate Action Rust suite**

Use the same filter used successfully in the prior Phase 1 packages so existing corporate-action tests run together. Expected baseline from the current state is at least the previously observed 96 Corporate Action tests plus the new V1.9.2 tests; exact count is allowed to increase only because of added tests.

- [ ] **Step 3: Run instrument-mutation history tests**

```powershell
cargo test instrument_isin_history -- --nocapture
cargo test upsert_instrument_isin_history_evidence -- --nocapture
```

Expected: old promotion behavior remains green and strict helper tests remain green.

- [ ] **Step 4: Run EOD adjustment regression tests**

```powershell
cargo test phase1_split_adjustment -- --nocapture
cargo test phase1_multiple_split_bonus -- --nocapture
```

Expected: Split/Bonus adjustment behavior unchanged.

- [ ] **Step 5: Run Corporate Action frontend tests**

From project root:

```powershell
npx vitest run `
  src/features/corporateActions/__tests__/corporateActionValidation.test.ts `
  src/features/corporateActions/__tests__/corporateActionCompoundValidation.test.ts `
  src/features/corporateActions/__tests__/corporateActionIdentityRecommendations.test.ts `
  src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts
```

Expected: PASS; no frontend source changes are required.

- [ ] **Step 6: Run renderer and Tauri compile gates**

```powershell
npm run typecheck:renderer
npm run build:renderer
npm run tauri:check
```

Expected: PASS. Existing Vite chunk-size/circular-chunk warnings may remain warnings, not V1.9.2 failures.

- [ ] **Step 7: Perform mutation-surface source scan**

Review V1.9.2 production code and assert intentional SQL writes are restricted to:

```text
INSERT instrument_isin_history
UPDATE corporate_action_imports only through existing Quick Resolve path
INSERT corporate_action_import_decisions
```

Search the V1.9.2 maintenance path for forbidden table names and mutating statements. Any direct V1.9.2 write to `corporate_actions`, EOD tables, `instruments`, `instrument_identity_history`, scan tables, or evidence tables is a release blocker.

- [ ] **Step 8: Validate package compatibility/guard hashes**

Build the guarded source-apply package so it verifies the exact expected basis before patching. Package must create a source backup before applying. Run package self-verification against a clean copy of the current source snapshot before giving it to the user.

- [ ] **Step 9: Update change document with exact evidence**

Record:

```text
focused test counts
Corporate Action Rust count
EOD adjustment count
frontend count
typecheck/build/tauri:check status
files changed
source hashes before/after
explicit statement: no portable build performed
explicit statement: no live DB mutation performed during source validation
```

- [ ] **Step 10: Final review checkpoint / commit**

If Git exists, commit the complete V1.9.2 source change. Otherwise use package verification hashes and backups as the auditable change boundary.

---

### Task 8: Live Preview Acceptance — Zero Writes

**Files:**
- Runtime output only under `tmp\corporate-action-v1-9-2-preview_<timestamp>\`.
- No source modifications.

**Interfaces:**
- Consumes installed/validated V1.9.2 source and the exact reviewed candidate CSV.
- Produces four Preview outputs and a READY manifest if current state is unchanged.

- [ ] **Step 1: Ensure app is closed and run Preview only**

Operator command shape:

```powershell
& ".\EOD_Chart_Corporate_Action_Phase1_Controlled_Historical_ISIN_Bootstrap_V1_9_2_<STAMP>_IST\Run-EOD-Corporate-Action-Historical-ISIN-Bootstrap-V1-9-2.ps1" `
    -ProjectRoot "E:\TA Projects\EOD Charting Platform" `
    -CandidatesCsv "E:\TA Projects\EOD Charting Platform\tmp\corporate-action-isin-bootstrap-audit_20260816_120625\bootstrap-safe-candidates.csv"
```

Do not pass `-Apply`.

- [ ] **Step 2: Verify Preview safety output**

Required console assertions:

```text
Mode: PREVIEW / ZERO WRITE
SQLite opened private snapshot only
live DB/WAL/SHM immutability PASS
candidate CSV SHA-256 = ea196dbbfeb344eccab4e9077b101d0eb56827dd508c3092f937d6a0a2a603a7
```

- [ ] **Step 3: Verify Preview reconciliation**

Under unchanged state, expected:

```text
candidate imports: 283
READY: 283
blocking: 0
unique tuples: 281
planFingerprintVersion: ca-isin-bootstrap-apply-plan-v1
previewStatus: READY
```

If any count/status differs, stop. Inspect the blocking rows; do not move to Apply merely because most rows are READY.

- [ ] **Step 4: Review manifest/artifacts before Apply**

Inspect:

```text
historical-isin-bootstrap-preview-summary.txt
historical-isin-bootstrap-preview.csv
historical-isin-bootstrap-preview.json
historical-isin-bootstrap-preview-manifest.json
```

Confirm GLOBE and GPIL are each represented as one tuple with two import IDs. Confirm the 9+3 blocked identities are absent from the authorized import list.

- [ ] **Step 5: User authorization gate**

Stop and present the Preview result to the user. Do not run Apply until the user explicitly approves the specific READY Preview/manifest.

---

### Task 9: Live Apply Acceptance — Explicit, Backed Up, Atomic, Then Stop Before Corporate Action Approval

**Files:**
- Runtime output only under `tmp\corporate-action-v1-9-2-apply_<timestamp>\`.
- Backup under `tmp\corporate-action-v1-9-2-preapply-backup_<timestamp>\`.

**Interfaces:**
- Consumes the exact READY Preview manifest approved in Task 8.
- Produces controlled historical ISIN history + target Quick Resolve changes only.

- [ ] **Step 1: Run explicit Apply against the approved manifest**

```powershell
& ".\EOD_Chart_Corporate_Action_Phase1_Controlled_Historical_ISIN_Bootstrap_V1_9_2_<STAMP>_IST\Run-EOD-Corporate-Action-Historical-ISIN-Bootstrap-V1-9-2.ps1" `
    -ProjectRoot "E:\TA Projects\EOD Charting Platform" `
    -CandidatesCsv "E:\TA Projects\EOD Charting Platform\tmp\corporate-action-isin-bootstrap-audit_20260816_120625\bootstrap-safe-candidates.csv" `
    -PreviewManifest "<exact READY preview manifest from Task 8>" `
    -Apply
```

- [ ] **Step 2: Verify pre-write gates before allowing run to continue**

Console must show:

```text
Mode: APPLY
candidate hash matches Preview
live DB-family hashes match Preview
backup created
backup hashes verified
```

If any fails, no write connection should open.

- [ ] **Step 3: Verify transactional Apply result**

Under unchanged first-apply state, expected conceptually:

```text
candidate imports requested: 283
unique tuples planned: 281
history rows inserted: 281
imports quick-resolved: 283
stale/conflict/failed: 0
transaction committed: yes
Corporate Actions approved: 0
```

Do not treat these expected values as grounds to ignore actual report discrepancies.

- [ ] **Step 4: Verify database mutation scope from Apply reports**

Inspect:

```text
historical-isin-bootstrap-apply-summary.txt
historical-isin-bootstrap-apply-imports.csv
historical-isin-bootstrap-apply-tuples.csv
historical-isin-bootstrap-apply.json
```

Confirm every changed import ID is in the 283 authorized set and every history tuple is in the 281 Preview plan.

- [ ] **Step 5: Run idempotency Preview after successful Apply**

Run Preview again with the same candidate artifact. Expected classification is deterministic `ALREADY_APPLIED` for the completed population, not duplicate tuple insertion. This is a read-only confirmation run.

- [ ] **Step 6: Return to normal Corporate Actions workbench; do not auto-approve**

After successful identity bootstrap/recheck, launch/rebuild the app only as separately chosen by the user, refresh the Corporate Actions workbench, and inspect the resulting review/READY population. V1.9.2 ends here. Approval remains an existing explicit operator action.

---

## Final Acceptance Checklist

A V1.9.2 release is complete only when all of these statements are true:

- [ ] Preview opens only a private DB+WAL snapshot and leaves live DB/WAL/SHM byte-identical.
- [ ] Candidate CSV is the exact reviewed SHA-256 artifact.
- [ ] Rust golden vectors reproduce V1.9.1.1 `ca-isin-bootstrap-v1` fingerprints.
- [ ] Unchanged Preview reconciles 283 authorized imports into 281 unique tuples.
- [ ] Apply requires the explicit READY Preview manifest and exact unchanged live DB-family hashes.
- [ ] Verified pre-write DB-family backup exists before live write connection.
- [ ] All candidate/plan fingerprints are recomputed inside one outer transaction.
- [ ] Strict history insert never invokes unrelated-import promotion.
- [ ] Existing Quick Resolve is reused unchanged only for authorized import IDs.
- [ ] One unexpected target failure rolls back all V1.9.2 mutations.
- [ ] Normal first Apply inserts at most one history row per unique tuple.
- [ ] Bootstrap + Quick Resolve decisions are auditable.
- [ ] No Corporate Action is approved by V1.9.2.
- [ ] No factor, price validation, exception, raw EOD, or binary EOD mutation occurs.
- [ ] The 9 company mismatches, 3 history conflicts, and 49 no-candidate rows remain untouched.
- [ ] Rerun recognizes completed work as `ALREADY_APPLIED` without duplicate writes.
- [ ] Full Rust/frontend/typecheck/build/Tauri regression gates pass before live Preview.

## Execution Handoff

Implementation should proceed **inline with TDD and review checkpoints**, because this phase introduces a narrow but high-consequence database write path. Execute Tasks 1–7 first and stop after source/package validation. Then run Task 8 Preview and return the Preview artifacts for review. Task 9 Apply requires a separate explicit user approval of that exact Preview manifest.
