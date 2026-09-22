# App Version Build Metadata Report

Date: 2026-06-08

## Scope

Add automatic build-number stamping for the existing Tauri build path and replace the old toast-only Help > About behavior with a proper About dialog that shows:

- app version
- build number
- build timestamp
- runtime paths
- version-by-version change notes

## Implementation

- `package.json`
  - `pretauri:build` now runs `scripts/generate-build-metadata.cjs`
  - `pretauri:bundle:nsis` also runs the same metadata script
- `scripts/generate-build-metadata.cjs`
  - validates that `package.json`, `src-tauri-shell/Cargo.toml`, and `src-tauri-shell/tauri.conf.json` all carry the same semantic version
  - generates `src-tauri-shell/gen/build-info.json` with `version`, `buildNumber`, and `builtAt`
- `src-tauri-shell/build.rs`
  - now watches `gen/build-info.json` so build-metadata changes are picked up by Rust builds
- `src-tauri-shell/src/main.rs`
  - `get_app_info` now includes `buildNumber` and `builtAt`
- `src/components/AboutDialog.tsx`
  - new floating Help > About dialog
- `src/features/app/appVersionHistory.ts`
  - manual version-notes source used by the About dialog
- `scripts/prepare-tauri-portable.ps1`
  - portable `README.txt` now includes version/build metadata

## Behavior Change

Previous behavior:

- Help > About showed one or two toasts with version/runtime/path text
- builds did not stamp a separate build number

New behavior:

- every `npm run tauri:build` and `npm run tauri:portable:win` run generates build metadata first
- Help > About opens a proper dialog with version/build/runtime/path information and recorded version notes
- the portable staged `README.txt` also reflects the current version/build metadata

## Validation

- `node .\scripts\generate-build-metadata.cjs`
- `npm run typecheck:renderer`
- `cargo fmt --manifest-path src-tauri-shell\Cargo.toml`
- `git diff --check -- package.json scripts\generate-build-metadata.cjs scripts\prepare-tauri-portable.ps1 src\components\AboutDialog.tsx src\features\app\appVersionHistory.ts src\features\app\menuCommandRouter.ts src\RootApp.tsx src\store\uiStore.ts src\types\desktop.ts src-tauri-shell\build.rs src-tauri-shell\gen\build-info.json src-tauri-shell\src\main.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md APP_VERSION_BUILD_METADATA_REPORT.md`

Compile/build intentionally not run in this pass. The user will validate on the next manual build.
