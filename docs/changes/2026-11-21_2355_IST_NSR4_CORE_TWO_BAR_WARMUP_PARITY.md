# NS-R4 — Two-completed-bar core OHLCV warm-up parity

- **IST timestamp:** 2026-11-21 23:55 IST (UTC+05:30)
- **Workstream / authorized root:** EOD Charting Platform; `E:\TA Projects\EOD Charting Platform`
- **Source authority:** GitHub `main@de43526171ac0f11964ebeec87ab27b1d2d8e70a`
- **Implementation branch:** `fix/nsr-core-two-bar-parity-20261121`
- **Bounded issue:** [#131](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/131)

## Objective and previous defect

The accepted TypeScript `runCoreEodScannerBatch` requires **two completed bars** before evaluating any selected core OHLCV scanner. Rust `native_scanner::scan::required_bars_for_rule` previously delegated non-pattern rules to generic numeric AST warm-up; the one-bar `close_near_high` / `close_near_low` expressions could be evaluated from only one completed bar. That could produce a native core match when the TypeScript batch would skip the same symbol.

Source-based discrepancy confirmed using `scannerRunner.ts`, `coreOhlcvScanners.ts`, `core_results.rs` and `scan.rs`. No before-change runtime reproduction was performed.

## Files changed

- `src-tauri-shell/src/native_scanner/scan.rs` — only the built-in core IDs use `max(generic_ast_warmup, 2)`, after existing pattern-rule precedence. Add focused Rust unit and synthetic executor regressions.
- `src/plugins/scanner/__tests__/scannerHistory.test.ts` — pin the TypeScript **batch** behavior for 0, 1, and 2 completed EOD bars for `close_near_high` (not the standalone `runCoreScanner` handler).
- This change record.

## Final implementation / behavior changed

All ten canonical built-in core IDs recognized by `native_scanner::core_results::is_core_id` require at least two completed bars for native execution. On zero/one-bar core-only requests, Rust reports a `Skipped` target with no native match; with two valid bars, the same core match remains eligible and complete metadata is generated. No direct `core_match_record` or native contract change.

## Behavior preserved

- Generic numeric/formula AST warm-up remains per-expression, so one-bar arbitrary numeric rules may still evaluate.
- Gap chart-pattern detector warm-up remains delegated to `patterns::minimum_bars_for_pattern_rule`.
- Mixed core+gap latest-only requests retain per-rule evaluation (a short gap warm-up cannot suppress a valid core result).
- Full-history core requests still require TypeScript whole-run fallback; only four accepted gap chart patterns are allowed native history.
- Native remains OFF by default; TypeScript executor and external plugin/alert/formula workflows remain; CA-01 adjusted-native HOLD stays fail-closed.
- No local source, `.eod`, DB, portable executable, generated build output, dependency/lockfile, or other EOD Platform workstream touched.

## Validation commands / actual results

**Validated source revision:** `206fcc01f1fae6360140e4fd914065c4e53f02d8` (the subsequent change-record-only commit does not alter source/test code). **CI verification:** 2026-11-22 00:07 IST.

- Pinned `main` baseline, Rust and renderer source blobs, GitHub branch, three-file scope: **PASS** (read-only connector and compare).
- [Rust Scanner Rustfmt CI #44935559495](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44935559495): **COMPLETED / SUCCESS** — `rustfmt --edition 2021 --check` on every scanner module. Initial run identified two test formatting issues; those were corrected exactly and the successful run uses the final source.
- [Rust Compile and Test CI #44935559512](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44935559512): **COMPLETED / SUCCESS** — `cargo check --tests --locked` PASS; `cargo test --locked native_scanner -- --nocapture`: **115 passed, 0 failed** (both new issue #131 executor tests reported `ok`); `cargo test --locked scanner_ -- --nocapture`: **18 passed, 0 failed**; complete Rust regression suite using the accepted exact Windows-path test skip: **1,406 passed, 0 failed, 26 ignored, 1 filtered out**. All counts are taken directly from GitHub job logs.
- [Renderer CI #44935559542](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44935559542): **COMPLETED / SUCCESS** — Vitest **2,104 passed, 1 skipped** across 289 passing files (one skipped); TypeScript renderer typecheck **PASS**; Vite production build **PASS** (7.26 seconds). Includes new TypeScript short-data test cases and existing full-history core fallback tests.
- **NOT RUN:** Windows native portable build, Windows visual acceptance and live registered-database parity; those remain deferred to the consolidated scanner release checkpoint. A GitHub Linux build does not prove Windows operator acceptance.
- No Rust or renderer source was compiled/tested inside the ChatGPT tool runtime; GitHub Actions is the actual execution authority.

**Source blob evidence:** `scan.rs` `b0704a742d51d0227bb4834bc32d4a346d8bb668`; `scannerHistory.test.ts` `eedfd6a1db29102b81d3bea8d2bc4901044c11d7`.

## Risks / limitations

- The eligibility boundary is corrected, but TypeScript's short-data message is recorded in `errors[]`, while the native executor's accepted outcome is `Skipped`. This scoped fix deliberately does not rewrite per-target event/accounting semantics. Exact error-output equivalence remains a separate consideration for comprehensive scanner retirement.
- One-bar database edge cases still require Windows operator acceptance before final native rollout. Unrelated workstream files and user's local dirty entries are outside scope.

## Rollback

Do not merge the PR if CI fails. After merge, if regression appears, revert the focused two-bar warm-up change and its tests through a reviewed change while preserving newer scanner code and the local dirty worktree. Avoid stash/reset/clean/checkout and any price database modifications.
