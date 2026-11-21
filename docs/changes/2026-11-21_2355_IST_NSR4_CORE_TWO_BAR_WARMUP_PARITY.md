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

- GitHub pinned baseline and affected source blobs: verified by read-only connector before writes.
- `src-tauri-shell/src/native_scanner/scan.rs` scoped Rust unit tests, `cargo check --tests --locked`, `cargo test --locked native_scanner -- --nocapture`, `cargo test --locked scanner_ -- --nocapture`, full Rust regression suite: **PENDING GitHub Rust CI**.
- `rustfmt --edition 2021 --check` on scanner modules: **PENDING GitHub Rustfmt CI**.
- Renderer Vitest `scannerHistory.test.ts`, existing `nativeCoreLatestRoutingNSR2.test.ts`, TypeScript typecheck and production renderer build: **PENDING GitHub Renderer CI**.
- Windows normal portable-build and live read-only acceptance: **NOT RUN**; deferred to consolidated scanner release checkpoint, not represented as a pass.
- No source code was compiled or tested in the ChatGPT runtime (Rust toolchain unavailable).

## Risks / limitations

- The eligibility boundary is corrected, but TypeScript's short-data message is recorded in `errors[]`, while the native executor's accepted outcome is `Skipped`. This scoped fix deliberately does not rewrite per-target event/accounting semantics. Exact error-output equivalence remains a separate consideration for comprehensive scanner retirement.
- One-bar database edge cases still require Windows operator acceptance before final native rollout. Unrelated workstream files and user's local dirty entries are outside scope.

## Rollback

Do not merge the PR if CI fails. After merge, if regression appears, revert the focused two-bar warm-up change and its tests through a reviewed change while preserving newer scanner code and the local dirty worktree. Avoid stash/reset/clean/checkout and any price database modifications.
