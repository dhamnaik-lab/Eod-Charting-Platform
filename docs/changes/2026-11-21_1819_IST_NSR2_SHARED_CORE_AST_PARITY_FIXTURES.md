# NS-R2 — shared TypeScript/Rust core numeric AST parity fixtures

- **IST date:** 2026-11-21 18:19 IST (UTC+05:30)
- **Workstream:** E:\TA Projects\EOD Charting Platform
- **Source authority:** draft PR #129 (branch `feature/nsr2-core-ohlcv-native-routing-20261121`, before this change `594414d11a9242b4a9040d581a76d3b11f877256`); parent PR #128 is unmerged.
- **Objective:** Establish executable TS/Rust parity on identical input bars and latest-bar/core numeric predicates for all ten production core rule IDs.

## Previous limitation
The Rust parity harness already reads the committed TypeScript-generated `nativeScannerParityFixtures.v1.json` and validates every numeric endpoint, but previously lacked cases tied to the ten built-in core OHLCV candidate ASTs. Routing tests verified synthetic metadata transport only.

## Files changed
- `src/features/scanner/__tests__/nativeScannerFixtureGenerator.ts`
- `src/features/scanner/fixtures/nativeScannerParityFixtures.v1.json`
- `src/features/scanner/__tests__/nativeScannerParityNS01.test.ts`
- `HANDOFF.md` and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- This `docs/changes` record

## Implementation
- Add ten core numeric source expressions, each executed on the three already accepted shared bar sets (`trend_40`, `trend_60`, `plateau_12`): **30 new core parity cases**.
- The TypeScript generator requires the parsed expression AST to equal `compileNativeCoreCandidate` exactly, preventing semantic drift from the production numeric routing.
- Each fixture stores per-completed-bar expected 1/0/null values, the latest match verdict, and minimum warmup bar count. The existing TypeScript parity test regenerates and checks all fixture values; the **existing Rust parity test** consumes the same fixture and checks all thirty cases at every endpoint.
- No Rust source was changed, so previously accepted Rustfmt-source gating remains intact.

## Behavior preserved
TypeScript default/fallback and unsupported selections; four approved native gap patterns; raw-only CA-01 native HOLD; DB selection/revision/cancellation guards; no source format, DB, or executable packaging changes.

## Validation
- PR #129 before this change: Rustfmt CI **PASS**, Renderer CI (tests/typecheck/build) **PASS**, Rust Compile/Test CI **PASS**.
- Exact new fixture parity needs fresh Renderer and Rust CI results after the branch commit. No new CLI command has been run against the Windows checkout.
- **Limitation:** These fixtures verify the numeric AST match decisions and warmup/null behavior. They **do not** assert complete Rust core metadata output (reason strings, rounded scalar values, date/identity fields) versus a TypeScript legacy result on identical bars. A separate Rust metadata parity test and Windows runtime acceptance are required before TypeScript retirement.

## Risks and rollback
- Rounding and reason-formatting differences may still exist in the Rust metadata writer. Keep PR #129 draft, TypeScript fallback and native OFF by default.
- Rollback is to revert only this parity-fixture commit; preserve parent PR #128, live DB and local dirty files.
