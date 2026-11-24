# NS-R7 — Verify historical endpoint continuity

Recorded 23 November 2026 at 01:17 IST. This bounded WP-02 check verifies the existing historical boundaries. Local `main`/HEAD was `f78b034e91e2dd506d33ca0dd076f87c5eda6b9f` with tree `645ad1216ffa264fb0f6068d147e47c7d50802c2`. Prior WP-01 parity, cancellation-status and SCAN-PERF-01 work was present before validation.

## Verified behavior

- **Numeric executor.** The default `MAX_HISTORY_ENDPOINTS` selects the contiguous trailing 1,000 rule endpoints after warm-up. The executor reads at most 5,000 bars per target. In the new regression, the all-matching numeric rule returned every expected date in descending order for 999, 1,000, 1,001, 5,000 and 5,001 bars. Match and endpoint counts were 999, 1,000, 1,000, 1,000 and 1,000 respectively. The last case read 5,000 bars and still retained only the newest 1,000 endpoints. The exact date comparison would catch a skipped interior date, duplicated match or an off-by-one at either bound.
- **Pattern-only All History.** This route pages backward when no lookback is specified, using 5,000-bar reads with 260 bars of context overlap. The new 5,001-bar Common Gap fixture put two adjacent matches on opposite sides of the page seam. The engine issued two bounded reads, visited 4,982 eligible endpoints after the 19-bar warm-up, and returned one two-match episode with the original first and last dates. The existing 5,000/5,001/as-of and 10,050-bar pattern tests also ran, along with interrupted-page and cancellation tests.
- **Scanner routing.** The built-in Core OHLCV and Daily Market All History selection stays on the TypeScript whole-run fallback. The numeric cap observed in the executor does not limit the separate paged pattern route. The local renderer routing and test sources matched the previously validated copy. The native 32-rule limit, opt-in and CA-01 HOLD remain in effect.

Production Rust, IPC, scanner routing, alerts and UI behavior were preserved. The Rust source change consists of two tests in the existing executor test module. Removing that block produces a byte-for-byte match with the pre-edit backup. The evidence uses deterministic fixtures and no live database reads.

## Validation

- `rustfmt --edition 2021 --check src-tauri-shell/src/native_scanner/scan.rs` — PASS, exit 0. The first check flagged four formatting differences in the added assertions. Applied canonical Rustfmt and rechecked before Cargo.
- Shared Cargo Preview and Run for the `native_scanner::scan::tests` filter on the existing root target — PASS, Preview and Run exit 0. 30 passed, 0 failed, 1,443 filtered out. Test execution took 3.13 seconds. The wrapper, incremental compilation/link and test execution took 2 minutes 28 seconds together.
- Shared Cargo Preview and Run for `cargo check` on the same target — PASS, Preview and Run exit 0. Cargo reported 15.33 seconds and the existing dead-code warning in `src/bhavcopy/calendar.rs:160`.
- Documentation and SHA-256 verification — recorded in `tmp/NSR7_ENDPOINTS_20261123_011014/`.

No portable build or new desktop acceptance ran. These tests establish continuity within the current supported numeric window and across the tested pattern seam. Full native numeric history, any new paging contract, other pattern and database cases and live Windows acceptance remain separate.

## Files and rollback

Added two tests in `src-tauri-shell/src/native_scanner/scan.rs` and updated the root handoffs and [living roadmap](../plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md). The scoped pre-edit backup is `backups/pre_opencode_changes_20261123_011014_nsr7-endpoint-continuity/`. With approval, remove the added test block and reverse this record and related documentation edits. Preserve the earlier cancellation, warning metadata and pagination work.

The endpoint-continuity check is closed. WP-02 is still open for an independently approved change to history coverage or other operational behavior.
