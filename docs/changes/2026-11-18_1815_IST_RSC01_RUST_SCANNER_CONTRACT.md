# RSC-01 — Rust Scanner Contract and Parity Foundation

**Timestamp:** 2026-11-18 18:15 IST (`UTC+05:30`); Rust contract validation 2026-11-18 21:46 IST (`UTC+05:30`); TypeScript & typecheck validation recorded 2026-11-19 02:12 IST (`UTC+05:30`)  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Task ID:** `RSC-01`  
**Status:** Complete & verified for contract parity — Rust `scanner_contract::tests` **PASS (3/3)**, focused Vitest (`rustScannerContractRSC01.test.ts` 5/5 + scanner regressions in 14-file run, 93/93 tests) **PASS**, `npm.cmd run typecheck:renderer` **PASS**, and `scripts/check-doc-references.ps1` **PASS**; `npm.cmd run build:renderer` subsequently PASS in user-provided renderer build output; no native Rust execution path was enabled.

---

## 1. Objective

Establish a minimal, versioned TypeScript↔Rust scanner data contract (`eod-scanner-contract-v1`) and deterministic compatibility test foundation prior to migrating any chart-pattern detector to Rust, without registering a Tauri command or altering any runtime scanner execution path.

---

## 2. Source Authority & Inspected Files

- **Authorized root:** `E:\TA Projects\EOD Charting Platform`
- **GitHub reference:** `8c309050df3c52b33e8ba2ab4dc8c07a04a75ad6` (reference only; local approved source retained)
- **Files inspected before editing:**
  1. `AGENTS.md`
  2. `HANDOFF.md`
  3. `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
  4. `src/features/scanner/types.ts`
  5. `src/features/scanner/catalog.ts`
  6. `src/features/chartPatterns/index.ts`
  7. `src/features/chartPatterns/types.ts`
  8. `src/features/chartPatterns/evaluation.ts`
  9. `src/features/chartPatterns/evaluation.worker.ts`
  10. `src/features/chartPatterns/workerClient.ts`
  11. `src/features/chartPatterns/definitions.ts`
  12. `src/features/chartPatterns/constants.ts`
  13. `src/features/chartPatterns/primitives.ts`
  14. `src/features/chartPatterns/shared.ts`
  15. `src/features/chartPatterns/setups.ts`
  16. `src/features/chartPatterns/geometry.ts`
  17. `src/features/chartPatterns/handlers/gaps.ts`
  18. `src/features/chartPatterns/handlers/reversals.ts`
  19. `src/features/chartPatterns/handlers/structures.ts`
  20. `src/features/chartPatterns/handlers/complexBases.ts`
  21. `src/features/chartPatterns/__tests__/nativeIntegration.test.ts`
  22. `src/plugins/scanner/chartPatternScanners.ts`
  23. `src/plugins/scanner/scannerRunner.ts`
  24. `src/plugins/scanner/__tests__/chartPatternScanners.test.ts`
  25. `src/plugins/scanner/__tests__/scannerHistory.test.ts`
  26. `src/platform/types.ts`
  27. `src/types/desktop.ts`
  28. `src-tauri-shell/src/main.rs`
  29. `src-tauri-shell/Cargo.toml`
  30. `scripts/Invoke-EOD-SharedCargo.ps1`
  31. `scripts/validate-change.ps1`

---

## 3. Backup & SHA-256 Evidence

- **Pre-edit backup directory:** `backups/pre_opencode_changes_20261118_181714_rsc01-rust-scanner-contract`
- **Backup manifest:** `backups/pre_opencode_changes_20261118_181714_rsc01-rust-scanner-contract/backup-manifest.json` (`fileCount: 3`, `totalBytes: 234955`)
- **Validation-evidence doc backup directory:** `backups/pre_opencode_changes_20261118_214555_rsc01-build01-validation-docs` (`backup-manifest.json`, `fileCount: 4`)

| File | Before SHA-256 | After SHA-256 |
|---|---|---|
| `src/features/scanner/rustScannerContract.ts` | *(new file)* | `B758F7AFD4B1F2D2EDCFB509012373974D209D19A62E90E342E8EB2D102F4255` |
| `src/features/scanner/fixtures/rustScannerContractFixtures.v1.json` | *(new file)* | `AD0284995A3DC850A0BDD510CD45D69377B9EE81BA444A0C32E3A73BAF65D0FE` |
| `src/features/scanner/__tests__/rustScannerContractRSC01.test.ts` | *(new file)* | `6593AF11E2EE92B65A794FD1F1A95C8618D53C13A74B9F49A54EAC7C66198017` |
| `src-tauri-shell/src/scanner_contract.rs` | *(new file)* | `A8BC6E54D025AFD213A5171565B02C38C17B325CC0BCE86CEE4196C82AD0D247` |
| `src-tauri-shell/src/main.rs` | `1308745A8527F28AC45E4E50930B1FAD448668CB50B6F98716CC55742657AA9A` | `EE833E539F18A5D4B701A011BB3F4E8177F73359E544694A3E9D221AF897C482` |
| `HANDOFF.md` | `816E131BB07E88084C7CC8E917C5C18B44CA32583575B86190E5E5255C5A8798` | `8317E054BE61CEAD3D0B09E62A1570C1363432744485EEC51E12E3AB582FB2A1` |
| `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` | `80A18082678A569AF5BE3919F3068BEAAD8088193659C12A2A9851B922AD9BD4` | `D224F2761FD5A7D788ED6E8E362FABA82FCF1990D27839BA77FD7EAC6C6745F4` |

---

## 4. Implementation Summary (Changed vs. Preserved Behavior)

### Changed
- **TypeScript contract (`src/features/scanner/rustScannerContract.ts`):**
  - Defined `RUST_SCANNER_CONTRACT_VERSION = 'eod-scanner-contract-v1'` and typed request/response/progress/cancellation/fixture interfaces (`RustScannerEvaluationRequestV1`, `RustScannerEvaluationResponseV1`, `RustScannerProgressEventV1`, `RustScannerCancelRequestV1`, `RustScannerContractFixtureScenarioV1`, `RustScannerContractFixtureBundleV1`) compatible with `EodBar`, `ScannerRunTarget`, `ScannerResult`, `ScannerResultHistory`, `ChartPatternResultDetails`, and `ChartPatternGeometry`.
  - Added canonical sorting helper `sortScannerResultsForContract()` (descending `date`, ascending `scannerName`), timestamp normalization helper `normalizeScannerResultForContract()`, and test/parity harness adapter `evaluateRustScannerContractRequestV1()` wrapping `evaluateChartPatterns`.
- **Deterministic fixture bundle (`src/features/scanner/fixtures/rustScannerContractFixtures.v1.json`):**
  - Added 5 scenarios covering all 4 `ChartPatternFamily` groups (`gap`, `reversal`, `continuation`, `neutral-bilateral`) from live TypeScript scanner runs (`gap_breakaway_match`, `reversal_double_bottom_match`, `continuation_bull_flag_match`, `neutral_bilateral_range_history_match`) plus an explicit optional-field/cancellation envelope (`nonmatch_and_cancelled_optional_envelope`) and `orderedResultsSample`.
- **TypeScript contract tests (`src/features/scanner/__tests__/rustScannerContractRSC01.test.ts`):**
  - Verified live `evaluateRustScannerContractRequestV1` equality across the 4 engine-derived scenarios, empty nonmatch response with `cancelled: false`, mid-history cancellation preserving partial episodes, canonical result sorting, 54-definition family/direction coverage, and optional envelope contract shape.
- **Rust Serde contract & tests (`src-tauri-shell/src/scanner_contract.rs`, `src-tauri-shell/src/main.rs`):**
  - Declared `#[allow(dead_code)] mod scanner_contract;` in `src-tauri-shell/src/main.rs` without registering any Tauri command.
  - Implemented isolated Serde types with `#[serde(rename_all = "camelCase", deny_unknown_fields)]`, enum variants matching TypeScript string literals, `ScannerScalarValueV1` (`Bool`, `Integer`, `Float`, `Text`, and `None` for `null`), `sort_scanner_results_v1()`, and 3 unit tests checking fixture deserialization, semantic JSON round-trip equality, optional/history/scalar coverage, canonical sorting, and strict unknown-field rejection.

### Preserved
- Zero Tauri commands registered or changed in `src-tauri-shell/src/main.rs`.
- Zero Rust detector migrations performed (Rust tests explicitly check contract compatibility against TypeScript-generated fixtures, not detector-algorithm parity).
- All 54 chart-pattern definitions, handlers, scoring, geometry builders, historical grouping, cancellation, progress callbacks, scanner UI, `evaluation.ts`, `evaluation.worker.ts`, `workerClient.ts`, and `scannerRunner.ts` remain untouched.
- `package.json` and `src-tauri-shell/Cargo.toml` dependencies remain unchanged.

---

## 5. Validation Results & Remaining Commands

- **Completed (2026-11-18 21:46 IST):**
  - **RSC-01 file presence & SHA-256 verification:** All 6 RSC-01 files and `scripts/Invoke-EOD-SharedCargo.ps1` (`F7CD6D9C67CE9FD004E1C2CAD29CBB5D3772A7B848290E77B51CF8836E39F9FD`) verified present with unchanged source hashes (`PASS`).
  - **Wrapper static AST parse check (`scripts/Invoke-EOD-SharedCargo.ps1`):** `errors=0`, `elseTokens=0`, `elseAst=0` (`PASS`).
  - **Shared Cargo `Preview` (`scanner_contract::tests`):** `cargo test --offline --locked --manifest-path E:\TA Projects\EOD Charting Platform\src-tauri-shell\Cargo.toml --target-dir E:\TA Projects\EOD Charting Platform\target scanner_contract::tests` -> `STATUS: BUILD01_SHARED_CARGO_PREVIEW_PASS_NO_BUILD_NO_CHANGES` (`PASS`).
  - **Shared Cargo `Run` (`scanner_contract::tests`):** `3 passed; 0 failed; 0 ignored; 0 measured; 1331 filtered out; finished in 0.02s`, `CARGO_EXIT=0`, `STATUS: BUILD01_SHARED_CARGO_COMMAND_PASS`, shared target `E:\TA Projects\EOD Charting Platform\target`, `--offline --locked` (`PASS`; 1 pre-existing `dead_code` warning in `src/bhavcopy/calendar.rs:160`):
    - `scanner_contract::tests::rsc_01_scanner_contract_covers_all_pattern_families_history_and_optional_fields` (`ok`)
    - `scanner_contract::tests::rsc_01_scanner_contract_preserves_canonical_result_ordering_and_rejects_unknown_fields` (`ok`)
    - `scanner_contract::tests::rsc_01_scanner_contract_deserializes_typescript_fixture_bundle_and_round_trips` (`ok`)

- **Completed (2026-11-19 00:19 IST during RSC-02 parity validation, re-verified against current files):**
  - **Focused TypeScript scanner contract & regression tests (Vitest 14-file run):** `Test Files 14 passed (14)`, `Tests 93 passed (93)` (**PASS**), covering `src/features/scanner/__tests__/rustScannerContractRSC01.test.ts` (`5 tests`), `src/features/chartPatterns/__tests__/nativeIntegration.test.ts` (`3 tests`), `src/plugins/scanner/__tests__/chartPatternScanners.test.ts` (`31 tests`), `src/plugins/scanner/__tests__/scannerHistory.test.ts` (`8 tests`), `src/plugins/scanner/__tests__/chartPatternPrimitives.test.ts` (`4 tests`), `src/plugins/scanner/__tests__/chartPatternChannels.test.ts` (`11 tests`), `src/plugins/scanner/__tests__/scannerPatternMap.test.ts` (`4 tests`), `src/plugins/scanner/__tests__/scannerPriority.test.ts` (`2 tests`), and 6 additional scanner/parity suites.
  - **Renderer TypeScript typecheck (`npm.cmd run typecheck:renderer`):** exit `0` (**PASS**).
  - **Documentation reference validation (`scripts/check-doc-references.ps1`):** `[PASS] Live documentation references are valid.` (**PASS**, re-run after remaining-doc sync).

- **Remaining optional build command (run from `E:\TA Projects\EOD Charting Platform` if verifying production bundle):**
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; npm.cmd run build:renderer
   ```

---

## 6. Risks, Limitations & Rollback

- **Risks & limitations:**
  - Rust `scanner_contract::tests` (`3/3`), Vitest (`rustScannerContractRSC01.test.ts` + scanner regressions, `14/14` files / `93/93` tests), `typecheck:renderer`, and `check-doc-references.ps1` passed; `npm.cmd run build:renderer` remains unexecuted in this doc-sync pass.
  - Because `rustScannerContractFixtures.v1.json` has `#[serde(deny_unknown_fields)]` on Rust contract structs, future additive fields to `ScannerResult` or `ChartPatternResultDetails` in TypeScript must stay synchronized with `src-tauri-shell/src/scanner_contract.rs` and bump or extend the versioned contract intentionally.
  - `toDate` and `target.name` use idiomatic `Option<String>` with `skip_serializing_if = "Option::is_none"`, so incoming JSON `null` deserializes as `None` and re-serializes omitted (`values` preserves explicit `null` via `BTreeMap<String, Option<ScannerScalarValueV1>>`).
- **Rollback instructions (requires user approval before restoring from backup):**
  - Restore `src-tauri-shell/src/main.rs`, `HANDOFF.md`, and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` from `backups/pre_opencode_changes_20261118_181714_rsc01-rust-scanner-contract`, and remove `src/features/scanner/rustScannerContract.ts`, `src/features/scanner/fixtures/rustScannerContractFixtures.v1.json`, `src/features/scanner/__tests__/rustScannerContractRSC01.test.ts`, `src-tauri-shell/src/scanner_contract.rs`, and `docs/changes/2026-11-18_1815_IST_RSC01_RUST_SCANNER_CONTRACT.md`.

## Later acceptance clarification — 19 November 2026 IST

- RSC-01 contract and Rust test acceptance remains confirmed; later renderer builds completed successfully. No new RSC-01 contract tests were run during DOCSYNC-01.
- The Rust contract module remains unregistered for runtime Tauri invocation; later RSC-02 detector parity acceptance does not imply production Rust scanner activation.
