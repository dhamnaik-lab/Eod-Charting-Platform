# NS-R3 — direct core result metadata parity

- **IST timestamp:** 2026-11-21 18:42 IST (UTC+05:30)
- **Workstream:** E:\TA Projects\EOD Charting Platform
- **Source authority:** draft PR #129 on `feature/nsr2-core-ohlcv-native-routing-20261121` at `1ec6d8e33c32a9382dba003c894194f1a9721ebe` before this bounded change
- **Objective:** Compare actual Rust core_match_record results against immutable metadata produced by the accepted TypeScript core handlers on identical completed OHLCV bars.

## Previous limitation
NS-R2 validated 30 numeric-AST decision parity scenarios but not actual Rust versus TypeScript identity, categories, reason strings, numeric columns, rounding and dates. The integration tests converted synthetic native metadata rather than exercising Rust's metadata writer.

## Source files
- New: `src/features/scanner/fixtures/nativeCoreMetadataParityFixtures.v1.json`
- New: `src/features/scanner/__tests__/nativeCoreMetadataParityNSR3.test.ts`
- Modified: `src-tauri-shell/src/native_scanner/parity.rs` (test-only, no production runtime changes)
- Modified: `HANDOFF.md` and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- New: this change record

## Implementation
- Shared versioned fixture covers all ten accepted core rule IDs with identical completed raw OHLCV bars, symbol/exchange/date identities, exact numeric ASTs and stable result metadata without timestamps.
- Includes positive, negative, fractional-price, minimum-bar, zero-range, equality-boundary, as-of/latest-endpoint and optional-null metadata cases.
- The TypeScript Vitest suite independently executes `runCoreScanner` on each fixture case and asserts its complete legacy output (excluding generatedAt) equals the committed expected record; also enforces all ten exact production native ASTs.
- The Rust test reads the very same fixture via `include_str!`, validates rule ASTs, executes `evaluate_rule_latest` and actual `core_match_record`, then compares symbol, exchange, ID/name/category, result date, direction, exact reason strings, source and all numeric/null columns. Missing columns or unapproved metadata fail the test.
- `warnings: []` is asserted on TypeScript fixture rows and separately remains preserved by the existing native-to-TS conversion tests. GeneratedAt is inherently runtime-dependent and intentionally excluded.

## Preserved behavior
- Production Rust and TypeScript scanner paths are unchanged. Native remains explicitly opted-in, bounded/latest-only for ten core rules; four accepted gap routes, TypeScript default/fallback, alert rules, cancellation and DB identity protections remain unchanged.
- CA-01 raw-only adjusted-native HOLD persists; no live database reads/mutations, EOD files, packaging, dependencies or Windows working-tree changes.

## Validation and gate
- **Prior branch at `1ec6d8e33c32a9382dba003c894194f1a9721ebe`:** Renderer CI, Rustfmt CI and Rust Compile/Test CI all PASS.
- **This commit:** GitHub Renderer, Rustfmt, Cargo check, native-scanner/full regressions are pending until checks finish; do not report success without their conclusion.
- Local Rust toolchain/rustfmt is not available in the GitHub-editing environment. Rustfmt CI is the required formatter verification for this changed test module; no independent prepublication Rustfmt result is claimed.
- The fixture test is independent at execution: it compares production TS handlers and production Rust functions against the same committed records. It is not real Windows app acceptance, nor a proof of every possible market-data edge case.

## Risks and rollback
- Floating-point rounding, number formatting and Rust/JS string semantics may diverge on specific examples and will be exposed by CI. Address only evidence-backed discrepancies; do not change accepted TS calculations.
- Rollback by reverting this bounded commit on the feature branch; keep PRs #128/#129 unmerged and TypeScript retained until Windows acceptance.
