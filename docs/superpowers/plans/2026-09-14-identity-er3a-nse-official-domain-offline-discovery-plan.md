# Identity ER3-A NSE Offline Discovery Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with TDD. Git/source-control commands are intentionally omitted because this workstream explicitly forbids them for this task.

**Goal:** Build an NSE-only deterministic offline official-domain candidate-discovery kernel that produces non-authoritative candidate/rejection diagnostics without network, database, UI, persistence, or URL promotion.

**Architecture:** Add one private `official_source_discovery` Rust module under the existing database layer and register it privately from `database.rs`. The module accepts caller-supplied trusted landing-page text, resolves links with `reqwest::Url`, reuses the existing NSE provenance validator, applies source-specific semantic matching, and returns bounded deterministic discovery diagnostics.

**Tech Stack:** Rust 2021, existing `reqwest::Url`, existing database module structure, Cargo offline/locked validation.

**Spec:** `docs/superpowers/specs/2026-09-14-identity-er3a-nse-official-domain-offline-discovery-design.md`

## Global Constraints

- Authority root: `E:\TA Projects\EOD Charting Platform`.
- Source authority: `Eod Charting Platform Source Code 2026-09-14_120113_IST.zip`, SHA-256 `1E7D048C0F251873A0823DEAED9F4567373C9CC41FF95DD0ECF6DFD58CBAEEF8`.
- No network, application/user DB access, Git/source-control, Tauri/UI exposure, persistence, URL promotion, BSE integration, ER3-B/C, ER4+, or deferred concurrency repair. Existing regression tests may use isolated test-owned in-memory/temp SQLite fixtures only.
- No new dependency.
- Reuse `validate_nse_official_source_url`; do not duplicate the official host allowlist.
- Preserve I3/I4/ER1/ER2-A/B/C1/C2 and current delisted-workbook behavior.
- Task evidence path on the real project: `E:\TA Projects\EOD Charting Platform\tmp`.

---

### Task 1: Freeze ER3-A API and RED contract tests

**Files:**
- Create: `src-tauri-shell/src/database/official_source_discovery.rs`
- Modify: `src-tauri-shell/src/database.rs`

**Interfaces:**
- Produce `discover_nse_official_source_candidates(request: &NseOfficialSourceDiscoveryRequest) -> Result<NseOfficialSourceDiscoveryReport, String>`.
- Produce request/report/candidate/rejection structs scoped `pub(crate)` for later ER3-B reuse.
- No public re-export from `database.rs`.

- [ ] Add `mod official_source_discovery;` next to existing official-source modules.
- [ ] Write focused tests named `er3a_*` covering the 14 required behaviors in the approved spec.
- [ ] In a sandbox copy under project `tmp`, run `cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er3a_ -- --nocapture` and capture the expected RED result showing the discovery implementation is not yet present/functional. Do not put the real project into a temporary RED state.

### Task 2: Implement minimal offline discovery kernel

**Files:**
- Modify: `src-tauri-shell/src/database/official_source_discovery.rs`

**Interfaces:**
- Consume `super::official_source_urls::validate_nse_official_source_url`.
- Use `reqwest::Url` only; add no crate.
- Return authority marker `DISCOVERED_NOT_PROMOTED` for every accepted candidate.

- [ ] Add request validation for supported source IDs, configured URL, and landing-page URL.
- [ ] Add bounded case-insensitive `href` extraction supporting quoted/unquoted values and minimal HTML entity decoding required for URL query strings.
- [ ] Resolve relative links through the validated landing-page `Url`.
- [ ] Remove URL fragments, enforce existing NSE provenance validation, reject configured/self URL, and record ordinary candidate failures instead of throwing.
- [ ] Add source-specific semantic scoring for equity master, SME master, symbol-change history, name-change history, and actual-delisted workbook.
- [ ] De-duplicate candidates, order by semantic score then URL, cap accepted candidates at 25, de-duplicate/order rejections and cap them at 50.
- [ ] Run the focused `er3a_` test filter and require GREEN.

### Task 3: Run preservation regressions

**Files:** no source edits expected.

- [ ] Run `cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline official_source_runtime_provenance_ -- --nocapture`.
- [ ] Run `cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er1_ -- --nocapture`.
- [ ] Run the existing NSE delisted discovery test names: `discovers_percent_encoded_nse_delisted_workbook_url`, `nse_delisted_workbook_url_prefers_actual_delisted_over_proposed`, `nse_delisted_workbook_url_falls_back_when_only_proposed_exists`, `nse_delisted_workbook_url_uses_anchor_text_for_opaque_actual_link`, `nse_delisted_workbook_url_skips_processing_status_before_actual_delisted`, and `falls_back_when_nse_delisted_page_has_no_xlsx_url`.
- [ ] Run `cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline i3_reviewed_ -- --nocapture`.
- [ ] Run `cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline i4_historical_ -- --nocapture`.
- [ ] Run `cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2a_ -- --nocapture`.
- [ ] Run `cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2b_ -- --nocapture`.
- [ ] Run `cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c1_ -- --nocapture`.
- [ ] Run `cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er2c2_ -- --nocapture`.
- [ ] Run `cargo check --manifest-path src-tauri-shell/Cargo.toml --locked --offline`.

### Task 4: Documentation, evidence, and package

**Files:**
- Create: `docs/changes/2026-09-14_<HHMM>_IST_IDENTITY_ER3A_NSE_OFFICIAL_DOMAIN_OFFLINE_DISCOVERY.md`
- Preserve the approved design and this plan.

- [ ] Record exact files inspected/created/modified, previous limitation, final implementation, preservation, validation commands and actual outputs, risks/limitations, rollback, and relevant hashes.
- [ ] Create a fail-closed Windows PowerShell installer/validator using guard clauses and separate `if` blocks only. It must verify the `120113` protected source authority before applying the bounded ER3-A payload, write routine evidence only to `E:\TA Projects\EOD Charting Platform\tmp`, and perform no Git/DB/network operations.
- [ ] Parse the runner with Windows PowerShell on the user's machine before execution; do not claim parser PASS in an environment without Windows PowerShell.
- [ ] Deliver exactly the implementation package ZIP and standalone runner `.ps1`.
