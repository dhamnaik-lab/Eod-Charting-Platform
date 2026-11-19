# RSC-06 — Isolated Native Rust Exhaustion Gap Parity Detector

- **IST timestamp:** 2026-11-20 00:10 IST (initial implementation); finalized and re-validated 2026-11-20 01:30 IST (UTC+05:30)
- **Active workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`
- **Verified source baseline:** `8ebd7d29c01b4612877eb98172397cf416c79730` (`main` after PR #122)
- **Feature branch:** `feature/rsc06-exhaustion-gap-20261120`
- **Status:** **Implemented and validated locally — pending independent GitHub PR acceptance.** Feature branch `feature/rsc06-exhaustion-gap-20261120` (from `main` `8ebd7d29c01b4612877eb98172397cf416c79730`), re-validated 2026-11-20 01:30 IST; native scanner execution remains inactive (no Tauri IPC registration, no live dispatch).

## 1. Objective and Original Limitation

Prior to RSC-06, `chart_breakaway_gap` (RSC-02), `chart_common_gap` (RSC-04), and `chart_runaway_gap` (RSC-05) were ported into isolated Rust modules with TypeScript-derived parity fixtures, while `chart_exhaustion_gap` (`Exhaustion Gap`) remained TypeScript-only in `src/features/chartPatterns/handlers/gaps.ts`. The objective of RSC-06 is to finalize and validate the isolated Rust implementation of `chart_exhaustion_gap` with deterministic TypeScript/Rust parity across positive, boundary, negative, and historical scenarios while keeping live scanner routing, UI, workers, database, `.eod` storage, and Cargo dependencies unchanged, and to publish the authorized seven-file scope for independent PR review before NS-01.

## 2. Exact Seven-File Commit Scope and Inspected Sources

### Inspected (unchanged)
- `AGENTS.md`, `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, `package.json`, `scripts/Invoke-EOD-SharedCargo.ps1`, `scripts/check-doc-references.ps1`
- `src/features/chartPatterns/handlers/gaps.ts`, `primitives.ts`, `shared.ts`, `geometry.ts`, `constants.ts`, `setups.ts`, `definitions.ts`, `evaluation.ts`
- `src/features/scanner/rustScannerContract.ts`
- `src/features/scanner/__tests__/parityFixtureHarness.ts`, `runawayGapParityRSC05.test.ts`, `commonGapParityRSC04.test.ts`, `breakawayGapParityRSC02.test.ts`, `rustScannerContractRSC01.test.ts`, `scannerParityHarnessRSC03.test.ts`
- `src-tauri-shell/src/scanner_contract.rs`, `scanner_breakaway_gap.rs`, `scanner_common_gap.rs`, `scanner_runaway_gap.rs`
- `docs/audits/18-11-2026 Audit and Upgrade/EOD_Rust_Scanner_Architecture_Implementation_Plan_2026-11-18_IST.md`

### Created (Authorized New Files 1–4)
1. `src-tauri-shell/src/scanner_exhaustion_gap.rs`: isolated `detect_chart_exhaustion_gap` detector, `evaluate_chart_exhaustion_gap_request_v1` request/history evaluator, internal cancellation-envelope support (`evaluate_chart_exhaustion_gap_request_with_cancel`), fail-closed `scanner_ids` and `contract_version` validation, and Rust parity/edge unit tests.
2. `src/features/scanner/fixtures/exhaustionGapParityFixtures.v1.json`: **17 TypeScript-derived deterministic parity scenarios** generated directly via `evaluateRustScannerContractRequestV1` across `positive` (2), `boundary` (3), `negative` (9), and `historical` (3) categories.
3. `src/features/scanner/__tests__/exhaustionGapParityRSC06.test.ts`: Vitest suite verifying all 17 scenarios through `assertScannerParityFixtureBundle`, direct `runChartPatternScanner` comparison, `generatedAt` UTC fallback (`''` and `undefined`), duplicate `scannerIds` deduplication, 50-endpoint progress boundaries, and mid-history cancellation-envelope semantics.
4. `docs/changes/2026-11-20_0010_IST_RSC06_EXHAUSTION_GAP_PARITY.md`: this dated change record.

### Modified (Authorized Modified Files 5–7)
5. `src-tauri-shell/src/main.rs`: declared `#[allow(dead_code)] mod scanner_exhaustion_gap;`. No Tauri command registered.
6. `HANDOFF.md`: updated RSC-06 status (`Implemented and validated locally — pending independent GitHub PR acceptance`), fresh validation outputs, backup inventory, and NS-01 next milestone.
7. `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`: updated RSC-06 milestone status and designated `NS-01 — Native Read-Only Scanner Core` as the next planned development milestone after PR acceptance.

### Pre-Edit Backup and Scratch
- Pre-edit backups:
  - Final validation & documentation: `backups/pre_opencode_changes_20261120_011742_rsc06-final-validation` (all 7 RSC-06 files).
  - Initial: `backups/pre_opencode_changes_20261120_000001_rsc06-exhaustion-gap-parity` (`src-tauri-shell/src/main.rs`, `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`).
  - Review hardening: `backups/pre_opencode_changes_20261120_002309_rsc06-review-hardening` (`src-tauri-shell/src/scanner_exhaustion_gap.rs`, `src/features/scanner/__tests__/exhaustionGapParityRSC06.test.ts`, `docs/changes/2026-11-20_0010_IST_RSC06_EXHAUSTION_GAP_PARITY.md`, `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`).
- Disposable fixture-generation workspace (TMP-01): `tmp/disposable/rsc06gen_9d43dace3cf04a798e7ae6476781fbe3`.

## 3. Implementation Details

- Reused `scanner_breakaway_gap` helpers (`gap_up_pct`, `average_volume_excluding_current`, `round_js`, `scalar_number_v1`, `format_js_number`, `normalize_zero`, `CHART_GAP_CATEGORY_ID`, `CHART_GAP_CATEGORY_NAME`, `CHART_PATTERN_SCANNER_SOURCE`) and `scanner_contract` types/sorting (`sort_scanner_results_v1`, `RustScannerEvaluationRequestV1`, `RustScannerEvaluationResponseV1`, etc.) without modifying `scanner_breakaway_gap.rs`, `scanner_contract.rs`, or adding new shared abstractions.
- Preserved exact TypeScript `chart_exhaustion_gap` behavior:
  - Minimum 22 bars (`bars.len() >= 22`) and finite-value guards on bar inputs.
  - `gap_up_pct(today, previous)` rounded to 2 decimals via `round_js(..., 2)` before checking `>= 0.25`.
  - Prior 20-bar trend window `bars[len - 22 .. len - 2]` (`bars.slice(-22, -2)`) with unrounded `move_pct >= 12.0` (`hasUpTrend(trendBars, 12)`), plus `trend_bars[0].close > 0.0`.
  - Average prior 20-bar volume excluding current bar (`bars[len - 21 .. len - 1]`), rejecting `avg_volume <= 0.0` and requiring `today.volume >= avg_volume * 2.0`.
  - Strict bearish rejection `today.close < today.open` (rejecting `close >= open`, including equal open/close doji).
  - Fixed `"bearish"` direction, fixed score/confidence `70`, reason `"High-volume gap up after a {trend_move_pct}% prior uptrend closed with bearish rejection"`, scalar `values` (`gap_pct`, `trend_move_pct`, `avg_volume_20`, `volume_ratio`), `resistance_level = today.high` (`breakout_level = None`), `pattern_start_date = trend_bars[0].date`, `gap-zone` geometry with `min(previous.high, today.low)` / `max(previous.high, today.low)`, and label `"Exhaustion Gap"` at `(today.date, today.close)`.
  - Bounded historical evaluation (`20..=bars.len()`, `MAX_HISTORY_WINDOW_BARS = 260`), adjacent episode grouping (`firstMatchedDate`, `lastMatchedDate`, `matchCount`), ascending `historicalResults`, descending `results`, 50-endpoint `progressEvents` (omitted when `<20` bars or `scannerIds` empty), empty/omitted `generatedAt` UTC millisecond ISO-8601 fallback, cancellation-envelope semantics, and fail-closed rejection of unsupported `scannerIds` or `contractVersion`.

## 4. Preserved Behavior

- Native Rust scanner execution remains **inactive**; no Tauri IPC commands were registered and no live TypeScript scanner, worker, UI, or 54 chart-pattern definitions changed.
- Production TypeScript `chart_exhaustion_gap` handler (`src/features/chartPatterns/handlers/gaps.ts`), RSC-01 through RSC-05 modules/tests/fixtures, Cargo dependencies/locks, database, binary `.eod` files, and CA-01 state are unchanged.
- All seven local protected files preserved byte-for-byte (verified by SHA-256 before and after all edits/build).

## 5. Validation Commands and Actual Fresh Results (2026-11-20, `feature/rsc06-exhaustion-gap-20261120`)

1. **PowerShell parser check on runners:** `[System.Management.Automation.Language.Parser]::ParseFile(...)` on `Invoke-EOD-WindowsValidation.ps1`, `Invoke-EOD-SharedCargo.ps1`, `Test-EOD-SharedCargo.ps1`, `Invoke-EOD-TmpLifecycle.ps1`, `validate-change.ps1`, `check-doc-references.ps1`, `create-project-backup.ps1` — **PASS (7/7, 0 parse errors)**.
2. **Rustfmt check on all scanner Rust modules:** `rustfmt --edition 2021 --check` across `scanner_breakaway_gap.rs`, `scanner_common_gap.rs`, `scanner_contract.rs`, `scanner_exhaustion_gap.rs`, `scanner_runaway_gap.rs` — **PASS (`RUSTFMT_EXIT=0`)**.
3. **BUILD-01 shared Cargo wrapper (`--offline --locked`, `E:\TA Projects\EOD Charting Platform\target`):**
   - `Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('scanner_')` — **PASS (exit 0; `BUILD01_SHARED_CARGO_PREVIEW_PASS_NO_BUILD_NO_CHANGES`)**.
   - `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('scanner_')` — **PASS (exit 0; `18 passed; 0 failed; 0 ignored; 1328 filtered out; finished in 0.07s`; `BUILD01_SHARED_CARGO_COMMAND_PASS`)**: 15 scanner-module tests (including 4 `scanner_exhaustion_gap` tests covering the 17 fixtures, unsupported ID/version rejection, direct edge/fallback cases, cancellation after step 50 / 2 episodes & iteration 1, duplicate `scannerIds` deduplication, 20/69-bar progress boundaries, `-0.0` normalization, and `1e20`/`>= 1e21` scientific notation) + 3 pre-existing `corporate_action_imports` tests matching `scanner_`.
   - `Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction check` — **PASS (exit 0; `BUILD01_SHARED_CARGO_PREVIEW_PASS_NO_BUILD_NO_CHANGES`)**.
   - `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction check` — **PASS (exit 0; `Finished dev profile in 10.62s`; `BUILD01_SHARED_CARGO_COMMAND_PASS`; 1 pre-existing `dead_code` warning `create_holiday_skip_result` in `src/bhavcopy/calendar.rs`)**.
   - `Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test` (unfiltered) — **PASS (exit 0; `BUILD01_SHARED_CARGO_PREVIEW_PASS_NO_BUILD_NO_CHANGES`)**.
   - `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test` (full Rust regression, unfiltered) — **PASS (exit 0; `1313 passed; 0 failed; 33 ignored; 0 measured; 0 filtered out; finished in 25.92s`; `BUILD01_SHARED_CARGO_COMMAND_PASS`; 1 pre-existing warning in `src/bhavcopy/calendar.rs`)**. All 33 ignored tests are pre-existing opt-in native WebView2/live network/disposable-real-DB audits and benchmarks (`bhavcopy::*`, `database::bse_*`, `database::corporate_action_imports::*`, `database::eod_*`, `database::nse_identity_imports::*`, `database::official_source_candidate_validation::*`).
4. **RSC-01..06 Vitest parity suites:** `.\node_modules\.bin\vitest.cmd run` on `rustScannerContractRSC01.test.ts`, `breakawayGapParityRSC02.test.ts`, `scannerParityHarnessRSC03.test.ts`, `commonGapParityRSC04.test.ts`, `runawayGapParityRSC05.test.ts`, `exhaustionGapParityRSC06.test.ts` — **PASS (exit 0; 6 files, 18/18 tests)**.
5. **Relevant scanner regression tests:** `.\node_modules\.bin\vitest.cmd run` on `nativeIntegration.test.ts`, `toolbarChartPatternWorkerCHIP01.test.ts`, `ScannerChartRouting.test.ts`, `ScannerOverlayGeometry.test.ts`, `ScannerOverlayRemoval.test.ts`, `ToolbarChartPatternChipCHIP01.test.tsx`, `ScannerLabelLayout.test.ts`, `src/plugins/scanner/__tests__` — **PASS (exit 0; 19 files, 140/140 tests)**.
6. **Complete non-interactive Vitest suite:** `npm.cmd run test` (`pretest` -> `themes:generate`, then `vitest run --exclude tmp/**`) — **PASS (exit 0; `283 passed | 1 skipped (284)` test files; `1939 passed | 1 skipped (1940)` tests; 1 pre-existing skipped test `src/platform/__tests__/readonlyChartParity.test.ts`)**.
7. **TypeScript typecheck:** `npm.cmd run typecheck:renderer` — **PASS (exit 0)**.
8. **Renderer production build:** `npm.cmd run build:renderer` (`vite build`: 846 modules transformed, built in 6.54s; `themes:generate` kept `theme-tokens.generated.css` SHA-256 unchanged) — **PASS (exit 0)**.
9. **Documentation references & whitespace:** `pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-doc-references.ps1` (`[PASS] Live documentation references are valid.`, exit 0) and `git diff --check` (exit 0, no whitespace errors) — **PASS**.
10. **Protected files SHA-256 preservation (7/7 verified identical before and after validation, build, and documentation updates):**
   - `src-tauri-shell\gen\build-info.json`: `2C74E709A51917877CA5F511A40425867C09076D185F65CD6CB4895A2E03A0E7`
   - `src\styles\theme-tokens.generated.css`: `FB5E3E9573DFC6F6BE660E3FF0642C83CF5C7C6044940D20977F3BB709ADBCB9`
   - `docs\audits\18-11-2026 Audit and Upgrade\EOD_Charting_Indian_EOD_Institutional_Upgrade_Plan_2026-11-18_IST.md`: `56A438BB518471BB7BCE8C2F73A5637373E906D504C2E4FBBD215C712F47E104`
   - `docs\audits\18-11-2026 Audit and Upgrade\EOD_Charting_Performance_Implementation_Plan_2026-11-18_IST.md`: `92B7AF9145EE91EDC7D3824F91EE2D58B08F420A4D10548A92582EEA3B2E723D`
   - `docs\audits\18-11-2026 Audit and Upgrade\EOD_Replay_External_Plugins_Implementation_Plan_2026-11-18_IST.md`: `1EE4AB8D8576DE39F4912237FC614317D49492C0049F7206D5C61904B1FA8B43`
   - `docs\audits\18-11-2026 Audit and Upgrade\EOD_Rust_Scanner_Architecture_Implementation_Plan_2026-11-18_IST.md`: `5345F8DDF8CDE6857E8C6AD9CD21EA8C046B496E20725FCB2155DC5BFD308C47`
   - `docs\changes\2026-11-18_0356_IST_CA01_BSE_T0_CORPORATE_ACTION_ISOLATION.md`: `453047BF74BE5D891C62A5C23D58762BB3AF7A5237A0370DFD7728BA84CD6919`

## 6. Risks, Untested Items, Rollback, and Next Step

- **Untested / Not claimed:** Real NSE/BSE `.eod` corpus parity, live Tauri IPC / native scanner dispatch, portable Windows EXE packaging / native runtime acceptance, the 33 pre-existing ignored Rust tests, and extreme floating-point inputs beyond the 17 TypeScript-derived parity scenarios and Rust edge tests remain unexecuted or out of scope.
- **Known risks:** Native scanner execution stays inactive until NS-01+ is implemented and accepted; parity is currently verified on synthetic TypeScript-derived fixtures and boundary tests rather than production `.eod` symbol histories.
- **Rollback guidance:** To revert RSC-06 on `feature/rsc06-exhaustion-gap-20261120` without affecting `main` (`8ebd7d29c01b4612877eb98172397cf416c79730`) or the seven protected local files, close/discard the unmerged PR or revert the feature commit; for local pre-commit rollback, remove `src-tauri-shell/src/scanner_exhaustion_gap.rs`, `src/features/scanner/fixtures/exhaustionGapParityFixtures.v1.json`, `src/features/scanner/__tests__/exhaustionGapParityRSC06.test.ts`, and this change record, and restore `src-tauri-shell/src/main.rs`, `HANDOFF.md`, and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` from `backups/pre_opencode_changes_20261120_000001_rsc06-exhaustion-gap-parity` (or `backups/pre_opencode_changes_20261120_011742_rsc06-final-validation`).
- **Next step:** Independent GitHub PR audit and acceptance of `feature/rsc06-exhaustion-gap-20261120`. After PR acceptance, the next planned development milestone is **NS-01 — Native Read-Only Scanner Core** per `docs/audits/18-11-2026 Audit and Upgrade/EOD_Rust_Scanner_Architecture_Implementation_Plan_2026-11-18_IST.md`; NS-01 through NS-04 will be implemented separately by Arena.ai after RSC-06 acceptance.
