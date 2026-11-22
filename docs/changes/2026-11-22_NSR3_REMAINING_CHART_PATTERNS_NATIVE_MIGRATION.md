# NS-R3 — Complete Native Rust Migration of All Remaining 50 Built-In Chart-Pattern Detectors

- **IST timestamp:** 2026-11-22 03:09 IST (UTC+05:30)
- **Workstream:** `E:\TA Projects\EOD Charting Platform`
- **Source authority:** GitHub/local `main` at commit `19de1c239e5b26497aa9ae96893dbdab7b92700d` plus preserved local worktree changes (including NS-R2 Daily Market native parity)
- **Pre-edit backup:** `backups/pre_opencode_changes_20261122_021134_nsr3-remaining-chart-patterns-native`
- **Objective:** Implement all remaining 50 built-in chart-pattern detectors in the opt-in native Rust scanner with exact behavioral, historical-grouping, metadata, pivot, and overlay geometry parity against the accepted TypeScript implementation (`src/features/chartPatterns/`), while preserving the 4 existing native gap detectors, keeping native OFF by default, and keeping TypeScript as the default and fallback.

## Previous limitation
Only the 4 built-in gap detectors (`chart_common_gap`, `chart_breakaway_gap`, `chart_runaway_gap`, `chart_exhaustion_gap`) were wired into `src-tauri-shell/src/native_scanner/`. Selecting any of the remaining 50 built-in chart-pattern detectors caused `canRunNatively()` to fall back to TypeScript, and `patterns.rs` serialized `ChartPatternFamilyV1::NeutralBilateral` using debug formatting (`"neutralbilateral"` rather than `"neutral-bilateral"`).

## Pattern inventory (54 total: 4 preserved + 50 migrated)
- **Preserved native gap detectors (4):** `chart_common_gap`, `chart_breakaway_gap`, `chart_runaway_gap`, `chart_exhaustion_gap` (`scanner_common_gap.rs`, `scanner_breakaway_gap.rs`, `scanner_runaway_gap.rs`, `scanner_exhaustion_gap.rs`).
- **A. Island Reversals (2 migrated):** `chart_island_reversal_top`, `chart_island_reversal_bottom`.
- **B. Reversal Patterns (11 migrated):** `chart_double_bottom`, `chart_double_top`, `chart_triple_bottom`, `chart_triple_top`, `chart_v_bottom`, `chart_spike_top`, `chart_horn_bottom`, `chart_horn_top`, `chart_bump_run_bottom`, `chart_bump_run_top`, `chart_blow_off_top`.
- **C. Structures & Continuations (27 migrated):** `chart_rectangle_range`, `chart_ascending_triangle`, `chart_descending_triangle`, `chart_symmetrical_triangle`, `chart_falling_wedge_bottom`, `chart_rising_wedge_top`, `chart_diamond_bottom`, `chart_diamond_top`, `chart_diamond_pattern`, `chart_broadening_bottom`, `chart_broadening_formation`, `chart_rising_three_methods`, `chart_falling_three_methods`, `chart_mat_hold_bullish`, `chart_mat_hold_bearish`, `chart_bull_flag`, `chart_bear_flag`, `chart_bull_pennant`, `chart_bear_pennant`, `chart_rising_channel`, `chart_falling_channel`, `chart_high_tight_flag`, `chart_coil_volatility_squeeze`, `chart_three_rising_valleys`, `chart_three_falling_peaks`, `chart_measured_move_up`, `chart_measured_move_down`.
- **D. Complex Bases (10 migrated):** `chart_head_shoulders`, `chart_inverse_head_shoulders`, `chart_complex_head_shoulders`, `chart_cup_handle`, `chart_inverted_cup_handle`, `chart_rounding_bottom`, `chart_adam_eve_bottom`, `chart_adam_eve_top`, `chart_scallop_handle`, `chart_rounding_top`.

## Exact files changed

### Created
- `src-tauri-shell/src/native_scanner/chart_patterns.rs` — full Rust port of chart-pattern primitives (`findLocalPivots`, linear regression slope, touch counting, candle/range helpers), all multi-pattern setup helpers, full overlay geometry builders (zones, pivotMarkers, trendLines, channelBands, curvePoints, labels), per-pattern `min_bars` registry (`PATTERN_SPECS`), and `detect_chart_pattern` dispatch across all 50 patterns.
- `src/features/scanner/fixtures/nativeChartPatterns50ParityFixtures.v1.json` — deterministic TypeScript-derived fixture bundle with a 54-entry pattern manifest (`4` `existing_native_gap` + `50` `migrated_nsr3`) and `156` scenarios (`50` positive, `50` negative, `50` boundary below `minBars`, `2` bilateral directional extras for `chart_diamond_pattern` / `chart_broadening_formation`, and `4` historical grouping scenarios including 270-bar `> MAX_PATTERN_WINDOW_BARS` sliding-window coverage).
- `src/features/scanner/__tests__/nativeChartPatterns50FixtureGenerator.ts` — deterministic fixture generator invoking the real TypeScript detectors via `evaluateChartPatterns` (fixed `generatedAt`: `2026-11-22T00:00:00.000Z`).
- `src/features/scanner/__tests__/nativeChartPatterns50ParityNSR3.test.ts` — Vitest suite verifying fixture integrity, all-54 capability registration, AST compilation (`maxRules = 32`), `> 32`-rule whole-run TypeScript fallback, native opt-in vs default fallback routing, and no partial-result publication on cancellation.
- `docs/changes/2026-11-22_NSR3_REMAINING_CHART_PATTERNS_NATIVE_MIGRATION.md` — this change record.

### Modified
- `src-tauri-shell/src/native_scanner/mod.rs` — exported `pub mod chart_patterns;`.
- `src-tauri-shell/src/native_scanner/ast.rs` — expanded `SUPPORTED_PATTERN_IDS` from 4 gap IDs to all 54 built-in pattern IDs and updated negative AST test target to `"chart_unknown_pattern"` while keeping `MAX_RULES = 32`.
- `src-tauri-shell/src/native_scanner/patterns.rs` — expanded `NATIVE_PATTERN_IDS` to all 54 IDs, wired per-pattern `minimum_bars` and `detect_chart_pattern` dispatch for the 50 migrated patterns while preserving the 4 gap detectors, replaced debug-lowercase family serialization with explicit `pattern_family_wire_text` (`"neutral-bilateral"` for `NeutralBilateral`), and updated dispatch unit test to all 54 IDs.
- `src-tauri-shell/src/native_scanner/parity.rs` — added `as_of_date` filtering to `InlineScanSource::load_bars`, shared recursive semantic JSON/float/scalar/pivot/history comparator, `nsr3_chart_patterns_50_manifest_and_fixtures_are_complete`, and `nsr3_all_156_chart_pattern_scenarios_match_typescript_parity_including_geometry_and_history` (including multi-page bounded 265-bar reverse historical paging test on 270-bar series).
- `src-tauri-shell/src/native_scanner/tests.rs` — added `nsr3_chart_patterns_operational_workers_cancellation_limits_and_ca01_hold` (54 pattern registration, `MAX_RULES = 32`, 33-rule rejection with `missing-rules`, 1-vs-4 worker parity against `ReadOnlyDatabaseSource`, cancellation with zero partial matches, CA-01 HOLD on `PriceBasisV1::Adjusted`) and `nsr3_native_chart_patterns_multi_symbol_benchmark`.
- `src/features/scanner/nativeScanContract.ts` — expanded `NATIVE_SUPPORTED_PATTERN_IDS` and `NATIVE_SUPPORTED_PATTERN_NAMES` to all 54 built-in chart patterns while keeping `NATIVE_SCAN_LIMITS.maxRules = 32`.
- `src/features/scanner/nativeScanAst.ts` — expanded `PATTERN_MIN_BARS` (including exact `13`-bar requirement for `chart_ascending_triangle` and `chart_descending_triangle`) and `PATTERN_CALL_ALIASES` to all 54 patterns.
- `src/plugins/scanner/nativeScannerRun.ts` — enforced `compiled.rules.length <= NATIVE_SCAN_LIMITS.maxRules` gate in `canRunNatively()`, `describeNativeUnsupportedScanners()`, and `describeNativeCapability()`, routing `> 32`-rule batches cleanly to whole-run TypeScript fallback instead of truncating or failing.
- `src/features/scanner/__tests__/nativeScannerParityNS01.test.ts`, `src/features/scanner/__tests__/nativeScannerFixtureGenerator.ts`, `src/features/scanner/fixtures/nativeScannerParityFixtures.v1.json` — updated NS-01 fixtures/assertions from `"chart_head_shoulders"` as unsupported example to `"chart_unknown_pattern"` and updated pattern count expectation from 4 to 54.
- `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, `docs/plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md`, `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`, `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md` — synchronized living documentation while preserving all NS-R2 and historical entries.

## Semantics & subtle parity fixes verified
- **Triangle `min_bars` alignment (`C-4`):** Both `PATTERN_SPECS` (`chart_patterns.rs`) and `PATTERN_MIN_BARS` (`nativeScanAst.ts`) enforce `13` minimum bars for `chart_ascending_triangle` and `chart_descending_triangle` because TypeScript `latestTriangleSetup()` in `src/features/chartPatterns/setups.ts:170-172` evaluates `12` completed setup/consolidation bars strictly preceding the breakout bar (`baseBars = bars.slice(-STRUCTURE_LOOKBACK_BARS - 1, -1); if (baseBars.length < 12) return null;`) plus `1` breakout bar (`latest`), totaling `13` bars (`C-4` verified).
- **Lookback constants & pivot strictness:** Uses exact accepted TypeScript baseline lookbacks (`REVERSAL_LOOKBACK_BARS = 180`, `STRUCTURE_LOOKBACK_BARS = 120`, `CUP_HANDLE_LOOKBACK_BARS = 160`) and strict pivot comparison (`bar.high > neighbor.high` / `bar.low < neighbor.low`).
- **Result metadata (`C-5`):** Preserves absent optional projection fields (`targetPrice`, `stopLossPrice`, `potentialGainPct`, `riskRewardRatio`, `geometry.targetProjection` all `None`/omitted matching `createChartPatternResult` in `src/features/chartPatterns/shared.ts` without speculative calculations), fixed `"neutral-bilateral"` family wire formatting in `patterns.rs`, and verified descending-date canonical match sorting across multi-episode historical grouping.

## Behavior preserved
- Native Rust scanner stays **OFF by default**; TypeScript (`runCoreEodScannerBatch`) remains default and whole-run fallback.
- `NATIVE_SCAN_LIMITS.maxRules = 32` (`MAX_RULES = 32`) is preserved; batches selecting `> 32` native rules cleanly fall back to whole-run TypeScript without truncation.
- Existing 4 gap detectors, 10 Core OHLCV rules, 5 Daily Market rules, Toolbar chart-pattern Web Worker (`evaluation.worker.ts`, `workerClient.ts`), signals/formulas, alert evaluation, external plugin restrictions, and CA-01 adjusted-native HOLD remain intact.
- All pre-existing local worktree changes are preserved untouched.

## Benchmark comparison (20 synthetic symbols × 300 bars × 10 patterns)
Measured locally on identical synthetic datasets (`latest_matches=0`, `historical_matches=60`):
- **TypeScript (`evaluateChartPatterns`, Node v24 V8 JIT-warmed single-thread):** `latest_ms=15.30 ms`, `historical_ms=470.42 ms` (`60` matches).
- **Rust debug test build (`execute_scan`, `worker_count=4`, unoptimized dev/test profile without `--release`):** `latest_ms=24.60 ms`, `historical_ms=2344.20 ms` (`60` matches). Release-profile optimization (`--release`) is left to the user's manual portable build workflow.

## Validation results
1. `rustfmt --edition 2021 --check` across all `src-tauri-shell/src/scanner_*.rs` and `src-tauri-shell/src/native_scanner/*.rs` — **PASS** (`exit 0`).
2. `Invoke-EOD-SharedCargo.ps1 -Mode Preview` + `-Mode Run` (`--bin eod-charting-platform-shell nsr3 -- --nocapture`) — **PASS** (`5 passed; 0 failed; 0 ignored; 1466 filtered out; finished in 2.38s`; `BUILD01_SHARED_CARGO_COMMAND_PASS`).
3. `Invoke-EOD-SharedCargo.ps1 -Mode Preview` + `-Mode Run` (`--bin eod-charting-platform-shell native_scanner`) — **PASS** (`123 passed; 0 failed; 0 ignored; 1348 filtered out; finished in 5.18s`; `BUILD01_SHARED_CARGO_COMMAND_PASS`).
4. `Invoke-EOD-SharedCargo.ps1 -Mode Preview` + `-Mode Run` (`--bin eod-charting-platform-shell scanner_`) — **PASS** (`18 passed; 0 failed; 0 ignored; 1453 filtered out; finished in 0.05s`; `BUILD01_SHARED_CARGO_COMMAND_PASS`).
5. `Invoke-EOD-SharedCargo.ps1 -Mode Preview` + `-Mode Run -CargoAction check` — **PASS** (`exit 0`, `BUILD01_SHARED_CARGO_COMMAND_PASS`; finished in `11.68s`; 1 pre-existing dead-code warning in `src/bhavcopy/calendar.rs`).
6. Focused 9-file Vitest run (including `nativeChartPatterns50ParityNSR3.test.ts` without `GENERATE_NSR3_FIXTURES`, `nativeScannerParityNS01.test.ts`, `nativeDailyMarketParityNSR2.test.ts`, `nativeScannerRunNS04.test.ts`, `nativeCoreLatestRoutingNSR2.test.ts`, `chartPatternScanners.test.ts`, `chartPatternChannels.test.ts`, `nativeIntegration.test.ts`, `toolbarChartPatternWorkerCHIP01.test.ts`) — **PASS** (`9 files, 216 passed (216)`).
7. Broader scanner + chart-pattern Vitest run (`src/features/scanner/ src/plugins/scanner/__tests__/ src/features/chartPatterns/__tests__/ src/components/__tests__/ScannerChartRouting.test.ts`) — **PASS** (`exit 0`, `29 passed (29)`, `345 passed (345)` after NS-R2 `en-IN` C-1 resolution).
8. `npm.cmd run typecheck:renderer` — **PASS** (`exit 0`).
9. `npm.cmd run build:renderer` — **PASS** (`exit 0`, `851 modules transformed`, `built in 7.12s`).
10. `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/check-doc-references.ps1` — **PASS** (`exit 0`, `[PASS] Live documentation references are valid.`).

## Risks and remaining acceptance
- Live Windows portable EXE acceptance against real NSE/BSE `.eod` databases (and release-profile multi-symbol benchmarking) remains pending manual portable build by the user.
- Unmigrated families (visual/custom signals, user formulas, alert engine triggers, external plugins) and CA-01 adjusted-native HOLD remain outside native scope (`NS-R4`..`NS-R9`).

## Rollback
Restore the modified files from `backups/pre_opencode_changes_20261122_021134_nsr3-remaining-chart-patterns-native` (with explicit user approval) and delete the newly created NS-R3 files without resetting unrelated worktree modifications.
