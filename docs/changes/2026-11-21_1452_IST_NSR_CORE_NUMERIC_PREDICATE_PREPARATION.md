# NS-R1: Core OHLCV numeric candidate preparation and retirement documentation

- **IST:** 2026-11-21 14:52 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`
- **Source baseline:** verified `main@48da280cb37eeeef0e564e1c70b9db20f76bf567`
- **Branch:** `feature/native-scanner-retirement-readiness-20261121`
- **Status:** Candidate code and documentation committed to GitHub; Renderer CI PASS; Windows validation not run. No merge or runtime activation.

## Objective and previous limitation

After NS-04 the native adapter supports four chart gaps but not the ten ready-for-engine core OHLCV rules, remaining daily/pattern/signal rules, custom formulas, alerts or plugins. The native AST already handles the arithmetic, field lookback, comparisons, indicator SMA and boolean operators necessary to represent the core OHLCV predicates. However, native numeric match records do not presently reproduce the full existing TypeScript scanner result metadata. A predicate-only port must not silently change the user-facing output.

## Exact changes

- `src/features/scanner/nativeCoreRuleExpressions.ts` (created): typed candidate-only native AST constructors for previous-day breaks, inside/outside bars, close-near-high/low (range > 0), gap-up/down, NR7 and wide-range candle. NR7 requires strictly narrower current range than each preceding six; wide-range tests against the average of the **preceding** fourteen candle ranges. No third-party dependency.
- `src/features/scanner/nativeCoreRuleExpressions.test.ts` (created): differential tests against accepted TypeScript `runCoreScanner` using deterministic complete-bar fixtures and all warm-up endpoints, explicit strict NR7 and previous-14 wide-range tests, and unknown-ID rejection.
- `docs/plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md` (created): tracked remaining gates NS-R1..NS-R9, constraints, source authority and validation requirements.
- `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` (modified): current authoritative source/migration status and pending acceptance.
- This IST change record.
- `FILE_INVENTORY.md`, `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md` (updated current navigation/status while preserving dated snapshot provenance).

## Final behavior and preservation

There is **no production-route change**: only the accepted four gap patterns reach Rust today. The new AST definitions are exported for differential testing and future result parity work, not passed to `compileNativeScannerRules` or `ScannerWindow`. TypeScript remains the default and complete fallback. Native adjusted requests continue to be rejected under CA-01 HOLD. Market-data reading, chart/drawing/viewport, alert history, DB identity, cancellation, scan ordering, raw `.eod` data, SQLite and plugins are unchanged. No new dependencies or build-system configuration.

## Verification evidence

- Current GitHub `main` and `AGENTS.md` inspected before creating the new isolated branch.
- Source inspection of `nativeScanAst.ts`, native contract, existing core/daily/signal scanner definitions and native UI adapter completed. Pure AST predicate expressions constructed using the existing V1 contract.
- Focused Vitest `src/features/scanner/nativeCoreRuleExpressions.test.ts`: **PASS** on corrected head `93e30894b8b158a63e64ed969657a65f5f5238fa` (3 tests passed). Initial CI on `40f1c7ee` failed only on a flawed NR7 positive fixture that included a flat previous candle; fixture corrected without changing the native predicate.
- Full renderer CI [run 44889620908](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44889620908): **PASS** (286 files passed, 1 skipped; 2,019 tests passed, 1 skipped; `npm run typecheck:renderer` PASS; `npm run build:renderer` PASS, Vite built in 5.38s).
- Rust validation: **NOT RUN**; no Rust modules changed in this bounded implementation.
- Windows native portable, DB parity and smoke acceptance: **NOT RUN**.
- No live source/database/profile contents accessed or modified on the operator's Windows drive; no dependency install.
- No Windows backup created; GitHub baseline and branch commits provide source rollback for remotely created changes. Local dirty source artifacts remain out of scope.

## Risks, limits and rollback

- Numeric predicate parity does **not** imply scanner-result metadata parity. Native numeric result records currently lack full reason, values, direction, source and grouped history semantics; runtime routing remains disabled for the candidates.
- Broad scanner retirement is pending additional bounded gate implementations, especially signals, dynamic plugins, alerts, remaining patterns, numeric full history, and the CA-01 adjusted-data HOLD.
- These fixtures cover valid EOD OHLC bars; Rust reader/IPC parity must be separately proven before enabling production.
- Rollback: close/revert only this isolated branch. Do not reset a dirty Windows worktree or delete other scanner and chart-pattern workers.

## Next

Run actual Renderer CI and correct any errors before considering NS-R1 predicate preparation accepted. The next bounded implementation should complete native numeric match **metadata parity**, with Rustfmt pre-publication, Rust tests, TypeScript tests and real Windows verification before activating any of the candidate rules. No unapproved TypeScript removal.
