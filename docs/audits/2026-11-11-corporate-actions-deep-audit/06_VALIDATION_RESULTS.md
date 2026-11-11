# Corporate Actions Deep Audit — Validation & Test Execution Matrix

**Audit Timestamp:** 2026-11-11 IST  
**Authorized Root:** `E:\TA Projects\EOD Charting Platform`  
**Local HEAD:** `e8664382c116b96bce1d105a9b9fa837175d77a0`

---

## 1. Frontend & Typecheck Validation Summary (Authorization C)

| # | Check / Suite | Exact Command Executed | Exit Code | Files Passed / Total | Tests Passed / Total | Duration | Verdict | Log Path |
|---|---|---|---|---|---|---|---|---|
| 1 | **Renderer TypeScript Typecheck** | `npm.cmd run typecheck:renderer` (`tsc -p tsconfig.json --noEmit`) | `0` | All `src/` TS/TSX files | N/A | 3.1s | **PASS** | `logs/typecheck_renderer.txt` |
| 2 | **Corporate Actions Renderer Suite (`src/` scoped)** | `npx.cmd vitest run --dir src/features/corporateActions` | `0` | **73 / 73** (0 failed) | **571 / 571** (0 failed) | 9.39s | **PASS** | `logs/vitest_src_corporate_actions_only.txt` |
| 3 | **Related Renderer Suites (`identityRecovery` + `chartDataIntegrity`)** | `npx.cmd vitest run --dir src src/features/identityRecovery src/platform/__tests__/chartDataIntegrity.test.ts` | `0` | **4 / 4** (0 failed) | **43 / 43** (0 failed) | 1.47s | **PASS** | `logs/vitest_related_suites.txt` |
| 4 | **Entire Authoritative `src/` Test Suite** | `npx.cmd vitest run --dir src` | `0` | **257 passed, 1 skipped / 258** (0 failed) | **1,783 passed, 1 skipped / 1,784** (0 failed) | 42.11s | **PASS** | `logs/vitest_all_src.txt` |
| 5 | **Unscoped Vitest Run (Demonstrates `CA-AUD-003`)** | `npx.cmd vitest run src/features/corporateActions` (without `--dir src`) | `1` | 615 passed, **26 failed in `tmp/`** / 641 | 4,817 passed, **34 failed in `tmp/`** / 4,851 | 92.32s | **FAIL (`tmp/` snapshot collision)** | `logs/vitest_corporate_actions.txt` |

### Key Observation on Historical vs. Current Frontend Results
- Historical observation noted an earlier Corporate Actions full-suite run with `524 passing and 11 failing tests`.
- Current authoritative `src/features/corporateActions` suite has **73 test files and 571 tests, with 571 passing and 0 failing**.
- Across the entire active `src/` directory, **all 257 active test files (1,783 tests) pass with 0 failures**.
- The only test failures produced by `npx vitest run` without `--dir src` come from stale worktree copies inside `tmp/` (`tmp/UI8_BaselineProof_20261105_003625_IST`, `tmp/ux13-936ac0b/candidate`, `tmp/UX13_PR_Promotion_20261105_152505_IST`, `tmp/UX13_PR23_20261106_001316_IST`) and `backups/`, documented as Finding **`CA-AUD-003`**.

---

## 2. Backend Rust Validation Summary (Authorization E — `BUILD-01` Shared Cargo Runner)

All Rust test executions used `scripts/Invoke-EOD-SharedCargo.ps1` (`-Mode Preview` followed by `-Mode Run` serially) against the shared `E:\TA Projects\EOD Charting Platform\target` directory with `--offline --locked`. All executed tests used isolated in-memory SQLite (`Connection::open_in_memory()`) or `tempfile::tempdir()` fixtures with zero production database access.

| # | Rust Module Filter | Exact Command Executed | Exit Code | Passed | Failed | Ignored (Opt-in Live / Disposable Copy) | Duration | Verdict | Log Path |
|---|---|---|---:|---:|---:|---:|---|---|---|
| 1 | `corporate_action_imports` | `pwsh -NoProfile -ExecutionPolicy Bypass -Command "& .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('corporate_action_imports')"` | `0` | **565** | **0** | 19 | 9.83s | **PASS** | `logs/cargo_test_corporate_action_imports.txt` |
| 2 | `instrument_mutations` | `pwsh -NoProfile -ExecutionPolicy Bypass -Command "& .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('instrument_mutations')"` | `0` | **22** | **0** | 0 | 0.49s | **PASS** | `logs/cargo_test_instrument_mutations.txt` |
| 3 | `corporate_action_history` | `pwsh -NoProfile -ExecutionPolicy Bypass -Command "& .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('corporate_action_history')"` | `0` | **4** | **0** | 0 | 0.10s | **PASS** | `logs/cargo_test_corporate_action_history.txt` |
| 4 | `price_store_operation_lock` | `pwsh -NoProfile -ExecutionPolicy Bypass -Command "& .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('price_store_operation_lock')"` | `0` | **3** | **0** | 0 | 0.01s | **PASS** | `logs/cargo_test_price_store_operation_lock.txt` |
| 5 | `eod_data::tests` (Chart Adjustments & Rename Chains) | `pwsh -NoProfile -ExecutionPolicy Bypass -Command "& .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('eod_data::tests')"` | `0` | **16** | **0** | 1 | 0.05s | **PASS** | `logs/cargo_test_eod_data.txt` |
| 6 | `nse_identity_imports` | `pwsh -NoProfile -ExecutionPolicy Bypass -Command "& .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('nse_identity_imports')"` | `0` | **122** | **0** | 2 | 0.67s | **PASS** | `logs/cargo_test_nse_identity_imports.txt` |
| 7 | `bse_identity_imports` | `pwsh -NoProfile -ExecutionPolicy Bypass -Command "& .\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('bse_identity_imports')"` | `0` | **30** | **0** | 2 | 0.94s | **PASS** | `logs/cargo_test_bse_identity_imports.txt` |
| **Total** | **All 7 Corporate Actions & Identity Rust Suites** | Serial `Invoke-EOD-SharedCargo.ps1` runs | **`0`** | **`762`** | **`0`** | **`24`** | **12.09s** | **PASS (762 / 762)** | `logs/cargo_test_*.txt` |

---

## 3. Deferred Validation (Authorization D)

- `npm run build:renderer` (Vite production bundle build) was explicitly deferred per user instruction until audit findings establish necessity. Since `npm run typecheck:renderer` and all 257 `src/` Vitest suites passed with 0 errors and no source changes were made, a renderer bundle build was not required.
