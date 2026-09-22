# W1.4-B1 ChartCanvas Static Extraction Design Specification

**Project:** EOD Charting Platform  
**Phase:** Warning Cleanup / Bundle Architecture  
**Design:** W1.4-B1  
**Date:** 2026-08-17 (IST)

## 1. Purpose

W1.4-A successfully replaced the former monolithic `feature-chart-runtime` bundle with explicit static chart partitions, but the resulting `feature-chart-core` chunk measured **501.44 kB minified / 131.65 kB gzip**, exceeding the approved 500 kB bundle gate by **1.44 kB**.

W1.4-B1 shall remove this final chart-runtime warning through the smallest clean architectural change: extract `src/components/ChartCanvas.tsx` from `feature-chart-core` into its own static `feature-chart-canvas` chunk.

This is a **build-time partition only**. Runtime behavior, execution order, chart algorithms, persistence, database behavior, and user workflows must remain unchanged.

## 2. Current Accepted Baseline

The W1.4-A/W1.4.1 production bundle state is:

- `feature-chart-runtime`: **ABSENT**
- `feature-chart-core`: **501.44 kB / 131.65 kB gzip**
- `feature-chart-analysis`: **164.42 kB / 45.41 kB gzip**
- `vendor-technicalindicators`: **19.81 kB / 4.16 kB gzip**
- `feature-official-watchlists`: **55.03 kB / 11.61 kB gzip**
- W1.3 six lazy Official Watchlist payload chunks remain present.
- Vite CJS Node API deprecation warning: **ABSENT**
- Circular chunk warning: **ABSENT**

The W1.4.1 validation suite passed all chart, indicator, chart-service, workspace/chart-UI/pattern, and W1.3 Watchlist regressions before stopping at the approved >500 kB size gate.

## 3. Scope

### 3.1 Production change

Modify only the manual chunk classification in `vite.config.mts` so that:

```text
src/components/ChartCanvas.tsx
    -> feature-chart-canvas
```

and it is no longer classified into `feature-chart-core`.

The existing W1.4-A boundaries remain:

```text
feature-chart-core
    src/engine/**
      except analysis-owned Patterns.ts and candlestick/**
    src/store/chartStore.ts
    src/features/charts/**

feature-chart-analysis
    src/indicators/**
    src/engine/Patterns.ts
    src/engine/candlestick/**

vendor-technicalindicators
    node_modules/technicalindicators/**
```

### 3.2 Architecture/test/documentation changes

W1.4-B1 may add or update:

- manual-chunk classification regression tests;
- bundle architecture/size measurement checks;
- W1.4-B1 change documentation;
- implementation plan/spec documentation;
- guarded Windows apply/validation wrapper.

### 3.3 Explicitly out of scope

W1.4-B1 must **not** modify:

- `src/components/ChartCanvas.tsx` production code;
- `src/engine/ChartEngine.ts`;
- `src/engine/Renderer.ts`;
- chart drawing algorithms or geometry;
- Renko or other chart-type transforms;
- indicator calculations, registry contents, or indicator catalog;
- chart store semantics;
- chart workspace/persistence schemas;
- database or Rust code;
- W1.3 Official Watchlists runtime/data architecture;
- application lazy-loading behavior;
- `build.chunkSizeWarningLimit`.

No dynamic `import()` shall be introduced for chart runtime code.

## 4. Dependency-Safety Requirement

Before applying the classifier change, the implementation must audit the runtime import direction involving `ChartCanvas.tsx`.

The extraction is permitted only if the resulting Rollup graph does **not** introduce a circular chunk relationship such as:

```text
feature-chart-canvas <-> feature-chart-core
```

or any new circular relationship involving `feature-shell-ui`, `feature-chart-analysis`, or other manually classified chunks.

The source-level dependency direction may legitimately be:

```text
feature-chart-canvas
    -> feature-chart-core
    -> feature-chart-analysis
    -> vendor-technicalindicators
```

provided no reverse runtime dependency is generated.

If the dependency audit or production build produces a circular-chunk warning, W1.4-B1 must stop and report. It must not compensate by broadening the split or weakening warning gates.

## 5. Classifier Precedence

Manual chunk precedence must remain deterministic and explicit.

The classifier must preserve at minimum these ordering constraints:

1. Third-party vendor rules before project feature rules where required.
2. `technicalindicators` -> `vendor-technicalindicators`.
3. analysis-owned paths -> `feature-chart-analysis` before broad engine/core matching.
4. `ChartCanvas.tsx` -> `feature-chart-canvas` before any broad chart-core matching.
5. remaining approved chart-core paths -> `feature-chart-core`.
6. W1.3 Official Watchlists source/payload classification remains unchanged.

The old `feature-chart-runtime` classification must remain absent.

## 6. Runtime Semantics

W1.4-B1 is strictly synchronous/static bundle partitioning.

It must not add:

- loading states;
- suspense boundaries;
- delayed chart initialization;
- asynchronous indicator loading;
- delayed drawing setup;
- changed event ordering;
- changed chart state initialization;
- changed persistence timing.

The browser/WebView may fetch multiple static JavaScript chunks produced by Rollup, but application semantics must remain equivalent to the accepted W1.4-A state.

## 7. Validation Requirements

The Windows validation wrapper must run and pass the following gates.

### 7.1 Source architecture contract

Verify:

- `ChartCanvas.tsx` is assigned exactly to `feature-chart-canvas`;
- it is no longer assigned to `feature-chart-core`;
- analysis paths retain W1.4-A ownership;
- `technicalindicators` retains vendor ownership;
- `feature-chart-runtime` remains absent;
- W1.3 Watchlist rules remain present;
- no `chunkSizeWarningLimit` increase;
- no chart-runtime dynamic imports introduced by W1.4-B1.

### 7.2 Chunk classification regression

The existing chart chunk classifier test must be extended to cover:

- Windows-style and POSIX-style `ChartCanvas.tsx` paths;
- core engine paths;
- `Patterns.ts`;
- `engine/candlestick/**`;
- indicator paths;
- `technicalindicators` node-module paths;
- chart store paths;
- chart service paths;
- non-chart paths that must remain unclassified by chart rules.

### 7.3 Existing behavioral regressions

Re-run the accepted W1.4 regression groups:

- chart engine/drawing/indicator engine tests;
- indicator catalog tests;
- chart-service tests;
- workspace/chart UI/pattern tests;
- W1.3 deterministic Official Watchlist generation check;
- W1.3 Watchlist regression suite.

### 7.4 Renderer and shell validation

Require:

- `npm run typecheck:renderer` -> PASS;
- `npm run build:renderer` -> PASS;
- Vite CJS deprecation warning -> ABSENT;
- circular chunk warning -> ABSENT;
- `npm run tauri:check` -> PASS after the bundle gate passes.

### 7.5 Bundle architecture and size gate

The bundle report must verify all of the following:

- `feature-chart-runtime` monolith: ABSENT;
- `feature-chart-canvas`: PRESENT;
- `feature-chart-core`: PRESENT;
- `feature-chart-analysis`: PRESENT;
- `vendor-technicalindicators`: PRESENT;
- every W1.4 chart-related chunk <= **500.00 kB minified**;
- W1.3 `feature-official-watchlists` and all six lazy payloads remain present;
- no unrelated >500 kB application asset is introduced.

## 8. Stop Conditions

W1.4-B1 must stop without further architectural changes if any of these occur:

1. `feature-chart-core` remains >500 kB.
2. `feature-chart-canvas` exceeds 500 kB.
3. Any other W1.4 chart-related chunk exceeds 500 kB.
4. A circular chunk warning appears.
5. Renderer typecheck fails.
6. A chart/indicator/drawing/workspace regression fails.
7. W1.3 Watchlist parity or regression validation fails.
8. The fresh source hashes do not match the approved implementation basis.

A failure must produce measurements/evidence for a separately approved follow-up design. The wrapper must not silently deepen the split.

## 9. Safety and Packaging

The Windows package must:

- verify exact source-basis hashes before mutation;
- create a verified backup before applying changes;
- patch only approved W1.4-B1 files;
- preserve backup tests as non-discoverable `.bak` files where applicable;
- check native command exit codes explicitly;
- avoid relying on stale `$LASTEXITCODE` after PowerShell script invocation;
- perform **no database operation**;
- perform **no SQLite/WAL/SHM manipulation**;
- emit a timestamped W1.4-B1 bundle report.

## 10. Expected Bundle Outcome

W1.4-B1 is designed to move enough compiled `ChartCanvas.tsx` code out of the current **501.44 kB** core chunk to place `feature-chart-core` safely below 500 kB while keeping the extracted canvas chunk independently well below the threshold.

No exact final sizes are assumed before the production build. Measurements from the Windows build are authoritative.

## 11. Acceptance Criteria

W1.4-B1 is complete only when all of the following are true:

- all required regression suites pass;
- renderer typecheck passes;
- production renderer build passes;
- Tauri Rust check passes;
- no CJS deprecation warning;
- no circular chunk warning;
- old `feature-chart-runtime` monolith remains absent;
- `feature-chart-canvas` exists as its own static chunk;
- `feature-chart-core` is <=500 kB;
- `feature-chart-analysis` is <=500 kB;
- `vendor-technicalindicators` is <=500 kB;
- W1.3 Watchlist partition remains intact;
- no database operation occurs.

If those conditions are met, warning-cleanup W1.4 may be formally closed.

## 12. Design Decision

**Approved approach:** W1.4-B1 — extract `src/components/ChartCanvas.tsx` into a dedicated static `feature-chart-canvas` chunk using manual Rollup classification only.

This is preferred over chart-service or drawing/runtime decomposition because the remaining bundle excess is only 1.44 kB and the canvas boundary is the smallest meaningful architectural separation likely to clear the threshold without touching chart behavior.
