# Identity ER4 Source Candidate Review, Version History, Promotion & Rollback Implementation Plan R1

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Git/source-control commands are intentionally omitted because this workstream prohibits Git commands unless separately authorized.**

**Goal:** Build ER4 as a staged, operator-governed official-source recovery authority that preserves the existing manual recovery workflow while adding immutable per-source history, deterministic candidate review, explicit stale-fenced promotion, truthful post-change ER1 health evidence, and reviewed rollback.

**Architecture:** ER4 uses one SQLite-owned per-source version ledger in the active EOD database. ER3-A/B remain the discovery/acquisition/validation authorities; ER1 remains the health authority; ER4 owns only review decisions, durable source versions/current pointers, manual override versioning, atomic promotion/rollback, compatibility mirroring for `officialSourceUrls.v1`, and operator-visible history. ER4-A is pure/read-only; ER4-B introduces durable ledger ownership and manual compatibility; ER4-C adds operator candidate review and non-mutating decisions; ER4-D adds explicit promotion; ER4-E adds reviewed rollback and final acceptance.

**Tech Stack:** Rust 2021, Tauri 2.11.x, `rusqlite` 0.31, `serde`/`serde_json`, `sha2`, `reqwest` 0.12, React 18, TypeScript 5.4, Vitest 4.1, Vite 6.4, Windows PowerShell.

**Spec:** `docs/superpowers/specs/2026-09-15-identity-er4-source-candidate-review-version-history-design-r1.md`

**Approved spec SHA-256:** `EEA51A0E969F683065D6DFA58B029D344CFCCD0F17E77D0BB82425E74AA7C688`

**Current self-contained source authority:** `Eod Charting Platform Source Code 2026-09-15_020218_IST.zip`

**Authority SHA-256:** `8C3C9092DC2F6190FEB3703A174721570493DC52510F862FBBBB904C6D7B6BB6`

**Protected source authority:** `543 files exact`

## Global Constraints

- Active workstream is exactly `E:\TA Projects\EOD Charting Platform`.
- Before any ER4-A source change, install the approved ER4 Design R1 spec and this approved plan into the real project, record that documentation-only authority change, create a fresh Snapshot V3, and independently accept that snapshot.
- Never silently use an older ZIP/chat/runner as source authority once a newer accepted snapshot exists.
- Work on one bounded ER4 stage at a time. ER4-B must not begin until ER4-A is independently accepted; the same rule applies B→C, C→D, and D→E.
- No later stage begins automatically because an earlier stage turns GREEN.
- Preserve I3 reviewed Preview → Apply authority and I4 reviewed Preview → atomic Apply authority.
- Preserve ER1 11-source health contract/UI/freshness semantics.
- Preserve ER2 resolver/shadow semantics.
- Preserve ER3-A discovery order/limits/`DISCOVERED_NOT_PROMOTED`.
- Preserve ER3-B NSE-only transport/body budgets/parser/population logic and its non-promoting classifications.
- Candidate promotion scope in ER4 R1 is exactly five NSE ER3-B contracts. BSE and NSE landing-page candidate promotion remain excluded.
- No automatic promotion. No automatic rollback.
- Manual Official Source URLs remains visibly available throughout ER4 and remains the fallback when automated recovery is unavailable.
- Manual saves are not newly blocked by provenance/network validation; they are versioned as `MANUAL_OVERRIDE`.
- Raw CSV/XLSX response bodies must never be persisted in ER4 review/history tables.
- `officialSourceUrls.v1` becomes compatibility mirror only after ER4-B baseline migration.
- After ER4-B activation, generic `set_setting("officialSourceUrls.v1", ...)` must fail closed with zero write.
- Every source mutation uses `BEGIN IMMEDIATE TRANSACTION` and explicit rollback on error, following existing project transaction patterns.
- Routine task evidence must be written only below `E:\TA Projects\EOD Charting Platform\tmp`.
- `E:\TA Projects\EOD Charting Platform Source Audit` is reserved for source snapshots only.
- Source directories `src` and `src-tauri-shell` must contain source only; no build outputs, targets, copied executables, temporary evidence, or package output.
- No Git/source-control commands unless explicitly authorized later.
- Application/user database access must occur only in ER4 stages whose approved scope requires database migration or runtime source-history behavior. ER4-A must not open/write the application/user DB.
- Ordinary tests/build validation use no unnecessary internet access. Network is allowed only for explicitly operator-invoked ER3/ER4 source acquisition or an explicitly authorized manual online checkpoint.
- Every meaningful source/build/configuration stage creates `docs\changes\YYYY-MM-DD_HHMM_IST_<DESCRIPTIVE_TOPIC>.md` using the actual execution timestamp in IST and records actual commands/results.
- Never claim a test, build, typecheck, package, parser, portable build, or validation passed without actual command output.
- Preserve the deferred NSE symbol-change temporary-staging concurrency issue unchanged.
- ER5+, BSE recovery/parity, landing-page promotion, remote/multi-user approval, RBAC, cloud sync, and I3/I4 Apply coupling remain outside this plan.

---

# File Structure Map

## New Rust modules

### `src-tauri-shell/src/database/official_source_candidate_review.rs`

Single responsibility: ER4 source registry, pure review-plan construction, canonical validation hash/review fingerprint, promotability rules, stale-base comparison, and later review/promotion orchestration entry points that depend on the version ledger.

### `src-tauri-shell/src/database/official_source_version_history.rs`

Single responsibility: ER4 schema helpers, baseline migration, immutable version rows, current pointers/revisions, compatibility JSON mirror, configuration authority read model, reviewed manual saves, durable review events, source history, and transaction helpers.

## Existing Rust modules that change

### `src-tauri-shell/src/database/bootstrap.rs`

Owns ER4 table creation and baseline migration invocation inside the existing connection-preparation path.

### `src-tauri-shell/src/database/settings.rs`

Preserves generic setting behavior except that ER4-B blocks direct writes to `officialSourceUrls.v1`.

### `src-tauri-shell/src/database/official_source_urls.rs`

Retains defaults/provenance/redirect ownership; becomes serializable/deserializable in the existing camelCase format; after ER4-B, effective loading prefers the ER4 current ledger and falls back to legacy behavior only before baseline exists.

### `src-tauri-shell/src/database/official_source_candidate_validation.rs`

ER3-B remains owner of candidate transport/parser/population validation. ER4-A may widen only the minimal classification/type visibility required by pure review planning. ER4-D adds one direct-candidate revalidation helper reusing the same transport and validation code.

### `src-tauri-shell/src/database/official_source_health.rs`

ER1 semantics remain unchanged. ER4-D/E expose one internal explicit-configuration assessment helper so post-change health evaluates the exact configuration snapshot returned by the committed ER4 transaction.

### `src-tauri-shell/src/database.rs`

Registers/re-exports the two ER4 modules and public Tauri command surfaces without moving unrelated existing types.

### `src-tauri-shell/src/main.rs`

Adds only approved ER4 Tauri commands to the existing `generate_handler!` list stage-by-stage.

## Frontend files

### `src/types/desktop.ts`

Adds exact ER4 wire types and `DesktopApi` methods.

### `src/platform/types.ts`

Adds ER4 method names to the platform capability contract using the repository's existing pattern.

### `src/platform/tauriDesktop.ts`

Maps exact ER4 camelCase methods to frozen snake_case Tauri command names.

### `src/components/DatabaseToolsDialogs.tsx`

Preserves the existing Official Source URLs UI, migrates its load/save internals to versioned authority in ER4-B, then adds candidate review/history/promotion/rollback UI incrementally in ER4-C/D/E.

### `src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts`

New static cross-layer contract test following the existing Identity ER1 characterization style. It checks command wiring, preserved manual UI labels, stage boundaries, classification labels, and forbidden coupling without requiring new frontend test dependencies.

## Documentation

Each stage adds an actual-timestamp change record:

- ER4-A: `docs\changes\YYYY-MM-DD_HHMM_IST_IDENTITY_ER4A_DETERMINISTIC_REVIEW_AUTHORITY.md`
- ER4-B: `docs\changes\YYYY-MM-DD_HHMM_IST_IDENTITY_ER4B_SOURCE_VERSION_LEDGER_MANUAL_COMPATIBILITY.md`
- ER4-C: `docs\changes\YYYY-MM-DD_HHMM_IST_IDENTITY_ER4C_OPERATOR_CANDIDATE_REVIEW.md`
- ER4-D: `docs\changes\YYYY-MM-DD_HHMM_IST_IDENTITY_ER4D_EXPLICIT_CANDIDATE_PROMOTION.md`
- ER4-E: `docs\changes\YYYY-MM-DD_HHMM_IST_IDENTITY_ER4E_REVIEWED_ROLLBACK_FINAL_ACCEPTANCE.md`

Every stage also receives a stage-current-authority/handoff closeout before the fresh snapshot that authorizes the next stage.

---

# Frozen Public Command Names

The implementation plan freezes these Tauri command names:

```text
get_official_source_configuration_authority
save_official_source_urls_reviewed
find_official_source_replacement_candidates
create_official_source_candidate_review
record_official_source_candidate_decision
promote_official_source_candidate_reviewed
list_official_source_history
create_official_source_rollback_review
apply_official_source_rollback_reviewed
retry_official_source_post_health
```

Frontend `DesktopApi` methods:

```text
getOfficialSourceConfigurationAuthority
saveOfficialSourceUrlsReviewed
findOfficialSourceReplacementCandidates
createOfficialSourceCandidateReview
recordOfficialSourceCandidateDecision
promoteOfficialSourceCandidateReviewed
listOfficialSourceHistory
createOfficialSourceRollbackReview
applyOfficialSourceRollbackReviewed
retryOfficialSourcePostHealth
```

ER4-A creates no Tauri command. ER4-B introduces the first two plus history read only if required for verification. ER4-C introduces candidate discovery/review/decision/history. ER4-D introduces promotion. ER4-E introduces rollback and post-health retry.

---

# Pre-Execution Authority Gate: Install Approved Spec + Plan

**Files:**
- Create in real project: `docs/superpowers/specs/2026-09-15-identity-er4-source-candidate-review-version-history-design-r1.md`
- Create in real project: `docs/superpowers/plans/2026-09-15-identity-er4-source-candidate-review-version-history-implementation-plan-r1.md`
- Create in real project: `docs/changes/YYYY-MM-DD_HHMM_IST_IDENTITY_ER4_DESIGN_PLAN_AUTHORITY_INSTALL.md`
- Verify unchanged: `scripts/Create-EOD-Source-Code-Snapshot-v3.ps1`

**Interfaces:**
- Consumes: accepted `020218` snapshot SHA `8C3C9092DC2F6190FEB3703A174721570493DC52510F862FBBBB904C6D7B6BB6`.
- Produces: a documentation-only current authority containing the approved ER4 Design R1 and this plan; still zero ER4 source implementation.

- [ ] **Step 1: Verify the live project still matches the accepted `020218` protected-source authority**

Use the accepted 543-entry manifest from ER3 final closure. Fail if any protected source path/byte length/SHA differs.

Expected: `543/543 exact`.

- [ ] **Step 2: Install only the approved spec and plan**

Copy the exact approved bytes into the project paths above. Do not touch `src`, `src-tauri-shell`, Cargo files, package files, database files, or settings.

- [ ] **Step 3: Write the documentation-only authority change record**

Record:
- parent snapshot name/SHA;
- spec SHA;
- plan SHA;
- files created;
- runtime/source change `0`;
- DB/network/Git/build/test actions `0`;
- ER4 source implementation `NOT STARTED`;
- rollback = remove the three authority docs.

- [ ] **Step 4: Verify protected source remains byte-identical**

Expected: exact same 543-entry protected-source manifest.

- [ ] **Step 5: Run Snapshot V3 separately**

Run from the project root only after the documentation install passes:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"
$script = (Resolve-Path -LiteralPath ".\scripts\Create-EOD-Source-Code-Snapshot-v3.ps1").Path
& $script
```

Type `COPY`.

Expected: new source snapshot contains only the authority-doc additions over `020218`; no protected source changes.

- [ ] **Step 6: Independently accept the new snapshot before ER4-A**

ER4-A source work is blocked until this snapshot is independently accepted and its SHA becomes the new parent authority.

---

# ER4-A — Deterministic Review Authority

## Task 1: Freeze the ER4 nine-source registry and pure configuration authority types

**Files:**
- Create: `src-tauri-shell/src/database/official_source_candidate_review.rs`
- Modify: `src-tauri-shell/src/database.rs:1-22`
- Test: inline `#[cfg(test)]` tests in `official_source_candidate_review.rs`

**Interfaces:**
- Consumes: ER3 source IDs/roles from approved Design R1.
- Produces:

```rust
pub(crate) const ER4_REVIEW_SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Er4SourceRegistryEntry {
    pub source_key: &'static str,
    pub exchange: &'static str,
    pub source_id: Option<&'static str>,
    pub source_role: Option<&'static str>,
    pub config_field: &'static str,
    pub candidate_promotion_eligible: bool,
}

pub(crate) const ER4_SOURCE_REGISTRY: [Er4SourceRegistryEntry; 9];

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Er4CurrentSourceAuthority {
    pub source_key: String,
    pub exchange: String,
    pub source_id: Option<String>,
    pub source_role: Option<String>,
    pub config_field: String,
    pub candidate_promotion_eligible: bool,
    pub current_version_id: i64,
    pub revision: i64,
    pub current_url: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Er4ConfigurationAuthority {
    pub schema_version: u32,
    pub configuration_fingerprint: String,
    pub sources: Vec<Er4CurrentSourceAuthority>,
}
```

- [ ] **Step 1: Write the failing registry tests**

Add tests with exact assertions:

```rust
#[test]
fn er4a_registry_contains_exactly_nine_unique_source_keys() {
    assert_eq!(ER4_SOURCE_REGISTRY.len(), 9);
    let keys = ER4_SOURCE_REGISTRY
        .iter()
        .map(|entry| entry.source_key)
        .collect::<std::collections::BTreeSet<_>>();
    assert_eq!(keys.len(), 9);
}

#[test]
fn er4a_registry_has_exactly_five_candidate_promotion_sources() {
    let promotable = ER4_SOURCE_REGISTRY
        .iter()
        .filter(|entry| entry.candidate_promotion_eligible)
        .map(|entry| entry.source_key)
        .collect::<Vec<_>>();
    assert_eq!(
        promotable,
        vec![
            "NSE_CURRENT_EQUITY_MASTER",
            "NSE_CURRENT_SME_MASTER",
            "NSE_SYMBOL_CHANGE_HISTORY",
            "NSE_COMPANY_NAME_CHANGE_HISTORY",
            "NSE_DELISTED_COMPANIES_WORKBOOK",
        ]
    );
}

#[test]
fn er4a_bse_and_landing_entries_are_manual_only() {
    for key in [
        "NSE_SECURITIES_AVAILABLE_PAGE",
        "NSE_DELISTED_PAGE",
        "BSE_LIST_SCRIPS_URL_PREFIX",
        "BSE_LIST_SCRIPS_REFERER",
    ] {
        let entry = ER4_SOURCE_REGISTRY
            .iter()
            .find(|entry| entry.source_key == key)
            .unwrap();
        assert!(!entry.candidate_promotion_eligible);
    }
}
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er4a_registry_ -- --nocapture
```

Expected: compile/test failure because the ER4 module/registry does not exist.

- [ ] **Step 3: Implement the exact registry and types**

Use the approved R1 table in Design §7 in exactly this order:

```rust
pub(crate) const ER4_SOURCE_REGISTRY: [Er4SourceRegistryEntry; 9] = [
    Er4SourceRegistryEntry {
        source_key: "NSE_SECURITIES_AVAILABLE_PAGE",
        exchange: "NSE",
        source_id: None,
        source_role: None,
        config_field: "nseSecuritiesAvailablePageUrl",
        candidate_promotion_eligible: false,
    },
    Er4SourceRegistryEntry {
        source_key: "NSE_CURRENT_EQUITY_MASTER",
        exchange: "NSE",
        source_id: Some("NSE_CURRENT_EQUITY_MASTER"),
        source_role: Some("CURRENT_IDENTITY_MASTER"),
        config_field: "nseEquityMasterUrl",
        candidate_promotion_eligible: true,
    },
    Er4SourceRegistryEntry {
        source_key: "NSE_CURRENT_SME_MASTER",
        exchange: "NSE",
        source_id: Some("NSE_CURRENT_SME_MASTER"),
        source_role: Some("CURRENT_IDENTITY_MASTER_SME"),
        config_field: "nseSmeMasterUrl",
        candidate_promotion_eligible: true,
    },
    Er4SourceRegistryEntry {
        source_key: "NSE_SYMBOL_CHANGE_HISTORY",
        exchange: "NSE",
        source_id: Some("NSE_SYMBOL_CHANGE_HISTORY"),
        source_role: Some("HISTORICAL_SYMBOL_CONTINUITY"),
        config_field: "nseSymbolChangeUrl",
        candidate_promotion_eligible: true,
    },
    Er4SourceRegistryEntry {
        source_key: "NSE_COMPANY_NAME_CHANGE_HISTORY",
        exchange: "NSE",
        source_id: Some("NSE_COMPANY_NAME_CHANGE_HISTORY"),
        source_role: Some("HISTORICAL_NAME_CONTINUITY"),
        config_field: "nseCompanyNameChangeUrl",
        candidate_promotion_eligible: true,
    },
    Er4SourceRegistryEntry {
        source_key: "NSE_DELISTED_PAGE",
        exchange: "NSE",
        source_id: None,
        source_role: None,
        config_field: "nseDelistedPageUrl",
        candidate_promotion_eligible: false,
    },
    Er4SourceRegistryEntry {
        source_key: "NSE_DELISTED_COMPANIES_WORKBOOK",
        exchange: "NSE",
        source_id: Some("NSE_DELISTED_COMPANIES_WORKBOOK"),
        source_role: Some("DELISTED_LIFECYCLE_EVIDENCE"),
        config_field: "nseDelistedWorkbookUrl",
        candidate_promotion_eligible: true,
    },
    Er4SourceRegistryEntry {
        source_key: "BSE_LIST_SCRIPS_URL_PREFIX",
        exchange: "BSE",
        source_id: None,
        source_role: None,
        config_field: "bseListScripsUrlPrefix",
        candidate_promotion_eligible: false,
    },
    Er4SourceRegistryEntry {
        source_key: "BSE_LIST_SCRIPS_REFERER",
        exchange: "BSE",
        source_id: None,
        source_role: None,
        config_field: "bseListScripsReferer",
        candidate_promotion_eligible: false,
    },
];
```

Register only:

```rust
mod official_source_candidate_review;
```

in `database.rs`. Do not add a Tauri command.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the same `er4a_registry_` filter.

Expected: all registry tests PASS.

---

## Task 2: Implement canonical configuration, validation-report, and review fingerprints

**Files:**
- Modify: `src-tauri-shell/src/database/official_source_candidate_review.rs`
- Test: inline ER4-A hash tests

**Interfaces:**
- Consumes: `Er4CurrentSourceAuthority`.
- Produces:

```rust
pub(crate) fn compute_er4_configuration_fingerprint(
    sources: &[Er4CurrentSourceAuthority],
) -> Result<String, String>;

pub(crate) fn compute_er4_validation_report_sha256(
    input: &Er4ValidationProjection<'_>,
) -> Result<String, String>;

pub(crate) fn compute_er4_review_fingerprint(
    input: &Er4ReviewFingerprintInput<'_>,
) -> Result<String, String>;
```

Canonical hashing must use `serde_json::to_vec` over array/tuple representations, then SHA-256 uppercase hex. Do not hash Rust debug output or JSON objects.

- [ ] **Step 1: Write deterministic/content-sensitive failing tests**

Use fixed fixtures and assert:
- reordering input sources does not change configuration fingerprint because the helper reorders by frozen registry order;
- changing one revision changes fingerprint;
- changing candidate SHA changes validation/report/review fingerprints;
- timestamps/operator notes are absent from hash inputs.

Example:

```rust
#[test]
fn er4a_configuration_fingerprint_is_registry_ordered_and_content_sensitive() {
    let mut a = fixture_configuration_authority_rows();
    let mut b = a.clone();
    b.reverse();
    assert_eq!(
        compute_er4_configuration_fingerprint(&a).unwrap(),
        compute_er4_configuration_fingerprint(&b).unwrap()
    );

    a[1].revision += 1;
    assert_ne!(
        compute_er4_configuration_fingerprint(&a).unwrap(),
        compute_er4_configuration_fingerprint(&b).unwrap()
    );
}
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er4a_ -- --nocapture
```

Expected: hash helpers missing.

- [ ] **Step 3: Implement compact-array canonical serialization**

Use exact logical payloads from Design §§12–14. Implement one helper:

```rust
fn sha256_upper_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:X}", hasher.finalize())
}
```

For configuration rows, map every source key through `ER4_SOURCE_REGISTRY` and fail if any expected key is missing, duplicated, or unknown.

- [ ] **Step 4: Run ER4-A hash tests and verify GREEN**

Expected: all `er4a_*fingerprint*` tests PASS.

---

## Task 3: Build deterministic ER3-B candidate → ER4 review plans and pure stale checks

**Files:**
- Modify: `src-tauri-shell/src/database/official_source_candidate_review.rs`
- Modify minimally: `src-tauri-shell/src/database/official_source_candidate_validation.rs:23-25`
- Test: inline ER4-A review tests

**Interfaces:**
- Consumes existing `Er3bCandidateValidationResult`.
- Widen only these ER3-B constants from private to `pub(crate)`:

```rust
pub(crate) const ER3B_CLASS_VALIDATED: &str = "VALIDATED_CANDIDATE_NOT_PROMOTED";
pub(crate) const ER3B_CLASS_INDETERMINATE: &str = "INDETERMINATE_CANDIDATE";
pub(crate) const ER3B_CLASS_REJECTED: &str = "REJECTED_CANDIDATE";
```

- Produces:

```rust
#[derive(Clone, Debug, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceCandidateReviewPlan {
    pub schema_version: u32,
    pub source_key: String,
    pub exchange: String,
    pub source_id: String,
    pub source_role: String,
    pub base_version_id: i64,
    pub base_revision: i64,
    pub current_url: String,
    pub candidate_url: String,
    pub candidate_final_url: Option<String>,
    pub candidate_content_sha256: Option<String>,
    pub classification: String,
    pub discovery_reason: String,
    pub http_status: Option<u16>,
    pub content_type: Option<String>,
    pub response_bytes: Option<u64>,
    pub parser_status: String,
    pub schema_status: String,
    pub population_status: String,
    pub population_count: Option<u32>,
    pub freshness_status: String,
    pub validation_reason: String,
    pub validation_report_sha256: String,
    pub review_fingerprint: String,
    pub promotable: bool,
}

pub(crate) fn build_er4_candidate_review_plan(
    base: &Er4CurrentSourceAuthority,
    candidate: &Er3bCandidateValidationResult,
) -> Result<OfficialSourceCandidateReviewPlan, String>;

pub(crate) fn verify_er4_review_base(
    expected_version_id: i64,
    expected_revision: i64,
    expected_url: &str,
    actual: &Er4CurrentSourceAuthority,
) -> Result<(), String>;
```

- [ ] **Step 1: Write failing review-plan tests**

Cover:
- source key maps to same frozen ER3-B source ID/role;
- BSE/manual-only key rejects;
- candidate current/configured URL mismatch rejects;
- validation report contains no raw body;
- only validated classification sets `promotable = true`;
- stale base version/revision/URL returns `ER4_STALE_REJECTED`.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er4a_ -- --nocapture
```

- [ ] **Step 3: Implement minimal plan conversion**

Do not add network, database access, Tauri commands, persistence, or UI. Use registry lookup, canonical hashes, and the frozen ER3-B result fields only.

- [ ] **Step 4: Run all ER4-A tests and preservation filters**

Run:

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er4a_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er3a_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er3b_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline official_source_runtime_provenance_ -- --nocapture
cargo check --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline
```

Expected: all focused/preservation tests PASS. Existing accepted dead-code warnings are not failures.

- [ ] **Step 5: Write ER4-A change record and evidence**

Record actual file hashes, RED/GREEN proof, preservation results, and that application/user DB/network/UI/persistence/promotion remained untouched.

- [ ] **Step 6: Close ER4-A before ER4-B**

Create ER4-A current-authority/handoff docs and a fresh Snapshot V3. Independently accept the snapshot. **Stop. ER4-B remains unauthorized until explicit approval.**

---

# ER4-B — Source Version Ledger + Manual Compatibility

## Task 4: Add ER4 ledger schema and atomic baseline migration

**Files:**
- Create: `src-tauri-shell/src/database/official_source_version_history.rs`
- Modify: `src-tauri-shell/src/database/bootstrap.rs:20-24, 52+`
- Modify: `src-tauri-shell/src/database.rs:1-22`
- Test: inline tests in `official_source_version_history.rs`

**Interfaces:**
- Produces:

```rust
pub(crate) fn ensure_official_source_version_schema(
    connection: &rusqlite::Connection,
) -> Result<(), String>;

pub(crate) fn ensure_official_source_baseline(
    connection: &rusqlite::Connection,
) -> Result<(), String>;

pub(crate) fn validate_official_source_ledger_integrity(
    connection: &rusqlite::Connection,
) -> Result<(), String>;
```

Use the exact three schemas/check constraints/indexes from Design §8.

- [ ] **Step 1: Write failing clean-DB schema/baseline tests**

Create `rusqlite::Connection::open_in_memory()` fixtures. Create the legacy `settings` table only, then call ER4 helpers.

Tests must assert:
- three ER4 tables exist;
- nine revision-1 baseline version rows;
- nine current rows;
- one baseline batch ID;
- current pointers reference matching source key/revision;
- normalized full nine-field mirror exists.

- [ ] **Step 2: Write malformed/partial legacy JSON behavior tests**

Seed:
- absent setting;
- malformed JSON;
- partial JSON with one valid non-empty override and missing fields.

Assert the baseline effective URLs exactly match current `load_official_source_urls` behavior.

- [ ] **Step 3: Write corruption/idempotency RED tests**

Reopen or call baseline twice: row counts stay nine.

Create partial current state (e.g. 8 rows) and assert:

```text
ER4_LEDGER_CORRUPT
```

with no auto-repair.

- [ ] **Step 4: Run `er4b_baseline_` tests and verify RED**

Expected: helpers/tables absent.

- [ ] **Step 5: Implement schema + `BEGIN IMMEDIATE` baseline**

Follow this control shape:

```rust
connection.execute_batch("BEGIN IMMEDIATE TRANSACTION")?;
let result = (|| -> Result<(), String> {
    // create/check baseline rows and mirror
    Ok(())
})();
match result {
    Ok(()) => connection.execute_batch("COMMIT").map_err(|e| e.to_string()),
    Err(error) => {
        let _ = connection.execute_batch("ROLLBACK");
        Err(error)
    }
}
```

Do not drop/repair partial ledgers.

- [ ] **Step 6: Call baseline from existing bootstrap ownership**

After `run_migrations(connection)?` and before `seed_defaults(connection)?`, call schema/baseline/integrity through one ER4 bootstrap helper. The effective URL must not change.

- [ ] **Step 7: Run ER4-B migration tests and existing bootstrap-sensitive tests**

Expected: all PASS.

---

## Task 5: Make the ER4 ledger the authoritative current source read model

**Files:**
- Modify: `src-tauri-shell/src/database/official_source_version_history.rs`
- Modify: `src-tauri-shell/src/database/official_source_urls.rs:110-202`
- Modify: `src-tauri-shell/src/database.rs`
- Modify: `src-tauri-shell/src/main.rs:1093-1165`
- Modify: `src/types/desktop.ts`
- Modify: `src/platform/types.ts`
- Modify: `src/platform/tauriDesktop.ts`
- Test: Rust ER4-B authority tests + frontend static contract test

**Interfaces:**
- Add serialization to existing URL struct without changing field semantics:

```rust
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceUrls { ... }
```

- Produce public wire types:

```rust
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceAuthorityEntry {
    pub source_key: String,
    pub exchange: String,
    pub source_id: Option<String>,
    pub source_role: Option<String>,
    pub config_field: String,
    pub candidate_promotion_eligible: bool,
    pub current_version_id: i64,
    pub revision: i64,
    pub current_url: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceConfigurationAuthority {
    pub schema_version: u32,
    pub configuration_fingerprint: String,
    pub urls: OfficialSourceUrls,
    pub sources: Vec<OfficialSourceAuthorityEntry>,
}
```

- Frozen command:

```rust
#[tauri::command]
pub fn get_official_source_configuration_authority(
    app: tauri::AppHandle,
) -> Result<OfficialSourceConfigurationAuthority, String>;
```

- [ ] **Step 1: Write failing ledger-read tests**

Assert:
- exactly nine entries in registry order;
- current URLs reconstructed from current pointers equal mirror JSON;
- configuration fingerprint is deterministic;
- after baseline, `load_official_source_urls(Some(connection))` returns ledger values even if raw mirror is read separately.

- [ ] **Step 2: Implement read model and ledger-preferred loading**

Add a `try_load_official_source_urls_from_ledger(connection) -> Result<Option<OfficialSourceUrls>, String>` helper.

Rules:
- no ER4 current rows → legacy loader remains usable only during migration/bootstrap fixtures;
- exact valid nine-row ledger → use ledger;
- partial/corrupt ledger → fail closed in ER4 command/bootstrap; do not silently fallback.

- [ ] **Step 3: Wire the first ER4 public command**

Re-export in `database.rs`, register in `main.rs`, add TypeScript method:

```ts
getOfficialSourceConfigurationAuthority(): Promise<OfficialSourceConfigurationAuthority>;
```

and Tauri bridge:

```ts
getOfficialSourceConfigurationAuthority: async () =>
  tauriInvoke('get_official_source_configuration_authority'),
```

- [ ] **Step 4: Add static frontend contract test**

Create `src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts` and assert command/type/bridge wiring exists while no candidate promotion command exists yet.

- [ ] **Step 5: Run Rust test, focused Vitest, typecheck**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er4b_ -- --nocapture
npx vitest run src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts
npm run typecheck:renderer
```

Expected: PASS.

---

## Task 6: Route the existing manual source editor through reviewed versioned saves

**Files:**
- Modify: `src-tauri-shell/src/database/official_source_version_history.rs`
- Modify: `src-tauri-shell/src/database/settings.rs:85-92`
- Modify: `src-tauri-shell/src/database.rs`
- Modify: `src-tauri-shell/src/main.rs`
- Modify: `src/types/desktop.ts`
- Modify: `src/platform/types.ts`
- Modify: `src/platform/tauriDesktop.ts`
- Modify: `src/components/DatabaseToolsDialogs.tsx:1547-1564, 2227-2251`
- Modify: `src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts`
- Test: Rust manual-save tests + Vitest contract

**Interfaces:**
- Input:

```rust
#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpectedOfficialSourceRevision {
    pub source_key: String,
    pub revision: i64,
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOfficialSourceUrlsReviewedInput {
    pub expected_configuration_fingerprint: String,
    pub expected_source_revisions: Vec<ExpectedOfficialSourceRevision>,
    pub urls: OfficialSourceUrls,
    pub operator_note: Option<String>,
}
```

- Output:

```rust
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOfficialSourceUrlsReviewedResult {
    pub success: bool,
    pub changed_source_keys: Vec<String>,
    pub authority: OfficialSourceConfigurationAuthority,
}
```

- Command:

```rust
#[tauri::command]
pub fn save_official_source_urls_reviewed(
    app: tauri::AppHandle,
    input: SaveOfficialSourceUrlsReviewedInput,
) -> Result<SaveOfficialSourceUrlsReviewedResult, String>;
```

- [ ] **Step 1: Write failing manual-save tests**

Cover:
- no-op creates no rows/revision increments;
- one-field edit creates one `MANUAL_OVERRIDE`;
- multi-field edit shares one `batch_id`;
- all changed fields commit atomically;
- stale fingerprint/revision returns `ER4_STALE_REJECTED` and zero write;
- no new provenance/network requirement is enforced;
- mirror equals current ledger after commit.

- [ ] **Step 2: Implement reviewed save transaction**

Inside one `BEGIN IMMEDIATE`:
1. read/verify all nine expected revisions + configuration fingerprint;
2. compare normalized proposed URLs to current URLs;
3. for each changed key, insert one immutable version with revision+1;
4. update current pointers;
5. serialize the complete ledger-derived `OfficialSourceUrls`;
6. write compatibility JSON through internal `write_setting_value`;
7. commit;
8. return fresh authority.

- [ ] **Step 3: Block the generic bypass**

In `set_setting`:

```rust
if input.key == super::official_source_urls::OFFICIAL_SOURCE_URLS_SETTING_KEY {
    return Err("OFFICIAL_SOURCE_URLS_REQUIRES_REVIEWED_SAVE".to_string());
}
```

No write occurs.

Do not alter any other key.

- [ ] **Step 4: Migrate existing UI internals without changing visible workflow**

On load:
- call `getOfficialSourceConfigurationAuthority`;
- populate the same nine-field form from `authority.urls`;
- retain `configurationFingerprint` and per-source revisions in component state.

On Apply:
- call `saveOfficialSourceUrlsReviewed`;
- preserve current visible strings:
  - `Saved. Future downloads will use these URLs.`
  - `Official source URLs changed. Run Check Source Health again.`
  - `Official source URLs saved.`
- clear old health report exactly as today.

- [ ] **Step 5: Extend Vitest contract**

Assert:
- current dialog labels/Reset Defaults/Apply URLs remain;
- `api.setSetting` is absent from `saveOfficialSourceUrls`;
- `saveOfficialSourceUrlsReviewed` is present;
- load uses `getOfficialSourceConfigurationAuthority`;
- health report clearing remains.

- [ ] **Step 6: Run ER4-B and preservation validation**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er4b_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline official_source_runtime_provenance_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er1_ -- --nocapture
npx vitest run src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts
npx vitest run src/features/corporateActions/__tests__/corporateActionIdentityOfficialSourceHealth.test.ts
npx vitest run src/features/corporateActions/__tests__/corporateActionIdentityImportCharacterization.test.ts
npm run typecheck:renderer
npm run build:renderer
cargo check --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline
```

Expected: all PASS.

- [ ] **Step 7: Run restart and failure-injection tests**

Use temporary test-owned SQLite databases only. Reopen the DB and assert lineage/current pointers/mirror survive. Inject failure before mirror update and confirm transaction rollback leaves version/current/mirror unchanged.

- [ ] **Step 8: Write ER4-B change record, closeout, evidence, snapshot**

Independently accept ER4-B before ER4-C. **Stop.**

---

# ER4-C — Operator Candidate Review + Durable Non-Mutating Decisions

## Task 7: Expose controlled candidate discovery/validation as a dedicated ER4 command

**Files:**
- Modify: `src-tauri-shell/src/database/official_source_candidate_review.rs`
- Modify: `src-tauri-shell/src/database/official_source_candidate_validation.rs`
- Modify: `src-tauri-shell/src/database.rs`
- Modify: `src-tauri-shell/src/main.rs`
- Modify: frontend type/bridge files
- Test: Rust ER4-C command tests + Vitest contract

**Interfaces:**
- Input:

```rust
pub struct FindOfficialSourceReplacementCandidatesInput {
    pub source_key: String,
    pub trigger_category: String,
}
```

- Output:

```rust
pub struct OfficialSourceReplacementCandidatesResult {
    pub authority: OfficialSourceConfigurationAuthority,
    pub source_key: String,
    pub candidates: Vec<OfficialSourceCandidateReviewPlan>,
    pub discovery_rejection_count: u32,
}
```

- Command:

```rust
#[tauri::command]
pub async fn find_official_source_replacement_candidates(
    app: tauri::AppHandle,
    input: FindOfficialSourceReplacementCandidatesInput,
) -> Result<OfficialSourceReplacementCandidatesResult, String>;
```

- [ ] **Step 1: Write failing eligibility tests**

Healthy/BSE/landing/manual-only source keys reject before network. Only frozen ER3-B trigger categories and five promotable NSE keys reach ER3.

- [ ] **Step 2: Implement orchestration by reuse**

Resolve current authority → map source key to existing ER3 source contract → call ER3-B recovery → convert each result to ER4 review plan.

Do not duplicate host/redirect/parser/budget logic.

- [ ] **Step 3: Wire TypeScript bridge and test static contract**

No promotion command yet.

- [ ] **Step 4: Run offline fixture tests**

Production online behavior is operator-invoked. Automated tests must inject/fake ER3 transport and remain dependency-offline unless a separately approved online checkpoint is run.

---

## Task 8: Add durable Keep Current / Reject Candidate decisions and per-source history reads

**Files:**
- Modify: `src-tauri-shell/src/database/official_source_version_history.rs`
- Modify: `src-tauri-shell/src/database/official_source_candidate_review.rs`
- Modify: command/type/bridge files
- Test: Rust ER4-C decision/history tests

**Interfaces:**
- Freeze:

```rust
pub enum OfficialSourceCandidateDecision {
    KeepCurrent,
    RejectCandidate,
}

pub struct RecordOfficialSourceCandidateDecisionInput {
    pub review: OfficialSourceCandidateReviewPlan,
    pub decision: OfficialSourceCandidateDecision,
    pub operator_note: Option<String>,
}

pub struct OfficialSourceHistoryEntry { /* Design §21 fields */ }
```

Commands:

```rust
record_official_source_candidate_decision
list_official_source_history
```

- [ ] **Step 1: Write failing transaction tests**

Keep Current:
- stale check inside `BEGIN IMMEDIATE`;
- insert one event only;
- no new source version;
- no mirror change.

Reject:
- non-empty trimmed note required;
- same zero-version behavior.

Stale attempt:
- transient `ER4_STALE_REJECTED`;
- zero review event.

- [ ] **Step 2: Implement committed review-event persistence**

Store canonical validation JSON/hash and review fingerprint; never raw body.

- [ ] **Step 3: Implement newest-first per-source history query**

Return immutable source versions joined with relevant decision/post-health evidence.

- [ ] **Step 4: Run ER4-C Rust tests and restart persistence tests**

Expected: decisions/history survive reopen.

---

## Task 9: Add candidate-review and history UI without promotion

**Files:**
- Modify: `src/components/DatabaseToolsDialogs.tsx`
- Modify: `src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts`
- Modify: frontend type/bridge files as needed

**Interfaces:**
- Eligible failed ER1 rows show exact action label:

```text
Find Official Replacement Candidates
```

- Candidate cards/panel show Design §15 fields.
- Exact classification labels must appear.
- Available decisions in ER4-C:

```text
Keep Current URL
Reject Candidate
```

No Approve Replacement button exists yet.

- [ ] **Step 1: Write failing static UI contract tests**

Assert:
- action exists only behind NSE/promotable eligibility logic;
- classification labels exist;
- `Keep Current URL` and `Reject Candidate` exist;
- rejection note input exists;
- `Approve Replacement` does not exist in ER4-C;
- manual Official Source URLs button/dialog remains.

- [ ] **Step 2: Implement minimal candidate/history panel in existing database tooling**

Do not create a top-level app. Keep current health UI and add recovery controls adjacent to the affected source evidence.

- [ ] **Step 3: Preserve stale handling**

On `ER4_STALE_REJECTED`, clear candidate review state and reload configuration authority; do not auto-retry a decision.

- [ ] **Step 4: Run focused Vitest/typecheck/build + Rust preservation**

Include ER1, ER3A/B, I3/I4 preservation filters.

- [ ] **Step 5: Manual checkpoint**

Manually prove:
- manual editor still works;
- eligible failed NSE source shows candidate action;
- healthy/BSE/landing rows do not;
- Keep/Reject create history without URL mutation;
- no promotion affordance exists.

- [ ] **Step 6: ER4-C closeout/evidence/fresh snapshot**

Independently accept before ER4-D. **Stop.**

---

# ER4-D — Explicit Stale-Fenced Candidate Promotion

## Task 10: Add ER3-B direct-candidate revalidation API

**Files:**
- Modify: `src-tauri-shell/src/database/official_source_candidate_validation.rs`
- Modify: `src-tauri-shell/src/database/official_source_candidate_review.rs`
- Test: Rust ER4-D revalidation tests

**Interfaces:**
- Add:

```rust
pub(crate) fn revalidate_nse_candidate_for_er4(
    source_id: &str,
    source_role: &str,
    configured_url: &str,
    landing_page_url: &str,
    candidate_url: &str,
) -> Result<Er3bCandidateValidationResult, String>;
```

It reuses `ReqwestNseEr3bTransport`, `validate_candidate_response`, content limits, provenance, parsers, and population checks.

- [ ] **Step 1: Write fixture-backed revalidation tests**

Assert same candidate produces same hash/report; body/provenance/parser failures remain rejected.

- [ ] **Step 2: Implement by factoring existing ER3-B internals only**

Do not create a second client policy or validator.

- [ ] **Step 3: Run ER3-B regression plus ER4-D tests**

Expected: ER3-B existing behavior unchanged.

---

## Task 11: Implement atomic reviewed promotion

**Files:**
- Modify: `official_source_candidate_review.rs`
- Modify: `official_source_version_history.rs`
- Modify: command/type/bridge files
- Test: Rust ER4-D promotion/failure-injection tests

**Interfaces:**
- Input:

```rust
pub struct PromoteOfficialSourceCandidateReviewedInput {
    pub review: OfficialSourceCandidateReviewPlan,
    pub operator_note: Option<String>,
}
```

- Output:

```rust
pub struct OfficialSourcePromotionResult {
    pub result_status: String,
    pub result_version_id: i64,
    pub authority: OfficialSourceConfigurationAuthority,
    pub post_health_report: Option<OfficialSourceHealthReport>,
}
```

Command:

```text
promote_official_source_candidate_reviewed
```

- [ ] **Step 1: Write failing promotability/stale tests**

Reject:
- discovered/indeterminate/rejected classification;
- changed current revision;
- changed candidate SHA;
- validation report hash mismatch;
- source key outside five promotable contracts.

- [ ] **Step 2: Revalidate remotely before mutation transaction**

Require fresh result:
- same source ID/role;
- same candidate URL;
- official final URL;
- `VALIDATED_CANDIDATE_NOT_PROMOTED`;
- same content SHA;
- same validation-report SHA.

Changed bytes require a new review.

- [ ] **Step 3: Implement one atomic promotion transaction**

Inside `BEGIN IMMEDIATE`:
- recheck base;
- insert approval event;
- insert one `CANDIDATE_PROMOTION` version with revision+1;
- update pointer/revision;
- rebuild full URLs from ledger;
- update compatibility mirror;
- link event/result version;
- result `PROMOTED`;
- commit.

Failure injection at every write boundary must leave zero partial state.

- [ ] **Step 4: Prove I3/I4 are not invoked**

Static/behavioral tests must assert promotion module has no calls to:
`apply_nse_current_universe_sync`, `apply_nse_historical_identity_archive`, or BSE Apply.

---

## Task 12: Add exact-snapshot post-promotion ER1 health and promotion UI

**Files:**
- Modify: `src-tauri-shell/src/database/official_source_health.rs`
- Modify: ER4 backend modules
- Modify: frontend types/bridge/UI/tests

**Interfaces:**
- Refactor without semantic change:

```rust
pub(crate) fn assess_official_source_health_for_urls(
    urls: &OfficialSourceUrls,
) -> Result<OfficialSourceHealthReport, String>;
```

Existing Tauri command loads current URLs then calls this helper.

Promotion path calls this helper with the exact committed `authority.urls`.

- [ ] **Step 1: Write ER1 equivalence test**

For a fixture URL configuration, existing command-internal assessment path and explicit-config helper must produce equivalent mapping semantics.

- [ ] **Step 2: Persist truthful post-health result**

Store configuration fingerprint + full aggregate report.

Affected source healthy → `PROMOTED_HEALTHY`.

Affected source fail/unavailable or health run error → `PROMOTED_HEALTH_CHECK_FAILED`.

Never auto-rollback.

- [ ] **Step 3: Add explicit promotion UI**

Only validated candidate shows:

```text
Approve Replacement
```

Confirmation contains exact warning:

```text
This changes only the configured official source URL.
It does not import data or execute I3/I4 Apply.
```

- [ ] **Step 4: Run ER4-D, ER1, ER3, I3/I4, Vitest, typecheck, build, Cargo check**

All must PASS before closeout.

- [ ] **Step 5: Manual checkpoint**

Prove:
- no unconfirmed promotion;
- stale review fails;
- successful promotion creates one new version;
- manual editor reflects new URL;
- I3/I4 not invoked;
- failed post-health exposes failure without auto-rollback.

- [ ] **Step 6: ER4-D closeout/evidence/fresh snapshot**

Independently accept before ER4-E. **Stop.**

---

# ER4-E — Reviewed Rollback + Final Acceptance

## Task 13: Implement rollback review and target revalidation

**Files:**
- Modify: `official_source_candidate_review.rs`
- Modify: `official_source_version_history.rs`
- Modify: command/type/bridge files
- Test: Rust ER4-E rollback-review tests

**Interfaces:**
- Freeze:

```rust
pub struct OfficialSourceRollbackReview {
    pub schema_version: u32,
    pub source_key: String,
    pub current_version_id: i64,
    pub current_revision: i64,
    pub current_url: String,
    pub target_version_id: i64,
    pub target_url: String,
    pub target_validation_sha256: String,
    pub rollback_fingerprint: String,
}

pub struct CreateOfficialSourceRollbackReviewInput {
    pub source_key: String,
    pub target_version_id: i64,
}
```

Command:

```text
create_official_source_rollback_review
```

- [ ] **Step 1: Write failing target-eligibility tests**

Reject:
- different source key;
- current version selected as target;
- BSE/manual-only/landing source automated rollback;
- target fails provenance;
- target fails ER3-B contract validation.

- [ ] **Step 2: Revalidate selected historical URL through ER3-B direct-candidate validation**

Freeze target content validation SHA and rollback fingerprint. No write.

---

## Task 14: Implement rollback-as-new-version and post-health retry

**Files:**
- Modify: ER4 backend modules
- Modify: `official_source_health.rs`
- Modify: command/type/bridge files
- Test: Rust rollback + pending-health tests

**Interfaces:**
- Commands:

```text
apply_official_source_rollback_reviewed
retry_official_source_post_health
```

- [ ] **Step 1: Write failing rollback transaction tests**

Assert:
- stale revision rejects zero write;
- rollback inserts new `ROLLBACK` version with parent=current;
- old promotion row remains;
- revision increments exactly once;
- mirror updates atomically.

- [ ] **Step 2: Implement reviewed rollback transaction**

Follow Design §22 exactly. Never move pointer directly to old version row.

- [ ] **Step 3: Implement exact-snapshot post-rollback health**

Healthy → `ROLLBACK_HEALTHY`.

Failure → `ROLLBACK_HEALTH_CHECK_FAILED`.

No automatic second rollback.

- [ ] **Step 4: Implement `retry_official_source_post_health`**

Allowed only for committed `PROMOTED`/`ROLLBACK_COMPLETED` or corresponding failed health states. It assesses the event's exact resulting version/current configuration only if the current ledger still matches that event; otherwise return stale and require a fresh current health check.

---

## Task 15: Complete rollback/history UI and full ER4 acceptance

**Files:**
- Modify: `src/components/DatabaseToolsDialogs.tsx`
- Modify: ER4 frontend static test
- Modify: documentation change records/current authority/handoff

**Interfaces:**
- History view shows Design §21 fields.
- Eligible prior NSE version has `Review Rollback`.
- Rollback confirmation is explicit.
- Failed post-health shows `Retry Health Check` and `Review Rollback`; no automatic action.

- [ ] **Step 1: Write failing UI contract tests**

Assert:
- history newest-first display;
- active marker;
- `Review Rollback`;
- `Retry Health Check`;
- manual editor still exists;
- no automatic rollback strings/handlers.

- [ ] **Step 2: Implement minimal history/rollback UI in the existing database tooling surface**

No new top-level app.

- [ ] **Step 3: Run complete backend preservation suite**

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er4a_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er4b_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er4c_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er4d_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er4e_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline official_source_runtime_provenance_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er1_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er2a_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er2b_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er2c1_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er2c2_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er3a_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline er3b_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline i3_reviewed_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline i4_historical_ -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline nse_delisted_workbook_url -- --nocapture
cargo test --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline falls_back_when_nse_delisted_page_has_no_xlsx_url -- --nocapture
```

Expected preservation endpoint on the current authority: the first command covers the five accepted delisted-workbook discovery tests and the second covers the one accepted landing-page fallback test; no failures.

- [ ] **Step 4: Run complete frontend/build validation**

```powershell
npx vitest run src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts
npx vitest run src/features/corporateActions/__tests__/corporateActionIdentityOfficialSourceHealth.test.ts
npx vitest run src/features/corporateActions/__tests__/corporateActionIdentityImportCharacterization.test.ts
npm run typecheck:renderer
npm run build:renderer
cargo check --manifest-path .\src-tauri-shell\Cargo.toml --locked --offline
```

- [ ] **Step 5: Run restart/concurrency/failure-injection suite**

Use only test-owned temporary SQLite files:
- baseline reopen;
- manual version reopen;
- promotion lineage reopen;
- rollback lineage reopen;
- two-writer stale revision;
- injected transaction failures.

- [ ] **Step 6: Run portable Windows validation**

Because ER4-E completes operator UI, run the accepted project portable-build path:

```powershell
npm run tauri:portable:win
```

Record actual output path/hash. Do not copy output into `src` or `src-tauri-shell`.

- [ ] **Step 7: Manual operator checkpoint**

Prove on the portable/current build:
1. existing manual editor remains available;
2. manual save creates `MANUAL_OVERRIDE`;
3. health check still works;
4. eligible failed NSE source can find candidates;
5. Keep Current/Reject do not change URL;
6. only validated candidate can show Approve;
7. promotion requires explicit confirmation;
8. promotion does not run I3/I4;
9. history shows promotion and health result;
10. rollback review revalidates prior target;
11. rollback creates new version;
12. failed versions remain visible;
13. BSE has no automated candidate/rollback controls.

- [ ] **Step 8: Write ER4-E change record and ER4 final authority**

Document all actual validation results, remaining limitations, hashes, manual checkpoint, and rollback guidance.

- [ ] **Step 9: Create and independently accept final Snapshot V3**

ER4 may be declared `CLOSED / CURRENT` only after:
- full requested validation passes;
- manual checkpoint passes;
- final authority docs are installed;
- new self-contained snapshot is independently accepted.

---

# Stage Acceptance Matrix

| Stage | Source mutation class | DB schema/write | UI mutation | Network | Exit authority |
|---|---|---:|---:|---:|---|
| ER4-A | pure/read-only source logic | No application DB | No | No | deterministic review authority only |
| ER4-B | persistence/manual compatibility | Yes | existing manual UI internals | No required network | version ledger/current authority |
| ER4-C | review + non-mutating decisions | review-event writes | candidate/history UI | operator-invoked discovery only | review/history, no promotion |
| ER4-D | candidate promotion | atomic source config write | explicit promotion UI | mandatory revalidation + ER1 health | promotion, no rollback |
| ER4-E | rollback/final acceptance | atomic rollback-as-new-version | rollback/history completion | target revalidation + ER1 health | complete ER4 |

---

# Evidence Checklist Required at Every Stage

For each stage evidence ZIP under `project\tmp`, include:

```text
00-run-authority.json
accepted protected-source manifest
expected post protected-source manifest
package manifest
runner/script hash manifest
RED proof log(s)
focused GREEN log(s)
preservation regression log(s)
typecheck/build logs when stage touches frontend
cargo-check log
installed-files.tsv with path/bytes/SHA256
change record
REPORT.md
SUMMARY.txt
```

For stages with database behavior, include only schema/row-count/hash summaries from **test-owned fixture databases** unless a manual runtime checkpoint explicitly uses a user database. Do not package the user's application database.

For network-enabled manual checkpoints, include aggregate URLs/status/bytes/SHA/classification evidence only; never raw response bodies.

---

# Rollback Rules Per Stage

## ER4-A

Remove the new ER4 review module and module registration; restore any minimal ER3-B constant visibility. No DB rollback.

## ER4-B

Application rollback may restore pre-ER4 UI/code behavior, but do **not** drop or erase ER4 durable history as an ordinary rollback. Preserve ledger evidence. If ER4-B cannot be safely activated, fail closed before baseline or retain an explicit feature-disabled read path with documented schema.

## ER4-C

Remove candidate/history UI and review commands while retaining ER4-B ledger/manual versioning. Durable Keep/Reject evidence remains valid audit history.

## ER4-D

Disable new promotion entry points if necessary while preserving committed source versions/history. Do not erase promotions. Existing manual versioned editor remains the recovery path.

## ER4-E

Disable rollback controls if necessary while preserving all committed versions/events. Never delete failed promotion or rollback history.

---

# Final Completion State

Only after ER4-E final closeout and snapshot acceptance:

```text
ER3    CLOSED / CURRENT
ER4-A  CLOSED / GREEN
ER4-B  CLOSED / GREEN
ER4-C  CLOSED / GREEN
ER4-D  CLOSED / GREEN
ER4-E  CLOSED / GREEN
ER4    CLOSED / CURRENT
ER5+   NOT AUTHORIZED
```

Until then, status is stage-specific and the next stage remains unauthorized unless explicitly approved.
