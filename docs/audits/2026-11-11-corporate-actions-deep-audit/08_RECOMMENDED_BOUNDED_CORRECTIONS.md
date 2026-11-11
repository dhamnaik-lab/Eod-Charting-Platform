# Corporate Actions Deep Audit — Prioritized Remediation Roadmap

**Audit Timestamp:** 2026-11-11 IST  
**Authorized Root:** `E:\TA Projects\EOD Charting Platform`  
**Local HEAD:** `e8664382c116b96bce1d105a9b9fa837175d77a0`

> **Status Update (2026-11-11 IST):** **All Remediation Phases (`Phase R1`, `Phase R2`, `Phase R3`) are APPROVED and IMPLEMENTED.**
> - **Backups:** `backups/pre_opencode_changes_20261111_173544_ca-audit-r1-fixes`, `backups/pre_opencode_changes_20261111_175933_ca-audit-r2-fixes`, `backups/pre_opencode_changes_20261111_180117_ca-audit-r2-test-backup`, `backups/pre_opencode_changes_20261111_180405_ca-audit-r2-bridge-pin-backup`, `backups/pre_opencode_changes_20261111_181805_ca-audit-r3-fixes`
> - **Validation:** Unscoped `npx.cmd vitest run src/features/corporateActions` **PASS (74/74 files, 575/575 tests)**; `npm.cmd run typecheck:renderer` **PASS (0 errors)**; Rust `instrument_mutations` (**23/23 PASS**) and `corporate_action_imports` (**565/565 PASS**).

---

## Phase R1 — Immediate P1 Workflow & Test-Runner Corrections (COMPLETED)

### Step R1.1: Align `DividendPreparedScope` Filtering Between `Load & Validate` and Post-Approval Queue Reconciliation (`CA-AUD-001`)
- **Target Files:**
  - `src/features/corporateActions/legacy/corporateActionPostApprovalRefresh.ts` (`lines 81-85`)
  - Or `src/components/DatabaseToolsDialogs.tsx` (`line 3224`) + `src/features/corporateActions/legacy/corporateActionLater.ts` (`line 20`)
- **Decision Gate for User:**
  - **Option 1 (Keep Dividends Deferred / `Later` in Normal Workflow):** Apply `immediateCorporateActionValidationRows(rows)` inside `refreshCorporateActionQueueAfterApproval` (`corporateActionPostApprovalRefresh.ts:83-84`) so `whole` and `targeted` match `loadAndPrepareOfficialImports` and never throw `"Remaining Dividend evidence is incomplete. Load & Validate again."` after approving a Split/Bonus row.
  - **Option 2 (Enable NSE Simple Cash Dividend Normal Approval):** Pass unfiltered `result.rows` into `buildCorporateActionDividendPreparedScope` at `DatabaseToolsDialogs.tsx:3224` and refine `isLaterCorporateAction` (`corporateActionLater.ts:20`) so eligible NSE Simple Cash Dividends are not blanket-marked as `Later`.
- **Verification:** Behavioral unit test covering `loadAndPrepareOfficialImports` → `reconcileOfficialQueueAfterApply` on a mixed `SPLIT` + `DIVIDEND` queue.

### Step R1.2: Unify Classic and Advanced Readiness Gate for Deferred Action Types (`CA-AUD-002`)
- **Target File:** `src/components/DatabaseToolsDialogs.tsx` (`lines 4013-4029`)
- **Bounded Change:**
  - In `isOfficialRowReady`, gate readiness with `if (isLaterCorporateAction(row)) return false;` at the top of the predicate so Advanced Pending Review (`eligibleImportRows` and `canApprove`) cannot mark a `RIGHTS` row Ready while `corporateActionLater.ts` classifies `RIGHTS` as deferred (`'Rights: adjustment rules not built yet'`).
- **Verification:** Unit test asserting `isOfficialRowReady(row) === false` for all rows where `isLaterCorporateAction(row) === true`.

### Step R1.3: Add `'**/tmp/**'` to `vitest.config.ts` Exclude List (`CA-AUD-003`)
- **Target File:** `vitest.config.ts` (`lines 8-22`)
- **Bounded Change:**
  - Add `'**/tmp/**'` to `test.exclude` in `vitest.config.ts` (next to `'**/backups/**'`).
- **Verification:** Run `npm run test` and verify 258 test files in `src/` execute in ~42s with 0 failures (eliminating the 26 false-failing files from `tmp/` candidate snapshots).

---

## Phase R2 — P2 Determinism, Manual Entry Guard, and UX Clarity Corrections (COMPLETED)

### Step R2.1: Pin Dividend R1 Ex-Date Policy Check to IST (`UTC+05:30`) (`CA-AUD-004`)
- **Target File:** `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs` (`line 956`)
- **Bounded Change:**
  - Replace `let today = chrono::Local::now().date_naive();` with `let today = chrono::Utc::now().with_timezone(&chrono::FixedOffset::east_opt(5 * 3600 + 30 * 60).expect("valid IST offset")).date_naive();` to match `ensure_official_import_eod_ready` and `dividend_validation_cache::evaluate`.
- **Verification:** Run `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('corporate_action_imports::auto_approval')`.

### Step R2.2: Harden Manual `apply_corporate_action` Against Future Ex-Dates and Duplicate Dividend/Rights Factors (`CA-AUD-005`)
- **Target File:** `src-tauri-shell/src/database/instrument_mutations.rs` (`lines 567-642, 1728-1778`)
- **Bounded Change:**
  - Extend the floating-point factor-equivalence duplicate check in `record_price_adjustment_action_with_basis` (`line 601`) to cover `"DIVIDEND"` and `"RIGHTS"` in addition to `"SPLIT" | "BONUS"`.
  - Reject future `effective_date > today_ist` in `record_price_adjustment_action` when computing price adjustments from local EOD closes.
- **Verification:** Run `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('instrument_mutations')`.

### Step R2.3: Surface Chart Adjustment Toggle Status When Approving Dividends or Rights (`CA-AUD-006`)
- **Target File:** `src/components/DatabaseToolsDialogs.tsx`
- **Bounded Change:**
  - Display a non-intrusive status hint in the Corporate Actions dialog when `includeDividendAdjustments` or `includeRightsAdjustments` is `false` in `chartStore`, informing the operator that approved Dividend/Rights rows are stored in the database and can be visualized by enabling Dividend/Rights adjustments in Chart Settings.
- **Verification:** Focused Vitest UI test.

### Step R2.4: Batch-Wrap CSV Import Transactions and Align NSE/BSE Partial-Window Error Reporting (`CA-AUD-007`)
- **Target Files:**
  - `src-tauri-shell/src/database/corporate_action_imports.rs` (`lines 1354-1445`)
  - `src-tauri-shell/src/database/corporate_action_imports/bse_fetch.rs` (`lines 102-122`)
- **Bounded Change:**
  - Wrap `import_corporate_actions_csv_internal` in a `run_connection_transaction` while retaining per-row `SAVEPOINT corporate_action_import_candidate` so valid rows commit atomically in a single disk flush while malformed rows roll back to their savepoint.
- **Verification:** Run `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('corporate_action_imports')`.

---

## Phase R3 — P2/P3 Maintainability & Test Hygiene Improvements (COMPLETED)

### Step R3.1: Archive Unmounted Donor Workspace (`CorporateActionNormalWorkflowWorkspace.tsx`) (`CA-AUD-008`)
- **Target Files:**
  - `src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx`
  - `src/features/corporateActions/workspace/CorporateActionApproveWorkspace.tsx`
  - `src/features/corporateActions/workflow/corporateActionNormalWorkflowAdapter.ts` (`runNormalWorkflowLoadAndValidate`, `runNormalWorkflowApproveReady`)
- **Bounded Change:** Remove or archive the unmounted donor component and unused runner functions while retaining the shared pure helper functions used by `DatabaseToolsDialogs.tsx`.

### Step R3.2: Replace Brittle `readFileSync` Regex Tests With Behavioral Controller Tests (`CA-AUD-009`, `CA-AUD-010`)
- **Target Files:** `src/features/corporateActions/__tests__/*` and `src/components/DatabaseToolsDialogs.tsx`
- **Bounded Change:** Extract the Corporate Actions dialog readiness and queue-refresh state transitions into a pure TypeScript module and test runtime behavior directly.
