# Chart Runtime Static Partition W1.4

**Date:** 2026-08-16 / implementation validation continuing 2026-08-17 IST  
**Scope:** Vite static chunk partition only  
**Basis:** W1.3.2 fully validated source state

## Purpose

The W1.3 production renderer build left one >500 kB bundle warning: the manually forced `feature-chart-runtime` chunk at approximately **685.57 kB minified / 180.38 kB gzip**. W1.4 partitions that synchronous runtime at build time without changing application imports or runtime algorithms.

## Production Runtime Change

W1.4-A scope is **Vite static chunk partition only**.

- Production runtime algorithms changed: **NONE**.
- Dynamic imports added to chart runtime: **NONE**.
- Chart/indicator loading state added: **NONE**.
- Database/persistence changes: **NONE**.
- Rust changes: **NONE**.
- `technicalindicators` dependency/version changes: **NONE**.

## Previous Bundle Classification

```text
feature-chart-runtime =
  src/engine/**
  + src/components/ChartCanvas.tsx
  + src/store/chartStore.ts
  + src/features/charts/**
  + src/indicators/**
```

## W1.4 Bundle Classification

```text
feature-chart-core =
  src/engine/** except analysis paths
  + src/components/ChartCanvas.tsx
  + src/store/chartStore.ts
  + src/features/charts/**

feature-chart-analysis =
  src/indicators/**
  + src/engine/Patterns.ts
  + src/engine/candlestick/**

vendor-technicalindicators =
  node_modules/technicalindicators/**
```

Precedence is deliberate: `technicalindicators` is classified before generic vendor rules, and chart-analysis paths are classified before the broad `src/engine/**` chart-core rule.

`src/engine/Patterns.ts` and `src/engine/candlestick/**` are kept with indicators because the pattern indicator has a runtime dependency on `engine/Patterns.ts`, and candlestick calculations also use `technicalindicators`. This avoids creating an analysis-to-core runtime edge.

## W1.3 Preservation Contract

W1.4 preserves the W1.3 Official Watchlist partition:

- `feature-official-watchlists` remains independently classified;
- six source-specific Watchlist payloads remain lazy chunks;
- generated Watchlist payload paths are not captured by chart rules.

Validated W1.3 baseline:

```text
feature-official-watchlists: 55.04 kB / 11.61 kB gzip
```

## Source Changes

- `vite.config.mts`
  - exports `classifyManualChunk(id)`;
  - Rollup uses that exact function as `manualChunks`;
  - replaces the chart monolith rule with the three approved W1.4 classifications.
- `src/engine/__tests__/ViteChartChunkPartition.test.ts`
  - exercises the production classifier directly using POSIX and Windows-style module IDs;
  - protects W1.3 Watchlist classification boundaries.
- `FILE_INVENTORY.md`
  - records W1.4 architecture/test documentation.

No chart runtime production file is modified.

## Acceptance Gates

W1.4-A can close only if the authoritative Windows validation proves:

1. classification test passes;
2. engine tests pass;
3. indicator tests pass;
4. chart-service tests pass;
5. workspace/chart UI/pattern regressions pass;
6. W1.3 Watchlist tests pass;
7. renderer typecheck passes;
8. renderer production build passes;
9. Vite CJS Node API deprecation warning is absent;
10. `Circular chunk:` warning is absent;
11. `feature-chart-runtime` is absent;
12. `feature-chart-core`, `feature-chart-analysis`, and `vendor-technicalindicators` are emitted;
13. each approved W1.4 chart chunk is <=500 kB;
14. W1.3 Watchlist chunks remain independent;
15. Tauri Rust check passes.

If any approved chart chunk remains >500 kB, the wrapper stops as **W1.4-B design required** and performs no deeper split.

## Authoritative Windows Validation

The guarded W1.4 apply wrapper performs the complete validation and writes a timestamped bundle report under `tmp/`. On a successful validation run, the wrapper appends the exact measured bundle report and validation status to this document. Until that run completes, W1.4 is implemented but **not closed**.
