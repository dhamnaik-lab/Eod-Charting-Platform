# Indicator Cache Isolation and Invalidation V1

**IST timestamp:** 2026-08-10 13:36 IST (+05:30)

## Objective

Correct the intermittent chart-indicator corruption where an SMA could initially render at a value from the wrong price scale (observed on `BSE:TATASTEEL` Daily with SMA(20) around 3,194.5), compress the candles through autoscale, and then become correct after Daily → Weekly → Daily or an application restart.

The change is intentionally limited to the renderer indicator-cache seam and regression coverage. No SMA mathematics, chart autoscale mathematics, Bhavcopy code, database code, corporate-action code, drawing code, or new indicator catalog entries are changed.

## Previous defect / limitation

`src/engine/Indicators.ts` used one process-global `Map<string, RenderableOverlay | RenderablePane>` for all instruments and chart tabs. Its data component was only:

```text
bars.length + latest bar timestamp
```

The cache key did not contain instrument/exchange identity or a unique identity for the actual bar series. Different instruments with the same number of EOD bars and same latest timestamp could therefore reuse the same cached indicator renderable when the indicator ID/settings also matched.

This was especially unsafe because duplicated/persisted chart state can retain stable indicator instance IDs. A stale high-priced instrument SMA could therefore be returned while a lower-priced instrument such as TATASTEEL was active. `ChartEngine.ts` correctly includes overlay values in price autoscale, so the stale indicator then stretched the price scale and visually crushed the candles.

The old settings signature was also a manually maintained partial list. Calculation-affecting fields such as Bollinger `stdDev`, PSAR `step`/`max`, ZigZag `deviation`, Ichimoku periods, StochRSI periods, KST parameters, and future newly added fields were not guaranteed to invalidate cached output.

A chained indicator had an additional stale-data path: changing the upstream indicator settings did not necessarily change the downstream study's cache key.

## Files changed

### Source

- `src/engine/Indicators.ts`

### Tests

- `src/engine/__tests__/IndicatorsCache.test.ts` — new

### Canonical documentation

- `HANDOFF.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `docs/changes/2026-08-10_1336_IST_INDICATOR_CACHE_ISOLATION_AND_INVALIDATION_V1.md` — this report

## Final implementation

### 1. Cache isolation by actual bar-array identity

The global string-keyed cache was replaced by:

```ts
WeakMap<OHLCBar[], IndicatorCacheBucket>
```

Each distinct chart/display bar array receives its own cache bucket. A different instrument/timeframe/chart transformation that produces a different bar array can no longer hit another array's indicator renderables merely because its bar count and latest timestamp happen to match.

A `WeakMap` was selected rather than adding symbol/exchange parameters throughout the indicator engine because the active chart architecture already treats `displayBars` as the renderer data identity and replaces bar arrays when instrument/timeframe/chart transformation changes. It also avoids retaining obsolete bar arrays solely because of the indicator cache.

### 2. Cheap same-array mutation guard

Each bucket tracks a lightweight data signature containing:

- bar count;
- first bar date/timestamp/OHLCV;
- latest bar date/timestamp/OHLCV.

If a caller reuses the same array reference but modifies the normal endpoints/latest bar, the bucket is discarded and rebuilt.

This is a defensive guard; normal chart state paths already replace bar arrays rather than mutating them in place.

### 3. Complete indicator-settings signature

The manually maintained field whitelist was replaced with deterministic stable serialization of the complete `OverlayIndicator` contract. Object keys are sorted recursively.

Consequences:

- all current calculation parameters participate automatically;
- presentation/plot changes cannot return a renderable containing stale presentation state;
- newly added indicator fields are cache-safe without remembering to extend a separate whitelist.

### 4. Upstream/chained-study invalidation

Each cache bucket also stores the complete ordered indicator-set signature. Any change to an upstream source study invalidates the bucket, so a downstream study using `sourceIndicatorId` is recomputed from the new source output.

### 5. Regression coverage

`IndicatorsCache.test.ts` adds four focused scenarios:

1. two different price arrays with equal bar count/latest timestamp and the same SMA instance ID cannot share SMA output;
2. changing Bollinger `stdDev` invalidates the cached calculation;
3. changing an upstream RSI period invalidates a chained SMA;
4. changing the latest bar on the same array invalidates the cache.

## Behaviour deliberately preserved

- SMA calculation still uses `technicalindicators.SMA.calculate` unchanged.
- Existing EMA/WMA/RSI/MACD and other indicator calculation formulas are untouched.
- Overlay/pane placement is unchanged.
- Indicator source chaining remains supported.
- Chart autoscaling remains unchanged; valid indicator values continue to participate in the price scale.
- Existing timeframe/chart transformation logic remains unchanged.
- No new indicator-timeframe/MTF behavior is introduced in this correction.
- No Bhavcopy, database, corporate-action, scanner, plugin, or drawing behavior is changed.

## Validation commands and actual results

### A. Uploaded snapshot identity

```text
sha256sum b32ef097-fb48-4111-b274-4c8e557c4ad3.zip
```

**PASS**

```text
f4ed6a888ca502ca550ba39a7cff773a6b931b166cd6f1850316977acffd66f5
```

### B. TypeScript syntax parse of changed source/test

Used the installed TypeScript compiler API to parse:

- `src/engine/Indicators.ts`
- `src/engine/__tests__/IndicatorsCache.test.ts`

**PASS** — zero parse diagnostics for both files.

### C. Deterministic cache-identity harness

A standalone harness exercised the old collision condition and the new cache invariants.

**PASS**

```text
old_cross_series_key_collision= true
new_weakmap_bucket_isolation= true
complete_settings_distinguish_stddev= true
ordered_set_distinguishes_upstream_change= true
tail_mutation_invalidates_signature= true
HARNESS_RESULT= PASS
```

The first line intentionally proves the defect condition in the old key design; the remaining lines prove the invariants used by the replacement design.

### D. Dependency installation attempt

```text
npm ci --ignore-scripts
```

**INCOMPLETE / ENVIRONMENT BLOCKED**

The OpenAI execution environment's internal npm mirror returned HTTP 404 for `zustand-4.5.7.tgz`. Dependencies therefore could not be restored in this extracted source snapshot.

### E. Focused Vitest command

```text
npm test -- --run src/engine/__tests__/IndicatorsCache.test.ts src/engine/__tests__/IndicatorsChaining.test.ts
```

**INCOMPLETE / DEPENDENCIES ABSENT**

```text
sh: 1: vitest: not found
```

No test-pass claim is made.

### F. Renderer typecheck

```text
npm run typecheck:renderer
```

**INCOMPLETE / DEPENDENCIES ABSENT**

The command started through the globally available `tsc`, but project dependencies/types such as React were absent after the failed `npm ci`. The resulting missing-module/JSX diagnostics are environment/dependency failures and do not constitute a valid project typecheck result.

No typecheck-pass claim is made.

### G. Renderer build

```text
npm run build:renderer
```

**INCOMPLETE / DEPENDENCIES ABSENT**

```text
sh: 1: vite: not found
```

No build-pass claim is made.

### H. Pre-edit backup

`AGENTS.md` requests `scripts/create-project-backup.ps1`. The extracted Linux execution environment has neither `pwsh` nor Windows PowerShell, so that script could not be executed here. Before editing, exact copies of the touched source/test baseline were instead retained outside the source snapshot at `/mnt/data/eod_chart_sma_fix_20260810_preedit_backup` with SHA-256 hashes recorded during the session.

This does not replace the normal Windows project backup requirement when applying the change to `E:\TA Projects\EOD Charting Platform`.

## Risks / limitations

1. **Windows project validation remains mandatory.** Vitest, normal renderer typecheck, renderer build, and manual application reproduction have not yet been executed against an installed dependency tree.
2. The same-array mutation guard intentionally fingerprints only the first/latest bars plus length for speed. A hypothetical in-place edit confined strictly to an interior historical bar while preserving array identity and both endpoints would not be detected. Current chart-state paths examined for this audit construct replacement bar arrays for hydration/timeframe/chart-type changes, so this is not the observed defect path.
3. Stable serialization adds a small cost proportional to the number/size of indicator configurations on each bundle build. It avoids an O(number-of-bars) data hash and should be materially cheaper than recalculating indicators; runtime profiling has not yet been performed.
4. The existing indicator-specific higher-timeframe setting/`aggregateBarsToHTF` wiring was not changed in this fix. It remains a separate indicator audit item if runtime behavior shows that setting is incomplete.

## Manual acceptance required on Windows

After applying the files to the active project and restoring normal dependencies:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"
npm test -- --run src/engine/__tests__/IndicatorsCache.test.ts src/engine/__tests__/IndicatorsChaining.test.ts
npm run typecheck:renderer
npm run build:renderer
```

Then launch the application and verify at minimum:

- `BSE:TATASTEEL`, Daily, SMA(20) loads correctly on first display;
- switch Daily → Weekly → Daily and confirm no scale/value corruption;
- change between TATASTEEL and a materially higher-priced symbol in the same tab;
- switch between/duplicate chart tabs with SMA enabled;
- restart the application and confirm behavior is unchanged;
- confirm the SMA value remains in the expected price magnitude and candles are not compressed by a stale overlay.

## Rollback guidance

To rollback only this change:

1. restore the pre-change `src/engine/Indicators.ts`;
2. remove `src/engine/__tests__/IndicatorsCache.test.ts`;
3. revert the indicator-cache wording in `HANDOFF.md`, `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`, and `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`;
4. retain this report as historical evidence or mark it superseded rather than silently deleting audit history.

Do not rollback or modify the accepted Bhavcopy subsystem as part of this change.
