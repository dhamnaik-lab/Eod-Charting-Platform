# WP-02 / NS-R7 — Verify EMA state across numeric history page seams

Recorded 23 November 2026 at 02:11 IST. Local main and HEAD were f78b034e91e2dd506d33ca0dd076f87c5eda6b9f. The user approved the fixture-only first increment of the [numeric history paging design](2026-11-23_0152_IST_NSR7_NUMERIC_HISTORY_PAGING_DESIGN.md).

## Fixture results

- A test-local stepper carried EMA seed count, seed sum and optional current value across every page. Exact optional values matched the existing single-series EMA for periods 1, 3 and 5 and page sizes 1, 2, 4, 7 and 12. The 12-value input included initial warm-up, seeded recursion, an undefined block split across pages and reseeding.
- A separate EMA threshold fixture matched the existing whole-series AST evaluator for each eligible ordinal, date and verdict, including non-matches. It also compared the exact emitted match dates. It exercised 999, 1,000, 1,001, 5,000 and 5,001 eligible endpoints with page sizes 1, 17, 1,000 and 5,000.
- At the fifth bar after the 1,000-bar seam, the existing prefix evaluator matched when it retained the prior history. Independent reseeding on the second page yielded a defined false verdict. This control detects a restart that is still wrong after the new page has finished warming up.
- The stepper retains three scalar fields and zero bars across pages, independent of the number of input bars. The endpoint fixture intentionally allocates up to 5,005 bars plus oracle, visited-endpoint and match vectors. The page slices are views of the fixture input. This verifies constant EMA carry state, with production reader and result memory left for later measurement.

## Validation

- `rustfmt --edition 2021 --check src-tauri-shell/src/native_scanner/ast.rs` — PASS, exit 0 after applying the two reported formatting differences.
- Shared Cargo Preview and Run using `-CargoAction test -CargoArguments @('--bin','eod-charting-platform-shell','native_scanner::ast::tests::nsr7_ema_page_seam')` — PASS, exit 0. Two passed, zero failed, 1,476 filtered out. Cargo reported 1 minute 10 seconds for the test profile. The wrapper took 132.57 seconds and the tests took 0.03 seconds. Cargo emitted the existing dead-code warning in `src/bhavcopy/calendar.rs:160`.
- The Rust file matched the pre-edit backup after removing the new test block. Documentation reference and whitespace checks passed.

## Scope and next decision

Only the test module in [ast.rs](../../src-tauri-shell/src/native_scanner/ast.rs), this record, the root handoffs and the [living roadmap](../plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md) changed. Backup: `backups/pre_opencode_changes_20261123_020422_nsr7-ema-page-seam/`. Raw test log: `tmp/fixtures/nsr7-ema-page-seam_20261123_020422/shared-cargo-test.log`. No live database access, native desktop acceptance or release build ran.

The EMA fixture increment is complete. The next scoped decision is whether to verify RSI reset and previous-input state and ATR previous-close and true-range state at fixture seams. A generic executor, canonical cursor and snapshot consistency, result IPC, and Scanner exposure require separate decisions. The V1 1,000-endpoint cap, 32-rule request limit, native opt-in and whole-run fallback remain in effect.
