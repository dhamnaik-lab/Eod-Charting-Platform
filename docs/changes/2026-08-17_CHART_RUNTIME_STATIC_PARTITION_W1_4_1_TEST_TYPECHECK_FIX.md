# Chart Runtime Static Partition W1.4.1 — Test Typecheck Fix

## Scope

Test-only correction after W1.4-A validation reached renderer typecheck.

The W1.4 chunk-classification regression passed 13/13 under Vitest, but `tsc -p tsconfig.json --noEmit` rejected the test's literal import of `../../../vite.config.mts` with TS5097 because `allowImportingTsExtensions` is not enabled.

## Fix

`ViteChartChunkPartition.test.ts` now loads the same real `vite.config.mts` from a runtime specifier variable in `beforeAll()`. The classifier assertions remain unchanged.

## Preserved

- `vite.config.mts` is not modified.
- W1.4 chart-core/chart-analysis/vendor partition logic is not modified.
- No chart, indicator, drawing, Renko, workspace, Watchlist, Rust, persistence, or database source is modified.
- No `allowImportingTsExtensions`, `@ts-ignore`, or typecheck exclusion is added.
- Full W1.4 validation is rerun after the test-only correction.
