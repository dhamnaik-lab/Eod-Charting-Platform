# Corporate Actions Deep Audit — Execution-Path & Subsystem Findings

**Audit Timestamp:** 2026-11-11 IST  
**Authorized Root:** `E:\TA Projects\EOD Charting Platform`  
**Local HEAD:** `e8664382c116b96bce1d105a9b9fa837175d77a0`

---

## Section A — End-to-End Execution Path Trace

### Stage 1: Fetch Official (`fetchOfficialCorporateActions`)
- **UI Entrypoints:**
  - Classic workspace (`src/features/corporateActions/workspace/CorporateActionClassicWorkspace.tsx:66-73`) → `runOfficialThreeActionFetch` (`src/components/DatabaseToolsDialogs.tsx:3325-3335`)
  - Advanced Fetch tab (`DatabaseToolsDialogs.tsx:6520+`)
- **Orchestrator:** `fetchCorporateActionOfficialImports` (`src/features/corporateActions/legacy/corporateActionImportOperations.ts:199-277`).
  - Defaults to exchange `'BOTH'` (runs sequential `NSE` then `BSE` IPC calls) over a rolling 365-day window unless customized.
- **Backend Command:** `fetch_official_corporate_actions` (`src-tauri-shell/src/database/corporate_action_imports.rs:351-394`) → `fetch_official_corporate_actions_with_session` (`lines 1461-1675`).
- **Concurrency & Cancellation:**
  - Acquires `bse_fetch::FetchGuard::start()` (`bse_fetch.rs:25-35`), a process-global mutex (`ACTIVE_FETCH`) backed by `Arc<AtomicBool>`. Concurrent official fetches fail closed immediately.
  - `cancel_official_corporate_action_fetch` (`corporate_action_imports.rs:1448`) sets the atomic flag. Checked before/after each window and before each row (`bse_fetch::check_cancel`).
- **Exchange Collection Mechanics:**
  - **NSE:**
    1. Calls `dated_symbol_chain::collect(connection, force_refresh)` (`corporate_action_imports.rs:1543`) to fetch/cache `https://nsearchives.nseindia.com/content/equities/symbolchange.csv` (validated against `NSE_OFFICIAL_SOURCE_HOSTS` and max 2 MB size). Failures append a warning to `result.errors` without aborting corporate action ingestion.
    2. Computes uncovered date ranges via `resolve_official_fetch_ranges` (`corporate_action_imports.rs:2897`).
    3. Warms session cookie at `https://www.nseindia.com/companies-listing/corporate-filings-actions` and fetches JSON from `https://www.nseindia.com/api/corporates-corporateActions`.
  - **BSE:**
    1. Splits missing coverage into bounded 7-calendar-day windows (`bse_fetch::bounded_ranges`, max 20,000 windows).
    2. Calls `bse_identity_mapping::collect` (`bse_identity_mapping.rs:5-25`) if any BSE instrument lacks `bse_security_code`. Uses the same guarded HTTP → isolated WebView2 fallback (`Scope::identity_master()`) and fills missing `bse_security_code` only when `(code, symbol, isin)` is 1-to-1-to-1 unique across the BSE master and normal-settlement (`NOT LIKE '%#'`) local BSE instruments.
    3. For each 7-day window, `BseSession::fetch` (`bse_fetch.rs:145-217`) attempts direct HTTP first (`https://api.bseindia.com/BseIndiaAPI/api/DefaultData/w?...`); if blocked/refused, switches `browser_only = true` and launches a dedicated, hidden/isolated WebView2 collector window (`bse_browser.rs:359`) pinned to `app_cache_dir()/bse-official-source` with strict URI allowlisting (`Scope::permits_resource`), permission denial, 8 MB body cap, 60s timeout, and exact JSON schema/date-range/6-digit-code validation (`Scope::validate`).
    4. Retains immutable raw response bytes + `.manifest.json` (with SHA-256) under `app_data_dir()/official-source-captures/bse` with `sync_data()`.
- **Coverage Marking & Partial Failure Asymmetry:**
  - If `range_errors == 0`, coverage is recorded in `corporate_action_fetch_coverage`.
  - If `range_errors > 0`: for NSE, `record_fetch_coverage_if_complete` skips marking coverage and appends an error string while continuing to the next range; for BSE, `bse_fetch::commit_window` (`bse_fetch.rs:110-120`) returns `Err(...)`, aborting remaining windows while preserving already-committed windows.

### Stage 2 & 3: Parse, Import & Deduplicate (`build_import_candidate_from_fields` & `store_import_candidate_evidence_aware`)
- **Parser:** `parse_corporate_action_purpose` (`corporate_action_imports.rs:9273-9640`):
  - Detects multiple corporate action families (`SPLIT`, `BONUS`, `DIVIDEND`, `RIGHTS`, `CONSOLIDATION`, `DEMERGER`).
  - Multi-family strings (e.g., Split + Bonus, Dividend + Split) are initially stored with `parse_status = "NEEDS_REVIEW"`, `review_status = "NEEDS_REVIEW"`, and `factor = None` so no compound string is blindly applied as a single ratio.
  - Splits require explicit face-value context (`Rs. 10 to Rs. 2`) or unambiguous ratio without extra unscoped numbers.
  - Consolidations / reverse splits compute `factor = old_fv / new_fv < 1.0` (`action_type = "SPLIT"`).
  - Multi-component dividends (`Interim Dividend Rs 2 + Special Dividend Rs 3`) and REIT/InvIT unit distributions (`Distribution of Rs X per unit comprising...`) are parsed only when every segment or headline total is explicit; percent-only dividends (`100% Dividend`) are marked `NEEDS_REVIEW` (`classification_refresh.rs:606`).
  - Rights issues (`RIGHTS`) extract ratio (`ratio_num`, `ratio_den`) and `cash_amount` (issue price) when explicitly stated in the purpose string (`extract_rights_issue_price`), leaving `factor = None` until approval time.
  - Demergers (`DEMERGER`) are parsed as `action_type = "DEMERGER"`, `parse_status = "NEEDS_REVIEW"`, `review_status = "UNSUPPORTED"`.
- **Deduplication & Evidence Storage:** `store_import_candidate_evidence_aware` (`corporate_action_imports.rs:4929-4956`):
  - Checks exact `dedupe_key` match first (`find_import_row_id_by_dedupe_key`). If found, runs `retain_exact_duplicate_candidate_evidence` inside `SAVEPOINT duplicate_candidate_evidence` so missing witness rows are recovered without overwriting existing provenance notes.
  - Next checks `find_equivalent_import_row_id` (`lines 5039-5129`): matches same exchange, action_type, ex_date, record_date, and economic terms (`ratio_num`, `ratio_den`, `old_face_value`, `new_face_value`, `cash_amount`), and verifies event-date identity equivalence via `event_date_identities_are_equivalent` (including `instrument_isin_history` bridging). Attaches new `corporate_action_import_evidence` row without inserting a duplicate import row.
  - Otherwise inserts a new row + evidence inside `SAVEPOINT corporate_action_import_candidate`.

### Stage 4: Match Identity (`resolve_nse_candidate`, `resolve_bse_candidate`, `recheck_import_row_resolution`)
- **NSE:**
  - Looks up `(symbol, 'NSE')` in `instruments`.
  - If exact symbol is missing: tries unique ISIN match on NSE (`find_unique_instrument_by_isin`), then single-hop/chain identity history (`find_identity_resolved_instrument`).
  - If exact symbol is found but `csv_isin != db_isin`: checks if `csv_isin` uniquely matches another active NSE instrument (preserving an active source symbol if `csv_isin` only points to an inactive predecessor), or checks `has_instrument_isin_history_evidence(connection, exchange, &symbol, csv_isin, ex_date)`. Without exact-date ISIN evidence, sets `review_status = "PENDING_ISIN_MISMATCH"`.
- **BSE:**
  - First resolves by `bse_scrip_code` (`resolve_bse_candidate_by_scrip_code` → `find_bse_instrument_by_security_code` on `exchange = 'BSE' AND bse_security_code = ?`, falling back to legacy numeric symbol).
  - If matched by security code and `official_isin != database_isin`, flags `PENDING_ISIN_MISMATCH`.
  - If no security code match, falls back to `find_unique_instrument_by_isin(connection, &isin, "BSE")`. Never crosses exchange boundaries (NSE ISIN is never matched to a BSE event).

### Stage 5 & 6: Load & Validate / Prepare (`prepareCorporateActionPendingImports`)
- **Frontend Sequence (`src/features/corporateActions/legacy/corporateActionImportOperations.ts:446-540`):**
  1. Lists all non-rejected `corporate_action_imports` (`PENDING`, `PENDING_ISIN_MISMATCH`, `NEEDS_REVIEW`, `UNRESOLVED`, `UNSUPPORTED`, `APPROVED`).
  2. Runs `refreshCorporateActionImportClassifications` in batches of 500 IDs (`classification_refresh.rs:5-246`):
     - Blocks incomplete Split/Bonus terms (`split_bonus_terms::blocker`).
     - Rechecks pending BSE rows that previously lacked a security-code mapping (`BSE_SECURITY_CODE_RESOLUTION`).
     - Rechecks unproven machine identity claims (`identity_recheck::recheck_pending_machine_identity`) and revokes any unsubstantiated machine match back to `UNRESOLVED`.
     - Expands combined Split + Bonus announcements into separate pending `SPLIT` and `BONUS` component rows (`split_bonus_preparation::prepare_companion`) with `dedupe_key = "CA_COMPONENT_V1:<id>:<type>"`.
     - Reparses legacy `OTHER` / `DIVIDEND` rows without overwriting manual decisions or conflicting cash amounts.
  3. Reloads pending rows and collects unresolved / `PENDING_ISIN_MISMATCH` rows (`isAutoMatchCandidate`).
  4. Fetches resolution suggestions (`listCorporateActionImportResolutionSuggestions`) and auto-applies `quickResolveCorporateActionImport` **only** when `selectVerifiedAutoResolutionSuggestion` finds a single suggestion with `canQuickResolve === true` (which requires backend-verified proof: exact event-date ISIN history, verified V1.14E event identity resolution, verified historical ISIN transition, verified dated symbol chain R1, or verified split/bonus symbol chain).
  5. Reloads rows and runs targeted official EOD scan (`runCorporateActionScan({ scope: 'official_imports', importIds })`) on `validationTargetIds` (`isValidationTarget`: parsed `SPLIT` and `BONUS` rows with `symbol` and `exDate`).
  6. Evaluates existing canonical actions (`reconcileExistingSplitBonusRow` for Split/Bonus, `listCorporateActionEventIdentities` for verified existing Dividends) and persists a validation history report (`saveCorporateActionValidationReport`).
- **Critical Defect in `DatabaseToolsDialogs.tsx` after `prepareCorporateActionPendingImports`:**
  - See **Finding CA-AUD-001 (P1)**: `DatabaseToolsDialogs.tsx:3224` passes `immediateCorporateActionValidationRows(result.rows)` (which filters out `DIVIDEND` via `isLaterCorporateAction`) into `buildCorporateActionDividendPreparedScope`. Thus `preparedScope.scope.importIds` is **always empty (`[]`)** during `Load & Validate`, completely bypassing `evaluateCorporateActionDividendPreparedScopeBatches` on initial load and leaving all Dividends permanently unready in the UI!
  - Furthermore, after any Split/Bonus approval, `refreshCorporateActionQueueAfterApproval` (`corporateActionPostApprovalRefresh.ts:83-114`) calls `buildCorporateActionDividendPreparedScope` on **unfiltered** `rows`, causing an unhandled exception (`"Remaining Dividend evidence is incomplete. Load & Validate again."`) whenever any other symbol in the queue has an unevaluated Dividend!

### Stage 7, 8 & 9: Review, Approve & Persist
- **Normal Approval Path:**
  - Split/Bonus rows use `approveCorporateActionImports` (`corporate_action_imports.rs:829` → `approve_corporate_action_imports_internal` at `5452`).
  - Eligible NSE Simple Cash Dividend rows (if prepared scope were populated) route through `executeCorporateActionDividendWriteStageBatches` (`corporateActionDividendWriteStageOrchestration.ts:44` → `execute_simple_cash_dividend_write_stage` at `corporate_action_imports.rs:1155`).
- **Backend Revalidation Before Write:**
  - Pins database folder via `resolve_reviewed_corporate_action_database(app, expected_database_path)`.
  - For Split/Bonus (`approve_corporate_action_import_without_transaction`, `corporate_action_imports.rs:6778`):
    1. Rejects `UNRESOLVED`, `PENDING_ISIN_MISMATCH` (unless explicit audited ISIN exception), or `NEEDS_REVIEW`.
    2. Calls `identity_recheck::machine_identity_is_unproven` — blocks if machine identity proof cannot be revalidated.
    3. Calls `split_bonus_terms::blocker` and `split_bonus_preparation::ensure_components_prepared`.
    4. Calls `ensure_official_import_eod_ready` (checks `ex_date <= today_ist` and local EOD bars on both sides of `ex_date`).
    5. Calls `ensure_split_bonus_price_validation` (`corporate_action_imports.rs:6315`): requires latest completed scan status `MATCHED` (or explicit `allow_price_validation_exception` with `>= 12`-char reason for `REVIEW`), verifies `ensure_scan_uses_current_price_window` (re-reads actual `.eod`/SQLite bars to confirm `prev_trade_date`, `ex_trade_date`, `prev_close`, `ex_open`, `ex_close` have not drifted since the scan), and verifies `ensure_compound_scan_fingerprint_current`.
    6. Checks `find_existing_corporate_action` or `reconcile_existing_corporate_action_import_internal`; if an equivalent canonical row already exists in `corporate_actions`, links `approved_corporate_action_id` without inserting a duplicate adjustment!
    7. Otherwise calls `apply_official_import_price_adjustment` (`instrument_mutations.rs:463`), inserting into `corporate_actions`, upserting exact-date `instrument_isin_history`, and marking the import `APPROVED`.
  - For Dividend Write Stage (`execute_simple_cash_dividend_write_stage_with_ops`, `auto_approval.rs:1345`):
    - Wraps the entire batch in `BEGIN IMMEDIATE` (`run_simple_cash_dividend_write_stage_outer_transaction`, `corporate_action_imports.rs:945`).
    - Re-runs `evaluate_simple_cash_dividend_policy_r1` on each import ID inside the write transaction, verifies the batch fingerprint (`simple_cash_dividend_prepared_scope_fingerprint`), applies or links the canonical dividend row, verifies post-write state (`verify_simple_cash_dividend_write_result`), and rolls back the entire outer transaction on any unexpected failure.

### Stage 10: Refresh Chart (`emit_database_changed` & `apply_corporate_adjustments`)
- **Cache Invalidation & Event Broadcast:**
  - Every mutating command invalidates `cached_db_stats` and calls `emit_database_changed` (`database:changed` Tauri event), plus the frontend calls `onApplied()` (`App.tsx:2491` → `bumpChartRefreshRevision` + `refreshSymbols`).
  - `chartRuntimeController.ts:288` subscribes to `onDatabaseChanged` and increments `chartRefreshRevision`, triggering `get_chart_data` / `get_chart_window`.
- **Read-Time Adjustment Calculation (`src-tauri-shell/src/database/eod_data.rs:818-949`):**
  - Raw `.eod` files and `eod_prices` rows are **never modified** by Corporate Actions.
  - `build_readable_adjustment_actions` filters `corporate_actions`:
    - `SPLIT`, `BONUS`, `DEMERGER` are always included.
    - `DIVIDEND` is included only when `include_dividend_adjustments == true` (default `false` in `chartStore.ts:369`).
    - `RIGHTS` is included only when `include_rights_adjustments == true` (default `false` in `chartStore.ts:370`).
  - Same-day `DIVIDEND` actions on the same effective date are combined by summing their relative price reductions: `total_price_reduction = sum(1.0 - 1.0 / factor)`, `combined_factor = 1.0 / (1.0 - total_price_reduction)`.
  - For every bar with `row.date < action.effective_date`, `open`, `high`, `low`, `close` are divided by `cumulative_price_factor`, and when `action.adjust_volume == 1` (`SPLIT`/`BONUS`), `volume` and `open_interest` are multiplied by `cumulative_volume_factor` and rounded (`round() as i64`).
