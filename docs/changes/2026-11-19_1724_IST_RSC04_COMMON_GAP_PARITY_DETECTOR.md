# RSC-04 — Isolated Native Rust Common Gap Detector

**IST timestamp:** 2026-11-19 17:24 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform`  
**GitHub branch source:** `feature/native-rust-scanner-20261119` parent `c5b405b2c5c1acc1360fc312d57d57b7c7faa651`  
**Status:** Candidate, pending Windows Rust tests, no merge.

## Objective and previous limitation

RSC-03 established the reusable Rust/TypeScript fixture harness, but Common Gap was still TypeScript-only. Port one bounded Gap-family detector without changing runtime scanner routing.

## Files inspected and created/modified

Inspected `AGENTS.md`, `HANDOFF.md`, `gaps.ts`, `primitives.ts`, `setups.ts`, `geometry.ts`, `shared.ts`, `definitions.ts`, `evaluation.ts`, the scanner contract, RSC-02/03 Rust and TypeScript parity helpers, existing fixture bundles and `main.rs`. Verified TypeScript source blob IDs against the 19 Nov 12:09 IST reference snapshot; current GitHub branch is the source authority.

- Created `src-tauri-shell/src/scanner_common_gap.rs`: native Common Gap detector, isolated versioned latest/history evaluator, fail-closed scanner/contract validation and two Rust tests.
- Modified `src-tauri-shell/src/scanner_breakaway_gap.rs`: expose five unchanged numerical helpers as `pub(crate)`; do not alter accepted Breakaway Gap logic.
- Modified `src-tauri-shell/src/main.rs`: add inactive `#[allow(dead_code)] mod scanner_common_gap;`; no new Tauri IPC command.
- Created `src/features/scanner/fixtures/commonGapParityFixtures.v1.json`: eight TypeScript-derived positive, boundary, negative and historical scenarios, Git blob `f53f9338047ff36e81ec8a291238c50f76490552`.
- Created `src/features/scanner/__tests__/commonGapParityRSC04.test.ts`: reuse RSC-03 parity harness and compare direct TypeScript detector and generatedAt handling.
- Created this change record.

## Final implementation

Common Gap matches >=12 bars; opening gap above previous high or below previous low, rounded to >=0.25%; the 10-bar prior range width <=12% of its midpoint; previous-10 average-volume check (today volume <=1.2x). Emit neutral 45 score, exactly matching TypeScript values/reasons, optional null volume ratio, gap-zone geometry, 20-bar history endpoints, 260-bar maximum window, coalesced adjacent episodes and progress at 50-step boundaries. Reject unported scanner IDs and unsupported contract versions.

## Preserved accepted behavior

All 54 live TypeScript patterns, scanner Worker and UI, the RSC-01/02/03 test suite, Breakaway Gap implementation, Tauri IPC and production dispatch, OHLCV `.eod` data, database and CA-01 HOLD are unchanged. No dependencies, DB access, packaging or local Windows source edits.

## Validation performed

- In isolated preparation, executed the verified current TypeScript evaluator with 23 deterministic Common Gap scenarios (positive, threshold/volume boundaries, negative and historical); separately constructed expected responses matched all **23/23** exactly. Eight representative scenarios were committed and verified by exact Git blob `f53f9338047ff36e81ec8a291238c50f76490552`.
- TypeScript test module syntax transpilation in isolated preparation: **PASS**. This is not a Vitest, typecheck or renderer-build result.
- Rust toolchain absent in preparation environment: Rustfmt, Rust compilation, scanner regressions and Cargo check **NOT RUN**. Windows commands and GitHub Renderer CI remain pending. No portable or real `.eod` corpus parity is claimed.

## Risks and rollback

Risk: Rust and TypeScript floating-point edge-case parity and actual compilation remain unverified until Windows command output. The module copies bounded RSC-02 historical control flow to avoid refactoring accepted RSC-02 runtime; consolidation is a separate architectural decision. Roll back the candidate commit on its feature branch if tests fail; immutable accepted `main` is `bfb644bf`. Preserve local generated files, audit documents, CA-01 HOLD and existing backups. Do not merge or migrate another detector until RSC-04 acceptance.
