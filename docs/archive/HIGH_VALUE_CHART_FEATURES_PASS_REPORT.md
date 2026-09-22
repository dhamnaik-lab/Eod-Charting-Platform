# High-Value Chart Features Pass Report

Date: 2026-04-07

## Overview

Four high-value chart features added in a single behavior-preserving pass:

1. **Supertrend overlay indicator** — ATR-based trend direction with two-color rendering
2. **Log scale toggle** — compact Toolbar button; safe `buildScaleY` log-math branch
3. **Source input selector** — optional per-indicator source for 11 indicators
4. **Volume toggle** — compact Toolbar button to show/hide the volume bar area

All existing indicator pane controls (gear/close buttons, pane resize) are fully preserved.
All 54 unit tests pass. All validation commands pass.

---

## Files Backed Up

`backups/pre_opencode_changes_20260408_003950_high_value_chart_features/` — already created in the prior half of this pass:

- `src/engine/types.ts`
- `src/engine/ScaleManager.ts`
- `src/engine/Indicators.ts`
- `src/engine/ChartEngine.ts`
- `src/indicators/catalog.ts`
- `src/store/chartStore.ts`
- `src/features/workspace/workspacePersistence.ts`
- `src/components/ChartCanvas.tsx`
- `src/components/Toolbar.tsx`
- `src/components/IndicatorSettingsDialog.tsx`

---

## Files Modified

### `src/engine/types.ts`
- Added `export type IndicatorSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4'`
- Added `source?: IndicatorSource` to: SMA, EMA, WMA, WEMA, DEMA, TEMA, BOLL, RSI, MACD, ROC, MOM
- Added `SUPERTREND` to `ChartIndicator` union: `{ id: string; kind: 'SUPERTREND'; placement: 'overlay'; period: number; multiplier: number; upColor: string; downColor: string }`

### `src/engine/ScaleManager.ts`
- Added `logScale = false` parameter to `buildScaleY`
- When `logScale && paddedMin > 0`: returns log-math `toPixel`/`toPrice` functions using `Math.log`/`Math.exp`
- Linear path unchanged — all existing callers unaffected (9th arg defaults to `false`)

### `src/engine/Indicators.ts`
- Added `IndicatorSource` to type import
- Added `getSourceValues(bars, source?)` helper — returns appropriate array for each source; defaults to close
- Wired `getSourceValues` into: SMA, EMA, WMA, WEMA, DEMA, TEMA, BOLL, MACD, RSI, ROC, MOM
- Added `SUPERTREND` case in `buildRenderableIndicator`: calls `calculateSupertrend`, returns two `RenderableLineSeries` (one for uptrend, one for downtrend)
- Added `calculateSupertrend(bars, period, multiplier)` function:
  - Uses `ATR.calculate` from `technicalindicators` library
  - Computes final upper/lower bands with ratchet logic (upper only decreases, lower only increases)
  - Tracks trend direction; flips when close crosses active band
  - In uptrend: `supertrendUp[i] = lowerBands[i]` (green support line)
  - In downtrend: `supertrendDown[i] = upperBands[i]` (red resistance line)

### `src/engine/ChartEngine.ts`
- Removed `readonly` from `private readonly volumePct`
- Added `private logScale = false`
- Added `private showVolume = true`
- Added `setLogScale(enabled: boolean)` method
- Added `setShowVolume(show: boolean)` method
- `buildRenderState`: uses `effectiveVolumePct = this.showVolume ? this.volumePct : 0` for `computeChartLayout`
- `buildRenderState`: passes `undefined, this.logScale` to price pane `buildScaleY` call
- Indicator pane `buildScaleY` calls unchanged (no log scale for oscillators)

### `src/indicators/catalog.ts`
- Added `SUPERTREND` entry: `period: 10, multiplier: 3, upColor: '#22c55e', downColor: '#ef4444'`
- Added `SUPERTREND` case to `getIndicatorDisplayLabel`: `ST (period, multiplier)`

### `src/features/workspace/workspacePersistence.ts`
- `PersistedChartContent`: added `logScale?: boolean` and `showVolume?: boolean`
- `WorkspaceChartTabLike`: added `logScale?: boolean` and `showVolume?: boolean`
- `serializePersistedChartContent`: Pick type updated; `logScale` and `showVolume` serialized
- `sanitizePersistedChartContent`: restored with `logScale: value.logScale === true` and `showVolume: value.showVolume !== false` (safe defaults)

### `src/store/chartStore.ts`
- `ChartTabState`: added `logScale: boolean` and `showVolume: boolean`
- `createBlankChartTab`: defaults `logScale: false, showVolume: true`
- `createChartTabStateFromPersistedContent`: restores `logScale` and `showVolume` from persisted content
- `ChartStoreState`: added `setLogScale: (enabled: boolean) => void` and `setShowVolume: (show: boolean) => void`
- Implementations follow `setIndicatorPaneHeight` pattern (update active tab via `updateActiveTab`)

### `src/components/ChartCanvas.tsx`
- Added store reads: `logScale`, `showVolume` from active chart tab
- Added `useEffect(() => { engineRef.current?.setLogScale(logScale); }, [logScale])`
- Added `useEffect(() => { engineRef.current?.setShowVolume(showVolume); }, [showVolume])`
- Fixed `indicator.color` access in overlay label to be SUPERTREND-safe (uses `'color' in indicator` guard)

### `src/components/Toolbar.tsx`
- Added store reads: `logScale`, `showVolume`, `setLogScale`, `setShowVolume`
- Added **Log** toggle button (uses same `magnetButtonStyle` active state, toggles `logScale`)
- Added **Vol** toggle button (uses same `magnetButtonStyle` active state, toggles `showVolume`)
- Both buttons display active/inactive state via visual highlight (blue when active)

### `src/components/IndicatorSettingsDialog.tsx`
- Split source-aware period+color group from non-source group:
  - SMA, EMA, WMA, WEMA, DEMA, TEMA, RSI, ROC, MOM → Period + Source + Color
  - CCI, WILLR, ATR, MFI, CMF → Period + Color (no source — these use OHLC inputs, not price series)
- BOLL → Period + StdDev + Source + Color
- MACD → Fast/Slow/Signal + Source + MACD/Signal/Histogram colors
- Added `SUPERTREND` case → Period + Multiplier (step 0.1) + Up Color + Down Color
- Added `SourceField` component with `SOURCE_OPTIONS` dropdown (close/open/high/low/hl2/hlc3/ohlc4)
- Added `selectFieldStyle` constant

---

## Design Decisions

### Supertrend rendering
Two separate `RenderableLineSeries` (one for uptrend bars, one for downtrend) rather than a single series with per-bar color. This reuses existing `drawLine` infrastructure without adding a new renderer type.

### Log scale scope
Log scale is applied only to the price pane `buildScaleY`. Indicator panes (RSI, MACD, etc.) always use linear scale, which is correct — oscillators and momentum indicators are not log-scaled.

### Log scale with paddedMin ≤ 0
The log branch is guarded by `logScale && paddedMin > 0`. Stocks priced near or below zero fall back to linear safely.

### Volume toggle default
`showVolume: true` — same behavior as before. Existing workspaces without the `showVolume` key deserialize to `true` (`value.showVolume !== false`).

### Source default
All 11 source-aware indicators default to `close` when `source` is undefined (the `getSourceValues` switch default). Existing stored workspaces without the `source` field continue to compute on close as before.

---

## Validation

| Step | Result |
| --- | --- |
| `npm run typecheck:renderer` | PASS |
| `npm run test` (54 tests) | PASS |
| `npm run tauri:check` | PASS |
| `npm run build` | PASS |
| `npm run tauri:portable:win` | PASS |

---

## What Was Preserved

- All existing indicator pane controls (gear/settings button, × remove button)
- Pane drag-resize behavior
- All existing indicator calculations unchanged (source defaults to close)
- MACD 4-color histogram momentum styling
- All 54 existing unit tests pass
- Tauri-only runtime structure preserved
- Portable Windows baseline preserved
