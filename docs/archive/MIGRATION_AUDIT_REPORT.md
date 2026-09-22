# MIGRATION_AUDIT_REPORT

Date: 2026-03-28

## Scope

This document is an audit and migration plan only. No Electron code, package configuration, or runtime scaffolding was changed while preparing it.

## Executive Summary

- The active product is a React 18 + Vite + TypeScript renderer running inside Electron.
- The active privileged layer lives in `electron/` and owns all local filesystem, SQLite, dialog, menu, import, and bhavcopy work.
- The active renderer does not directly import Node or Electron modules. It talks to Electron only through `window.electronAPI`, which is a strong signal that most of the current UI can be reused.
- A separate `src-tauri/` tree already exists, but it represents an older product shape and is not wired into the active `package.json` scripts or active React entrypoint. It should be treated as legacy reference material, not as the migration baseline.
- The migration is practical. It is not a trivial swap. The main effort is backend parity, not UI rewrite.

Practicality verdict: **Yes, practical**, with the constraint that the database layer, import pipeline, bhavcopy downloader, and menu/event surface must be migrated deliberately and validated against the current Electron behavior.

Estimated reuse of the active frontend: **about 80%**.

## Current Architecture Summary

### Active runtime

- Renderer entry: `index.html` -> `src/main.tsx`
- Frontend shell: `src/RootApp.tsx`
- Desktop runtime: `electron/main.ts`
- Preload bridge: `electron/preload.ts`
- IPC contract: `electron/ipc/handlers.ts`
- Native/database services: `electron/db.ts`, `electron/csvImporter.ts`, `electron/importWorker.ts`, `electron/bhavcopy.ts`, `electron/menuBar.ts`

### Important repo split

There are two desktop application shapes in the repository:

1. Active path
   - `src/main.tsx`
   - `src/RootApp.tsx`
   - `electron/*`
   - `package.json` Electron scripts and `electron-builder`

2. Legacy or disconnected path
   - `src-tauri/*`
   - `src/main.js`
   - `src/app.js`
   - `src/modules/*`

The active app does not use the legacy Tauri files. The existing `src-tauri` backend models a different database and workspace contract than the current Electron app.

## Frontend Stack Summary

| Area | Current state |
| --- | --- |
| Framework | React 18 |
| State | Zustand |
| Language | TypeScript in active renderer |
| Build tool | Vite 5 |
| Styling | CSS plus inline React styles |
| Charting | Custom canvas renderer in `src/engine/*` |
| Desktop bridge | `window.electronAPI` from preload |
| Local UI persistence | `window.localStorage` for sidebar and dock preferences |

### Renderer security and Node usage

- Active renderer has **no direct `fs`, `path`, `child_process`, or Electron imports**.
- Electron is already isolated behind preload with `contextIsolation: true`, `nodeIntegration: false`, and a typed API contract in `src/types/electron.d.ts`.
- `sandbox` is currently set to `false` in Electron, which should not be carried forward as an architectural assumption.

## Electron Usage Inventory and Tauri Migration Map

| Responsibility | Current location | What it does now | Tauri 2 replacement | Frontend can stay unchanged? | Add compatibility bridge? | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| App bootstrap, single instance, lifecycle | `electron/main.ts` | Creates main window, enforces single instance, handles `activate`, `window-all-closed`, crash logging | `src-tauri/src/main.rs` with Tauri builder, single-instance plugin or equivalent app-handle logic, window lifecycle hooks | Mostly | Yes | Medium |
| Browser window creation and window sizing | `electron/main.ts` | Sets size, min size, title, macOS title bar style, dev/prod load path | `tauri.conf.json` window config plus Rust window APIs for runtime adjustments | Mostly | Yes | Low |
| External URL handling | `electron/main.ts` | Intercepts navigation and opens links via `shell.openExternal` | Tauri opener plugin or shell opener command from Rust | Yes | Yes | Low |
| Preload bridge | `electron/preload.ts` | Exposes `window.electronAPI` request and event surface | Replace with `src/platform/desktop.ts` backed by Tauri `invoke` + `listen` | No direct carryover | Yes | Medium |
| IPC request/response contract | `electron/ipc/handlers.ts` | Maps named channels to backend functions | Tauri commands (`#[tauri::command]`) | Yes if bridge preserves method names | Yes | Medium |
| IPC event delivery | `electron/preload.ts`, `electron/main.ts`, `electron/csvImporter.ts`, `electron/bhavcopy.ts` | Sends menu, DB, import, and download progress events to renderer | Tauri events (`emit`, `listen`) | Yes if event names are preserved behind bridge | Yes | Medium |
| Native app menu | `electron/menuBar.ts` | Rich menu for database, chart, drawing, indicators, view toggles, dialogs | Tauri menu APIs in Rust | Renderer mostly yes because commands already land as string events | Yes | Medium |
| Database create/open/close/delete dialogs | `electron/main.ts`, `electron/ipc/handlers.ts` | Uses native dialogs for folder selection and confirmation | Tauri dialog plugin, but keep actual folder semantics in Rust commands | Yes | Yes | Medium |
| Database registry and manifest | `electron/db.ts` | Stores recent DBs in `app.getPath('userData')/database-registry.json`, manages folder manifests and active DB selection | Rust-owned registry file under app data directory, preserving folder manifest semantics | Renderer yes | Yes | High |
| SQLite connection and schema | `electron/db.ts` | `better-sqlite3` connection, migrations, queries, WAL pragmas | Rust SQLite layer, likely `rusqlite` or `sqlx`, preserving current schema and behavior | Renderer yes | Yes | High |
| Snapshot/search/EOD data reads | `electron/db.ts`, `electron/ipc/handlers.ts` | Builds app snapshot, searches symbols, returns resolved EOD bars and event markers | Rust commands returning the same shape | Yes | Yes | Medium |
| Watchlists | `electron/db.ts`, `electron/ipc/handlers.ts` | CRUD for watchlists and items, snapshot refresh | Rust commands with same payloads | Yes | Yes | Medium |
| Quote editor CRUD | `electron/db.ts`, `electron/ipc/handlers.ts`, `src/components/DatabaseToolsDialogs.tsx` | List, insert, update, delete quote rows | Rust commands with current contract preserved | UI yes | Yes | High |
| Merge symbols | `electron/db.ts`, `electron/ipc/handlers.ts`, `src/components/DatabaseToolsDialogs.tsx` | Merges history and watchlist entries, optional delete/source alias handling | Rust command preserving current merge rules | UI yes | Yes | High |
| Corporate actions and identity history | `electron/db.ts`, `electron/ipc/handlers.ts`, `src/components/DatabaseToolsDialogs.tsx` | Applies splits, bonuses, symbol/name changes, event markers | Rust command preserving data mutation and event generation | UI yes | Yes | High |
| CSV preview | `electron/csvImporter.ts`, `electron/ipc/handlers.ts`, `src/components/ImportCsvDialog.tsx` | Reads first lines, detects delimiter, previews rows | Rust command or limited Tauri file read through backend command | UI yes | Yes | Medium |
| CSV import execution | `electron/csvImporter.ts`, `electron/importWorker.ts` | Uses worker thread, streams files, writes SQLite, emits progress | Rust import worker logic, likely background task/thread with emitted progress | UI yes | Yes | High |
| Bhavcopy download | `electron/bhavcopy.ts` | Uses Electron session cookies, fetch retry logic, ZIP parsing, DB inserts, progress | Rust HTTP + cookie/session strategy, ZIP parsing, emitted progress; do not expose raw network/filesystem to renderer | UI yes | Yes | High |
| Settings persistence | `electron/ipc/handlers.ts`, `electron/db.ts`, `src/store/chartStore.ts` | DB-backed `settings` table for workspace and app preferences | Keep DB-backed settings through Rust commands | Yes | Yes | Medium |
| Saved layouts | `electron/db.ts`, `electron/ipc/handlers.ts`, `src/components/LayoutManagerDialog.tsx` | Stores named layouts inside DB settings | Keep current storage model through Rust commands | Yes | Yes | Medium |
| UI-only prefs | `src/RootApp.tsx`, `src/components/ChartToolDock.tsx` | Uses `localStorage` for sidebar width/collapse and tool dock collapse | No desktop migration needed; keep browser storage | Yes | No | Low |
| App metadata/version and app paths | Not yet exposed in active renderer | Not currently first-class, but needed for future desktop abstraction | Tauri app APIs for version/name/path | N/A | Yes | Low |
| Window controls | Mostly native today; no custom renderer buttons found | Native frame and menu behavior only | Tauri window APIs if custom controls are later needed | Yes | Yes, but small | Low |

## Database and Storage Summary

### Active storage model

- Core market data is stored in a SQLite database file inside a **database folder**.
- Database folder structure:
  - `database.json` manifest
  - `market-data.sqlite3`
- Known databases are tracked in a registry JSON file under Electron `userData`.
- Layouts and longer-lived workspace state are persisted in the SQLite `settings` table.
- Small UI-only preferences remain in browser `localStorage`.

### Why this matters for Tauri

The current product is not "just a SQLite file". It is a folder-oriented local database product with:

- manifest semantics
- a recent-database registry
- snapshot construction
- per-database settings
- destructive delete behavior on folders

The Tauri migration should preserve that model. Replacing it with the legacy `src-tauri` single-file database shape would be a regression.

## Import and Export Pipeline

### Import

- CSV/TXT preview and import are implemented.
- File picking uses native Electron dialogs.
- Import work is local, file-based, and SQLite-backed.
- Long-running imports emit progress back to the renderer.

### Export

- No dedicated active market-data export pipeline was found in the active Electron app.
- The only obvious "save/export-like" flows are layout persistence and database folder creation/selection.
- If data export is a product requirement, it should be audited separately before or during migration.

## Settings and Preferences Persistence

Current persistence is split across three layers:

1. Database folder manifest
   - identity of the database folder itself

2. Per-user registry file
   - recent databases
   - last active database

3. Per-database SQLite settings
   - chart workspace JSON
   - saved named layouts
   - bhavcopy settings
   - other app settings

4. Browser `localStorage`
   - sidebar width/collapse
   - tool dock collapse

This split is acceptable in Tauri as long as the boundaries stay explicit.

## Chart Rendering Architecture

- The chart engine is custom and canvas-based.
- Major files:
  - `src/components/ChartCanvas.tsx`
  - `src/engine/ChartEngine.ts`
  - `src/engine/Renderer.ts`
  - `src/engine/Indicators.ts`
  - `src/engine/Crosshair.ts`
- It uses browser primitives such as `canvas`, `ResizeObserver`, and `requestAnimationFrame`.
- It does not depend on Electron.

Migration implication: **very high frontend reuse potential**.

## Watchlist and Workspace Architecture

- Watchlists are stored in SQLite and surfaced through snapshot APIs.
- Workspace tabs are autosaved through the DB-backed setting key `workspace.chartLayout.v1`.
- Saved named layouts are stored separately in DB settings under `chart_layouts`.
- The Zustand store coordinates chart tabs, watchlist selection, progress state, and dialog visibility.

Migration implication: keep the state model and JSON payloads stable, but move persistence and privileged reads/writes behind a Tauri bridge.

## Packaging and Build Summary

### Active build path

- Renderer build: Vite
- Electron build: TypeScript compile to `dist-electron`
- Packaging: `electron-builder`

### Current release coverage

- Active packaging is Windows-only.
- No active macOS packaging flow exists in the Electron scripts.
- `package.json` is the source of truth for the active product.

### Existing Tauri config state

- `src-tauri/tauri.conf.json` declares Windows and macOS bundle targets.
- `src-tauri/Cargo.toml` already references Tauri 2 plus dialog/fs/store plugins.
- These configs are not currently wired into the active npm scripts or active renderer contract.

## Migration Difficulty by Area

| Area | Difficulty | Assessment |
| --- | --- | --- |
| Frontend reuse potential | Low | Active React UI is largely runtime-agnostic once `window.electronAPI` is abstracted |
| Electron main process migration | Medium | Lifecycle and window setup are straightforward, but menu parity and single-instance behavior need care |
| Preload migration | Medium | The preload layer itself disappears, but its API contract must survive in a new bridge |
| IPC migration | Medium | Tauri commands/events map well, but payload parity must be preserved |
| Filesystem and dialogs | Medium | Tauri supports these, but folder semantics and scoped permissions must be designed conservatively |
| Database migration | High | `electron/db.ts` is large, stateful, and business-critical |
| Chart UI migration | Low | Browser-only canvas code, minimal desktop coupling |
| Packaging/build for Windows | Medium | Easier than backend parity, but WebView2 assumptions must be validated |
| Packaging/build for macOS | High | No active macOS shipping pipeline exists today; signing and notarization will be new work |

## Migration Readiness Assessment

### Strong readiness signals

- Active renderer already avoids direct Node imports.
- Electron access is centralized in preload.
- UI state and drawing logic are browser-native.
- Product is already local-first, which fits Tauri well.

### Weak readiness signals

- The business backend is concentrated in a few large Electron files.
- The repo contains a stale Tauri path that could confuse implementation if treated as authoritative.
- Current packaging and testing are Windows-centric.
- Bhavcopy and import are operationally sensitive and must keep parity.

## Recommended Target Tauri Architecture

### Backend responsibilities

Move all privileged responsibilities into Rust-owned services:

- database registry and active-database selection
- database folder manifest management
- SQLite open/migrate/query/update logic
- import preview and import execution
- bhavcopy download and parse workflow
- settings and layout persistence
- menu command dispatch
- external link opening
- app version/path helpers

### Frontend platform abstraction

Add a single runtime boundary in the active renderer:

- `src/platform/desktop.ts`
- optional supporting types in `src/platform/types.ts`

Nothing outside this boundary should know whether the app is running in Electron or Tauri.

### Command and event model

- Use Tauri commands for request/response operations.
- Use Tauri events for:
  - menu commands
  - import progress
  - bhavcopy progress
  - database snapshot change notifications

### Filesystem and dialog handling

- Prefer Rust commands for privileged file operations.
- Use the Tauri dialog plugin only for user-driven file/folder selection.
- Avoid granting the renderer broad filesystem access through a general-purpose FS plugin unless a very specific use case requires it.

### Window handling

- Keep a native framed window initially.
- Recreate only the current minimum behavior:
  - size and min-size
  - title
  - macOS-specific window style decisions
  - focus/activate behavior
  - external link handling

### App metadata and version access

Expose these through the desktop bridge:

- app version
- app name if needed
- app data paths only when the UI actually needs them

### Database access boundary

Do not expose raw SQLite or arbitrary file APIs to the renderer. Keep the current coarse-grained service calls:

- snapshots
- search/list/load data
- watchlists
- quote CRUD
- symbol merge
- corporate actions
- settings and layouts

### Import/export behavior

- Keep imports backend-owned and local-first.
- Treat export as separate future scope because no active dedicated export flow was identified.

### Future maintainability

- Keep the renderer on React/Vite.
- Keep one typed desktop bridge.
- Keep one backend command/event contract.
- Do not let feature code call Tauri APIs directly from many components.

## Proposed Compatibility Bridge

Recommended module: `src/platform/desktop.ts`

Recommended API surface:

- `getSnapshot()`
- `createDatabaseInteractive()`
- `openDatabaseInteractive()`
- `activateDatabasePath(path)`
- `closeDatabase()`
- `deleteDatabase(path)`
- `searchSymbols(input)`
- `listSymbols(input)`
- `getEodData(input)`
- `listQuotes(input)`
- `upsertQuote(input)`
- `deleteQuote(input)`
- `mergeSymbols(input)`
- `applyCorporateAction(input)`
- `getWatchlists()`
- `createWatchlist(name)`
- `addToWatchlist(input)`
- `removeFromWatchlist(input)`
- `pickCsvFiles()`
- `previewCsv(path)`
- `importCsv(options)`
- `downloadBhavcopy(date?)`
- `downloadBhavcopyBatch(config)`
- `getBhavcopySettings()`
- `saveBhavcopySettings(settings)`
- `getSavedLayouts()`
- `saveLayout(name, layoutData)`
- `loadLayout(name)`
- `deleteLayout(name)`
- `getSetting(key)`
- `setSetting(input)`
- `getAppVersion()`
- `openExternal(url)`
- `revealPath(path)` if needed later
- `minimizeWindow()`
- `toggleMaximizeWindow()`
- `closeWindow()`
- `onMenuCommand(callback)`
- `onImportProgress(callback)`
- `onDownloadProgress(callback)`
- `onDatabaseChanged(callback)`

## Areas That Can Be Reused Unchanged or Nearly Unchanged

- `src/components/ChartCanvas.tsx`
- `src/engine/*`
- `src/components/Sidebar.tsx`
- `src/components/Toolbar.tsx`
- `src/components/CommandPalette.tsx`
- most layout, styling, and drawing UI
- most of `src/store/chartStore.ts` domain logic after replacing direct `window.electronAPI` usage
- `localStorage`-based UI preference handling

## Areas Requiring Rewrite or Significant Adaptation

- `electron/db.ts`
- `electron/bhavcopy.ts`
- `electron/csvImporter.ts`
- `electron/importWorker.ts`
- `electron/ipc/handlers.ts`
- `electron/preload.ts`
- `electron/main.ts`
- `electron/menuBar.ts`
- direct `window.electronAPI` call sites in the store and dialogs
- any attempt to reuse the old `src-tauri/src/database.rs` without reconciling its data model first

## Top Recommendation

Do **not** start by porting the old `src-tauri` code directly. Start by preserving the active Electron API contract behind a new frontend platform bridge, then reimplement that contract behind Tauri 2 one capability area at a time.
