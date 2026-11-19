# RSC-02 — Native Rust Scanner: First Detector Migration (`chart_breakaway_gap`)

**Timestamp:** 2026-11-18 23:49 IST (`UTC+05:30`)  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Task ID:** `RSC-02`  
**Status:** Isolated Rust detector (`chart_breakaway_gap`), TypeScript-derived 18-scenario fixture bundle, Rust parity tests, TypeScript parity tests, shared Cargo `check`, and `typecheck:renderer` **PASS**; `scripts/check-doc-references.ps1` validated immediately after writing this record. No Tauri command registered and no live scanner runtime path altered. *(Superseded 2026-11-19 00:12 IST by [parity edge-case fixes record](2026-11-19_0012_IST_RSC02_PARITY_EDGE_FIXES.md), expanding fixtures to 24 scenarios.)*

---

## 1. Objective

Migrate exactly one verified Gap-family chart-pattern detector (`chart_breakaway_gap`, `Breakaway Gap`) from TypeScript (`src/features/chartPatterns/handlers/gaps.ts`) into an isolated Rust module (`src-tauri-shell/src/scanner_breakaway_gap.rs`) reusing the RSC-01 `eod-scanner-contract-v1` contract (`src-tauri-shell/src/scanner_contract.rs`), and establish deterministic parity against live TypeScript evaluation before any runtime switchover.

---

## 2. Source Authority & Inspected Files

- **Authorized root:** `E:\TA Projects\EOD Charting Platform`
- **Inspected files:**
  1. `AGENTS.md`
  2. `HANDOFF.md`
  3. `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
  4. `src/features/chartPatterns/definitions.ts`
  5. `src/features/chartPatterns/handlers/gaps.ts`
  6. `src/features/chartPatterns/constants.ts`
  7. `src/features/chartPatterns/primitives.ts`
  8. `src/features/chartPatterns/setups.ts`
  9. `src/features/chartPatterns/shared.ts`
  10. `src/features/chartPatterns/geometry.ts`
  11. `src/features/chartPatterns/evaluation.ts`
  12. `src/features/chartPatterns/index.ts`
  13. `src/features/chartPatterns/types.ts`
  14. `src/features/chartPatterns/__tests__/nativeIntegration.test.ts`
  15. `src/features/scanner/types.ts`
  16. `src/features/scanner/catalog.ts`
  17. `src/features/scanner/rustScannerContract.ts`
  18. `src/features/scanner/fixtures/rustScannerContractFixtures.v1.json`
  19. `src/features/scanner/__tests__/rustScannerContractRSC01.test.ts`
  20. `src/plugins/scanner/__tests__/chartPatternScanners.test.ts`
  21. `src/plugins/scanner/__tests__/scannerHistory.test.ts`
  22. `src/plugins/scanner/__tests__/chartPatternPrimitives.test.ts`
  23. `src-tauri-shell/src/scanner_contract.rs`
  24. `src-tauri-shell/src/main.rs`
  25. `src-tauri-shell/Cargo.toml`
  26. `scripts/Invoke-EOD-SharedCargo.ps1`
  27. `scripts/create-project-backup.ps1`
  28. `scripts/check-doc-references.ps1`
  29. `docs/changes/2026-11-18_1815_IST_RSC01_RUST_SCANNER_CONTRACT.md`

---

## 3. Backup & SHA-256 Evidence

- **Pre-edit backup directory:** `backups/pre_opencode_changes_20261118_232656_rsc02-breakaway-gap-migration`
- **Backup manifest:** `backups/pre_opencode_changes_20261118_232656_rsc02-breakaway-gap-migration/backup-manifest.json` (`fileCount: 3`, `totalBytes: 242320`)

| File | Before SHA-256 | After SHA-256 |
|---|---|---|
| `src-tauri-shell/src/scanner_breakaway_gap.rs` | *(new file)* | `135132FF083D0BAFF4D4E35CBA90762F031F093B5FF1B8DAEBC33276BD7A0AE3` |
| `src/features/scanner/fixtures/breakawayGapParityFixtures.v1.json` | *(new file)* | `C4E08D6708D75B99328B4AA5B4D14972C012C204C3573C2AA9FA027AF53AC554` |
| `src/features/scanner/__tests__/breakawayGapParityRSC02.test.ts` | *(new file)* | `737DFD2DF55BE73D7B7ECF3E8CC201000D8E2CDEB676EC7A7B3C2628CD3BDBBB` |
| `src-tauri-shell/src/main.rs` | `EE833E539F18A5D4B701A011BB3F4E8177F73359E544694A3E9D221AF897C482` | `D264A18E26D43299EC20701A4BE3DBD971B42F5AB35CB2E46AE294F203CBE208` |
| `HANDOFF.md` | `30972BE8C7B5766141E9847D6C34FABB357DE8ECAFF1892BC63F66F5372C23AB` | `76AE5552BF2193169E5CDF4A6246CE537D2E2496427C8A5F1C1D367B45308662` |
| `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` | `8CB760EC2D76F78CE59C369AEE5E42F257193DD82352AA1139F5AF2440A9D104` | `7C584513A100ADE3B2FBB805B838990D3E534785B4249F7CCE88349B3DCB7ABE` |

---

## 4. Implementation Summary (Changed vs. Preserved Behavior)

### Changed
- **Isolated Rust Breakaway Gap detector (`src-tauri-shell/src/scanner_breakaway_gap.rs`, wired with `#[allow(dead_code)] mod scanner_breakaway_gap;` in `src-tauri-shell/src/main.rs`):**
  - Ported `chart_breakaway_gap` (`Breakaway Gap`, category `chart_patterns_gap` / `Chart Patterns - Gaps`, `bullish`, score/confidence `80`, source `EODChartPatternScanner_v1`) using RSC-01 `crate::scanner_contract::*` types (`EodBarV1`, `ScannerRunTargetV1`, `ScannerResultV1`, `ChartPatternResultDetailsV1`, `ChartPatternGeometryV1`, `RustScannerEvaluationRequestV1`, `RustScannerEvaluationResponseV1`, `RustScannerProgressEventV1`, `sort_scanner_results_v1`).
  - Preserved exact TypeScript evaluation rules:
    - Minimum `22` bars (`bars.len() >= 22`); `today = bars[len - 1]`, `previous = bars[len - 2]`.
    - `gap_up_pct`: `previous.high > 0.0 && today.open > previous.high`, rounded to 2 decimal places (`js_math_round` semantics, half toward `+infinity`, `-0.0` normalized to `0.0`), then `gap_pct >= 0.25` (`MIN_GAP_PCT`).
    - Exact window offsets: 20-bar `base` is `bars[len - 22 .. len - 2]` (excluding `previous` and `today`, with `pattern_start_date = base[0].date`), while 20-bar `average_volume_excluding_current` averages `bars[len - 21 .. len - 1]` (including `previous` and excluding `today`).
    - Breakout confirmation: `today.open > resistance && today.close > resistance` and `avg_volume > 0.0 && today.volume >= avg_volume * 1.5`.
    - Output formatting and geometry: JS-style `resistance` formatting in `reasons`, integer/float scalar parity via `scalar_number_v1`, `gap-zone` geometry with `[min(previous.high, today.low), max(previous.high, today.low)]`, and `"Breakaway Gap"` label at `(today.date, today.close)`.
    - Request evaluator (`evaluate_chart_breakaway_gap_request_v1`): verifies `contractVersion == "eod-scanner-contract-v1"`, deduplicates `chart_breakaway_gap`, fails closed (`Err`) on unmigrated `scannerIds`, and reproduces `evaluateChartPatterns` history evaluation (`20..=bars.len()`, `MAX_PATTERN_WINDOW_BARS = 260`, consecutive episode grouping, 50-endpoint progress events, and canonical descending-date sorting).
- **TypeScript-derived parity fixture bundle (`src/features/scanner/fixtures/breakawayGapParityFixtures.v1.json`) and TypeScript test (`src/features/scanner/__tests__/breakawayGapParityRSC02.test.ts`):**
  - 18 deterministic scenarios across `positive` (3), `boundary` (9), `negative` (3), and `historical` (3), generated directly from `evaluateRustScannerContractRequestV1` and verified in both Vitest and Rust (`scanner_breakaway_gap::tests`, checking struct fields, `1e-12` float tolerances, optional-field presence, and raw JSON semantic equality, plus RSC-01 `gap_breakaway_match` parity and non-finite/rounding edge cases).

### Preserved
- Zero Tauri commands registered or changed in `src-tauri-shell/src/main.rs`.
- Zero changes to `src-tauri-shell/src/scanner_contract.rs`, `src/features/scanner/rustScannerContract.ts`, or `src/features/scanner/fixtures/rustScannerContractFixtures.v1.json`.
- All 54 chart-pattern definitions, TypeScript handlers, worker execution, scanner UI, corporate actions, `.eod` storage, `package.json`, and `src-tauri-shell/Cargo.toml` remain completely untouched.

---

## 5. Validation Executed

Run serially from `E:\TA Projects\EOD Charting Platform`:

1. **Rust formatting check:**
   - `rustfmt --edition 2021 --check 'src-tauri-shell\src\scanner_breakaway_gap.rs'` -> **PASS** (exit `0`).
2. **Focused Rust detector and RSC-01 contract tests (via BUILD-01 shared Cargo wrapper):**
   - `pwsh.exe -NoProfile -ExecutionPolicy Bypass -Command "& '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Preview -CargoAction test -CargoArguments @('scanner_')"` -> **PASS** (`STATUS: BUILD01_SHARED_CARGO_PREVIEW_PASS_NO_BUILD_NO_CHANGES`).
   - `pwsh.exe -NoProfile -ExecutionPolicy Bypass -Command "& '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Run -CargoAction test -CargoArguments @('scanner_')"` -> **PASS** (`9 passed; 0 failed; 0 ignored; 1328 filtered out; finished in 0.03s`, `STATUS: BUILD01_SHARED_CARGO_COMMAND_PASS`, `--offline --locked`, zero new warnings):
     - `scanner_breakaway_gap::tests::rsc_02_matches_rsc_01_gap_breakaway_match_fixture` (`ok`)
     - `scanner_breakaway_gap::tests::rsc_02_parity_across_all_breakaway_gap_fixtures` (`ok`)
     - `scanner_breakaway_gap::tests::rsc_02_direct_detector_edge_cases_and_float_rounding` (`ok`)
     - `scanner_contract::tests::*` (3/3 `ok`)
     - `database::corporate_action_imports::tests::phase1_*scanner*` (3/3 `ok`)
3. **Shared Cargo check (via BUILD-01 wrapper):**
   - `pwsh.exe -NoProfile -ExecutionPolicy Bypass -Command "& '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Preview -CargoAction check"` -> **PASS**.
   - `pwsh.exe -NoProfile -ExecutionPolicy Bypass -Command "& '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Run -CargoAction check"` -> **PASS** (`STATUS: BUILD01_SHARED_CARGO_COMMAND_PASS`, zero new warnings).
4. **TypeScript parity & scanner regression suite:**
   - `& '.\node_modules\.bin\vitest.cmd' run src/features/scanner/__tests__/breakawayGapParityRSC02.test.ts src/features/scanner/__tests__/rustScannerContractRSC01.test.ts src/features/chartPatterns/__tests__/nativeIntegration.test.ts src/plugins/scanner/__tests__/chartPatternScanners.test.ts src/plugins/scanner/__tests__/scannerHistory.test.ts src/plugins/scanner/__tests__/chartPatternPrimitives.test.ts src/plugins/scanner/__tests__/chartPatternChannels.test.ts src/plugins/scanner/__tests__/scannerPatternMap.test.ts src/plugins/scanner/__tests__/scannerPriority.test.ts src/plugins/scanner/__tests__/coreOhlcvScanners.test.ts src/plugins/scanner/__tests__/signalScanners.test.ts src/plugins/scanner/__tests__/scannerChartPriceBasis.test.ts src/plugins/scanner/__tests__/scannerChartTimeframe.test.ts src/plugins/scanner/__tests__/scannerWorkspace.test.ts` -> **PASS** (`14 passed (14)`, `92 passed (92)`).
5. **Renderer TypeScript typecheck:**
   - `npm.cmd run typecheck:renderer` -> **PASS** (exit `0`).
6. **Documentation reference verification:**
   - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\check-doc-references.ps1'` -> **PASS** (executed after doc updates).

---

## 6. Risks, Limitations & Rollback

- **Risks & limitations:**
  - Only `chart_breakaway_gap` is migrated and remains inactive (`#[allow(dead_code)]`, no Tauri command); runtime scanner behavior is unchanged.
  - `format_js_number` relies on Rust `f64::Display`, which agrees with ECMAScript `Number.prototype.toString()` across all standard price scales (`[1e-6, 1e21)`) with `-0.0` normalized to `0.0`, while extreme sub-micro prices (`0 < |x| < 1e-6`) or `>= 1e21` are outside NSE/BSE equity scales and untested.
  - `npm.cmd run build:renderer` was not executed because production renderer entry points do not import test or fixture files.
- **Rollback instructions (requires explicit approval before restoring from backup):**
  - Restore `src-tauri-shell/src/main.rs`, `HANDOFF.md`, and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` from `backups/pre_opencode_changes_20261118_232656_rsc02-breakaway-gap-migration`, and remove `src-tauri-shell/src/scanner_breakaway_gap.rs`, `src/features/scanner/fixtures/breakawayGapParityFixtures.v1.json`, `src/features/scanner/__tests__/breakawayGapParityRSC02.test.ts`, and `docs/changes/2026-11-18_2349_IST_RSC02_BREAKAWAY_GAP_MIGRATION.md`.
