# Native Rust scanner: remaining work and TypeScript retirement gate

**Updated:** 2026-11-21, 14:52 IST (UTC+05:30)
**Workstream:** EOD Charting Platform; authorized Windows root `E:\TA Projects\EOD Charting Platform`
**Source authority:** GitHub `main@48da280cb37eeeef0e564e1c70b9db20f76bf567`, after PR #125 NS-04 and PR #126 CHART-119 merges.
**Implementation branch:** `feature/native-scanner-retirement-readiness-20261121`.
**Status:** Migration IN PROGRESS. No authorization to remove the TypeScript scanner or silently drop supported features. CA-01 issuer-event ownership remains HOLD.

## Verified baseline and accepted results

- Native Rust scanner is opt-in and OFF by default. The frontend adapter routes only four approved gap-pattern IDs directly to native, with all-or-nothing TypeScript fallback on unsupported/mixed selections, alerts, unsupported price basis and errors.
- The native Rust module already provides versioned AST validation and evaluation (OHLCV fields, arithmetic, comparisons, AND/OR, SMA, EMA, RSI, ATR, volume SMA, crossovers), a protected read-only EOD source, bounded workers, progress/cancellation, and a four-pattern dispatch.
- NS-04 full-history gap-only traversal was integrated in PR #125 and its Nifty Bank 14-symbol Exhaustion Gap acceptance returned **128 TypeScript / 128 Rust matches**. This is specific acceptance, not all-scanner parity.
- CA-01 continues to reject adjusted **native** scans; do not lift that gate, change approval rules, or mutate prices.
- The runtime catalog includes built-in daily-market, core OHLCV, chart-pattern and signal definitions plus registered external definitions. The UI currently displays 74 entries, but this number is not a stable migration target; derive IDs dynamically from the catalog.
- Rust numeric All History remains capped at 1,000 endpoints in `native_scanner/scan.rs`. The gap-only paged implementation does not remove that cap.
- Alerts are evaluated by the TypeScript scanner (`scannerRunner.ts`) including price, indicator, drawing and scanner-result triggers; the native adapter explicitly refuses alert-bearing runs. External plugin scanner callbacks are also TypeScript-owned.

## Retirement gates (must all pass before removing the legacy executor)

| Gate | Work | Acceptance evidence |
|---|---|---|
| NS-R1 | Convert and test all ten built-in core OHLCV **predicates** to versioned native AST | Differential synthetic tests for each predicate across every endpoint, plus Rust fixture parity. Predicate equivalence alone does **not** authorize routing; values/reasons/source/direction/history metadata must also match. |
| NS-R2 | Daily market: gainers, losers, volume surge and 52-week high/low | Exact semantics including percentage denominators, incomplete lookback, 252-bar extremes, warm-up, threshold equality, metadata and selected-universe ordering. |
| NS-R3 | Remaining chart-pattern detectors | Port each accepted chart-pattern algorithm without approximation; preserve geometry/pivots/grouping/score and no-look-ahead semantics; verify Rust detector parity against the TypeScript fixture suite. |
| NS-R4 | Built-in visual signals, enabled custom signal rules and user formula scans | Versioned validated AST, indicator warm-up, crossovers, history, plot/value result contracts, deterministic ordering. No unsupported calls silently accepted. |
| NS-R5 | Native alert-equivalent execution | Price/indicator/drawing/scanner-match alerts, trigger deduplication, persisted history, cancellation, and database-change behavior; never emit duplicates on retry/fallback. |
| NS-R6 | Plugin extension compatibility | Decide explicit supported execution boundary for built-in and external plugin scanners. Preserve external metadata-only restrictions; do not execute untrusted plugin code via privileged Tauri or Worker automatically. |
| NS-R7 | Historical/operational parity | Numeric All History without silent truncation, exact dates/values/grouping, lookback control, cancellation counts, partial/error paths, DB switch/ABA guard, NSE/BSE identity and performance evidence. |
| NS-R8 | Safe default migration | Once every supported selection and alert path has parity evidence, native may become default; preserve TypeScript fallback until successful field acceptance and rollout. |
| NS-R9 | Remove only obsolete TypeScript **execution** code | Verify other chart-pattern worker, formula, renderer, plugin and alert consumers remain working. Preserve public result schemas and UI settings; no broad deletes. |

**Separate dependency:** CA-01 adjustment/issuer-event settlement ownership remains HOLD. Native adjusted execution must stay disabled until independently approved and tested. The raw-only migration may advance without altering this safety boundary.

## Current branch implementation

- `src/features/scanner/nativeCoreRuleExpressions.ts`: candidate AST builders for **all ten** core OHLCV predicates, using existing `NativeExprV1`, including a 14-prior-bar average for Wide Range and a strict six-prior-range comparison for NR7. No runtime route or result-contract switch yet.
- `src/features/scanner/nativeCoreRuleExpressions.test.ts`: differential tests against `runCoreScanner` across deterministic complete bars, warm-up boundaries and specialized wide/narrow patterns.
- These are **preparatory implementation**, not ten new production-supported native scanners: current backend still emits only partial metadata for numeric matches. User-facing fallback must remain until matching records are semantically identical.

## Source inventory and boundaries

Inspect first on each follow-on correction: root `AGENTS.md`, immediate `HANDOFF.md` checkpoint, this plan, `src/plugins/scanner/nativeScannerRun.ts`, `src/plugins/scanner/scannerRunner.ts`, `src/features/scanner/nativeScanAst.ts`, `src/features/scanner/nativeScanContract.ts`, `src-tauri-shell/src/native_scanner/{scan,ast,patterns,ipc}.rs`, and affected definition/test files only. Source authority changes after every merged PR; verify a fresh SHA.

No new dependencies, no database access, no changes to `.eod` files or adjustment approval. No source build artifacts under `src/` or `src-tauri-shell/`. Use existing project-root shared Cargo target on Windows, never create a target under `tmp/`.

## Validation and closure rules

- Before publishing changed Rust files: **real local** `rustfmt --edition 2021 --check` on exact files, then dedicated GitHub Actions Rustfmt, Cargo `check --tests`, focused Rust tests and wider regressions.
- Renderer changes: focused Vitest, full relevant regression suite, TypeScript typecheck, and production Vite build. The GitHub Renderer CI must provide actual successful output.
- Windows owner: one final normal `npm run tauri:portable:win` and visual/live read-only parity only after code coverage reaches the accepted release candidate; avoid repeated partial manual acceptance cycles.
- One bounded problem at a time: close its tested/code/documented scope before a new issue; multiple bounded fixes may share this branch only while preserving independent evidence and commit boundaries. No PR merge without explicit user approval.
- Documentation checkpoint and rollback: each meaningful code or configuration change requires `docs/changes/YYYY-MM-DD_HHMM_IST_*.md`. GitHub base SHA and branch per-commit SHAs are the available source rollback authority; local profile/database backups remain the user's Windows responsibility.

## Important limitations

- The scanner catalog and external plugin inventory can change dynamically; count/coverage must be checked against the current catalog, not a hardcoded 74.
- An AST that returns the same boolean decision is **not** equal to a complete scanner result without identical direction, category, reasons, values, generatedAt behavior and history grouping.
- Native backend parity does not imply safe independent sandbox execution of external user-authored plugins.
- Adjusted-price scans remain fail-closed because of CA-01.
