# Identity ER3-B NSE Controlled Candidate Acquisition & Validation Implementation Plan R1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Git/source-control steps are intentionally omitted because this workstream forbids Git commands for this task.

**Goal:** Add a private, NSE-only, read-only ER3-B layer that maps eligible ER1 failures to ER3-A contracts, acquires trusted landing/candidate bytes within hard limits, validates candidate bytes against frozen source contracts, and emits deterministic non-promoting evidence.

**Architecture:** Keep ER3-A pure and offline. Add `official_source_candidate_validation.rs` for B1 validation contracts and B2 bounded `reqwest::blocking` transport/orchestration. Reuse `validate_nse_official_source_url`, `nse_official_redirect_policy`, ER3-A discovery, and existing NSE byte validators. B3 is an explicitly ignored online characterization test run only by the authorized runner.

**Tech Stack:** Rust 2021; existing `reqwest 0.12` blocking/cookies/rustls; `sha2`; existing NSE parsers; Cargo `--locked`; Windows PowerShell evidence runner.

**Spec:** `docs/superpowers/specs/2026-09-14-identity-er3b-nse-controlled-candidate-acquisition-validation-design-r1.md`

## Global Constraints

- Authority root: `E:\TA Projects\EOD Charting Platform`.
- Self-contained authority: `Eod Charting Platform Source Code 2026-09-14_192551_IST.zip` SHA-256 `85E7CCED0A71B8E3C4C757E1BE018E65A993446AB51DEA2DECBDB250421B9C62`.
- Protected source before ER3-B: 542 exact files.
- NSE only. BSE is excluded.
- No application/user DB access, no settings/archive write, no Tauri/UI/public API, no URL promotion, no persistence, no Git/source-control.
- Reuse existing NSE provenance/redirect and parser authorities; do not duplicate allowlists or parsers.
- Landing body max 4 MiB; candidate max 32 MiB; total candidate bytes max 64 MiB; max 5 deterministic candidate fetches; timeout 45 s; no retries.
- Routine evidence must be under `E:\TA Projects\EOD Charting Platform\tmp`; Source Audit remains snapshot-only.
- ER3-B3 online verification is read-only GET-only and requires explicit environment authorization set by the runner.

---

### Task 1: ER3-A contract visibility refactor + ER3-B1 offline contracts

**Files:**
- Modify: `src-tauri-shell/src/database/official_source_discovery.rs`
- Create: `src-tauri-shell/src/database/official_source_candidate_validation.rs`
- Modify: `src-tauri-shell/src/database.rs`

**Interfaces:**
- `NseDiscoveryContract::from_source_id(source_id: &str) -> Result<NseDiscoveryContract, String>`
- `NseDiscoveryContract::source_id(self) -> &'static str`
- `NseDiscoveryContract::source_role(self) -> &'static str`
- `map_er1_source_to_er3_contract(er1_source_id: &str) -> Result<Er3bMappedSource, String>`
- `validate_candidate_response(...) -> Er3bCandidateValidationResult`

- [ ] Add RED tests `er3b_b1_*` proving exact ER1→ER3 mapping, BSE/unknown rejection, trigger fail-closed behavior, content-type handling, source-specific parser/population behavior, deterministic SHA, no raw body in report, and no approval/promotion state.
- [ ] Run `cargo test --manifest-path src-tauri-shell/Cargo.toml --locked --offline er3b_b1_ -- --nocapture --test-threads=1`; expected RED is missing ER3-B contracts/functions.
- [ ] Refactor ER3-A contract enum so source-ID/role metadata is sibling-visible without changing discovery behavior.
- [ ] Implement ER3-B request/classification/report contracts and pure fixture-response validation using existing NSE validators.
- [ ] Require `VALIDATED_CANDIDATE_NOT_PROMOTED`, `INDETERMINATE_CANDIDATE`, or `REJECTED_CANDIDATE` only; never expose raw response bytes.
- [ ] Run focused `er3b_b1_` tests; require GREEN.
- [ ] Run `er3a_` tests; require all existing ER3-A tests GREEN.

### Task 2: ER3-B2 bounded transport and orchestration

**Files:**
- Modify: `src-tauri-shell/src/database/official_source_candidate_validation.rs`

**Interfaces:**
- Private trait `Er3bTransport` with bounded `get(...)` contract.
- Production `ReqwestNseEr3bTransport` using existing NSE redirect policy.
- `validate_nse_candidate_recovery_with_transport<T: Er3bTransport>(...)` for deterministic fixture testing.
- `validate_nse_candidate_recovery(...)` for private production transport.

- [ ] Add RED tests `er3b_b2_*` proving declared and streamed body limits, total-run byte budget, candidate cap/order, redirect/provenance failure handling through injected fixtures, transport failure classification, HTML hard rejection, and deterministic fixture ordering.
- [ ] Run focused `er3b_b2_`; expected RED is missing transport/orchestrator behavior.
- [ ] Implement bounded-body helpers: reject declared size over limit; read at most `limit + 1`; fail if overflow.
- [ ] Implement NSE blocking client with 45 s timeout, cookies, existing redirect policy, GET-only, user-agent/referer/accept headers, final-URL provenance validation.
- [ ] Implement recovery orchestration: validate trigger/mapping/configured/landing authority; fetch landing <=4 MiB; call ER3-A; fetch first 5 candidates using `min(32 MiB, remaining 64 MiB)`; validate and report each result; perform no write.
- [ ] Run focused `er3b_b2_`; require GREEN.
- [ ] Re-run `er3b_b1_` and `er3a_`; require GREEN.

### Task 3: ER3-B3 controlled online verification gate

**Files:**
- Modify: `src-tauri-shell/src/database/official_source_candidate_validation.rs` tests only.

**Interfaces:**
- Ignored test `er3b_online_nse_equity_characterization_requires_explicit_authorization`.
- Environment flag `EOD_ER3B_ONLINE_VERIFY=1` is mandatory.

- [ ] Add ignored online test that fails closed unless `EOD_ER3B_ONLINE_VERIFY=1`.
- [ ] With authorization absent, run only that ignored test and require failure containing `ER3B_ONLINE_AUTHORIZATION_REQUIRED`.
- [ ] With authorization enabled, use production transport to GET the frozen NSE securities landing page and current equity master; validate official final URL, size bounds, non-HTML content, parser, >=1000 population and deterministic SHA; print aggregate-only `ER3B_ONLINE_VERIFICATION_JSON=...`; do not expose body bytes.
- [ ] Run with `cargo test --locked --offline er3b_online_ -- --ignored --nocapture --test-threads=1`; Cargo remains dependency-offline while the test performs the explicitly authorized NSE GETs.

### Task 4: Preservation regressions and typecheck

**Files:** no source edits expected.

- [ ] Run `official_source_runtime_provenance_`.
- [ ] Run `er1_`.
- [ ] Run `er3a_`.
- [ ] Run NSE delisted discovery/fallback filters.
- [ ] Run `i3_reviewed_`, `i4_historical_`, `er2a_`, `er2b_`, `er2c1_`, `er2c2_`.
- [ ] Run `cargo check --manifest-path src-tauri-shell/Cargo.toml --locked --offline`.
- [ ] Require configured official URL authority files/hashes and ER3-A authority/handoff hashes unchanged.

### Task 5: Documentation, post-source authority, and closeout evidence package

**Files:**
- Create: `docs/changes/2026-09-14_<HHMM>_IST_IDENTITY_ER3B_NSE_CONTROLLED_CANDIDATE_ACQUISITION_VALIDATION.md`
- Preserve Design R1 and this plan.

- [ ] Record exact source/docs delta, B1/B2/B3 actual validation results, preservation, risks, rollback, evidence hashes, and online verification summary.
- [ ] Generate expected protected-source manifest after source changes and require exact postflight.
- [ ] Create a fail-closed Windows PowerShell runner with separate `if` blocks only. It must stage RED/GREEN variants under project `tmp`, run B1 then regressions, B2 then regressions, B3 explicit online gate, then install only after all validation succeeds.
- [ ] Runner must perform no Git/source-control or application/user DB operation and must write routine evidence only under project `tmp`.
- [ ] Deliver exactly the full implementation package ZIP and standalone runner `.ps1`.
