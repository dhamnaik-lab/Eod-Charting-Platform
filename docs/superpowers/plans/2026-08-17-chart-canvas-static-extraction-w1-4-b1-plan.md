# ChartCanvas Static Extraction W1.4-B1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `src/components/ChartCanvas.tsx` from the W1.4-A `feature-chart-core` manual chunk into a dedicated synchronous `feature-chart-canvas` chunk so every chart-related production chunk is <=500.00 kB minified without changing chart behavior.

**Architecture:** Preserve the accepted W1.4-A/W1.4.1 runtime and import graph. Change only Vite manual-chunk classification so `ChartCanvas.tsx` gets an exact, higher-precedence `feature-chart-canvas` assignment before the broader chart-core rule. Keep `feature-chart-analysis`, `vendor-technicalindicators`, W1.3 Official Watchlists, and all application imports unchanged. Treat any new Rollup circular-chunk warning or any chart-related chunk >500.00 kB as a hard stop.

**Tech Stack:** Vite 5.4.21, Rollup manual chunks, React 18, TypeScript, Vitest 4.1.2, Node.js, Tauri 2/Rust, PowerShell 7.

## Global Constraints

- Basis is the **W1.4.1 applied state** after the TS5097 test-only correction.
- Accepted W1.4.1 measured baseline:
  - `feature-chart-runtime`: **ABSENT**
  - `feature-chart-core`: **501.44 kB / 131.65 kB gzip**
  - `feature-chart-analysis`: **164.42 kB / 45.41 kB gzip**
  - `vendor-technicalindicators`: **19.81 kB / 4.16 kB gzip**
  - `feature-official-watchlists`: **55.03 kB / 11.61 kB gzip**
- The W1.4.1 classifier test must retain the runtime-variable `import('../../../vite.config.mts')` pattern indirectly via a string variable; do **not** restore a literal `.mts` import that causes TS5097.
- `src/components/ChartCanvas.tsx` production code must remain byte-identical.
- Do not modify `ChartEngine`, `Renderer`, indicator algorithms, drawing algorithms, Renko transforms, chart-store semantics, chart-service behavior, workspace persistence, Rust/database code, or W1.3 Watchlist runtime/data code.
- Do not introduce chart-runtime `import()` calls, Suspense, loading states, delayed initialization, or other asynchronous behavior.
- Do not alter or upgrade `technicalindicators`.
- Do not add or increase `build.chunkSizeWarningLimit`.
- Manual-chunk precedence is fixed:
  1. third-party vendor rules where applicable;
  2. `technicalindicators` -> `vendor-technicalindicators`;
  3. analysis-owned paths -> `feature-chart-analysis`;
  4. exact `ChartCanvas.tsx` -> `feature-chart-canvas`;
  5. remaining chart-core paths -> `feature-chart-core`;
  6. existing shell/UI and Watchlist rules remain unchanged.
- `feature-chart-runtime` must remain absent.
- A `Circular chunk:` warning is a hard failure.
- Vite CJS Node API deprecation warning must remain absent.
- Every W1.4 chart-related chunk (`feature-chart-canvas`, `feature-chart-core`, `feature-chart-analysis`, `vendor-technicalindicators`) must be <= **500.00 kB minified**.
- W1.3 Official Watchlists architecture must remain intact: `feature-official-watchlists` plus all six lazy payload chunks.
- If any W1.4 chart-related chunk remains >500.00 kB, **stop and report**. Do not perform another split without a separately approved design.
- `npm run tauri:check` runs only after the renderer build and bundle-size gate pass.
- Windows package must use exact source hashes, create a verified backup, keep copied tests non-discoverable (`.test.ts.bak`), check native command exit codes explicitly, and perform **no database operation**.
- If Git metadata is absent, use SHA-256 checkpoints and verified backups instead of fabricating commits.

---

## Locked File Structure

### Modify

- `vite.config.mts` — add exact `ChartCanvas.tsx` ownership by `feature-chart-canvas` before the broad chart-core rule; remove `ChartCanvas.tsx` from the core branch.
- `src/engine/__tests__/ViteChartChunkPartition.test.ts` — extend the existing W1.4.1 classifier regression to require both POSIX and Windows `ChartCanvas.tsx` paths to map to `feature-chart-canvas`, while preserving the W1.4.1 TS5097-safe dynamic import pattern.
- `FILE_INVENTORY.md` — register W1.4-B1 documentation/test/package entries only if consistent with current inventory convention.

### Create

- `docs/changes/2026-08-17_CHART_CANVAS_STATIC_EXTRACTION_W1_4_B1.md` — record rationale, exact source scope, validation results, and measured before/after bundle sizes.
- `docs/superpowers/plans/2026-08-17-chart-canvas-static-extraction-w1-4-b1-plan.md` — install this approved implementation plan.

### Package-only files

- `EOD_Chart_ChartCanvas_Static_Extraction_W1_4_B1_<timestamp>_IST/Apply-EOD-ChartCanvas-Static-Extraction-W1-4-B1.ps1`
- `EOD_Chart_ChartCanvas_Static_Extraction_W1_4_B1_<timestamp>_IST/tools/check-w1-4-b1-source.mjs`
- `EOD_Chart_ChartCanvas_Static_Extraction_W1_4_B1_<timestamp>_IST/tools/check-w1-4-b1-bundle.mjs`
- `EOD_Chart_ChartCanvas_Static_Extraction_W1_4_B1_<timestamp>_IST/payload-manifest.json`
- `EOD_Chart_ChartCanvas_Static_Extraction_W1_4_B1_<timestamp>_IST/PACKAGE_CONTENT_SHA256.txt`
- `EOD_Chart_ChartCanvas_Static_Extraction_W1_4_B1_<timestamp>_IST/README.md`

### Explicitly do not modify

- `src/components/ChartCanvas.tsx`
- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `src/engine/Indicators.ts`
- `src/engine/Patterns.ts`
- `src/engine/candlestick/**`
- `src/indicators/**` production files
- `src/store/chartStore.ts`
- `src/features/charts/**` production files
- `package.json`
- `package-lock.json`
- any W1.3 Watchlist production/data file
- any Rust/database file

---

### Task 1: Extend the Existing Classifier Regression First

**Files:**
- Modify: `src/engine/__tests__/ViteChartChunkPartition.test.ts`
- Later modify: `vite.config.mts`

**Interfaces:**
- Consumes the existing production export:

```ts
export function classifyManualChunk(id: string): string | undefined;
```

- The test must continue to load the real Vite config with the W1.4.1 TS5097-safe form:

```ts
const viteConfigSpecifier = '../../../vite.config.mts';
const viteConfig = await import(viteConfigSpecifier);
```

- [ ] **Step 1: Change only the ChartCanvas expectations to RED**

In `src/engine/__tests__/ViteChartChunkPartition.test.ts`, preserve the existing `beforeAll()` dynamic import and all current cases. Change the POSIX ChartCanvas case from:

```ts
['C:/repo/src/components/ChartCanvas.tsx', 'feature-chart-core'],
```

to:

```ts
['C:/repo/src/components/ChartCanvas.tsx', 'feature-chart-canvas'],
```

Add a dedicated Windows-path case:

```ts
it('classifies Windows ChartCanvas path into its dedicated chunk', () => {
  expect(
    classifyManualChunk('E:\\repo\\src\\components\\ChartCanvas.tsx'),
  ).toBe('feature-chart-canvas');
});
```

Retain the existing Windows candlestick normalization test, W1.3 generated-payload non-capture test, and `feature-official-watchlists` preservation test.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run src/engine/__tests__/ViteChartChunkPartition.test.ts
```

Expected: FAIL only because the current W1.4-A classifier still returns `feature-chart-core` for `ChartCanvas.tsx`.

A failure caused by TS5097, config loading, syntax, or unrelated classification is not an acceptable RED; fix the test setup until the failure specifically shows:

```text
expected "feature-chart-canvas"
received "feature-chart-core"
```

- [ ] **Step 3: Record pre-change hashes**

Run:

```powershell
Get-FileHash .\vite.config.mts -Algorithm SHA256
Get-FileHash .\src\components\ChartCanvas.tsx -Algorithm SHA256
Get-FileHash .\src\engine\__tests__\ViteChartChunkPartition.test.ts -Algorithm SHA256
```

Store these values in the package basis manifest. The `ChartCanvas.tsx` hash becomes a non-mutation guard.

---

### Task 2: Implement the Minimal Manual-Chunk Classifier Change

**Files:**
- Modify: `vite.config.mts`
- Test: `src/engine/__tests__/ViteChartChunkPartition.test.ts`

**Interfaces:**
- `classifyManualChunk(id)` remains the single production/test classifier.
- No application source import changes.

- [ ] **Step 1: Add the exact ChartCanvas branch before broad chart core**

In `vite.config.mts`, immediately after the existing `feature-chart-analysis` branch and before the broad chart-core branch, add:

```ts
if (normalizedId.endsWith('/src/components/ChartCanvas.tsx')) {
  return 'feature-chart-canvas';
}
```

- [ ] **Step 2: Remove ChartCanvas from the broad core condition**

Change the current core branch from the W1.4-A form:

```ts
if (
  normalizedId.includes('/src/engine/') ||
  normalizedId.endsWith('/src/components/ChartCanvas.tsx') ||
  normalizedId.endsWith('/src/store/chartStore.ts') ||
  normalizedId.includes('/src/features/charts/')
) {
  return 'feature-chart-core';
}
```

to:

```ts
if (
  normalizedId.includes('/src/engine/') ||
  normalizedId.endsWith('/src/store/chartStore.ts') ||
  normalizedId.includes('/src/features/charts/')
) {
  return 'feature-chart-core';
}
```

Do not reorder the `technicalindicators`, Watchlist, utility-dialog, analysis, or shell rules.

- [ ] **Step 3: Run the focused classifier test GREEN**

Run:

```powershell
npx vitest run src/engine/__tests__/ViteChartChunkPartition.test.ts
```

Expected: all classifier tests PASS, including both POSIX and Windows ChartCanvas cases.

- [ ] **Step 4: Run renderer typecheck immediately**

Run:

```powershell
npm run typecheck:renderer
if ($LASTEXITCODE -ne 0) { throw "W1.4-B1 renderer typecheck failed with exit code $LASTEXITCODE" }
```

Expected: PASS with no TS5097 recurrence.

- [ ] **Step 5: Prove ChartCanvas production bytes are unchanged**

Run:

```powershell
Get-FileHash .\src\components\ChartCanvas.tsx -Algorithm SHA256
```

Expected: exactly equal to the Task 1 basis hash.

---

### Task 3: Add Source/Dependency Architecture Guards

**Files:**
- Create package-only: `tools/check-w1-4-b1-source.mjs`

**Interfaces:**
- Input: project root path as first CLI argument.
- Exit `0`: all W1.4-B1 source architecture constraints pass.
- Exit non-zero: print each violated contract and stop before expensive validation.

- [ ] **Step 1: Implement the source checker**

The checker must read:

```text
vite.config.mts
src/components/ChartCanvas.tsx
src/engine/__tests__/ViteChartChunkPartition.test.ts
```

and recursively inspect production files under:

```text
src/engine/
src/features/charts/
```

plus:

```text
src/store/chartStore.ts
```

Required checks:

1. `feature-chart-canvas` exists in `vite.config.mts`.
2. Exact `ChartCanvas.tsx` branch occurs before the broad `feature-chart-core` branch.
3. The broad core condition no longer contains `ChartCanvas.tsx`.
4. `feature-chart-analysis` still owns `/src/indicators/`, `Patterns.ts`, and `/src/engine/candlestick/`.
5. `vendor-technicalindicators` still exists and precedes project feature rules.
6. `feature-chart-runtime` is absent.
7. `feature-official-watchlists` rules remain present.
8. `chunkSizeWarningLimit` is absent.
9. No production file under `src/engine/**`, `src/features/charts/**`, or `src/store/chartStore.ts` imports `ChartCanvas`.
10. `ChartCanvas.tsx` itself has not changed from the exact basis SHA-256 supplied in `payload-manifest.json`.
11. The test contains the TS5097-safe variable import:

```ts
const viteConfigSpecifier = '../../../vite.config.mts';
```

and does not contain:

```ts
from '../../../vite.config.mts'
```

- [ ] **Step 2: Use explicit reverse-import detection**

For each scanned core production file, strip comments only for matching safety and reject runtime/static imports matching either:

```text
ChartCanvas
components/ChartCanvas
```

A source-level reverse import is a stop condition because it would make the intended chunk direction unsafe.

- [ ] **Step 3: Run the checker**

Run:

```powershell
node .\EOD_Chart_ChartCanvas_Static_Extraction_W1_4_B1_<timestamp>_IST\tools\check-w1-4-b1-source.mjs "E:\TA Projects\EOD Charting Platform"
if ($LASTEXITCODE -ne 0) { throw "W1.4-B1 source architecture contract failed with exit code $LASTEXITCODE" }
```

Expected final line:

```text
[PASS] W1.4-B1 source architecture contract.
```

- [ ] **Step 4: Verify the checker fails on a synthetic reversed condition**

Against a temporary copy only, insert either `ChartCanvas.tsx` back into the core classifier or a synthetic core-to-ChartCanvas import and verify the checker exits non-zero. Restore/delete the temporary copy afterward.

---

### Task 4: Re-run All Accepted Behavioral Regressions

**Files:**
- No production changes.

**Interfaces:**
- This task proves bundle classification did not affect application semantics.

- [ ] **Step 1: Run chunk classifier regression**

```powershell
npx vitest run src/engine/__tests__/ViteChartChunkPartition.test.ts
if ($LASTEXITCODE -ne 0) { throw "W1.4-B1 classifier regression failed with exit code $LASTEXITCODE" }
```

Expected: PASS.

- [ ] **Step 2: Run chart-engine regressions**

```powershell
npx vitest run src/engine/__tests__
if ($LASTEXITCODE -ne 0) { throw "W1.4-B1 chart engine regressions failed with exit code $LASTEXITCODE" }
```

Expected: the same accepted engine/drawing/indicator-engine suite remains green.

- [ ] **Step 3: Run indicator regressions**

```powershell
npx vitest run src/indicators/__tests__
if ($LASTEXITCODE -ne 0) { throw "W1.4-B1 indicator regressions failed with exit code $LASTEXITCODE" }
```

Expected: PASS.

- [ ] **Step 4: Run chart-service regressions**

```powershell
npx vitest run src/features/charts/__tests__
if ($LASTEXITCODE -ne 0) { throw "W1.4-B1 chart-service regressions failed with exit code $LASTEXITCODE" }
```

Expected: PASS.

- [ ] **Step 5: Run workspace/chart UI/pattern regressions**

Run exactly:

```powershell
npx vitest run `
  src/components/__tests__/DrawingToolGroups.test.ts `
  src/components/__tests__/ChartToolDockTooltips.test.ts `
  src/components/__tests__/ChartSettingsMenu.test.ts `
  src/plugins/scanner/__tests__/chartPatternPrimitives.test.ts `
  src/plugins/scanner/__tests__/chartPatternScanners.test.ts `
  src/features/workspace/__tests__/workspacePersistence.test.ts

if ($LASTEXITCODE -ne 0) { throw "W1.4-B1 workspace/chart UI/pattern regressions failed with exit code $LASTEXITCODE" }
```

Expected: PASS.

- [ ] **Step 6: Re-run W1.3 generated Watchlist parity**

```powershell
node .\scripts\split-official-watchlist-data.mjs --check
if ($LASTEXITCODE -ne 0) { throw "W1.4-B1 W1.3 generated Watchlist parity failed with exit code $LASTEXITCODE" }
```

Expected:

```text
[PASS] W1.3 generated outputs are deterministic and current (5 artifacts).
```

- [ ] **Step 7: Re-run W1.3 Watchlist regressions**

Run the same seven-file W1.3 suite used in W1.4.1:

```powershell
npx vitest run `
  src/components/__tests__/OfficialWatchlistImportDialog.sourceContract.test.ts `
  src/features/watchlists/__tests__/officialWatchlistLazyLoader.test.ts `
  src/features/watchlists/__tests__/officialWatchlistDialogSourceState.test.ts `
  src/features/watchlists/__tests__/officialWatchlistResolver.test.ts `
  src/features/watchlists/__tests__/officialWatchlistImportService.test.ts `
  src/features/watchlists/__tests__/officialWatchlistProviders.test.ts `
  src/features/watchlists/__tests__/officialWatchlistDataSplit.test.ts

if ($LASTEXITCODE -ne 0) { throw "W1.4-B1 W1.3 Watchlist regressions failed with exit code $LASTEXITCODE" }
```

Expected: **88/88** Watchlist tests PASS unless the repository has gained intentionally approved additional tests; no existing test may regress.

- [ ] **Step 8: Run renderer typecheck again after all tests**

```powershell
npm run typecheck:renderer
if ($LASTEXITCODE -ne 0) { throw "W1.4-B1 renderer typecheck failed with exit code $LASTEXITCODE" }
```

Expected: PASS.

---

### Task 5: Build, Reject Circularity, and Measure the Four Chart Chunks

**Files:**
- Create package-only: `tools/check-w1-4-b1-bundle.mjs`
- Create/update after successful measurement: `docs/changes/2026-08-17_CHART_CANVAS_STATIC_EXTRACTION_W1_4_B1.md`

**Interfaces:**
- Bundle checker input:
  1. `dist/assets` path;
  2. W1.4.1 baseline measurements.
- Exit `0` only when all W1.4-B1 architecture and <=500.00 kB gates pass.

- [ ] **Step 1: Capture the renderer build output**

Run from PowerShell:

```powershell
$buildLog = Join-Path $ProjectRoot ("tmp\w1-4-b1-renderer-build_{0}.log" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
npm run build:renderer 2>&1 | Tee-Object -FilePath $buildLog
$buildExit = $LASTEXITCODE
if ($buildExit -ne 0) { throw "W1.4-B1 renderer build failed with exit code $buildExit" }
```

- [ ] **Step 2: Enforce warning gates against the build log**

Reject either pattern:

```text
The CJS build of Vite's Node API is deprecated
Circular chunk:
```

Use:

```powershell
$buildText = Get-Content -Raw $buildLog

if ($buildText -match "The CJS build of Vite's Node API is deprecated") {
    throw "W1.4-B1 failed: Vite CJS Node API warning returned."
}

if ($buildText -match "Circular chunk:") {
    throw "W1.4-B1 failed: circular chunk warning detected."
}
```

Expected: both absent.

- [ ] **Step 3: Implement exact bundle discovery**

`check-w1-4-b1-bundle.mjs` must discover hashed assets by prefix:

```text
feature-chart-canvas-
feature-chart-core-
feature-chart-analysis-
vendor-technicalindicators-
feature-official-watchlists-
officialWatchlistNseSectors.generated-
officialWatchlistNseIndices.generated-
nseSectorUniverseWatchlistData.generated-
officialWatchlistBseSectors.generated-
officialWatchlistBseIndices.generated-
bseSectorUniverseWatchlistData.generated-
```

It must also confirm no asset begins with:

```text
feature-chart-runtime-
```

For every discovered JavaScript asset, report filesystem byte size converted to decimal kB:

```js
const kb = bytes / 1000;
```

and gzip size computed from the built file bytes.

- [ ] **Step 4: Apply the strict chart size gate**

Require:

```js
featureChartCanvasKb <= 500.00
featureChartCoreKb <= 500.00
featureChartAnalysisKb <= 500.00
vendorTechnicalIndicatorsKb <= 500.00
```

Do not round before comparing. Rounded values are report-only.

Also enumerate every built `.js` asset >500.00 kB. Any unrelated newly oversized application chunk is a failure requiring review.

- [ ] **Step 5: Preserve W1.3 bundle architecture**

Require exactly one `feature-official-watchlists-*` feature chunk and all six expected lazy Watchlist payload families.

Do not require the hashed filename to remain unchanged.

- [ ] **Step 6: Write the timestamped report**

The report must contain at least:

```text
W1.4-B1 ChartCanvas bundle report
W1.4.1 baseline feature-chart-core: 501.44 kB / 131.65 kB gzip
feature-chart-runtime monolith: ABSENT
feature-chart-canvas: <measured> kB / <measured> kB gzip
feature-chart-core: <measured> kB / <measured> kB gzip
feature-chart-analysis: <measured> kB / <measured> kB gzip
vendor-technicalindicators: <measured> kB / <measured> kB gzip
feature-official-watchlists: <measured> kB / <measured> kB gzip
W1.3 six lazy Watchlist payload chunks present: YES
All W1.4-B1 chart chunks <=500 kB: YES|NO
Circular chunk warning: ABSENT
Vite CJS warning: ABSENT
Other >500 kB assets: NONE|<list>
```

Write to:

```text
tmp\w1-4-b1-bundle-report_<yyyyMMdd_HHmmss>.txt
```

- [ ] **Step 7: Stop on failure without deeper changes**

If any W1.4-B1 chart chunk remains >500.00 kB, or a circular warning appears, print measurements and throw:

```text
W1.4-B1 bundle gate failed. Further splitting is not authorized.
```

Do not change any additional classifier boundary automatically.

---

### Task 6: Run Tauri Check Only After Bundle Gate Success

**Files:**
- No source changes.

**Interfaces:**
- This is the final native validation gate.

- [ ] **Step 1: Run Tauri Rust check**

Only after Task 5 passes:

```powershell
npm run tauri:check
if ($LASTEXITCODE -ne 0) { throw "W1.4-B1 Tauri Rust check failed with exit code $LASTEXITCODE" }
```

Expected: PASS.

- [ ] **Step 2: Re-check no database operation occurred**

The apply wrapper must contain no invocation of:
- application database maintenance modes;
- SQLite CLI;
- Corporate Action preview/apply routines;
- database-copy/write routines.

The final output must explicitly state:

```text
NO DATABASE OPERATION was run.
```

---

### Task 7: Record the Accepted Measurement and Documentation

**Files:**
- Create: `docs/changes/2026-08-17_CHART_CANVAS_STATIC_EXTRACTION_W1_4_B1.md`
- Modify if required by repository convention: `FILE_INVENTORY.md`
- Install: `docs/superpowers/plans/2026-08-17-chart-canvas-static-extraction-w1-4-b1-plan.md`

**Interfaces:**
- Documentation consumes the actual bundle report; do not predict or hard-code post-change sizes before the Windows build.

- [ ] **Step 1: Write the change record using measured values**

Include:
- W1.4.1 baseline core **501.44 kB / 131.65 kB gzip**;
- actual `feature-chart-canvas`;
- actual reduced `feature-chart-core`;
- unchanged/near-unchanged analysis and vendor measurements;
- confirmation `feature-chart-runtime` remains absent;
- confirmation W1.3 Watchlists remain present;
- all test totals;
- typecheck/build/Tauri status;
- absence of CJS and circular warnings;
- explicit no-database statement.

- [ ] **Step 2: Update FILE_INVENTORY only if its existing convention requires it**

Register only files introduced by W1.4-B1. Do not reorder or rewrite unrelated inventory entries.

- [ ] **Step 3: Verify no runtime source drift**

Compare SHA-256 of every explicitly protected production file against basis values, especially:

```text
src/components/ChartCanvas.tsx
src/engine/ChartEngine.ts
src/engine/Renderer.ts
src/store/chartStore.ts
```

Only `vite.config.mts` is permitted to have a production-source hash change.

---

### Task 8: Build the Guarded Windows Apply/Validation Package

**Files:**
- Create package directory:
  `EOD_Chart_ChartCanvas_Static_Extraction_W1_4_B1_<timestamp>_IST/`
- Create package files listed in Locked File Structure.

**Interfaces:**
- PowerShell parameters:

```powershell
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [switch]$RunValidation
)
```

- [ ] **Step 1: Build the payload manifest with exact basis and payload hashes**

The manifest must distinguish:
- required pre-apply W1.4.1 source hashes;
- post-apply payload hashes;
- immutable `ChartCanvas.tsx` hash;
- permitted files.

If any required basis hash differs, abort before backup or mutation with a source-drift message.

- [ ] **Step 2: Create a verified project backup before mutation**

Back up every file that will be modified. If copying `ViteChartChunkPartition.test.ts`, name the backup:

```text
ViteChartChunkPartition.test.ts.bak
```

not `.test.ts`.

Verify backup SHA-256 equals source SHA-256 before applying payloads.

- [ ] **Step 3: Apply only approved files**

Permitted project writes:

```text
vite.config.mts
src/engine/__tests__/ViteChartChunkPartition.test.ts
FILE_INVENTORY.md                         # only if payload includes it
docs/changes/2026-08-17_CHART_CANVAS_STATIC_EXTRACTION_W1_4_B1.md
docs/superpowers/plans/2026-08-17-chart-canvas-static-extraction-w1-4-b1-plan.md
```

Any payload path outside this allow-list is a package-contract failure.

- [ ] **Step 4: Verify applied payload hashes**

After copy, compare every written file against `payload-manifest.json`.

- [ ] **Step 5: Run validation in this exact order when `-RunValidation` is supplied**

```text
1. W1.4-B1 source architecture contract
2. W1.4-B1 chunk-classification regression
3. chart engine regressions
4. indicator regressions
5. chart-service regressions
6. workspace/chart UI/pattern regressions
7. W1.3 deterministic generated-data parity
8. W1.3 Watchlist regressions
9. renderer typecheck
10. renderer production build
11. Vite CJS warning gate
12. circular-chunk warning gate
13. W1.4-B1 bundle architecture/size gate
14. Tauri Rust check
```

Use `$LASTEXITCODE` only immediately after native commands such as `node`, `npm`, `npx`, and `cargo`. Do not infer success/failure from stale `$LASTEXITCODE` after invoking PowerShell `.ps1` scripts.

- [ ] **Step 6: Final PASS message**

Only after every gate passes, print:

```text
W1.4-B1 CHARTCANVAS STATIC EXTRACTION VALIDATION PASS.
feature-chart-runtime monolith: ABSENT.
feature-chart-canvas / feature-chart-core / feature-chart-analysis / vendor-technicalindicators: VERIFIED.
All W1.4-B1 chart-related chunks: <=500 kB.
Circular chunk warning: ABSENT.
Vite CJS Node API deprecation warning: ABSENT.
W1.3 Official Watchlists partition: PRESERVED.
ChartCanvas production source: UNCHANGED.
NO DATABASE OPERATION was run.
```

- [ ] **Step 7: Package integrity verification**

Create `PACKAGE_CONTENT_SHA256.txt`, zip the package, extract it into a clean temporary directory, and verify every extracted file hash against the package manifest before delivery.

---

## Self-Review Checklist

Before execution begins, verify this plan against the approved W1.4-B1 design:

- [ ] Only the manual chunk classifier changes in production.
- [ ] `ChartCanvas.tsx` remains byte-identical.
- [ ] Existing W1.4.1 TS5097-safe test import pattern is preserved.
- [ ] `feature-chart-canvas` exact rule precedes broad chart core.
- [ ] `feature-chart-analysis` and `vendor-technicalindicators` ownership remain unchanged.
- [ ] W1.3 Watchlist architecture remains protected.
- [ ] No dynamic chart-runtime import or loading behavior is introduced.
- [ ] No `chunkSizeWarningLimit` suppression is introduced.
- [ ] Circular-chunk warning is a hard stop.
- [ ] Every chart-related chunk must be <=500.00 kB.
- [ ] Tauri check runs after bundle gate success.
- [ ] No database operation is possible through this package.
- [ ] No placeholder/TBD step remains.

## Execution Handoff

Recommended execution mode: **Inline Execution** against a fresh post-W1.4.1 source basis, because the change is build-graph-sensitive and the process must stop immediately if Rollup produces a circular chunk or the <=500.00 kB gate is not satisfied.
