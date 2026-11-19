# RSC-02 — Breakaway Gap Parity Edge-Case Review & Fixes (`chart_breakaway_gap`)

**Timestamp:** 2026-11-19 00:12 IST (`UTC+05:30`)  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Task ID:** `RSC-02` (follow-up review & parity fixes)  
**Status:** `format_js_number`, `scalar_number_v1`, empty-`generatedAt` fallback, `assert_geometry_parity`, 24-scenario TypeScript-derived fixture parity, Rust tests (`scanner_`), shared Cargo `check`, `rustfmt --check`, Vitest (14 suites / 93 tests), and `typecheck:renderer` **PASS**; `scripts/check-doc-references.ps1` validated immediately after doc updates. No Tauri command registered and no live scanner runtime path altered.

---

## 1. Objective

Address edge-case parity bugs found during independent review of the initial RSC-02 `chart_breakaway_gap` migration, expand TypeScript-derived fixture coverage from 18 to 24 scenarios, and re-verify full parity across TypeScript and Rust.

---

## 2. Backup & SHA-256 Evidence

- **Pre-edit backup directory:** `backups/pre_opencode_changes_20261119_000026_rsc02-breakaway-gap-parity-review-fixes`
- **Backup manifest:** `backups/pre_opencode_changes_20261119_000026_rsc02-breakaway-gap-parity-review-fixes/backup-manifest.json` (`fileCount: 5`, `totalBytes: 456648`)

| File | Before SHA-256 | After SHA-256 |
|---|---|---|
| `src-tauri-shell/src/scanner_breakaway_gap.rs` | `135132FF083D0BAFF4D4E35CBA90762F031F093B5FF1B8DAEBC33276BD7A0AE3` | `175BBC2AD10768933D5FFF95CC239DA1DF58D6502012BCA72A59918665C37BCA` |
| `src/features/scanner/fixtures/breakawayGapParityFixtures.v1.json` | `C4E08D6708D75B99328B4AA5B4D14972C012C204C3573C2AA9FA027AF53AC554` | `766BDB230B20E48B413F076A461C45E195306C784C1C5DC904D02A4B9391A1C2` |
| `src/features/scanner/__tests__/breakawayGapParityRSC02.test.ts` | `737DFD2DF55BE73D7B7ECF3E8CC201000D8E2CDEB676EC7A7B3C2628CD3BDBBB` | `E5FFCBD4E565015E7A9FE8AC2F9BFF80B557B4731B48628A458951451AA08077` |
| `docs/changes/2026-11-19_0012_IST_RSC02_PARITY_EDGE_FIXES.md` | *(new file)* | *(current file)* |

---

## 3. Defects Found & Fixed

1. **`format_js_number` scientific-notation mismatch (`src-tauri-shell/src/scanner_breakaway_gap.rs`):**
   - **Before:** Used `normalize_zero(value).to_string()`, which never emits scientific notation (`5e-7` formatted as `"0.0000005"`, `1e21` formatted as `"1000000000000000000000"`). Confirmed failing against TypeScript-derived fixture `boundary_sub_micro_resistance_scientific_reason` (`reasons` expected `"5e-7"`, got `"0.0000005"`).
   - **Fix:** Implemented ECMAScript `Number.prototype.toString()` scientific thresholds (`exp <= -7` i.e. `0 < |x| < 1e-6`, and `exp >= 21` i.e. `|x| >= 1e21`, including `e+` for positive exponents, `-0.0` -> `"0"`, `NaN`, `Infinity`, `-Infinity`).
2. **`scalar_number_v1` integer-scalar mismatch in `[2^53, 2^63)` (`src-tauri-shell/src/scanner_breakaway_gap.rs`):**
   - **Before:** Restricted `ScannerScalarValueV1::Integer` to `±9_007_199_254_740_991` (`2^53 - 1`), causing integer values such as `1e16` to become `ScannerScalarValueV1::Float(1e16)` (`10000000000000000.0`) whereas `JSON.stringify` + `serde_json` deserializes `"10000000000000000"` into `ScannerScalarValueV1::Integer(10_000_000_000_000_000)`.
   - **Fix:** Extended `scalar_number_v1` to the full lossless `i64` finite `f64` range `[-9_223_372_036_854_775_808.0, 9_223_372_036_854_775_808.0)`.
3. **Empty `generatedAt` fallback mismatch (`src-tauri-shell/src/scanner_breakaway_gap.rs`):**
   - **Before:** `request.generated_at` accepted `Some("")` literally instead of falling back like TypeScript `normalizeScannerResultForContract` (`if (!fixedGeneratedAt) return result;`).
   - **Fix:** Added `.filter(|value| !value.is_empty())` before `.unwrap_or_else(...)`.
4. **Expanded parity fixtures & test assertions (`breakawayGapParityFixtures.v1.json`, `breakawayGapParityRSC02.test.ts`, `scanner_breakaway_gap.rs`):**
   - Added 6 live TypeScript-derived scenarios (`24` total): `boundary_sub_micro_resistance_scientific_reason` (`5e-7`), `boundary_extreme_large_resistance_scientific_reason` (`1e+21`), `boundary_large_i64_integer_values_parity` (`1e16`), `negative_no_gap_above_previous_high` (`today.open > resistance` but `today.open <= previous.high`), `negative_oldest_base_bar_blocks_breakout` (`bars[len-22].high` blocks breakout), and `historical_22_bars_active_episode_at_end`.
   - Strengthened `assert_geometry_parity` to check `pivot_markers` and `trend_lines` contents when present, added TS/Rust tests for `generatedAt` omitted/`""`, and added direct `format_js_number` / `scalar_number_v1` boundary assertions.

---

## 4. Validation Executed

Run serially from `E:\TA Projects\EOD Charting Platform`:

1. **Rust formatting check:** `rustfmt --edition 2021 --check 'src-tauri-shell\src\scanner_breakaway_gap.rs'` -> **PASS** (exit `0`).
2. **Focused Rust detector & RSC-01 contract tests (BUILD-01 shared Cargo wrapper):**
   - `pwsh.exe -NoProfile -ExecutionPolicy Bypass -Command "& '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Preview -CargoAction test -CargoArguments @('scanner_')"` -> **PASS**.
   - `pwsh.exe -NoProfile -ExecutionPolicy Bypass -Command "& '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Run -CargoAction test -CargoArguments @('scanner_')"` -> **PASS** (`9 passed; 0 failed; 0 ignored; 1328 filtered out; finished in 0.04s; STATUS: BUILD01_SHARED_CARGO_COMMAND_PASS`, 0 new warnings).
3. **Shared Cargo check (BUILD-01 wrapper):**
   - `Mode Preview` + `Mode Run` (`check`) -> **PASS** (`Finished 'dev' profile ... in 8.90s; STATUS: BUILD01_SHARED_CARGO_COMMAND_PASS`, 0 new warnings).
4. **TypeScript parity & scanner regressions (Vitest):**
   - 14 suites (`breakawayGapParityRSC02.test.ts`, `rustScannerContractRSC01.test.ts`, `nativeIntegration.test.ts`, and 11 `src/plugins/scanner/__tests__/*` suites) -> **PASS** (`14 passed (14)`, `93 passed (93)`).
5. **Renderer TypeScript typecheck:** `npm.cmd run typecheck:renderer` -> **PASS** (exit `0`).
6. **Documentation reference verification:** `powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\check-doc-references.ps1'` -> **PASS** (executed after doc updates).

---

## 5. Preserved Boundaries & Rollback

- Zero Tauri commands registered, zero changes to RSC-01 contract files, zero changes to the 54 chart-pattern definitions/UI/live scanner paths, zero new dependencies, zero Git operations, zero `.eod`/DB/CA modifications.
- **Rollback (requires explicit approval before restoring):** Restore `src-tauri-shell/src/scanner_breakaway_gap.rs`, `src/features/scanner/fixtures/breakawayGapParityFixtures.v1.json`, `src/features/scanner/__tests__/breakawayGapParityRSC02.test.ts`, `HANDOFF.md`, and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` from `backups/pre_opencode_changes_20261119_000026_rsc02-breakaway-gap-parity-review-fixes`, and remove `docs/changes/2026-11-19_0012_IST_RSC02_PARITY_EDGE_FIXES.md`.

## 6. Later build and acceptance update — 19 November 2026 IST

- User-provided `npm.cmd run build:renderer` output: **PASS**, Vite v6.4.3, 846 modules transformed, 7.33 seconds, no error.
- RSC-02 isolated Rust detector and parity implementation accepted; user later reported portable smoke acceptance of the existing scanner workflow during CHIP-01.
- **Boundary:** No Tauri command is registered for the Rust Breakaway Gap detector, so acceptance does not establish production native Rust detector execution. RSC-03 is on hold at user request.
- No new Rust tests or builds were performed as part of this documentation-only update.
