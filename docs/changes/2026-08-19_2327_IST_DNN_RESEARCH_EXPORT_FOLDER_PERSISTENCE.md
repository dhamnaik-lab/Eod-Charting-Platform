# EOD Charting Platform — DNN Research Export Folder Persistence

**IST timestamp:** 2026-08-19 23:27 IST  
**Change class:** Focused renderer/settings preference change  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Source snapshot:** `Eod Charting Platform Source Code 2026-08-19_223656_IST`  
**Uploaded ZIP SHA-256:** `28F813C0EE317FCBD8FC8F90E7B86D2DB763FA838F16EA0800E98F8369BA8FD3`

## Objective

Persist the DNN External Research Dataset export destination using the existing DNN plugin configuration inside `app-settings.json`, while preserving the current dataset-export contract and existing-user behavior.

## Previous defect or limitation

`SettingsDialog.tsx` always called the output-folder picker before every full DNN research dataset export. The selected directory was not represented in the persisted DNN plugin configuration, so the operator repeatedly browsed to the same folder.

## Files inspected

- `AGENTS.md`
- `HANDOFF.md`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `package.json`
- `src/components/SettingsDialog.tsx`
- `src/features/app/appSettingsService.ts`
- `src/plugins/forecast/dnnTrend/pluginConfiguration.ts`
- `src/plugins/forecast/dnnTrend/dnnResearchDatasetExportService.ts`
- `src/plugins/forecast/dnnTrend/dnnTrendPlugin.ts`
- `src/plugins/forecast/dnnTrend/index.ts`
- focused DNN configuration/export tests
- `scripts/create-project-backup.ps1`
- `scripts/validate-change.ps1`

## Files changed

- `src/components/SettingsDialog.tsx`
- `src/plugins/forecast/dnnTrend/pluginConfiguration.ts`
- `src/plugins/forecast/dnnTrend/dnnResearchDatasetExportService.ts`
- `src/plugins/forecast/dnnTrend/__tests__/pluginConfiguration.test.ts`
- `src/plugins/forecast/dnnTrend/__tests__/dnnResearchDatasetExportService.test.ts`
- `docs/changes/2026-08-19_2327_IST_DNN_RESEARCH_EXPORT_FOLDER_PERSISTENCE.md`

## Final implementation

### Persisted preference

`DnnTrendPluginConfiguration` now includes:

```ts
researchDatasetOutputDirectory: string;
```

The default is an empty string. The normalizer trims valid strings and fails closed to an empty value for malformed or legacy settings.

### Settings UI

The External Research Dataset panel now shows the current export folder and a `Browse...` button.

Selecting a folder updates the in-dialog DNN plugin configuration. The existing `Save Changes` action persists it through the already-established `app-settings.json -> pluginConfigurations` path.

### Export behavior

- If a saved export directory exists, `Export Full Dataset...` uses it directly and does not open the picker.
- If no saved directory exists, the existing picker opens.
- A directory selected by that first export is placed into the current Settings state and can be persisted with `Save Changes`.
- The picker remains available to choose a different directory at any time.

### Existing-user compatibility

Existing settings without `researchDatasetOutputDirectory` normalize to `''`, so the first export retains the previous picker behavior.

### Prediction-source preservation

Changing or clearing the DNN precomputed prediction source now preserves the research export-folder field rather than replacing the entire DNN plugin configuration.

## Behavior deliberately preserved

No change to:

- DNN research dataset contents or schema;
- manifest naming/versioning;
- read-only export behavior;
- adjusted-price/corporate-action semantics;
- inactive-instrument inclusion;
- dividend/rights adjustment settings;
- export progress events;
- Rust export implementation;
- Tauri desktop API;
- DNN prediction-source validation;
- frozen DNN research/model contracts;
- Bhavcopy;
- Corporate Actions;
- chart rendering.

No absolute `E:\...` research directory is hard-coded in production source.

## TDD / validation performed in artifact environment

### RED evidence

1. Configuration test expectation was added first. A direct execution harness against the pre-change production normalizer failed as expected because `researchDatasetOutputDirectory` was absent.
2. Output-directory resolver expectation was added before its production implementation. The direct execution harness failed as expected because the resolver did not exist.

### GREEN evidence

A focused Node + TypeScript execution harness passed after implementation:

```text
FOCUSED_BEHAVIOR_CHECK PASS
```

It verified:

- legacy/default DNN configuration returns an empty export-folder preference;
- both persisted paths are trimmed;
- a configured export directory bypasses the picker;
- an empty configuration invokes the picker exactly once.

### Syntax validation

TypeScript `transpileModule(..., reportDiagnostics: true)` produced zero syntax errors for all five touched TS/TSX/test files.

### Settings seam checks

Focused source checks passed for:

- resolver import;
- saved-folder read;
- Browse control;
- picker fallback;
- prediction-source changes preserving the export folder;
- Clear Source preserving the export folder.

### Official project validation not completed in artifact environment

The uploaded source snapshot does not contain `node_modules`.

Attempts to obtain dependencies were not successful in this environment:

- `npm ci --ignore-scripts` — timed out.
- `npm ci --offline --ignore-scripts` — failed because `zustand-4.5.7.tgz` was not cached.
- focused `npx --offline vitest@4.1.2 ...` — failed with `ENOTCACHED`.
- `npm run typecheck:renderer` — exited 2 because React/Zustand and other dependency/type declarations are absent from the snapshot environment.

These are environment/dependency failures and are **not** counted as passing project validation.

The included Windows apply script runs the authoritative focused tests and renderer typecheck in the real project after guarded apply.

## Risks or limitations

- Until the Windows validation script passes, the change is implemented but not fully qualified.
- A saved directory can later become unavailable or invalid; in that case the existing export error path will surface the failure and the operator can choose a new folder with `Browse...`.
- The folder is persisted only when the existing `Save Changes` action is used. This intentionally preserves the dialog's current save semantics and avoids silently committing other unsaved settings.

## Rollback guidance

Use the backup path printed by the apply script. Restore these five files from that backup:

- `src\components\SettingsDialog.tsx`
- `src\plugins\forecast\dnnTrend\pluginConfiguration.ts`
- `src\plugins\forecast\dnnTrend\dnnResearchDatasetExportService.ts`
- `src\plugins\forecast\dnnTrend\__tests__\pluginConfiguration.test.ts`
- `src\plugins\forecast\dnnTrend\__tests__\dnnResearchDatasetExportService.test.ts`

Then delete this change report.

## Local Windows validation

**Pending.** The apply script appends the actual local command results here.

### Local apply and validation results

- Source hash guards: **PASS**
- Package payload hashes: **PASS**
- Backup: $backupRoot
- Payload apply/post-copy hash verification: **PASS**
- Vitest DNN plugin configuration: **PASS**
- Vitest DNN research export service: **PASS**
- Renderer typecheck: **PASS**
- Renderer validation profile + whitespace check: **FAIL (exit 1)**
- Overall local validation: **FAIL**
