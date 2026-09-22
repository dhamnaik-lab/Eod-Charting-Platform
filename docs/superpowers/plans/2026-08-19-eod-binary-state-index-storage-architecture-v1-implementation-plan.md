# EOD Binary State Index Storage Architecture V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reversible, Bhavcopy-first EOD Binary State Index that removes redundant cold `.eod` state discovery while keeping `.eod` files canonical, retaining the physical verification path permanently, and preserving existing recovery/checkpoint semantics.

**Architecture:** Introduce a dedicated sidecar SQLite index plus an in-memory trusted-state map. Bhavcopy first consumes the index in shadow mode, then for recovery-baseline acceleration, then for `APPEND_NEWEST` writer classification. All actual `.eod` writers participate in a `VERIFIED → DIRTY → VERIFIED/UNKNOWN` invalidation contract; uncertain state always falls back per symbol to the existing physical implementation.

**Tech Stack:** Rust 2021, Tauri 2, rusqlite 0.31 bundled SQLite, serde, existing `BinaryEodFile` format engine, React 18 + TypeScript frontend.

**Spec:** `docs/superpowers/specs/2026-08-19-eod-binary-state-index-storage-architecture-v1-design.md`

## Global Constraints

- Canonical `.eod` format remains unchanged.
- One file per symbol remains unchanged.
- Existing Bhavcopy multi-date symbol batching remains unchanged.
- Existing recovery journal remains authoritative.
- Existing background checkpoint remains authoritative and physically verifies/syncs files in V1.
- Sidecar state is derived acceleration data only and may be deleted/rebuilt.
- Fast classification is permitted only for `VERIFIED` state whose filesystem census still matches.
- `DIRTY`, `UNKNOWN`, missing, mismatched, or structurally invalid state must use the existing physical path.
- `AUTO`, `FAST`, and `FULL_VERIFY` are permanent modes; no force-untrusted fast mode is permitted.
- Sidecar failure must disable acceleration, not block canonical `.eod` behavior.
- Corporate Action metadata/factor operations do not invalidate binary state unless they actually mutate `.eod`.
- Roll out as V1.1 through V1.6; do not combine into one giant production patch.
- Before each production patch, capture source hashes/backups and create a rollback package consistent with the project's existing patch workflow.
- No Git operation is required by this plan; if a Git workflow is intentionally enabled later, commits may mirror the patch boundaries.

---

# File Structure

## New backend files

- Create: `src-tauri-shell/src/database/eod_binary_state.rs`
  - Owns state schema, types, sidecar open/create, bootstrap/rebuild, physical inspection helpers used only by the state subsystem, filesystem census reconciliation, state transitions, in-memory snapshots, status summaries, and verification.
- Create: `src-tauri-shell/src/database/eod_binary_state_tests.rs` only if `eod_binary_state.rs` becomes too large for maintainable inline tests. Prefer inline `#[cfg(test)]` initially; split only if the module exceeds the repository's existing testing style substantially.

## Existing backend files

- Modify: `src-tauri-shell/src/database.rs:1-16`
  - Register/re-export the new module and expose settings/commands.
- Modify: `src-tauri-shell/src/database/binary_eod.rs:444-628`
  - Add the trusted-state-aware wrapper and post-state return data without duplicating mutation implementations.
- Modify: `src-tauri-shell/src/bhavcopy.rs:2019-2107`
  - Recovery-baseline physical state capture / index-assisted baseline resolution.
- Modify: `src-tauri-shell/src/bhavcopy.rs:3990-4325`
  - State snapshot loading, shadow comparison, trusted writer hint dispatch, diagnostics.
- Modify: `src-tauri-shell/src/bhavcopy.rs:~900-1200`
  - Batch execution lifecycle, pre-mutation dirty marking, checkpoint publication hook, runtime telemetry.
- Modify: `src-tauri-shell/src/bhavcopy_recovery.rs:~360-670`
  - Checkpoint/recovery state publication and invalidation contract.
- Modify: `src-tauri-shell/src/database/quotes.rs:~1050-1600`
  - Quote save/delete invalidation and verified publication.
- Modify: `src-tauri-shell/src/imports.rs:~1100-1400`
  - Manual CSV import invalidation/publication.
- Modify: `src-tauri-shell/src/manual_import_recovery.rs:~1-1100`
  - Undo/recovery invalidation and post-verify publication.
- Modify: `src-tauri-shell/src/main.rs:1047-1140`
  - Register state-index status/verify/rebuild/storage-mode commands.

## Existing frontend files

- Modify: `src/types/desktop.ts:1191-1210, 1505-1510`
  - Add state-index types and desktop API methods.
- Modify: `src/platform/types.ts:~250-280`
  - Add command capability names.
- Modify: `src/platform/tauriDesktop.ts:~291-305`
  - Add Tauri invoke wrappers for index status, verify, rebuild, and mode.
- Create: `src/components/EodBinaryStatePanel.tsx`
  - Small status/mode/control panel.
- Modify: `src/components/BhavcopyDownloadWindow.tsx:~230-330, ~900-1000`
  - Load and render the state panel after backend proof.
- Modify: `src/components/BhavcopyDownloadWindow.styles.ts`
  - Add only styles required by the new panel if existing primitives are insufficient.

## Documentation/evidence files

- Add approved spec: `docs/superpowers/specs/2026-08-19-eod-binary-state-index-storage-architecture-v1-design.md`
- Add this plan: `docs/superpowers/plans/2026-08-19-eod-binary-state-index-storage-architecture-v1-implementation-plan.md`
- Add one change/evidence document per patch under `docs/changes/` using the existing project naming convention.

---

# V1.1 — State Index Infrastructure

### Task 1: Add state types, schema, and sidecar open contract

**Files:**
- Create: `src-tauri-shell/src/database/eod_binary_state.rs`
- Modify: `src-tauri-shell/src/database.rs:1-16`
- Test: inline tests in `src-tauri-shell/src/database/eod_binary_state.rs`

**Interfaces:**
- Produces:
  - `pub enum BinaryStateStatus { Verified, Dirty, Unknown }`
  - `pub enum EodBinaryStorageMode { Auto, Fast, FullVerify }`
  - `pub struct BinaryStateKey { pub exchange: String, pub symbol: String }`
  - `pub struct VerifiedBinaryState { ... }`
  - `pub struct BinaryPostState { ... }`
  - `pub struct BinaryStateIndexStatus { ... }`
  - `pub struct BinaryStateIndex`
  - `BinaryStateIndex::open(database_folder: &Path) -> Result<Self, String>`
  - `BinaryStateIndex::sidecar_path(database_folder: &Path) -> PathBuf`
- Consumes: existing `rusqlite`, `serde`, `HEADER_SIZE`, `RECORD_SIZE`, and `.eod` folder convention.

- [ ] **Step 1: Write failing schema/type tests**

Add tests that require an empty temporary database folder to create `eod_binary_state.sqlite`, schema version 1, and `bootstrap_status=INCOMPLETE`.

```rust
#[test]
fn state_index_open_creates_schema_without_marking_bootstrap_complete() {
    let dir = tempfile::tempdir().unwrap();
    let index = BinaryStateIndex::open(dir.path()).unwrap();

    assert_eq!(
        index.sidecar_path(),
        dir.path().join("eod_binary_state.sqlite")
    );

    let meta = index.read_metadata().unwrap();
    assert_eq!(meta.schema_version, 1);
    assert_eq!(meta.bootstrap_status, BootstrapStatus::Incomplete);
}
```

Add enum serialization tests:

```rust
#[test]
fn storage_mode_roundtrips_expected_persisted_values() {
    assert_eq!(EodBinaryStorageMode::Auto.as_str(), "AUTO");
    assert_eq!(EodBinaryStorageMode::Fast.as_str(), "FAST");
    assert_eq!(EodBinaryStorageMode::FullVerify.as_str(), "FULL_VERIFY");

    assert_eq!(
        EodBinaryStorageMode::parse("FULL_VERIFY").unwrap(),
        EodBinaryStorageMode::FullVerify
    );
    assert!(EodBinaryStorageMode::parse("FORCE_UNSAFE").is_err());
}
```

- [ ] **Step 2: Run the focused test and verify failure**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml state_index_open_creates_schema_without_marking_bootstrap_complete -- --nocapture
```

Expected: compile/test failure because `eod_binary_state` types do not yet exist.

- [ ] **Step 3: Implement the minimal state model and schema**

Use these exact persisted tables:

```sql
CREATE TABLE IF NOT EXISTS eod_binary_state_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    schema_version INTEGER NOT NULL,
    index_generation INTEGER NOT NULL,
    bootstrap_status TEXT NOT NULL CHECK (bootstrap_status IN ('INCOMPLETE','COMPLETE')),
    bootstrap_completed_at TEXT
);

CREATE TABLE IF NOT EXISTS eod_binary_state (
    exchange TEXT NOT NULL,
    symbol TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    record_count INTEGER NOT NULL,
    price_scale INTEGER NOT NULL,
    file_length INTEGER NOT NULL,
    first_date INTEGER,
    last_date INTEGER,
    file_mtime_ns INTEGER NOT NULL,
    state_status TEXT NOT NULL CHECK (state_status IN ('VERIFIED','DIRTY','UNKNOWN')),
    state_generation INTEGER NOT NULL,
    verified_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (exchange, symbol)
);
```

Set metadata row `id=1`, `schema_version=1`, `index_generation=0`, `bootstrap_status='INCOMPLETE'` on first creation.

Implement:

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum BinaryStateStatus {
    Verified,
    Dirty,
    Unknown,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum EodBinaryStorageMode {
    Auto,
    Fast,
    FullVerify,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct BinaryStateKey {
    pub exchange: String,
    pub symbol: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct VerifiedBinaryState {
    pub key: BinaryStateKey,
    pub relative_path: String,
    pub record_count: u32,
    pub price_scale: u32,
    pub file_length: u64,
    pub first_date: Option<u32>,
    pub last_date: Option<u32>,
    pub file_mtime_ns: i64,
    pub state_generation: i64,
}
```

Do not put price records in the sidecar.

- [ ] **Step 4: Register the module**

At `src-tauri-shell/src/database.rs:1-16` add:

```rust
pub mod eod_binary_state;
```

Do not alter existing database bootstrap or main SQLite schema.

- [ ] **Step 5: Run focused tests**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml eod_binary_state -- --nocapture
```

Expected: PASS.

- [ ] **Step 6: Run backend compile check**

```powershell
npm run tauri:check
```

Expected: PASS.

- [ ] **Step 7: Create V1.1 checkpoint evidence**

Record hashes for:
- `src-tauri-shell/src/database/eod_binary_state.rs`
- `src-tauri-shell/src/database.rs`

Package V1.1 as infrastructure-only. No Bhavcopy source should change in Task 1.

---

### Task 2: Implement canonical physical inspection, bootstrap, and rebuild

**Files:**
- Modify: `src-tauri-shell/src/database/eod_binary_state.rs`
- Test: inline tests in the same module
- Reference only: `src-tauri-shell/src/database/binary_eod.rs:210-250, 630-669`

**Interfaces:**
- Consumes: `BinaryEodFile::open`, `BinaryEodFile::read_all` or bounded first/last reads, `HEADER_SIZE`, `RECORD_SIZE`.
- Produces:
  - `inspect_canonical_file(database_folder, key) -> Result<VerifiedBinaryState, String>`
  - `BinaryStateIndex::rebuild(database_folder) -> Result<BinaryStateIndexStatus, String>`
  - `BinaryStateIndex::load_verified() -> Result<HashMap<BinaryStateKey, VerifiedBinaryState>, String>`

- [ ] **Step 1: Write a failing bootstrap test with real temporary `.eod` files**

Create NSE and BSE files via the canonical writer, then rebuild:

```rust
#[test]
fn rebuild_indexes_real_eod_files_and_publishes_complete_atomically() {
    let dir = tempfile::tempdir().unwrap();
    let eod_root = dir.path().join("eod_data");
    let nse = eod_root.join("NSE");
    let bse = eod_root.join("BSE");
    std::fs::create_dir_all(&nse).unwrap();
    std::fs::create_dir_all(&bse).unwrap();

    BinaryEodFile::append_or_merge_records(
        nse.join("AAA.eod"),
        "AAA",
        "NSE",
        100,
        vec![mock_record(20260818, 1000)],
    ).unwrap();

    BinaryEodFile::append_or_merge_records(
        bse.join("BBB.eod"),
        "BBB",
        "BSE",
        100,
        vec![mock_record(20260817, 2000), mock_record(20260818, 2100)],
    ).unwrap();

    let mut index = BinaryStateIndex::open(dir.path()).unwrap();
    let status = index.rebuild(dir.path()).unwrap();

    assert_eq!(status.indexed, 2);
    assert_eq!(status.verified, 2);
    assert_eq!(status.dirty, 0);
    assert_eq!(status.unknown, 0);
    assert!(status.bootstrap_complete);

    let rows = index.load_verified().unwrap();
    assert_eq!(rows[&BinaryStateKey::new("NSE", "AAA")].last_date, Some(20260818));
    assert_eq!(rows[&BinaryStateKey::new("BSE", "BBB")].record_count, 2);
}
```

- [ ] **Step 2: Run the test and verify it fails**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml rebuild_indexes_real_eod_files_and_publishes_complete_atomically -- --nocapture
```

Expected: FAIL because rebuild/inspection are missing.

- [ ] **Step 3: Implement physical inspection with structural checks**

Inspection must validate:

```rust
let expected_length =
    HEADER_SIZE as u64 + binary.header.record_count as u64 * RECORD_SIZE as u64;

if metadata.len() != expected_length {
    return Err(format!(
        "Structurally inconsistent .eod: {}:{} header count {} expects {} bytes, found {} bytes",
        exchange,
        symbol,
        binary.header.record_count,
        expected_length,
        metadata.len()
    ));
}
```

Read first and last dates only when `record_count > 0`. Preserve `price_scale`. Convert `modified()` to Unix nanoseconds and reject pre-epoch timestamps instead of silently coercing.

- [ ] **Step 4: Implement rebuild using a temporary sidecar publication**

Rebuild sequence:

```text
create/open sidecar
set bootstrap_status=INCOMPLETE
delete existing state rows inside transaction
enumerate eod_data/{NSE,BSE,NSE_INDEX,BSE_INDEX}/*.eod
inspect each physical file
insert VERIFIED rows
validate inserted count == enumerated file count
increment generation
set bootstrap_status=COMPLETE and timestamp
commit
```

If any inspection fails, rollback the transaction and leave bootstrap incomplete.

- [ ] **Step 5: Add interrupted/invalid-file tests**

Test that:
- an invalid `.eod` prevents `COMPLETE`;
- partial rows are not returned by `load_verified`;
- a missing `eod_data` directory yields zero rows with `COMPLETE`, not a fabricated file set.

- [ ] **Step 6: Run state-index tests**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml eod_binary_state -- --nocapture
```

Expected: PASS.

- [ ] **Step 7: Run full binary_eod regression tests**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml binary_eod -- --nocapture
```

Expected: existing binary format tests PASS unchanged.

---

### Task 3: Implement filesystem census and per-symbol trust reconciliation

**Files:**
- Modify: `src-tauri-shell/src/database/eod_binary_state.rs`
- Test: inline tests

**Interfaces:**
- Produces:
  - `pub struct BinaryFileCensusEntry { pub relative_path: String, pub file_length: u64, pub file_mtime_ns: i64 }`
  - `BinaryStateIndex::reconcile_census(database_folder) -> Result<BinaryStateSnapshot, String>`
  - `pub struct BinaryStateSnapshot { pub verified: HashMap<BinaryStateKey, VerifiedBinaryState>, pub status: BinaryStateIndexStatus }`

- [ ] **Step 1: Write failing census-match and mismatch tests**

```rust
#[test]
fn census_keeps_matching_verified_row_and_rejects_changed_file_identity() {
    // build one real file and rebuild index
    // first reconcile => VERIFIED present
    // mutate only file length or mtime using canonical writer
    // second reconcile => key absent from trusted map and persisted state != VERIFIED
}
```

Use a real append to change the file; do not fake only the SQLite row.

- [ ] **Step 2: Run the focused test**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml census_keeps_matching_verified_row_and_rejects_changed_file_identity -- --nocapture
```

Expected: FAIL before reconciliation exists.

- [ ] **Step 3: Implement census without opening `.eod` contents**

Enumerate only directory entries and `fs::metadata`.

Reconciliation rules:

```text
VERIFIED + exact path/length/mtime match -> trusted map
VERIFIED + mismatch                       -> persist UNKNOWN, exclude
DIRTY                                     -> exclude
UNKNOWN                                   -> exclude
indexed row missing file                  -> persist UNKNOWN, exclude
new physical file                         -> leave unindexed; caller may physically inspect and publish
invalid bootstrap/schema                  -> return snapshot with zero trusted rows
```

Do not auto-promote any row to VERIFIED using census alone.

- [ ] **Step 4: Add status counters**

`BinaryStateIndexStatus` must expose:

```rust
pub struct BinaryStateIndexStatus {
    pub healthy: bool,
    pub bootstrap_complete: bool,
    pub indexed: usize,
    pub verified: usize,
    pub dirty: usize,
    pub unknown: usize,
    pub generation: i64,
    pub sidecar_path: String,
}
```

- [ ] **Step 5: Run tests and compile**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml eod_binary_state -- --nocapture
npm run tauri:check
```

Expected: PASS.

- [ ] **Step 6: V1.1 runtime proof**

With EOD Charting Platform closed, add a read-only command-line/test harness or temporary test executable path that opens the actual database folder and runs `rebuild` once.

Acceptance:
- indexed row count equals physical `.eod` count;
- exchange counts reconcile with the audited database;
- no `.eod` writes occur;
- removing/renaming the sidecar returns the application to current behavior.

Do not activate Bhavcopy fast behavior yet.

---

# V1.2 — Shadow Validation

### Task 4: Add physical-vs-index shadow comparison to Bhavcopy recovery baseline capture

**Files:**
- Modify: `src-tauri-shell/src/bhavcopy.rs:2019-2107`
- Modify: `src-tauri-shell/src/bhavcopy.rs:~900-1200`
- Use: `src-tauri-shell/src/database/eod_binary_state.rs`
- Test: `src-tauri-shell/src/bhavcopy.rs:5552+`

**Interfaces:**
- Consumes: `BinaryStateSnapshot`.
- Produces:
  - `BhavcopyStateShadowStats`
  - shadow comparison logging only; physical baseline remains authoritative.

Define:

```rust
#[derive(Clone, Debug, Default)]
struct BhavcopyStateShadowStats {
    compared: usize,
    matched: usize,
    mismatched: usize,
    unavailable: usize,
}
```

- [ ] **Step 1: Write failing exact-match and mismatch tests**

Add a helper that compares a `RecoveryBinaryBaseline` plus physical last date against a `VerifiedBinaryState`.

```rust
#[test]
fn state_shadow_matches_equivalent_physical_baseline() {
    let physical = PhysicalRecoveryPreState {
        existed_before: true,
        record_count: 10,
        price_scale: 100,
        file_length: (HEADER_SIZE + 10 * RECORD_SIZE) as u64,
        last_date: Some(20260818),
    };
    let indexed = verified_state("NSE", "AAA", 10, 100, physical.file_length, Some(20260818));

    assert!(shadow_state_matches(&physical, &indexed));
}
```

Mismatch test must fail on any of:
- `record_count`;
- `price_scale`;
- `file_length`;
- `last_date`.

- [ ] **Step 2: Run focused tests**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml state_shadow_ -- --nocapture
```

Expected: FAIL before helpers exist.

- [ ] **Step 3: Refactor baseline capture minimally to expose physical pre-state**

At `bhavcopy.rs:2019-2107`, preserve all existing physical opens and errors. Introduce a small `PhysicalRecoveryPreState` value populated from the already-read header/metadata/tail so shadow comparison does not cause an additional file read.

Physical state remains the source used to construct `RecoveryBinaryBaseline`.

- [ ] **Step 4: Load state snapshot once per Bhavcopy batch**

Before baseline preparation:
- open/reconcile sidecar;
- on any index error, log shadow unavailable and continue existing physical behavior;
- never fail the import because shadow state is unavailable.

- [ ] **Step 5: Emit aggregate telemetry**

At the end of baseline preparation log:

```text
[EOD State Shadow] compared=N matched=N mismatched=0 unavailable=M
```

For mismatches log bounded samples including exchange, symbol, physical values, and indexed values.

- [ ] **Step 6: Run Bhavcopy tests**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml bhavcopy -- --nocapture
npm run tauri:check
```

Expected: PASS.

- [ ] **Step 7: V1.2 production shadow gate**

Run at least one real Bhavcopy Update or Date Range with the sidecar present while physical behavior remains authoritative.

Required gate:
- `0 unexplained mismatches`.
- If mismatches exist, do not proceed to V1.3; classify them as index bug, unsupported writer invalidation, or legitimate external file change and fix V1.1/V1.2 first.

---

# V1.3 — Bhavcopy Recovery-Baseline Fast Path

### Task 5: Add persisted storage mode and baseline resolver

**Files:**
- Modify: `src-tauri-shell/src/database.rs:~60-80`
- Modify: `src-tauri-shell/src/database/settings.rs:94-127` only if visibility must change from `pub(super)` to `pub(crate)` for a shared wrapper
- Modify: `src-tauri-shell/src/bhavcopy.rs:2019-2107`
- Test: backend unit tests

**Interfaces:**
- Produces:
  - `get_eod_binary_storage_mode(connection: &Connection) -> EodBinaryStorageMode`
  - `set_eod_binary_storage_mode(connection: &Connection, mode: EodBinaryStorageMode) -> Result<(), String>`
  - `resolve_recovery_pre_state(...) -> Result<(PhysicalOrIndexedState, StatePathKind), String>`

Persist in the main application's `settings` table under exact key:

```text
eod_binary_storage_mode
```

Persist exact values:

```text
AUTO
FAST
FULL_VERIFY
```

Default: `AUTO`.

- [ ] **Step 1: Write failing settings tests**

Test missing key => `AUTO`; valid values round-trip; invalid persisted value => conservative `FULL_VERIFY` plus warning/error return according to existing settings style. Do not interpret invalid data as FAST.

- [ ] **Step 2: Implement settings wrappers**

Use existing `read_setting_value` / `write_setting_value`; do not store the mode in the sidecar.

- [ ] **Step 3: Write failing resolver tests**

Required cases:

```text
AUTO + VERIFIED match       -> indexed
FAST + VERIFIED match       -> indexed
FULL_VERIFY + VERIFIED      -> physical
AUTO + DIRTY                -> physical
AUTO + UNKNOWN              -> physical
AUTO + missing state        -> physical
AUTO + census mismatch      -> physical
```

- [ ] **Step 4: Implement resolver and replace only recovery-baseline state discovery**

For `AUTO`/`FAST`, construct `RecoveryBinaryBaseline` from trusted indexed values when:
- the symbol key exists in the reconciled trusted map;
- incoming first date is after indexed `last_date` or no last date exists;
- indexed file length is structurally compatible with `record_count`.

Otherwise call the unchanged physical baseline code.

Do not optimize the binary writer in V1.3.

- [ ] **Step 5: Add telemetry**

Log:

```text
fast_baseline=N
physical_baseline=M
state_mode=AUTO|FAST|FULL_VERIFY
```

- [ ] **Step 6: Run focused and full backend tests**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml state_
cargo test --manifest-path .\src-tauri-shell\Cargo.toml test_bhavcopy_
cargo test --manifest-path .\src-tauri-shell\Cargo.toml
npm run tauri:check
```

Expected: PASS.

- [ ] **Step 7: V1.3 runtime equivalence gate**

Run the same representative import once in `FULL_VERIFY` and once in `AUTO` against equivalent starting data/snapshot.

Compare:
- recovery baseline kind counts;
- rows inserted;
- symbols inserted;
- duplicates;
- errors;
- recovery session outcome.

Required:
- correctness equivalence;
- at least 90% reduction in physical recovery-baseline reads when index state is trusted.

---

# V1.4 — APPEND_NEWEST Fast Classification

### Task 6: Add trusted writer hint and post-state without duplicating the writer

**Files:**
- Modify: `src-tauri-shell/src/database/binary_eod.rs:444-628`
- Modify: `src-tauri-shell/src/database/eod_binary_state.rs`
- Test: `src-tauri-shell/src/database/binary_eod.rs:1881-1966`

**Interfaces:**
- Consumes: `VerifiedBinaryState`.
- Produces:
  - `pub struct BinaryStateHint`
  - `pub struct BinaryPostState`
  - `append_or_merge_records_with_stats_durability_with_hint(...)`
- Existing public method `append_or_merge_records_with_stats_durability(...)` delegates to the new implementation with `None`.

Define:

```rust
#[derive(Clone, Debug)]
pub struct BinaryStateHint {
    pub record_count: u32,
    pub price_scale: u32,
    pub file_length: u64,
    pub last_date: Option<u32>,
    pub file_mtime_ns: i64,
}

#[derive(Clone, Debug)]
pub struct BinaryPostState {
    pub record_count: u32,
    pub price_scale: u32,
    pub file_length: u64,
    pub first_date: Option<u32>,
    pub last_date: Option<u32>,
    pub file_mtime_ns: i64,
}
```

- [ ] **Step 1: Write a failing fast-hint APPEND_NEWEST test**

Prepare one record, capture its verified hint, append a later record with `RecoveryJournalBuffered`.

Assert:
- `BinaryWritePath::AppendNewest`;
- inserted date is correct;
- `sync_data_calls == 0`;
- header/last-date physical-read diagnostics are zero for the hint path;
- resulting file reopens with correct count/data;
- returned `BinaryPostState` matches physical result.

- [ ] **Step 2: Write a failing stale-hint fallback test**

After creating the hint, mutate the file using the canonical writer before invoking the hint path.

Expected:
- metadata identity mismatch is detected;
- writer does not trust the hint;
- it falls back to current physical classification;
- no data is lost.

- [ ] **Step 3: Implement one internal writer core**

Structure:

```rust
pub fn append_or_merge_records_with_stats_durability<P: AsRef<Path>>(
    ...
) -> Result<BinaryAppendMergeResult, String> {
    Self::append_or_merge_records_with_stats_durability_with_hint(
        path,
        symbol,
        exchange,
        price_scale,
        new_records,
        durability,
        None,
    )
}

pub fn append_or_merge_records_with_stats_durability_with_hint<P: AsRef<Path>>(
    ...,
    hint: Option<&BinaryStateHint>,
) -> Result<BinaryAppendMergeResult, String> {
    // one canonical mutation body
}
```

Do not duplicate append/merge logic.

- [ ] **Step 4: Validate hint before skipping content reads**

Before trusting the hint:
- file must exist;
- `fs::metadata` length must equal hint length;
- `modified` nanoseconds must equal hint mtime;
- `hint.file_length == HEADER_SIZE + record_count * RECORD_SIZE`;
- incoming records are sorted;
- first incoming date must be greater than `hint.last_date` for the fast append branch;
- requested `symbol`/`exchange` must be those associated with the state key supplied by Bhavcopy.

If any check fails, use current physical header/last-date path.

- [ ] **Step 5: Use the hint for APPEND_NEWEST setup**

Open the file read/write, seek to EOF, append records, update header record count at offset 8 and price scale at offset 12 if necessary, preserve current flush/sync behavior.

The hint path must not be used for overlap/conservative rewrites.

- [ ] **Step 6: Add `BinaryPostState` to result**

Extend `BinaryAppendMergeResult` with:

```rust
pub post_state: Option<BinaryPostState>,
```

Populate it for new file, APPEND_NEWEST, and conservative write paths when state is known after successful mutation.

Existing callers may ignore the new field.

- [ ] **Step 7: Run binary tests**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml binary_eod -- --nocapture
```

Expected: all existing tests plus new hint tests PASS.

---

### Task 7: Wire trusted hints into Bhavcopy and keep per-symbol fallback

**Files:**
- Modify: `src-tauri-shell/src/bhavcopy.rs:4227-4330`
- Modify: `src-tauri-shell/src/bhavcopy.rs:~4001-4191`
- Test: `src-tauri-shell/src/bhavcopy.rs:6024-6195`

**Interfaces:**
- Consumes:
  - reconciled `BinaryStateSnapshot`;
  - `BinaryStateHint`;
  - writer `post_state`.
- Produces:
  - per-symbol fast/physical writer classification counters;
  - retained post-states for later checkpoint publication.

- [ ] **Step 1: Write failing Bhavcopy fast-writer tests**

Create a binary database with an existing symbol and trusted state, then import one newer date.

Assert telemetry/result identifies fast classification.

Add a second symbol with a deliberately stale/missing state and assert only that symbol uses physical classification.

- [ ] **Step 2: Pass hints through the existing symbol worker queue**

Extend the flattened work item from:

```rust
(exchange, symbol, Vec<BhavcopyBinaryRecord>)
```

to a focused struct:

```rust
struct BhavcopyBinaryWorkItem {
    exchange: String,
    symbol: String,
    records: Vec<BhavcopyBinaryRecord>,
    trusted_state: Option<VerifiedBinaryState>,
}
```

Preserve existing sorting and worker count.

- [ ] **Step 3: Call the hint-aware writer**

Inside `write_bhavcopy_binary_records_for_symbol`, convert `VerifiedBinaryState` to `BinaryStateHint` and call the new writer method.

If no trusted state exists, call with `None`.

- [ ] **Step 4: Retain post-state by key**

Extend result aggregation so successful writes retain:

```text
(exchange, symbol) -> BinaryPostState
```

for later state publication after checkpoint.

Do not publish VERIFIED immediately after foreground write.

- [ ] **Step 5: Add aggregate telemetry**

Emit:

```text
fast_writer_classification=N
physical_writer_classification=M
```

and preserve existing binary diagnostics.

- [ ] **Step 6: Run tests**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml test_insert_parsed_bhavcopy_files_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml test_bhavcopy_buffered_durability_defers_only_append_newest_sync -- --nocapture
npm run tauri:check
```

Expected: PASS.

---

### Task 8: Add pre-mutation DIRTY batch and checkpoint VERIFIED publication

**Files:**
- Modify: `src-tauri-shell/src/database/eod_binary_state.rs`
- Modify: `src-tauri-shell/src/bhavcopy.rs:~900-1200`
- Modify: `src-tauri-shell/src/bhavcopy_recovery.rs:~360-470`
- Test: state module + Bhavcopy recovery tests

**Interfaces:**
- Produces:
  - `BinaryStateIndex::mark_dirty_batch(keys: &[BinaryStateKey])`
  - `BinaryStateIndex::publish_verified_batch(states: &[VerifiedBinaryState])`
  - checkpoint outcome returns enough keys/post-states to publish only successful files.

- [ ] **Step 1: Write transaction tests**

`mark_dirty_batch` must be all-or-nothing. `publish_verified_batch` must be all-or-nothing.

Test 100+ keys in one transaction and verify counts.

- [ ] **Step 2: Mark Bhavcopy mutation keys DIRTY before first binary mutation**

Ordering requirement:

```text
durable recovery session prepared
        ↓
trusted pre-state retained in memory
        ↓
sidecar mark_dirty_batch succeeds
        ↓
binary mutation begins
```

If sidecar dirty marking fails:
- log state-index degradation;
- disable fast hints for the operation;
- continue through existing physical path only;
- mark global sidecar status requiring reconciliation/rebuild.

Do not continue using already-trusted hints after invalidation failure.

- [ ] **Step 3: Preserve DIRTY through foreground completion**

Foreground successful APPEND_NEWEST must not publish VERIFIED.

- [ ] **Step 4: Publish after checkpoint success**

After existing checkpoint physically verifies and syncs each file, publish the corresponding physical/post state as VERIFIED.

If a checkpoint item fails, leave that key DIRTY.

- [ ] **Step 5: Run recovery/checkpoint tests**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml buffered_append_newest_checkpoint -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml append_newest_baseline_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml eod_binary_state -- --nocapture
```

Expected: PASS.

- [ ] **Step 6: V1.4 runtime gate**

For a one-day Update with a healthy index:
- `fast_baseline` >= 90% of existing symbols;
- `fast_writer_classification` >= 90% of APPEND_NEWEST symbols;
- `header_read` and `last_date_read` diagnostic time/count drop sharply;
- rows/symbols/errors match FULL_VERIFY;
- background checkpoint semantics/timing remain independently observable;
- after checkpoint, affected rows return to VERIFIED.

---

# V1.5 — Cross-Writer Invalidation

### Task 9: Integrate Bhavcopy recovery rollback/truncation

**Files:**
- Modify: `src-tauri-shell/src/bhavcopy_recovery.rs:~580-670`
- Modify: `src-tauri-shell/src/database/eod_binary_state.rs`
- Test: `src-tauri-shell/src/bhavcopy_recovery.rs:960-1320`

**Interfaces:**
- Consumes: state index invalidation API.
- Produces: recovered-state verification and publication API.

- [ ] **Step 1: Write recovery-state tests**

For interrupted APPEND_NEWEST:
- start VERIFIED;
- mark DIRTY;
- append;
- invoke recovery truncate/restore;
- physically verify restored header/tail;
- publish VERIFIED matching the restored baseline.

Add failure test where an unexpected tail record causes recovery rejection and state remains DIRTY/UNKNOWN.

- [ ] **Step 2: Invalidate before direct file restoration**

Before `set_len`, header restoration, or direct repair write, ensure the affected key is not trusted.

- [ ] **Step 3: Publish only after existing recovery verification**

Reuse the same physical state inspector as the index subsystem after recovery validation succeeds.

- [ ] **Step 4: Run recovery suite**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml bhavcopy_recovery -- --nocapture
```

Expected: PASS.

---

### Task 10: Integrate Quote Editor actual `.eod` mutations

**Files:**
- Modify: `src-tauri-shell/src/database/quotes.rs:~1050-1600`
- Modify: `src-tauri-shell/src/database.rs` only for shared helpers if needed
- Test: `src-tauri-shell/src/database/quotes.rs:1057-1555`

**Interfaces:**
- Consumes: `mark_dirty`, `inspect_canonical_file`, `publish_verified`.
- Produces: no fast Quote Editor path in V1.

- [ ] **Step 1: Write failing quote-upsert/delete state tests**

Test binary-mode:
- save one quote => affected state ends VERIFIED with correct last date/count;
- delete last record => state ends VERIFIED with zero/updated count as canonical file dictates;
- injected mutation failure => state is not left falsely VERIFIED.

- [ ] **Step 2: Add invalidation immediately before binary mutation**

Do not invalidate for read-only quote operations.

- [ ] **Step 3: After successful mutation, physically inspect and publish**

V1 prioritizes correctness over optimizing Quote Editor publication.

- [ ] **Step 4: Run quote tests**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml test_delete_quote_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml quotes -- --nocapture
```

Expected: PASS.

---

### Task 11: Integrate Manual Import and Manual Import Recovery

**Files:**
- Modify: `src-tauri-shell/src/imports.rs:~1100-1400`
- Modify: `src-tauri-shell/src/manual_import_recovery.rs:~1-1100`
- Test: existing imports/manual recovery tests

**Interfaces:**
- Same invalidation/publication APIs as Task 10.

- [ ] **Step 1: Write failing manual import state tests**

Binary import:
- affected symbol becomes DIRTY before binary write;
- success ends VERIFIED;
- undo/recovery ends VERIFIED only after physical restoration verification;
- failed undo does not publish VERIFIED.

- [ ] **Step 2: Integrate import invalidation**

Batch keys when possible to avoid one SQLite transaction per symbol.

- [ ] **Step 3: Integrate undo/recovery invalidation and publication**

Direct restores must never bypass the state contract.

- [ ] **Step 4: Run import/recovery tests**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml test_import_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml manual_import_recovery -- --nocapture
```

Expected: PASS.

- [ ] **Step 5: Cross-writer consistency test**

Sequence on one temp symbol:

```text
Bhavcopy write
Quote Editor change
Manual Import append
Manual recovery/undo
Bhavcopy AUTO read
```

At each completed durability/recovery boundary, index and physical state must agree.

---

# V1.6 — Backend Commands and UI Controls

### Task 12: Add backend status, verify, rebuild, and storage-mode commands

**Files:**
- Modify: `src-tauri-shell/src/database.rs:~1530-1810`
- Modify: `src-tauri-shell/src/main.rs:1047-1140`
- Modify: `src-tauri-shell/src/database/eod_binary_state.rs`
- Test: backend command/helper tests

**Interfaces:**
- Produces Tauri commands:
  - `get_eod_binary_state_status`
  - `verify_eod_binary_state_index`
  - `rebuild_eod_binary_state_index`
  - `get_eod_binary_storage_mode`
  - `set_eod_binary_storage_mode`

Return serializable status:

```rust
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EodBinaryStateStatusPayload {
    pub healthy: bool,
    pub bootstrap_complete: bool,
    pub indexed: usize,
    pub verified: usize,
    pub dirty: usize,
    pub unknown: usize,
    pub generation: i64,
    pub storage_mode: EodBinaryStorageMode,
    pub sidecar_path: String,
}
```

- [ ] **Step 1: Add helper tests for command behavior**

Required:
- no open database => descriptive error;
- missing sidecar => status unhealthy/bootstrap incomplete, not app failure;
- rebuild => complete status;
- set invalid mode impossible through typed API.

- [ ] **Step 2: Implement commands**

Use active database path and derive sidecar from its parent folder.

`verify_eod_binary_state_index` must physically verify a deterministic sample or the full index according to an explicit backend choice. For V1 UI button, use full verification only if runtime is acceptable; otherwise the command must clearly return `verificationScope: "sample"` and sample size. Do not label a sampled check as a full verification.

- [ ] **Step 3: Register commands in `main.rs`**

Add them to `tauri::generate_handler!`.

- [ ] **Step 4: Run backend tests and check**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml
npm run tauri:check
```

Expected: PASS.

---

### Task 13: Add TypeScript API types and Tauri adapters

**Files:**
- Modify: `src/types/desktop.ts:1191-1210, 1505-1510`
- Modify: `src/platform/types.ts:~250-280`
- Modify: `src/platform/tauriDesktop.ts:~291-305`

**Interfaces:**
- Produces:

```ts
export type EodBinaryStorageMode = 'AUTO' | 'FAST' | 'FULL_VERIFY';

export interface EodBinaryStateStatus {
  healthy: boolean;
  bootstrapComplete: boolean;
  indexed: number;
  verified: number;
  dirty: number;
  unknown: number;
  generation: number;
  storageMode: EodBinaryStorageMode;
  sidecarPath: string;
}
```

Desktop API:

```ts
getEodBinaryStateStatus(): Promise<EodBinaryStateStatus>;
verifyEodBinaryStateIndex(): Promise<EodBinaryStateStatus>;
rebuildEodBinaryStateIndex(): Promise<EodBinaryStateStatus>;
getEodBinaryStorageMode(): Promise<EodBinaryStorageMode>;
setEodBinaryStorageMode(mode: EodBinaryStorageMode): Promise<{ success: boolean }>;
```

- [ ] **Step 1: Add TypeScript types and API signatures**

Do not use `string` for storage mode.

- [ ] **Step 2: Add Tauri invoke adapters**

Exact command names must match Task 12.

- [ ] **Step 3: Run typecheck**

```powershell
npm run typecheck:renderer
```

Expected: PASS.

---

### Task 14: Add the EOD Binary State panel to Bhavcopy UI

**Files:**
- Create: `src/components/EodBinaryStatePanel.tsx`
- Modify: `src/components/BhavcopyDownloadWindow.tsx:~230-330, ~900-1000`
- Modify: `src/components/BhavcopyDownloadWindow.styles.ts` only as needed

**Interfaces:**
- Consumes desktop API from Task 13.
- Produces user controls:
  - status counts;
  - mode radio/select;
  - Verify Index;
  - Rebuild Index.

- [ ] **Step 1: Create a focused panel component**

The panel must render:
- `Healthy` / `Needs verification` / `Unavailable`;
- Indexed, Verified, Dirty, Unknown counts;
- mode choices Auto, Fast, Full Verify;
- explanatory text that FAST still falls back for untrusted rows;
- buttons for Verify and Rebuild;
- busy/error state.

Do not add an unsafe override.

- [ ] **Step 2: Wire panel loading into Bhavcopy window**

Load status when the Bhavcopy window opens and refresh after verify/rebuild/mode change.

- [ ] **Step 3: Keep existing Bhavcopy source settings separate**

Do not mix index controls into NSE/BSE URL override fields.

- [ ] **Step 4: Run renderer validation**

```powershell
npm run typecheck:renderer
npm run build:renderer
```

Expected: PASS.

- [ ] **Step 5: Manual UI checks**

Verify:
- AUTO is selected by default on a fresh valid setup;
- selecting FULL_VERIFY persists and next Bhavcopy run logs FULL_VERIFY;
- FAST description explicitly says untrusted rows fall back;
- Rebuild shows busy state and final counts;
- sidecar missing/unavailable does not crash the window.

---

# Final Validation and Release Gate

### Task 15: Run correctness equivalence, recovery, performance, and rollback validation

**Files:**
- Modify documentation only after code has passed.
- Add: `docs/changes/<timestamp>_EOD_BINARY_STATE_INDEX_STORAGE_ARCHITECTURE_V1.md`
- Add: validation logs/manifests using existing project conventions.

**Interfaces:**
- Consumes all V1.1-V1.6 work.
- Produces release evidence and final go/no-go decision.

- [ ] **Step 1: Run full automated validation**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml
npm run typecheck:renderer
npm run tauri:check
npm run build:renderer
```

Expected: all PASS.

- [ ] **Step 2: Run canonical FULL_VERIFY baseline**

On a controlled database snapshot, run the representative Bhavcopy input in `FULL_VERIFY`.

Capture:
- rows inserted;
- symbols inserted;
- duplicates;
- binary write path counts;
- recovery journal state;
- checkpoint result;
- wall timings.

- [ ] **Step 3: Restore the same starting database snapshot and run AUTO**

Capture the same metrics plus:
- state load ms;
- census ms;
- fast baseline count;
- physical baseline count;
- fast writer classification count;
- physical writer classification count.

Required:
- zero correctness differences;
- at least 90% reduction in physical baseline reads for trusted symbols;
- at least 90% reduction in physical APPEND_NEWEST classification reads for trusted symbols.

- [ ] **Step 4: Run per-symbol fallback fault cases**

Before AUTO run, deliberately produce controlled cases:
- one DIRTY row;
- one UNKNOWN row;
- one missing sidecar row;
- one physical file with mtime/length mismatch.

Expected:
- only affected symbols use physical fallback;
- trusted symbols remain fast;
- no guessed state.

- [ ] **Step 5: Run crash/recovery validation**

Exercise:
- interrupted APPEND_NEWEST before checkpoint;
- restart/resume checkpoint;
- rollback/restore path;
- checkpoint failure/deferred path.

Expected:
- no affected symbol becomes VERIFIED before required physical verification;
- recovery journal behavior remains consistent with pre-V1 semantics.

- [ ] **Step 6: Run cross-writer validation**

Exercise:
- Quote Editor save/delete;
- Manual Import;
- Manual Import undo/recovery.

After each complete operation, compare sidecar to physical state.

- [ ] **Step 7: Run rollback validation**

Set `FULL_VERIFY` and confirm:
- Bhavcopy uses existing physical behavior;
- deleting/renaming `eod_binary_state.sqlite` does not prevent import;
- application can rebuild the sidecar from canonical `.eod`.

- [ ] **Step 8: Create runtime performance report**

Compare to the 2026-08-19 HDD incident and earlier healthy runs.

Do not attribute all gain to the index if OS cache state differs; record cold/warm conditions and path counters.

- [ ] **Step 9: Create final documentation reconciliation**

Update canonical architecture/operator documentation with:
- sidecar role;
- trust hierarchy;
- storage modes;
- rebuild/verify procedure;
- rollback procedure;
- telemetry interpretation;
- performance evidence;
- explicit statement that `.eod` remains canonical.

- [ ] **Step 10: Create fresh canonical source snapshot**

Use the project's canonical snapshot workflow after all validations and documentation pass.

Record ZIP SHA-256 and relevant source hashes.

---

# Patch Boundary Summary

## V1.1 — State Index Infrastructure
Deliverables:
- new state module;
- schema;
- bootstrap/rebuild;
- census;
- no Bhavcopy behavior change.

Gate:
- physical/index bootstrap equivalence.

## V1.2 — Shadow Validation
Deliverables:
- physical vs indexed comparison;
- aggregate telemetry;
- physical path remains authoritative.

Gate:
- zero unexplained mismatches.

## V1.3 — Bhavcopy Baseline Fast Path
Deliverables:
- AUTO/FAST/FULL_VERIFY backend mode;
- indexed recovery baseline for trusted symbols;
- permanent physical fallback.

Gate:
- FULL_VERIFY equivalence;
- >=90% physical baseline-read reduction.

## V1.4 — APPEND_NEWEST Fast Classification
Deliverables:
- trusted writer hint;
- metadata revalidation;
- post-state;
- DIRTY before write;
- VERIFIED after checkpoint.

Gate:
- correctness equivalence;
- >=90% APPEND_NEWEST classification-read reduction.

## V1.5 — Cross-Writer Invalidation
Deliverables:
- Bhavcopy recovery;
- Quote Editor;
- Manual Import;
- Manual Import Recovery.

Gate:
- no actual `.eod` writer can leave stale state VERIFIED.

## V1.6 — UI / Storage Mode Controls
Deliverables:
- status/verify/rebuild commands;
- Auto/Fast/Full Verify UI;
- no unsafe force-fast option.

Gate:
- backend + renderer + manual UI validation.

---

# Execution Safety Sequence for Every Patch

Before applying each V1.x patch:

```text
1. EOD Charting Platform CLOSED.
2. Capture current source hashes for all target files.
3. Create targeted source backup / rollback payload.
4. Verify patch payload hashes.
5. Apply only the scoped V1.x change.
6. Run focused failing-test → passing-test cycle.
7. Run full relevant validation.
8. Run runtime gate if the patch changes runtime behavior.
9. Write change documentation and evidence.
10. Do not proceed to the next V1.x stage unless the current gate passes.
```

If any runtime gate fails, restore that patch's source backup and keep the previously accepted V1.x stage as canonical.
