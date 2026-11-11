# EOD Charting Platform — Comprehensive Corporate Actions Deep Audit Report

**Audit Date:** 2026-11-11 IST  
**Authorized Root:** `E:\TA Projects\EOD Charting Platform`  
**Repository:** `https://github.com/dhamnaik-lab/Eod-Charting-Platform`  
**Local Branch / HEAD:** `main` @ `fc3563be9bf6bf7f8ebbee2ea8eb5a490df9471e` (matches `origin/main` and `origin/HEAD`; includes PR #75 `9d5f64d` and PR #100 `fc3563b`)  
**Audit Mode:** Strictly Read-Only (`Files Changed = NONE`, `Production DB Access = 0`)

---

## A. Executive Summary

### Overall Production Readiness Verdict
**PARTIALLY READY — SAFE FOR NSE/BSE SPLIT, BONUS, AND IDENTITY MAINTENANCE; NOT READY FOR NORMAL-WORKFLOW DIVIDEND OR RIGHTS APPROVAL UNTIL P1 WORKFLOW GATING & POST-APPROVAL REFRESH DEFECTS (`CA-AUD-001`, `CA-AUD-002`) ARE RESOLVED.**

- **Financial & Raw-EOD Preservation Verdict (`PASS`):**
  - Raw `.eod` binary files and `eod_prices` SQLite rows are **100% immutable** across all Corporate Actions preparation, approval, reconciliation, and identity operations. All price and volume adjustments are applied dynamically at chart-read time (`apply_corporate_adjustments` in `src-tauri-shell/src/database/eod_data.rs:818-949`).
  - Automatic financial approval during `Fetch from Officials` or `Load & Validate` is **disabled and unreachable** in the normal workflow (`DEFAULT_AUTO_APPROVE_SAFE_SPLIT_BONUS_R1 = false`, `readAutoApproveSafeSplitBonusR1Setting()` hardcoded to `false` in `corporateActionAutoApprovalSettings.ts:13-20`).
  - Every write path revalidates database folder identity (`resolve_reviewed_corporate_action_database`), identity proof (`identity_recheck::machine_identity_is_unproven`), EOD bar freshness (`ensure_scan_uses_current_price_window`), and compound Split+Bonus fingerprints (`ensure_compound_scan_fingerprint_current`) inside SQLite transactions (`BEGIN IMMEDIATE`).
- **Key Operational Blockers Uncovered (`3 P1 High`, `5 P2 Medium`, `2 P3 Low`, `0 P0 Critical`):**
  1. **`CA-AUD-001` (P1 High):** `DatabaseToolsDialogs.tsx:3224` passes `immediateCorporateActionValidationRows(result.rows)` (which filters out `DIVIDEND` via `isLaterCorporateAction`) into `buildCorporateActionDividendPreparedScope`. Consequently, `preparedScope.scope.importIds` is always `[]` during `Load & Validate` (starving Dividend readiness), **and** when a user approves any Split/Bonus row in a database that also has a pending parsed Dividend row, `refreshCorporateActionQueueAfterApproval` (`corporateActionPostApprovalRefresh.ts:83-114`) evaluates unfiltered `rows` and throws `Error('Remaining Dividend evidence is incomplete. Load & Validate again.')`, failing post-approval queue reconciliation.
  2. **`CA-AUD-002` (P1 High):** `RIGHTS` rows have contradictory readiness and scan rules across layers: `prepareCorporateActionPendingImports` omits `RIGHTS` from EOD scanning (leaving them labeled `'WAITING FOR EOD DATA'`), Classic view forces `ready = false` (`'Rights: adjustment rules not built yet'`), and Advanced view (`isOfficialRowReady` at `DatabaseToolsDialogs.tsx:4021`) omits `!isLaterCorporateAction(row)`, marking `RIGHTS` Ready if scanned via `runOfficialScan` or post-approval refresh.
  3. **`CA-AUD-003` (P1 High):** `vitest.config.ts:8-22` excludes `**/backups/**`, `**/dist/**`, etc., but **omits `'**/tmp/**'`**. Running `npm run test` or unscoped `npx vitest run src/features/corporateActions` traverses archived candidate worktrees inside `tmp/`, executing 641 files and failing 26 snapshot files (92.32s). When scoped to `--dir src`, **all 257 active test files (1,783 tests, including all 73 Corporate Actions test files / 571 tests) pass with 0 failures**.

---

## B. End-to-End Architecture Map

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                  RENDERER (React / TS)                                   │
│  Active Host: src/components/DatabaseToolsDialogs.tsx (CorporateActionDialog)            │
│  ├─ Classic View: src/features/corporateActions/workspace/CorporateActionClassicWorkspace │
│  ├─ Advanced Tabs: Pending | Approved | Fetch | History | Scan | Issues | Manual | ID    │
│  └─ Orchestrator: src/features/corporateActions/legacy/corporateActionImportOperations.ts│
│     (Note: CorporateActionNormalWorkflowWorkspace.tsx is an UNMOUNTED retired donor)     │
└───────────────────────────────────────────┬──────────────────────────────────────────────┘
                                            │ Tauri IPC (src/platform/desktop.ts)
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              RUST BACKEND (src-tauri-shell)                              │
│  1. Fetch & CSV Import (corporate_action_imports.rs, bse_fetch.rs, bse_browser.rs)       │
│     ├─ NSE HTTP session + symbolchange.csv cache (dated_symbol_chain.rs)                 │
│     ├─ BSE 7-day bounded windows: HTTP -> isolated WebView2 fallback + SHA-256 capture   │
│     ├─ BSE missing security-code backfill (bse_identity_mapping.rs)                      │
│     └─ Purpose parser + deduplication + witness retention (SAVEPOINT per candidate)      │
│  2. Load & Validate / Prepare (classification_refresh.rs, split_bonus_preparation.rs)    │
│     ├─ Block unsafe Split/Bonus terms (split_bonus_terms.rs)                             │
│     ├─ Recheck unproven machine identities (identity_recheck.rs)                         │
│     ├─ Expand combined Split+Bonus into pending component rows (CA_COMPONENT_V1)         │
│     ├─ Verified auto quick-resolve (exact date ISIN / V1.14E / dated symbol chain)       │
│     ├─ Targeted EOD scan (run_corporate_action_scan_internal + event_price_route.rs)     │
│     └─ Dividend R1 read-only prepared-scope cache (dividend_validation_cache.rs)         │
│  3. Explicit Approval & Persistence (corporate_action_imports.rs, instrument_mutations)  │
│     ├─ Split/Bonus/Rights approval: rechecks folder, identity, scan freshness, compound  │
│     ├─ Dividend R1 write stage: outer BEGIN IMMEDIATE + policy recheck + post-verify     │
│     ├─ Canonical table: corporate_actions + instrument_isin_history + decision audit     │
│     └─ Broadcasts database:changed -> chartRuntimeController bumps chartRefreshRevision  │
│  4. Read-Time Chart Adjustment Engine (eod_data.rs: apply_corporate_adjustments)         │
│     └─ Reads immutable .eod / eod_prices + corporate_actions -> adjusts pre-ex OHLCV     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## C. Corporate Action Coverage Matrix

| Corporate Action Type | NSE Support | BSE Support | Official Evidence Required | Parsing Rules (`parse_corporate_action_purpose`) | Adjustment Formula (`instrument_mutations.rs` / `eod_data.rs`) | Normal Workflow Readiness | Approval & Persistence Path | Chart Behavior (`apply_corporate_adjustments`) |
|---|---|---|---|---|---|---|---|---|
| **Split (`SPLIT`)** | Yes (`NSE_API`, `NSE_CSV`) | Yes (`BSE_API`, `BSE_CSV`) | `purpose_raw`, `ex_date`, symbol/code + ISIN, local EOD bars straddling `ex_date` | Explicit face-value context (`old_fv -> new_fv`) or unambiguous ratio without extra numbers; blocked by `split_bonus_terms::blocker` if incomplete | `factor = old_fv / new_fv` (or `ratio_num / ratio_den`). Pre-ex OHLC `/ factor`, volume `* factor` (`adjust_volume = 1`) | **Active & Ready** when scan is `MATCHED` (confidence `>= 0.85`) and identity is proven | `approve_corporate_action_imports` (or `approve_corporate_action_import_with_price_validation_exception` for `REVIEW`) | Always applied when `adjustCorporateActions = true` |
| **Consolidation / Reverse Split (`SPLIT`, `factor < 1`)** | Yes | Yes | Same as Split | `Consolidation` / `Reverse Split` with `old_fv < new_fv` or ratio `num < den` (`factor < 1.0`) | `factor = old_fv / new_fv < 1.0`. Pre-ex OHLC `/ factor` (increases pre-ex price), volume `* factor` | **Active & Ready** when scan `MATCHED` (Note: `split_bonus_preparation` requires `factor > 1.0` for combined Split+Bonus expansion) | Same as Split | Always applied when `adjustCorporateActions = true` |
| **Combined Split + Bonus** | Yes | Yes | Retained source evidence (`evidence_count > 0`) on primary row | Initially `NEEDS_REVIEW`; `classification_refresh` expands into 2 pending rows (`SPLIT` + `BONUS`) via `split_bonus_preparation::prepare_companion` | Scanner validates combined factor `F_split * F_bonus` with `CA_COMPOUND_V1` fingerprint; approved into two canonical `corporate_actions` rows | **Active & Ready** after `Load & Validate` prepares both components and compound scan matches | Approved together or sequentially; backend verifies `ensure_compound_scan_fingerprint_current` | Both factors multiply cumulatively for bars `< ex_date` |
| **Bonus (`BONUS`)** | Yes (`NSE_API`, `NSE_CSV`) | Yes (`BSE_API`, `BSE_CSV`) | `purpose_raw`, `ex_date`, symbol/code + ISIN, local EOD bars straddling `ex_date` | `Bonus` ratio `A : B` (`new_shares = A`, `existing_shares = B`); rejects face-value-only strings | `factor = (existing + new) / existing = (B + A) / B`. Pre-ex OHLC `/ factor`, volume `* factor` (`adjust_volume = 1`) | **Active & Ready** when scan is `MATCHED` (`confidence >= 0.85`) and identity is proven | `approve_corporate_action_imports` | Always applied when `adjustCorporateActions = true` |
| **Cash Dividend (`DIVIDEND`)** | Backend R1 supports `NSE_API` simple per-share cash; UI currently defers (`CA-AUD-001`) | Manual / Advanced single approval only (R1 write stage is NSE-only) | `purpose_raw` with explicit per-share `Rs. X`, `ex_date`, local cum-close within 7 calendar days (`< ex_date`) and post-ex bar (`>= ex_date`) | Sums explicit multi-dividend segments; blocks `%`-only dividends and inclusive/ambiguous totals (`NEEDS_REVIEW`) | `factor = prev_close / (prev_close - cash_amount)` where `0 < cash_amount < prev_close`. Same-day dividends sum `1 - 1/factor`. `adjust_volume = 0` | **Blocked in Normal UI (`CA-AUD-001`)** because `isLaterCorporateAction` filters out `DIVIDEND` before `buildCorporateActionDividendPreparedScope` | Backend supports `execute_simple_cash_dividend_write_stage` (R1) and single `approve_corporate_action_import` | Gated by `includeDividendAdjustments` (**default `false`** in `chartStore.ts:369`, see `CA-AUD-006`) |
| **REIT / InvIT Distribution (`DIVIDEND`)** | Parsed | Parsed | Headline per-unit distribution or complete labelled components (`Interest` / `Dividend` / `Amortisation` / `Other`) | `parse_unit_distribution_action` extracts headline or sum of labelled components | Stored as `DIVIDEND`, but `simple_cash_dividend_evidence.rs` classifies as `InvitReitDistribution` (excluded from R1 write stage) | Deferred as `Later` (`isUnitDistributionTerms` -> `'InvIT/REIT distribution: tax-component rules not built yet'`) | Single manual/exception approval only | Gated by `includeDividendAdjustments` (default `false`) |
| **Rights Issue (`RIGHTS`)** | Parsed & Backend TERP implemented | Parsed & Backend TERP implemented | Explicit ratio (`A : B`) **and** explicit issue price (`@ Rs P`), plus local cum-close (`< ex_date`) | `extract_ratio_pair` + `extract_rights_issue_price`; if issue price missing, `parse_status = "NEEDS_REVIEW"` | `terp = (existing * prev_close + new * issue_price) / (existing + new)`; `factor = prev_close / terp` (`> 1.0` when `issue_price < prev_close`). `adjust_volume = 0` | **Inconsistent (`CA-AUD-002`)**: Deferred in Classic (`'Rights: adjustment rules not built yet'`), omitted from `Load & Validate` scan, but selectable in Advanced if scanned | Single/bulk `approve_corporate_action_import` calls `compute_rights_adjustment_factor` | Gated by `includeRightsAdjustments` (**default `false`** in `chartStore.ts:370`, see `CA-AUD-006`) |
| **Demerger (`DEMERGER`)** | Classified only | Classified only | Cost-allocation ratio evidence (not present in NSE/BSE headline strings) | `parse_corporate_action_purpose` and `classification_refresh` set `action_type = "DEMERGER"`, `parse_status = "NEEDS_REVIEW"`, `review_status = "UNSUPPORTED"`, `factor = None` | Manual entry with explicit `factor` only | Deferred as `Later` (`'Demerger: cost-split rules not built yet'`); blocked from official import approval | Cannot be approved from official imports (`Unsupported corporate action type for approval: DEMERGER`) | Always applied if manually inserted into `corporate_actions` (`"SPLIT" \| "BONUS" \| "DEMERGER" => true`) |
| **Symbol / Name Change (`SYMBOL_CHANGE`, `NAME_CHANGE`, `BOTH`)** | Yes (NSE Identity Archive & Symbol Change CSV) | Yes (BSE Master Sync & Name History) | Official NSE `symbolchange.csv` / `namechange.csv` / `EQUITY_L.csv` or BSE Scrip Master + Name History | Preview/Apply plans with SHA-256 plan lock (`expected_plan_sha256`) | No price factor; records `instrument_identity_history`, updates `instruments.is_active`, links `related_symbols` & `symbol_transitions` | Managed in **Identity** tab (`preview_nse_*` / `apply_nse_*`, `preview_bse_*` / `apply_bse_*`) and Manual tab | Transactional apply with progress events and audit history | `load_unified_price_rows` stitches historical bars across `symbol_transitions` without duplicate dates |
| **ISIN Change / Historical ISIN Drift** | Yes | Yes | Exact-date `instrument_isin_history`, V1.14E authority (184 events / 44 chains), or V1.92 historical ISIN bootstrap | Flagged as `PENDING_ISIN_MISMATCH` during import resolution unless exact-date ISIN history matches | No price factor; resolves event-time identity so Split/Bonus/Dividend can be validated and applied to the right instrument | Verified mismatches auto-promote during `Load & Validate` (`quick_resolve_corporate_action_import`); unproven mismatches require manual/recommended exception with audit reason | `approve_corporate_action_import_with_isin_mismatch` or `approve_recommended_corporate_action_isin_mismatches` | `load_corporate_actions` unions actions by alias symbols and historical ISINs accurately |

---

## D. Findings Register Summary

Full 11-field entries for every finding are documented in [`07_FINDINGS_REGISTER.md`](./07_FINDINGS_REGISTER.md).

| ID | Severity | Stage | Title | Key File & Line |
|---|---|---|---|---|
| `CA-AUD-001` | **P1 High** | `Load & Validate / Post-Approval Refresh` | `immediateCorporateActionValidationRows` filters out all `DIVIDEND` rows before `buildCorporateActionDividendPreparedScope` during `Load & Validate`, starving Dividend readiness and causing `refreshCorporateActionQueueAfterApproval` to throw `'Remaining Dividend evidence is incomplete. Load & Validate again.'` after any Split/Bonus approval when a pending Dividend exists in the queue | `src/components/DatabaseToolsDialogs.tsx:3224`, `src/features/corporateActions/legacy/corporateActionPostApprovalRefresh.ts:83-114` |
| `CA-AUD-002` | **P1 High** | `Load & Validate / Review / Approve` | Classic vs. Advanced readiness and scan targeting asymmetry for `RIGHTS` (`isOfficialRowReady` omits `!isLaterCorporateAction(row)`, while `prepareCorporateActionPendingImports` omits `RIGHTS` from EOD scans) | `src/components/DatabaseToolsDialogs.tsx:4013-4029, 6026`, `src/features/corporateActions/legacy/corporateActionImportOperations.ts:309` |
| `CA-AUD-003` | **P1 High** | `Test & Validation` | Unscoped `npm run test` (`vitest run`) traverses `tmp/` and `backups/`, running 641 files and failing 26 archived snapshot test files (34 tests), whereas `vitest run --dir src` passes 257/257 active files (1,783/1,783 tests) | `package.json:13`, `scripts/validate-change.ps1:46` |
| `CA-AUD-004` | **P2 Medium** | `Dividend R1 Policy` | `evaluate_simple_cash_dividend_policy_with_peer_cache` uses `chrono::Local::now().date_naive()` instead of pinned IST (`FixedOffset +05:30`) used by `dividend_validation_cache` and `ensure_official_import_eod_ready` | `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs:956` |
| `CA-AUD-005` | **P2 Medium** | `Manual Entry / Persist` | Manual `apply_corporate_action` lacks `ensure_official_import_eod_ready`, searches back to `1900-01-01` for previous close without a 7-day staleness bound, and checks factor equivalence only for `SPLIT`/`BONUS` | `src-tauri-shell/src/database/instrument_mutations.rs:495-642, 1742` |
| `CA-AUD-006` | **P2 Medium** | `Chart Refresh / UX` | `chartStore.ts` defaults `includeDividendAdjustments` and `includeRightsAdjustments` to `false` without informing the operator in the Corporate Actions UI after Dividend/Rights approval | `src/store/chartStore.ts:369-370`, `src-tauri-shell/src/database/eod_data.rs:899-900` |
| `CA-AUD-007` | **P2 Medium** | `Fetch / CSV Import` | Per-row savepoints run in SQLite autocommit mode during `import_corporate_actions_csv_internal` and `fetch_official_corporate_actions_with_session`, and BSE vs. NSE handle partial window row errors (`range_errors > 0`) asymmetrically | `src-tauri-shell/src/database/corporate_action_imports.rs:1354-1445, 1663-1675`, `bse_fetch.rs:110-120` |
| `CA-AUD-008` | **P2 Medium** | `Maintainability` | Retired donor component `CorporateActionNormalWorkflowWorkspace.tsx` and unused `runNormalWorkflow*` adapter runners remain in active `src/features/corporateActions/` tree | `src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx:1-553` |
| `CA-AUD-009` | **P3 Low** | `Test Quality` | Over 40 Corporate Actions tests rely on brittle `readFileSync` / `include_str!` substring/regex checks (including `corporateActionThreeActionCompletionR1.test.ts:27`, which enforced the line that caused `CA-AUD-001`) | `src/features/corporateActions/__tests__/corporateActionThreeActionCompletionR1.test.ts:27` |
| `CA-AUD-010` | **P3 Low** | `Maintainability` | `DatabaseToolsDialogs.tsx` monolith (8,365 lines / 356 KB) concentrates 70+ dialog state hooks and duplicates readiness predicates inline | `src/components/DatabaseToolsDialogs.tsx:3060-8365` |

---

## E. Test and Validation Matrix

Full command logs are stored under `logs/` and summarized in [`06_VALIDATION_RESULTS.md`](./06_VALIDATION_RESULTS.md).

| Validation Suite | Command Executed | Exit Code | Files / Tests | Result | Log File |
|---|---|---:|---|---|---|
| **Renderer Typecheck** | `npm.cmd run typecheck:renderer` (`tsc -p tsconfig.json --noEmit`) | `0` | Entire TypeScript project | **PASS** | `logs/typecheck_renderer.txt` |
| **CA Frontend Suite (Authoritative `src/`)** | `npx.cmd vitest run --dir src/features/corporateActions` | `0` | **73 files passed / 571 tests passed (0 failed)** in 9.39s | **PASS** | `logs/vitest_src_corporate_actions_only.txt` |
| **Related Renderer Suites (`identityRecovery` + `chartDataIntegrity`)** | `npx.cmd vitest run --dir src src/features/identityRecovery src/platform/__tests__/chartDataIntegrity.test.ts` | `0` | **4 files passed / 43 tests passed (0 failed)** in 1.47s | **PASS** | `logs/vitest_related_suites.txt` |
| **Full `src/` Frontend Suite** | `npx.cmd vitest run --dir src` | `0` | **257 files passed, 1 skipped / 1,783 tests passed, 1 skipped (0 failed)** in 42.11s | **PASS** | `logs/vitest_all_src.txt` |
| **Unscoped Workspace Vitest (Reproduces `CA-AUD-003`)** | `npx.cmd vitest run src/features/corporateActions` (no `--dir src`) | `1` | 641 files matched (includes `tmp/` & `backups/`): 615 passed, **26 failed in `tmp/`** (4,817 passed, 34 failed) in 92.32s | **FAIL (`tmp/` pollution)** | `logs/vitest_corporate_actions.txt` |
| **Rust CA Imports Suite (`BUILD-01` Shared Target)** | `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('corporate_action_imports')` | `0` | **565 passed, 0 failed, 19 ignored** in 9.83s | **PASS** | `logs/cargo_test_corporate_action_imports.txt` |
| **Rust Instrument Mutations Suite** | `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('instrument_mutations')` | `0` | **22 passed, 0 failed, 0 ignored** in 0.49s | **PASS** | `logs/cargo_test_instrument_mutations.txt` |
| **Rust CA Validation History Suite** | `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('corporate_action_history')` | `0` | **4 passed, 0 failed, 0 ignored** in 0.10s | **PASS** | `logs/cargo_test_corporate_action_history.txt` |
| **Rust Price Store Operation Lock Suite** | `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('price_store_operation_lock')` | `0` | **3 passed, 0 failed, 0 ignored** in 0.01s | **PASS** | `logs/cargo_test_price_store_operation_lock.txt` |
| **Rust Chart Adjustment Engine (`eod_data::tests`)** | `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('eod_data::tests')` | `0` | **16 passed, 0 failed, 1 ignored** in 0.05s | **PASS** | `logs/cargo_test_eod_data.txt` |
| **Rust NSE & BSE Identity Suites** | `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('nse_identity_imports')` & `@('bse_identity_imports')` | `0` | See `06_VALIDATION_RESULTS.md` | **PASS** | `logs/cargo_test_nse_identity_imports.txt`, `logs/cargo_test_bse_identity_imports.txt` |
| **Renderer Production Bundle Build (Authorization D)** | Deferred per explicit user instruction | N/A | Deferred | **DEFERRED** | N/A |

---

## F. Remediation Roadmap

See [`08_RECOMMENDED_BOUNDED_CORRECTIONS.md`](./08_RECOMMENDED_BOUNDED_CORRECTIONS.md) for the step-by-step bounded remediation plan:
1. **Phase R1 (P1 High):**
   - **R1.1 (`CA-AUD-001`):** Align `DividendPreparedScope` row filtering between `loadAndPrepareOfficialImports` (`DatabaseToolsDialogs.tsx:3224`) and `refreshCorporateActionQueueAfterApproval` (`corporateActionPostApprovalRefresh.ts:83-84`), and decide whether NSE Simple Cash Dividends should remain deferred (`Later`) or become eligible in the normal workflow.
   - **R1.2 (`CA-AUD-002`):** Enforce `!isLaterCorporateAction(row)` at the top of `isOfficialRowReady` (`DatabaseToolsDialogs.tsx:4013`) so Classic and Advanced views cannot disagree on `RIGHTS` readiness.
   - **R1.3 (`CA-AUD-003`):** Scope `package.json` `"test"` script to `"vitest run --dir src"` so `tmp/` and `backups/` worktrees are never executed as unit tests.
2. **Phase R2 (P2 Medium):**
   - **R2.1 (`CA-AUD-004`):** Pin `auto_approval.rs:956` to IST (`FixedOffset +05:30`).
   - **R2.2 (`CA-AUD-005`):** Extend duplicate factor-equivalence and future-ex-date guards in `instrument_mutations.rs` to manual `DIVIDEND` and `RIGHTS`.
   - **R2.3 (`CA-AUD-006`):** Surface chart adjustment toggle state (`includeDividendAdjustments` / `includeRightsAdjustments`) in the Corporate Actions UI.
   - **R2.4 (`CA-AUD-007`):** Wrap CSV import batches in outer transactions while retaining per-row savepoints.
3. **Phase R3 (P2/P3 Maintainability):**
   - **R3.1 (`CA-AUD-008`):** Archive retired `CorporateActionNormalWorkflowWorkspace.tsx` and unused `runNormalWorkflow*` functions.
   - **R3.2 (`CA-AUD-009`, `CA-AUD-010`):** Extract dialog state/readiness selectors from `DatabaseToolsDialogs.tsx` and replace `readFileSync` regex tests with behavioral tests.
