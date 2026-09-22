# MIGRATION_EXECUTION_PLAN

Date: 2026-03-30

## Status Snapshot

- Phase 0: audit completed
- Phase 1: completed on Electron by introducing `src/platform/*` and routing active renderer call sites through it
- Phase 2: completed by adding a fresh `src-tauri-shell` path that mounts the active frontend without porting business logic
- Phase 3: completed by dual-wiring low-risk shell services behind `src/platform/*`
- Phase 4: completed by porting the database/persistence subset behind `src/platform/*` using `src-tauri-shell`
- Phase 5: completed by porting CSV import, bhavcopy, and progress/event flows behind `src/platform/*` using `src-tauri-shell`
- Phase 6: completed by validating packaged Windows Electron/Tauri startup, generating a parity matrix, and documenting cutover rules
- Phase 7: completed by porting the remaining mutation flows behind `src/platform/*` using `src-tauri-shell` and re-evaluating the Windows cutover path
- Portable Windows development baseline: completed by adding launcher-first portable staging, portable/system runtime-path handling, runtime diagnostics, and startup-failure messaging for the fresh Tauri shell
- Current next step: Windows-first feature development on the portable Tauri base while keeping Electron as fallback and deferring installer-first/macOS work
- Important constraint: do not use the legacy `src-tauri` tree as the baseline for future Tauri work

## Strategy

Safest strategy: **stabilize the current Electron contract first, then replace the runtime behind that contract**.

Do not cut directly from `window.electronAPI` to scattered Tauri calls in many components. That would multiply migration risk.

## What To Do First

1. Freeze the current desktop contract and smoke-test matrix.
2. Introduce a frontend platform abstraction while still on Electron.
3. Only then scaffold Tauri 2 alongside the existing app and reimplement the same contract behind it.

## What To Postpone

- macOS signing and notarization automation until functional parity exists
- optional UI cleanup
- deletion of Electron files
- cleanup of legacy `src-tauri`, `src/main.js`, `src/app.js`, and `src/modules/*`
- any export feature work unless a missing export requirement is separately confirmed

## Rollback Principle

Keep Electron as the release fallback until the Tauri build passes the full parity checklist on Windows and macOS. Do not delete the Electron path until at least one full internal release candidate on Tauri is green.

## Phase 0: Baseline And Contract Freeze

### Goals

- capture current behavior for the local-first flows
- freeze the renderer-facing desktop contract
- define parity targets before any runtime swap

### Planned files to touch later

- `src/types/electron.d.ts` or its extracted successor
- migration notes and parity checklist docs

### Expected risks

- under-specifying behavior in quote edit, merge, corporate actions, import progress, or bhavcopy flows
- accidental assumption that the legacy Tauri tree already matches the active product

### Validation steps

- document current snapshot shape
- document all preload methods and events
- record manual smoke scenarios:
  - create/open/close/delete database
  - load chart data
  - create watchlist and navigate symbols
  - save/load/delete layouts
  - quote edit
  - merge symbols
  - corporate action application
  - CSV preview/import
  - bhavcopy single-date and batch workflows

### Rollback

- none needed; this phase is analysis only

## Phase 1: Introduce A Frontend Compatibility Layer On Electron First

Status: completed on 2026-03-28

### Goals

- create `src/platform/desktop.ts`
- route the renderer through that module instead of direct `window.electronAPI` access
- keep Electron implementation underneath during this phase

### Files touched

- `src/platform/desktop.ts`
- `src/platform/types.ts`
- `src/platform/index.ts`
- `src/store/chartStore.ts`
- `src/components/ImportCsvDialog.tsx`
- `src/components/DatabaseToolsDialogs.tsx`
- `src/components/LayoutManagerDialog.tsx`
- `src/components/DeleteDatabaseDialog.tsx`
- `src/components/BhavcopyDownloadWindow.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/Sidebar.tsx`
- `src/components/CommandPalette.tsx`

### Expected risks

- missing one or two renderer call sites and ending up with mixed Electron/Tauri access patterns later

### Validation steps

- `npm run typecheck:renderer` passed
- `npm run typecheck:electron` passed
- `npm run build` passed
- active renderer direct `window.electronAPI` usage was reduced to `src/platform/desktop.ts`
- Electron smoke launch still reached startup and renderer load
- full data-driven smoke assertions remain blocked by missing local fixture files required by `scripts/runtime-smoke-check.js`

### Rollback

- revert the bridge refactor while keeping Electron runtime unchanged

## Phase 2: Scaffold Tauri 2 Alongside The Existing Frontend

Status: completed on 2026-03-28

### Goals

- create a fresh Tauri 2 shell for the active React/Vite app
- point Tauri at the existing frontend build
- keep Electron path intact in parallel

### Files touched

- `package.json`
- `package-lock.json`
- `.gitignore`
- `vite.config.ts`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/build.rs`
- `src-tauri-shell/tauri.conf.json`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/capabilities/default.json`
- `src-tauri-shell/icons/*`
- `src-tauri-shell/README.md`

### Expected risks

- accidentally reusing stale `src-tauri` code and inheriting the wrong data model
- build pipeline confusion between Electron and Tauri outputs

### Validation steps

- `npm run build` still passed for Electron
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passed
- `npm run tauri:build` passed and built `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
- the fresh Tauri production shell executable launched successfully and opened an `EOD Chart` window
- a bounded `npm run tauri:dev` run reached Vite dev-server readiness, but first-run debug compilation did not complete within the bounded validation window
- no business features were ported
- renderer code outside `src/platform/*` still does not import runtime-specific APIs directly

### Rollback

- disable or remove the new Tauri scripts while Electron remains authoritative

## Phase 3: Port Low-Risk Desktop Services Behind The Bridge

Status: completed on 2026-03-28

### Goals

- implement Tauri-backed versions of the low-risk bridge methods
- move non-business-critical platform features first

### Scope

- app version/name helpers
- external URL opening
- simple window actions if needed
- menu event plumbing

### Files touched

- `package.json`
- `package-lock.json`
- `src/platform/types.ts`
- `src/platform/desktop.ts`
- `src/platform/shell.ts`
- `src/platform/index.ts`
- `src/store/chartStore.ts`
- `src/types/electron.d.ts`
- `electron/preload.ts`
- `electron/ipc/handlers.ts`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/Cargo.lock`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/capabilities/default.json`
- `src-tauri-shell/README.md`

### Expected risks

- menu accelerators and native menu behavior differing by OS
- accidental confusion between the shell bridge and the Electron-only business-service bridge

### Validation steps

- `npm run build` passed and Electron remained intact
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passed
- `npm run tauri:build` passed and built `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
- the fresh Tauri production shell executable launched successfully and opened an `EOD Chart` window after the Phase 3 changes
- a bounded `npm run tauri:dev` re-check again reached Vite dev-server readiness, but full debug shell/window launch still was not confirmed
- no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly; the old legacy files `src/app.js` and `src/modules/*` still contain historical Tauri imports
- direct `window.electronAPI` usage remains isolated to `src/platform/desktop.ts` and `src/platform/shell.ts`
- `menu:about` now resolves through the shell bridge and shows runtime/app metadata in the renderer

### Rollback

- fall back to Electron bridge implementation for these methods

## Phase 4: Port Database And Persistence Services

Status: completed on 2026-03-28

### Goals

- move database registry, manifest handling, settings, layouts, snapshots, reads, and CRUD commands into Rust
- preserve the current database folder model exactly

### Scope

- active database selection
- registry JSON handling
- SQLite migrations and pragmas
- snapshot construction
- symbol search/list
- EOD history and event marker loading
- watchlists
- settings
- layouts
- deferred:
  - quote editor CRUD
  - merge symbols
  - corporate actions / identity history writes

### Files touched

- `src/platform/desktop.ts`
- `src/platform/tauriDesktop.ts`
- `src/store/chartStore.ts`
- `src/components/CommandPalette.tsx`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/Cargo.lock`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/README.md`

### Expected risks

- registry/path behavior drifting from Electron semantics
- schema drift or query/result drift in symbol resolution and adjusted-history reads
- exposing unsupported Electron-only tools while Tauri is active

### Validation steps

- `npm run typecheck:renderer` passed
- `npm run build` passed and Electron remained intact
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passed
- `npm run tauri:build` passed and rebuilt `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
- the rebuilt fresh Tauri production shell executable launched successfully and stayed alive long enough to confirm the window opens
- no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports
- quote editor, merge, corporate-action writes, CSV import, bhavcopy, and worker progress/event flows remain intentionally Electron-only after this phase

### Rollback

- keep Electron as the active backend for deferred business-critical flows while the Tauri shell uses only the Phase 4 persistence subset

## Phase 5: Port Long-Running Jobs And Progress Events

Status: completed on 2026-03-28

### Goals

- replace Electron-specific worker/session flows with Tauri-native or Rust-native equivalents
- preserve progress reporting and error behavior

### Scope

- CSV preview and import
- long-running import execution
- bhavcopy download and batch download
- progress events for both

### Files touched

- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/Cargo.lock`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/imports.rs`
- `src-tauri-shell/src/bhavcopy.rs`
- `src/platform/tauriDesktop.ts`
- `src/components/CommandPalette.tsx`

### Expected risks

- bhavcopy fetch/session behavior differs from Electron
- ZIP and CSV parsing edge cases
- progress frequency or cancellation behavior changes
- multi-file import performance regression

### Validation steps

- `npm run typecheck:renderer` passed
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passed
- `npm run build` passed and Electron remained intact
- `npm run tauri:build` passed and rebuilt `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
- the rebuilt fresh Tauri production shell executable launched successfully and stayed alive long enough to confirm the window opens
- a bounded Electron fallback launch still started successfully after the Phase 5 work
- no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports
- progress/event wiring now exists for both `import:progress` and `bhavcopy:progress` through `src/platform/tauriDesktop.ts`
- full interactive Tauri import/bhavcopy smoke validation is still not claimed in this phase

### Rollback

- keep Electron-only implementation for import/download until parity is demonstrated

## Phase 6: Packaging, Signing, Dual-Run Validation, And Cutover

Status: completed on 2026-03-28

### Goals

- package Tauri for Windows and macOS
- validate installer/runtime prerequisites
- cut over only after parity

### Scope

- Windows packaging and WebView2 validation
- macOS signing and notarization
- release artifact size comparison
- idle RAM comparison

### Files touched

- `package.json`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `RISK_REGISTER.md`
- `src-tauri-shell/README.md`
- `PHASE6_PACKAGING_CUTOVER_REPORT.md`
- `PARITY_MATRIX_ELECTRON_VS_TAURI.md`

### Expected risks

- macOS signing/notarization friction
- Windows environments without WebView2 runtime
- app data path changes between Electron and Tauri causing migration confusion

### Validation steps

- `npm run build` passed and Electron remained intact
- `npm run dist:dev` passed and produced `release/win-unpacked/EOD Chart.exe`
- the unpacked Electron package launched successfully and exposed an `EOD Chart` window title in a bounded startup check
- `npm run dist:installer` passed and produced `release/EOD Chart Setup 0.1.0.exe`
- the Electron NSIS installer launched successfully and exposed an `EOD Chart Setup` window title in a bounded startup check
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passed
- `npm run tauri:build` passed and produced `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
- the fresh Tauri production executable launched successfully and exposed an `EOD Chart` window title in a bounded startup check
- `npm run tauri:bundle:nsis` passed and produced `src-tauri-shell/target/release/bundle/nsis/EOD Chart_0.1.0_x64-setup.exe`
- the Tauri NSIS installer launched successfully and exposed an `EOD Chart Setup` window title in a bounded startup check
- no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports
- macOS packaging, signing, notarization, and runtime validation remain unverified
- full interactive Tauri database/import/bhavcopy parity remains unverified
- current cutover recommendation remains **no-go** for switching the default runtime

### Rollback

- keep Electron as the release default while continuing Tauri hardening on a separate branch or milestone track

## Phase 7: Mutation Parity Blocker Pass

Status: completed on 2026-03-28

### Goals

- port quote editor CRUD behind the existing platform seam
- port merge-symbol flows behind the existing platform seam
- port corporate-action / identity-history mutation flows behind the existing platform seam
- re-run packaged Windows build/startup validation and re-evaluate the cutover recommendation

### Files touched

- `src/platform/tauriDesktop.ts`
- `src/components/CommandPalette.tsx`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/database.rs`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `RISK_REGISTER.md`
- `src-tauri-shell/README.md`
- `PARITY_MATRIX_ELECTRON_VS_TAURI.md`
- `PHASE7_MUTATION_PARITY_REPORT.md`

### Expected risks

- mutation behavior drifting from `electron/db.ts` semantics
- over-claiming packaged interactive parity based only on compile/startup evidence
- hiding the remaining macOS release gap while focusing on Windows

### Validation steps

- `npm run build` passed
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passed
- `npm run tauri:build` passed
- `npm run tauri:bundle:nsis` passed
- bounded launch checks reconfirmed:
  - `release/win-unpacked/EOD Chart.exe`
  - `release/EOD Chart Setup 0.1.0.exe`
  - `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
  - `src-tauri-shell/target/release/bundle/nsis/EOD Chart_0.1.0_x64-setup.exe`
- no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports
- packaged interactive parity still remains only partial, so the cutover recommendation moved from **no-go** to **Windows-preview-only**, not default-runtime cutover

### Rollback

- keep Electron as the release fallback runtime and treat Tauri as Windows-preview-only until packaged interaction parity and macOS readiness are proven

## Cross-Phase Validation Checklist

- Database folder created by Electron opens in Tauri
- Recent database list survives correctly
- Chart history renders identically for sample symbols
- Watchlists and workspace tabs persist correctly
- Quote edit, merge, and corporate actions preserve expected data
- CSV preview and import results match
- Bhavcopy results match expected inserts or holiday skips
- No renderer module depends directly on Electron or Tauri APIs outside `src/platform/*`

## Recommended Cutover Rule

Switch the default desktop runtime from Electron to Tauri only when all of the following are true:

- bridge abstraction is complete
- database parity is proven
- import and bhavcopy parity are proven
- Windows packaging is stable
- macOS packaging is signed and validated
- Electron remains available as rollback for at least one release cycle

Current decision after Phase 7:

- do not switch the default runtime yet
- allow Windows-preview-only Tauri builds because the mutation-surface blockers are now ported
- keep Electron as the external release runtime until packaged interaction parity and macOS release readiness are resolved

## Portable Windows Development Baseline Pass

Status: completed on 2026-03-30

### Goals

- make the fresh Tauri shell practical for daily-use Windows development on the same PC or another Windows PC
- make runtime state, logs, and startup failures easier to understand
- provide one reproducible staging command for a launcher-driven portable folder

### Scope

- portable/system runtime-path detection
- startup diagnostics and runtime log routing
- portable registry placement and early registry initialization
- renderer-visible runtime/build/path metadata through the existing About path
- reproducible portable staging command and launcher
- documentation for launcher-first portable workflow

### Files touched

- `package.json`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/runtime.rs`
- `electron/ipc/handlers.ts`
- `src/types/electron.d.ts`
- `src/store/chartStore.ts`
- `scripts/prepare-tauri-portable.ps1`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `RISK_REGISTER.md`
- `src-tauri-shell/README.md`
- `PORTABLE_WINDOWS_DEV_BASE_REPORT.md`

### Expected risks

- users may assume the bare staged executable is the full portable guarantee when the supported flow is actually launcher-first
- portable expectations may drift from Tauri defaults if docs do not clearly describe where runtime state lives
- Windows-to-Windows portability still depends on WebView2 availability on the target machine

### Validation steps

- `npm run build` passed
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passed
- `npm run tauri:build` passed
- `npm run tauri:portable:win` passed
- `src-tauri-shell/target/release/eod-charting-platform-shell.exe` launched and exposed `EOD Chart`
- `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd` launched and exposed `EOD Chart`
- `release/tauri-portable-win/EOD Chart Portable/portable-data/logs/app-runtime.log` was created during portable launch
- `release/tauri-portable-win/EOD Chart Portable/portable-data/state/database-registry.json` was created during portable launch
- no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly
- portable behavior is validated through the generated launcher; bare direct executable launch is still fallback-only, not the primary portable claim

### Rollback

- keep Electron as the fallback runtime
- keep the standard `npm run tauri:build` release executable path working even if portable staging changes later
- treat the portable launcher workflow as additive, not as a replacement for the existing Electron escape hatch
