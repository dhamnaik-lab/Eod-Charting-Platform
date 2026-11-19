# RSC-05 — Isolated Native Rust Runaway Gap Detector

**IST timestamp:** 2026-11-19 18:25 IST (UTC+05:30)  
**Active workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**Source authority:** `feature/native-rust-scanner-20261119` at parent `f48e41abdaf32d35d708e90e8bc92c4f868c5a1a`, based on accepted main `bfb644bf`.  
**Status:** Candidate. Windows checkout and 7/7 SHA-256 preservation passed at `49565b5`; first Windows Rustfmt check FAILED with two formatting-only differences. Corrected formatting is pending Windows rerun. Draft PR #122 remains unmerged.

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
- Rust toolchain unavailable in the GitHub editing environment. Operator Windows guarded checkout and preservation backup on `49565b5`: **PASS, 7/7**. First Windows `rustfmt --check` on `scanner_runaway_gap.rs` and `scanner_breakaway_gap.rs`: **FAIL**, exactly two formatting differences in the Runaway Gap module. The serial test sequence correctly stopped; Rust tests, Cargo check, Windows Vitest, typecheck/build and documentation checks **NOT RUN**. See [RSC-05 formatting correction](2026-11-19_1935_IST_RSC05_RUSTFMT_CORRECTION_AND_PREPUBLICATION_GATE.md) for the exact correction and the new prevention rule. Fresh Windows validation remains required.
- GitHub Renderer CI at `49565b5`: **SUCCESS**; this does not validate Rust formatting or compilation. No native runtime activation or real NSE/BSE `.eod` corpus parity claimed.

## Risks and rollback

Long-history and unusual numeric inputs beyond committed synthetic cases remain subject to actual Rust parity evidence. The bounded historical evaluator follows accepted RSC-04 control flow without speculative architecture refactor. If validation fails, correct only RSC-05 on the isolated feature branch or revert its candidate commit; do not change `main`, local generated files, audit plans or the seven protected local files/backups. PR #122 must remain draft and unmerged until separately approved.
