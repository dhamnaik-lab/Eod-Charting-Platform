# Current Architecture and Project Structure - EOD Charting Platform

Date: 2026-04-22

This file describes the current live architecture of the repository so future work can extend it safely without forcing a broad restructure.

## 1. Runtime Boundary

The app is now Tauri-only.

Active backend:

- `src-tauri-shell/`

Active renderer/runtime seam:

- `src/platform/desktop.ts`
- `src/platform/tauriDesktop.ts`
- `src/platform/shell.ts`
- `src/platform/types.ts`
- `src/types/desktop.ts`

Rules:

- renderer files outside `src/platform/*` must not import `@tauri-apps/*` directly
- no Electron runtime path exists anymore
- `scripts/` must stay free of Electron-only smoke harnesses that target deleted `dist-electron/*` output
- `tsconfig.json` should reflect the active renderer tree only and must not carry stale Electron exclusions
- `resources/release/` must not be used as a retained Electron packaging baseline; Electron installer/unpacked outputs have been removed from the live repo state
- `mockup/` is a static design-reference area for chart UI review and must not be treated as active runtime code
- generated artifact folders such as `src-tauri-shell/target/`, `analysis/`, and `test-output/` are non-active and may be absent or empty in a cleaned workspace
- the removed `src-tauri` tree must not be recreated or treated as active

## 2. Current Top-Level Structure

```text
EOD Charting Platform/
|-- src/
|   |-- components/
|   |-- engine/
|   |-- features/
|   |   |-- app/
|   |   |-- charts/
|   |   |-- watchlists/
|   |   |   `-- __tests__/
|   |   `-- workspace/
|   |-- modules/
|   |   `-- formulaEngine/
|   |-- platform/
|   |-- store/
|   |-- types/
|   `-- ...
|-- vitest.config.ts
|-- src-tauri-shell/
|   |-- src/
|   |-- capabilities/
|   `-- ...
|-- scripts/
|-- backups/
|-- mockup/
|-- dist/
|-- release/
`-- resources/
```

## 3. Frontend Responsibilities

The frontend currently owns:

- app shell and layout
- sidebar
- chart tabs
- Sheets
- dialog rendering
- chart engine rendering and interaction
- local orchestration for watchlists, indicators, drawings, and session behavior

Important files:

- `src/RootApp.tsx`
- `src/components/Sidebar.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartDrawingContextMenu.tsx`
- `src/components/ChartDrawingPropertiesDialog.tsx`
- `src/components/ChartPaneControlsOverlay.tsx`
- `src/components/ChartHeader.tsx`
- `src/components/Toolbar.tsx`
- `src/components/CustomFormulaDialog.tsx`
- `src/components/SheetTabs.tsx`

`ChartCanvas.tsx` now delegates the drawing context menu to `src/components/ChartDrawingContextMenu.tsx`, the drawing-properties modal UI to `src/components/ChartDrawingPropertiesDialog.tsx`, and the pane-controls overlay to `src/components/ChartPaneControlsOverlay.tsx` while retaining the engine bridge and scrollbar/viewport coordination.
`RootApp.tsx` now lazy-mounts optional dialogs/windows so bhavcopy, import, layout, watchlist, and database utility surfaces stay out of the startup renderer path until opened.

## 4. Chart Engine Responsibilities

The chart engine is still TypeScript-based and should remain so unless a task explicitly requires otherwise.

Core files:

- `src/engine/ChartEngine.ts`
- `src/engine/Renderer.ts`
- `src/engine/ScaleManager.ts`
- `src/engine/Crosshair.ts`
- `src/engine/Indicators.ts`

The chart engine currently owns:

- canvas rendering
- viewport math
- zoom/pan
- pane-aware drawing placement and editing
- dynamic right-axis width coordination
- live indicator readouts and indicator axis tags
- render-time evaluation of persisted custom formula studies through `src/engine/Indicators.ts`

## 5. Frontend State Structure

Current state is split like this:

### `src/store/uiStore.ts`

Owns:

- shell visibility flags
- command palette
- import/layout/watchlist utility dialogs
- drawing-tool state
- magnet state
- drawing-properties request state

### `src/store/workspaceStore.ts`

Owns:

- persisted sidebar width
- sidebar collapsed state
- sidebar pinned state

### `src/store/chartStore.ts`

Still owns:

- store-level action wiring over extracted helpers/controllers
- autosave scheduling and subscription glue
- the exported `getActiveChartTab(...)` selector helper

Blank-tab creation, workspace reset, and create/activate/close tab state helpers now live in `src/features/charts/chartTabWorkspaceService.ts`.
Tab/session controller flows for layout mode, sheet save/load/delete/rename, adjusted-mode retune scheduling, create/activate/close tab orchestration, and layout restore now live in `src/features/charts/chartTabSessionController.ts`.
Instrument loading, EOD cache handling, compare-overlay hydration wrapping, and load/hydration failure builders now live in `src/features/charts/chartInstrumentHydrationService.ts`.
Direct instrument-load / compare-overlay orchestration now lives in `src/features/charts/chartInstrumentCompareController.ts`.
Symbol search and symbol-browser request/result shaping now live in `src/features/charts/chartSymbolSearchService.ts`.
Search query and symbol-browser controller wiring now lives in `src/features/charts/chartSearchController.ts`.
Sheet/workspace state builders, persisted chart-tab restoration, and sheet save/load/delete/rename state builders now live in `src/features/charts/chartSheetWorkspaceService.ts`.
Indicator pane/layout helpers now live in `src/features/charts/chartIndicatorPaneService.ts`.
Pure chart-tab viewport/display/pane/indicator/drawing mutation helpers now live in `src/features/charts/chartTabStateMutationService.ts`.
Watchlist CRUD/add-remove refresh flows plus official watchlist import/update/update-all orchestration now live in `src/features/watchlists/watchlistOrchestrationService.ts`.
Selected-watchlist lookup plus watchlist-based previous/next navigation target resolution now live in `src/features/watchlists/watchlistNavigationService.ts`.
Watchlist store wiring now lives in `src/features/watchlists/watchlistStoreController.ts`.
Snapshot apply, persisted workspace restore, and tab rehydration coordination now live in `src/features/workspace/chartSnapshotHydrationService.ts`.
Init, snapshot refresh, listener registration, and bhavcopy download refresh orchestration now live in `src/features/workspace/chartRuntimeController.ts`.
The controlled custom formula parser/evaluator now lives in `src/modules/formulaEngine/customFormulaEngine.ts`, while creation/update UI lives in `src/components/CustomFormulaDialog.tsx`.

`chartStore.ts` is no longer the main frontend hotspot; `ChartCanvas.tsx` is now the largest remaining frontend file.

## 6. Feature Service / Persistence Seams

Current feature-level seams:

### App

- `src/features/app/menuCommandRouter.ts` - native menu command dispatch table

### Charts

- `src/features/charts/chartDataUtils.ts` - pure chart data helpers (`toBar`, `aggregateBars`, `createDefaultViewport`, `fitViewportToBarCount`, `appendIndicator`)
- `src/features/charts/compareOverlayService.ts` - compare-overlay helper/service seam (`isSameInstrumentKey`, overlay color selection, cached overlay loading, persisted overlay hydration, timeframe reaggregation)
- `src/features/charts/chartTabWorkspaceService.ts` - chart-tab/workspace helper seam (blank tab creation, workspace reset, create/activate/close tab state builders, activated-tab hydration decision)
- `src/features/charts/chartInstrumentHydrationService.ts` - instrument loading/hydration seam (EOD cache helpers, instrument result fetching, compare-overlay hydration wrapper, EOD-to-tab adaptation, load/hydration failure builders)
- `src/features/charts/chartSymbolSearchService.ts` - symbol search/browser seam (empty search/browser state builders, chart symbol search wrapper, symbol-browser result shaping, active-database request tagging)
- `src/features/charts/chartSheetWorkspaceService.ts` - sheet/workspace seam (future-margin mode normalization, persisted chart-tab restoration, plain-candle sheet workspace builders, sheet save/load/delete/rename state builders)
- `src/features/charts/chartIndicatorPaneService.ts` - indicator pane/layout seam (pane-height normalization, pane id derivation, collapsed/scale override pruning, pane-indicator add/reorder helpers)
- `src/features/charts/chartTabStateMutationService.ts` - pure chart-tab mutation seam (timeframe/viewport/display-flag helpers, pane height/collapse/scale mutations, indicator mutations, drawing mutations)
- `src/features/charts/chartTabSessionController.ts` - chart-tab/session orchestration seam (layout mode, sheet save/load/delete/rename flows, adjusted-mode retune scheduling, create/activate/close tab orchestration, layout restore)
- `src/features/charts/chartSearchController.ts` - chart search/browser controller seam (query state wiring, search dispatch, symbol-browser refresh, empty-state handling)
- `src/features/charts/chartInstrumentCompareController.ts` - chart instrument/compare controller seam (direct instrument load, watchlist navigation dispatch, compare add/remove/load orchestration)
- `src/modules/formulaEngine/customFormulaEngine.ts` - controlled custom-formula seam (tokenization, parsing, validation, variable-assignment evaluation, and numeric-plot extraction for the persisted `CUSTOM` indicator kind)

### Watchlists

- `src/features/watchlists/watchlistService.ts`
- `src/features/watchlists/watchlistOrchestrationService.ts` - watchlist orchestration seam (selected-watchlist resolution, snapshot watchlist merge helpers, CRUD/add-remove refresh workflows, official watchlist import/update/update-all result shaping)
- `src/features/watchlists/watchlistNavigationService.ts` - watchlist navigation seam (selected-watchlist lookup shared with watchlist UI, previous/next instrument target resolution for `navigateSymbol`)
- `src/features/watchlists/watchlistStoreController.ts` - watchlist store controller seam (snapshot merge wiring, create/rename/delete/import/update flows, selection updates, add/remove instrument orchestration)
- `src/features/watchlists/officialWatchlistProviders.ts`
- `src/features/watchlists/officialWatchlistResolver.ts` - pure official watchlist resolver helpers (`normalizeLookupToken`, `instrumentSymbolKey`, `instrumentIsinKey`, `buildUniqueWatchlistName`, `officialWatchlistSourceSignature`, `resolveOfficialWatchlistMember`, `buildOfficialWatchlistLookupMaps`)
- `src/features/watchlists/officialWatchlistImportService.ts` - official watchlist import/update service (`runOfficialWatchlistImport`, `runOfficialWatchlistUpdate`); returns structured import/update results used by the watchlist orchestration layer and is now loaded on demand by official watchlist flows instead of startup-linking the packaged snapshot data through `chartStore.ts`
- `src/features/watchlists/officialWatchlistData.generated.ts`

### Workspace

- `src/features/workspace/workspaceService.ts`
- `src/features/workspace/workspacePersistence.ts`
- `src/features/workspace/databaseSnapshotService.ts`
- `src/features/workspace/chartSnapshotHydrationService.ts` - snapshot apply / workspace restore / tab rehydration controller extracted from `chartStore.ts`
- `src/features/workspace/databaseLifecycleService.ts` - shared DB lifecycle execution pattern (`bindDatabaseLifecycle`)
- `src/features/workspace/chartRuntimeController.ts` - runtime/init controller for store-side init, refresh, listener registration, and bhavcopy-triggered refresh

Purpose:

- keep low-level bridge calls and persistence helpers out of UI components
- keep dispatch/routing concerns out of store initialization
- keep pure helpers and shared execution patterns out of `chartStore.ts`
- reduce how much non-chart logic stays embedded inside `chartStore.ts`
- keep heavy optional dialog/provider payloads out of the startup renderer path unless the user opens that feature

Renderer build chunking now lives in `vite.config.ts` with stable named chunks for `vendor-react`, `vendor-zustand`, `vendor-date-fns`, `feature-shell-ui`, `feature-utility-dialogs`, `feature-chart-runtime`, and `feature-official-watchlists`. Preserve that strategy when adding new large optional features so bundle-size warnings do not regress.

## 7. Backend Responsibilities

The Rust/Tauri backend currently owns:

- app/runtime startup
- native menu registration
- SQLite-backed persistence
- settings
- layouts
- symbol reads
- EOD reads
- watchlist CRUD and official update writes
- official-source fetch bridge
- CSV import
- bhavcopy download/import
- quote editing
- merge-symbol flows
- corporate actions
- portable runtime path handling and diagnostics

Main files:

- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/quotes.rs`
- `src-tauri-shell/src/database/watchlists.rs`
- `src-tauri-shell/src/database/instrument_mutations.rs`
- `src-tauri-shell/src/database/bootstrap.rs`
- `src-tauri-shell/src/database/settings.rs`
- `src-tauri-shell/src/database/connection_registry.rs`
- `src-tauri-shell/src/database/symbol_search.rs`
- `src-tauri-shell/src/database/eod_data.rs`
- `src-tauri-shell/src/imports.rs`
- `src-tauri-shell/src/bhavcopy.rs`
- `src-tauri-shell/src/runtime.rs`

`src-tauri-shell/src/database.rs` is now mostly a shared backend shell for common types, constants, normalization/formatting helpers, transaction helpers, and re-export wiring. Quote list/upsert/delete internals plus `prev_close` recomputation now live in `src-tauri-shell/src/database/quotes.rs`, watchlist CRUD/update persistence plus watchlist snapshot loading now live in `src-tauri-shell/src/database/watchlists.rs`, merge-symbol plus corporate-action / identity-history mutation internals now live in `src-tauri-shell/src/database/instrument_mutations.rs`, connection bootstrap/migrations/default-setting seeding plus DB stats loading now live in `src-tauri-shell/src/database/bootstrap.rs`, settings/layout commands plus saved-layout serialization now live in `src-tauri-shell/src/database/settings.rs`, the database open/close/registry/snapshot command family plus active-connection cache state now live in `src-tauri-shell/src/database/connection_registry.rs`, symbol list/search commands plus alias-aware ranking helpers now live in `src-tauri-shell/src/database/symbol_search.rs`, and EOD-resolution/loading plus chart-event shaping now live in `src-tauri-shell/src/database/eod_data.rs`.

## 8. Portable Windows Baseline

Preferred Windows runtime path:

- `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`

The staged portable folder must contain:

- `EOD Chart.exe`
- `index.html`
- `assets/`

The launcher is the supported entry point because it sets the portable root and working directory.

## 9. Current High-Value Architecture Themes

- local-first desktop app
- Tauri-only runtime
- Rust backend for desktop/native/data services
- TypeScript chart engine
- stable renderer/runtime seam
- incremental extraction over rewrite
- feature-first helper modules where safe

## 10. What Should Not Be Restructured Blindly

Do not do these without an explicit migration plan:

- full folder-tree rewrite
- converting the app to a greenfield "ideal" architecture in one pass
- moving the chart engine to Rust
- replacing `chartStore.ts` wholesale
- bypassing `src/platform/*`
- introducing direct Tauri imports across the renderer

## 11. Safe Next Architecture Moves

Best next incremental refactors:

1. Store Split Pass 3 (menu command router) - complete as of 2026-04-07
   - `chartStore.ts` reduced from 2,111 -> 2,002 lines
2. Store Split Pass 4 (pure helpers + DB lifecycle) - complete as of 2026-04-07
   - `chartStore.ts` reduced from 2,002 -> 1,868 lines
   - `src/features/charts/chartDataUtils.ts` - pure chart data helpers
   - `src/features/workspace/databaseLifecycleService.ts` - DB lifecycle pattern
3. Store Split Pass 5 (official watchlist resolver helpers) - complete as of 2026-04-07
   - `chartStore.ts` reduced from 1,868 -> 1,774 lines
   - `src/features/watchlists/officialWatchlistResolver.ts` - pure official watchlist resolver/naming/signature helpers
4. Store Split Pass 6 (official watchlist import/update service) - complete as of 2026-04-07
   - `chartStore.ts` reduced from 1,774 -> 1,566 lines
   - `src/features/watchlists/officialWatchlistImportService.ts` - `runOfficialWatchlistImport` / `runOfficialWatchlistUpdate`; store retains refresh, selectedWatchlistId, dialog close, toast
5. Official Watchlist Testing Foundation - complete as of 2026-04-07
   - `vitest` added as devDependency; `"test": "vitest run"` script added to `package.json`
   - `vitest.config.ts` created with `environment: node`, `@` alias, and active-path exclusions for backup/artifact/worktree/live-DB folders
   - `src/features/watchlists/__tests__/officialWatchlistResolver.test.ts` - 35 pure function tests, zero mocking
   - `src/features/watchlists/__tests__/officialWatchlistImportService.test.ts` - 19 service tests with full module mocking; resolver runs for real
   - 2 test files, 54 tests passed
6. Store Split Pass 7 (compare-overlay service seam) - complete as of 2026-04-11
   - `chartStore.ts` reduced from 2,330 -> 2,083 lines in the current checkout
   - `src/features/charts/compareOverlayService.ts` - compare-overlay equality, color, cached loading, hydration, and timeframe reaggregation helpers
7. ChartCanvas Split Pass 1 (drawing-properties dialog) - complete as of 2026-04-11
   - `ChartCanvas.tsx` reduced from 1,469 -> 1,183 lines in the current checkout
   - `src/components/ChartDrawingPropertiesDialog.tsx` - shared drawing-properties modal extracted out of `ChartCanvas.tsx`
8. ChartCanvas Split Pass 2 (pane-controls overlay) - complete as of 2026-04-11
   - `ChartCanvas.tsx` reduced from 1,183 -> 1,055 lines in the current checkout
   - `src/components/ChartPaneControlsOverlay.tsx` - per-pane resize handles, pane action buttons, and indicator-settings dialog ownership extracted out of `ChartCanvas.tsx`
9. ChartCanvas Split Pass 3 (drawing context menu) - complete as of 2026-04-11
   - `ChartCanvas.tsx` reduced from 1,055 -> 1,011 lines in the current checkout
   - `src/components/ChartDrawingContextMenu.tsx` - chart-side Properties / Lock / Delete drawing menu extracted out of `ChartCanvas.tsx`
10. Store Split Pass 8 (chart-tab/workspace helpers) - complete as of 2026-04-11
   - `chartStore.ts` reduced from 2,083 -> 2,016 lines in the current checkout
   - `src/features/charts/chartTabWorkspaceService.ts` - blank tab creation, workspace reset, create/activate/close tab state builders, and activated-tab hydration decision extracted out of `chartStore.ts`
11. Store Split Pass 9 (instrument loading/hydration helpers) - complete as of 2026-04-11
   - `chartStore.ts` reduced from 2,016 -> 1,845 lines in the current checkout
   - `src/features/charts/chartInstrumentHydrationService.ts` - EOD cache helpers, instrument result fetching, compare-overlay hydration wrapper, EOD-to-tab adaptation, and load/hydration failure builders extracted out of `chartStore.ts`
12. Store Split Pass 10 (watchlist orchestration helpers) - complete as of 2026-04-11
   - `chartStore.ts` reduced from 1,976 -> 1,888 lines in the current checkout
   - `src/features/watchlists/watchlistOrchestrationService.ts` - selected-watchlist resolution, snapshot watchlist merge helpers, CRUD/add-remove refresh workflows, and official watchlist import/update/update-all toast/result shaping extracted out of `chartStore.ts`
13. Store Split Pass 11 (symbol search/browser helpers) - complete as of 2026-04-11
   - `chartStore.ts` reduced from 1,888 -> 1,874 lines in the current checkout
   - `src/features/charts/chartSymbolSearchService.ts` - empty search/browser state builders, chart symbol search wrapper, symbol-browser result shaping, and active-database request tagging extracted out of `chartStore.ts`
14. Store Split Pass 12 (watchlist navigation helpers) - complete as of 2026-04-11
   - `chartStore.ts` reduced from 1,874 -> 1,840 lines in the current checkout
   - `src/features/watchlists/watchlistNavigationService.ts` - selected-watchlist lookup and watchlist-based previous/next instrument target resolution extracted out of `chartStore.ts`
15. Store Split Pass 13 (sheet/workspace helpers) - complete as of 2026-04-11
   - `chartStore.ts` reduced from 1,840 -> 1,663 lines in the current checkout
   - `src/features/charts/chartSheetWorkspaceService.ts` - future-margin mode normalization, persisted chart-tab restoration, plain-candle sheet workspace builders, and sheet save/load/delete/rename state builders extracted out of `chartStore.ts`
16. Store Split Pass 14 (indicator pane/layout helpers) - complete as of 2026-04-11
   - `chartStore.ts` reduced from 1,663 -> 1,596 lines in the current checkout
   - `src/features/charts/chartIndicatorPaneService.ts` - pane-height normalization, pane id derivation, collapsed/scale override pruning, and pane-indicator add/reorder helpers extracted out of `chartStore.ts`
17. Backend Split Pass 1 (quote-editing submodule) - complete as of 2026-04-11
   - `src-tauri-shell/src/database.rs` reduced from 4,586 -> 4,337 lines in the current checkout
   - `src-tauri-shell/src/database/quotes.rs` - quote list/upsert/delete internals, quote normalization, and `prev_close` recomputation extracted out of `database.rs`
18. Backend Split Pass 2 (watchlist persistence submodule) - complete as of 2026-04-11
   - `src-tauri-shell/src/database.rs` reduced from 4,337 -> 3,953 lines in the current checkout
   - `src-tauri-shell/src/database/watchlists.rs` - watchlist CRUD command handlers, official watchlist update application, source-meta normalization/mapping, deduped instrument-key validation, and watchlist snapshot loading extracted out of `database.rs`
19. Backend Split Pass 3 (instrument mutation submodule) - complete as of 2026-04-11
   - `src-tauri-shell/src/database.rs` reduced from 3,953 -> 3,068 lines in the current checkout
   - `src-tauri-shell/src/database/instrument_mutations.rs` - merge-symbol command handling, corporate-action / identity-history mutations, adjustment-factor helpers, identity-history writes, and related symbol-mutation internals extracted out of `database.rs`
20. Backend Split Pass 4 (settings/layout submodule) - complete as of 2026-04-12
   - `src-tauri-shell/src/database.rs` reduced from 2,801 -> 2,628 lines in the current checkout
   - `src-tauri-shell/src/database/settings.rs` - layout CRUD commands, generic setting read/write commands, theme loading, and saved-layout serialization helpers extracted out of `database.rs`
21. Backend Split Pass 5 (connection/registry submodule) - complete as of 2026-04-12
   - `src-tauri-shell/src/database.rs` reduced from 2,628 -> 2,033 lines in the current checkout
   - `src-tauri-shell/src/database/connection_registry.rs` - active-connection cache state, database create/open/activate/close/delete commands, snapshot loading, manifest/registry helpers, and DB-stats cache coordination extracted out of `database.rs`
22. Backend Split Pass 6 (symbol-search submodule) - complete as of 2026-04-12
   - `src-tauri-shell/src/database.rs` reduced from 2,033 -> 1,551 lines in the current checkout
   - `src-tauri-shell/src/database/symbol_search.rs` - symbol list/search Tauri commands, SQL-first search/list queries, alias-aware instrument search entry building, and ranking helpers extracted out of `database.rs`
23. Backend Split Pass 7 (EOD-resolution/loading submodule) - complete as of 2026-04-12
   - `src-tauri-shell/src/database.rs` reduced from 1,551 -> 891 lines in the current checkout
   - `src-tauri-shell/src/database/eod_data.rs` - `get_eod_data`, alias-aware instrument resolution, unified EOD price-row selection, corporate-action adjustment, chart-event shaping, and shared instrument lookup helpers extracted out of `database.rs`
24. Backend Split Pass 8 (bootstrap/migration/stats submodule) - complete as of 2026-04-12
   - `src-tauri-shell/src/database.rs` reduced from 891 -> 550 lines in the current checkout
   - `src-tauri-shell/src/database/bootstrap.rs` - connection pragmas, schema migrations, one-time legacy data normalization/backfill guard, default-setting seeding, and DB stats loading extracted out of `database.rs`
25. Store Split Pass 15 (chart-tab mutation helpers) - complete as of 2026-04-12
   - `chartStore.ts` reduced from 1,336 -> 1,120 lines in the current checkout
   - `src/features/charts/chartTabStateMutationService.ts` - pure timeframe/viewport/display-flag, pane height/collapse/scale, indicator mutation, and drawing mutation helpers extracted out of `chartStore.ts`
26. Store Split Pass 16 (chart-tab session controller) - complete as of 2026-04-12
   - `chartStore.ts` reduced from 1,120 -> 1,042 lines in the current checkout
   - `src/features/charts/chartTabSessionController.ts` - layout mode, sheet save/load/delete/rename, adjusted-mode retune scheduling, create/activate/close tab orchestration, and layout restore orchestration extracted out of `chartStore.ts`
27. Store Split Pass 17 (chartStore completion shell pass) - complete as of 2026-04-12
   - `chartStore.ts` reduced from 1,042 -> 498 lines in the current checkout
   - `src/store/chartStoreTypes.ts` - shared store state/tab/toast/progress types extracted out of `chartStore.ts`
   - `src/features/charts/chartSearchController.ts` - search/browser store wiring extracted out of `chartStore.ts`
   - `src/features/charts/chartInstrumentCompareController.ts` - direct instrument-load, compare-overlay, and watchlist-navigation orchestration extracted out of `chartStore.ts`
   - `src/features/watchlists/watchlistStoreController.ts` - watchlist store wiring extracted out of `chartStore.ts`
   - `src/features/workspace/chartRuntimeController.ts` - init/refresh/download runtime orchestration extracted out of `chartStore.ts`
28. `ChartCanvas.tsx` is now the primary frontend hotspot; prefer ChartCanvas seams or full runtime validation before forcing more store/backend extraction
29. later split more backend responsibilities out of `src-tauri-shell/src/database.rs` only if a very small shared-utility seam is still high-value
30. keep adding focused feature-level seams instead of large rewrites

## 12. Source of Truth Priority

When deciding what is current, use this order:

1. `AGENTS.md`
2. `README.md`
3. `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
4. `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
5. `FILE_INVENTORY.md`
6. `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
7. this file
8. focused recent historical reports under `docs/archive/`

Do not use older scaffold-era prompt files as primary implementation truth if they conflict with the current architecture.
