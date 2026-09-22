# Precomputed DNN Prediction Adapter V1

## IST timestamp

2026-08-05 19:18 +05:30

## Objective

Advance the existing disabled DNN forecast foundation into a safe, bundled, disabled-by-default precomputed prediction adapter. The adapter must accept externally generated trend probabilities without embedding model training or changing existing chart, scanner, database, workspace, broker, or packaging behavior.

## Source and backup basis

- Source snapshot: `Eod Charting Platform Source Code 2026-08-05_183831_IST.zip`
- Expected live project root: `E:\TA Projects\EOD Charting Platform`
- Pre-edit backup: `docs\changes\backups\2026-08-05_1909_IST_PRECOMPUTED_DNN_PREDICTION_ADAPTER_V1\`
- The uploaded source ZIP was not modified.

## Previous defect or limitation

The existing DNN foundation provided model-independent types, causal features, probability validation, a mock provider, caching, cancellation, and disposal, but it had no safe route to consume real externally generated predictions. Specifically:

- the plugin remained `planned` and could not be enabled;
- no versioned prediction-file contract existed;
- no generic plugin-data file picker/read boundary existed;
- plugin-specific configuration could not be persisted independently;
- there was no exact symbol/date/horizon viewer;
- stale, future, duplicate, malformed, oversized, wrong-revision, and wrong-feature prediction inputs had no integrated rejection path.

## Files modified

- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `HANDOFF.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `README.md`
- `src/components/SettingsDialog.tsx`
- `src/features/app/appSettingsService.ts`
- `src/platform/tauriDesktop.ts`
- `src/platform/types.ts`
- `src/plugins/__tests__/pluginRegistry.test.ts`
- `src/plugins/forecast/dnnTrend/dnnTrendPlugin.ts`
- `src/plugins/forecast/dnnTrend/index.ts`
- `src/types/desktop.ts`
- `src-tauri-shell/src/app_profile.rs`
- `src-tauri-shell/src/main.rs`

## Files created

### Production and resource files

- `src/plugins/forecast/dnnTrend/DnnTrendPredictionPanel.tsx`
- `src/plugins/forecast/dnnTrend/pluginConfiguration.ts`
- `src/plugins/forecast/dnnTrend/precomputedInferenceProvider.ts`
- `src/plugins/forecast/dnnTrend/precomputedPredictionFileService.ts`
- `src/plugins/forecast/dnnTrend/precomputedPredictionSource.ts`
- `src-tauri-shell/src/plugin_data.rs`
- `resources/dnn-trend/README.md`
- `resources/dnn-trend/dnn-trend-predictions-v1.schema.json`
- `resources/dnn-trend/sample-precomputed-predictions-v1.json`

### Tests

- `src/plugins/forecast/dnnTrend/__tests__/pluginConfiguration.test.ts`
- `src/plugins/forecast/dnnTrend/__tests__/precomputedPredictionSource.test.ts`

### Change evidence

- `docs/changes/2026-08-05_1803_IST_SYNCED_CROSSHAIR_TEST_EXPECTATION_FIX.md`
- `docs/changes/2026-08-05_1825_IST_DNN_TREND_PLUGIN_FINAL_VALIDATION.md`
- `docs/changes/2026-08-05_1918_IST_PRECOMPUTED_DNN_PREDICTION_ADAPTER_V1.md`
- `docs/changes/2026-08-05_1918_IST_PRECOMPUTED_DNN_PREDICTION_ADAPTER_V1_FILE_MANIFEST.txt`
- `docs/changes/2026-08-05_1918_IST_PRECOMPUTED_DNN_PREDICTION_ADAPTER_V1_VALIDATION.txt`
- `docs/changes/backups/2026-08-05_1909_IST_PRECOMPUTED_DNN_PREDICTION_ADAPTER_V1/`

## Final implementation

### 1. Versioned prediction source contract

The adapter accepts UTF-8 JSON with schema version:

```text
dnn-trend-predictions-v1
```

Each document requires:

- model ID, model version, feature version, generated timestamp, and explicit `productionReady` flag;
- one or more flat prediction records;
- NSE or BSE identity;
- `1D` timeframe;
- valid `YYYY-MM-DD` as-of date;
- non-empty data revision;
- horizon of 5, 10, or 20 sessions;
- bullish, sideways, and bearish probabilities between zero and one that sum to one.

The parser additionally:

- rejects unknown fields;
- rejects duplicate exact keys;
- normalizes symbol/exchange casing;
- validates calendar dates and timezone-bearing ISO timestamps;
- enforces a 250,000-record ceiling;
- builds exact-record and per-series date indexes.

A machine-readable JSON Schema and non-production sample are included under `resources\dnn-trend\`.

### 2. Causal exact-date lookup

The lookup key is:

```text
exchange + symbol + timeframe + asOfDate + horizonBars
```

Exact matches return the three probabilities, predicted class, and confidence. Missing exact dates fail closed. A stale diagnostic may reference only the latest earlier causal prediction; it never substitutes or recommends a future prediction. Data-revision mismatches return stale status.

### 3. Replaceable precomputed provider

`PrecomputedDnnTrendInferenceProvider` implements the existing `DnnTrendInferenceProvider` contract. It:

- exposes source model/version/readiness metadata;
- enforces feature-version parity;
- enforces data-revision parity;
- serves only requested exact horizons;
- preserves cancellation and disposal behavior;
- throws on missing/stale inputs so `DnnTrendPredictionService` returns a fail-closed result.

The deterministic mock provider and foundation service remain available for contract tests. No existing provider contract was removed.

### 4. Generic persisted plugin configuration

App-profile settings now include:

```text
pluginConfigurations: Record<string, unknown>
```

The Rust profile file stores this as a `BTreeMap<String, serde_json::Value>` with backward-compatible serde defaults. Existing profile files lacking the field continue to load. The DNN adapter currently stores only `predictionSourcePath`; unrelated plugin configuration entries are preserved.

### 5. Generic bounded plugin-data file service

`src-tauri-shell/src/plugin_data.rs` adds two generic commands:

- `pick_plugin_data_file`
- `read_plugin_text_file`

The read command:

- canonicalizes the selected path;
- requires a regular file;
- validates a caller-supplied alphanumeric extension allow-list;
- applies a caller limit bounded by a hard 32 MiB ceiling;
- rechecks actual bytes after reading to guard against file growth;
- requires valid UTF-8;
- returns the canonical path, actual byte length, and text.

The DNN adapter accepts JSON only and applies a 16 MiB limit.

### 6. Settings integration and activation policy

The DNN registry entry is now:

- name: `DNN Trend Prediction Adapter`;
- version: `0.2.0`;
- status: `bundled`;
- default enabled: `false`.

Settings provides:

- Browse, Validate, and Clear Source actions;
- source path persistence;
- source/model/date/feature/readiness summary;
- a disabled checkbox until validation succeeds;
- a save guard preventing an enabled DNN state from being saved unless the current source is valid;
- automatic pending-state disablement when the source is cleared or validation fails;
- stale async-request protection and functional state updates to avoid overwriting concurrent Settings edits.

### 7. Read-only prediction viewer

The Settings plugin card contains a read-only exact lookup viewer for:

- symbol;
- NSE/BSE exchange;
- as-of date;
- 5/10/20-session horizon.

It can copy the active chart symbol, exchange, and latest raw-bar date. It displays probabilities, selected class, confidence, and data revision. Editing any query field clears the previous result. It performs no chart mutation, overlay creation, scanner execution, alert creation, broker call, or order action.

### 8. Canonical documentation reconciliation

`README.md`, `HANDOFF.md`, and `FILE_INVENTORY.md` now reflect the verified presence of `.cargo/config.toml`, the adapter's disabled-by-default exact-viewer scope, the current local validation evidence, the remaining Windows validation steps, and the next handoff boundary. Stale claims that the source snapshot omitted `.cargo/` were removed.

## Behavior deliberately preserved

- Core EOD Scanner remains enabled by default.
- DNN adapter remains disabled by default.
- No prediction runs during startup, chart loading, symbol changes, or database changes.
- No trained model, model file, Python runtime, ONNX runtime, remote service, or network request was added.
- No chart engine calculation or candlestick series was changed.
- No chart overlay or docked runtime panel was added.
- No scanner definition, Market Movers logic, alert logic, or workspace behavior was changed.
- No database schema was changed.
- No broker/live/order route was added.
- No generated output, dependency folder, target folder, executable, or package output was placed under `src` or `src-tauri-shell`.

## Validation commands and actual results

### Dependency installation

Command:

```text
npm ci --ignore-scripts
```

Result: **INCOMPLETE — ENVIRONMENT MIRROR FAILURE**

The internal artifact-environment npm mirror returned HTTP 404 for `zustand-4.5.7.tgz`. No `node_modules` directory remained.

### TypeScript syntax transpilation

Global TypeScript 5.8.3 transpiled 15 changed/new TS/TSX files with diagnostics enabled.

Result: **PASS**

### Focused strict production TypeScript compile

Covered prediction types, validation, provider interface, precomputed source parser/index, and precomputed provider.

Result: **PASS**

### Focused strict DNN production/test TypeScript compile

Covered the DNN foundation/provider/configuration files plus:

- `precomputedPredictionSource.test.ts`
- `pluginConfiguration.test.ts`

A minimal local Vitest declaration was used because the actual Vitest package was unavailable.

Result: **PASS**

### Deterministic compiled runtime harness

Covered:

- valid document parsing;
- exact prediction lookup;
- latest-earlier causal stale detection;
- no future fallback;
- provider output;
- data-revision mismatch rejection;
- invalid calendar timestamps despite ISO-like formatting.

Result: **PASS**

Output:

```text
PASS precomputed DNN runtime harness
PASS invalid calendar timestamp rejection
```

### JSON Schema validation

The bundled sample parsed successfully and validated against `dnn-trend-predictions-v1.schema.json` using Python `jsonschema`.

Result: **PASS**

### Cross-layer wiring audit

Verified the presence of matching app-profile, desktop bridge, Tauri command, command-registration, and Settings integration symbols. The generic Rust reader was also audited to use a hard ceiling, caller ceiling, pre-read metadata check, bounded `take(max + 1)` read, post-read actual-byte check, extension allow-list, regular-file check, canonical path, and UTF-8 validation.

Result: **PASS — SOURCE/WIRING AUDIT**

### Source artifact exclusion audit

The final source tree was checked for generated/dependency/output directories, archives, executables, installers, database files, and symlinks. None were present. The 32 intended modified/created source, resource, documentation, manifest, and validation files also passed an existence and trailing-whitespace audit.

Result: **PASS**

### Rust/Tauri validation

`cargo` and `rustc` were unavailable in the artifact environment.

Result: **NOT RUN**

### Full repository validation not run here

- actual Vitest execution;
- full renderer TypeScript typecheck;
- renderer production build;
- Rust/Tauri check;
- integrated build;
- Tauri release build;
- portable Windows packaging;
- rebuilt-application manual smoke test.

No claim is made that these passed.

## Required PowerShell validation

Run from:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"
```

Focused checks:

```powershell
npm run typecheck:renderer

npx vitest run `
  src/plugins/__tests__/pluginRegistry.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/featureBuilder.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/predictionService.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/precomputedPredictionSource.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/pluginConfiguration.test.ts
```

Full checks:

```powershell
npm test
npm run build:renderer
npm run tauri:check
npm run build
```

Portable package only after all checks pass:

```powershell
npm run tauri:portable:win
```

## Manual validation procedure

1. Open the rebuilt portable application.
2. Confirm existing database, symbols, charts, scanners, and Market Movers still operate.
3. Open Settings → Plugins.
4. Confirm the DNN adapter is visible and initially unchecked.
5. Confirm the checkbox is disabled with no source.
6. Browse to `resources\dnn-trend\sample-precomputed-predictions-v1.json`.
7. Confirm validation reports three records, one symbol, horizons 5/10/20, and `Production ready: No`.
8. Confirm the checkbox becomes available; enable it and save.
9. In the read-only viewer query `TCS`, `NSE`, `2026-08-03`, horizon `5`.
10. Confirm probabilities are 64% bullish, 23% sideways, and 13% bearish.
11. Query `2026-08-04` and confirm stale status references only `2026-08-03`.
12. Clear the source and confirm the plugin becomes disabled.
13. Save, restart, and confirm settings persistence is correct.

## Risks and possible regressions

1. **Full dependency-backed validation is pending.** The actual renderer typecheck and Vitest suite may reveal integration issues not visible to isolated compilation.
2. **Rust commands are not compiled locally.** Windows `npm run tauri:check` is mandatory before acceptance.
3. **Synchronous renderer JSON parsing.** A valid source up to 16 MiB is parsed in Settings and may briefly occupy the UI thread. This is acceptable for V1 configuration-time use but should move to a worker/backend index if source sizes grow.
4. **Absolute path persistence.** Moving or deleting the source invalidates it. Settings fails closed, but no file watcher is implemented.
5. **No startup inference route.** Enabling the plugin currently records validated configuration and exposes the Settings viewer only; it does not run predictions on charts.
6. **Research data can be enabled.** `productionReady: false` is shown clearly but does not block the read-only adapter because there is no trading action. Future scanner/trading routes must require stronger promotion governance.
7. **JSON Schema is not sufficient alone.** Runtime parsing remains authoritative for calendar-date validity, probability sums, duplicate composite keys, normalization, and causal lookup behavior.

## Rollback guidance

1. Restore all modified files from:

```text
docs\changes\backups\2026-08-05_1909_IST_PRECOMPUTED_DNN_PREDICTION_ADAPTER_V1\
```

2. Delete the created production/resource files listed above.
3. Delete the two new DNN test files.
4. Delete this change report, manifest, and validation file.
5. The two retrospective prior-cycle reports may be retained because they document already-completed earlier changes; delete them only if a byte-for-byte rollback to the uploaded snapshot is required.
6. Rerun renderer typecheck, full Vitest, Tauri check, integrated build, and portable packaging.

## Recommended next step

After Windows validation passes, keep automatic chart inference out of scope and build the external research/training pipeline that emits this exact schema plus golden feature fixtures. A later plugin phase can add an optional chart-side prediction panel using the same validated source/provider contracts.
