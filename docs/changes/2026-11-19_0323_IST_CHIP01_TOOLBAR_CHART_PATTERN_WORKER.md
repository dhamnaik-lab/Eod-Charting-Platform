# CHIP-01 — Toolbar Chart Pattern Off-Thread Worker Evaluation & Scan Now Fix

**Timestamp:** 2026-11-19 03:23 IST (`UTC+05:30`)  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Task ID:** `CHIP-01`  
**Status:** Automated renderer, parity, worker-cancellation, component, typecheck, build, and headless-browser responsiveness checks **PASS**; Windows portable rebuild & manual smoke test **PENDING** user execution.

---

## 1. Root Cause

1. **Main-thread UI freeze (`src/components/Toolbar.tsx`):** `handleRunChartPatternScan` called synchronous `runActiveChartPatternScan(instrument, bars)`, which evaluated up to 44–54 chart-pattern detectors across every endpoint bar (`20..bars.length`, 220-bar sliding context window) and then ran synchronous `clusterNearbyMacroResults(results, bars)` (nested `bars.findIndex(...)` scans) directly on the renderer UI thread.
2. **Stale-closure defect in `Scan Now` (`src/components/Toolbar.tsx`):** `ToolbarChartPatternSettingsModal`'s `onScanNow` called `clearScannerChartOverlay()` and `clearScannerPatternMap()` followed synchronously by `handleRunChartPatternScan()`. Because React state had not re-rendered yet, `handleRunChartPatternScan` read the stale `isChartPatternActive === true` closure, immediately entered the toggle-OFF branch, toasted `"Chart patterns removed from chart."`, and returned without running a scan.
3. **Missing worker request cancellation & lifecycle cleanup (`src/components/Toolbar.tsx`, `src/features/chartPatterns/workerClient.ts`):** Toolbar chart-pattern scans lacked monotonic request-ID supersession, context-change worker cancellation, and unmount worker disposal, and `createInlineExecutor()` in `workerClient.ts` shared a single mutable `cancelled` boolean across sequential `evaluate` calls.

---

## 2. Authority & Inspected Files

- **Authorized root:** `E:\TA Projects\EOD Charting Platform`
- **Files inspected before editing:**
  1. `AGENTS.md`
  2. `HANDOFF.md`
  3. `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
  4. `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
  5. `src/components/Toolbar.tsx`
  6. `src/features/chartPatterns/evaluation.ts`
  7. `src/features/chartPatterns/evaluation.worker.ts`
  8. `src/features/chartPatterns/workerClient.ts`
  9. `src/features/chartPatterns/index.ts`
  10. `src/features/chartPatterns/scanService.ts`
  11. `src/features/chartPatterns/types.ts`
  12. `src/plugins/scanner/scannerRunner.ts`
  13. `src/plugins/scanner/scannerPatternMap.ts`
  14. `src/plugins/scanner/scannerChartPriceBasis.ts`
  15. `src/plugins/scanner/scannerChartTimeframe.ts`
  16. `src/components/ScannerWindow.tsx`
  17. `src/store/uiStore.ts`
  18. `src/components/__tests__/ScannerChartRouting.test.ts`
  19. `src/components/__tests__/toolbarToggleStatesB17.test.tsx`
  20. `src/components/__tests__/ToolbarAdjustedControls.test.tsx`
  21. `src/components/__tests__/ScannerOverlayGeometry.test.ts`
  22. `src/components/__tests__/ScannerOverlayRemoval.test.ts`
  23. `src/plugins/scanner/__tests__/toolbarPatternScanBenchmarkB21.test.ts`
  24. `src/plugins/scanner/__tests__/scannerHistory.test.ts`
  25. `src/features/chartPatterns/__tests__/nativeIntegration.test.ts`

---

## 3. Pre-Edit Backup & SHA-256 Evidence

- **Pre-edit backup directory:** `backups/pre_opencode_changes_20261119_030634_chip01-toolbar-chart-pattern-worker`
- **Backup manifest:** `backups/pre_opencode_changes_20261119_030634_chip01-toolbar-chart-pattern-worker/backup-manifest.json` (`fileCount: 8`, `totalBytes: 285450`)
  *(Note: an earlier malformed-argument invocation `backups/pre_opencode_changes_20261119_030617_chip01-toolbar-chart-pattern-worker` copied 0 files and was superseded by `20261119_030634` before any edits were made.)*

| File | Before SHA-256 | After SHA-256 |
|---|---|---|
| `src/features/chartPatterns/evaluation.ts` | `C1BCD7C2025FABA9EC81A402FBA098F3E897203AE71AAC551E484269A468A0F0` | `71763807E64B6BC923D4DAFB8E73328B7ACE1ECF7DDE20C7D81A1726ED8F6486` |
| `src/features/chartPatterns/evaluation.worker.ts` | `B4F39777EF03CBA25AC9407AD4BE0E32B14DD90CBA237224C27EEEBCA354C084` | `DA9187624B2937B8A7993CE7B1D10D4C3EC2BD24EDCA24BF83E7163EACC77035` |
| `src/features/chartPatterns/workerClient.ts` | `77BFCB2608F268569D7ACA11092932A733EAAE9AC6DD31AEC045AC2A1CD200C4` | `B7D3FB53180112108335484F090F05C80CADA65B4EE8F55D09A257C6FCEF6599` |
| `src/components/Toolbar.tsx` | `626881B6C911D3769E05A37BE1289320A670808AC24B197220FABA8EE00AA228` | `DAC00AFD5C41A01A3E427CFAE5D0D33E9D52E55B18A061FEDE01945073B36EFF` |
| `src/components/__tests__/ScannerChartRouting.test.ts` | `289057161D821C03F8794CFA4FF037EEB117F03E6A0B32B93F50EC078F217E89` | `A239B1EE160C65BC6F7C6F59A9F60134F9089B84C2116DB32E497F871E629A4E` |
| `src/features/chartPatterns/__tests__/toolbarChartPatternWorkerCHIP01.test.ts` | *(new file)* | `25866043A07A688B66EE3B4B3EC2CA31C2261727138D10E53EE64F9D9140AF33` |
| `src/components/__tests__/ToolbarChartPatternChipCHIP01.test.tsx` | *(new file)* | `B73D9DCE61FC0FFC11F8C48D89BD1C14BF6B9ACEBC4A540ED24BCF42E63B5E3F` |

---

## 4. Implementation Summary (Changed vs. Preserved)

### Changed
- **`src/features/chartPatterns/evaluation.ts`:** Added `TOOLBAR_CHART_PATTERN_MIN_BARS` (`20`), `TOOLBAR_CHART_PATTERN_CONTEXT_BARS` (`220`), `TOOLBAR_CHART_PATTERN_STORAGE_KEY`, `resolveToolbarChartPatternSelection()`, `clusterToolbarChartPatternResults()` (indexed $O(B + R \log R + R \cdot K)$ date lookup preserving first-index `findIndex` parity and exact 12-bar same-scanner/same-family clustering), and `evaluateToolbarChartPatterns()` (running Toolbar scanning rules, `minScore` `40`/`65`, endpoint deduplication, and clustering off-thread with cancellation checks).
- **`src/features/chartPatterns/evaluation.worker.ts`:** Added `'evaluate-toolbar'` message dispatch calling `evaluateToolbarChartPatterns` and returning `'complete-toolbar'` (while preserving existing `'evaluate'` / `'progress'` / `'complete'` / `'error'` paths).
- **`src/features/chartPatterns/workerClient.ts`:** Extended `ChartPatternEvaluationExecutor` with `evaluateToolbar(input)` on both `createWorkerExecutor()` and `createInlineExecutor()`, lazy worker spawning, clean worker termination on `cancel()` / `dispose()` / `error`, `postMessage` failure cleanup, and per-run `activeRunId` cancellation isolation in `createInlineExecutor()`.
- **`src/components/Toolbar.tsx`:**
  - Updated `handleRunChartPatternScan(options?: { forceRescan?: boolean })` to resolve `resolveToolbarChartPatternSelection()` on the UI thread, dispatch evaluation and clustering off-thread via `createChartPatternEvaluationExecutor().evaluateToolbar(...)`, guard every async stage with monotonic `chartPatternScanRequestIdRef` and post-worker chart freshness checks, and cancel/dispose workers cleanly on symbol/tab/requestedInstrument/timeframe/bars/basis/database changes and component unmount.
  - Updated `ToolbarChartPatternSettingsModal` `onScanNow` to invoke `handleRunChartPatternScan({ forceRescan: true })` (fixing the stale `isChartPatternActive` closure bug) and wrapped the `Chart Patterns` chip `onClick` so React mouse events never leak into `options`.
- **`src/components/__tests__/ScannerChartRouting.test.ts`:** Updated the white-box `setup()` globals for AST-extracted `handleRunChartPatternScan` to supply the worker executor / request-ID refs and spy on `evaluateToolbar` (preserving all 13 routing, aggregation, stale-context, `ScannerWindow`, and `localStorage` assertions without relaxation).
- **Added tests:**
  - `src/features/chartPatterns/__tests__/toolbarChartPatternWorkerCHIP01.test.ts`
  - `src/components/__tests__/ToolbarChartPatternChipCHIP01.test.tsx`

### Preserved
- `runActiveChartPatternScan` and `clusterNearbyMacroResults` in `src/components/Toolbar.tsx` remain intact and untouched, preserving `toolbarPatternScanBenchmarkB21.test.ts` and `ScannerChartRouting.test.ts` `localStorage` contract tests.
- All 54 pattern definitions, handlers, scoring thresholds (`40`/`65`), sorting (`selectBestChartPatternResult`), overlay geometry, `ScannerWindow` / `scannerRunner.ts` behavior, Corporate Actions, `.eod` storage, and RSC-01/RSC-02 Rust modules remain untouched.
- Global `findLocalPivots`, `WeakMap` history caches, and broad worker refactors were intentionally not added.

---

## 5. Automated Validation & Headless Responsiveness Evidence

*(Final post-documentation-update validation pass results are recorded in `HANDOFF.md` and verified after all edits.)*

- **Headless Chrome (`--headless=new`) real Web Worker responsiveness benchmark (Vite dev + CDP, synthetic completed OHLCV matching B21 generator, JIT warmup separated, 100% stable-result parity verified):**

| Bars | Matches | Result Parity | Before Sync `maxRafGapMs` | Before Sync `maxTimerDelayMs` | After Worker `maxRafGapMs` | After Worker `maxTimerDelayMs` | After Worker `rAF` Frames During Run |
|---:|---:|---|---:|---:|---:|---:|---:|
| 1,000 | 6 | `true` | `380.2 ms` | `370.0 ms` | `16.9 ms` (-95.6%) | `1.7 ms` | `25` (vs `5`) |
| 2,500 | 14 | `true` | `925.4 ms` | `915.3 ms` | `16.9 ms` (-98.2%) | `1.2 ms` | `64` (vs `5`) |
| 4,000 | 24 | `true` | `1,441.2 ms` | `1,431.1 ms` | `17.5 ms` (-98.8%) | `1.4 ms` | `87` (vs `5`) |

- **Live Chromium Web Worker cancellation check (2,500 bars):** `executor.cancel()` terminated the active worker and resolved `{ cancelled: true, results: [] }` in `0.1 ms` (`totalBeforeCancelMs: 26.8 ms`).
- **Disposable scratch cleanup:** Temporary Chrome benchmark workspace (`chip01perf_96fdd45b326646cc811692a56761b337`) was removed cleanly via `scripts/Invoke-EOD-TmpLifecycle.ps1 -Action Cleanup -RetentionDays 0 -ConfirmExactWorkspace` (`STATUS: TMP01_EXACT_MARKED_WORKSPACE_REMOVED`).

---

## 6. Risks & Remaining Windows Portable Acceptance

- **Risks / limitations:**
  - Headless Chrome responsiveness measurements used deterministic synthetic OHLCV bars in Vite dev mode rather than a native Tauri WebView2 portable binary against a live `.eod` database.
  - `ToolbarChartPatternChipCHIP01.test.tsx` exercises the real `Toolbar` component and hooks under a Node React hook-slot harness with mocked `workerClient` deferred promises rather than a full DOM/WebView2 mount.
- **Remaining manual Windows portable acceptance (User-owned):**
  1. Rebuild the Windows portable package (`npm.cmd run tauri:portable:win` or your standard portable rebuild workflow).
  2. Open a multi-thousand-bar Indian equity chart (e.g., 3,000+ daily bars) and click **Chart Patterns**: verify the chip shows `Scanning...`, pan/zoom/crosshair/UI remain fluid at ~60fps without multi-second freeze, and the matched pattern overlay matches pre-change behavior.
  3. While patterns are active, click `⚙`, change pattern selections, and click **Scan Active Chart**: verify it re-scans and updates overlays instead of toggling off.
  4. Click **Chart Patterns**, immediately switch symbols or timeframes (`D` ↔ `W`) mid-scan: verify `Scanning...` clears, the new chart remains responsive, and no stale overlay from the prior symbol appears.
  5. Toggle **Chart Patterns** OFF and verify overlays/markers clear cleanly; open **Scanner** window and verify existing batch scanning behaves unchanged.
