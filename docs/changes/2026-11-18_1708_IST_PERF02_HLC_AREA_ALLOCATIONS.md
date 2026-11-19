# PERF-02 — Eliminate Full-History Allocations in HLC Area Rendering

**Timestamp:** 2026-11-18 17:08 IST (`UTC+05:30`)  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Task ID:** `PERF-02`  
**Status:** Source and tests implemented; user-provided focused/regression outputs PASS and subsequent portable smoke user-reported PASS (19 Nov 2026 documentation update).

---

## 1. Objective

Eliminate unnecessary full-history array allocations (`bars.map()`) in `drawHLCArea()` (`src/engine/Renderer.ts`) so HLC Area rendering reads only visible bar indices `[start, end]` while preserving chart appearance, absolute bar-index coordinate mapping, canvas state, path geometry, stroke widths, colors, and shared `drawLine()` behavior.

---

## 2. Previous Bottleneck

In `src/engine/Renderer.ts`, `drawHLCArea()` computed the clamped visible index range (`start`, `end`), drew the shaded High–Low polygon over `[start, end]`, and then called:

- `drawLine(ctx, bars.map((b) => b.high), viewport, scaleX, scaleY, 'rgba(79, 167, 255, 0.3)', 1)`
- `drawLine(ctx, bars.map((b) => b.low), viewport, scaleX, scaleY, 'rgba(79, 167, 255, 0.3)', 1)`
- `drawLine(ctx, bars.map((b) => b.close), viewport, scaleX, scaleY, '#5dafff', 1.8)`

Even though `drawLine()` only reads `values[start..end]`, each `drawHLCArea()` redraw allocated three full-length arrays spanning the entire `bars` history (`O(bars.length)` allocations and GC pressure per redraw).

---

## 3. Source Authority & Inspected Files

- **Authorized root:** `E:\TA Projects\EOD Charting Platform`
- **Files inspected before editing:**
  1. `AGENTS.md`
  2. `HANDOFF.md`
  3. `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
  4. `FILE_INVENTORY.md`
  5. `package.json`
  6. `tsconfig.json`
  7. `vitest.config.ts`
  8. `src/engine/Renderer.ts` (`drawLine`, `drawHLCArea`, `getLineDash`)
  9. `src/engine/ChartEngine.ts` (HLC Area caller at line 1325)
  10. `src/engine/types.ts` (`OHLCBar`)
  11. `src/engine/__tests__/drawingHitTestCandidatesPERF01.test.ts`
  12. `src/engine/__tests__/ScaleManager.test.ts`
  13. `src/engine/__tests__/TextBoxBounds.test.ts`
  14. `src/engine/__tests__/ChartLayerPartition.test.ts`
  15. `src/engine/__tests__/ScannerLabelLayout.test.ts`
  16. `docs/changes/2026-11-18_1556_IST_PERF01_DRAWING_HITTEST_CANDIDATE_INDEX.md`
  17. `scripts/create-project-backup.ps1`
  18. `scripts/check-doc-references.ps1`

---

## 4. Backup & SHA-256 Evidence

- **Pre-edit backup directory:** `backups/pre_opencode_changes_20261118_170757_perf02-hlc-area-allocations`
- **Backup manifest:** `backups/pre_opencode_changes_20261118_170757_perf02-hlc-area-allocations/backup-manifest.json` (`fileCount: 3`, `totalBytes: 341663`)

| File | Before SHA-256 | After SHA-256 |
|---|---|---|
| `src/engine/Renderer.ts` | `8A9A38DD3ADE77596B62E9757A132BF297E8593B2C22C1C167A3B3314D29F591` | `F1A92532FCF10570EE171725ED69745BB4DBEF53FC69158E7F4D9B54A3BC030C` |
| `src/engine/__tests__/drawHLCAreaPERF02.test.ts` | *(new file)* | `F7E445ED99E4C5C870F9BD500A660FC56B7C373ABD78CD1B0B9ECD2C7CBAAD85` |
| `HANDOFF.md` | `C3BF3F825230AB43FB5A7BA0C570C78E32CFF02E1F32CD83BD601EF9B327C704` | `816E131BB07E88084C7CC8E917C5C18B44CA32583575B86190E5E5255C5A8798` |
| `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` | `3FF541DF2C17D92C260C3499E83B58BB172C2A87461C9686C03CC1B00EFB9305` | `80A18082678A569AF5BE3919F3068BEAAD8088193659C12A2A9851B922AD9BD4` |
| `src/engine/ChartEngine.ts` | *(unmodified)* | *(unmodified)* |

---

## 5. Implementation Summary (Changed vs. Preserved Behavior)

### Changed
- Added a private helper `drawVisibleHLCSeriesLine()` in `src/engine/Renderer.ts` immediately above `drawHLCArea()` that reads `bars[index][field]` directly for `index` in `[start, end]` (`'high'`, `'low'`, or `'close'`).
- Updated `drawHLCArea()` (`src/engine/Renderer.ts`) to call `drawVisibleHLCSeriesLine()` for High, Low, and Close instead of allocating three full-history `bars.map(...)` arrays and invoking `drawLine()`.
- Added focused regression suite `src/engine/__tests__/drawHLCAreaPERF02.test.ts` verifying:
  - 100% canvas-operation parity (property sets and method calls in exact order) against the legacy `bars.map(...)` + `drawLine(...)` flow across:
    - Long histories (`5,000` bars, interior and tail viewports)
    - Narrow and fractional viewports (fractional multi-bar, sub-bar fractional, single-bar, inverted fractional)
    - Empty data (`bars = []`), boundary bars (`0` and `bars.length - 1`), wide clamped spans, and completely off-data viewports
    - Null-value close gaps within the visible window
  - Deterministic zero full-history projection (`bars.map` spy called `0` times) and zero off-viewport bar reads on a `10,000`-bar array (`visibleStart = 9900`, `visibleEnd = 9999`), reading only visible indices (`200` `high`, `200` `low`, `100` `close`).

### Preserved
- `drawLine()` in `src/engine/Renderer.ts` and its caller in `src/engine/ChartEngine.ts` are untouched.
- Exact `start`/`end` clamping (`Math.max(Math.floor(viewport.startIndex), 0)` and `Math.min(Math.ceil(viewport.endIndex), bars.length - 1)`), early return (`start > end || bars.length === 0`), absolute bar-index coordinate transforms (`scaleX.toPixel(index)` / `scaleY.toPixel(value)`), shaded High–Low fill (`'rgba(79, 167, 255, 0.08)'`), stroke colors (`'rgba(79, 167, 255, 0.3)'` and `'#5dafff'`), stroke widths (`1`, `1`, `1.8`), solid line dash (`[]`), `ctx.save()`/`ctx.restore()` stack balance, and null-value segment splitting remain identical.

---

## 6. Validation Commands (PENDING User Execution)

Per task constraints, no tests, typechecks, builds, or Git commands were executed by the agent. Run the following PowerShell commands serially from `E:\TA Projects\EOD Charting Platform`:

1. **Focused PERF-02 Vitest suite:**
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; & '.\node_modules\.bin\vitest.cmd' run src/engine/__tests__/drawHLCAreaPERF02.test.ts
   ```
2. **Relevant engine & renderer regression suites:**
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; & '.\node_modules\.bin\vitest.cmd' run src/engine/__tests__/ScaleManager.test.ts src/engine/__tests__/TextBoxBounds.test.ts src/engine/__tests__/ChartLayerPartition.test.ts src/engine/__tests__/ScannerLabelLayout.test.ts src/engine/__tests__/auditFrameScheduling.test.ts src/engine/__tests__/drawingHitTestCandidatesPERF01.test.ts
   ```
3. **Renderer TypeScript typecheck:**
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; npm.cmd run typecheck:renderer
   ```
4. **Renderer Vite production build:**
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; npm.cmd run build:renderer
   ```
5. **Documentation reference check:**
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\check-doc-references.ps1'
   ```

---

## 7. Risks, Limitations & Rollback

- **Risks & limitations:**
  - Automated Vitest, `typecheck:renderer`, `build:renderer`, and `check-doc-references.ps1` verification remain PENDING until executed by the user.
  - Other chart types in `src/engine/ChartEngine.ts` (`line`, `area`, `baseline`) still use `renderBars.map((b) => b.close)` and were intentionally left untouched outside PERF-02 scope.
  - `drawHLCArea()` reads `bars[i].high` and `bars[i].low` in the shaded High–Low pass directly via `scaleY.toPixel(...)` without null-skipping, preserving pre-existing behavior identically.
- **Rollback instructions (requires user approval before restoring from backup):**
  - Restore `src/engine/Renderer.ts`, `HANDOFF.md`, and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` from `backups/pre_opencode_changes_20261118_170757_perf02-hlc-area-allocations` and remove `src/engine/__tests__/drawHLCAreaPERF02.test.ts` and `docs/changes/2026-11-18_1708_IST_PERF02_HLC_AREA_ALLOCATIONS.md`.

---

## 8. Next Steps (After User-Executed Validation)

1. Execute the five validation commands in Section 6 and inspect outputs.
2. Run the user-owned Windows Tauri portable rebuild and smoke test on an HLC Area chart (long history, pan/zoom, narrow/fractional viewports, boundary bars).

## 9. Post-validation acceptance update — 19 November 2026 IST

- User-provided PowerShell outputs: `drawHLCAreaPERF02.test.ts` **5/5 PASS**; engine/chart regressions **26/26 PASS**; `typecheck:renderer`, `build:renderer`, and documentation references **PASS**.
- User previously reported portable Windows build/smoke **PASS**. This supersedes the original pending commands in Sections 6–8 without rewriting their historical execution instructions.
- No commands were rerun and no executable hash or live checkout was independently verified during DOCSYNC-01.
