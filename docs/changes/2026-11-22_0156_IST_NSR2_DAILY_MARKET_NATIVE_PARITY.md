# NS-R2 — Native Rust Daily Market Scanner Migration and Parity

- **IST timestamp:** 2026-11-22 01:56 IST (UTC+05:30)
- **Workstream:** `E:\TA Projects\EOD Charting Platform`
- **Source authority:** GitHub/local `main` at commit `19de1c239e5b26497aa9ae96893dbdab7b92700d`
- **Pre-edit backup:** `backups/pre_opencode_changes_20261122_013745_nsr2-daily-market-native-parity` (11 files)
- **Objective:** Implement all five Daily Market scanner rules (`top_gainers`, `top_losers`, `volume_surge`, `high_52w`, `low_52w`) in the opt-in native Rust scanner targeting result and metadata parity against the accepted TypeScript implementation (`src/plugins/scanner/dailyMarketScanners.ts`), while preserving TypeScript as the default and fallback. (**Open Merge Blocker:** `volume_surge` reason strings for volumes `>= 100,000` diverge between locale-sensitive `toLocaleString()` on `en-IN` hosts and Rust 3-digit grouping; complete metadata parity is **NOT claimed** while unresolved.)

## Previous limitation
Daily Market scanners (`top_gainers`, `top_losers`, `volume_surge`, `high_52w`, `low_52w`) were routed strictly to TypeScript fallback even when the user opted into the native Rust scanner backend, because neither `nativeCoreRuleExpressions.ts` / `nativeCoreResultMetadataGate.ts` / `nativeScannerRun.ts` nor `src-tauri-shell/src/native_scanner/` implemented Daily Market canonical AST validation, evaluation, warm-up accounting, or result metadata construction.

## Exact files changed

### Created
- `src/features/scanner/fixtures/nativeDailyMarketParityFixtures.v1.json` — 38 deterministic TypeScript-derived parity cases across all 5 Daily Market rules (`top_gainers`, `top_losers`, `volume_surge`, `high_52w`, `low_52w`).
- `src/features/scanner/__tests__/nativeDailyMarketFixtureGenerator.ts` — deterministic fixture generator invoking `runDailyMarketScanner` and `compileNativeDailyMarketCandidate`.
- `src/features/scanner/__tests__/nativeDailyMarketParityNSR2.test.ts` — 44 Vitest tests covering fixture parity, metadata gate checks, routing/mixed selection, All History & alert fallback, malformed metadata rejection, short-history skip accounting, and explicit pinning of the `< 100,000` vs `>= 100,000` `volume_surge` locale merge blocker.
- `docs/changes/2026-11-22_0156_IST_NSR2_DAILY_MARKET_NATIVE_PARITY.md` — this change record.

### Modified
- `src/features/scanner/nativeCoreRuleExpressions.ts` — added `NATIVE_DAILY_MARKET_CANDIDATE_IDS`, `compileNativeDailyMarketCandidate`, and `compileNativeBuiltInCandidate` while preserving `NATIVE_CORE_CANDIDATE_IDS` and `compileNativeCoreCandidate` for the 10 core OHLCV rules.
- `src/features/scanner/nativeCoreResultMetadataGate.ts` — added `isNativeDailyMarketResultId`, `isNativeBuiltInResultId`, and fail-closed metadata validation in `nativeCoreResultMetadataIssue` for all 5 Daily Market scanners (actual handler columns, directions including `volume_surge` sign checks, `EODScannerPlugin_v1` source, single non-empty reason, no invented score/pattern/history).
- `src/plugins/scanner/nativeScannerRun.ts` — extended `splitNativeRunnableScannerIds`, `compileNativeScannerRules`, `canRunNatively`, `describeNativeUnsupportedScanners`, `describeNativeCapability`, and `toScannerResult` (`warnings: []`) to support bounded/latest-only Daily Market native runs alongside the 10 core OHLCV rules and 4 gap patterns.
- `src-tauri-shell/src/native_scanner/core_results.rs` — added `expected_daily_market_expression`, `is_daily_market_id`, `minimum_bars_for_daily_market_id`, `calculate_daily_market_metrics`, `format_js_fixed_2`, `format_locale_3_group`, `evaluate_daily_market_rule`, extended `validate_core_rule` (enforcing canonical AST and `evaluate_history == false`), and added Rust unit tests.
- `src-tauri-shell/src/native_scanner/scan.rs` — wired Daily Market per-rule warm-up (`2` bars for `top_gainers`/`top_losers`, `21` bars for `volume_surge`, `20` bars for `high_52w`/`low_52w`) in `required_bars_for_rule` and latest-only dispatch to `evaluate_daily_market_rule` in `scan_target`.
- `src-tauri-shell/src/native_scanner/parity.rs` — extracted shared `assert_record_matches_expected` and added `nsr2_daily_market_result_metadata_and_outcomes_match_typescript_fixtures` plus `nsr2_daily_market_batch_handles_mixed_rules_errors_cancellation_and_worker_counts`.
- `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, `docs/plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md`, `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`, `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md` — synchronized living documentation.

## Implementation summary
- **Zero schema/dependency changes:** Reused the existing `NativeExprV1` contract (`src/features/scanner/nativeScanContract.ts` and `src-tauri-shell/src/native_scanner/ast.rs`) by assigning each Daily Market scanner a unique canonical `NativeExprV1` AST validated by both TS and Rust.
- **Exact TypeScript handler semantics (`dailyMarketScanners.ts`):**
  - `top_gainers` / `top_losers`: require `>= 2` completed bars, finite `today.close > 0`, `yesterday.close > 0`, `today.volume >= 0`, finite `absoluteChange` and `changePercent = ((today.close - yesterday.close) / yesterday.close) * 100`. Strictly `> 0` (`bullish`) for `top_gainers` and `< 0` (`bearish`) for `top_losers`. Emits `close`, `prev_close`, `change_pct`, `change_amt`, `volume` and `Gained +...` / `Lost ...` reason formatted via `format_js_fixed_2`.
  - `volume_surge`: requires `>= 21` completed bars, valid daily metrics, and 20 valid finite nonnegative volumes strictly excluding the current bar, with positive 20-day average volume and `today.volume / avgVolume >= 1.5`. Direction is `bullish` when `changePercent >= 0` (including `0%`) and `bearish` when `changePercent < 0`. Emits `volume`, `avg_volume_20`, `vol_ratio`, `change_pct`.
  - `high_52w` / `low_52w`: evaluate `period = bars.len().min(252)` with minimum `20` bars, comparing `today.high >= maxHigh` (`high_52w`, `bullish`) and `today.low <= minLow` (`low_52w`, `bearish`) across `&bars[bars.len() - period..]`, falling back to `change_pct = 0` when daily metrics are null. Emits `close`, `high_52w`/`low_52w`, `dist_52w_pct`, `change_pct` and `Session high/low (...) hit the {period}-bar (52-week) high/low of ...` reason using `format_js_number`.

## Behavior preserved
- Native scanner remains **OFF by default**; TypeScript (`runCoreEodScannerBatch`) remains the default and whole-run fallback.
- Existing 10 Core OHLCV rules, 4 Gap Pattern detectors, other chart-pattern families, signals/formulas, alert evaluation, and external plugin boundaries remain unchanged.
- Daily Market `evaluateHistory: true` selections, alert-bearing selections, and mixed unsupported selections retain whole-run TypeScript fallback before native invocation; Rust `validate_core_rule` independently fails closed if historical evaluation or a forged AST reaches IPC.
- CA-01 adjusted-native HOLD, read-only database ownership/revision checks, cancellation, and raw `.eod` immutability are untouched.
- Pre-existing local worktree modifications and untracked docs (`src-tauri-shell/gen/build-info.json`, `src/styles/theme-tokens.generated.css`, `docs/audits/18-11-2026 Audit and Upgrade/`, `docs/changes/2026-11-18_0356_IST_CA01_BSE_T0_CORPORATE_ACTION_ISOLATION.md`, `docs/changes/2026-11-21_1915_IST_CHART_WHEEL_ZOOM_AND_SCROLLBAR_SYNC.md`) are preserved.

## Validation results
1. `rustfmt --edition 2021 --check` on `core_results.rs`, `scan.rs`, `parity.rs` and across all `src-tauri-shell/src/native_scanner/*.rs` + `src-tauri-shell/src/scanner_*.rs` — **PASS** (exit code `0`).
2. `pwsh -NoProfile -ExecutionPolicy Bypass -Command "& '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Preview -CargoAction test -CargoArguments @('native_scanner')"` — **PASS** (exit code `0`, `BUILD01_SHARED_CARGO_PREVIEW_PASS_NO_BUILD_NO_CHANGES`).
3. `pwsh -NoProfile -ExecutionPolicy Bypass -Command "& '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Run -CargoAction test -CargoArguments @('native_scanner')"` — **PASS** (exit code `0`, `119 passed; 0 failed; 0 ignored; 1348 filtered out; finished in 3.91s`; 1 pre-existing warning in `src/bhavcopy/calendar.rs`).
4. `pwsh -NoProfile -ExecutionPolicy Bypass -Command "& '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Preview -CargoAction test -CargoArguments @('scanner_')"` — **PASS** (exit code `0`).
5. `pwsh -NoProfile -ExecutionPolicy Bypass -Command "& '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Run -CargoAction test -CargoArguments @('scanner_')"` — **PASS** (exit code `0`, `18 passed; 0 failed; 0 ignored; 1449 filtered out; finished in 0.05s`).
6. `pwsh -NoProfile -ExecutionPolicy Bypass -Command "& '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Preview -CargoAction check"` + `-Mode Run` — **PASS** (exit code `0`, `BUILD01_SHARED_CARGO_COMMAND_PASS`; 1 pre-existing warning in `src/bhavcopy/calendar.rs`).
7. `& .\node_modules\.bin\vitest.cmd run src/features/scanner/__tests__/nativeDailyMarketParityNSR2.test.ts` — **PASS** (`44/44` passed after adding the `< 100,000` vs `>= 100,000` `volume_surge` locale test); broader `src/features/scanner/ src/plugins/scanner/__tests__/` (`25 files`) previously passed (`312/312`, before adding the 44th test case).
8. `& .\node_modules\.bin\vitest.cmd run src/features/marketMovers/ src/components/__tests__/ScannerChartRouting.test.ts` — **PASS** (exit code `0`, `4 passed (4)`, `33 passed (33)`).
9. `npm.cmd run typecheck:renderer` — **PASS** (exit code `0`).
10. `npm.cmd run build:renderer` — **PASS** (exit code `0`, `851 modules transformed`, `built in 6.36s`).

## Risks and remaining acceptance
- **`volume_surge` locale grouping (`en-IN` vs `en-US`) — UNRESOLVED MERGE BLOCKER:** In `src/plugins/scanner/dailyMarketScanners.ts:210`, `volume_surge` formats `today.volume.toLocaleString()` and `Math.round(avgVolume).toLocaleString()` without a locale tag. On Windows systems running `en-IN` locale, volumes `>= 100,000` format with lakh/crore grouping (`1,50,000`) in TypeScript while Rust `format_locale_3_group` uses fixed 3-digit comma grouping (`150,000`), matching `en-US` / CI. Complete NS-R2 metadata parity is **NOT claimed** while this divergence remains unresolved; resolve the intentional locale policy before merging NS-R2. Shared fixtures and `< 100,000` focused test verify identical 3-digit grouping below `100,000`, and numeric `values` / match decisions agree across all scales.
- **Not yet completed / out of scope:** Full Rust workspace suite, full Vitest suite, GitHub Actions CI run on a pushed branch, and live Windows portable EXE acceptance against a real `.eod` database were not run in this task. **TypeScript scanner retirement is NOT complete** (NS-R3 through NS-R9 remain open).

## Rollback
Restore the 11 modified existing files from `backups/pre_opencode_changes_20261122_013745_nsr2-daily-market-native-parity` (with explicit approval) and remove the four newly created files. Do not reset or clean unrelated local worktree changes.
