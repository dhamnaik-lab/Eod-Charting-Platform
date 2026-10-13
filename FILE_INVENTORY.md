# FILE_INVENTORY

## October 13 Layout Mode Persistent Chrome & Timeframe Cleanup Inventory Update

<!-- LAYOUT-MODE-PERSISTENT-CHROME-AND-TF-CLEANUP-OCT13-INVENTORY -->

> **Layout Mode Persistent Chrome, Right Tool Dock & Timeframe Cleanup — 13 October 2026.**  
> Uncoupled `<Toolbar />` and `<ChartToolDock />` from single-mode branches to keep the top Header dock and right Tool dock permanently visible across all layout modes. Removed redundant timeframe button groups from individual tile headers, added active chart focus ring/glow, click-to-activate, and eager tab hydration. All validation gates passed (`typecheck:renderer` 0 errors, 100/100 chart tests passed).

### Added Files
- `docs/changes/2026-10-13_2035_IST_LAYOUT_MODE_PERSISTENT_CHROME_AND_TIMEFRAME_CLEANUP.md` — Full execution and architecture report.

### Modified Files
- `src/RootApp.tsx` — Unlocked `<Toolbar />` to stay permanently docked at the top in all layout modes; wrapped workspace row so `<ChartToolDock />` is permanently available on the right rail; updated `tileCellStyle(isActive)` with blue focus border and glow; wired tile click activation.
- `src/components/TileHeader.tsx` — Removed redundant `D W M Q Y` timeframe buttons; added active accent dot indicator to the active tile.
- `src/components/ChartCanvas.tsx` — Added tab activation on canvas `onMouseDownCapture`.
- `src/features/charts/chartTabSessionController.ts` — Eagerly hydrates visible tabs upon switching to tiled layout mode.
- `HANDOFF.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md` — Canonical documentation updated.

## October 13 SheetTabs Numeric Sizing & Deprecated Theme Removal Inventory Update

<!-- SHEET-TABS-AND-THEME-REMOVAL-OCT13-INVENTORY -->

> **SheetTabs Numeric Sizing, Typography Polish & Deprecated Theme Cleanup — 13 October 2026.**  
> Formatted default sheet names (`Sheet 1` -> `1`), compacted chip minWidth to 32px, boosted font to 12px bold, and completely removed 3 deprecated themes (`bloomberg-pro`, `orderflow-dark`, `terminal-pro-dark`). All validation gates passed (`typecheck:renderer` 0 errors, 164/164 test suites passed).

### Modified Files
- `src/components/SheetTabs.tsx` — Numeric sheet formatting (`formatSheetLabel`), compact 32px minWidth, 12px bold font, proportional close and add buttons.
- `src/features/app/themeService.ts` — Removed `bloomberg-pro`, `orderflow-dark`, and `terminal-pro-dark` definitions.
- `src/styles/global.css` — Removed deprecated CSS theme blocks.

## October 13 Light Theme Grid Line & Crosshair Preservation Inventory Update

<!-- LIGHT-THEME-GRID-FIX-OCT13-INVENTORY -->

> **Light Theme Grid Line & Crosshair Preservation Fix — 13 October 2026.**  
> Guarded against global dark default fallbacks (`#1e2a3a` for grid, `#5588aa` for crosshair) in `getChartTheme`, preserving native subtle light grid lines and crosshair on light themes. All validation gates passed (`typecheck:renderer` 0 errors, Vitest passed).

### Added Files
- `docs/changes/2026-10-13_1525_IST_LIGHT_THEME_GRID_LINE_PRESERVATION_FIX.md` — Technical report for light theme grid and crosshair preservation.

### Modified Files
- `src/features/app/themeService.ts` — Theme-aware default grid/crosshair fallback preservation.
- `src/engine/__tests__/ChartTheme.test.ts` — Added unit test for light theme grid line preservation.

## October 13 Code Protection & Display Sync Architectural Hardening Inventory Update

<!-- CODE-PROTECTION-AND-DISPLAY-SYNC-OCT13-INVENTORY -->

> **Code Protection, Strict TypeScript Interface Locks & Display Sync Isolation — 13 October 2026.**  
> Eliminated silent unwiring and collateral damage by requiring `theme` & `visualSettings` in `ChartEngineConfig`, adding automated theme regression tests, and isolating display state synchronization into `useChartDisplaySync`. All validation gates passed (`typecheck:renderer` 0 errors, 1,042/1,042 tests passed).

### Added Files
- `src/features/charts/useChartDisplaySync.ts` — Dedicated, strictly-typed display synchronization hook requiring all display settings.
- `docs/changes/2026-10-13_1430_IST_CODE_PROTECTION_AND_DISPLAY_SYNC_HARDENING.md` — Full architectural hardening and anti-regression report.

### Modified Files
- `src/engine/types.ts` — Made `theme: ChartTheme` and `visualSettings: ChartVisualSettings` strictly mandatory in `ChartEngineConfig`.
- `src/engine/ChartEngine.ts` — Constructor requires config object without empty-object fallback (`config: ChartEngineConfig = {}` &rarr; `config: ChartEngineConfig`).
- `src/engine/__tests__/ChartTheme.test.ts` — Added unit test ensuring custom candle, wick, and volume colors survive `resolveChartTheme` untouched.
- `src/components/ChartCanvas.tsx` — Replaced 11 loose `useEffect` blocks with a single type-checked `useChartDisplaySync` invocation.
- `HANDOFF.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md` — Canonical documentation updated.

## October 13 Dedicated Symbol Search & Workflow Enhancements Inventory Update

<!-- DEDICATED-SYMBOL-SEARCH-OCT13-INVENTORY -->

> **Dedicated Symbol Search, SQLite Search Controller Wiring & Floating Window Ergonomics — 13 October 2026.**  
> High-speed instrument search triggered via single-key `S`, exchange filters (`All`, `NSE`, `BSE`), recent symbols fallback, fixed stable dimensions (580px × 480px), and modeless window dragging. All validation gates passed (`typecheck:renderer` 0 errors, Vitest passed).

### Added Files
- `docs/changes/2026-10-13_1145_IST_NUMERIC_SHEETS_TF_DOCK_ZOOM_RESET_COLLAPSIBLE_FAVORITES_AND_S_KEY_SEARCH.md` — Technical report for numeric sheets, timeframe dock, auto zoom reset, and collapsible favorites.
- `docs/changes/2026-10-13_1225_IST_DEDICATED_SYMBOL_SEARCH_AND_SEARCH_CONTROLLER_FIX.md` — Full execution and validation report for dedicated symbol search, search controller bug fix, and draggable floating window geometry.

### Modified Files
- `src/features/charts/chartSearchController.ts` — Synchronously updates `searchQuery` state before SQLite queries to fix silent drop of search results.
- `src/store/uiStore.ts` — Added `commandPaletteMode: 'all' | 'symbol'`, mode-aware open/toggle handlers, and custom chart color setter.
- `src/components/CommandPalette.tsx` — Implemented single-key `S` hotkey, pure symbol list rendering, exchange pills, series badges, recently viewed symbols fallback, fixed 580px × 480px geometry, and header dragging via `useDraggableFloatingWindow`.
- `src/components/SheetTabs.tsx` — Numeric sheet naming (`1, 2...`) with user title preservation.
- `src/features/workspace/workspacePersistence.ts` — Numeric fallback default for persisted sheets.
- `src/components/ChartHeader.tsx` — Removed `TF` label and expanded hover tooltips to full timeframe names (`Daily`, `Weekly`, etc.).
- `src/components/TileHeader.tsx` — Updated timeframe tooltips to full names.
- `src/features/charts/chartTabStateMutationService.ts` — Viewport auto zoom reset (`createDefaultViewport`) across timeframe switches.
- `src/components/Sidebar.tsx` — Collapsible Favorites section with persistent state.
- `src/components/KeyboardShortcutsDialog.tsx` — Documented `S` symbol search shortcut.
- `HANDOFF.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `README.md`, `FILE_INVENTORY.md` — Canonical documentation updated.

## October 12 Technical and UX Audit (Phases 1, 2, and 3) Inventory Update

<!-- TECHNICAL-AND-UX-AUDIT-OCT12-INVENTORY -->

> **Technical and UX Audit Phases 1, 2, and 3 Closure — 12 October 2026.**  
> Execution of performance optimizations, UI modernization (left rail tool dock, 24px/11px status bar, 4-cluster toolbar), and formal plugin architecture with fault-isolated `PluginHost`. All validation gates passed (typecheck 0 errors, 21/21 Vitest tests, production Vite build in 5.10s).

### Added Files
- `src/plugins/pluginHost.ts` — `PluginHost` managing registration, lifecycle execution, fault isolation, and logging.
- `src/plugins/__tests__/pluginHost.test.ts` — Comprehensive unit test suite for `PluginHost`.
- `docs/changes/2026-10-12_2245_IST_TECHNICAL_AND_UX_AUDIT_PHASES_1_2_3_COMPLETION.md` — Full execution and validation report.

### Modified Files
- `package.json` — Removed dead packages (`axios`, `unzip-stream`, `@types/unzip-stream`).
- `src/engine/ChartEngine.ts` — Added `isOverlayDirty` flag to throttle idle canvas overlay loop.
- `src/features/charts/chartTabStateMutationService.ts` — Memoized hover bar mutation.
- `src/store/chartStore.ts` — Preserved tab array identity on hover to stop re-render cascades.
- `src/components/ChartCanvas.tsx` — Split mega-effect into targeted hooks; added hover date deduplication ref.
- `src/RootApp.tsx` — Reordered layout for left-rail `ChartToolDock`.
- `src/components/ChartToolDock.tsx` — Aligned border and flyout offsets for left rail ergonomics.
- `src/components/StatusBar.tsx` — Redesigned with 24px height, 11px typography, and status dot/mono badges.
- `src/components/Toolbar.tsx` — Harmonized heights to 24–26px; organized into 4 distinct functional clusters.
- `src/components/ChartHeader.tsx` — Defragmented inline timeframes and removed duplicate box styling.
- `src/plugins/types.ts` — Added `PluginContext`, `ChartPluginLifecycle`, `PluginRuntimeInfo`, `PluginLogEntry`.
- `src/plugins/registry.ts` — Bound singleton `pluginHost` while preserving backward compatibility.
- `src/plugins/analysis/gannPriceTime/gannPlugin.ts` — Attached standard lifecycle hooks.
- `HANDOFF.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md` — Canonical documentation updated.

## August 24 Corporate Action final closure checkpoint

<!-- CA-V1.14M.2-AUG24-CANONICAL-CLOSURE -->

> **Corporate Action exact three-row repair closure — 24 August 2026.**  
> V1.14M.2 independently re-derived the committed V1.14M.1.1 state from a fresh private read-only snapshot and returned **`FULL_SUCCESS`**. The exact three-row production-candidate repair workstream is therefore **`CLOSED / FULL_SUCCESS`**. This closes only this audited three-row repair tranche; it does not declare all Corporate Action work complete.

- Production Corporate Action source SHA-256: `2e05315fa4bf7fe78f28e787edd2bd9a1fef23fb06cab66cc79c8ede9a1b5cfb`.
- Final repaired imports: `43286 PDSL / INE111Q01013`, `43419 ANDHRAPAP / INE435A01028`, `43501 AVANTIFEED / INE871C01012`.
- All three remain `PENDING_ISIN_MISMATCH` and unapproved; the historical official event ISINs are preserved.
- Old dedupe keys are absent; each new production dedupe key has exactly one owner.
- Target post-state fingerprint: `829f70a4714b24516282399c1ba880c87c0e733841d589a3745a106592ff532a`.
- Non-target import fingerprint: `ef1450c462e1192664ed7c0adad472cb27e79529a88e4d2a7c81c8fec270258a`.
- Protected-table fingerprint: `252c70ac7231c288320b24916ec640cad1c741c4095bbe32efafcffc69f2bbd4`.
- Schema-safety fingerprint: `64246fe499d3093a52901bcddd26447e350cd08eb7457f80227fdd56715a10f2`.
- V1.14M Apply-plan fingerprint: `5981c3ebd141f443af2cf38f69ae3f704c04f97abb039973a45c44635b089f98`.
- V1.14M mutation fingerprint: `153f999d2087d396943cabffadbd3b33817055f2b1874975fb7b8d7c23723821`.
- Independent V1.14M.2 post-audit fingerprint: `817d6bbccbc02fee7b8e28770616f76eb46723c5f273763573ea9dcf6c78daa2`.
- V1.14M.2 report ZIP SHA-256: `d56b3038d55e310ff3555c3821d620c47ab37f56e1b97f5863847d74baf92e99`.
- Integrity: `quick_check=ok`; foreign-key violations `0`; V1.14M.2 database writes `0`.

### Relevant files and records

- `src-tauri-shell/src/database/corporate_action_imports.rs` — accepted production resolver source SHA-256 `2e05315fa4bf7fe78f28e787edd2bd9a1fef23fb06cab66cc79c8ede9a1b5cfb`.
- `docs/changes/2026-08-24_CORPORATE_ACTION_V1_14L_TO_V1_14M_1_1_CONTROLLED_REPAIR.md` — historical committed-pending-post-audit checkpoint; retained unchanged as contemporaneous evidence.
- `docs/changes/2026-08-24_CORPORATE_ACTION_V1_14M_2_INDEPENDENT_POST_AUDIT_CLOSURE.md` — final independent-post-audit closure record.
- `README.md`, `HANDOFF.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`, `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md` — canonical documentation updated to the final `CLOSED / FULL_SUCCESS` checkpoint for this exact tranche.
- `REQUIREMENTS.md` and `AGENTS.md` — intentionally unchanged.

## 1. Inventory boundary

This inventory is reconciled against fresh snapshot `Eod Charting Platform Source Code 2026-08-22_211417_IST`, uploaded ZIP SHA-256 `1A8F96F4BB339AE9FD1A7995F36A7D3CA4668244D3F3DC0772E6FE19D8ADC81D`. The supplied clean snapshot contains 721 files and reflects V1.7D, final zero-warning Rust cleanup, and the accepted embedded Quote Editor rollback. This documentation-only reconciliation updates seven maintained root documents and adds one dated closeout record; historical `docs/changes/*` evidence remains unchanged. Git remains deferred; source snapshots and SHA-256 guards remain the change-control baseline.

- Active renderer: `src/`.
- Active desktop backend: `src-tauri-shell/`.
- Active renderer/desktop seam: `src/platform/` and `src/types/desktop.ts`.
- Generated/dependency/output folders are not source.
- The old `src-tauri/` and Electron paths are not active.

## 2. Snapshot totals

| Area | File count in supplied August 22 snapshot | Role |
|---|---:|---|
| `src/` | 430 | React renderer, stores, chart engine, indicators/drawings, feature services, Quote Editor, scanners, Watchlists, tests |
| `src-tauri-shell/` | 48 | Rust/Tauri shell, database backend, Generation-6 state sidecar, Bhavcopy/Manual Import recovery, Corporate Actions, plugin/export support |
| `scripts/` | 9 | Validation, backup, source snapshot, metadata, portable staging, Watchlist generation/refresh helpers |
| `resources/` | 5 | Application icons plus DNN prediction/dataset schemas and sample |
| `patches/` | 1 | Historical patch reference; not active runtime source |
| Root configuration and canonical documents | 15 | npm/Vite/TypeScript/Vitest config plus eight maintained project documents |
| `docs/changes/` | 212 | Timestamped implementation/validation/audit evidence before this reconciliation |
| `docs/superpowers/` | 0 | Intentionally excluded by `scripts/Create-EOD-Source-Code-Snapshot-v3.ps1` |

The supplied ZIP contains **721 files**. This reconciliation adds one `docs/changes/` closeout record and does not add/remove runtime source, so the next clean source snapshot is expected to contain **722 files** unless unrelated files change first.

## 3. Snapshot-completeness status

The snapshot contains `.cargo/config.toml`, the warning-clean Rust source, V1.7D two-worker binary import policy, V1.7C two-worker checkpoint policy, V1.7A durability/telemetry, V1.6 incremental state publication, V1.5 Quote Editor metadata invalidation, and the restored embedded Quote Editor `FloatingWindow`. Generated/dependency/output folders and live databases remain excluded. The current operational one-row sidecar/physical difference is runtime state and therefore not represented by files inside this clean source archive.

## 4. Root source/configuration files

| Path | Role |
|---|---|
| `package.json` | npm scripts, frontend dependencies, Tauri CLI/API versions |
| `package-lock.json` | exact npm dependency lock |
| `tsconfig.json` | renderer TypeScript configuration |
| `vite.config.mts` | renderer build/dev configuration (ESM; avoids deprecated Vite CJS Node API path) |
| `vitest.config.ts` | unit-test discovery and exclusions |
| `index.html` | Vite renderer entry document |
| `.gitignore` | generated, database, backup, and local-artifact exclusions |
| `.cargo/config.toml` | Canonical repository-root Cargo target routing; present in this snapshot |

## 5. Canonical documentation

| Document | Purpose | Maintenance rule |
|---|---|---|
| `AGENTS.md` | Repository rules, scope boundaries, validation discipline | Keep compact and stable; change only when operating rules change |
| `HANDOFF.md` | Current verified state, known gaps, next action | Replace stale current-state detail; do not turn into history |
| `README.md` | Product orientation, setup/build, current baseline | Update for user-visible behaviour and build workflow changes |
| `REQUIREMENTS.md` | Product/non-functional requirements | Update when contracts or acceptance criteria change |
| `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` | Current runtime, data, scanner, storage, and build architecture | Update when ownership/data flow/build topology changes |
| `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md` | Concise implementation/verification status | Keep current and remove contradictory rows |
| `FILE_INVENTORY.md` | Active paths, critical files, snapshot completeness | Update when files/folders are added, removed, or reclassified |
| `PROJECT_STATE_EOD_CHARTING_PLATFORM.md` | Append-only verified implementation history | Add newest verified state at the top; retain old history |
| `docs/changes/` | Timestamped implementation, patch, manifest, validation, and audit evidence | Keep reports; backup copies may remain outside clean source snapshots |

## 6. Main renderer source ownership

| Path | Role |
|---|---|
| `src/main.tsx` | React entry point |
| `src/RootApp.tsx` | Persistent shell and lazy feature-window composition |
| `src/components/` | UI, dialogs, scanner windows, chart surfaces, toolbar/sidebar |
| `src/components/DatabaseToolsDialogs.tsx` | Embedded Quote Editor, merge symbols, Corporate Actions, and parity tools; Quote Editor uses `FloatingWindow` inside the main renderer |
| `src/features/quoteEditor/` | Exchange-scope/count/ellipsis helpers and focused tests; no native child-window entry point is active |
| `src/store/` | Chart, UI, workspace, window, drawing, bhavcopy state |
| `src/features/` | Business workflows and state/platform orchestration |
| `src/engine/` | Chart calculations, transforms, scales, renderer, patterns, signals |
| `src/indicators/catalog.ts` | Indicator catalog and schemas |
| `src/modules/formulaEngine/` | Controlled custom-formula engine |
| `src/plugins/scanner/` | Scanner definitions, runner, workers, pattern map, workspace, tests |
| `src/plugins/forecast/dnnTrend/` | Disabled-by-default DNN forecast contracts, precomputed adapter, viewer, and tests |
| `src/platform/` | Typed Tauri desktop and shell adapters |
| `src/types/desktop.ts` | Canonical renderer-neutral desktop contracts |
| `src/styles/global.css` | Global theme and shell styling |

## 7. Market Movers source files

| File | Role |
|---|---|
| `src/features/marketMovers/marketMoversTypes.ts` | Market Movers settings, rows, snapshot, and UI types |
| `src/features/marketMovers/marketMoversSnapshotService.ts` | Common-date selection, metrics, exclusions, warnings, deterministic ranking |
| `src/features/marketMovers/marketMoversStore.ts` | Manual scan state, dirty state, shared request, progress, cancellation, cache/coalescing |
| `src/features/marketMovers/marketMoversSnapshot.worker.ts` | Worker-side snapshot calculation |
| `src/features/marketMovers/marketMoversSnapshotWorkerClient.ts` | Worker lifecycle, request, cancellation, fallback handling |
| `src/features/marketMovers/useDailyMarketMovers.ts` | React access seam to shared Market Movers state |
| `src/features/marketMovers/MarketMoverRow.tsx` | Compact sidebar row and navigation interaction |
| `src/features/marketMovers/MarketMoversPanel.tsx` | MOV sidebar panel with Scan/Update/Cancel and filters |
| `src/features/marketMovers/MarketMoversFullView.tsx` | Expanded dual-column Gainers/Losers view |
| `src/features/marketMovers/marketMoversStyles.ts` | Shared Market Movers presentation styles |
| `src/features/marketMovers/__tests__/marketMoversSnapshotService.test.ts` | Snapshot/date/filter/ranking tests |
| `src/features/marketMovers/__tests__/marketMoversStore.test.ts` | No-auto-scan, dirty state, request sharing, progress, cancellation tests |
| `src/plugins/scanner/dailyMarketScanners.ts` | Canonical daily change and relative-volume calculation |
| `src/components/Sidebar.tsx` | MOV rail registration and panel mounting |
| `src/components/ScannerWindow.tsx` | Expanded Market Movers section and scanner navigation |
| `src/store/uiStore.ts` | One-shot request to open ScannerWindow at Market Movers |

## 8. Market Movers backend and bridge files

| File | Role |
|---|---|
| `src-tauri-shell/src/database/daily_market_snapshot.rs` | Full-universe batch retrieval, dedicated read-only connection, progress, cancellation |
| `src-tauri-shell/src/database.rs` | Module registration and re-export |
| `src-tauri-shell/src/database/eod_data.rs` | Shared bounded EOD loading/adjustment helpers |
| `src-tauri-shell/src/database/symbol_search.rs` | Active instrument lookup used by snapshot retrieval |
| `src-tauri-shell/src/main.rs` | Tauri command registration |
| `src/types/desktop.ts` | Snapshot/progress/cancel contracts |
| `src/platform/types.ts` | Narrowed desktop API surface |
| `src/platform/tauriDesktop.ts` | Tauri invoke and `daily-market-snapshot:progress` listener |

## 9. DNN trend adapter and research-export files

| Path | Role |
|---|---|
| `src/plugins/forecast/dnnTrend/types.ts` | Stable request/result and 5/10/20-session probability contracts |
| `src/plugins/forecast/dnnTrend/featureBuilder.ts` | Versioned causal completed-daily-bar feature window |
| `src/plugins/forecast/dnnTrend/inferenceProvider.ts` | Replaceable provider interface |
| `src/plugins/forecast/dnnTrend/mockInferenceProvider.ts` | Deterministic non-production contract provider |
| `src/plugins/forecast/dnnTrend/precomputedPredictionSource.ts` | Strict JSON parsing, indexing, exact lookup, stale/no-future safeguards |
| `src/plugins/forecast/dnnTrend/precomputedInferenceProvider.ts` | Exact source-backed provider with feature/revision parity |
| `src/plugins/forecast/dnnTrend/precomputedPredictionFileService.ts` | JSON-only desktop file selection/read adapter with 16 MiB limit |
| `src/plugins/forecast/dnnTrend/pluginConfiguration.ts` | DNN source-path persistence inside generic plugin configuration |
| `src/plugins/forecast/dnnTrend/DnnTrendPredictionPanel.tsx` | Settings-only read-only exact prediction viewer |
| `src/plugins/forecast/dnnTrend/predictionService.ts` / `predictionCache.ts` / `predictionValidation.ts` | Fail-closed inference lifecycle, revision-aware cache, probability validation |
| `src/plugins/forecast/dnnTrend/dnnTrendPlugin.ts` / `index.ts` | Bundled disabled-by-default plugin registration and exports; current manifest version `0.3.0` |
| `src/plugins/forecast/dnnTrend/dnnResearchDatasetExportService.ts` | Safe full-export defaults, output-folder selection, progress subscription, invocation, result summary |
| `src/plugins/forecast/dnnTrend/__tests__/` | Foundation, source, provider, configuration, and research-export service tests |
| `resources/dnn-trend/` | Prediction JSON Schema/sample plus research-dataset manifest Schema and external producer/export contract notes |
| `src-tauri-shell/src/plugin_data.rs` | Generic bounded plugin-data picker, output-folder picker, and UTF-8 text reader |
| `src-tauri-shell/src/database/dnn_research_export.rs` | Dedicated read-only, identity-aware, hybrid/binary, adjusted OHLCV dataset export with atomic publication and explicit failures |
| `src/features/app/appSettingsService.ts` / `src-tauri-shell/src/app_profile.rs` | Generic persisted `pluginConfigurations` seam |
| `src/components/SettingsDialog.tsx` | Validation-gated enablement, source controls, metadata/viewer, and full research-dataset export action/progress |

## 10. Active Tauri/backend areas

| Path | Role |
|---|---|
| `src-tauri-shell/Cargo.toml` / `Cargo.lock` | Rust dependencies and exact lock state |
| `src-tauri-shell/tauri.conf.json` | Tauri app/build/bundle configuration |
| `src-tauri-shell/build.rs` | Tauri build integration and asset/build invalidation |
| `src-tauri-shell/src/main.rs` | Shell entry, menu, command registry |
| `src-tauri-shell/src/runtime.rs` | System/portable runtime paths and logging |
| `src-tauri-shell/src/app_profile.rs` | Application-profile storage, including generic plugin configurations |
| `src-tauri-shell/src/plugin_data.rs` | Bounded generic plugin-data file selection, native output-folder selection, and UTF-8 text reading |
| `src-tauri-shell/src/database/` | Database lifecycle, schema, EOD, symbols, actions, watchlists, settings, parity |
| `src-tauri-shell/src/database/eod_binary_state.rs` | Generation-6 VERIFIED sidecar, localized invalidation, incremental publication, and test-gated bootstrap/census helpers |
| `src-tauri-shell/src/database/quotes.rs` | Quote Editor CRUD/date-range mutation, metadata invalidation, localized state-row removal, identity-preserving delete semantics |
| `src-tauri-shell/src/database/binary_eod.rs` | Canonical `.eod` format, immediate new/full-file sync, buffered APPEND_NEWEST classification and diagnostics |
| `src-tauri-shell/src/imports.rs` | CSV import/export and progress |
| `src-tauri-shell/src/manual_import_recovery.rs` | Durable Binary Manual Import recovery sessions, before/after row journal, conflict-safe undo, and session-created instrument rollback |
| `src-tauri-shell/src/bhavcopy.rs` | NSE/BSE download, Generation-6 baseline/classification fast paths, four-worker coverage prefilter, two-worker binary import/write policy, diagnostics, and background checkpoint scheduling |
| `src-tauri-shell/src/bhavcopy_recovery.rs` | Durable journal/baselines, resumable APPLIED/CHECKPOINTING verification, two-worker checkpoint, phase/latency telemetry, and post-checkpoint incremental VERIFIED publication |
| `src-tauri-shell/gen/` | Generated build metadata consumed by the shell |
| `src-tauri-shell/icons/` / `capabilities/` | Tauri packaging/runtime assets |

## 11. Build and operational scripts

| File | Role |
|---|---|
| `scripts/prepare-tauri-portable.ps1` | Stages portable app from root release executable and verifies SHA-256 |
| `scripts/generate-build-metadata.cjs` | Generates version/build metadata before Tauri builds |
| `scripts/validate-change.ps1` | Focused serial validation profiles |
| `scripts/check-doc-references.ps1` | Documentation reference checks aligned to the eight maintained root documents; append-only `PROJECT_STATE_EOD_CHARTING_PLATFORM.md` is presence-checked but excluded from current-reference resolution because it intentionally retains historical references |
| `scripts/create-project-backup.ps1` | Pre-change backup helper |
| `scripts/prune-backups.ps1` | Backup retention review/pruning helper |

## 12. Recent Bhavcopy and recovery evidence

| `docs/changes/2026-08-22_2114_IST_STORAGE_QUOTE_EDITOR_WARNING_CLEANUP_CLOSEOUT.md` | August 20–22 V1.5–V1.7D, warning cleanup, Quote Editor embedded-window rollback, runtime evidence, current state gap, and documentation closeout |
| Path | Role |
|---|---|
| `docs/changes/2026-08-09_1450_IST_MANUAL_IMPORT_RECOVERY_SESSIONS_V1.md` | Provenance-scoped Binary Manual Import recovery/undo foundation |
| `docs/changes/2026-08-09_1702_IST_MANUAL_IMPORT_RECOVERY_HISTORY_V1_2.md` | Persisted newest-first Manual Import recovery history |
| `docs/changes/2026-08-09_2110_IST_BHAVCOPY_RECOVERY_HARDENING_PHASE2B_1_V1.md` | Exact pre-import APPEND_NEWEST binary boundary and conflict-safe rollback hardening |
| `docs/changes/2026-08-09_2323_IST_BHAVCOPY_APPEND_NEWEST_BUFFERED_DURABILITY_PHASE2C_V1.md` | Journal-governed APPEND_NEWEST buffered durability |
| `docs/changes/2026-08-10_0145_IST_BHAVCOPY_COMPACT_PROGRESS_UI_FIX_V1.md` | Renderer-only compact Bhavcopy progress/status presentation |
| `docs/changes/2026-08-10_BSE_INDEX_LITERAL_DATE_URL_FIX_V1.md` | BSE Index literal `DD/MM/YYYY` archive request fix |
| `docs/changes/2026-08-10_1212_IST_BHAVCOPY_FINAL_ACCEPTANCE_AND_DOCUMENTATION_RECONCILIATION.md` | Earlier consolidated Windows runtime acceptance; its "Phase 2D not required" conclusion is superseded by August 12–13 production evidence. |
| `docs/changes/2026-08-10_1235_IST_FINAL_DOCUMENTATION_AUDIT_V2.md` | Earlier documentation consistency audit and validator alignment. |
| `docs/changes/2026-08-12_2102_IST_BHAVCOPY_INTERRUPTED_CHECKPOINT_RESUME_FIX_V1.md` | APPLIED/CHECKPOINTING resumable checkpoint-state correction. |
| `docs/changes/2026-08-12_2353_IST_BHAVCOPY_PHASE2D_BACKGROUND_CHECKPOINT_V1.md` | Automatic bounded background deferred checkpoint architecture. |
| `docs/changes/2026-08-13_0030_IST_BHAVCOPY_UPDATE_SAME_DAY_CUTOFF_V1.md` | Automatic Update current-day 18:00 local cutoff. |
| `docs/changes/2026-08-13_0232_IST_BHAVCOPY_CALENDAR_SAFETY_V1_1.md` | Exchange-aware special-session/weekend/holiday precedence and source-miss wording. |
| `docs/changes/2026-08-13_1305_IST_BHAVCOPY_PREFILTER_RANGE_SCAN_V1.md` | Bounded range-read binary prefilter reconciliation. |
| `docs/changes/2026-08-13_1555_IST_BHAVCOPY_BSE_INDEX_CANDIDATE_CLASSIFICATION_V1_1.md` | Soft candidate mismatch vs genuine hard-error terminal classification. |
| `docs/changes/2026-08-13_1658_IST_BHAVCOPY_FINAL_DOCUMENTATION_RECONCILIATION_V3.md` | Current canonical August 13 Bhavcopy reconciliation and final runtime evidence. |

## 13. Fibonacci completion source and evidence

| Path | Role |
|---|---|
| `src/engine/DrawingFibonacciContracts.ts` | Persisted Fibonacci settings contracts, including `fibSpiral` and `fibFan` settings |
| `src/engine/DrawingFibonacciDefaults.ts` | Canonical Fibonacci default levels; F1E `fibFan` price/time defaults are `[0, 0.25, 0.382, 0.5, 0.618, 0.75, 1]` |
| `src/engine/DrawingFibonacciMigration.ts` | Legacy/default normalization while preserving accepted F1D.1 spiral fields |
| `src/engine/DrawingF1BGeometry.ts` / `DrawingF1BRuntime.ts` / `DrawingF1BAutoscale.ts` | Linear/time Fibonacci level geometry, runtime level/style options, and retracement autoscale rules |
| `src/engine/DrawingF1CGeometry.ts` | Accepted Fib Circles, Speed Resistance Arcs, and data-space-first Fib Wedge geometry |
| `src/engine/DrawingF1DGeometry.ts` | Accepted Fib Spiral F1D.1 data-space geometry and persisted perpendicular basis; no F1D.2 absolute-time basis |
| `src/engine/DrawingF1EGeometry.ts` | Accepted Fib Speed Resistance Fan geometry for persisted kind `fibFan`; exact projected anchor-to-Fibonacci-target rays plus shared hit-test geometry |
| `src/engine/Renderer.ts` / `src/engine/ChartEngine.ts` | Fibonacci render dispatch, presentation, creation/editing, and hit-test integration |
| `src/engine/__tests__/DrawingF1EGeometry.test.ts` | F1E defaults, orientation/reverse, disabled levels, zoom/auto-scale invariance, nonlinear-scale collinearity, and hit-test coverage |
| `docs/changes/2026-08-13_2105_IST_FIBONACCI_FINAL_DOCUMENTATION_RECONCILIATION_V1.md` | Family-complete acceptance, rollback decisions, final F1E.1 evidence, and Gann handoff boundary |

The `Fibonacci / Gann` dock group currently contains eleven Fibonacci kinds plus `gann` and `gannBox`. The persisted kind remains `fibFan`; current metadata still titles that kind `Fibonacci Fan`, while its accepted F1E geometry is the Fib Speed Resistance Fan implementation. This documentation pass intentionally does not rename the persisted kind or alter runtime UI strings.

## 14. Non-source and excluded paths

- `node_modules/`
- `dist/`
- `release/`
- root `target/`
- legacy `src-tauri-shell/target/`
- `.git/`
- databases and `EOD DATABASE/`
- `backups/`
- logs, caches, temporary files, installers, executables, archives, and runtime data

These paths may be needed for validation, packaging, or recovery, but they are not source-code inputs and should not be copied into clean source snapshots.

## 19. Official Watchlists lazy-data runtime (W1.3)

| Path | Role |
|---|---|
| `scripts/split-official-watchlist-data.mjs` | Deterministically splits the canonical Official Watchlist snapshot into four source-specific runtime payloads and a six-source metadata-only catalog; `--check` verifies committed parity. |
| `src/features/watchlists/generated/officialWatchlistCatalog.generated.ts` | Synchronously loaded six-source metadata catalog; group metadata carries `memberCount` and no constituent arrays. |
| `src/features/watchlists/generated/officialWatchlistNseSectors.generated.ts` | Lazy snapshot payload for `nse-sectors` only. |
| `src/features/watchlists/generated/officialWatchlistNseIndices.generated.ts` | Lazy snapshot payload for `nse-indices` only. |
| `src/features/watchlists/generated/officialWatchlistBseSectors.generated.ts` | Lazy snapshot payload for `bse-sectors` only. |
| `src/features/watchlists/generated/officialWatchlistBseIndices.generated.ts` | Lazy snapshot payload for `bse-indices` only. |
| `src/features/watchlists/nseSectorUniverseWatchlistData.generated.ts` | Canonical and lazy runtime payload for `nse-all-stocks-sectors`. |
| `src/features/watchlists/bseSectorUniverseWatchlistData.generated.ts` | Canonical and lazy runtime payload for `bse-all-stocks-sectors`. |
| `src/features/watchlists/officialWatchlistLazyLoader.ts` | Session-memory source loader cache with in-flight deduplication and rejected-promise eviction. |
| `src/features/watchlists/officialWatchlistDialogSourceState.ts` | Pure request-ID reducer for dialog `idle/loading/ready/error` source-data state and stale-completion rejection. |
| `src/features/watchlists/officialWatchlistProviders.ts` | Metadata-only synchronous provider facade plus six source-selective lazy payload loaders; preserves live-fetch/snapshot fallback semantics. |
| `src/components/OfficialWatchlistImportDialog.tsx` | Metadata-first Official Watchlist UI with source-selective loading, Retry, stale-response protection, and ready-only import gating. |
| `src/features/watchlists/__tests__/officialWatchlistDataSplit.test.ts` | Canonical/generated parity, catalog no-members, and deterministic generation tests. |
| `src/features/watchlists/__tests__/officialWatchlistLazyLoader.test.ts` | Source isolation, in-flight dedupe, session cache, rejection eviction, and retry tests. |
| `src/features/watchlists/__tests__/officialWatchlistDialogSourceState.test.ts` | Reducer loading/error/current-vs-stale request tests. |
| `src/components/__tests__/OfficialWatchlistImportDialog.sourceContract.test.ts` | Source-contract assertions for loading/retry/selection clearing/import gating without a DOM-test dependency. |

## 20. Chart runtime static bundle partition (W1.4)

| Path | Role |
|---|---|
| `vite.config.mts` | ESM Vite configuration exporting the production `classifyManualChunk()` classifier; W1.4 partitions chart core, chart analysis, and `technicalindicators` without asynchronous runtime changes. |
| `src/engine/__tests__/ViteChartChunkPartition.test.ts` | Direct production-classifier regression covering W1.4 chart chunk boundaries, Windows path normalization, and W1.3 Watchlist preservation. |
| `docs/changes/2026-08-16_CHART_RUNTIME_STATIC_PARTITION_W1_4.md` | W1.4 architecture, safety boundaries, validation gates, and authoritative bundle measurements. |
| `docs/superpowers/plans/2026-08-16-chart-runtime-static-partition-w1-4-plan.md` | Approved task-by-task implementation and validation plan for W1.4. |

## 21. ChartCanvas static bundle extraction (W1.4-B1)

| Path | Role |
|---|---|
| `vite.config.mts` | W1.4-B1 gives exact `src/components/ChartCanvas.tsx` ownership to synchronous `feature-chart-canvas` before the broader `feature-chart-core` rule; no runtime import behavior changes. |
| `src/engine/__tests__/ViteChartChunkPartition.test.ts` | Production-classifier regression covering POSIX and Windows `ChartCanvas.tsx` ownership while preserving the W1.4.1 TS5097-safe dynamic config import. |
| `docs/changes/2026-08-17_CHART_CANVAS_STATIC_EXTRACTION_W1_4_B1.md` | W1.4-B1 scope, safety contract, bundle stop gates, and Windows validation evidence. |
| `docs/superpowers/plans/2026-08-17-chart-canvas-static-extraction-w1-4-b1-plan.md` | Approved implementation and validation plan for W1.4-B1. |

## 22. Warning-cleanup evidence (W1.1-W1.4-B1)

| Path | Role |
|---|---|
| `docs/changes/2026-08-16_RUST_WARNING_HYGIENE_W1_1.md` | W1.1 Rust warning cleanup scope/evidence; final W1.1 validation denies warnings in the targeted Rust paths |
| `docs/changes/2026-08-16_VITE_ESM_CONFIG_W1_2.md` | W1.2 Vite ESM config migration and CJS deprecation removal |
| `docs/changes/2026-08-16_OFFICIAL_WATCHLISTS_LAZY_DATA_W1_3.md` | W1.3 source-selective Watchlist payload architecture |
| `docs/changes/2026-08-16_CHART_RUNTIME_STATIC_PARTITION_W1_4.md` | W1.4 chart-core / analysis / vendor partition |
| `docs/changes/2026-08-17_CHART_RUNTIME_STATIC_PARTITION_W1_4_1_TEST_TYPECHECK_FIX.md` | Test-only TS5097 correction while preserving W1.4 production config |
| `docs/changes/2026-08-17_CHART_CANVAS_STATIC_EXTRACTION_W1_4_B1.md` | Final ChartCanvas extraction and <=500 kB chart-chunk acceptance |

## 23. Corporate Actions V1.9.2 identity-bootstrap boundary

| Path | Role |
|---|---|
| `src-tauri-shell/src/database/corporate_action_imports/historical_isin_bootstrap.rs` | Controlled historical-ISIN candidate validation, preview/apply maintenance path, reporting, and tests |
| `docs/changes/2026-08-16_CORPORATE_ACTION_PHASE1_CONTROLLED_HISTORICAL_ISIN_BOOTSTRAP_V1_9_2.md` | Authorized 283-row safe-set design/application boundary; 281 exact-date tuple dedupe |
| `docs/changes/2026-08-16_CORPORATE_ACTION_PHASE1_CONTROLLED_HISTORICAL_ISIN_BOOTSTRAP_V1_9_2_2_RUST_LIFETIME_FIX.md` | Rust lifetime correction with unchanged V1.9.2 scope |
| `docs/changes/2026-08-16_CORPORATE_ACTION_PHASE1_CONTROLLED_HISTORICAL_ISIN_BOOTSTRAP_V1_9_2_3_REPORTING_RECOVERY_FIX.md` | Reporting-only recovery fix; zero-write Preview independently verified all 283 as already applied |

The V1.9.2 bootstrap is identity-evidence infrastructure and does **not** imply Corporate Action approval. Historical residual evidence (9 `COMPANY_IDENTITY_MISMATCH`, 3 `CONFLICTING_ISIN_HISTORY`, 49 earlier `NO_CANDIDATE`) must be re-measured by the next read-only audit before further Corporate Actions work.

## 24. Corporate Actions V1.12.1 final identity-audit closeout

| Authority / path | Role |
|---|---|
| `tmp/corporate-action-v1-12-pass1_20260818_004434/reports` | Refreshed read-only Pass-1 authority for the exact 111 residual identity blockers |
| `tmp/corporate-action-v1-12-1-final_20260818_011520_117/reports` | Accepted V1.12.1 final classification reports: 111/111, 14 SAFE, 97 manual/unresolved |
| `docs/changes/2026-08-18_CORPORATE_ACTION_PHASE1_V1_12_1_FINAL_IDENTITY_AUDIT_CLOSEOUT.md` | Dated V1.11 → V1.12 → V1.12.1 closeout, fingerprints, Windows path correction, and zero-write acceptance |
| `docs/superpowers/specs/2026-08-18-corporate-action-v1-12-1-documentation-reconciliation-design.md` | Documentation-only reconciliation design against the August 18 fresh source snapshot |
| `docs/superpowers/plans/2026-08-18-corporate-action-v1-12-1-documentation-reconciliation-plan.md` | Guarded documentation-only apply and validation plan |

Accepted fingerprints: residual ID `8a42afa94287f2c80531020d6df80030229f647f86d3419a55ab94d8d5272bef`; residual business `2e53917f05386379e4fb034f8a2e7a814bd4bca33ec6fa84e44668bb52482b72`; classification `f840120706f2450e8235beed6db63edf1a1b4b06f984d64f2eb90900a1149543`; SAFE candidates `4211d104b21bb44837e15ef57a851380b615d557782fb8b7ebae11091550f58e`.

V1.12.1 is a read-only closeout and authorizes no write by itself. V1.13 remains a separately governed future mutation phase.

## 25. Current canonical documentation reconciliation

| Path | Role |
|---|---|
| `docs/superpowers/specs/2026-08-17-canonical-documentation-reconciliation-design.md` | Approved Option-A design: canonical/current-authority reconciliation only; historical evidence untouched; Git deferred |
| `docs/superpowers/plans/2026-08-17-canonical-documentation-reconciliation-plan.md` | Guarded documentation-only implementation and validation plan |
| `docs/changes/2026-08-17_CANONICAL_DOCUMENTATION_RECONCILIATION.md` | Dated record of the August 17 canonical status reconciliation |

## 26. August 20–22 storage, warning-clean, and Quote Editor closeout

| Path | Role |
|---|---|
| `src-tauri-shell/src/database/eod_binary_state.rs` | Warning-clean Generation-6 state-index implementation; production incremental/open-existing surface retained, bootstrap/census-only APIs test-gated |
| `src-tauri-shell/src/database/quotes.rs` | V1.5 metadata invalidation and V1.6 localized sidecar invalidation for Quote Editor mutations |
| `src-tauri-shell/src/database/binary_eod.rs` | V1.7A immediate new/full-file `sync_data()` before rename and existing APPEND_NEWEST durability behavior |
| `src-tauri-shell/src/bhavcopy.rs` | V1.3/V1.4 fast paths; binary import/write cap 2; prefilter cap 4 |
| `src-tauri-shell/src/bhavcopy_recovery.rs` | checkpoint cap 2, verify/sync/publish telemetry, incremental VERIFIED publication |
| `src/components/DatabaseToolsDialogs.tsx` | Accepted embedded Quote Editor `FloatingWindow`, exchange scopes, ALL counts, and display behavior |
| `docs/changes/2026-08-22_2114_IST_STORAGE_QUOTE_EDITOR_WARNING_CLEANUP_CLOSEOUT.md` | Dated closeout and evidence summary |

## 27. Current August 22 source snapshot and documentation reconciliation

- Basis: `Eod Charting Platform Source Code 2026-08-22_211417_IST`.
- Uploaded ZIP SHA-256: `1A8F96F4BB339AE9FD1A7995F36A7D3CA4668244D3F3DC0772E6FE19D8ADC81D`.
- Snapshot files before reconciliation: 721.
- Expected next clean snapshot after adding the closeout record: 722, absent unrelated changes.
- Post-rollback runtime-validation portable SHA-256: `7C3E92E77ABBAD314F795C73577AED453E4641E6EB9C557C689019F14091847B`; final post-documentation build hash remains pending.
- Live operational state is not archived in the source ZIP: Generation 6 COMPLETE, 24,535 VERIFIED sidecar rows, 24,536 physical `.eod` files, SQLite integrity `ok`, recovery sessions 0; one-row reconciliation pending.

<!-- V1.13-FINAL-CLOSEOUT:BEGIN -->
## Corporate Actions Phase 1 — V1.13 six-row identity repair closeout (2026-08-19)

### V1.13 Corporate Actions closeout evidence

| Path | Role |
|---|---|
| `tmp/corporate-action-v1-13b-1-preflight_20260818_144646_557/reports/` | Original READY six-row Preflight authority |
| `backups/pre_corporate_action_v1_13b1_apply_20260818_170635_303/` | Verified pre-write database-family backup |
| `tmp/corporate-action-v1-13b-1-apply_20260818_170635_303/reports/` | Controlled Apply result; six committed history inserts |
| `tmp/corporate-action-v1-13c-1-2-1-post-audit_20260819_003421_289/reports/` | Independent post-audit and `FULL_SUCCESS` verification |
| `docs/changes/2026-08-19_CORPORATE_ACTION_PHASE1_V1_13_FINAL_DOCUMENTATION_EVIDENCE_RECONCILIATION.md` | V1.13 final documentation reconciliation record |
| `docs/changes/evidence/2026-08-19-corporate-action-v1-13-final-closeout.json` | Machine-readable closeout evidence and SHA-256 ledger |
<!-- V1.13-FINAL-CLOSEOUT:END -->

<!-- V1.14E-SOURCE-IMPLEMENTATION:BEGIN -->
## V1.14E Corporate Action event-identity files

| File | Responsibility |
|---|---|
| `src-tauri-shell/src/database/corporate_action_imports/event_identity_authority.rs` | Exact embedded 184-event authority validation and deterministic candidate-set fingerprint |
| `src-tauri-shell/src/database/corporate_action_imports/v114e_event_identity_authority.json` | Frozen 184-event / 44-chain authority derived from reviewed V1.14C + V1.14D.1 reports |
| `src-tauri-shell/src/database/corporate_action_imports/event_identity_resolution.rs` | Dedicated resolution schema helper, table-absence fallback projection, list API internals, strict idempotent insert |
| `src-tauri-shell/src/database/corporate_action_imports/event_identity_maintenance.rs` | Controlled V1.14E Preflight/Apply maintenance path and transaction/fingerprint guards |
| `src/features/corporateActions/corporateActionEventIdentityPresentation.ts` | Pure renderer presentation helpers for raw vs historical event identity |
| `src/features/corporateActions/__tests__/corporateActionEventIdentityPresentation.test.ts` | V1.14E renderer presentation regressions |
| V1.14E external operational package — **Run-V1-14E-Preflight.ps1** | Private-snapshot read-only live-state Preflight; package artifact is not retained in the clean source tree |
| V1.14E external operational package — **Run-V1-14E-Controlled-Apply.ps1** | Explicitly gated atomic live resolution-table Apply; package artifact is not retained in the clean source tree |
| V1.14E external operational package — **Run-V1-14E-Post-Audit.ps1** | Independent read-only post-Apply verification; package artifact is not retained in the clean source tree |
<!-- V1.14E-SOURCE-IMPLEMENTATION:END -->

## 28. Gann Price-Time Analysis plugin source files (2026-09-14)

| Path | Role |
|---|---|
| `src/plugins/analysis/gannPriceTime/types.ts` | Pure TypeScript contracts — `GannBar`, `GannPivot`, `GannPivotPolarity`, `GannAngleRay`, `SquareOfNineLevel`, `GannCycleSignal`, `GannBreakoutStatus`, `GannSetup`, `GannPluginOptions`, `GannCoordinateMapper` |
| `src/plugins/analysis/gannPriceTime/engine.ts` | Pure computational engine — `computeATR`, `detectPivots`, `computeSquareOfNineLevels`, `computeAngleRays`, `computeCycleSignals`, `computeGannSetup`, `DEFAULT_GANN_OPTIONS`; zero external dependencies |
| `src/plugins/analysis/gannPriceTime/canvasOverlay.ts` | Canvas 2D renderer — angle ray diagonals, Square of Nine dashed horizontal levels, time cycle verticals and breakout highlight boxes; full `ctx.save()`/`ctx.restore()` isolation |
| `src/plugins/analysis/gannPriceTime/gannPlugin.ts` | `RegisteredPlugin` manifest — `id: 'gann-price-time'`, `type: 'indicator'`, `status: 'bundled'`, `defaultEnabled: true` |
| `src/plugins/analysis/gannPriceTime/__tests__/gannEngine.test.ts` | 28 deterministic Vitest unit tests covering all 6 engine functions; uses sinusoidal synthetic bars to guarantee detectable pivots |

### Platform files surgically edited for this plugin

| Path | Change |
|---|---|
| `src/engine/ChartEngine.ts` | +1 private `gannOverlayCallback` field; +1 public `setGannOverlayCallback()` method; +callback invocation at end of `renderOverlay()` before `ctx.restore()` |
| `src/plugins/registry.ts` | +1 import; +1 `gannPriceTimePlugin` entry in `BUILT_IN_PLUGINS` |
| `src/components/ChartCanvas.tsx` | +4 import lines; +1 `useEffect([bars])` that computes `GannSetup` and registers the canvas callback |
| `vitest.config.ts` | Replaced `**/analysis/**` exclude with `**/EOD Charting Platform Source Audit/**` |

### Snapshot note

The August 22 snapshot baseline was 721 files. This plugin adds **5 new files** to `src/plugins/analysis/gannPriceTime/`. The next clean source snapshot is expected to contain **≥726 files** (721 base + 1 CA closeout record + 1 Gann changes report + 5 Gann source files = 728, absent other changes). The `docs/changes/` count also increases by 1 (`docs/changes/2026-09-14_0112_IST_GANN_PRICE_TIME_PLUGIN_IMPLEMENTATION.md`).

<!-- CA-R1A-2026-09-24:BEGIN -->
## 29. Corporate Action Reconciliation R1-A source files (24 September 2026)

Accepted live `src + src-tauri-shell` inventory: **569**. Protected source authority: **563**.

### Added by R1-A

| Path | Role |
|---|---|
| `src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight.rs` | Backend read-only reconciliation preflight |
| `src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight/tests.rs` | R1-A Rust preflight/copy-local contract tests |
| `src/features/corporateActions/reconciliation/CorporateActionReconciliationPanel.tsx` | Thin reconciliation diagnostic panel |
| `src/features/corporateActions/reconciliation/corporateActionReconciliationPreflight.ts` | Renderer-side preflight adapter/model |
| `src/features/corporateActions/reconciliation/corporateActionReconciliationExport.ts` | CSV + tab-separated TXT reconciliation export |
| `src/features/corporateActions/__tests__/corporateActionReconciliationPreflight.test.ts` | Renderer preflight tests |
| `src/features/corporateActions/__tests__/corporateActionReconciliationPanel.test.tsx` | Panel behavior tests |
| `src/features/corporateActions/__tests__/corporateActionReconciliationExport.test.ts` | Export tests |

### Modified integration owners

`src-tauri-shell/src/database.rs`, `src-tauri-shell/src/database/connection_registry.rs`, `src-tauri-shell/src/database/corporate_action_imports.rs`, `src-tauri-shell/src/database/corporate_action_imports/repair_preview.rs`, `src-tauri-shell/src/main.rs`, `src/components/DatabaseToolsDialogs.tsx`, `src/platform/tauriDesktop.ts`, `src/platform/types.ts`, and `src/types/desktop.ts`.

Current authority: `docs/superpowers/specs/2026-09-24-corporate-action-reconciliation-r1a-current-authority.md`.
<!-- CA-R1A-2026-09-24:END -->
