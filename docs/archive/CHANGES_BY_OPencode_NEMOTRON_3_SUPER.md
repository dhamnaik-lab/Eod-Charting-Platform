# Changes Made by Opencode Nemotron 3 Super

## Date: March 31, 2026 (Session 3)

## Summary: UI Spacing and Readability Fixes

### Goal
- Fix `+` new tab button being too far from the last tab
- Fix left sidebar vertical menu readability

### Files Updated
- `src/components/ChartTabs.tsx` - `+` button spacing fix
- `src/components/Sidebar.tsx` - Vertical menu readability fix
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md` - Updated documentation
- `UI_POLISH_REPORT.md` - Updated report

### What Changed

**Tab `+` Button Fix (`src/components/ChartTabs.tsx`):**
- Removed `flex: 1` from tab list so it only takes needed space
- `+` button now sits immediately after the last visible tab (browser-style)

**Left Sidebar Readability (`src/components/Sidebar.tsx`):**
- Increased font size from 10px to 11px for vertical buttons
- Increased button height from 70px to 76px
- Improved contrast: active `#d9ecff`, inactive `#8ea6bf`
- Added font weight 600 for better legibility
- Improved collapse button styling to match

### Validation
- `npm run typecheck:renderer` - **PASSED**
- `npm run build` - **PASSED**

### Backups Created
- `backups/pre_opencode_changes_20260331_141443_ui_spacing_fix/ChartTabs.tsx`
- `backups/pre_opencode_changes_20260331_141443_ui_spacing_fix/Sidebar.tsx`

---

## Date: March 31, 2026 (Session 2)

## Summary: UI Polish - Chart Gutter Fixes and Tab Redesign

### Goal
- Fix chart window gutter issues (no left padding, right-side gap)
- Redesign chart tabs to match browser/Amibroker style

### Files Updated
- `src/engine/ScaleManager.ts` - Chart gutter fix
- `src/components/ChartTabs.tsx` - Tab redesign
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md` - Updated documentation
- `UI_POLISH_REPORT.md` - New report documenting changes

### What Changed

**Chart Gutter Fix (`src/engine/ScaleManager.ts`):**
- Added `gutterPx = 4` parameter to `buildScaleX` function
- First bar now has proper left gutter padding
- Last bar extends properly to right edge before Y-axis
- Improved candle positioning consistency

**Tab Redesign (`src/components/ChartTabs.tsx`):**
- Removed boxy borders, now uses accent bottom border for active tab
- Active tab has 2px solid accent-colored bottom border
- Subtle hover state with smooth 0.15s transitions
- Close button (X) only visible on hover or when tab is active
- Uses SVG icons for close button (X) and new tab button (+)
- Transparent backgrounds with hover visibility
- Better spacing and alignment

### Validation
- `npm run typecheck:renderer` - PASSED
- `npm run build` - PASSED
- `cargo build --release --manifest-path src-tauri-shell/Cargo.toml` - PASSED
- Built: `src-tauri-shell/target/release/eod-charting-platform-shell.exe` (14.7 MB)

### Backups Created
- `backups/pre_opencode_changes_20260331_111831_chart_gutters/ScaleManager.ts`
- `backups/pre_opencode_changes_20260331_112457_chart_tabs_style/ChartTabs.tsx`

---

## Date: March 31, 2026

## Summary: Windows-First Chart Tools Additions On The Portable Tauri Baseline

### Goal
- Improve daily EOD chart interaction without broad UI redesign
- Keep the active chart engine modular for future tools
- Preserve the portable Tauri Windows baseline and Electron fallback behavior

### Files Added
- `CHART_TOOLS_ADDITIONS_REPORT.md`

### Files Updated
- `src/store/chartStore.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/Crosshair.ts`
- `src/components/ChartToolDock.tsx`
- `src/components/ChartCanvas.tsx`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `FILE_INVENTORY.md`

### What Changed
- Improved the chart crosshair with stronger visibility, label clamping, and a clearer center marker in `src/engine/Crosshair.ts`
- Improved chart interaction behavior in `src/engine/ChartEngine.ts`:
  - shift-wheel horizontal pan
  - clearer `grabbing` cursor feedback while panning or dragging drawings
  - left-button-only pan start
  - more predictable wheel zoom scaling
- Added an in-chart hover readout card in `src/components/ChartCanvas.tsx` that shows:
  - date
  - open
  - high
  - low
  - close
  - absolute and percent change
  - volume
- Added keyboard shortcuts in `src/components/ChartCanvas.tsx` for the common tools:
  - `H` horizontal line
  - `V` vertical line
  - `L` trend line
  - `C` cursor
  - `M` magnet
- Reworked `src/components/ChartToolDock.tsx` so the primary tools are emphasized first and broader tools are grouped behind an advanced toggle
- Added clearer active-mode and selected-drawing hints in the dock and chart canvas
- Hardened delete behavior in `src/components/ChartCanvas.tsx` so `Delete` / `Backspace` remove only the selected drawing, while `Shift+Delete` remains the explicit clear-all path
- Updated `src/store/chartStore.ts` so drawing mode and drawing-properties state reset on chart-tab create/activate/close transitions, preventing tool-state leakage across charts
- Preserved the existing drawing persistence model already present in the chart workspace instead of adding new storage work in this pass

### Validation
- `npm run build` passes
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes
- `npm run tauri:portable:win` passes
- bounded launch of:
  - `release/tauri-portable-win/EOD Chart Portable/EOD Chart.exe`
  - the local Electron fallback through `node_modules/electron/dist/electron.exe`
- launcher-path evidence confirms `Launch Portable EOD Chart.cmd` still updates `portable-data/logs/app-runtime.log`
- no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly

### Honest Validation Boundary
- build and startup level validation: complete
- full interactive visual/manual validation of the new chart tools: still not claimed in this pass

### What Intentionally Remains For A Later Chart-Tools Pass
- manual smoke validation of the new chart interactions inside the running app
- deeper advanced-tool UX polish
- stronger selected-drawing affordances and object-management UX
- optional drawing duplication or richer edit actions

### Documentation Updated
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `FILE_INVENTORY.md`
- `CHART_TOOLS_ADDITIONS_REPORT.md`

---

## Date: March 30, 2026

## Summary: Portable Windows Development Baseline For Daily-Use Tauri Workflow

### Goal
- Make the fresh Tauri shell comfortable and reliable as the main Windows portable development/runtime base
- Keep Electron intact as the fallback runtime
- Improve runtime-path clarity, logging, startup diagnostics, and the reproducibility of the portable daily-use workflow

### Files Added
- `src-tauri-shell/src/runtime.rs`
- `scripts/prepare-tauri-portable.ps1`
- `PORTABLE_WINDOWS_DEV_BASE_REPORT.md`

### Files Updated
- `package.json`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/database.rs`
- `src/types/electron.d.ts`
- `electron/ipc/handlers.ts`
- `src/store/chartStore.ts`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `RISK_REGISTER.md`
- `src-tauri-shell/README.md`

### What Changed
- Added `src-tauri-shell/src/runtime.rs` to centralize portable/system runtime-path resolution, runtime diagnostics, runtime log writing, and startup-error formatting
- Updated `src-tauri-shell/src/main.rs` to resolve runtime context on startup, initialize registry state early, log startup diagnostics, and show a user-facing startup error dialog if boot fails
- Updated `src-tauri-shell/src/database.rs` so registry storage now lives under `state/database-registry.json`, with migration support from the earlier root-level registry path
- Expanded the shared app-info contract so Electron fallback and Tauri portable mode can both surface runtime/build/path details through the existing renderer About flow
- Updated `src/store/chartStore.ts` so the About path now shows runtime mode, build profile, state path, and log path instead of a minimal runtime-only message
- Added `npm run tauri:portable:win` plus `scripts/prepare-tauri-portable.ps1` to build and stage `release/tauri-portable-win/EOD Chart Portable`
- The staged portable folder now includes:
  - `EOD Chart.exe`
  - `Launch Portable EOD Chart.cmd`
  - `portable-data/state`
  - `portable-data/logs`
  - `README.txt`
- Recorded the launcher-first portable workflow in the repo docs and shell README

### Portable Workflow Notes
- Supported staging command: `npm run tauri:portable:win`
- Supported entry point: `Launch Portable EOD Chart.cmd`
- Portable mode is guaranteed through the launcher because it sets `EOD_CHART_PORTABLE_ROOT`
- Direct launch of `EOD Chart.exe` is fallback-only and is not the primary portable guarantee
- Another Windows PC still needs Microsoft WebView2 Runtime available

### Validation
- `npm run build` passes
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes
- `npm run tauri:build` passes
- `npm run tauri:portable:win` passes
- `src-tauri-shell/target/release/eod-charting-platform-shell.exe` launches and exposes `EOD Chart`
- `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd` launches and exposes `EOD Chart`
- `release/tauri-portable-win/EOD Chart Portable/portable-data/logs/app-runtime.log` is created during portable launch
- `release/tauri-portable-win/EOD Chart Portable/portable-data/state/database-registry.json` is created during portable launch
- no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly

### What Intentionally Remains Outside This Pass
- installer-first hardening as the primary Windows workflow
- signed release readiness
- macOS packaging, signing, notarization, and runtime validation
- any broad UI redesign or new feature expansion

### Documentation Updated
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

---

## Date: March 28, 2026

## Summary: Phase 7 Mutation Parity And Windows Preview Re-Evaluation

### Goal
- Port the remaining Electron-only mutation flows into the fresh Tauri shell without breaking the renderer seam
- Re-run packaged Windows build/startup validation after widening the Tauri claim set
- Re-evaluate the cutover recommendation based on actual evidence rather than assumptions

### Files Added
- `PHASE7_MUTATION_PARITY_REPORT.md`

### Files Updated
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

### What Changed
- Updated `src/platform/tauriDesktop.ts` so Tauri now backs quote editor CRUD, merge-symbol flows, and corporate-action / identity-history mutations instead of rejecting them as Electron-only
- Extended `src-tauri-shell/src/database.rs` with Tauri-backed mutation commands for quote edits, merges, and corporate actions while preserving `db:changed` notifications
- Extended `src-tauri-shell/src/main.rs` so the fresh shell now registers the new mutation commands and forwards the related menu ids
- Updated `src/components/CommandPalette.tsx` so the formerly deferred mutation tools are now visible while running under Tauri
- Re-ran `npm run build`, `cargo check --manifest-path src-tauri-shell/Cargo.toml`, `npm run tauri:build`, and `npm run tauri:bundle:nsis`
- Revalidated bounded launch of packaged Electron and packaged Tauri Windows artifacts after the mutation-port pass
- Updated the parity matrix and tracking docs to reflect that the remaining blocker is now validation depth, not missing Tauri adapter coverage

### What Intentionally Remains Outside The Tauri Release Claim
- full packaged interactive parity across the total Tauri feature surface
- signed Windows release readiness
- macOS packaging, signing, notarization, and runtime validation
- default-runtime cutover authority

### Validation
- `npm run build` passes
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes
- `npm run tauri:build` passes
- `npm run tauri:bundle:nsis` passes
- bounded launch checks reconfirm:
  - `release/win-unpacked/EOD Chart.exe`
  - `release/EOD Chart Setup 0.1.0.exe`
  - `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
  - `src-tauri-shell/target/release/bundle/nsis/EOD Chart_0.1.0_x64-setup.exe`
- no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports
- full packaged interactive Tauri parity is still not claimed; the current recommendation is `Windows-preview-only`

### Documentation Updated
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

---

## Date: March 28, 2026

## Summary: Phase 6 Packaging Validation, Parity Matrix, And Cutover Rules

### Goal
- Validate packaged Electron and Tauri Windows behavior without changing runtime business logic
- Tighten exact parity and non-parity claims for the fresh Tauri shell
- Prepare Windows and macOS packaging notes plus explicit go/no-go cutover rules

### Files Added
- `PHASE6_PACKAGING_CUTOVER_REPORT.md`
- `PARITY_MATRIX_ELECTRON_VS_TAURI.md`

### Files Updated
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

### What Changed
- Added a validated `tauri:bundle:nsis` script so the fresh shell's Windows installer path can be reproduced without retyping the CLI command
- Verified the Electron fallback through `npm run dist:dev`, bounded launch of `release/win-unpacked/EOD Chart.exe`, `npm run dist:installer`, and bounded installer-start of `release/EOD Chart Setup 0.1.0.exe`
- Verified the fresh Tauri shell through `cargo check --manifest-path src-tauri-shell/Cargo.toml`, `npm run tauri:build`, bounded launch of `src-tauri-shell/target/release/eod-charting-platform-shell.exe`, `npm run tauri:bundle:nsis`, and bounded installer-start of `src-tauri-shell/target/release/bundle/nsis/EOD Chart_0.1.0_x64-setup.exe`
- Added a dedicated parity matrix and a packaging/cutover report that separate build verification, startup verification, and still-unvalidated interactive claims
- Recorded Windows packaging prerequisites, macOS signing/notarization blockers, cutover rules, and rollback rules in the new Phase 6 docs

### What Intentionally Remains Electron-Only
- quote editor CRUD
- merge symbols
- corporate-action / identity-history mutation flows
- full cutover authority for the default runtime

### Validation
- `npm run typecheck:renderer` passes
- `npm run build` passes and Electron remains intact
- `npm run dist:dev` passes and the unpacked Electron app starts with an `EOD Chart` window title
- `npm run dist:installer` passes and the Electron NSIS installer starts with an `EOD Chart Setup` window title
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes
- `npm run tauri:build` passes and the fresh Tauri release executable starts with an `EOD Chart` window title
- `npm run tauri:bundle:nsis` passes and the Tauri NSIS installer starts with an `EOD Chart Setup` window title
- no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports
- full interactive Tauri database/import/bhavcopy parity and macOS packaging/signing/notarization are still not claimed

### Documentation Updated
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

---

## Date: March 28, 2026

## Summary: Phase 5 Import, Bhavcopy, And Progress/Event Services Ported Behind The Platform Layer

### Goal
- Port CSV import, bhavcopy download, and long-running progress/event flows behind `src/platform/*`
- Keep `src/platform/*` as the only renderer-facing runtime seam
- Keep Electron intact as the fallback runtime
- Defer quote editing, merge-symbol, and corporate-action mutation flows to a later phase

### Files Added
- `src-tauri-shell/src/imports.rs`
- `src-tauri-shell/src/bhavcopy.rs`
- `PHASE5_IMPORT_BHAVCOPY_PROGRESS_REPORT.md`

### Files Updated
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/Cargo.lock`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/database.rs`
- `src/platform/tauriDesktop.ts`
- `src/components/CommandPalette.tsx`
- `src-tauri-shell/README.md`

### What Changed
- Added `src-tauri-shell/src/imports.rs` for CSV file picking, preview, import execution, and `import:progress` events
- Added `src-tauri-shell/src/bhavcopy.rs` for bhavcopy settings, single-date download, batch download, download logging, and `bhavcopy:progress` events
- Extended `src-tauri-shell/src/main.rs` so the fresh shell now registers Phase 5 commands and forwards `menu:importCsv` plus `menu:openBhavcopyWindow`
- Updated `src/platform/tauriDesktop.ts` so the Tauri business adapter now backs the Phase 5 import/download surface instead of rejecting it
- Updated `src/components/CommandPalette.tsx` so Import Data and Download Bhavcopy are available in Tauri while Quote Editor remains deferred

### What Intentionally Remains Electron-Only
- quote editor CRUD
- merge symbols
- corporate-action / identity-history mutation flows
- full interactive parity proof for Tauri import and bhavcopy flows

### Validation
- `npm run typecheck:renderer` passes
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes
- `npm run build` passes and Electron remains intact
- `npm run tauri:build` passes
- `src-tauri-shell/target/release/eod-charting-platform-shell.exe` launches and stays alive long enough to confirm the shell still opens after the Phase 5 work
- a bounded Electron fallback launch still stays alive long enough to confirm startup after the Phase 5 work
- no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports
- full interactive Tauri import/bhavcopy smoke validation is still not claimed in this phase

### Documentation Updated
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `RISK_REGISTER.md`
- `src-tauri-shell/README.md`
- `PHASE5_IMPORT_BHAVCOPY_PROGRESS_REPORT.md`

---

## Date: March 28, 2026

## Summary: Phase 4 Database And Persistence Services Ported Behind The Platform Layer

### Goal
- Port the database/persistence subset needed for startup, workspace continuity, symbol navigation, and watchlist/layout persistence into the fresh Tauri shell
- Keep `src/platform/*` as the only renderer-facing runtime seam
- Keep Electron intact as the fallback runtime
- Defer quote editing, merge/corporate-action writes, CSV import, bhavcopy, and worker/event parity to Phase 5+

### Files Added
- `src/platform/tauriDesktop.ts`
- `src-tauri-shell/src/database.rs`
- `PHASE4_DATABASE_PERSISTENCE_REPORT.md`

### Files Updated
- `src/platform/desktop.ts`
- `src/store/chartStore.ts`
- `src/components/CommandPalette.tsx`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/Cargo.lock`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/README.md`

### What Changed
- Added a Tauri-backed business adapter in `src/platform/tauriDesktop.ts`
- Updated `src/platform/desktop.ts` so the business bridge now resolves Electron first and then the Tauri persistence adapter
- Added `src-tauri-shell/src/database.rs` with:
  - recent-database registry handling
  - create/open/activate/close/delete database lifecycle
  - SQLite migrations/defaults
  - settings and saved-layout persistence
  - symbol list/search reads
  - EOD history and event-marker reads
  - watchlist CRUD
- Extended `src-tauri-shell/src/main.rs` so the fresh shell registers the new persistence commands and emits database menu commands for create/open/close/delete
- Updated `src/store/chartStore.ts` so the shell bridge now handles the new database menu command ids
- Updated the About toast language to be runtime-neutral
- Updated `src/components/CommandPalette.tsx` so Electron-only Phase 5 tools are not exposed when the runtime is Tauri

### What Intentionally Remains Electron-Only
- quote editor CRUD
- merge symbols
- corporate-action / identity-history writes
- CSV preview/import
- bhavcopy download/import
- worker/event parity for long-running jobs

### Validation
- `npm run typecheck:renderer` passes
- `npm run build` passes and Electron remains intact
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes
- `npm run tauri:build` passes
- `src-tauri-shell/target/release/eod-charting-platform-shell.exe` launches and stays alive long enough to confirm the shell still opens after the Phase 4 persistence work
- No active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly; the old legacy files `src/app.js` and `src/modules/*` still contain historical Tauri imports
- Full interactive Tauri database workflow smoke validation is still not claimed in this phase

### Documentation Updated
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `RISK_REGISTER.md`
- `src-tauri-shell/README.md`
- `PHASE4_DATABASE_PERSISTENCE_REPORT.md`

---

## Date: March 28, 2026

## Summary: Phase 3 Low-Risk Runtime Services Dual-Wired Behind The Platform Layer

### Goal
- Add low-risk dual-runtime shell services without porting business-critical backend flows yet
- Keep `src/platform/*` as the only renderer-facing runtime seam
- Keep Electron fully intact while letting the fresh Tauri shell participate in menu/app-metadata/external-link flows

### Services Added
- App metadata/version access through `getAppInfo()`
- External URL opening through `openExternal(url)`
- Runtime detection and shell capability reporting through `src/platform/shell.ts`
- Menu command subscriptions that work through Electron preload or Tauri event wiring
- A low-risk About action in the renderer that now reports runtime and backend availability

### Files Added
- `src/platform/shell.ts`
- `src-tauri-shell/Cargo.lock`
- `PHASE3_LOW_RISK_RUNTIME_SERVICES_REPORT.md`

### Files Updated
- `package.json`
- `package-lock.json`
- `src/platform/types.ts`
- `src/platform/desktop.ts`
- `src/platform/index.ts`
- `src/store/chartStore.ts`
- `src/types/electron.d.ts`
- `electron/preload.ts`
- `electron/ipc/handlers.ts`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/capabilities/default.json`
- `src-tauri-shell/README.md`

### What Changed
- Split the platform bridge more clearly:
  - `src/platform/desktop.ts` remains the Electron-backed business-service adapter
  - `src/platform/shell.ts` now owns low-risk dual-runtime shell helpers
- Added Electron shell IPC handlers for:
  - `shell:getAppInfo`
  - `shell:openExternal`
- Added fresh Tauri shell commands for:
  - `get_app_info`
  - `open_external`
- Added Tauri native menu wiring that emits existing renderer-friendly command ids through `menu:command`
- Updated `src/store/chartStore.ts` so menu command registration is shell-driven and can function even when no business backend is available
- Preserved the existing Electron-backed database/import/bhavcopy/layout/watchlist behavior by design

### Validation
- `npm run build` passes and Electron remains intact
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes
- `npm run tauri:build` passes
- `src-tauri-shell/target/release/eod-charting-platform-shell.exe` launches and opens an `EOD Chart` window after the Phase 3 changes
- A bounded `npm run tauri:dev` re-check again reached Vite dev-server readiness, but full debug shell/window launch is still not claimed
- No active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly; the old legacy files `src/app.js` and `src/modules/*` still contain historical Tauri imports
- Direct `window.electronAPI` usage remains isolated to the platform layer

### Documentation Updated
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `src-tauri-shell/README.md`
- `PHASE3_LOW_RISK_RUNTIME_SERVICES_REPORT.md`

---

## Date: March 28, 2026

## Summary: Phase 2 Fresh Tauri Shell Added Alongside Electron

### Goal
- Add a clean Tauri 2 shell for the active React + Vite + TypeScript frontend
- Keep Electron intact as the working fallback runtime
- Avoid reusing the legacy `src-tauri` backend as the migration baseline

### Legacy Tauri Handling
- Left the existing `src-tauri` tree untouched as legacy/disconnected reference
- Added a separate fresh shell path at `src-tauri-shell`
- Kept new Tauri scripts anchored to `src-tauri-shell` so the CLI does not accidentally build the legacy crate

### Files Added
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/build.rs`
- `src-tauri-shell/tauri.conf.json`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/capabilities/default.json`
- `src-tauri-shell/icons/icon.ico`
- `src-tauri-shell/icons/icon.icns`
- `src-tauri-shell/icons/icon.png`
- `src-tauri-shell/icons/128x128.png`
- `src-tauri-shell/README.md`
- `PHASE2_TAURI_SHELL_REPORT.md`

### Files Updated
- `package.json`
- `package-lock.json`
- `.gitignore`
- `vite.config.ts`

### What The Fresh Shell Does
- Uses the existing frontend dev server at `http://localhost:5173` in development
- Uses the existing `dist` output in production
- Builds from `src-tauri-shell` instead of the legacy `src-tauri` path
- Opens a native `EOD Chart` window without porting database/import/bhavcopy business logic yet

### Validation
- `npm run build` passes and Electron remains intact
- `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes
- `npm run tauri:build` passes
- `src-tauri-shell/target/release/eod-charting-platform-shell.exe` launches and opens an `EOD Chart` window
- A bounded `npm run tauri:dev` check reached Vite dev-server readiness, but first-run debug compilation did not complete within the bounded validation window, so full dev-mode shell launch is still not claimed
- No active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly; the old legacy files `src/app.js` and `src/modules/*` still contain historical Tauri imports

### Documentation Updated
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `PHASE2_TAURI_SHELL_REPORT.md`

---

## Date: March 28, 2026

## Summary: Phase 1 Desktop Abstraction Added For Future Tauri Migration

### Goal
- Prepare the active Electron renderer for a later Tauri 2 migration without changing the runtime in this phase
- Reduce direct renderer coupling to `window.electronAPI`
- Keep the current Electron behavior stable while creating a clean runtime seam

### Files Added
- `src/platform/types.ts`
- `src/platform/desktop.ts`
- `src/platform/index.ts`
- `PHASE1_DESKTOP_ABSTRACTION_REPORT.md`

### Renderer Refactor
- Added a typed desktop abstraction in `src/platform/*` that exposes only the Electron-backed APIs the active renderer actually uses
- Moved renderer access toward `getDesktopApi()` so future runtime swapping can happen behind one module
- Refactored the active renderer call sites in:
  - `src/store/chartStore.ts`
  - `src/components/ImportCsvDialog.tsx`
  - `src/components/DatabaseToolsDialogs.tsx`
  - `src/components/LayoutManagerDialog.tsx`
  - `src/components/DeleteDatabaseDialog.tsx`
  - `src/components/BhavcopyDownloadWindow.tsx`
- Updated renderer type-only imports in:
  - `src/components/ChartCanvas.tsx`
  - `src/components/Sidebar.tsx`
  - `src/components/CommandPalette.tsx`

### Result
- Active renderer code no longer references `window.electronAPI` directly outside `src/platform/desktop.ts`
- `src/types/electron.d.ts` remains as the Electron compatibility contract for now
- Electron remains the runtime; no Tauri or Rust migration was started in this phase

### Verification
- `npm run typecheck:renderer` passes
- `npm run typecheck:electron` passes
- `npm run build` passes
- Electron runtime smoke launch still reaches app startup, window creation, and renderer load
- The data-driven portion of `scripts/runtime-smoke-check.js` could not finish because the fixture file `D:\TA Projects\EOD Downloader\output\NSE\EQ\19941103.csv` was missing on this machine

### Documentation Updated
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `PHASE1_DESKTOP_ABSTRACTION_REPORT.md`

---

## Date: March 28, 2026

## Summary: Fixed NSE Index Bhavcopy Parsing in Electron App

### Problem
- NSE equity bhavcopy downloads were working, but NSE index downloads were returning zero usable rows
- The live NSE index archive uses headers like `Index Name` and `Open Index Value`
- `electron/bhavcopy.ts` was looking for literal underscore-style names like `INDEX_NAME`, so the parser never found the symbol or OHLC columns
- Existing `download_log` rows with status `ok` could also cause future runs to be skipped and shown as `0 rows`, even when the actual price rows were missing

### Root Cause
- Header matching in the Electron bhavcopy importer was too strict
- Row parsing also relied on a naive `split(',')` path instead of a CSV-safe parser
- Index-symbol fallback logic diverged from the working Go downloader in `D:\\TA Projects\\EOD Downloader\\internal\\nseindex\\downloader.go`
- The skip logic trusted `download_log` alone instead of validating that `eod_prices` still contained imported rows for that exchange/date

### Solution
- Added CSV header normalization in `electron/bhavcopy.ts` so `Index Name` correctly maps to `INDEX_NAME`
- Replaced the row value extraction path with quote-aware CSV line splitting
- Ported the NSE index symbol normalization approach from the Go downloader
- Skipped non-chartable NSE index rows that have missing OHLC values such as `-`
- Preserved raw index names when inserting instruments so search/display stays readable
- Hardened the batch/single-download skip path so stale `download_log` entries are cleared and the data is re-downloaded when no matching `eod_prices` rows exist
- Improved the bhavcopy window log output so `Already downloaded` is shown as a warning instead of a misleading `0 rows` success line
- Restyled the bhavcopy log panel in `src/components/BhavcopyDownloadWindow.tsx` to follow the downloader app pattern more closely:
  activity-log header, progress bar, success/skip/fail counters, and plain text log lines
- Added explicit NSE / NSE Index holiday handling for calendar years 2025 and 2026, including the January 15, 2026 Maharashtra municipal-election closure announced in NSE circular `NSE/CMTR/72260`
- Kept Muhurat Trading dates out of the skip list so October 21, 2025 remains downloadable
- Hardened CSV date validation so the importer now parses live `DATE1` / `Index Date` values like `21-Oct-2025` and `21-10-2025`
- Rejected archive responses whose internal trade date does not match the requested date, preventing holiday URLs from silently storing the previous session under the wrong day

### Verification
- `npm run typecheck:electron` passes
- `npm run build:electron` passes
- `npm run typecheck:renderer` passes
- Live archive check on `https://nsearchives.nseindia.com/content/indices/ind_close_all_27032026.csv` now resolves chartable rows instead of zero
- Sample verified symbols include `NIFTY`, `BANKNIFTY`, `NIFTYNEXT50`, `NIFTY100`, `NIFTY200`, and `SMALLCAP100`
- Real Electron backend smoke test against a fresh throwaway database imported 130 `NSE_INDEX` rows for March 27, 2026
- Post-import query verification confirmed `NIFTY` OHLCV data is retrievable from the database after the download
- Stale-log regression test passed: a fake `download_log` success row with zero imported prices was ignored, the archive was re-downloaded, and 130 `NSE_INDEX` rows were inserted for March 27, 2026
- Electron desktop app startup smoke test passed; the app remained running through startup and did not exit early
- Holiday/date-mismatch smoke test passed:
  `2025-10-21` imported normally for both `NSE` and `NSE_INDEX`, `2025-10-22` was skipped as `Exchange holiday (Diwali-Balipratipada)`, and zero rows were written under `2025-10-22`
- Existing bad holiday imports were cleaned from the local database `EOD DATABASE/NSE/market-data.sqlite3`
- Removed invalid `NSE` rows from `2025-10-22`, `2025-11-05`, `2026-01-15`, `2026-01-26`, `2026-03-03`, and `2026-03-26`
- Cleanup deleted 17,909 bad price rows and 6 matching `download_log` entries, and a pre-cleanup backup was created at `backups/market-data-before-holiday-cleanup-2026-03-28T05-39-50-751Z.sqlite3`

### Chart UI Refresh
- Reworked the main chart shell so the app reads more like a TradingView/AmiBroker hybrid instead of a plain canvas embed
- Reintroduced the chart chrome in `src/RootApp.tsx` so the live workspace now renders the chart header, toolbar, and OHLC strip above the canvas again
- Replaced the older header treatment in `src/components/ChartHeader.tsx` with a denser terminal-style header:
  symbol/exchange identity, last price, change, OHLC, volume, date, and timeframe controls
- Updated `src/components/ChartCanvas.tsx` to present the chart inside a bordered chart card with a clearer control rail and visible date-range readout
- Added CSS variable compatibility aliases in `src/styles.css` so older inline styles resolve correctly instead of silently falling back

### Date Axis / Time Readability Fix
- Enlarged the X-axis and right-axis gutters in the chart engine
- Reworked X-axis tick generation in `src/engine/ScaleManager.ts` so labels adapt to zoom level and show readable dates like `14 Mar`, `Mar 2025`, and `Mar '26`
- Added vertical time-grid guides in `src/engine/Renderer.ts` and wired them into `src/engine/ChartEngine.ts` so the time axis has visible structure
- Strengthened axis colors and label backgrounds in `src/engine/types.ts`
- Updated crosshair date rendering in `src/engine/Crosshair.ts` so the bottom label uses a full formatted date and remains legible on dark backgrounds

### Additional Verification
- `npm run build` passes after the chart-shell and date-axis refresh
- Electron desktop app startup smoke test passed again after the chart UI changes

### Bhavcopy Freeze / Not-Responding Fix
- Reduced bhavcopy progress event pressure so the main process no longer pushes every task update to the renderer at full speed
- Stopped the bhavcopy dialog from appending a log line for every per-file progress event; the status bar still updates, but the log now keeps only high-level progress plus final per-date results
- Replaced smooth auto-scroll in the activity log with direct scroll-to-bottom behavior to avoid renderer jank during long runs
- Disabled production bhavcopy debug-file dumping unless `EOD_BHAVCOPY_DEBUG=1` is explicitly set, removing unnecessary synchronous disk I/O during large downloads
- Added a tiny event-loop yield between worker batches so Electron can service window messages more consistently during long batch imports

### Freeze-Fix Verification
- `npm run typecheck:renderer` passes after the bhavcopy freeze fix
- `npm run typecheck:electron` passes after the bhavcopy freeze fix
- `npm run build` passes after the bhavcopy freeze fix

---

## Date: March 27, 2026 (Later Night - Second Fix)

## Summary: Fixed NSE Index Bhavcopy Download (v2)

### Problem
- First fix using `net.request()` still failing - all 62 dates failed
- EOD Downloader (Go) works perfectly with same URL
- Root cause: `net.request()` not properly handling cookies through session

### Solution
Replaced `net.request()` with `session.defaultSession.fetch()`:
- Uses modern Electron 31+ fetch API
- Properly handles cookies through session like a browser
- Matches EOD Downloader's headers exactly

### Changes Made

#### electron/bhavcopy.ts
- **Removed**: `getSharedAxiosInstance()`, `net.request()` approach
- **Added**: `DEFAULT_HEADERS` with EOD Downloader's exact headers
  - User-Agent: Chrome/133.0.0.0 (updated from 120)
  - Accept: `text/html,application/xhtml+xml,application/xml;q=0.9,text/csv,application/zip,*/*;q=0.8`
  - Accept-Language: `en-US,en;q=0.9`
- **Added**: `fetchWithCookies()` using `session.defaultSession.fetch()`
- **Added**: `fetchWithRetry()` with 3 retries and exponential backoff
- **Added**: `isRetryable()` for 403, 429, 500+ errors
- Updated `warmSession()` and `downloadSingle()` to use new functions
- Removed redundant headers in `downloadBhavcopyBatch()` and `downloadSingle()`

### Key Difference from Before
| Before | After |
|--------|-------|
| `net.request()` | `session.defaultSession.fetch()` |
| User-Agent Chrome/120 | User-Agent Chrome/133 |
| Missing Accept-Language | Added Accept-Language |
| No retry logic | 3 retries with exponential backoff |
| No retryable error handling | Retry on 403, 429, 5xx |

---

## Date: March 27, 2026 (Late Night)

## Summary: Layout Manager + Bug Fixes

---

## Bug Fix: Instruments Table Empty ✅

### Problem
- Database had 184,135 price rows but 0 instruments
- Sidebar showed "0 symbols" even after downloading bhavcopy

### Solution
1. **electron/bhavcopy.ts**: Added instrument insertion during bhavcopy download
2. **electron/db.ts**: Added migration to populate instruments from existing eod_prices table
3. Database now shows **3198 instruments**

---

## New Feature: Copy Log Button ✅

### BhavcopyDownloadWindow.tsx
- Added "Copy Log" button to log header
- Copies all log entries to clipboard
- Shows "✓ Copied" feedback

---

## Layout Manager Feature ✅

### Overview
- **Chart Layouts** menu item in Chart menu
- Save current chart workspace (tabs, symbols, indicators, drawings, viewport)
- Load saved layouts to restore workspace
- Delete unwanted layouts

### How to Use
1. Go to **Chart → Chart Layouts**
2. Enter a name and click **Save** to save current workspace
3. Click **Load** on any saved layout to restore it
4. Click **Delete** to remove a layout

### Files Modified

#### src/store/chartStore.ts
- Added `layoutManagerDialogOpen` state
- Added `openLayoutManagerDialog()` and `closeLayoutManagerDialog()` functions
- Added `loadWorkspaceFromLayout(layoutData)` function - parses and applies saved layout to chart store
- Added menu command handler for `menu:openLayoutManager`

#### src/components/LayoutManagerDialog.tsx
- Wired up `loadWorkspaceFromLayout` to actually apply saved layout when loading

#### src/RootApp.tsx
- Added `LayoutManagerDialog` to render when dialog is open
- Added state and close handler for layout manager dialog

#### electron/menuBar.ts
- Added "Chart Layouts" menu item in Chart menu

---

## Date: March 27, 2026 (Night)

## Summary: Amibroker-Style Features Added
- **Arrow Key Navigation**: Up/Down arrows change symbols in chart (like Amibroker)
- **Amibroker-Style Chart Header**: Shows symbol, exchange, LTP, change, OHLC, volume, timeframe
- **Quick Symbol Search (Ctrl+K)**: Type to search symbols or commands, Arrow keys to navigate, Enter to select
- Removed Database panel from Sidebar
- Added Delete Database dialog
- Fixed various issues

---

## New Features

### 1. Arrow Key Symbol Navigation ✅
- **How it works**: When chart is focused, press Up/Down arrows to navigate through watchlist
- **Behavior**: Cycles through symbols in the selected watchlist
- **Use case**: Quickly scan through multiple symbols without mouse

### 2. Amibroker-Style Chart Header (ChartHeader.tsx) ✅
- **New component** replacing old OHLCV bar
- Shows:
  - Symbol name and exchange
  - Company name (if available)
  - LTP (Last Traded Price) with color (green/red)
  - Change (absolute and percentage) with ▲/▼ indicator
  - OHLC values (Open, High, Low, Close)
  - Volume with Indian format (Cr/L/K)
  - Timeframe selector (D/W/M)
  - Current date

### 3. Quick Symbol Search (Ctrl+K) ✅
- **Enhanced CommandPalette** now works as symbol search
- Press `Ctrl+K` to open
- Type to search:
  - Symbols (from database)
  - Commands (menu actions)
- Arrow keys to navigate results
- Enter to select and load
- Escape to close
- Shows symbols first, then commands

### 4. Delete Database Dialog ✅
- New modal dialog for deleting databases
- Checkbox selection for multiple databases
- Requires typing "DELETE" to confirm
- Permanent data deletion warning

---

## Files Modified/Created

### src/components/ChartHeader.tsx (NEW)
- Amibroker-style chart header component
- Shows symbol, exchange, LTP, change, OHLC, volume, timeframe
- Timeframe selector buttons (D/W/M)

### src/components/CommandPalette.tsx (ENHANCED)
- Now searches both symbols and commands
- Shows symbols first in results
- Arrow key navigation
- Enter to select
- Enhanced UI with icons

### src/store/chartStore.ts
- **Added** `navigateSymbol()` function - navigates to next/previous symbol in watchlist
- **Fixed** `createWatchlist()` - shows error if no database open

### src/components/Sidebar.tsx
- Removed Database panel
- Fixed symbol list scroll

### src/components/DeleteDatabaseDialog.tsx (NEW)
- Modal dialog for deleting databases

### src/RootApp.tsx
- Added ChartHeader component

---

## Files Modified/Created

### src/components/Sidebar.tsx
- **Removed Database panel** - Database options now only in Menu Bar (Database → New/Open/Close/Delete)
- **Removed** `database` from `SIDEBAR_PANELS` array
- **Removed** database-related imports: `createDatabaseInteractive`, `openDatabaseInteractive`, `activateDatabasePath`, `closeDatabase`
- **Removed** database-related styles: `databaseButtonGridStyle`, `databaseStatsStyle`
- **Fixed** symbol list scroll - Added `flex: 1` and `overflow: hidden` to `contentStyle`

### src/components/DeleteDatabaseDialog.tsx (NEW)
- Modal dialog for deleting databases
- Lists all known databases with checkboxes for selection
- Requires typing "DELETE" to confirm deletion
- Shows warning about permanent data loss
- Deletes selected databases and their folders
- Updates registry and refreshes snapshot

### electron/db.ts
- **Added** `deleteDatabase()` function - Deletes database folder and removes from registry
- Handles closing active database if currently open
- Removes from recent databases list in registry

### electron/ipc/handlers.ts
- **Added** `db:delete` IPC handler for deleting databases
- Imported `deleteDatabase` from db.ts

### electron/menuBar.ts
- **Added** "Delete Database" menu item under Database menu
- Separator added before and after for clarity

### src/store/chartStore.ts
- **Added** `deleteDatabaseDialogOpen` state for Delete Database dialog
- **Added** `openDeleteDatabaseDialog()` action
- **Added** `closeDeleteDatabaseDialog()` action
- **Added** `menu:openDeleteDatabase` command handler
- **Fixed** `createWatchlist()` - Now shows alert if no database is open

### src/RootApp.tsx
- **Added** `DeleteDatabaseDialog` import
- **Added** state for delete database dialog
- **Added** conditional rendering for DeleteDatabaseDialog

### src/types/electron.d.ts
- **Added** `deleteDatabase()` to ElectronAPI interface

### electron/preload.ts
- **Added** `deleteDatabase` function to electronAPI

### src/components/BhavcopyDownloadWindow.tsx (COMPLETELY REWRITTEN)
- **New Features:**
  - Exchange selection with checkboxes: NSE Equity, BSE Equity, NSE Index, BSE Index
  - Date range: Start Date and End Date inputs (default: last 30 days)
  - Workers input: Number of parallel downloads (1-10, default: 2)
  - Series filter: Add/remove excluded series for NSE Equity
  - Default excluded series: GS, GB, GF, GT, GBD, GBI, GSD, GSI
  - Results summary showing success/failed counts and total rows
  - Two-panel layout: Configuration on left, Log on right
  - **Settings auto-save**: Exchanges, workers, and excluded series are saved automatically
  - **Settings auto-load**: Settings are loaded when window opens
  - "Settings auto-saved" badge in header to indicate persistence

### electron/bhavcopy.ts (COMPLETELY REWRITTEN)
- **New Functions:**
  - `downloadBhavcopyBatch()`: Batch download with worker pool
  - `generateTradingDays()`: Generate list of trading days (excludes weekends)
  - `generateNseCandidates()`: 4 fallback URLs for NSE Equity
  - `generateBseCandidates()`: 2 URLs for BSE Equity
  - `generateNseIndexCandidates()`: URL for NSE Index
  - `generateBseIndexCandidates()`: URL for BSE Index
  - `downloadSingle()`: Download single exchange/date with retries
  - `parseAndInsert()`: Parse CSV with flexible column handling
  - `warmSession()`: Warm up NSE/BSE session for cookies
  - **`loadBhavcopySettings()`**: Load saved settings from database
  - **`saveBhavcopySettings()`**: Save settings to database
  - `BhavcopySettings` interface for settings storage

---

## User Requests Addressed

### 1. Remove database from Sidebar ✅
- Database panel removed from Sidebar
- All database operations now in Menu Bar (Database → New/Open/Close/Delete)

### 2. Delete Database with checkbox selection ✅
- New "Delete Database" option in Menu Bar
- Modal dialog shows all known databases
- Select multiple databases via checkboxes
- Must type "DELETE" to confirm
- Permanently removes database folder and registry entry

### 3. Multiple databases at same time ❌
- **Not implemented** - Current architecture uses single active database
- **Suggestion**: You can switch between databases quickly via Menu Bar
- Each database stores NSE, BSE data separately

### 4. Symbol list scroll limit ✅
- Fixed height constraint issue
- Symbol list now scrolls properly showing all symbols
- Added `flex: 1` and `overflow: hidden` to sidebar content area

### 5. Watchlist "New" button not working ✅
- Fixed - Now shows alert if no database is open
- Requires open database before creating watchlist
- Creates watchlist with trimmed name

---

## Features

### Supported
- **NSE Equity Bhavcopy** - Download with series filtering
- **BSE Equity Bhavcopy** - Download
- **NSE Index Bhavcopy** - Download index data
- **BSE Index Bhavcopy** - Download index data
- Date range selection (trading days only)
- Parallel downloads with configurable workers
- Series exclusion filter (e.g., exclude GS, GB, etc.)
- **Database Management** - Create, Open, Close, Delete
- CSV/TXT import for historical data
- Interactive price chart with OHLCV bars
- Technical indicators (SMA, EMA, Bollinger, RSI, MACD, etc.)
- Drawing tools (trendlines, horizontal lines, fibonacci, etc.)
- Multiple chart tabs
- Watchlists (with persistence)
- Quote editor
- Symbol merge
- Corporate actions processing

### NOT Supported (This Model Does Not Support Image Input)
- Image input/processing (cannot read image.png or any image files)
- Image-based chart analysis
- Screenshots/chart exports to image analysis
- Logo/icon customization via images
- Background images on charts

### Known Limitations
- NSE website may block downloads during market hours
- Weekend/holiday dates will be skipped automatically
- Requires open database before downloading
- BSE Index may not be available for all dates
- Single database at a time (no simultaneous multiple databases)

---

## Dependencies
- adm-zip (for better ZIP extraction)

---

## Previous Changes (March 27, 2026 - Morning)

### electron/bhavcopy.ts (Original Implementation)
- Implemented full bhavcopy download functionality
- Session warming, ZIP extraction, CSV parsing
- Transactional database inserts

### electron/csvImporter.ts
- Fixed TypeScript compatibility issues with `replaceAll` method

### tsconfig.electron.json
- Added DOM to lib array

---

## Backup
Backups created in backups/ folder with timestamps:
- backups/20260322-093921-pre-corporate-actions/
- backups/pre_opencode_changes_20260326_015841/
- backups/pre_opencode_changes_20260326_152215/
