# Chart Runtime Static Partition W1.4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining ~685.57 kB monolithic `feature-chart-runtime` bundle with three synchronous static chunks—`feature-chart-core`, `feature-chart-analysis`, and `vendor-technicalindicators`—without changing chart, indicator, drawing, Renko, persistence, or runtime behavior.

**Architecture:** Keep chart execution synchronous and preserve every existing application import. Change only Vite manual-chunk classification so analytical code (`src/indicators/**`, `engine/Patterns.ts`, `engine/candlestick/**`) is separated from operational chart core, while the third-party `technicalindicators` package receives its own vendor chunk. Export the chunk classifier from `vite.config.mts` so a focused architecture test exercises the actual production classification function rather than duplicating its logic.

**Tech Stack:** Vite 5.4.21, Rollup manual chunks, React 18, TypeScript, Vitest 4.1.2, Node.js, Tauri 2/Rust, PowerShell 7.

## Global Constraints

- Basis is the **W1.3.2 fully validated state** with W1.2 ESM Vite configuration active as `vite.config.mts`.
- W1.3 baseline `feature-chart-runtime`: approximately **685.57 kB minified / 180.38 kB gzip**.
- W1.3 baseline `feature-official-watchlists`: approximately **55.04 kB minified / 11.61 kB gzip**.
- All imports remain synchronous; W1.4 must add **no `import()` conversion** to chart/indicator runtime code.
- No chart initialization loading state or indicator loading state may be introduced.
- Do not modify indicator formulas, indicator registry/catalog contents, `ChartEngine`, `Renderer`, drawing behavior, chart store business behavior, Renko transforms, workspace persistence, Rust code, database code, or persistence schemas.
- Do not upgrade or alter the `technicalindicators` dependency.
- Do not raise `build.chunkSizeWarningLimit` to hide the warning.
- Manual-chunk precedence is fixed: `technicalindicators` vendor match first, chart-analysis matches before broad chart-core matches.
- W1.3 Official Watchlists partition must remain intact: `feature-official-watchlists` stays small and all six source-specific lazy payload chunks remain independent.
- A new `Circular chunk:` warning is a hard failure. The historical shell/chart circular warning must remain absent.
- Vite CJS Node API deprecation warning must remain absent.
- If `feature-chart-core`, `feature-chart-analysis`, or `vendor-technicalindicators` is still >500 kB after this approved split, **stop and report measurements**. Do not perform a deeper W1.4-B split without a new approved design.
- The Windows apply package must use exact source hashes, create a verified backup before mutating `vite.config.mts`, and perform **no database operation**.
- Project backups created by the package must not introduce executable `.test.ts` copies that Vitest can rediscover under `tmp/` or another matching path.
- If Git metadata is absent, replace plan commit checkpoints with SHA-256 source checkpoints and verified package backups; do not fabricate Git history.

---

## Locked File Structure

### Create

- `src/engine/__tests__/ViteChartChunkPartition.test.ts` — exercises the actual `classifyManualChunk()` exported from `vite.config.mts` against Windows/POSIX module IDs and protects W1.3 Watchlist paths.
- `docs/changes/2026-08-16_CHART_RUNTIME_STATIC_PARTITION_W1_4.md` — records exact scope, test gates, before/after bundle measurements, and any remaining warning.
- `docs/superpowers/plans/2026-08-16-chart-runtime-static-partition-w1-4-plan.md` — installs this approved implementation plan.

### Modify

- `vite.config.mts` — export the actual chunk classifier and replace `feature-chart-runtime` with `feature-chart-analysis`, `feature-chart-core`, and `vendor-technicalindicators` classification.
- `FILE_INVENTORY.md` — register the new W1.4 architecture test and documentation if the current inventory convention includes test/build files.

### Package-only files

- `EOD_Chart_Chart_Runtime_Static_Partition_W1_4_<timestamp>_IST/Apply-EOD-Chart-Runtime-Static-Partition-W1-4.ps1` — guarded Windows apply/validation wrapper.
- `EOD_Chart_Chart_Runtime_Static_Partition_W1_4_<timestamp>_IST/tools/check-w1-4-source.mjs` — package/source contract checker.
- `EOD_Chart_Chart_Runtime_Static_Partition_W1_4_<timestamp>_IST/tools/check-w1-4-bundle.mjs` — production bundle measurement and acceptance checker.

### Explicitly do not modify

- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `src/engine/Indicators.ts`
- `src/engine/Patterns.ts`
- `src/engine/candlestick/**`
- `src/indicators/**` production files
- `src/components/ChartCanvas.tsx`
- `src/store/chartStore.ts`
- `src/features/charts/**` production files
- `package.json`
- `package-lock.json`
- any Watchlist production file
- any Rust/database file

---

### Task 1: Test the Exact Production Chunk Classifier

**Files:**
- Create: `src/engine/__tests__/ViteChartChunkPartition.test.ts`
- Modify: `vite.config.mts`

**Interfaces:**
- Produces from `vite.config.mts`:

```ts
export function classifyManualChunk(id: string): string | undefined;
```

- `build.rollupOptions.output.manualChunks` must reference `classifyManualChunk` directly, so tests and production execute the same function.

- [ ] **Step 1: Write the failing architecture test before changing the config**

Create `src/engine/__tests__/ViteChartChunkPartition.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyManualChunk } from '../../../vite.config.mts';

describe('W1.4 Vite chart runtime partition', () => {
  it.each([
    ['C:/repo/node_modules/technicalindicators/lib/index.js', 'vendor-technicalindicators'],
    ['C:/repo/src/indicators/registry.ts', 'feature-chart-analysis'],
    ['C:/repo/src/indicators/standard/special/pattern.ts', 'feature-chart-analysis'],
    ['C:/repo/src/engine/Patterns.ts', 'feature-chart-analysis'],
    ['C:/repo/src/engine/candlestick/index.ts', 'feature-chart-analysis'],
    ['C:/repo/src/engine/ChartEngine.ts', 'feature-chart-core'],
    ['C:/repo/src/engine/Renderer.ts', 'feature-chart-core'],
    ['C:/repo/src/components/ChartCanvas.tsx', 'feature-chart-core'],
    ['C:/repo/src/store/chartStore.ts', 'feature-chart-core'],
    ['C:/repo/src/features/charts/chartTypeTransformService.ts', 'feature-chart-core'],
  ])('classifies %s as %s', (moduleId, expectedChunk) => {
    expect(classifyManualChunk(moduleId)).toBe(expectedChunk);
  });

  it('normalizes Windows backslashes before classification', () => {
    expect(classifyManualChunk('E:\\repo\\src\\engine\\candlestick\\patterns.ts'))
      .toBe('feature-chart-analysis');
  });

  it('does not absorb W1.3 generated watchlist payloads into chart chunks', () => {
    expect(
      classifyManualChunk('C:/repo/src/features/watchlists/generated/officialWatchlistNseIndices.generated.ts'),
    ).toBeUndefined();
  });

  it('preserves the existing static Official Watchlist feature classification', () => {
    expect(
      classifyManualChunk('C:/repo/src/features/watchlists/officialWatchlistProviders.ts'),
    ).toBe('feature-official-watchlists');
  });
});
```

The test intentionally imports the root Vite config so no duplicate classifier exists.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run src/engine/__tests__/ViteChartChunkPartition.test.ts
```

Expected: FAIL because `vite.config.mts` does not yet export `classifyManualChunk` and still returns `feature-chart-runtime` for chart paths.

- [ ] **Step 3: Export the production classifier without changing unrelated config**

In `vite.config.mts`, retain the W1.2 ESM-safe root resolution and existing `normalizeModuleId()` logic. Replace the inline `manualChunks(id) { ... }` body with a named export:

```ts
export function classifyManualChunk(id: string): string | undefined {
  const normalizedId = normalizeModuleId(id);

  if (normalizedId.includes('/node_modules/')) {
    if (normalizedId.includes('/node_modules/technicalindicators/')) {
      return 'vendor-technicalindicators';
    }

    if (
      normalizedId.includes('/react/') ||
      normalizedId.includes('/react-dom/') ||
      normalizedId.includes('/scheduler/')
    ) {
      return 'vendor-react';
    }

    if (normalizedId.includes('/zustand/')) {
      return 'vendor-zustand';
    }

    if (normalizedId.includes('/date-fns/')) {
      return 'vendor-date-fns';
    }
  }

  if (
    normalizedId.includes('/src/features/watchlists/officialWatchlist') ||
    normalizedId.includes('/src/components/OfficialWatchlistImportDialog.tsx')
  ) {
    return 'feature-official-watchlists';
  }

  if (
    normalizedId.includes('/src/components/DatabaseToolsDialogs.tsx') ||
    normalizedId.includes('/src/components/ImportCsvDialog.tsx') ||
    normalizedId.includes('/src/components/BhavcopyDownloadWindow.tsx') ||
    normalizedId.includes('/src/components/LayoutManagerDialog.tsx') ||
    normalizedId.includes('/src/components/DeleteDatabaseDialog.tsx') ||
    normalizedId.includes('/src/components/WatchlistManagerDialog.tsx')
  ) {
    return 'feature-utility-dialogs';
  }

  if (
    normalizedId.includes('/src/indicators/') ||
    normalizedId.endsWith('/src/engine/Patterns.ts') ||
    normalizedId.includes('/src/engine/candlestick/')
  ) {
    return 'feature-chart-analysis';
  }

  if (
    normalizedId.includes('/src/engine/') ||
    normalizedId.endsWith('/src/components/ChartCanvas.tsx') ||
    normalizedId.endsWith('/src/store/chartStore.ts') ||
    normalizedId.includes('/src/features/charts/')
  ) {
    return 'feature-chart-core';
  }

  if (
    normalizedId.includes('/src/components/Sidebar.tsx') ||
    normalizedId.includes('/src/components/ChartToolDock.tsx') ||
    normalizedId.includes('/src/components/ChartTabs.tsx') ||
    normalizedId.includes('/src/components/SheetTabs.tsx') ||
    normalizedId.includes('/src/components/Toolbar.tsx') ||
    normalizedId.includes('/src/components/TileHeader.tsx')
  ) {
    return 'feature-shell-ui';
  }

  return undefined;
}
```

The order is intentional: `technicalindicators` before generic vendors, analysis before broad `/src/engine/` core.

- [ ] **Step 4: Wire Rollup to the named classifier**

Inside the existing `rollupOptions.output` object use:

```ts
output: {
  manualChunks: classifyManualChunk,
},
```

Do not change `base`, aliases, dev server, plugins, output directory, or W1.2 ESM behavior.

- [ ] **Step 5: Run the focused architecture test GREEN**

Run:

```powershell
npx vitest run src/engine/__tests__/ViteChartChunkPartition.test.ts
```

Expected: all W1.4 classification tests PASS.

- [ ] **Step 6: Verify W1.2 and W1.3 source contracts manually before proceeding**

Run:

```powershell
Select-String -Path .\vite.config.mts -Pattern "import.meta.url"
Select-String -Path .\vite.config.mts -Pattern "chunkSizeWarningLimit"
```

Expected:
- ESM-safe `import.meta.url` path resolution remains present;
- no `chunkSizeWarningLimit` setting exists.

- [ ] **Step 7: Checkpoint**

If Git exists, commit only `vite.config.mts` and `ViteChartChunkPartition.test.ts`. Otherwise record SHA-256 for both files before Task 2.

---

### Task 2: Prove No Chart/Indicator Behavior Changed

**Files:**
- Test only: existing files under `src/engine/__tests__/`
- Test only: existing files under `src/indicators/__tests__/`
- Test only: existing files under `src/features/charts/__tests__/`
- Test only: `src/features/workspace/__tests__/workspacePersistence.test.ts`
- Test only: selected chart UI and scanner-pattern tests

**Interfaces:**
- Consumes only the build-classification change from Task 1.
- Produces no source modification unless an existing test reveals a pre-existing failure unrelated to W1.4; in that case stop and report instead of changing runtime code under this plan.

- [ ] **Step 1: Run all engine tests**

Run:

```powershell
npx vitest run src/engine/__tests__
```

Expected: PASS. This covers indicator calculation/cache/chaining, candlestick patterns, drawing geometry/runtime contracts, signals, scale behavior, theme, and crosshair behavior.

- [ ] **Step 2: Run indicator catalog tests**

Run:

```powershell
npx vitest run src/indicators/__tests__
```

Expected: PASS.

- [ ] **Step 3: Run chart-service tests**

Run:

```powershell
npx vitest run src/features/charts/__tests__
```

Expected: PASS for chart type transforms, drawing scope/anchors, screenshots, chart sheets/tabs, and chart state mutation services.

- [ ] **Step 4: Run workspace persistence regression**

Run:

```powershell
npx vitest run src/features/workspace/__tests__/workspacePersistence.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run selected chart UI and chart-pattern integration tests**

Run:

```powershell
npx vitest run `
  src/components/__tests__/ChartSettingsMenu.test.ts `
  src/components/__tests__/ChartToolDockTooltips.test.ts `
  src/components/__tests__/DrawingToolGroups.test.ts `
  src/plugins/scanner/__tests__/chartPatternScanners.test.ts `
  src/plugins/scanner/__tests__/chartPatternPrimitives.test.ts
```

Expected: PASS.

- [ ] **Step 6: Stop on any behavioral regression**

If any existing test fails, do not modify chart algorithms, drawings, indicator code, or persistence logic under W1.4. Capture the failing test/output and classify whether it is pre-existing or caused by the build configuration before continuing.

- [ ] **Step 7: Checkpoint**

Record focused test counts and results in the W1.4 change document draft.

---

### Task 3: Renderer Build, Circular-Warning Gate, and Bundle Measurement

**Files:**
- Package-only create: `tools/check-w1-4-bundle.mjs`
- Package-only output: `tmp/w1-4-renderer-build_<timestamp>.log`
- Package-only output: `tmp/w1-4-bundle-report_<timestamp>.txt`

**Interfaces:**
- `check-w1-4-bundle.mjs <dist-assets-path> <report-path>` reads built JS assets and returns exit code `0` only when the approved W1.4-A architecture is present and all three chart chunks are <=500 kB.
- The checker must report W1.3 Watchlist preservation information.

- [ ] **Step 1: Implement deterministic bundle measurement**

Create package tool logic equivalent to:

```js
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';

function measure(path) {
  const bytes = statSync(path).size;
  const gzipBytes = gzipSync(readFileSync(path)).length;
  return { bytes, gzipBytes, kb: bytes / 1000, gzipKb: gzipBytes / 1000 };
}

function requireSingle(files, prefix) {
  const matches = files.filter((name) => name.startsWith(prefix) && name.endsWith('.js'));
  if (matches.length !== 1) {
    throw new Error(`Expected one ${prefix}*.js asset; found ${matches.length}: ${matches.join(', ')}`);
  }
  return matches[0];
}
```

Use decimal kB to match Vite output.

- [ ] **Step 2: Require the three approved chart chunks and reject the monolith**

The checker must require exactly one of each:

```text
feature-chart-core-*.js
feature-chart-analysis-*.js
vendor-technicalindicators-*.js
```

and fail if any `feature-chart-runtime-*.js` exists.

- [ ] **Step 3: Enforce the W1.4-A 500 kB stop gate**

For each of the three chart chunks:

```js
if (measurement.kb > 500) {
  failures.push(
    `${asset} remains ${measurement.kb.toFixed(2)} kB (>500 kB). W1.4-B design required; deeper split not authorized.`,
  );
}
```

Do not raise Vite's warning threshold and do not auto-split anything.

- [ ] **Step 4: Verify W1.3 Watchlist preservation from build assets**

Require:

```text
feature-official-watchlists-*.js
```

and all six W1.3 payload prefixes:

```text
officialWatchlistNseSectors.generated-
officialWatchlistNseIndices.generated-
nseSectorUniverseWatchlistData.generated-
officialWatchlistBseSectors.generated-
officialWatchlistBseIndices.generated-
bseSectorUniverseWatchlistData.generated-
```

The checker must fail if any expected lazy payload is absent. Record `feature-official-watchlists` size and flag failure if it has regressed above **100 kB**, which provides generous headroom over the validated 55.04 kB W1.3 baseline while still detecting accidental recombination.

- [ ] **Step 5: Run renderer typecheck**

Run:

```powershell
npm run typecheck:renderer
```

Expected: PASS.

- [ ] **Step 6: Run renderer build while preserving full output**

Run:

```powershell
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$buildLog = ".\tmp\w1-4-renderer-build_${timestamp}.log"
npm run build:renderer 2>&1 | Tee-Object -FilePath $buildLog
if ($LASTEXITCODE -ne 0) { throw "W1.4 renderer build failed with exit code $LASTEXITCODE" }
```

Expected: Vite build PASS.

- [ ] **Step 7: Fail on CJS or circular warnings**

Scan the build log:

```powershell
$buildText = Get-Content -LiteralPath $buildLog -Raw
if ($buildText -match "The CJS build of Vite's Node API is deprecated") {
    throw 'W1.4 regression: Vite CJS Node API deprecation warning returned.'
}
if ($buildText -match '(?i)Circular chunk:') {
    throw 'W1.4 regression: circular chunk warning detected.'
}
```

Expected: neither pattern exists.

- [ ] **Step 8: Run the bundle checker**

Run:

```powershell
$bundleReport = ".\tmp\w1-4-bundle-report_${timestamp}.txt"
node <package-tools>\check-w1-4-bundle.mjs .\dist\assets $bundleReport
if ($LASTEXITCODE -ne 0) { throw "W1.4 bundle gate failed with exit code $LASTEXITCODE" }
```

Expected: PASS only if all three approved chart chunks are present and <=500 kB, the old monolith is absent, and W1.3 Watchlist chunks remain intact.

- [ ] **Step 9: Record actual measurements**

The report must contain actual values in this structure:

```text
W1.4 Chart Runtime bundle report
W1.3 baseline feature-chart-runtime: 685.57 kB / 180.38 kB gzip
feature-chart-core: <actual> kB / <actual> kB gzip
feature-chart-analysis: <actual> kB / <actual> kB gzip
vendor-technicalindicators: <actual> kB / <actual> kB gzip
feature-official-watchlists: <actual> kB / <actual> kB gzip
All W1.4 chart chunks <=500 kB: YES|NO
Circular chunk warning: ABSENT
Vite CJS warning: ABSENT
```

Never pre-populate result sizes.

- [ ] **Step 10: Stop gate if partition is insufficient**

If any chart chunk is >500 kB, stop W1.4-A at this task. Deliver the measured report and request a separately approved W1.4-B design. Do not proceed to deeper code splitting.

---

### Task 4: Tauri Gate and W1.3 Preservation Regression

**Files:**
- Test only: W1.3 Official Watchlist tests
- No Rust source modifications

**Interfaces:**
- Confirms the Vite-only change has not disturbed the desktop shell or W1.3 lazy-data architecture.

- [ ] **Step 1: Run the W1.3 Watchlist regression suite with live backup contamination excluded by package design**

Run the exact current W1.3 suite paths:

```powershell
npx vitest run `
  src/features/watchlists/__tests__ `
  src/components/__tests__/OfficialWatchlistImportDialog.sourceContract.test.ts
```

Expected: current W1.3 tests PASS. The apply package itself must not create `.test.ts` backup copies under `tmp/`, so no duplicate backup discovery is expected.

- [ ] **Step 2: Run Tauri Rust check**

Run:

```powershell
npm run tauri:check
```

Expected: PASS with no W1.4 Rust changes.

- [ ] **Step 3: Confirm W1.4 touched no forbidden source path**

The package/source manifest must show no changed path under:

```text
src-tauri-shell/
src/indicators/              (except no files; all production files forbidden)
src/engine/                  (except the new __tests__/ViteChartChunkPartition.test.ts)
src/features/charts/         (no production changes)
src/features/watchlists/     (no changes)
```

Expected: only Vite/build-test/docs/inventory files are in the W1.4 payload.

- [ ] **Step 4: Checkpoint**

Record Tauri and W1.3 preservation results for final documentation.

---

### Task 5: Documentation and Acceptance Record

**Files:**
- Create: `docs/changes/2026-08-16_CHART_RUNTIME_STATIC_PARTITION_W1_4.md`
- Create/install: `docs/superpowers/plans/2026-08-16-chart-runtime-static-partition-w1-4-plan.md`
- Modify: `FILE_INVENTORY.md`

**Interfaces:**
- The change document is the canonical record of W1.4-A implementation and measured result.

- [ ] **Step 1: Write change-document scope exactly**

Document:

```text
W1.4-A scope: Vite static chunk partition only.
Production runtime algorithms changed: NONE.
Dynamic imports added to chart runtime: NONE.
Database/persistence changes: NONE.
```

- [ ] **Step 2: Record the exact old and new chunk architecture**

Document the previous classifier:

```text
feature-chart-runtime = engine + ChartCanvas + chartStore + features/charts + indicators
```

and the new classifier:

```text
feature-chart-core = engine except Patterns/candlestick + ChartCanvas + chartStore + features/charts
feature-chart-analysis = indicators + engine/Patterns.ts + engine/candlestick/**
vendor-technicalindicators = node_modules/technicalindicators/**
```

- [ ] **Step 3: Copy actual bundle measurements from Task 3**

Record exact minified/gzip numbers and whether all three chunks are <=500 kB. Do not estimate.

- [ ] **Step 4: Record warning gates**

Document explicitly:

```text
Vite CJS Node API deprecation warning: ABSENT
Circular chunk warning: ABSENT
```

If either is present, W1.4 cannot be marked complete.

- [ ] **Step 5: Record regression gates**

Include actual test counts/results for:
- W1.4 chunk-classification test;
- engine tests;
- indicator tests;
- chart-service tests;
- workspace persistence;
- selected chart UI/pattern tests;
- W1.3 Watchlist tests;
- renderer typecheck;
- renderer build;
- Tauri check.

- [ ] **Step 6: Update `FILE_INVENTORY.md`**

Add the W1.4 architecture test and documentation using the repository's existing inventory format. Do not remove or rename canonical files.

- [ ] **Step 7: Self-review against all 15 W1.4 design acceptance criteria**

Verify one by one:

1. old `feature-chart-runtime` absent;
2. `feature-chart-core` emitted;
3. `feature-chart-analysis` emitted;
4. `vendor-technicalindicators` emitted;
5. circular warning absent;
6. CJS warning absent;
7. chart/indicator tests green;
8. typecheck green;
9. renderer build green;
10. Tauri check green;
11. W1.3 Watchlists intact;
12. no DB/schema change;
13. no algorithm/runtime behavior change;
14. measurements recorded;
15. no unauthorized deeper split if a chunk remains >500 kB.

- [ ] **Step 8: Checkpoint**

Commit documentation/inventory if Git exists; otherwise record SHA-256 in the delivery manifest.

---

### Task 6: Guarded Windows Apply Package

**Files:**
- Create package directory: `EOD_Chart_Chart_Runtime_Static_Partition_W1_4_<timestamp>_IST/`
- Create: `Apply-EOD-Chart-Runtime-Static-Partition-W1-4.ps1`
- Create: `tools/check-w1-4-source.mjs`
- Create: `tools/check-w1-4-bundle.mjs`
- Include exact W1.4 payload files and documentation.

**Interfaces:**

PowerShell wrapper:

```powershell
param(
  [Parameter(Mandatory = $true)][string]$ProjectRoot,
  [switch]$RunValidation
)
```

No database parameter, SQLite command, Corporate Action command, or persistence mutation command is permitted.

- [ ] **Step 1: Build compatibility guards against W1.3.2 applied state**

Before any mutation, compute SHA-256 for each pre-existing file W1.4 will modify:

```text
vite.config.mts
FILE_INVENTORY.md
```

The wrapper accepts only the exact expected basis hash or exact already-applied W1.4 hash. Abort on any other hash to protect newer parallel user work.

- [ ] **Step 2: Create a verified backup without executable test duplication**

Use the existing project backup facility for pre-existing files only:

```text
vite.config.mts
FILE_INVENTORY.md
```

Do **not** place the new `ViteChartChunkPartition.test.ts` into a targeted `tmp/.../src/.../__tests__` backup because it does not exist in the basis and such copies can be rediscovered by Vitest.

Verify backup success by:
- no terminating PowerShell error;
- backup directory exists;
- `backup-manifest.json` exists.

Do not use stale `$LASTEXITCODE` to judge a `.ps1` invocation.

- [ ] **Step 3: Apply payload and verify exact hashes**

Copy:

```text
vite.config.mts
src/engine/__tests__/ViteChartChunkPartition.test.ts
docs/changes/2026-08-16_CHART_RUNTIME_STATIC_PARTITION_W1_4.md
docs/superpowers/plans/2026-08-16-chart-runtime-static-partition-w1-4-plan.md
FILE_INVENTORY.md
```

Then verify every applied file against the package manifest SHA-256.

- [ ] **Step 4: Run package/source contract checker**

`check-w1-4-source.mjs` must verify at minimum:

```text
classifyManualChunk exported
vendor-technicalindicators rule exists
feature-chart-analysis rule exists before broad feature-chart-core engine rule
feature-chart-runtime return removed
chunkSizeWarningLimit absent
vite.config.mts ESM/import.meta.url contract present
no dynamic import added to vite config
W1.3 feature-official-watchlists rule still present
W1.3 generated watchlist payload paths are not captured by chart rules
```

It must also scan package payload paths and fail if any forbidden runtime/Rust/database production file is included.

- [ ] **Step 5: Run validation in deterministic order when `-RunValidation` is supplied**

Run:

```text
1. W1.4 source contract
2. W1.4 chunk-classification Vitest
3. engine Vitest suite
4. indicator Vitest suite
5. chart-service Vitest suite
6. workspace + selected chart UI/pattern Vitest regressions
7. W1.3 Watchlist regressions
8. renderer typecheck
9. renderer production build + CJS/circular warning scan
10. W1.4 bundle measurement gate
11. Tauri Rust check
```

Check `$LASTEXITCODE` immediately after each native `node`, `npx`, `npm`, or `cargo` process.

- [ ] **Step 6: Print a distinct W1.4-B-required stop result if size gate fails**

If build succeeds but one approved chart chunk remains >500 kB, stop with wording equivalent to:

```text
W1.4-A STATIC PARTITION BUILT BUT SIZE GATE NOT MET.
No deeper split was applied.
W1.4-B design approval is required before further partitioning.
See bundle report: <path>
NO DATABASE OPERATION was run.
```

Do not describe this as a successful W1.4 close.

- [ ] **Step 7: Print final PASS only when every acceptance gate passes**

Expected final output:

```text
W1.4 CHART RUNTIME STATIC PARTITION VALIDATION PASS.
feature-chart-runtime monolith: ABSENT.
feature-chart-core / feature-chart-analysis / vendor-technicalindicators: VERIFIED.
All chart-related W1.4 chunks: <=500 kB.
Circular chunk warning: ABSENT.
Vite CJS Node API deprecation warning: ABSENT.
W1.3 Official Watchlists partition: PRESERVED.
NO DATABASE OPERATION was run.
```

Also print the bundle report path.

- [ ] **Step 8: Verify package integrity before delivery**

Before delivery:
- calculate ZIP SHA-256;
- extract the ZIP to a clean temporary directory;
- verify package manifest hashes;
- run the static package/source-contract checker against the staged payload;
- scan wrapper/payload for `sqlite`, database mutation, Corporate Action apply, or forbidden runtime source paths;
- confirm ZIP contains no unrelated project files.

---

## Execution Stop Gates

1. **Task 1:** stop if actual classifier tests cannot represent the approved boundaries without changing chart runtime source.
2. **Task 2:** stop on any chart/indicator/drawing/persistence regression; do not repair application behavior inside a bundle-only phase.
3. **Task 3:** stop on CJS warning, circular chunk warning, missing expected chunk, re-emitted `feature-chart-runtime`, Watchlist recombination, or any chart chunk >500 kB.
4. **Task 4:** stop on W1.3 Watchlist regression or Tauri check failure.
5. **Task 5:** do not mark documentation complete unless actual measurements and test results are recorded.
6. **Task 6:** abort on source-hash mismatch; never force-apply over newer user/parallel-tool work.

## Expected Manual Smoke Test After Successful W1.4 Build

After the Windows validation package passes and a portable app is rebuilt, manually verify:

1. Open an ordinary candlestick chart and confirm first render is immediate/normal.
2. Switch symbol and timeframe; confirm chart redraw behavior is unchanged.
3. Add and remove a standard indicator such as SMA/EMA.
4. Add an indicator backed by `technicalindicators` and confirm it plots immediately with no loading state.
5. Exercise a candlestick/chart-pattern path if exposed by the current UI.
6. Create/select/move a drawing and confirm interaction is unchanged.
7. Switch to another chart tab/sheet/workspace and back; confirm state/persistence remains intact.
8. Confirm there is no `Loading indicators...` or analogous W1.4 UI because this phase is entirely synchronous.

No Corporate Action or database operation is required for this smoke test.
