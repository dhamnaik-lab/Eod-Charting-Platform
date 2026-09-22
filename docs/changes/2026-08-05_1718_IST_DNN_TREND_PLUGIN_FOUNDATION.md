# DNN Trend Prediction Plugin Foundation

## IST timestamp

2026-08-05 17:18:12 +05:30

## Objective

Create a safe, disabled-by-default plugin foundation for future deep-neural-network trend prediction while preserving the current EOD Charting Platform charting, scanner, database, workspace, and packaging behavior.

## Previous limitation

The active source already contained a bundled renderer-side plugin registry and persisted plugin enablement, but:

- every unconfigured plugin was treated as enabled by default;
- only the Core EOD Scanner plugin was registered;
- no forecast-specific request/result contract existed;
- no replaceable inference-provider boundary existed;
- no versioned causal feature contract, prediction validation, cache identity, cancellation, or disposal boundary existed;
- a future DNN implementation would otherwise risk being coupled directly to chart components or internal stores.

## Source and backup basis

- Source snapshot: `Eod Charting Platform Source Code 2026-08-05_164546_IST.zip`
- Expected live project root: `E:\TA Projects\EOD Charting Platform`
- Pre-edit backup: `docs\changes\backups\2026-08-05_1712_IST_DNN_TREND_PLUGIN_FOUNDATION\`
- The original uploaded ZIP was not modified and remains the immutable pre-edit source snapshot.

## Files modified

- `src/plugins/types.ts`
- `src/plugins/registry.ts`
- `src/plugins/scanner/scannerPlugin.ts`
- `src/plugins/__tests__/pluginRegistry.test.ts`
- `src/components/SettingsDialog.tsx`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`

## Files created

- `src/plugins/forecast/dnnTrend/types.ts`
- `src/plugins/forecast/dnnTrend/featureBuilder.ts`
- `src/plugins/forecast/dnnTrend/inferenceProvider.ts`
- `src/plugins/forecast/dnnTrend/predictionValidation.ts`
- `src/plugins/forecast/dnnTrend/mockInferenceProvider.ts`
- `src/plugins/forecast/dnnTrend/predictionCache.ts`
- `src/plugins/forecast/dnnTrend/predictionService.ts`
- `src/plugins/forecast/dnnTrend/dnnTrendPlugin.ts`
- `src/plugins/forecast/dnnTrend/index.ts`
- `src/plugins/forecast/dnnTrend/__tests__/featureBuilder.test.ts`
- `src/plugins/forecast/dnnTrend/__tests__/predictionService.test.ts`
- `docs/changes/2026-08-05_1718_IST_DNN_TREND_PLUGIN_FOUNDATION.md`
- `docs/changes/backups/2026-08-05_1712_IST_DNN_TREND_PLUGIN_FOUNDATION/` and its preserved pre-edit files

## Final implementation

### Existing plugin registry extended, not replaced

`RegisteredPlugin` now has an explicit `defaultEnabled` field.

- Core EOD Scanner: `defaultEnabled: true`
- DNN Trend Prediction Foundation: `defaultEnabled: false`
- Explicit persisted overrides still take precedence.
- The historical fallback for unknown plugin IDs remains enabled to avoid changing unrelated behavior.

### DNN plugin registration

The new plugin is registered as:

- ID: `dnn-trend-prediction`
- Type: `forecast`
- Status: `planned`
- Default: disabled
- External loading: unsupported, matching the current bundled-only plugin model

Settings displays the foundation, but planned/non-bundled plugins have a disabled checkbox. The user cannot accidentally activate a foundation that has no production model or chart adapter.

### Versioned causal feature contract

`featureBuilder.ts` creates a completed-daily-bar feature window containing:

- log return;
- opening gap return;
- high-low range relative to previous close;
- candle body relative to previous close;
- upper and lower wick ratios;
- close location inside the candle range;
- volume relative to the preceding trailing-20 average.

The builder:

- accepts only unique, strictly chronological ISO-dated bars;
- rejects non-finite, non-positive, or impossible OHLC geometry;
- requires an explicit bounded lookback;
- does not sort or silently repair input;
- identifies the contract as `dnn-trend-features-v1`.

These are foundation features only. They are not represented as a validated or profitable forecasting model.

### Replaceable inference provider

`DnnTrendInferenceProvider` separates the charting application from the eventual inference runtime. A future provider can be local, remote, or model-file based without changing the prediction service contract.

The bundled deterministic mock provider:

- is explicitly `kind: mock`;
- is explicitly `productionReady: false`;
- returns deterministic 5/10/20-session probability outputs;
- uses no random state;
- exists only for contract, cache, lifecycle, and UI-integration testing.

### Prediction service

`DnnTrendPredictionService` provides:

- lazy provider initialization;
- supported-horizon normalization;
- feature construction;
- strict probability validation;
- bullish/sideways/bearish class selection;
- cancellation handling;
- fail-closed `insufficient-data`, `failed`, and `cancelled` states;
- provider disposal;
- cache clearing.

### Revision-aware cache

The memory cache key includes:

- symbol;
- exchange;
- timeframe;
- database revision;
- as-of date;
- requested horizons;
- lookback length;
- feature version;
- provider ID;
- provider version.

A prediction cannot be reused after a database revision, model version, feature version, horizon, or lookback change.

## Behavior deliberately preserved

- No DNN service is instantiated during application startup.
- No prediction runs when a chart opens or a symbol changes.
- No chart overlay or dock panel was added.
- No Rust/Tauri command or database schema was changed.
- No scanner definition or scanner execution behavior was changed.
- The Core EOD Scanner remains enabled by default.
- Existing plugin setting persistence remains in use.
- No model training, model file, external process, network API, broker route, alert route, or order execution was introduced.
- No build output, dependency directory, target directory, or generated executable was placed under `src` or `src-tauri-shell`.

## Validation commands and actual results

### Dependency installation

Command:

```text
npm ci --ignore-scripts
```

Result: **INCOMPLETE / ENVIRONMENT FAILURE**

The execution environment's internal npm mirror returned HTTP 404 for `zustand-4.5.7.tgz`. No `node_modules` directory was produced. Therefore the repository's actual Vitest package and full renderer dependency graph were unavailable locally.

### Focused production TypeScript compile

Command: global TypeScript 5.8.3 with a temporary strict ES2022/bundler configuration covering all new production DNN files and `src/plugins/types.ts`.

Result: **PASS**

### Focused test-file TypeScript compile

Command: global TypeScript 5.8.3 with a temporary minimal `vitest` declaration, covering:

- `featureBuilder.test.ts`
- `predictionService.test.ts`

Result: **PASS**

This confirms TypeScript syntax and local type compatibility of the test files, but it is not a substitute for running Vitest itself.

### Deterministic compiled runtime harness

Covered:

- 60-bar causal feature generation;
- as-of date and feature dimensions;
- mock provider initialization and inference;
- 5/10/20 horizon results;
- probability sums equal to 1;
- cached repeat request reuse;
- pre-aborted request cancellation;
- provider disposal and post-disposal failure.

Result: **PASS**

Output:

```text
DNN trend runtime checks: PASS
```

### Changed-TypeScript whitespace audit

Result: **PASS**

### Not run in this environment

- Actual focused Vitest execution
- Full renderer TypeScript typecheck
- Renderer production build
- Rust/Tauri check
- Integrated build
- Tauri desktop build
- Portable Windows packaging
- Rebuilt-application manual UI verification

No claim is made that these passed.

## Required PowerShell validation

Run from:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"
```

Focused validation first:

```powershell
npm run typecheck:renderer
npx vitest run `
  src/plugins/__tests__/pluginRegistry.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/featureBuilder.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/predictionService.test.ts
```

Then broader validation:

```powershell
npm test
npm run build:renderer
npm run tauri:check
npm run build
```

Release validation only after the above succeeds:

```powershell
npm run tauri:portable:win
```

Manual UI check:

1. Open Settings.
2. Open Plugins.
3. Confirm `Core EOD Scanner` remains checked and usable.
4. Confirm `DNN Trend Prediction Foundation` is visible, marked `forecast · v0.1.0 · planned`, unchecked, and disabled.
5. Confirm charts, Market Movers, Scanner, database loading, and symbol navigation behave as before.

## Risks and possible regressions

1. **Full dependency-backed typecheck and Vitest are pending.** The isolated checks passed, but only the user's PowerShell run can confirm compatibility with the exact installed dependency graph.
2. **Settings behavior for all non-bundled plugin statuses changed intentionally.** Their checkboxes are disabled. Currently this affects the new planned DNN foundation; future planned/disabled/error plugins will also be non-toggleable until marked bundled.
3. **Mock output is not a trading forecast.** It must not be exposed as a production signal. The output contract includes `productionReady: false`, and the plugin remains planned/disabled.
4. **Feature parity is not yet frozen against a training repository.** Before a real model is integrated, golden fixtures must prove that training and application feature calculations are identical.
5. **In-memory cache is process-local.** Durable prediction history, database invalidation events, and chart lifecycle wiring remain future work.
6. **No UI or backend performance evidence exists.** The service is headless and inactive, so model-runtime latency and chart responsiveness have not been assessed.

## Rollback guidance

To roll back this change:

1. Restore the modified files from:

```text
docs\changes\backups\2026-08-05_1712_IST_DNN_TREND_PLUGIN_FOUNDATION\
```

2. Delete:

```text
src\plugins\forecast\dnnTrend\
```

3. Delete this report.
4. Rerun the focused plugin registry test and renderer typecheck.

The original uploaded source ZIP is also a complete immutable rollback source.

## Recommended next step

After PowerShell validation passes, keep this foundation inactive and build an external research pipeline that produces a versioned model package plus golden feature fixtures. Only then add a local inference provider and optional chart UI adapter behind the existing service contract.
