# PERF-01 — ChartEngine Drawing Hit-Test Candidate Pre-Index

**Timestamp:** 2026-11-18 15:56 IST (`UTC+05:30`)  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Task ID:** `PERF-01`  
**Status:** Automated verification PASS; subsequent user-reported Windows portable acceptance PASS (19 Nov 2026 documentation update).

---

## 1. Objective

Reduce unnecessary per-`mousemove` drawing scans in `ChartEngine.hitTestDrawing()` by pre-indexing static candidate eligibility per chart pane and active timeframe while preserving all existing exact geometry hit tests, reverse z-order priority, hover cursors, locked-drawing behavior, drawing drag/resize selection, timeframe visibility, cross-pane vertical lines (`vline`), and dynamic scanner-label exclusion (`scannerLabelBoxes`).

---

## 2. Previous Bottleneck

In `src/engine/ChartEngine.ts`, `hitTestDrawing(pointerState)` (invoked on pointer `mousemove` in cursor/crosshair mode, `mousedown`, `dblclick`, and `pickDrawingAt`) scanned the full `this.drawings` array from `this.drawings.length - 1` down to `0` on every pointer test, running static timeframe-visibility (`isDrawingVisibleOnTimeframe(drawing, this.timeframe)`) and pane-assignment (`getDrawingPaneId(drawing)`) checks on every drawing before filtering out drawings belonging to inactive panes or hidden timeframes.

---

## 3. Source Authority & Inspected Files

- **Authorized root:** `E:\TA Projects\EOD Charting Platform`
- **Files inspected before editing:**
  1. `AGENTS.md`
  2. `HANDOFF.md`
  3. `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
  4. `package.json`
  5. `src/engine/ChartEngine.ts`
  6. `src/engine/__tests__/ScannerLabelLayout.test.ts`
  7. `src/engine/__tests__/ChartLayerPartition.test.ts`
  8. `src/engine/__tests__/auditFrameScheduling.test.ts`
  9. `src/engine/DrawingStyleSchema.ts`
  10. `src/engine/UnifiedStyleContracts.ts`
  11. `src/engine/Indicators.ts`
  12. `src/engine/types.ts`
  13. `src/components/ChartCanvas.tsx`
  14. `scripts/create-project-backup.ps1`
  15. `scripts/check-doc-references.ps1`

---

## 4. Backup & SHA-256 Evidence

- **Pre-edit backup directory:** `backups/pre_opencode_changes_20261118_153611_perf01-drawing-hittest-candidate-index`
- **Backup manifest:** `backups/pre_opencode_changes_20261118_153611_perf01-drawing-hittest-candidate-index/backup-manifest.json` (`fileCount: 3`, `totalBytes: 361178`)

| File | Before SHA-256 | After SHA-256 |
|---|---|---|
| `src/engine/ChartEngine.ts` | `B39B59E569D32D4AA22436D64D6A59075CC7D414971D4C860FA2779AFDEBF9F4` | `2A9A3DCAF4F894AF386B88FEDDE307040F0F9851F5432D80E365136705674ACE` |
| `src/engine/__tests__/drawingHitTestCandidatesPERF01.test.ts` | *(new file)* | `221785169495D462BAC79E4356E1CC5BE9F2F65B36D5974ACECCD820FC9D04A5` |
| `src/engine/DrawingStyleSchema.ts` | `D3694BD44A4E3511A1F261634DF833E8C020A413246E3B9F040F899C5953DB2A` | *(unchanged)* |
| `src/engine/__tests__/ScannerLabelLayout.test.ts` | `9AF3B32EDCCABEA78BC373374EDEE115AC90403FC1F875CAF7363D1FD370328E` | *(unchanged)* |
| `src/engine/__tests__/ChartLayerPartition.test.ts` | `545B115A47EB33E3576B887F6362BA40B91013B9102B6B3745A0738C462C2894` | *(unchanged)* |

---

## 5. Implementation Summary (Changed vs. Preserved Behavior)

### Changed
- Added `DrawingHitTestCandidateIndex` per-engine cache on `ChartEngine` (`src/engine/ChartEngine.ts`) storing:
  - `drawingsRef`, `drawingsLength`, `firstDrawing`, `lastDrawing`, `timeframe`
  - `vlines`: timeframe-visible `vline` drawings in reverse z-order
  - `byPane`: `ReadonlyMap<ChartPaneId, readonly ChartDrawing[]>` mapping each pane with drawings to its reverse-z-order list of timeframe-visible pane drawings interleaved with any timeframe-visible `vline` drawings in exact original reverse z-order.
- Added `invalidateDrawingHitTestCandidateIndex()`, `getOrBuildDrawingHitTestCandidateIndex()`, and `getHitTestDrawingCandidates(pointerState)`.
- Invalidated the candidate index explicitly in `unmount()`, `loadBars()`, `setDrawings()`, `setTimeframe()`, `setChartType()`, and `renderBase()`, while also guarding `getOrBuildDrawingHitTestCandidateIndex()` by `drawingsRef`, `drawingsLength`, `firstDrawing`, `lastDrawing`, and `timeframe` identity so prototype-created test fixtures (`Object.create(ChartEngine.prototype)`), direct property assignments, and in-place endpoint/reverse mutations rebuild automatically.
- Updated `hitTestDrawing(pointerState)` to iterate `this.getHitTestDrawingCandidates(pointerState)` instead of rescanning all `this.drawings` for static pane/timeframe eligibility on every pointer event.

### Preserved
- Dynamic `this.scannerLabelBoxes.get(drawing.id) === null` check remains evaluated at hit time inside `hitTestDrawing()`.
- Dynamic `this.resolveDrawingForCurrentChart(drawing)` (Renko brick index resolution and transient `renderTextBox` binding) remains evaluated at hit time.
- Collapsed pane rule (`pointerState.pane.collapsed` returns `index.vlines`, allowing only `vline` hits in collapsed panes).
- Panes with zero pane-specific drawings fall back to `index.vlines` (`index.byPane.get(pointerState.pane.id) ?? index.vlines`), preserving `vline` hits in any pane.
- Every shape hit-test branch, 8px tolerance, anchor ordinal, text resize handle, hover cursor, locked selection vs. drag guard, and stored drawing order are 100% untouched.

---

## 6. Automated Validation & Results

All commands were executed serially from `E:\TA Projects\EOD Charting Platform`:

1. **Focused PERF-01 & engine scheduling/layer/scanner tests:**
   - Command: `npm.cmd test -- src/engine/__tests__/drawingHitTestCandidatesPERF01.test.ts src/engine/__tests__/ScannerLabelLayout.test.ts src/engine/__tests__/ChartLayerPartition.test.ts src/engine/__tests__/auditFrameScheduling.test.ts`
   - Exit code: `0` (**PASS** — 4 files, 15/15 tests passed)
2. **Additional drawing & chart geometry regression suites:**
   - Command: `npm.cmd test -- src/engine/__tests__/DrawingGeometry.test.ts src/engine/__tests__/DrawingAdvancedGeometry.test.ts src/engine/__tests__/DrawingMultiAnchorGeometry.test.ts src/engine/__tests__/DrawingD3BGeometry.test.ts src/engine/__tests__/DrawingD3CGeometry.test.ts src/engine/__tests__/DrawingF1BGeometry.test.ts src/engine/__tests__/DrawingF1CGeometry.test.ts src/engine/__tests__/DrawingF1DGeometry.test.ts src/engine/__tests__/DrawingF1EGeometry.test.ts src/engine/__tests__/DrawingStyleSchema.test.ts src/engine/__tests__/DrawingMagnet.test.ts src/engine/__tests__/TextBoxBounds.test.ts src/engine/__tests__/syncedCrosshair.test.ts`
   - Exit code: `0` (**PASS** — 13 files, 69/69 tests passed)
3. **Renderer TypeScript typecheck:**
   - Command: `npm.cmd run typecheck:renderer`
   - Exit code: `0` (**PASS**)
4. **Renderer Vite production build:**
   - Command: `npm.cmd run build:renderer`
   - Exit code: `0` (**PASS** — built in 6.67s)
5. **Documentation reference check:**
   - Command: `.\scripts\check-doc-references.ps1`
   - Exit code: `0` (**PASS**)

---

## 7. Benchmark Methodology & Measurements

- **Fixture & conditions:** Windows local checkout (`Vitest v4.1.11`, Node/V8 in `E:\TA Projects\EOD Charting Platform`), 140 OHLC bars, 4 active panes (`price`, `rsi-pane`, `macd-pane`, `atr-pane`), 10 mixed drawing shape types (`vline`, `hline`, `trendline`, `rect`, `channel`, `horizontalRay`, `triangle`, `fib`, `text`, `circle`), 240 deterministic pointer positions per pass, V8 JIT pre-warmup + 2 warmup passes + 7 timed iterations on isolated `ChartEngine` instances reporting median wall-clock time (`ms` per 240-pointer pass) and exact deterministic inspection counts. All 240 pointer positions per run verified 100% hit-target parity (`drawing`, `mode`, `anchorOrdinal`) and candidate-evaluation count parity against the legacy linear scan.

| Workload | Drawings (`N`) | Pointer Positions | Hits | Legacy Inspected Drawings | Pre-Indexed Inspected Candidates | Candidate Reduction | Legacy Median (`ms`) | Pre-Indexed Median (`ms`) | Speedup |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `multi-pane` (4 panes + 25% W/M-only) | 100 | 240 | 67 | 20,346 | 3,913 | -80.8% | 8.848 | 3.526 | 2.51× |
| `multi-pane` (4 panes + 25% W/M-only) | 500 | 240 | 126 | 74,870 | 12,575 | -83.2% | 19.149 | 12.020 | 1.59× |
| `multi-pane` (4 panes + 25% W/M-only) | 1,000 | 240 | 148 | 126,348 | 19,004 | -85.0% | 24.434 | 17.229 | 1.42× |
| `price-heavy` (90% price pane, D-visible) | 100 | 240 | 118 | 18,605 | 15,188 | -18.4% | 22.789 | 16.779 | 1.36× |
| `price-heavy` (90% price pane, D-visible) | 500 | 240 | 208 | 48,019 | 38,155 | -20.5% | 47.269 | 39.374 | 1.20× |
| `price-heavy` (90% price pane, D-visible) | 1,000 | 240 | 215 | 59,421 | 46,496 | -21.8% | 59.183 | 51.538 | 1.15× |

- **Price-pane-heavy note:** As expected, when 90% of drawings belong to the price pane and are visible on the active timeframe while 90% of pointer movements occur in the price pane, ~90% of drawings remain valid candidates for exact geometry evaluation. Consequently, candidate pre-indexing provides only a modest (`~1.15×–1.36×`, `-18.4%` to `-21.8%` candidate inspections) improvement in price-pane-heavy workloads while providing a substantial (`~1.42×–2.51×`, `-80.8%` to `-85.0%` candidate inspections) reduction in multi-pane / multi-timeframe charts.

---

## 8. Risks, Limitations & Rollback

- **Risks & limitations:**
  - Candidate pre-indexing filters only static pane and timeframe eligibility; charts with hundreds of visible drawings concentrated in a single pane remain bounded by per-shape geometry checks.
  - `renderBase()` and `getOrBuildDrawingHitTestCandidateIndex()` (`drawingsRef`, `drawingsLength`, `firstDrawing`, `lastDrawing`, `timeframe`) guard against stale caches across redraws and endpoint/reverse mutations; only an interior in-place mutation of `drawing.paneId` or `drawing.visibility` without calling `setDrawings()` or triggering a base render (`markDirty()`) would bypass invalidation.
- **Rollback instructions (requires user approval before restoring from backup):**
  - Copy `backups/pre_opencode_changes_20261118_153611_perf01-drawing-hittest-candidate-index/src/engine/ChartEngine.ts` back to `src/engine/ChartEngine.ts` and remove `src/engine/__tests__/drawingHitTestCandidatesPERF01.test.ts`.

---

## 9. Manual Native Acceptance Checkpoints (Pending User Portable Rebuild)

1. Rebuild the Windows portable executable when approved by the user (`MANUAL_PORTABLE_ACCEPTANCE=PENDING`).
2. Open a multi-tile chart with active indicator panes (`RSI`, `MACD`, `ATR`) and hover overlapping drawings in both price and indicator panes.
3. Verify locked vs. unlocked selection, drag/resize handles on text and multi-anchor drawings, and ray/Fibonacci/Gann hover hit accuracy.
4. Switch timeframes (`D` / `W` / `M`), switch `candles` ↔ `renko`, pan, zoom, and resize panes/window; verify no stale or missing drawing hits.
5. Enable scanner pattern overlays and verify suppressed/offscreen scanner labels cannot be hovered or selected.

## 10. Post-validation acceptance update — 19 November 2026 IST

- User previously reported successful portable build and smoke test after PERF-01. This supersedes the historical pending acceptance state in Section 9.
- Focused and regression validation values above remain unchanged. No new source test or Windows executable hash verification was performed during documentation synchronization.
- PERF-01 is accepted; no additional source work is authorized by this note.
