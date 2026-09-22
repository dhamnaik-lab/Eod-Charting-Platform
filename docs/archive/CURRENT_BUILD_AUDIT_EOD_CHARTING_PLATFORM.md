# Current Build Audit - EOD Charting Platform

Audit date: 2026-04-19  
Audit basis: current repository checkout only  
Goal of this document: describe what is actually present in code today, not what older reports hoped would exist

## Scope and method

This audit was produced by reading the current root docs and then verifying the active code paths in:

- `package.json`
- `src/main.tsx`
- `src/RootApp.tsx`
- `src/platform/*`
- `src/store/*`
- `src/features/*`
- `src/components/*`
- `src-tauri-shell/tauri.conf.json`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/runtime.rs`
- `src-tauri-shell/src/database/*`
- `src-tauri-shell/src/imports.rs`
- `src-tauri-shell/src/bhavcopy.rs`

When old documentation and current code disagreed, this audit favored code.

## Executive summary

- The active app is a Tauri 2 desktop app with a React 18 + TypeScript + Vite renderer. Evidence: `package.json`, `src-tauri-shell/tauri.conf.json`, `src/main.tsx`, `src/RootApp.tsx`.
- The active backend entry point is `src-tauri-shell/src/main.rs`. The active frontend entry point is `src/main.tsx`. The active app shell is `src/RootApp.tsx`.
- The old `src-tauri/` tree is not present in this checkout. `src-tauri-shell/` is the only live desktop shell. Evidence: repo tree, `.gitignore`, `src-tauri-shell/README.md`.
- No active Electron runtime or Electron main/preload source was found under current source folders. Electron is not the active runtime. Evidence: `package.json`, `src/`, `src-tauri-shell/README.md`, repo-wide search in active source.
- The app is already more than a shell. It has working local SQLite database lifecycle, EOD symbol search, chart loading, adjusted/raw price modes, multi-chart workspace persistence, watchlists, source-linked watchlist import/update, CSV/TXT import, bhavcopy download flows, native menu commands, and database utility dialogs. Evidence is listed in later sections.
- The watchlist import path now includes two real source families: remote NSE/BSE index or sector groups plus a snapshot-only NSE stocks-by-sector universe generated from `src/features/watchlists/nseSectorUniverseWatchlistData.generated.ts`.
- The app is not feature-complete. Scanner/pattern scanner functionality is absent, settings are mostly internal rather than a dedicated screen, source-linked watchlist coverage/live-source behavior is partial, and the test suite is still narrow.
- Existing docs are directionally useful, but some artifact-state claims are stale. In particular, `src-tauri-shell/target/` is present in this checkout, and there are duplicate portable output trees under both `release/` and `resources/release/`.

## Current active architecture

- Desktop runtime: Tauri only. Evidence: `package.json` scripts (`tauri:dev`, `tauri:build`), `src-tauri-shell/tauri.conf.json`, `src/platform/desktop.ts`, `src/platform/shell.ts`.
- Frontend renderer: React app mounted from `src/main.tsx`, rooted at `src/RootApp.tsx`.
- State layer: Zustand stores in `src/store/chartStore.ts` and `src/store/uiStore.ts`.
- Frontend feature modules:
  - charts: `src/features/charts/*`
  - watchlists: `src/features/watchlists/*`
  - workspace/runtime orchestration: `src/features/workspace/*`
  - menu command routing: `src/features/app/menuCommandRouter.ts`
- Desktop bridge seam:
  - typed Tauri invoke/listener wrapper: `src/platform/tauriDesktop.ts`
  - runtime detection and menu bridge: `src/platform/shell.ts`
  - runtime entry chooser: `src/platform/desktop.ts`
- Backend shell:
  - command registration: `src-tauri-shell/src/main.rs`
  - runtime path handling: `src-tauri-shell/src/runtime.rs`
  - database modules: `src-tauri-shell/src/database/*`
  - import flows: `src-tauri-shell/src/imports.rs`
  - bhavcopy flows: `src-tauri-shell/src/bhavcopy.rs`
- Storage model:
  - primary market database is SQLite
  - database folder model uses `database.json` plus `market-data.sqlite3`
  - recent database registry uses `database-registry.json`
  - workspace and layout persistence use settings stored through the backend

## Current runtime and tech stack

- Renderer: React 18, TypeScript 5, Vite 5. Evidence: `package.json`, `src/main.tsx`.
- State management: Zustand. Evidence: `package.json`, `src/store/chartStore.ts`, `src/store/uiStore.ts`.
- Chart logic and indicators: custom chart engine plus `technicalindicators`. Evidence: `src/engine/*`, `package.json`.
- Desktop shell: Tauri 2. Evidence: `package.json`, `src-tauri-shell/Cargo.toml`, `src-tauri-shell/tauri.conf.json`.
- Backend language and libraries: Rust, `rusqlite`, `reqwest`, `chrono`, `csv`, `zip`, `rfd`, `open`. Evidence: `src-tauri-shell/Cargo.toml`.
- Data storage: local SQLite with WAL mode and migrations. Evidence: `src-tauri-shell/src/database/bootstrap.rs`.
- Runtime data modes:
  - system app-data mode
  - portable mode using `EOD_CHART_PORTABLE_ROOT` or sibling `portable-data`
  - Evidence: `src-tauri-shell/src/runtime.rs`

## Built and working today

- Database lifecycle is implemented end-to-end. Users can create, open, activate, close, and delete database folders. Evidence: `src-tauri-shell/src/main.rs`, `src-tauri-shell/src/database/connection_registry.rs`, `src/components/DeleteDatabaseDialog.tsx`.
- Database schema and migrations are implemented. Current schema includes instruments, EOD prices, watchlists, watchlist items, settings, download log, corporate actions, and identity history. Evidence: `src-tauri-shell/src/database/bootstrap.rs`.
- Symbol search and symbol listing are implemented against the local database, with alias/history-aware fallback. Evidence: `src-tauri-shell/src/database/symbol_search.rs`, `src/features/charts/chartSymbolSearchService.ts`, `src/components/Sidebar.tsx`.
- EOD chart loading is implemented, including alias resolution and adjusted vs raw price handling. Evidence: `src-tauri-shell/src/database/eod_data.rs`, `src/store/chartStore.ts`, `src/features/charts/chartInstrumentHydrationService.ts`.
- Charting is implemented beyond a basic candle view. Current chart code supports D/W/M/Q/Y timeframes, drawings, indicator panes, pane collapse/resize, compare overlays, log scale, invert scale, future bar margin modes, value-label toggles, and multiple same-kind indicator instances per chart tab. Evidence: `src/components/ChartCanvas.tsx`, `src/components/ChartToolDock.tsx`, `src/components/ChartSettingsMenu.tsx`, `src/engine/types.ts`, `src/engine/Indicators.ts`, `src/engine/ScaleManager.ts`, `src/features/charts/chartTabStateMutationService.ts`, `src/features/charts/chartDataUtils.ts`.
- Multi-chart workspace behavior is implemented. The app supports multiple chart tabs, per-chart sheets, tiled layouts, autosaved workspace state, and named saved layouts. Evidence: `src/components/ChartTabs.tsx`, `src/components/SheetTabs.tsx`, `src/components/LayoutManagerDialog.tsx`, `src/features/workspace/workspacePersistence.ts`, `src/features/workspace/workspaceService.ts`, `src-tauri-shell/src/main.rs`.
- Manual watchlist CRUD is implemented. Evidence: `src-tauri-shell/src/database/watchlists.rs`, `src/components/WatchlistManagerDialog.tsx`, `src/components/Sidebar.tsx`.
- Source-linked watchlist import and update flows are implemented. They support new watchlist creation, same-name in-place replacement, cleanup of duplicate official watchlists that share the same source signature when that source is re-imported, later sync/update from the linked source, conservative fallback resolution beyond exact symbol/ISIN by using unique normalized company names plus alias-aware symbol search when direct catalog matching misses, and A-to-Z member ordering for the snapshot-backed `NSE Stocks by Sector` source. Evidence: `src/components/OfficialWatchlistImportDialog.tsx`, `src/features/watchlists/officialWatchlistImportService.ts`, `src/features/watchlists/officialWatchlistResolver.ts`, `src/features/watchlists/officialWatchlistProviders.ts`, `src/features/watchlists/nseSectorUniverseWatchlistData.generated.ts`, `src-tauri-shell/src/database/watchlists.rs`, `src-tauri-shell/src/main.rs`.
- The sidebar watchlist panel is a scrollable virtualized list, not a capped subset. Large watchlists depend on `Sidebar.tsx` both for scroll-container layout and for recalculating viewport height when the watchlist panel becomes visible; the backing SQLite watchlist data remains the source of truth. Evidence: `src/components/Sidebar.tsx`, `src-tauri-shell/src/database/watchlists.rs`.
- The sidebar watchlist dropdown now uses compact display labels for official watchlists. It shows the source exchange initial plus the source display name, while keeping the full stored watchlist name unchanged in SQLite. Evidence: `src/components/Sidebar.tsx`, `src/types/desktop.ts`.
- Watchlist import/update UX now exposes structured counts in toasts rather than only terse status strings. The current toast path reports created/replaced/already-linked watchlists, symbols applied, unresolved symbols, and update add/remove/unchanged counts. Evidence: `src/features/watchlists/watchlistOrchestrationService.ts`, `src/components/ToastContainer.tsx`, `src/features/watchlists/watchlistStoreController.ts`.
- CSV/TXT/TSV import is implemented with file picking, preview, delimiter/date options, duplicate handling, and progress events. Evidence: `src-tauri-shell/src/imports.rs`, `src/components/ImportCsvDialog.tsx`.
- Bhavcopy download flows are implemented with settings persistence, progress streaming, range/update/full-history modes, and exchange selection. Evidence: `src-tauri-shell/src/bhavcopy.rs`, `src/components/BhavcopyDownloadWindow.tsx`.
- Native desktop menus are implemented and routed into the renderer. Evidence: `src-tauri-shell/src/main.rs`, `src/features/app/menuCommandRouter.ts`, `src/platform/shell.ts`.
- Database utility dialogs are implemented for quote editing, symbol merge, and corporate actions / identity changes. Evidence: `src/components/DatabaseToolsDialogs.tsx`, `src-tauri-shell/src/main.rs`.
- A command palette exists and can search symbols plus a small set of app commands. Evidence: `src/components/CommandPalette.tsx`, `src/store/uiStore.ts`.

## Built but partial / incomplete

- Source-linked watchlist coverage is partial. `src/features/watchlists/officialWatchlistProviders.ts` explicitly excludes `bse-500` via `PARTIAL_GROUP_IDS`, and the broader NSE sector universe is snapshot-backed rather than fetched from an exchange endpoint.
- Source-linked watchlist live-source behavior is partial. Live fetch bridging exists only for `niftyindices.com` and `bseindia.com`; the broader NSE sector universe uses a generated snapshot file, and BSE parsing still falls back when source pages are paginated or harder to parse. Evidence: `src-tauri-shell/src/main.rs`, `src/features/watchlists/officialWatchlistProviders.ts`, `src/features/watchlists/nseSectorUniverseWatchlistData.generated.ts`.
- CSV import UI coverage is partial relative to the backend. The backend supports more date-format options than the current dialog exposes, including `DD-MMM-YYYY`. Evidence: `src-tauri-shell/src/imports.rs`, `src/components/ImportCsvDialog.tsx`, `src/types/desktop.ts`.
- Indicator exposure is partial across surfaces. The chart engine and picker support indicators such as `DEMA`, `TEMA`, `VWAP`, `SUPERTREND`, `MOM`, `AROON`, and `CMF`, but the native Tauri menu routes only a smaller subset. Evidence: `src/engine/Indicators.ts`, `src/components/IndicatorPickerDialog.tsx`, `src-tauri-shell/src/main.rs`, `src/features/app/menuCommandRouter.ts`.
- Settings are only partially productized. There is a backend setting store and real consumers for workspace persistence and bhavcopy settings, but there is no dedicated general settings screen. Evidence: `src-tauri-shell/src/main.rs`, `src/features/workspace/workspaceService.ts`, `src/components/BhavcopyDownloadWindow.tsx`, `src-tauri-shell/src/database/bootstrap.rs`.
- Automated test coverage is partial and narrow. The active test files currently found are watchlist-focused rather than broad chart/runtime/import integration coverage. Evidence: `vitest.config.ts`, `src/features/watchlists/__tests__/officialWatchlistImportService.test.ts`, `src/features/watchlists/__tests__/officialWatchlistResolver.test.ts`.
- Build and release verification is partially but materially confirmed from this session. `npm run test`, `npm run typecheck:renderer`, `npm run tauri:check`, and `npm run build:renderer` completed successfully after reinstalling Node/Rust tooling; the composite `npm run build` wrapper timed out in the shell, but its component steps passed. Evidence: `package.json`, `src-tauri-shell/tauri.conf.json`, `scripts/prepare-tauri-portable.ps1`.

## Present as scaffold / stub only

- The quote editor shows a disabled second mode, `All symbols / single quote`, but only `Current symbol / all quotes` is actually active. Evidence: `src/components/DatabaseToolsDialogs.tsx`.

## Planned or not built yet

- Scanner / pattern scanner functionality is not built in the active app. No scanner commands, components, services, or backend modules were found under `src/` or `src-tauri-shell/src/`.
- A dedicated general settings page is not built. Current settings usage is internal/plumbing-oriented rather than a user-facing settings module. Evidence: `src/features/workspace/workspaceService.ts`, `src/components/BhavcopyDownloadWindow.tsx`, and no `SettingsDialog` or `SettingsPage` found under `src/components` or `src/features`.
- Electron is not a fallback runtime in the current codebase. It appears removed rather than still-active or fallback-only. Evidence: active source tree, `package.json`, `src/platform/*`, absence of Electron entry files.

## Legacy / inactive files and folders

- `src-tauri/`: legacy by absence. The folder does not exist in this checkout, and should not be treated as the active shell.
- `src-tauri-shell/`: active, not legacy. This is the current shell and backend.
- `dist/`: generated renderer output, not source.
- `release/tauri-portable-win/`: packaged output artifact, not source.
- `resources/release/tauri-portable-win/`: second packaged artifact/support tree, not source. It duplicates part of the release story and increases ambiguity.
- `src-tauri-shell/target/`: Rust build artifact tree, not source.
- `EOD DATABASE/`: live local data area, not code. It contains an active folder-style DB (`EOD DATABASE/NSE/database.json` plus `market-data.sqlite3`) and also a top-level `EOD DATABASE/NSE.sqlite3` that looks older or sidecar-like.
- `EOD Charting Platform/`: nested worktree/support folder, not the active source root for this task. It is also excluded by backup/test tooling.
- Old docs are not automatically authoritative. `README.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`, and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` are useful context, but when they disagree with current code, code wins.

## Key user flows currently supported

1. Database-first startup flow
   - Create or open a database, activate it, load the snapshot, browse symbols, and persist recent database state.
   - Evidence: `src-tauri-shell/src/database/connection_registry.rs`, `src/features/workspace/chartRuntimeController.ts`, `src/components/Sidebar.tsx`.
2. Import local EOD files
   - Pick one or more CSV/TXT/TSV files, preview a sample, choose parsing options, import, and then open imported symbols in charts.
   - Evidence: `src-tauri-shell/src/imports.rs`, `src/components/ImportCsvDialog.tsx`.
3. Download bhavcopy data
   - Configure exchanges and workers, run range/update/full-history downloads, view progress and logs, and persist download preferences.
   - Evidence: `src-tauri-shell/src/bhavcopy.rs`, `src/components/BhavcopyDownloadWindow.tsx`.
4. Build and maintain watchlists
   - Create manual watchlists, add/remove symbols, import source-linked watchlist groups, and run linked-source updates.
   - Evidence: `src-tauri-shell/src/database/watchlists.rs`, `src/components/WatchlistManagerDialog.tsx`, `src/components/OfficialWatchlistImportDialog.tsx`.
5. Work with multi-chart layouts
   - Open chart tabs, create sheets inside a tab, switch layouts, save named layouts, and resume the autosaved workspace after reopening the database.
   - Evidence: `src/store/chartStore.ts`, `src/components/ChartTabs.tsx`, `src/components/SheetTabs.tsx`, `src/components/LayoutManagerDialog.tsx`, `src/features/workspace/workspacePersistence.ts`.
6. Clean or repair local data
   - Edit quote rows, merge symbols, and apply corporate actions / identity changes.
   - Evidence: `src/components/DatabaseToolsDialogs.tsx`, `src-tauri-shell/src/main.rs`.

## Major gaps and risks

- No scanner/pattern scanner exists in active code, so future prompts should not assume it is half-built somewhere.
- Source-linked watchlist syncing depends partly on brittle remote HTML/source parsing and snapshot fallbacks.
- Workspace persistence is deep and high-impact. It stores tabs, sheets, drawings, indicators, pane layouts, scale options, compare overlays, and chart flags. Regressions here would be user-visible quickly. Evidence: `src/features/workspace/workspacePersistence.ts`.
- Adjusted data depends on identity history and corporate action handling. Changes in `eod_data.rs`, merge flows, or corporate-action logic can silently change chart results.
- The repo contains live data and multiple build-output trees, which makes it easy to mistake artifacts for source.
- Older architecture docs are not fully wrong, but some repo-state details are stale. Future contributors should read the new audit docs first.

## Read first files for future contributors

1. `CURRENT_BUILD_AUDIT_EOD_CHARTING_PLATFORM.md`
2. `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
3. `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
4. `FUTURE_PROMPT_README_EOD_CHARTING_PLATFORM.md`
5. `package.json`
6. `src-tauri-shell/tauri.conf.json`
7. `src-tauri-shell/src/main.rs`
8. `src/main.tsx`
9. `src/RootApp.tsx`
10. `src/platform/tauriDesktop.ts`
11. `src/store/chartStore.ts`
12. `src/features/workspace/chartRuntimeController.ts`
13. Area-specific files before edits:
    - database: `src-tauri-shell/src/database/*`
    - imports: `src-tauri-shell/src/imports.rs`, `src/components/ImportCsvDialog.tsx`
    - bhavcopy: `src-tauri-shell/src/bhavcopy.rs`, `src/components/BhavcopyDownloadWindow.tsx`
    - watchlists: `src/features/watchlists/*`, `src/components/WatchlistManagerDialog.tsx`
    - chart canvas/workspace: `src/components/ChartCanvas.tsx`, `src/features/workspace/workspacePersistence.ts`

## Session validation notes

- Documentation in this audit is repo-verified, not guessed.
- Validation completed in this session for the active code path:
  - `npm run test`
  - `npm run typecheck:renderer`
  - `npm run tauri:check`
  - `npm run build:renderer`
- The composite `npm run build` wrapper hit the shell timeout, but the underlying steps all passed when run individually.
