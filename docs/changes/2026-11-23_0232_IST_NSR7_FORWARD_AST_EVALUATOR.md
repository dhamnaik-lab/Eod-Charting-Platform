# WP-02 / NS-R7 — Forward AST evaluation for bounded numeric history

Recorded 23 November 2026 at 02:32 IST. Verified local main and HEAD at f78b034e91e2dd506d33ca0dd076f87c5eda6b9f. This is the approved next increment after the [stateful indicator kernels](2026-11-23_0223_IST_NSR7_STATEFUL_INDICATOR_KERNELS.md).

## Implementation

[The forward evaluator](../../src-tauri-shell/src/native_scanner/ast/forward.rs) compiles one numeric rule to per-node state and advances it once per completed bar in ascending date order. It uses one OHLCV deque per rule sized to the maximum field lag plus the current bar, previous operands for crosses, and the existing SMA, EMA, RSI and ATR state. Both operands advance for logical operators, even when one side already determines the result. The [series evaluator](../../src-tauri-shell/src/native_scanner/ast.rs) shares scalar field, arithmetic, comparison, logical and cross operations with the forward path.

[The V1 bounded numeric history loop](../../src-tauri-shell/src/native_scanner/scan.rs) now traverses the loaded bars once per rule. Bars before the first eligible capped endpoint seed the state. The existing rule warm-up and trailing cap still govern verdict counts, matches and coverage. Cancellation remains checked at each bar. The 5,000-bar input window, 1,000-endpoint cap, 32-rule request limit, latest-only Core and Daily Market routing, pattern paging, native opt-in, fallback and CA-01 HOLD remain in effect. Database reads, Scanner UI and IPC are unchanged.

## Verification

- Canonical Rustfmt check for ast.rs, ast/forward.rs, scan.rs and parity.rs — PASS, exit 0.
- Shared Cargo Preview and Run with `-CargoAction test -CargoArguments @('--bin','eod-charting-platform-shell','native_scanner')` — PASS, exit 0. 131 passed, zero failed, 1,348 filtered out. Cargo reported 1 minute 34 seconds for the test profile, 5.29 seconds for tests, and the existing dead-code warning in src/bhavcopy/calendar.rs:160. Wrapper elapsed time was 158.28 seconds.
- The TypeScript-backed numeric fixtures compared every forward endpoint against the existing Rust prefix evaluator. The EMA fixture checked exact eligible ordinals, dates and matches through 5,001 endpoints. The integrated seam fixture compared nested EMA/RSI after null gaps, ATR and volume-SMA crosses, and 5,193 bars of nested SMA warm-up across page sizes 1, 59, 1,000 and 5,000. It also checked the OHLCV deque bound.
- Documentation references and scoped whitespace — PASS. No live database access, release build or desktop acceptance ran.

Backup: `backups/pre_opencode_changes_20261123_022512_nsr7-forward-ast/`. Raw test log: `tmp/fixtures/nsr7-forward-ast_20261123_022512/shared-cargo-test.log`.

## Next step

Audit SQLite, binary price and alias writers and select a canonical read consistency mechanism spanning all three before implementing database cursor paging or versioned result delivery. The current deletion permit and selection witness are useful guardrails. Full numeric paging needs evidence that a long read sees a consistent price history, including across in-place writes. Scanner coverage still awaits an eligible numeric-history route. [Design and validation matrix](2026-11-23_0152_IST_NSR7_NUMERIC_HISTORY_PAGING_DESIGN.md).
