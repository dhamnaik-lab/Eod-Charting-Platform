# Corporate Actions Deep Audit — Complete Findings Register

**Audit Timestamp:** 2026-11-11 IST  
**Authorized Root:** `E:\TA Projects\EOD Charting Platform`  
**Local HEAD:** `e8664382c116b96bce1d105a9b9fa837175d77a0`

---

## Severity Summary

| Severity | Count | Summary |
|---|---:|---|
| **P0 Critical** | **0** | No silent raw-`.eod` corruption, no unauthorized automatic financial approval, no unguarded SQLite partial write on active approval transactions. |
| **P1 High** | **3** | `CA-AUD-001` (Dividend prepared-scope starvation on Load & Validate + post-approval refresh failure when any pending Dividend exists), `CA-AUD-002` (Classic vs. Advanced readiness/scan asymmetry for `RIGHTS`), `CA-AUD-003` (Unscoped `npm run test` / `vitest run` traverses `tmp/` and `backups/`, causing 26 false-failure suites and 92s runs). |
| **P2 Medium** | **5** | `CA-AUD-004` (`chrono::Local` vs. pinned IST in Dividend R1 ex-date policy), `CA-AUD-005` (Manual `apply_corporate_action` lacks `ensure_official_import_eod_ready`, 7-day cum-close staleness bound, and non-Split/Bonus economic equivalence duplicate check), `CA-AUD-006` (Default chart store flags `includeDividendAdjustments = false` and `includeRightsAdjustments = false` hide approved Dividend/Rights adjustments on charts without UI notice), `CA-AUD-007` (Autocommit per-row inserts during `import_corporate_actions_csv_internal` and `fetch_official_corporate_actions_with_session` + NSE/BSE partial-error range asymmetry), `CA-AUD-008` (Retired donor workspace `CorporateActionNormalWorkflowWorkspace.tsx` and divergent adapter methods remain in active `src/features/corporateActions` tree). |
| **P3 Low** | **2** | `CA-AUD-009` (Heavy reliance on brittle `readFileSync` substring/regex assertions across 40+ Corporate Actions frontend tests), `CA-AUD-010` (`DatabaseToolsDialogs.tsx` monolith at 8,365 lines / 356 KB increases maintenance and state-synchronization risk). |

---

## Detailed Findings Register

### `CA-AUD-001` — [P1 High] `Load & Validate` filters out all `DIVIDEND` rows before building `DividendPreparedScope`, starving Dividend readiness and breaking post-approval queue refresh

1. **Finding ID:** `CA-AUD-001`
2. **Severity:** `P1 High`
3. **Title:** `immediateCorporateActionValidationRows` excludes all `DIVIDEND` rows from `buildCorporateActionDividendPreparedScope` during `Load & Validate`, while `refreshCorporateActionQueueAfterApproval` includes them without prior evaluation
4. **Affected Stage:** `Load & Validate → Prepare → Review → Post-Approval Queue Refresh`
5. **Exact File Paths and Line Numbers:**
   - `src/features/corporateActions/legacy/corporateActionLater.ts:20-29` (`isLaterCorporateAction`, `immediateCorporateActionValidationRows`)
   - `src/components/DatabaseToolsDialogs.tsx:3219-3252` (`loadAndPrepareOfficialImports`)
   - `src/components/DatabaseToolsDialogs.tsx:3651-3701` (`reconcileOfficialQueueAfterApply`)
   - `src/components/DatabaseToolsDialogs.tsx:4013-4029` (`isOfficialRowReady`)
   - `src/features/corporateActions/legacy/corporateActionPostApprovalRefresh.ts:81-125` (`refreshCorporateActionQueueAfterApproval`)
6. **Concrete Reproduction or Trigger Scenario:**
   - **Scenario A (Dividend Readiness Starvation):**
     1. Open a database containing pending parsed NSE Simple Cash Dividend rows (`actionType === 'DIVIDEND'`, `parseStatus === 'PARSED'`, `reviewStatus === 'PENDING'`) and click **Load & Validate**.
     2. In `DatabaseToolsDialogs.tsx:3223-3225`, `loadAndPrepareOfficialImports` calls:
        ```ts
        const preparedScope = buildCorporateActionDividendPreparedScope({
          rows: immediateCorporateActionValidationRows(result.rows),
          expectedDatabasePath: activeDatabasePath,
          existingDividendByImportId: result.existingDividendByImportId,
        });
        ```
     3. `immediateCorporateActionValidationRows` (`corporateActionLater.ts:28-29`) filters out every row where `isLaterCorporateAction(row)` is `true`. Because `isLaterCorporateAction` (`line 20`) returns `true` for `row.actionType === 'DIVIDEND'`, the array passed to `buildCorporateActionDividendPreparedScope` contains **zero** `DIVIDEND` rows.
     4. `preparedScope.scope.importIds` is `[]`, hitting the early return at `DatabaseToolsDialogs.tsx:3235` (`if (preparedScope.scope.importIds.length === 0) return`). `evaluateCorporateActionDividendPreparedScopeBatches` is never invoked, `officialDividendWriteStageScope` remains `null`, and no Dividend row ever becomes `Ready` (`isOfficialRowReady` at `line 4025` requires `dividendPreparedImportIds.has(row.id)`).
   - **Scenario B (Post-Approval Queue Reconciliation Failure):**
     1. Have at least one Ready Split/Bonus row for Symbol A and at least one pending parsed non-existing Dividend row for Symbol B in the same queue.
     2. Click **Load & Validate** (so `officialDividendPreparedScopeOutcome` is `null` due to Scenario A), then approve the Ready Split/Bonus row for Symbol A.
     3. `reconcileOfficialQueueAfterApply` (`DatabaseToolsDialogs.tsx:3656`) calls `refreshCorporateActionQueueAfterApproval` (`corporateActionPostApprovalRefresh.ts:43`).
     4. Unlike `loadAndPrepareOfficialImports`, `refreshCorporateActionQueueAfterApproval` (`line 83-84`) calls `buildCorporateActionDividendPreparedScope` on the **unfiltered** `rows` (`const whole = build(rows)`).
     5. `whole.scope.importIds` includes Symbol B's Dividend `importId`. At `lines 110-114`, it looks up Symbol B's Dividend `importId` in `previousById` (from `previousDividendOutcome`, which is `null`), finds `!item`, and throws:
        `Error('Remaining Dividend evidence is incomplete. Load & Validate again.')`!
     6. Catch block at `DatabaseToolsDialogs.tsx:3698` sets `setOfficialImportError('Remaining Dividend evidence is incomplete. Load & Validate again.')`, displaying a false error banner after a successful Split/Bonus approval!
7. **Root Cause:**
   - Commit `8ce6da11fc6ed262d3c563a02c780ba9368ff06c` (`defer non-split/bonus actions in normal workflow`) added `DIVIDEND` to `isLaterCorporateAction` and wrapped `result.rows` in `immediateCorporateActionValidationRows(result.rows)` at `DatabaseToolsDialogs.tsx:3224`, without updating `refreshCorporateActionQueueAfterApproval` (`corporateActionPostApprovalRefresh.ts:83-84`) to apply the same filter (or separating Split/Bonus-only immediate validation from Dividend scope building).
8. **Financial, Data, or UX Impact:**
   - **Financial/Data:** Safe (fail-closed) — no incorrect adjustment is written, and the Split/Bonus approval transaction itself already committed before the queue refresh error.
   - **UX/Workflow:**
     1. Every post-approval queue refresh in a database that also has pending parsed NSE Dividends fails its incremental reconciliation and surfaces a confusing false error (`"Remaining Dividend evidence is incomplete. Load & Validate again."`), leaving the in-memory queue unrefreshed until the user reloads manually.
     2. Dividend R1 read-only policy evaluation and write-stage execution are completely unreachable from the UI while `isLaterCorporateAction` includes `DIVIDEND` at `DatabaseToolsDialogs.tsx:3224`.
9. **Existing Test Gap:**
   - `corporateActionThreeActionCompletionR1.test.ts` checks via regex that `DatabaseToolsDialogs.tsx` contains `rows: immediateCorporateActionValidationRows(result.rows)`, while `corporateActionDividendPreparedScopeObservability.test.ts` tests `buildCorporateActionDividendPreparedScope` directly with raw `DIVIDEND` rows. No integration test exercises `loadAndPrepareOfficialImports` followed by `reconcileOfficialQueueAfterApply` with a mixed Split/Bonus + Dividend queue.
10. **Recommended Minimal Fix:**
    - If Dividends are intentionally deferred (`Later`) in the current release, apply `immediateCorporateActionValidationRows` consistently inside `refreshCorporateActionQueueAfterApproval` (`src/features/corporateActions/legacy/corporateActionPostApprovalRefresh.ts:83-84`) so `whole` and `targeted` match `loadAndPrepareOfficialImports`.
    - Conversely, when Dividend normal approval is enabled for users, remove `row.actionType === 'DIVIDEND'` from `isLaterCorporateAction` (or pass unfiltered `result.rows` to `buildCorporateActionDividendPreparedScope` while keeping non-NSE/complex dividends deferred).
11. **Regression Test Needed:**
    - Add a behavioral unit test calling `prepareCorporateActionPendingImports`, building initial state with `immediateCorporateActionValidationRows`, and then calling `refreshCorporateActionQueueAfterApproval` on a queue containing both an approved `SPLIT` on Symbol A and a pending parsed `DIVIDEND` on Symbol B, verifying zero thrown errors and clean state transition.

---

### `CA-AUD-002` — [P1 High] Classic vs. Advanced Readiness and Scan Asymmetry for `RIGHTS` Actions

1. **Finding ID:** `CA-AUD-002`
2. **Severity:** `P1 High`
3. **Title:** Inconsistent `RIGHTS` scan targeting and readiness gating between `prepareCorporateActionPendingImports`, Classic Workspace, and Advanced Pending Review
4. **Affected Stage:** `Load & Validate → Review → Approve`
5. **Exact File Paths and Line Numbers:**
   - `src/features/corporateActions/legacy/corporateActionImportOperations.ts:309-318` (`isValidationTarget`)
   - `src/features/corporateActions/legacy/corporateActionLater.ts:20, 41` (`isLaterCorporateAction`, `deferredCorporateActionReason`)
   - `src/components/DatabaseToolsDialogs.tsx:4013-4031` (`isOfficialRowReady`, `eligibleImportRows`)
   - `src/components/DatabaseToolsDialogs.tsx:6026-6027` (Classic workspace `later` / `ready` computation)
   - `src/components/DatabaseToolsDialogs.tsx:6784` (Advanced workspace `canApprove` computation)
   - `src-tauri-shell/src/database/corporate_action_imports.rs:8058-8066, 8542-8565` (`load_scan_candidates`, `scan_candidate`)
6. **Concrete Reproduction or Trigger Scenario:**
   - Import or fetch a parsed `RIGHTS` row (`parseStatus === 'PARSED'`, `reviewStatus === 'PENDING'`, `ratioNum`, `ratioDen`, and explicit issue price `cashAmount` present).
   - **Path 1 (Normal `Load & Validate`):** `isValidationTarget` (`corporateActionImportOperations.ts:309`) only includes `isSplitOrBonus(row)`. Thus `RIGHTS` is never passed to `runCorporateActionScan`, `latestScanByImportId.get(row.id)` is `undefined`, and `getCorporateActionNormalApprovalState` (`corporateActionValidation.ts:192`) labels the row `'WAITING FOR EOD DATA'` even when local EOD bars exist on both sides of `exDate`.
   - **Path 2 (After targeted scan or post-approval refresh):** `refreshCorporateActionQueueAfterApproval` (`corporateActionPostApprovalRefresh.ts:68`) *does* include `RIGHTS` in `scanIds`! Once scanned with local EOD bars, `scan_candidate` (`corporate_action_imports.rs:8552`) returns `scanStatus: 'REVIEW'` with `prevTradeDate` and `exTradeDate` populated. Then:
     - In **Classic view** (`DatabaseToolsDialogs.tsx:6026-6027`), `later = isLaterCorporateAction(row)` is `true`, displaying `'Rights: adjustment rules not built yet'` and blocking selection.
     - In **Advanced Pending Review** (`DatabaseToolsDialogs.tsx:4021-4029` and `6784`), `isOfficialRowReady(row)` does **not** check `isLaterCorporateAction(row)`! It returns `true` for the scanned `RIGHTS` row, enabling selection and **Approve Selected Ready** (which invokes `approve_corporate_action_import_without_transaction` → `compute_rights_adjustment_factor` TERP adjustment in `instrument_mutations.rs:535`).
7. **Root Cause:**
   - Three layers disagree on whether `RIGHTS` is supported:
     1. Backend (`instrument_mutations.rs:535, 1697`) and Advanced `isOfficialRowReady` (`DatabaseToolsDialogs.tsx:4021`) implement TERP rights adjustment.
     2. `corporateActionLater.ts:41` claims `'Rights: adjustment rules not built yet'` and blocks Classic view (`DatabaseToolsDialogs.tsx:6026`).
     3. `corporateActionImportOperations.ts:309` omits `RIGHTS` from `isValidationTarget` during `Load & Validate`, whereas `corporateActionPostApprovalRefresh.ts:68` includes `RIGHTS`.
8. **Financial, Data, or UX Impact:**
   - Classic view tells the user `'Rights: adjustment rules not built yet'`, Advanced view before a manual/post-approval scan tells the user `'WAITING FOR EOD DATA'` (even when EOD data is present), and Advanced view after a targeted scan marks the exact same `RIGHTS` row `'READY TO APPROVE'` and allows approval.
9. **Existing Test Gap:**
   - `corporateActionLater.test.ts` tests `isLaterCorporateAction` in isolation; `corporateActionValidation.test.ts` tests `getCorporateActionNormalApprovalState` in isolation. No test checks consistency between `isOfficialRowReady` (Advanced) and Classic `ready` (`!isLaterCorporateAction && isOfficialRowReady`).
10. **Recommended Minimal Fix:**
    - Enforce `!isLaterCorporateAction(row)` inside `isOfficialRowReady` (`src/components/DatabaseToolsDialogs.tsx:4013`) so Classic and Advanced views share one authoritative readiness rule while `RIGHTS` is deferred in the normal workflow.
11. **Regression Test Needed:**
    - Add a unit test verifying that `isOfficialRowReady` and Classic readiness agree across `SPLIT`, `BONUS`, `DIVIDEND`, `RIGHTS`, `DEMERGER`, and `OTHER` rows with and without scan results.

---

### `CA-AUD-003` — [P1 High] `vitest.config.ts` omits `'**/tmp/**'` from `test.exclude`, causing `npm run test` (`vitest run`) to execute 641 files and fail 26 archived snapshot test files in `tmp/`

1. **Finding ID:** `CA-AUD-003`
2. **Severity:** `P1 High`
3. **Title:** Missing `'**/tmp/**'` exclusion in `vitest.config.ts` causes `npm run test` and unscoped `npx vitest run` to execute stale candidate worktree copies inside `tmp/`
4. **Affected Stage:** `Test & Validation Infrastructure`
5. **Exact File Paths and Line Numbers:**
   - `vitest.config.ts:8-22` (`test.exclude` list)
   - `package.json:13` (`"test": "vitest run"`)
   - `scripts/validate-change.ps1:46, 54, 61` (`Add-Step "Unit tests" "npm" @("run", "test")`)
6. **Concrete Reproduction or Trigger Scenario:**
   - Run `npx vitest run src/features/corporateActions` (or `npm run test`) from the repository root without `--dir src`.
   - Vitest treats `src/features/corporateActions` as a path substring filter across the workspace directory tree. Because `vitest.config.ts:8-22` excludes `**/backups/**` but omits `**/tmp/**`, Vitest discovers **641 test files** (including stale candidate copies under `tmp/UI8_BaselineProof_20261105_003625_IST/...`, `tmp/ux13-936ac0b/candidate/...`, `tmp/UX13_PR_Promotion_20261105_152505_IST/...`, and `tmp/UX13_PR23_20261106_001316_IST/...`).
   - Result: **26 test files failed, 615 passed (641 total); 34 tests failed, 4,817 passed (4,851 total); duration 92.32s** (`logs/vitest_corporate_actions.txt`).
   - By contrast, running `npx vitest run --dir src/features/corporateActions` runs the actual 73 Corporate Actions test files in `src/`: **73 passed (73/73), 571 passed (571/571) in 9.39s** (`logs/vitest_src_corporate_actions_only.txt`), and `npx vitest run --dir src` passes **257/257 active files (1,783/1,783 tests)** (`logs/vitest_all_src.txt`).
7. **Root Cause:**
   - `vitest.config.ts:8-22` lists `**/backups/**`, `**/dist/**`, `**/release/**`, `**/docs/audits/**`, etc. in `test.exclude`, but omits `'**/tmp/**'`.
8. **Financial, Data, or UX Impact:**
   - Breaks `npm run test` and `scripts/validate-change.ps1 -Full`, inflates test runtime 10× (92s vs. 9s), and masks real `src/` test results behind 34 noise failures from `tmp/` snapshots.
9. **Existing Test Gap:**
   - No validation check verifies that `vitest` excludes `tmp/**`.
10. **Recommended Minimal Fix:**
    - Add `'**/tmp/**'` to `test.exclude` in `vitest.config.ts:8-22` (and optionally pass `--dir src` in `package.json` `"test"`).
11. **Regression Test Needed:**
    - Verify `npm run test` discovers only test files under `src/` and completes with 0 failures.

---

### `CA-AUD-004` — [P2 Medium] Host-Timezone (`chrono::Local`) vs. Pinned IST (`FixedOffset +05:30`) Inconsistency in Dividend R1 Ex-Date Policy Evaluation

1. **Finding ID:** `CA-AUD-004`
2. **Severity:** `P2 Medium`
3. **Title:** `evaluate_simple_cash_dividend_policy_with_peer_cache` uses `chrono::Local::now().date_naive()` instead of pinned IST (`UTC+05:30`) for ex-date readiness and 1-year lookback
4. **Affected Stage:** `Load & Validate → Prepare → Dividend Write Stage`
5. **Exact File Paths and Line Numbers:**
   - `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs:956` (`let today = chrono::Local::now().date_naive();`)
   - Compare with `src-tauri-shell/src/database/corporate_action_imports.rs:8648-8650` (`ensure_official_import_eod_ready` uses `FixedOffset::east_opt(5 * 3600 + 30 * 60)`)
   - Compare with `src-tauri-shell/src/database/corporate_action_imports/dividend_validation_cache.rs:629` (`evaluate` uses `FixedOffset::east_opt(5 * 3600 + 30 * 60)`)
   - Compare with `src-tauri-shell/src/database/corporate_action_imports/event_price_route.rs:137-139` (`resolve` uses `FixedOffset::east_opt(19800)`)
6. **Concrete Reproduction or Trigger Scenario:**
   - Run the desktop app on a machine whose OS timezone is behind IST (e.g., UTC or US/Europe) between 00:00 IST and 05:30 IST on `ex_date` (or on the exact 1-year boundary `today - 1 year`).
   - `dividend_validation_cache.rs:629` computes `due_bucket` using IST `today`, whereas `evaluate_simple_cash_dividend_policy_with_peer_cache` (`auto_approval.rs:956`) checks `if ex_date > today` and `ex_date < minimum_ex_date` using `chrono::Local::now().date_naive()`.
7. **Root Cause:**
   - `auto_approval.rs:956` was written with `chrono::Local::now().date_naive()` while the rest of the Corporate Actions subsystem standardized on explicit IST (`FixedOffset::east_opt(5 * 3600 + 30 * 60)`).
8. **Financial, Data, or UX Impact:**
   - Non-deterministic Dividend R1 eligibility across host timezones and cache-bucket vs. evaluator date mismatch during the daily timezone boundary window.
9. **Existing Test Gap:**
   - Unit tests in `auto_approval.rs` use fixed historical dates (e.g. `within_last_year_ex_date` relative to `Local::now()`) rather than testing timezone invariance.
10. **Recommended Minimal Fix:**
    - Replace `chrono::Local::now().date_naive()` in `auto_approval.rs:956` with the same IST helper (`chrono::Utc::now().with_timezone(&chrono::FixedOffset::east_opt(5 * 3600 + 30 * 60).unwrap()).date_naive()`).
11. **Regression Test Needed:**
    - Add a unit test passing an explicit `today: NaiveDate` parameter into `evaluate_simple_cash_dividend_policy_with_peer_cache` and verifying boundary dates deterministically.

---

### `CA-AUD-005` — [P2 Medium] Manual `apply_corporate_action` Lacks Official Approval Guards (Future Ex-Date, 7-Day Cum-Close Bound, and Dividend/Rights Equivalence Guard)

1. **Finding ID:** `CA-AUD-005`
2. **Severity:** `P2 Medium`
3. **Title:** Manual corporate action entry (`apply_corporate_action`) bypasses `ensure_official_import_eod_ready`, searches back to `1900-01-01` for previous close, and only checks floating-point factor equivalence on `SPLIT`/`BONUS`
4. **Affected Stage:** `Manual Corporate Action Entry → Persist`
5. **Exact File Paths and Line Numbers:**
   - `src-tauri-shell/src/database/instrument_mutations.rs:52-89` (`apply_corporate_action_internal`)
   - `src-tauri-shell/src/database/instrument_mutations.rs:495-565` (`record_price_adjustment_action`)
   - `src-tauri-shell/src/database/instrument_mutations.rs:567-642` (`record_price_adjustment_action_with_basis`)
   - `src-tauri-shell/src/database/instrument_mutations.rs:1728-1778` (`load_previous_trade_close_basis`)
6. **Concrete Reproduction or Trigger Scenario:**
   - **Scenario A (Stale Cum-Close / Future Ex-Date in Manual Entry):**
     1. In Advanced → Manual tab, submit a manual `DIVIDEND` or `RIGHTS` action with an `effective_date` in the future (or for a symbol whose last local EOD bar was 6 months ago).
     2. `record_price_adjustment_action` calls `load_previous_trade_close_basis` (`instrument_mutations.rs:1742`), which queries bars from `"1900-01-01"` to `effective_date` without checking `ensure_official_import_eod_ready` (no check that `effective_date <= today_ist`, no check that a post-ex bar exists, and no 7-calendar-day staleness cap on `prev_trade_date`). It computes the dividend/rights factor against the stale close and commits it.
   - **Scenario B (Manual Dividend/Rights Duplicate Check):**
     1. `record_price_adjustment_action_with_basis` (`lines 601-641`) runs a second duplicate check by factor equivalence (`(stored_factor - factor).abs() <= 1e-9 * ...`), but restricts it to `if matches!(action_type, "SPLIT" | "BONUS")`.
     2. For `DIVIDEND` or `RIGHTS`, if a manual entry supplies an explicit `factor` (without `cash_amount`) and a second entry supplies `cash_amount` (yielding the same `factor`), the first SQL duplicate check (`COALESCE(cash_amount, -1) = COALESCE(?, -1)`) misses it because one row has `cash_amount = NULL` and the other has `cash_amount = X`.
7. **Root Cause:**
   - Hardening guards (`ensure_official_import_eod_ready`, 7-day cum-close window in `auto_approval.rs:985`, and economic factor equivalence) were added to the official-import approval paths while leaving legacy manual `apply_corporate_action` more permissive.
8. **Financial, Data, or UX Impact:**
   - An operator using the Advanced → Manual tab can accidentally record a manual Dividend/Rights adjustment using a stale pre-ex close before ex-date EOD data is imported, or record duplicate manual/official Dividend adjustments if one omitted `cash_amount`.
9. **Existing Test Gap:**
   - `ca_financial_integrity_equivalent_split_ratio_and_face_value_cannot_double_adjust` (`instrument_mutations.rs:2125`) tests `SPLIT` equivalence only.
10. **Recommended Minimal Fix:**
    - Extend the factor-equivalence duplicate guard in `record_price_adjustment_action_with_basis` (`instrument_mutations.rs:601`) or check `(exchange, current_symbol, effective_date, action_type)` factor equivalence for `DIVIDEND` and `RIGHTS`, and reject future `effective_date > today_ist` for price-adjusting actions unless explicitly confirmed.
11. **Regression Test Needed:**
    - Add unit tests in `instrument_mutations::tests` verifying that duplicate manual/official `DIVIDEND` and `RIGHTS` entries with identical effective factor on the same date are rejected.

---

### `CA-AUD-006` — [P2 Medium] Chart Store Defaults `includeDividendAdjustments` and `includeRightsAdjustments` to `false` Without Corporate Actions UI Notice

1. **Finding ID:** `CA-AUD-006`
2. **Severity:** `P2 Medium`
3. **Title:** Approved `DIVIDEND` and `RIGHTS` adjustments are persisted in `corporate_actions` but excluded from chart price adjustment by default (`includeDividendAdjustments: false`, `includeRightsAdjustments: false`)
4. **Affected Stage:** `Approve → Persist → Refresh Chart`
5. **Exact File Paths and Line Numbers:**
   - `src/store/chartStore.ts:368-370` (`adjustCorporateActions: true`, `includeDividendAdjustments: false`, `includeRightsAdjustments: false`)
   - `src-tauri-shell/src/database/eod_data.rs:885-907` (`build_readable_adjustment_actions`)
6. **Concrete Reproduction or Trigger Scenario:**
   - Approve or manually apply a `DIVIDEND` or `RIGHTS` corporate action while `adjustCorporateActions` (`ADJ` toggle) is enabled on the chart.
   - `build_readable_adjustment_actions` (`eod_data.rs:899-900`) filters out `"DIVIDEND"` unless `options.include_dividend_adjustments` is `true`, and filters out `"RIGHTS"` unless `options.include_rights_adjustments` is `true`.
   - Because `chartStore.ts:369-370` initializes both flags to `false`, the chart reloads with zero visual change to pre-ex prices after approving a Dividend or Rights issue unless the user separately enables Dividend/Rights adjustment toggles in chart settings.
7. **Root Cause:**
   - Standard charting convention often separates Split/Bonus adjustment from Cash Dividend / Rights adjustment, but the Corporate Actions approval confirmation message (`"Dividend saved. Raw prices were not changed."`) does not inform the user whether Dividend/Rights chart adjustments are currently toggled off in chart settings.
8. **Financial, Data, or UX Impact:**
   - Operator confusion: user approves a Dividend or Rights issue, sees `"Approved"`, checks the chart with `ADJ` active, and believes the adjustment engine failed.
9. **Existing Test Gap:**
   - Backend tests pass `ChartAdjustmentOptions { adjust_corporate_actions: true, include_dividend_adjustments: true, include_rights_adjustments: true }` explicitly (`eod_data.rs:1540`), whereas UI tests do not check the notice when `includeDividendAdjustments` is `false`.
10. **Recommended Minimal Fix:**
    - Display a clear informational note in the Corporate Actions dialog (or post-approval status message) when `DIVIDEND` / `RIGHTS` actions are approved while `includeDividendAdjustments` / `includeRightsAdjustments` is disabled in the active chart store.
11. **Regression Test Needed:**
    - Component/model test verifying the status hint when Dividend/Rights adjustments are toggled off.

---

### `CA-AUD-007` — [P2 Medium] Per-Row Autocommit During CSV/Official Fetch Ingestion and NSE vs. BSE Partial-Error Coverage Asymmetry

1. **Finding ID:** `CA-AUD-007`
2. **Severity:** `P2 Medium`
3. **Title:** `import_corporate_actions_csv_internal` and `fetch_official_corporate_actions_with_session` execute per-row savepoints in autocommit mode, and NSE vs. BSE handle `range_errors > 0` differently
4. **Affected Stage:** `Fetch Official / Import CSV → Persist Candidates`
5. **Exact File Paths and Line Numbers:**
   - `src-tauri-shell/src/database/corporate_action_imports.rs:1354-1445` (`import_corporate_actions_csv_internal`)
   - `src-tauri-shell/src/database/corporate_action_imports.rs:1605-1675` (`fetch_official_corporate_actions_with_session`)
   - `src-tauri-shell/src/database/corporate_action_imports/bse_fetch.rs:102-122` (`commit_window`)
6. **Concrete Reproduction or Trigger Scenario:**
   - **Scenario A (Per-row autocommit fsync overhead):** Importing a large CSV (e.g., 2,000+ rows) via `import_corporate_actions_csv_internal` runs `store_import_candidate_evidence_aware` per row without an outer transaction per batch/window. Because `connection` is in autocommit mode, each row's `SAVEPOINT corporate_action_import_candidate ... RELEASE` triggers a full SQLite transaction commit on disk.
   - **Scenario B (NSE vs. BSE partial row error handling):** If 1 row in a 7-day window fails parsing/storage (`range_errors == 1`):
     - For **NSE** (`corporate_action_imports.rs:1667`), `record_fetch_coverage_if_complete` skips coverage marking, appends a message to `result.errors`, and **continues** fetching remaining missing ranges, returning `Ok(result)`.
     - For **BSE** (`corporate_action_imports.rs:1664`, `bse_fetch.rs:119`), `bse_fetch::commit_window` returns `Err(...)`, immediately **aborting** the entire `fetch_official_corporate_actions` call and discarding the structured `CorporateActionOfficialFetchResult` (returning a top-level IPC error string instead).
7. **Root Cause:**
   - Row-level savepoints were designed so a single malformed row does not roll back valid sibling rows in the same window, and `bse_fetch::commit_window` was later made stricter (`return Err(...)`) than NSE's `record_fetch_coverage_if_complete`.
8. **Financial, Data, or UX Impact:**
   - Slower multi-thousand-row CSV/API ingestion due to per-row autocommit I/O; for BSE, a single malformed official row causes the IPC call to reject with an error string rather than returning the structured `CorporateActionOfficialFetchResult` with `rows_inserted` and `errors`.
9. **Existing Test Gap:**
   - `bse_fetch_coverage_resumes_after_row_failure_or_cancellation` (`bse_fetch.rs:357`) asserts the `Err` return from `commit_window`, while `phase3_import_atomicity_withholds_partial_range_coverage` (`corporate_action_imports.rs:11739`) asserts the `Ok` return for NSE.
10. **Recommended Minimal Fix:**
    - Wrap each bounded fetch window (and CSV import in chunks of e.g. 250 rows) in an outer `BEGIN IMMEDIATE ... COMMIT` while keeping per-row `SAVEPOINT corporate_action_import_candidate` inside it so valid rows still commit fast in one disk flush while bad rows roll back to their savepoint. Align NSE and BSE partial-window error reporting.
11. **Regression Test Needed:**
    - Add a unit test verifying that a 500-row CSV import with 1 malformed row commits the 499 valid rows within a single outer transaction and rolls back only the 1 failed row's savepoint.

---

### `CA-AUD-008` — [P2 Medium] Retired Donor Component (`CorporateActionNormalWorkflowWorkspace.tsx`) and Unmounted Orchestration Paths Remain in Active Source Tree

1. **Finding ID:** `CA-AUD-008`
2. **Severity:** `P2 Medium`
3. **Title:** `CorporateActionNormalWorkflowWorkspace.tsx`, `CorporateActionApproveWorkspace.tsx`, and `runNormalWorkflowLoadAndValidate` / `runNormalWorkflowApproveReady` remain in `src/features/corporateActions/` despite being retired
4. **Affected Stage:** `UI / Architecture Maintainability`
5. **Exact File Paths and Line Numbers:**
   - `src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx:1-553`
   - `src/features/corporateActions/workspace/CorporateActionApproveWorkspace.tsx:1-64`
   - `src/features/corporateActions/workflow/corporateActionNormalWorkflowAdapter.ts:925-1105` (`runNormalWorkflowLoadAndValidate`, `runNormalWorkflowApproveReady`)
5. **Concrete Reproduction or Trigger Scenario:**
   - Inspect `CorporateActionNormalWorkflowWorkspace.tsx` vs. `DatabaseToolsDialogs.tsx`:
     - `CorporateActionNormalWorkflowWorkspace.tsx` has its own `runNormalWorkflowLoadAndValidate` and `runNormalWorkflowApproveReady` implementations in `corporateActionNormalWorkflowAdapter.ts` with subtly different scan targeting (`isNormalPriceValidationTarget` includes `DIVIDEND` and `RIGHTS` at `line 444`, whereas `DatabaseToolsDialogs.tsx` uses `prepareCorporateActionPendingImports` which only scans `SPLIT` and `BONUS` at `corporateActionImportOperations.ts:309`).
     - Although `RootApp.tsx` does not mount `CorporateActionNormalWorkflowWorkspace.tsx`, tests still test both the unmounted donor component and `DatabaseToolsDialogs.tsx`.
7. **Root Cause:**
   - During the R1 three-action consolidation into `DatabaseToolsDialogs.tsx` and `CorporateActionClassicWorkspace.tsx`, the older standalone workspace was kept in `src/features/corporateActions/workspace/` as a "retired donor".
8. **Financial, Data, or UX Impact:**
   - High cognitive and audit overhead: developers or future changes can easily patch `corporateActionNormalWorkflowAdapter.ts` (`runNormalWorkflowLoadAndValidate`) thinking it governs the production normal workflow, when production actually runs `corporateActionImportOperations.ts` + `DatabaseToolsDialogs.tsx`.
9. **Existing Test Gap:**
   - Tests exist for both, which reinforces the illusion that `runNormalWorkflowLoadAndValidate` is active production code.
10. **Recommended Minimal Fix:**
    - Move `CorporateActionNormalWorkflowWorkspace.tsx`, `CorporateActionApproveWorkspace.tsx`, and the unused `runNormalWorkflow*` functions out of active `src/features/corporateActions/` (or clearly mark/remove the unused runner functions while keeping only the shared pure selectors).
11. **Regression Test Needed:**
    - Update `corporateActionNormalWorkflowWorkspace.test.tsx` and `corporateActionThreeActionCompletionR1.test.ts` when archiving the retired donor component.

---

### `CA-AUD-009` — [P3 Low] Widespread Source-Text Regex/Substring Assertions in Corporate Actions Test Suite

1. **Finding ID:** `CA-AUD-009`
2. **Severity:** `P3 Low`
3. **Title:** Over 40 frontend and Rust bridge tests assert exact source-code formatting strings via `readFileSync` / `include_str!` instead of executing runtime behavior
4. **Affected Stage:** `Test Quality & Maintainability`
5. **Exact File Paths and Line Numbers:**
   - `src/features/corporateActions/__tests__/corporateActionThreeActionCompletionR1.test.ts:10-79`
   - `src/features/corporateActions/__tests__/corporateActionDividendExplicitApprovalR1.test.ts`
   - `src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_transaction_owner_tests.rs:270-360`
   - `src-tauri-shell/src/database/price_store_operation_lock.rs:102-117`
6. **Concrete Reproduction or Trigger Scenario:**
   - In `corporateActionThreeActionCompletionR1.test.ts:27`, the test asserts:
     `expect(dialog).toMatch(/const preparedScope = buildCorporateActionDividendPreparedScope\(\{\s*rows: immediateCorporateActionValidationRows\(result\.rows\),/);`
   - This static string test *enforced* the exact line that caused **Finding `CA-AUD-001`**, without ever executing `loadAndPrepareOfficialImports` or `reconcileOfficialQueueAfterApply` at runtime to discover that filtering `result.rows` broke Dividend prepared-scope evaluation and post-approval queue reconciliation!
7. **Root Cause:**
   - Heavy use of `fs.readFileSync` / `include_str!` structural contract tests during iterative phase deliveries.
8. **Financial, Data, or UX Impact:**
   - False sense of test coverage on wiring seams (`DatabaseToolsDialogs.tsx`), and brittle failures on harmless formatting/comment changes.
9. **Existing Test Gap:**
   - Lack of behavioral tests on the stateful orchestration hooks inside `DatabaseToolsDialogs.tsx`.
10. **Recommended Minimal Fix:**
    - Extract the stateful orchestration in `DatabaseToolsDialogs.tsx` (`loadAndPrepareOfficialImports`, `reconcileOfficialQueueAfterApply`, `isOfficialRowReady`) into a pure testable controller module and replace `readFileSync` regex tests with behavioral execution tests.
11. **Regression Test Needed:**
    - Behavioral controller tests covering mixed-action queues (`SPLIT` + `BONUS` + `DIVIDEND` + `RIGHTS` + `DEMERGER`).

---

### `CA-AUD-010` — [P3 Low] `DatabaseToolsDialogs.tsx` Monolith (8,365 Lines / 356 KB) Concentrates Dialog State, Orchestration, and Presentation

1. **Finding ID:** `CA-AUD-010`
2. **Severity:** `P3 Low`
3. **Title:** `src/components/DatabaseToolsDialogs.tsx` contains 8,365 lines mixing Corporate Actions state machines, Identity Recovery, Audit Logs, and Database Maintenance dialogs
4. **Affected Stage:** `UI / Maintainability`
5. **Exact File Paths and Line Numbers:**
   - `src/components/DatabaseToolsDialogs.tsx:1-8365` (Corporate Actions dialog spans lines `3060-8365`)
6. **Concrete Reproduction or Trigger Scenario:**
   - `CorporateActionDialog` manages 70+ `useState` / `useMemo` hooks inline (`lines 3060-4600`), duplicating readiness predicates (`isOfficialRowReady` at `line 4013` vs. Classic `later && ready` at `line 6026` vs. `canApprove` at `line 6784`).
7. **Root Cause:**
   - Incremental feature additions (Classic view, Advanced tabs, Identity sync, Historical backfill, Repair preview, Dividend prepared scope, Safe V2 observability) were accumulated inside `DatabaseToolsDialogs.tsx`.
8. **Financial, Data, or UX Impact:**
   - Increases likelihood of state-synchronization bugs (such as `CA-AUD-001` and `CA-AUD-002`) when updating one tab or workflow mode.
9. **Existing Test Gap:**
   - `DatabaseToolsDialogs.tsx` is predominantly tested via `readFileSync` substring checks rather than mounted component/hook tests.
10. **Recommended Minimal Fix:**
    - Incrementally extract Corporate Actions dialog state and readiness selectors into `src/features/corporateActions/` hooks/modules without altering UI behavior.
11. **Regression Test Needed:**
    - Unit tests on extracted readiness and queue-reconciliation selectors.
