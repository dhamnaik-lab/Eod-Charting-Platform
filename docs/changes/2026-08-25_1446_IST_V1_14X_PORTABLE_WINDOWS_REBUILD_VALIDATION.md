# V1.14X Portable Windows Rebuild Validation

**IST timestamp:** 2026-08-25 14:46 IST

## Objective

Rebuild the Windows portable distribution from the validated V1.14X source state and confirm that the frontend production build, Rust/Tauri release build, portable packaging step, and portable executable SHA-256 verification complete successfully.

## Previous Defect or Limitation

V1.14X had already completed the controlled live Corporate Action consolidation, database-level post-commit audit, independent private-copy audit, and manual UI/chart smoke testing. The remaining packaging requirement was to rebuild the Windows portable distribution so that the deployed portable application incorporates the validated V1.14X source.

Before this rebuild, the current portable package had not yet been proven by fresh command output to contain the final V1.14X implementation.

## Files Changed

No production source file was intentionally edited during this packaging-validation step.

Build-generated or packaging output observed from the command includes:

- `src-tauri-shell\gen\build-info.json` — regenerated build metadata.
- Frontend production output under `dist\`.
- Rust/Tauri release output under `target\release\`.
- Portable Windows package under `release\tauri-portable-win\EOD Chart Portable`.

Validated release executable:

- `E:\TA Projects\EOD Charting Platform\target\release\eod-charting-platform-shell.exe`

Validated portable package root:

- `E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`

## Final Implementation

The existing project packaging route was used without redesign:

```powershell
npm run tauri:portable:win
```

The command resolved to the existing workflow:

```text
npm run tauri:build
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-tauri-portable.ps1
```

The Tauri build also executed the configured renderer build:

```text
npm run build:renderer
vite build
```

This preserves the established project packaging architecture and avoids introducing a second or temporary packaging implementation.

## Validation Commands

Primary validation command:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"
npm run tauri:portable:win
```

The command executed the following verified stages:

```text
node .\scripts\generate-build-metadata.cjs
vite build
tauri build --config tauri.conf.json
scripts\prepare-tauri-portable.ps1
```

## Actual Validation Results

### Build metadata

```text
Generated build metadata:
E:\TA Projects\EOD Charting Platform\src-tauri-shell\gen\build-info.json
```

Result: **PASS**

### Frontend production build

```text
vite v5.4.21 building for production...
✓ 742 modules transformed.
✓ built in 1m 11s
```

Result: **PASS**

### Rust / Tauri release build

```text
Compiling eod-charting-platform-shell v0.1.0
Finished `release` profile [optimized] target(s) in 13m 16s
```

Result: **PASS**

Generated release executable:

```text
E:\TA Projects\EOD Charting Platform\target\release\eod-charting-platform-shell.exe
```

### Portable executable verification

The packaging workflow reported:

```text
Verified portable executable SHA-256:
28E2BD4F55E1D2F46FAD096E73053F74F6F336E869C9C238A4B8FFF55AD25599
```

Result: **PASS**

### Portable package output

```text
E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable
```

Result: **PASS**

### Overall packaging command

The command returned normally to the PowerShell prompt after portable preparation.

Result: **PASS**

## Behaviour Deliberately Preserved

- Existing Vite renderer build flow.
- Existing Tauri release build configuration.
- Existing `scripts\prepare-tauri-portable.ps1` packaging route.
- Existing source directory boundaries.
- No alternate portable builder or duplicate packaging implementation was introduced.
- The validated V1.14X Corporate Action source and database behaviour were not altered by this packaging-only step.

## Risks or Limitations

- The portable executable hash above is the value reported and verified by the existing packaging workflow.
- This report does not independently re-hash the executable outside that workflow because no portable executable file was uploaded for a second independent hash calculation.
- The existing unrelated V1.7A parallel-test isolation issue remains separate from V1.14X.
- Build-generated files under `dist`, `target`, `release`, and `src-tauri-shell\gen` may naturally change on future builds.
- The V1.14X pre-write database backup should remain retained as a recovery checkpoint even though the live Apply, manual smoke test, and portable rebuild passed.

## Rollback Guidance

The portable rebuild itself did not require a production-database rollback.

If the rebuilt portable package must be withdrawn:

1. Stop using the new package under:
   `E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
2. Restore or redistribute the previously accepted portable build if required.
3. Do not roll back the V1.14X database merely because of a packaging issue.
4. If a database rollback is independently required, use the verified V1.14X pre-write recovery checkpoint and its documented MAIN + WAL restore procedure. Do not restore the archived SHM.

## Final Status

**V1.14X Windows portable rebuild validation: PASS**

Confirmed portable executable SHA-256:

```text
28E2BD4F55E1D2F46FAD096E73053F74F6F336E869C9C238A4B8FFF55AD25599
```

With the already-completed V1.14X database Apply validation and manual UI/chart smoke testing, the V1.14X implementation and Windows portable packaging work are now validated within the tested scope.
