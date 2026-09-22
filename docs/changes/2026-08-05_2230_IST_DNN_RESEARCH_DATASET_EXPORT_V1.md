# DNN Research Dataset Export V1

## Timestamp

2026-08-05 22:30:00 +05:30 (IST)

## Objective

Add a read-only, versioned OHLCV/instrument/corporate-action export boundary for a future external DNN research and training workspace while preserving all existing charting, scanner, database, prediction-adapter, and portable-build behavior.

## Previous limitation

The validated Precomputed DNN Prediction Adapter V1 could consume externally generated prediction JSON, but the platform had no canonical, auditable way to export the active database into a stable research dataset. A future producer would otherwise have needed to read internal SQLite/binary storage directly and independently reproduce identity-history and corporate-action behavior, creating a high risk of training/inference data mismatch.

## Source basis

- Input snapshot: `Eod Charting Platform Source Code 2026-08-05_222907_IST.zip`
- Project root when applied: `E:\TA Projects\EOD Charting Platform`
- Active renderer: `src\`
- Active Rust backend: `src-tauri-shell\`

## Files inspected

- `package.json`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/bootstrap.rs`
- `src-tauri-shell/src/database/connection_registry.rs`
- `src-tauri-shell/src/database/eod_data.rs`
- `src-tauri-shell/src/database/daily_market_snapshot.rs`
- `src-tauri-shell/src/database/storage_mode.rs`
- `src-tauri-shell/src/plugin_data.rs`
- `src/types/desktop.ts`
- `src/platform/types.ts`
- `src/platform/tauriDesktop.ts`
- `src/components/SettingsDialog.tsx`
- `src/plugins/forecast/dnnTrend/*`
- `resources/dnn-trend/*`
- `README.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `HANDOFF.md`

## Files created

- `src-tauri-shell/src/database/dnn_research_export.rs`
- `src/plugins/forecast/dnnTrend/dnnResearchDatasetExportService.ts`
- `src/plugins/forecast/dnnTrend/__tests__/dnnResearchDatasetExportService.test.ts`
- `resources/dnn-trend/dnn-research-dataset-v1-manifest.schema.json`
- `resources/dnn-trend/README.md`
- `docs/changes/2026-08-05_2230_IST_DNN_RESEARCH_DATASET_EXPORT_V1.md`
- `docs/changes/2026-08-05_2230_IST_DNN_RESEARCH_DATASET_EXPORT_V1_FILE_MANIFEST.txt`
- `docs/changes/2026-08-05_2230_IST_DNN_RESEARCH_DATASET_EXPORT_V1_VALIDATION.txt`

## Files modified

- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/plugin_data.rs`
- `src/types/desktop.ts`
- `src/platform/types.ts`
- `src/platform/tauriDesktop.ts`
- `src/components/SettingsDialog.tsx`
- `src/plugins/forecast/dnnTrend/dnnTrendPlugin.ts`
- `src/plugins/forecast/dnnTrend/index.ts`
- `README.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `HANDOFF.md`

## Backup created

Modified pre-change files were copied to:

```text

docs\changes\backups\2026-08-05_2230_IST_DNN_RESEARCH_DATASET_EXPORT_V1\
```

## Final implementation

### Read-only backend export

`export_dnn_research_dataset` resolves the active database folder and executes the export on Tauri's blocking runtime. The exporter:

1. Opens a dedicated SQLite connection using `SQLITE_OPEN_READ_ONLY`, URI `mode=ro`, and verified `PRAGMA query_only = 1`.
2. Reads database statistics and normalizes the requested filters.
3. Resolves NSE/BSE instrument identities through the existing identity-history resolver.
4. Deduplicates alias candidates to one current canonical identity.
5. Loads bars through the existing unified hybrid/binary EOD path.
6. Applies the existing corporate-action engine when adjusted output is requested.
7. Prepares each instrument's complete rows before writing them, so a per-instrument data error cannot leave that instrument partially counted as successful.
8. Records identity/data failures in `failures.csv` instead of silently dropping them.
9. Treats output writer, flush, manifest, and finalization failures as fatal.
10. Writes to a hidden staging folder and renames it to a unique final folder only after all files and the manifest are complete.

### Safe full-export defaults

- Exchange: all supported equity exchanges (`NSE` and `BSE`)
- Date range: complete active-database range
- Include inactive instruments: yes
- Resolve identity history: yes
- Adjusted bars: yes
- Dividend adjustments: no
- Rights adjustments: no
- Timeframe: completed daily bars only

### Exported directory contract

Each finalized dataset contains:

```text

dataset-manifest.json
instruments.csv
daily-bars.csv
corporate-actions.csv
failures.csv
```

The manifest contract is `dnn-research-dataset-v1`. It records:

- dataset ID and generation timestamp
- database identity and metadata revision
- storage mode and source counts
- exact filters and adjustment options
- identity/corporate-action semantics
- output file names and row counts
- target/exported/failure counts
- status: `complete` or `completeWithFailures`

### Fail-closed validation

The exporter rejects:

- no active database
- empty or non-directory output path
- invalid calendar dates
- inverted date ranges
- unsupported/empty eligible instrument universe

A failed export removes its staging directory. A `completeWithFailures` export is published only with explicit `failures.csv` evidence and must be reviewed before training.

### Typed renderer/backend bridge

Added typed contracts for:

- output-folder selection
- export request
- progress event
- final export result

The Tauri event name is:

```text

dnn-research-export:progress
```

### Settings integration

Settings → Plugins → DNN Trend Prediction Adapter now contains an **External Research Dataset** section with:

- `Export Full Dataset...`
- disabled state when no database is open
- progress/status text
- read-only full-export defaults

The prediction-source validation, enablement gating, exact viewer, and persistence behavior remain unchanged.

### Plugin metadata

The bundled DNN adapter manifest advances from `0.2.0` to `0.3.0` and adds capability:

```text

read-only-research-dataset-export-v1
```

The plugin remains disabled by default. Dataset export does not enable prediction behavior.

## Behavior deliberately preserved

- Existing chart rendering, transformations, indicators, drawings, tabs, sheets, and layouts
- Core EOD Scanner and all existing scanner definitions
- Market Movers manual Scan/Update/Cancel behavior
- Watchlists and official source-linked updates
- Alerts
- Database schema and stored data
- Existing corporate-action review/approval behavior
- Existing precomputed prediction adapter contracts and Settings viewer
- Existing app-profile persistence
- Existing Cargo root-target topology and portable packaging scripts
- No generated build/dependency/output folders inside `src` or `src-tauri-shell`

## Deliberately not implemented

- Python, PyTorch, TensorFlow, ONNX, or any ML runtime in the desktop repository
- Feature engineering, model training, model selection, probability calibration, or backtesting
- Automatic chart inference
- Chart overlays
- Scanner ranking or signals from DNN predictions
- Alerts, broker routes, or order execution
- Database mutation or schema migration
- Export cancellation
- Cryptographic hashing of every source/output byte
- Parquet output

## Validation commands and actual results in the artifact environment

### Changed/new TypeScript syntax transpilation

Command: TypeScript 5.8.3 `transpileModule` over eight changed/new TS/TSX files.

Result: **PASS — 8/8 files**.

### Focused strict TypeScript compile

Command:

```text

tsc -p /tmp/dnn_export_tscheck/tsconfig.json
```

Scope: export service, export-service tests, desktop contracts, focused platform/Vitest declarations.

Result: **PASS**.

### Deterministic export-service runtime harness

Validated:

- path trimming
- safe full-export defaults
- empty output-path rejection
- partial-failure completion summary

Result: **PASS**.

### JSON Schema

Validated `dnn-research-dataset-v1-manifest.schema.json` as JSON and validated a representative manifest with JSON Schema Draft 2020-12.

Result: **PASS**.

### Cross-layer wiring audit

Verified:

- Rust command definition and registration
- Rust module registration/re-export
- folder-picker definition and registration
- frontend invoke names
- progress-event name parity
- Settings action
- plugin capability

Result: **PASS — 11/11 checks**.

### Generated/dependency/output exclusion audit

Searched the produced working source for `node_modules`, `dist`, `target`, and `release` directories.

Result: **PASS — none present**.

### Dependency installation

Command:

```text

npm ci --ignore-scripts
```

Result: **NOT COMPLETED**. The internal artifact-environment npm mirror returned HTTP 404 for `zustand-4.5.7.tgz`. Any partial dependency state was removed and is not included in the source package.

### Rust/Tauri compilation

Result: **NOT RUN**. `cargo`, `rustc`, and `rustfmt` are unavailable in the artifact environment.

### Actual Vitest/full renderer build/portable Windows package

Result: **NOT RUN** in the artifact environment. These require validation in the live Windows project.

## Required Windows validation

Run from:

```text

E:\TA Projects\EOD Charting Platform
```

Commands:

```powershell
npm run typecheck:renderer

npx vitest run `
  src/plugins/__tests__/pluginRegistry.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/featureBuilder.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/predictionService.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/precomputedPredictionSource.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/pluginConfiguration.test.ts `
  src/plugins/forecast/dnnTrend/__tests__/dnnResearchDatasetExportService.test.ts

npm test
npm run build:renderer
npm run tauri:check
npm run build
npm run tauri:portable:win
```

## Required manual acceptance

1. Open a real database.
2. Open Settings → Plugins → DNN Trend Prediction Adapter.
3. Click `Export Full Dataset...`.
4. Select a parent folder outside the project source tree.
5. Confirm progress is shown and Settings remains responsive enough for normal use.
6. Confirm a unique finalized dataset directory contains all five required files.
7. Open `dataset-manifest.json` and verify date range, storage mode, filters, source counts, output counts, and status.
8. Verify CSV row counts match the manifest.
9. Review `failures.csv`; accept clean training input only when failures are understood/resolved.
10. Confirm normal chart loading, scanners, Market Movers, and the prediction-source adapter remain operational.

## Risks and limitations

1. Full-database CSV export can consume significant time and disk space.
2. Export cancellation is not available in V1.
3. The metadata revision is not a cryptographic content hash; external research should retain the complete immutable export directory.
4. `completeWithFailures` is valid audit output but not automatically clean training input.
5. Including inactive instruments can legitimately produce explicit no-bar failures for the selected range.
6. CSV is audit-friendly but may be converted to Parquet externally for large-scale training.
7. A process/machine interruption may leave the hidden staging folder; no finalized dataset directory is published until completion.
8. Rust/Tauri compile and real hybrid/binary database behavior remain unconfirmed until Windows validation output is supplied.

## Rollback guidance

1. Restore all modified files from:

```text

docs\changes\backups\2026-08-05_2230_IST_DNN_RESEARCH_DATASET_EXPORT_V1\
```

2. Delete the created implementation files:

```text

src-tauri-shell\src\database\dnn_research_export.rs
src\plugins\forecast\dnnTrend\dnnResearchDatasetExportService.ts
src\plugins\forecast\dnnTrend\__tests__\dnnResearchDatasetExportService.test.ts
resources\dnn-trend\dnn-research-dataset-v1-manifest.schema.json
resources\dnn-trend\README.md
```

3. Delete this change report and its manifest/validation companions if rolling the entire change back.
4. Rerun typecheck, tests, Rust/Tauri check, renderer build, and portable packaging.

## Current result

DNN Research Dataset Export V1 is implemented and artifact-audited. It is **not yet Windows build/package/manual validated**. Do not mark the phase complete until the required PowerShell and real-database export evidence passes.
