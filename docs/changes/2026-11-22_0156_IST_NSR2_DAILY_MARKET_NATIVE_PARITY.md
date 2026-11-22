# NS-R2 — Native Rust Daily Market Scanner Migration and Parity

- **IST timestamp:** 2026-11-22 01:56 IST (UTC+05:30)
- **Workstream:** `E:\TA Projects\EOD Charting Platform`
- **Source authority:** GitHub/local `main` at commit `19de1c239e5b26497aa9ae96893dbdab7b92700d`
- **Pre-edit backups:** `backups/pre_opencode_changes_20261122_013745_nsr2-daily-market-native-parity` (11 files), `backups/pre_opencode_changes_20261122_114536_nsr2-volume-surge-enin-parity` (12 files)
- **Objective:** Implement all five Daily Market scanner rules (`top_gainers`, `top_losers`, `volume_surge`, `high_52w`, `low_52w`) in the opt-in native Rust scanner with result and deterministic `en-IN` reason formatting parity against the TypeScript implementation (`src/plugins/scanner/dailyMarketScanners.ts`), while preserving TypeScript as the default and fallback. (**Resolved C-1:** replaced un-parameterized `.toLocaleString()` and Rust 3-digit grouping with deterministic `en-IN` formatting matching application policy across `Renderer.ts` / `ChartPriceLegendOverlay.tsx` / `DatabaseToolsDialogs.tsx`.)

## Previous limitation
Daily Market scanners (`top_gainers`, `top_losers`, `volume_surge`, `high_52w`, `low_52w`) were routed strictly to TypeScript fallback even when the user opted into the native Rust scanner backend, because neither `nativeCoreRuleExpressions.ts` / `nativeCoreResultMetadataGate.ts` / `nativeScannerRun.ts` nor `src-tauri-shell/src/native_scanner/` implemented Daily Market canonical AST validation, evaluation, warm-up accounting, or result metadata construction.

## Exact files changed

### Created
- `src/features/scanner/fixtures/nativeDailyMarketParityFixtures.v1.json` — 40 deterministic parity cases across all 5 Daily Market rules (`top_gainers`, `top_losers`, `volume_surge` including independent lakh/crore `en-IN` cases, `high_52w`, `low_52w`).
- `src/features/scanner/__tests__/nativeDailyMarketFixtureGenerator.ts` — deterministic fixture generator invoking `runDailyMarketScanner`, `compileNativeDailyMarketCandidate`, and asserting independent lakh/crore `en-IN` reason expectations.
- `src/features/scanner/__tests__/nativeDailyMarketParityNSR2.test.ts` — 46 Vitest tests covering fixture parity, metadata gate checks, routing/mixed selection, All History & alert fallback, malformed metadata rejection, short-history skip accounting, and deterministic thousand/lakh/crore `en-IN` reason formatting.
- `docs/changes/2026-11-22_0156_IST_NSR2_DAILY_MARKET_NATIVE_PARITY.md` — this change record.

### Modified
- `src/features/scanner/nativeCoreRuleExpressions.ts` — added `NATIVE_DAILY_MARKET_CANDIDATE_IDS`, `compileNativeDailyMarketCandidate`, and `compileNativeBuiltInCandidate` while preserving `NATIVE_CORE_CANDIDATE_IDS` and `compileNativeCoreCandidate` for the 10 core OHLCV rules.
- `src/features/scanner/nativeCoreResultMetadataGate.ts` — added `isNativeDailyMarketResultId`, `isNativeBuiltInResultId`, and fail-closed metadata validation in `nativeCoreResultMetadataIssue` for all 5 Daily Market scanners (actual handler columns, directions including `volume_surge` sign checks, `EODScannerPlugin_v1` source, single non-empty reason, no invented score/pattern/history).
- `src/plugins/scanner/dailyMarketScanners.ts` — changed `volume_surge` `toLocaleString()` calls (`line 210`) to deterministic `.toLocaleString('en-IN')` matching the application locale policy (`C-1`) while preserving all calculations, thresholds, High/Low 52-week logic (`C-2`), and `0%` change direction (`C-3`).
- `src/plugins/scanner/nativeScannerRun.ts` — extended `splitNativeRunnableScannerIds`, `compileNativeScannerRules`, `canRunNatively`, `describeNativeUnsupportedScanners`, `describeNativeCapability`, and `toScannerResult` (`warnings: []`) to support bounded/latest-only Daily Market native runs alongside the 10 core OHLCV rules and 4 gap patterns.
- `src-tauri-shell/src/native_scanner/core_results.rs` — added `expected_daily_market_expression`, `is_daily_market_id`, `minimum_bars_for_daily_market_id`, `calculate_daily_market_metrics`, `format_js_fixed_2`, `format_locale_en_in` (`en-IN` lakh/crore grouping), `evaluate_daily_market_rule`, extended `validate_core_rule` (enforcing canonical AST and `evaluate_history == false`), and expanded Rust unit tests (`daily_market_formatting_matches_js_fixed_and_grouping_rules`).
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
1. `rustfmt --edition 2021 --check` across all `src-tauri-shell/src/native_scanner/*.rs` + `src-tauri-shell/src/scanner_*.rs` — **PASS** (`exit code 0`).
2. `Invoke-EOD-SharedCargo.ps1 -Mode Preview` + `-Mode Run -CargoAction test -CargoArguments @('--bin', 'eod-charting-platform-shell', 'native_scanner')` — **PASS** (`123 passed; 0 failed; 0 ignored; 1348 filtered out; finished in 5.24s`; 1 pre-existing warning in `src/bhavcopy/calendar.rs`; includes `nsr2_daily_market_*` over all 40 cases).
3. `Invoke-EOD-SharedCargo.ps1 -Mode Preview` + `-Mode Run -CargoAction test -CargoArguments @('--bin', 'eod-charting-platform-shell', 'scanner_')` — **PASS** (`18 passed; 0 failed; 0 ignored; 1453 filtered out; finished in 0.05s`).
4. `Invoke-EOD-SharedCargo.ps1 -Mode Preview` + `-Mode Run -CargoAction check` — **PASS** (`Finished dev profile [unoptimized + debuginfo] target(s) in 11.61s`, `BUILD01_SHARED_CARGO_COMMAND_PASS`; 1 pre-existing warning in `src/bhavcopy/calendar.rs:160`, 0 scanner warnings).
5. `npx.cmd vitest run src/features/scanner/__tests__/nativeDailyMarketParityNSR2.test.ts` — **PASS** (`46/46` tests, including thousand/lakh/crore `en-IN` parity).
6. `npx.cmd vitest run src/features/scanner/ src/plugins/scanner/__tests__/ src/features/chartPatterns/__tests__/ src/components/__tests__/ScannerChartRouting.test.ts` — **PASS** (`29 files / 345 passed`).
7. `npm.cmd run typecheck:renderer` — **PASS** (`exit code 0`).
8. `npm.cmd run build:renderer` — **PASS** (`exit code 0`, `851 modules transformed`, `built in 7.12s`).

## Specification & Edge-Case Decisions (`C-1`..`C-3`) & Remaining Acceptance
- **`volume_surge` `en-IN` locale parity (`C-1` — RESOLVED):** Both TypeScript (`dailyMarketScanners.ts:210` `.toLocaleString('en-IN')`) and Rust (`core_results.rs:560` `format_locale_en_in`) now deterministically format `volume_surge` reason integers/3-decimal numbers with Indian lakh/crore digit grouping matching the rest of the application (`Renderer.ts`, `ChartPriceLegendOverlay.tsx`, `DatabaseToolsDialogs.tsx`, `StatusBar.tsx`). Verified at `< 100,000`, lakh (`1,50,000 vs 1,00,000`), and crore (`1,23,45,678 vs 12,50,000`) scales.
- **`high_52w` / `low_52w` (`C-2` — PRESERVED / FOLLOW-UP DOCUMENTED):** Preserves executable High/Low detection (`today.high >= maxHigh`, `today.low <= minLow`). Upstream `.eod` validation (`record_to_bar` in `reader.rs:123-134`), 252-bar finite lookback guards (`core_results.rs:753-761, 800-808`), and finite-quotient `add_number` checks prevent non-finite `dist_52w_pct` division errors. Discrepancy between executable High/Low logic and `dailyMarketScanners.ts` `logicText` (`Close >= Highest(High, 252)` / `Close <= Lowest(Low, 252)`) is recorded for a separate bounded correction.
- **`volume_surge` `0%` change direction (`C-3` — PRESERVED / FOLLOW-UP DOCUMENTED):** Preserves `'bullish'` classification when `changePercent === 0` (`>= 0`); proposed `'neutral'` classification is recorded separately for downstream compatibility assessment.
- **Not yet completed / out of scope:** Full Rust workspace suite, full Vitest suite, GitHub Actions CI after publishing updated commits, and consolidated Windows portable EXE acceptance against live `.eod` databases. **TypeScript scanner retirement is NOT complete** (`NS-R3`..`NS-R9` remain separate/open).

## Rollback
Restore modified files from `backups/pre_opencode_changes_20261122_013745_nsr2-daily-market-native-parity` / `backups/pre_opencode_changes_20261122_114536_nsr2-volume-surge-enin-parity` (with explicit approval) and remove newly created files without resetting unrelated worktree entries.
