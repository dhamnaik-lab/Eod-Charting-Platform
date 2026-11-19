# RSC-03 — Shared Rust/TypeScript Scanner Parity Fixture Harness

**Timestamp:** 2026-11-19 15:18 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`  
**Branch:** `feature/native-rust-scanner-20261119` based on `bfb644bf218e43adeec18f3eb69d5bfe5002dc6c`  
**Status:** Candidate. Operator Windows rustfmt check failed before tests. Formatting correction pending Windows recheck; no merge or runtime activation.

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

- GitHub Actions Renderer CI passed Vitest, TypeScript typecheck, and Vite build for commit `f64d835`. RSC-02 fixture inspection found 24 scenarios across four categories, including the empty-scanner-ID negative case. This does not establish Rust compilation.
- Windows preflight: exact branch checkout and seven-file SHA-256 backup passed. Initial `rustfmt --check`: FAIL (two Rust files). Rust tests, Cargo check, and Windows Vitest did not execute. See [formatting follow-up](2026-11-19_1559_IST_RSC03_RUSTFMT_CORRECTION.md).
- Corrected `rustfmt --check`, focused `scanner_` Rust tests, and shared Cargo `check`: pending a new Windows run.
- Final portable acceptance: pending, subject to scope.

## Risks, rollback, next

Semantic JSON matching preserves 1e-12 absolute numeric tolerance; strict object keys/array order and typed geometry remain tested. An empty scanner-ID selection is permitted for the negative fixture; unrelated IDs are rejected. The original main commit is the immutable GitHub rollback point; local Windows files were not touched. Revert the isolated RSC-03 candidate commit if validation fails. Verify actual Windows output before RSC-03 signoff; start no additional milestone without signoff.
