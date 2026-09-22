# Chart Runtime Static Partition W1.4 Design

**Date:** 2026-08-16  
**Project:** EOD Charting Platform  
**Phase:** Warning / bundle hygiene W1.4  
**Status:** Approved design — implementation not yet started

## 1. Goal

Remove the remaining oversized `feature-chart-runtime` production chunk by partitioning the existing synchronous chart runtime into clean static build chunks, while preserving all chart behavior, initialization order, indicator behavior, drawing behavior, workspace persistence, Renko/chart transforms, and renderer semantics.

This phase is a build-architecture change only. It must not introduce lazy loading, asynchronous chart initialization, indicator loading states, new persistence behavior, database changes, or algorithmic changes.

## 2. Current Baseline

The W1.3 production build leaves one remaining >500 kB warning source:

- `feature-chart-runtime`: approximately **685.57 kB minified / 180.38 kB gzip**

W1.3 successfully removed Official Watchlists from the warning path, so W1.4 is scoped only to the chart-runtime bundle.

The current Vite manual-chunk rule groups the following broad source regions into one chunk:

- `src/engine/**`
- `src/components/ChartCanvas.tsx`
- `src/store/chartStore.ts`
- `src/features/charts/**`
- `src/indicators/**`

This grouping is broader than the runtime dependency boundaries require.

## 3. Selected Architecture

Use a **behavior-neutral static three-way partition**:

1. `feature-chart-core`
2. `feature-chart-analysis`
3. `vendor-technicalindicators`

All imports remain synchronous. No application API changes are required merely to support chunking.

## 4. `feature-chart-core`

The operational chart runtime remains together in `feature-chart-core`.

### Included

- `src/engine/**`, except:
  - `src/engine/Patterns.ts`
  - `src/engine/candlestick/**`
- `src/components/ChartCanvas.tsx`
- `src/store/chartStore.ts`
- `src/features/charts/**`

### Responsibilities retained in core

- `ChartEngine`
- renderer/runtime coordination
- scales and viewport mechanics
- chart interaction behavior
- drawing runtime and geometry
- chart state/services
- chart-type and Renko transforms
- shell-facing chart runtime contracts

No operational chart code is rewritten merely to satisfy chunking.

## 5. `feature-chart-analysis`

The analytical subsystem is grouped together in `feature-chart-analysis`.

### Included

- `src/indicators/**`
- `src/engine/Patterns.ts`
- `src/engine/candlestick/**`

### Rationale

The indicator registry eagerly imports standard/community indicators. Pattern-related indicator code has a runtime dependency on `engine/Patterns.ts`, and the candlestick pattern layer also uses `technicalindicators`.

Keeping indicators, `Patterns.ts`, and the candlestick engine together avoids creating a reverse runtime edge from the indicator chunk back into `feature-chart-core`.

Type-only imports from indicator code into `engine/types` are not runtime dependencies and do not require those type files to be moved.

## 6. `vendor-technicalindicators`

The third-party `technicalindicators` package receives its own manual vendor chunk.

### Included

- `node_modules/technicalindicators/**`

### Rationale

- multiple standard indicators depend on the package;
- candlestick calculations also depend on it;
- it is a clean third-party boundary;
- separating it makes application-owned analysis code measurable independently;
- changing local indicator code need not invalidate the vendor chunk hash unnecessarily.

W1.4 does not upgrade or alter the `technicalindicators` dependency.

## 7. Intended Runtime Dependency Direction

The intended runtime relationship is:

```text
feature-chart-core
        |
        v
feature-chart-analysis
        |
        v
vendor-technicalindicators
```

The shell/UI may also directly reference chart-analysis exports where that is already part of the current application graph.

The critical requirement is that W1.4 must not create a new `feature-chart-core -> feature-chart-analysis -> feature-chart-core` circular chunk relationship.

## 8. Behavior Preservation

W1.4 must preserve all existing chart behavior, including:

- chart initialization timing and ordering;
- synchronous indicator availability;
- first-render behavior;
- indicator registry contents;
- indicator calculations and outputs;
- chart rendering semantics;
- drawing interactions and persistence;
- chart-store behavior;
- workspace/tab behavior;
- chart type transforms;
- Renko transforms;
- alert/signal/chart-pattern integration;
- persisted chart/workspace formats;
- existing UI behavior.

There must be no user-visible `Loading indicators...` or equivalent state because W1.4 does not use dynamic imports.

## 9. Explicit Source Safety Boundary

W1.4 should be implemented primarily through Vite chunk classification.

The following production files must not be modified unless validation proves an unavoidable technical requirement and the change is separately reviewed before implementation continues:

- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- indicator algorithms under `src/indicators/**`
- indicator registry contents
- chart store business behavior
- drawing runtime/geometry behavior
- Renko/chart transform implementations
- persistence/workspace code
- Rust/database code

The intended production source change is principally `vite.config.mts` plus architecture tests and documentation.

## 10. Manual-Chunk Classification Rules

The W1.4 Vite configuration must classify the most specific paths before broad chart-core paths.

Conceptually:

```ts
if (id.includes('/node_modules/technicalindicators/')) {
  return 'vendor-technicalindicators';
}

if (
  id.includes('/src/indicators/') ||
  id.endsWith('/src/engine/Patterns.ts') ||
  id.includes('/src/engine/candlestick/')
) {
  return 'feature-chart-analysis';
}

if (
  id.includes('/src/engine/') ||
  id.endsWith('/src/components/ChartCanvas.tsx') ||
  id.endsWith('/src/store/chartStore.ts') ||
  id.includes('/src/features/charts/')
) {
  return 'feature-chart-core';
}
```

Exact path normalization may follow existing `vite.config.mts` conventions, but precedence is fixed: vendor and analysis matches must be resolved before the broad engine/core match.

## 11. Circular-Chunk Protection

W1.4 must treat a new circular-chunk warning as a validation failure.

The production build output must be scanned for messages such as:

```text
Circular chunk:
```

If a circular relationship appears, implementation stops for redesign rather than accepting the warning.

The earlier historical `feature-shell-ui -> feature-chart-runtime -> feature-shell-ui` warning must also remain absent.

## 12. Build Warning Policy

W1.4 must not increase `build.chunkSizeWarningLimit` merely to suppress the warning.

The build result must reflect real architectural partitioning.

If `feature-chart-core`, `feature-chart-analysis`, or `vendor-technicalindicators` remains >500 kB after the approved partition:

1. record the exact minified and gzip size;
2. do not automatically perform a deeper split;
3. stop and return the measured result for a separate W1.4-B design decision.

## 13. W1.3 Preservation

W1.4 must preserve the completed Official Watchlists architecture from W1.3.

Validation must ensure:

- `feature-official-watchlists` remains materially small;
- the six source-selective Watchlist lazy payloads remain independent;
- no Vite manual-chunk change accidentally recombines those source payloads;
- no W1.3 source file requires modification for W1.4.

## 14. Testing Strategy

### 14.1 Static chunk-rule contract tests

Add a focused architecture test/check that verifies:

- `technicalindicators` is assigned to `vendor-technicalindicators`;
- `src/indicators/**` is assigned to `feature-chart-analysis`;
- `engine/Patterns.ts` is assigned to `feature-chart-analysis`;
- `engine/candlestick/**` is assigned to `feature-chart-analysis`;
- ordinary `src/engine/**` files are assigned to `feature-chart-core`;
- `ChartCanvas.tsx`, `chartStore.ts`, and `src/features/charts/**` remain chart core;
- W1.3 generated Watchlist payloads are not classified into chart chunks.

### 14.2 Existing chart/indicator regressions

Run the existing relevant renderer tests covering chart engine, indicators, chart services, drawing/geometry, and chart-pattern behavior.

W1.4 must not weaken, delete, or skip existing tests to make the bundle change pass.

### 14.3 Renderer typecheck

Run:

```powershell
npm run typecheck:renderer
```

Expected: PASS.

### 14.4 Renderer production build

Run:

```powershell
npm run build:renderer
```

Expected:

- PASS;
- Vite CJS Node API deprecation warning remains absent;
- no circular-chunk warning;
- old monolithic `feature-chart-runtime` chunk no longer emitted;
- new chart chunks emitted according to this design.

### 14.5 Tauri check

Run:

```powershell
npm run tauri:check
```

Expected: PASS.

## 15. Bundle Measurement Gate

The validation package must measure minified and gzip sizes for:

- `feature-chart-core-*`
- `feature-chart-analysis-*`
- `vendor-technicalindicators-*`
- `feature-official-watchlists-*` for W1.3 preservation information

It must compare the new chart partition against the W1.3 baseline:

```text
feature-chart-runtime: ~685.57 kB / 180.38 kB gzip
```

The report must state whether every resulting chart-related chunk is below 500 kB.

## 16. Success Criteria

W1.4-A is accepted only when all of the following are true:

1. `feature-chart-runtime` monolith is removed.
2. `feature-chart-core` is emitted.
3. `feature-chart-analysis` is emitted.
4. `vendor-technicalindicators` is emitted.
5. No new circular-chunk warning appears.
6. Vite CJS deprecation warning remains absent.
7. Existing chart/indicator/runtime tests remain green.
8. Renderer typecheck passes.
9. Renderer production build passes.
10. Tauri Rust check passes.
11. W1.3 Official Watchlists partition remains intact.
12. No database or persistence-schema change occurs.
13. No chart behavior or indicator algorithm changes are introduced.
14. Bundle measurements are recorded.
15. If any resulting chart chunk is still >500 kB, execution stops for a separate deeper-split design instead of silently changing scope.

## 17. Manual Smoke Test

After successful build validation, the rebuilt app should receive a short chart smoke test covering:

- opening an ordinary candlestick chart;
- switching symbol/timeframe;
- adding/removing at least one standard indicator;
- opening an indicator that uses `technicalindicators`;
- exercising a chart pattern/candlestick-pattern path if available;
- verifying drawings still render/interact normally;
- switching away from and back to the chart tab/workspace.

The goal is behavior confirmation, not exhaustive feature testing.

## 18. Explicit Non-Goals

W1.4 does not:

- lazy-load indicators;
- introduce asynchronous indicator initialization;
- redesign `ChartEngine` or `Renderer`;
- split drawing code into separate runtime chunks;
- split chart services further;
- change indicator formulas;
- change indicator registry/catalog contents;
- change workspace persistence;
- change Renko behavior;
- change database/Rust code;
- change Watchlist behavior;
- raise Vite's chunk-size warning threshold.

Any deeper chart-runtime decomposition belongs to a separately approved W1.4-B phase only if this static partition is insufficient.
