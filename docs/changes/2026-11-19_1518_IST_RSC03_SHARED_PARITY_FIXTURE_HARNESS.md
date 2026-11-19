# RSC-03 — Shared Rust/TypeScript Scanner Parity Fixture Harness

**Timestamp:** 2026-11-19 15:18 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**Branch:** `feature/native-rust-scanner-20261119` based on `bfb644bf218e43adeec18f3eb69d5bfe5002dc6c`  
**Status:** Focused Windows validation PASS on commit `9be65269a5f973c8ac8171476b76ca62b735fe71`, operator output 2026-11-19 16:57 IST. Draft PR #122 remains unmerged; no runtime activation.

## Objective and limitation

RSC-01 and RSC-02 duplicated semantic JSON assertions. RSC-02 also inlined its fixture metadata checks. Establish reusable test-only Rust/TypeScript parity assertions before migrating more detectors.

## Source authority and changed files

Inspected GitHub `AGENTS.md`, `HANDOFF.md`, RSC-01/RSC-02 Rust modules, TypeScript contract, parity tests, and existing fixtures. Base was the verified accepted main commit.

- Modified `src-tauri-shell/src/scanner_contract.rs`: test-only shared fixture runner, semantic JSON comparison, mismatch tests; RSC-01 uses shared comparator.
- Modified `src-tauri-shell/src/scanner_breakaway_gap.rs`: RSC-02 reuses the helper while preserving typed field, geometry, and floating-point parity assertions.
- Modified `src/features/scanner/__tests__/breakawayGapParityRSC02.test.ts`: reuse TS fixture helper; retain direct detector tests.
- Created `src/features/scanner/__tests__/parityFixtureHarness.ts`: reusable live TypeScript request/response and fixture integrity validation.
- Created `src/features/scanner/__tests__/scannerParityHarnessRSC03.test.ts`: accepted fixture, output mutation, duplicate scenario regression tests.
- Modified `HANDOFF.md` and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`; added this change record.

## Preserved

All 54 chart patterns, RSC-01 and RSC-02 committed fixtures, native Rust detector output, TypeScript scanner, chart worker, Tauri IPC, database, `.eod` format, and Corporate Actions remain unchanged. Rust native scanner remains inactive; CA-01 on HOLD. No dependencies added.

## Validation

- **Operator Windows checkout and preservation:** latest feature branch fast-forwarded from `e816363` to `9be65269`; all seven preserved files verified unchanged by SHA-256. Existing modified generated files and five untracked audit/CA documents remain deliberately excluded.
- **Rust formatting:** `rustfmt --edition 2021 --check` on `scanner_contract.rs` and `scanner_breakaway_gap.rs` — **PASS** on `9be65269`. Earlier formatting failures were corrected by commits `e816363` and `9be65269`.
- **Rust tests:** BUILD-01 shared Cargo `test scanner_` Preview and Run **PASS**, **10 passed, 0 failed, 1328 filtered out**. The filter matches seven scanner-module tests and three separately scoped corporate-action tests with `scanner` in their names; it is not a full Rust suite. Shared target `E:\TA Projects\EOD Charting Platform\target`, `--offline --locked`.
- **Cargo check:** BUILD-01 shared Cargo `check` Preview and Run **PASS**; only an existing unused-function warning for `create_holiday_skip_result` in `src/bhavcopy/calendar.rs`.
- **TypeScript parity:** Vitest **3 files, 10/10 tests PASS** (`scannerParityHarnessRSC03.test.ts`, `rustScannerContractRSC01.test.ts`, `breakawayGapParityRSC02.test.ts`).
- **Documentation validation:** `check-doc-references.ps1` **PASS**, user-provided Windows output.
- **GitHub:** Renderer CI for `9be65269` **SUCCESS** (repository workflow result checked via GitHub). No further Rust validation is inferred from renderer CI.
- **Scope boundary:** full Rust suite, real `.eod` corpus parity, native Tauri scanner activation and portable-native scanner acceptance **not performed**. RSC-03 is a test-only harness, so no new live scanner smoke result is claimed.

## Risks, rollback, next

Semantic JSON matching preserves 1e-12 absolute numeric tolerance; strict object keys/array order and typed geometry remain tested. An empty scanner-ID selection is permitted for the negative fixture; unrelated IDs are rejected. The original main commit is the immutable GitHub rollback point; local Windows files were not touched. Use the immutable accepted main commit `bfb644bf` to compare or roll back if subsequently required. RSC-03 focused checks are accepted; remain on the draft feature branch while the next bounded RSC-04 scope awaits explicit approval. No merge or RSC-04 implementation is included in this validation closeout.
