# RSC-05 — Isolated Native Rust Runaway Gap Detector

**IST timestamp:** 2026-11-19 18:25 IST (UTC+05:30)  
**Active workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**Source authority:** `feature/native-rust-scanner-20261119` at parent `f48e41abdaf32d35d708e90e8bc92c4f868c5a1a`, based on accepted main `bfb644bf`.  
**Status:** Focused Windows validation **PASS** on source commit `e158f086b77eed42b5434ce3449f4528e8d0bc38` (19 November 2026, 19:48 IST). The initial Rustfmt failure at `49565b5` was corrected and passed at `e158f086`. Draft PR #122 remains unmerged; native scanner routing remains inactive.

## Objective and previous limitation

RSC-04 migrated isolated Common Gap, but `chart_runaway_gap` was still TypeScript-only. Port exactly one Runaway Gap detector with complete deterministic TypeScript-derived output parity, leaving production native dispatch inactive.

## Inspected and changed files

Inspected current GitHub `AGENTS.md`, `HANDOFF.md`, `src/features/chartPatterns/handlers/gaps.ts`, `primitives.ts`, `shared.ts`, `geometry.ts`, `evaluation.ts`, `definitions.ts`, `src/features/scanner/rustScannerContract.ts`, `src-tauri-shell/src/scanner_breakaway_gap.rs`, `scanner_common_gap.rs`, `scanner_contract.rs`, `main.rs`, RSC-03 parity harness and RSC-04 TypeScript parity test. Reference TypeScript blobs were independently matched to the operator's normalized 19 November source snapshot; the actual GitHub branch remains authoritative.

- Created `src-tauri-shell/src/scanner_runaway_gap.rs`: standalone Runaway Gap detector, latest and history response evaluator, fail-closed unsupported-ID/version guards and focused Rust fixture parity tests.
- Modified `src-tauri-shell/src/scanner_breakaway_gap.rs`: expose only the unchanged accepted number-formatting helper as `pub(crate)` for exact reason-text parity.
- Modified `src-tauri-shell/src/main.rs`: declare `#[allow(dead_code)] mod scanner_runaway_gap;`. No new Tauri command or live scanner dispatch.
- Created `src/features/scanner/fixtures/runawayGapParityFixtures.v1.json`: **11 immutable synthetic scenarios**, including score 75/68, exact 1.2x volume boundary, zero average volume, rounded 0.25% minimum gap, 8% uptrend failure, gap-hold equality, short history, empty selection, adjacent historical grouping, and maximum-260-bar historical window. Git blob `4bbcfa3c3b5889203cff727702c748128a39c138`.
- Created `src/features/scanner/__tests__/runawayGapParityRSC05.test.ts`: RSC-03 harness check, direct TypeScript detector response comparison and omitted/empty generatedAt fallback.
- Modified `HANDOFF.md` and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`; created this record.

## Final implementation

The detector follows the existing TypeScript `chart_runaway_gap` handler: at least 22 bars; `gapUpPct` rounded to two decimals and at least 0.25%; the prior 20-bar trend from `[-22,-2)` advances at least 8%; `today.low >= previous.high` and `today.close > today.open`. Score/confidence is 75 when the last-20-bar average volume is truthy and today's volume reaches 1.2x; otherwise 68. The four typed values, string interpolation, gap-zone geometry and pattern start date preserve the original TypeScript contract. Reuses unchanged `round_js`, `gap_up_pct`, `average_volume_excluding_current`, `scalar_number_v1` and `format_js_number`. History mirrors existing bounded 20-bar endpoints, 260-bar maximum window, adjacent-episode grouping, and progress reporting every 50 endpoints. Unsupported scanner IDs fail closed.

## Accepted behavior preserved

All 54 live TypeScript chart patterns, workers, RSC-01/02/03/04 tests and fixtures, existing Breakaway/Common Gap detectors, Tauri IPC, binary `.eod` data, database, and Corporate Actions CA-01 HOLD are unchanged in behavior. No new dependencies, data access or portable build. No local Windows source files were edited via this GitHub-only implementation.

## Validation performed — distinguish evidence

- Preparation: the actual TypeScript evaluator was executed against 25 deterministic cases on a Git-blob-verified source snapshot. Its outputs matched a separately implemented numerical/result builder in **25/25 cases**, including boundaries and long histories. Eleven representative fixed fixtures were regenerated with stable integer baseline bars and their staged Git blob matches the locally TypeScript-verified fixture exactly (`4bbcfa3c...`).
- New TypeScript test source syntax transpilation in preparation: **PASS**. This does not imply Vitest/typecheck or production build.
- Windows guarded checkout at `49565b5` and `e158f086`: **PASS**, with seven protected local files preserved and SHA-256-verified **7/7**. Initial `rustfmt --check` at `49565b5`: **FAIL**, exactly two line-layout differences; [RSC-05 formatting correction](2026-11-19_1935_IST_RSC05_RUSTFMT_CORRECTION_AND_PREPUBLICATION_GATE.md) records the exact patch and the mandatory pre-publication gate in `AGENTS.md`. Corrected Windows `rustfmt --edition 2021 --check`: **PASS** on `e158f086`.
- Windows shared BUILD-01 Cargo wrapper `test scanner_` **Preview PASS**; `Run PASS`: **14 passed, 0 failed, 0 ignored, 1328 filtered out**. Exactly 11 of the selected tests belong to scanner modules (RSC-01/02/03/04/05); three are corporate-action import tests whose names include `scanner_`. This is a focused suite, **not** a full Rust regression run.
- Windows shared Cargo `check` **Preview PASS** and **Run PASS** with `--offline --locked` using the existing project-wide `target`. The one previously observed, non-blocking compiler warning is `create_holiday_skip_result` unused in `src/bhavcopy/calendar.rs`.
- Windows Vitest focused scanner/parity/regression suite **PASS: 8 files, 56/56 tests** (RSC-01 through RSC-05, `nativeIntegration`, chart-pattern scanners and scanner history).
- Windows `npm.cmd run typecheck:renderer` **PASS**; `npm.cmd run build:renderer` **PASS**, Vite v6.4.3, 846 modules transformed, **5.75 s**; `scripts/check-doc-references.ps1` **PASS**.
- Final Windows Git status: `feature/native-rust-scanner-20261119...origin/feature/native-rust-scanner-20261119`; two expected generated-file modifications and the unchanged untracked audit plans/CA-01 HOLD file. No unrelated tracked changes reported.
- GitHub Renderer CI at `e158f086`: **SUCCESS** (independently confirmed); CI does not replace Windows Rust/Cargo results. **Not claimed:** full Rust suite (1328 filtered out), real NSE/BSE `.eod` corpus parity, live native scanner dispatch, portable-native acceptance, or changes to CA-01 HOLD.

## Risks and rollback

Focused synthetic and historical parity tests are now verified on Windows; extreme numeric behavior beyond covered fixtures and real NSE/BSE `.eod` corpus parity remain unverified. The bounded historical evaluator follows accepted RSC-04 control flow without speculative architecture refactor. If future testing fails, correct only RSC-05 on the feature branch or revert its candidate commit; do not change `main`, local generated files, audit plans or the seven protected files/backups. Keep PR #122 draft and unmerged until explicit authorization; do not start another detector migration under this acceptance.
