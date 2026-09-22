# Rust Warning Hygiene W1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the currently reproducible Rust warnings from the V1.9.2 historical-ISIN bootstrap seam and NSE identity test build without changing Corporate Action, database, or NSE identity behavior.

**Architecture:** Keep audited CSV parsing and all live revalidation gates unchanged. Shrink only post-validation internal structs to the fields actually consumed, remove two unnecessary `mut` bindings, and make NSE delisted-workbook URL helper usage explicit in tests. Do not suppress warnings with broad `allow` attributes and do not delete production helper functions.

**Tech Stack:** Rust, rusqlite, serde/csv, existing Tauri shell unit tests, PowerShell validation wrapper.

## Global Constraints

- Fresh source basis: `Eod Charting Platform Source Code 2026-08-16_164529_IST`.
- No database open or mutation from the apply wrapper.
- No Corporate Action approval/recheck/bootstrap execution.
- No renderer/Vite chunk work in W1.1.
- Preserve all V1.9.2.3 reporting recovery behavior.
- Preserve NSE production delisted-workbook discovery/download behavior.
- Do not use broad `#[allow(dead_code)]` or `#[allow(unused)]` suppression.

---

### Task 1: Historical-ISIN bootstrap warning hygiene

**Files:**
- Modify: `src-tauri-shell/src/database/corporate_action_imports/historical_isin_bootstrap.rs`
- Test: existing `historical_isin_bootstrap::tests`

**Interfaces:**
- Consumes: `HistoricalIsinBootstrapCandidateCsvRow`, `revalidate_historical_isin_bootstrap_candidate`, tuple-plan builder.
- Produces: warning-clean internal candidate/live-evidence structs with unchanged fingerprint, validation, tuple, Apply, and report behavior.

- [ ] Remove only `company_name`, `destination_company_name`, `price_validation_label`, and `price_confidence_pct` from `HistoricalIsinBootstrapCandidate`; retain the CSV fields and explicitly consume the two price-audit columns after candidate shape validation so the input contract remains represented without affecting acceptance.
- [ ] Remove only `import_row`, `destination`, `relevant_history_rows`, and `exact_date_history_rows` from `HistoricalIsinBootstrapLiveEvidence`; keep those values local to revalidation where all existing gates and fingerprint computation still use them.
- [ ] Update the two unit-test fixture constructors to the reduced structs.
- [ ] Change `let mut imports_already_applied = 0usize` to immutable because W1.9.2 Apply rejects already-applied candidates before entering mutation.
- [ ] Change the rollback-test SQLite `connection` binding to immutable.
- [ ] Run the focused historical-ISIN tests and verify no W1.9.2 warnings remain.

### Task 2: NSE identity test-build warning hygiene

**Files:**
- Modify: `src-tauri-shell/src/database/nse_identity_imports.rs`
- Test: `nse_identity_imports::tests`

**Interfaces:**
- Consumes: existing `discover_nse_delisted_workbook_url`, `find_xlsx_url`, and `percent_decode` production helpers.
- Produces: tests that exercise the real production URL discovery helper chain and preserve fallback semantics.

- [ ] In the `#[cfg(test)]` branch of `load_nse_official_delisted_symbols`, explicitly consume `urls` before returning the network-free empty set.
- [ ] Add a unit test with a percent-encoded NSE `.xlsx` URL and assert decoded workbook discovery.
- [ ] Add a fallback unit test with no `.xlsx` link and assert the configured fallback URL is returned.
- [ ] Run the focused NSE identity helper tests and verify the prior `urls`/dead-helper warnings are absent.

### Task 3: Guarded package and Windows validation

**Files:**
- Create: `docs/changes/2026-08-16_RUST_WARNING_HYGIENE_W1_1.md`
- Create package wrapper and payload manifest outside active source tree.

**Interfaces:**
- Consumes: exact fresh-snapshot SHA-256 values for the two Rust source files.
- Produces: source-only guarded apply package with focused Rust validation and `npm run tauri:check`.

- [ ] Build an exact-hash guarded source-only package.
- [ ] Verify the wrapper contains no DB path, Preview, Apply-bootstrap, or SQLite execution.
- [ ] Run package contract checks locally.
- [ ] On Windows, run focused bootstrap tests, focused NSE helper tests, then `npm run tauri:check` serially.
- [ ] Confirm the relevant Rust warning set is zero before moving to W1.2.
