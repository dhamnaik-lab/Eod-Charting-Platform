# EOD Charting Platform - Next Thread Prompt

Project root: `E:\TA Projects\EOD Charting Platform`

## Start here

1. Confirm the project root and read `AGENTS.md`, then the relevant current section of `HANDOFF.md`.
2. Use the user's current request and active source as authority. Read only task-relevant snippets from `README.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md`, and one relevant report.
3. Start with 3-5 relevant files and follow the context limits in `AGENTS.md`. Open historical reports only when a specific question requires them.
4. Preserve local changes. Keep `src-tauri-shell` as the active backend and renderer-to-desktop calls behind `src/platform/*`.
5. Before editing, state the bounded scope and follow the backup and focused-validation requirements in `AGENTS.md`.
6. Keep these reusable instructions stable. Supply the current task, timestamps, logs, IDs, and changing status separately after them. Do not copy the historical sections below into every new chat.

## Identity checkpoint — 30 October 2026

The latest saved-report polish has user native evidence for saved wording,
original-reason hover, outcome views, search in All and exact path/hash copying;
restart preference persistence is user-confirmed. The newer saved run shows
2 Applied / 2,845 All / 1,310 Skipped / 1,533 Duplicates. Earlier 1,531-name Apply
acceptance and its persisted audit remain separate evidence. Do not replay Apply
or start new runtime work from this checkpoint alone. Follow the relevant handoff
and [native evidence and limits](docs/changes/2026-10-30-identity-report-polish/REPORT.md).
Search with a non-All outcome filter, validation-notice wording, clipboard failure
and other native routes remain unverified. Security ID history remains held for
separately verified dated evidence.
7. Report changes, focused validation results, and remaining risks. Do not infer financial approval or native acceptance from historical reports.

## Current task checkpoint — 26 October 2026

The user has paused Corporate Actions to address a database issue. Obtain its
symptoms and affected scope before implementation; do not assume a BSE-data cause.
CA has 4,288 confirmed persisted approvals from the latest run. Do not replay them.
Resume CA later from [the checkpoint](docs/changes/2026-10-26_CA_PAUSE_DATABASE_PRIORITY_HANDOFF.md),
which records remaining progress/status/history UI work and validation limits.
This current checkpoint supersedes the historical task material below.

The active objective comes from the current user request and `HANDOFF.md`. Stop reading here unless the task needs historical context. This file does not configure API cache keys, modes, or retention, and stable text alone does not guarantee a cache hit.

## Historical reference only

Everything below is retained April-era reference, including headings that say "current", "required", or "start". It is not a live task list and must not override the current request, `AGENTS.md`, `HANDOFF.md`, or inspected source.

### Historical objective

Latest verified on April 12, 2026:
- `src/store/chartStore.ts` is down to 498 lines after the chartStore completion shell pass; it is now a thin Zustand shell that composes extracted controllers/helpers, keeps autosave subscription glue, and exports `getActiveChartTab`.
- `src/store/chartStoreTypes.ts` now owns shared store state/tab/toast/progress definitions.
- `src/features/charts/chartSearchController.ts` now owns search query and symbol-browser controller wiring.
- `src/features/charts/chartInstrumentCompareController.ts` now owns direct instrument-load flow, compare-overlay orchestration, and watchlist-based previous/next navigation.
- `src/features/charts/chartTabSessionController.ts` now owns layout mode, sheet save/load/delete/rename flows, adjusted-mode retune scheduling, create/activate/close tab orchestration, and layout restore orchestration.
- `src/features/charts/chartTabStateMutationService.ts` now owns pure timeframe/viewport/display-flag, pane height/collapse/scale, indicator mutation, and drawing mutation helpers.
- `src/features/watchlists/watchlistStoreController.ts` now owns watchlist store wiring and snapshot merge updates.
- `src/features/workspace/chartRuntimeController.ts` now owns store-side init, snapshot refresh, listener registration, and bhavcopy download refresh orchestration.
- `src/components/ChartCanvas.tsx` is now the main frontend hotspot at 1,089 lines.
- `src-tauri-shell/src/database.rs` is currently 614 lines after the extracted backend submodules:
  - `src-tauri-shell/src/database/quotes.rs`
  - `src-tauri-shell/src/database/watchlists.rs`
  - `src-tauri-shell/src/database/instrument_mutations.rs`
  - `src-tauri-shell/src/database/bootstrap.rs`
  - `src-tauri-shell/src/database/settings.rs`
  - `src-tauri-shell/src/database/connection_registry.rs`
  - `src-tauri-shell/src/database/symbol_search.rs`
  - `src-tauri-shell/src/database/eod_data.rs`
- `src-tauri-shell/src/database.rs` is no longer the main backend hotspot; the best next work is full Tauri runtime/package validation or the next isolated `ChartCanvas.tsx` seam.
- Treat the older milestone notes below as historical context; the current source of truth is `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md`, `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md`, and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`.

Completed on April 9, 2026:
- `SCALE_RIGHT_AXIS_TRIGGER_FIX_REPORT.md` - moved the visible `Scale` trigger back into the top-right price-scale header region, removed the temporary toolbar trigger, and restored a compact reserved axis-header band so the menu opens from the right axis like the TradingView-style entrypoint
- `SCALE_TOOLBAR_TRADINGVIEW_FIX_REPORT.md` - moved the visible `Scale` trigger into the top toolbar row beside the timeframe and indicator controls, removed the visible chart-axis button, kept right-click-on-axis scale settings, and reverted the temporary axis-header label reservation
- `SCALE_TRADINGVIEW_AXIS_HEADER_FIX_REPORT.md` - moved the `Scale` control back into the top of the measured right price-axis gutter as a compact axis-header control and reserved a top axis-header band so the price-axis labels start below it like the TradingView layout
- `SCALE_HEADER_ALIGNMENT_REFINEMENT_REPORT.md` - nudged the `Scale` button and its popover anchor farther left of the measured right axis and widened the control slightly so it reads as a chart-header control instead of an axis overlay
- `SCALE_HEADER_SLOT_MOVE_REPORT.md` - moved the `Scale` control and its popover anchor out of the right price-scale pane into the blank top-right chart header slot just left of the axis, while keeping the existing axis right-click entrypoint
- `NATIVE_CONTEXT_MENU_SUPPRESSION_REPORT.md` — suppresses the default WebView/browser right-click menu in the chart pane and sidebar while preserving app-specific menus
- `SUMMARY_CROSSHAIR_PROTECTION_REPORT.md` — chart-top summary and stacked overlay rows now reserve a protected top hover band so the crosshair starts below them
- `PRICE_SUMMARY_STYLE_REFINEMENT_REPORT.md` — chart-top symbol/OHLC summary now uses one unified 14px style, no live-status circle, and candle-direction-colored OHLC values
- `STACKED_OVERLAY_LEGEND_REPORT.md` — price-pane overlay studies now render as separate chart-top rows under the TradingView-style price summary instead of being flattened into one horizontal legend line

P2 EOD compare overlay pass is complete. See `P2_COMPARE_OVERLAYS_REPORT.md`.
EOD-only TradingView-style scale settings pass is complete. See `CHART_SETTINGS_MENU_REPORT.md`.
Right-scroll dead-space fix is complete. See `RIGHT_SCROLL_GAP_FIX_REPORT.md`.
P2 main price-pane last-value tags pass is complete. See `P2_PRICE_PANE_LAST_VALUE_TAGS_REPORT.md`.
P2 pane ergonomics pass is started. See `P2_PANE_COLLAPSE_FIT_REPORT.md`.
P1 EOD parity upgrade is complete. See `P1_EOD_PARITY_UPGRADE_REPORT.md`.
Searchable indicator dialog pass is complete. See `SEARCHABLE_INDICATOR_DIALOG_REPORT.md`.
High-Value Chart Features pass is complete. See `HIGH_VALUE_CHART_FEATURES_PASS_REPORT.md`.
Indicator pane controls pass is complete. See `INDICATOR_PANE_CONTROLS_REPORT.md`.
MACD 4-color histogram momentum styling is complete. See `MACD_4COLOR_HISTOGRAM_REPORT.md`.
Manual "Update All Official Watchlists" is complete. See `OFFICIAL_WATCHLIST_UPDATE_ALL_REPORT.md`.
The official watchlist sync-status UX is complete (manual-update-only).

Completed in the High-Value Chart Features pass (April 7, 2026):
- **Supertrend** overlay (ATR-based; period 10 / multiplier 3 defaults; upColor/downColor settings; gear dialog shows Period + Multiplier + Up/Down colors)
- **Log scale toggle** (Log button in Toolbar alongside Magnet; `buildScaleY` log-math branch; price pane only; `logScale` persisted per tab)
- **Source input selector** (dropdown in IndicatorSettingsDialog for SMA/EMA/WMA/WEMA/DEMA/TEMA/BOLL/RSI/MACD/ROC/MOM; `IndicatorSource` type in types.ts)
- **Volume toggle** (Vol button in Toolbar; `showVolume` persisted per tab; `ChartEngine.setShowVolume()`)

- `OFFICIAL_WATCHLIST_TESTING_FOUNDATION_REPORT.md` — 54 unit tests, Vitest
- `OFFICIAL_WATCHLIST_LAST_SYNCED_UI_REPORT.md` — "Last synced" readout in sidebar
- `OFFICIAL_WATCHLIST_SYNC_STATUS_COMPLETION_REPORT.md` — timezone label + tooltip in sidebar; per-row last-synced in WatchlistManagerDialog bulk view
- `OFFICIAL_WATCHLIST_UPDATE_ALL_REPORT.md` — "Update All" bulk action; sequential loop; summary toast
- `MACD_4COLOR_HISTOGRAM_REPORT.md` — 4-color MACD histogram; drawHistogram backward-compatible
- `INDICATOR_PANE_CONTROLS_REPORT.md` — per-pane gear/close buttons; `IndicatorSettingsDialog` shared component; pane drag-resize was already in place
- `HIGH_VALUE_CHART_FEATURES_PASS_REPORT.md` — Supertrend; log scale; source selector; volume toggle
- `SEARCHABLE_INDICATOR_DIALOG_REPORT.md` — grouped searchable indicator picker dialog in Toolbar; replaces the plain add-study dropdown

- `npm run test` now runs 54 unit tests across 2 test files (all passing)
- `vitest.config.ts` added; `"test": "vitest run"` script added to `package.json`
- `src/features/watchlists/__tests__/officialWatchlistResolver.test.ts` — 35 pure tests, zero mocking
- `src/features/watchlists/__tests__/officialWatchlistImportService.test.ts` — 19 service tests with module mocks; resolver runs for real

Store Split Passes 3–6 are complete. `chartStore.ts` is at ~1,590 lines (slightly grown by `setLogScale`/`setShowVolume`). The largest remaining extraction candidate is:

1. **Chart tab management** — `createChartTab`, `activateChartTab`, `closeChartTab` — tightly coupled to store state; lowest extraction priority; no strong urgency.

Indicator pane controls are complete:
- Per-pane gear (&#9881;) and × buttons are rendered in `ChartCanvas.tsx` for each indicator pane
- `IndicatorSettingsDialog` is extracted into `src/components/IndicatorSettingsDialog.tsx` and shared by both Toolbar and ChartCanvas
- Pane drag-resize was already implemented; no changes needed

Completed in the P1 EOD parity upgrade pass (April 8, 2026):
- per-pane indicator heights now persist through `indicatorPaneHeights`
- indicator panes can be reordered from `ChartCanvas.tsx`
- right-axis drag and wheel resize now create pane-local manual scale overrides for the price pane and non-fixed-range indicator panes
- right-axis double-click clears the active pane override back to autoscale
- `ScaleManager.ts` now emphasizes year/quarter/month boundaries for long EOD daily histories
- `workspacePersistence.ts` now serializes `indicatorPaneHeights` and `paneScaleOverrides`

Completed in the first P2 pane ergonomics pass (April 8, 2026):
- indicator panes can now collapse/expand from `ChartCanvas.tsx`
- collapsed-pane state persists through `collapsedIndicatorPanes`
- collapsed panes render as compact rails without overwriting remembered expanded heights
- indicator pane chrome now includes a pane-level fit/autoscale reset for manual pane scale overrides

Completed in the P2 main price-pane last-value tags pass (April 8, 2026):
- the main price pane now renders right-axis last-value tags for the latest price and overlay-study values
- the existing dashed EOD last-price marker remains in place
- axis-width measurement now includes those latest price-pane tag values

Completed in the P2 EOD compare overlay pass (April 8, 2026):
- compare overlays can be added from the existing local symbol database through `CompareOverlayDialog.tsx`
- compare overlay state now persists per chart tab and sheet through `compareOverlays`
- compare lines render in the main price pane rebased from the first visible shared bar
- compare legend tokens and right-axis tags now show relative performance without introducing a second price-scale path

Completed in the right-scroll dead-space fix (April 8, 2026):
- `ScaleManager.ts` now keeps a small fixed future/right margin instead of the earlier aggressively expanding dynamic margin
- `ChartCanvas.tsx` now aligns the bottom scrollbar end-position with drag/right-button movement using the same future-bar bound
- right-scroll and scroll-end states no longer open a large empty zone after the last bar, and the chart no longer snaps flush to the price scale through one path while showing future bars through another

Completed in the viewport/price-scale root fix (April 8, 2026):
- `ChartEngine.ts` and `ChartCanvas.tsx` now share the same stable right-axis width instead of using dynamic engine width plus a separate hardcoded DOM/UI width
- per-frame axis-width remeasurement was removed, so zoom/unzoom no longer shifts the chart horizontally because of live axis reflow
- wheel zoom and chart `+/-` zoom now keep the current right edge fixed instead of using cursor/hover anchoring, so zoom-out reveals more history to the left without chart scroll
- `Renderer.ts` now clips y-axis labels inside pane bounds so the price scale stops cleanly at the pane/window edge

Completed in the EOD-only TradingView-style scale settings pass (April 8, 2026):
- `Toolbar.tsx` now exposes a `Scale` button and `ChartCanvas.tsx` now exposes a right-click interaction on the right price-scale zone that both open `src/components/ChartSettingsMenu.tsx`
- the new menu persists and applies only EOD-relevant options: auto-fit price pane, fit all panes, regular/log mode, invert price scale, right-axis value labels, and future-bar spacing
- `futureMarginMode` now drives viewport clamp/reset/scroll/zoom math instead of relying on a hidden fixed constant, so scrollbar drag, panning, wheel zoom, and reset stay aligned with the chosen future-bar setting
- `invertPriceScale` and `showValueLabels` now persist per chart tab and sheet through `workspacePersistence.ts`

Completed in the AmiBroker-style database open flow pass (April 8, 2026):
- `chartStore.ts` now keeps the current chart workspace visible while a new database snapshot is being applied, instead of immediately wiping the UI to a blank workspace
- `databaseSnapshotService.ts` now hydrates watchlists separately from DB stats; DB stats are deferred out of the critical open path
- `Sidebar.tsx` now lazy-loads the symbol browser when the Symbols panel actually needs it, instead of forcing symbol-browser hydration inside `applySnapshot(...)`
- `StatusBar.tsx` and `Sidebar.tsx` now expose explicit DB transition/loading states during database activation
- see `AMIBROKER_STYLE_DATABASE_OPEN_FLOW_REPORT.md`

Completed in the DB-open migration root fix (April 8, 2026):
- `src-tauri-shell/src/database.rs` no longer performs legacy data-normalization and `eod_prices -> instruments` backfill work on every DB open
- that legacy work now runs once per database and records completion through the `migration.legacy_data_v1` setting
- this specifically removes repeated full historical-table scan behavior from the normal DB-open path
- see `DB_OPEN_MIGRATION_FIX_REPORT.md`

Completed in the DB-open async command fix (April 8, 2026):
- `src-tauri-shell/src/database.rs` now runs the main DB activation/snapshot commands through async handlers backed by `tauri::async_runtime::spawn_blocking(...)`
- this reduces native window blocking during DB open, DB stats reads, and snapshot reads by moving the blocking DB work off the direct command path
- see `DB_OPEN_ASYNC_COMMAND_FIX_REPORT.md`

Completed in the future-bars rendering pass (April 8, 2026):
- `src/engine/ScaleManager.ts` now generates future-aware X-axis ticks/labels across the full logical viewport for `D/W/M/Q/Y`
- `src/engine/Crosshair.ts` now lets the crosshair move through future slots and show synthesized future dates instead of snapping back to the last real bar
- `src/engine/Renderer.ts`, `src/engine/ChartEngine.ts`, and `src/components/ChartCanvas.tsx` now treat the right-side future margin as timeline space rather than dead blank space
- see `FUTURE_BARS_RENDERING_REPORT.md`

Completed in the overlay legend duplicate-label fix (April 9, 2026):
- removed the duplicate DOM overlay study-label block from `src/components/ChartCanvas.tsx`
- the canvas overlay legend remains the only rendered source for top-left overlay study names and values
- this fixes EMA and other overlay studies appearing doubled/blurry in the chart area
- see `OVERLAY_LEGEND_DUPLICATE_LABEL_FIX_REPORT.md`

Completed in the sidebar indicator double-click fix (April 9, 2026):
- changed `src/components/Sidebar.tsx` so sidebar indicators add on double-click instead of single-click
- drag-to-chart indicator behavior remains unchanged
- sidebar hint and tooltip text now match the new double-click workflow
- see `SIDEBAR_INDICATOR_DOUBLE_CLICK_FIX_REPORT.md`

Completed in the sidebar empty-state label fix (April 9, 2026):
- updated `src/engine/ChartEngine.ts` so the `No chart data loaded` message is centered inside the visible chart viewport instead of being painted at a hardcoded left-edge x-position
- the empty-state label now respects the reserved right-axis width and bottom x-axis strip, so it no longer looks clipped or visually attached to the sidebar seam
- see `SIDEBAR_EMPTY_STATE_LABEL_FIX_REPORT.md`

Completed in the sidebar symbol-index click fix (April 9, 2026):
- updated `src/components/Sidebar.tsx` so the symbol alphabet rail no longer changes sections on hover/drag
- symbol-group jumps now happen only on click, unavailable letters are disabled, and the rail now aligns with the symbol list body height beside the scrollbar area
- see `SIDEBAR_SYMBOL_INDEX_CLICK_FIX_REPORT.md`

Completed in the sidebar symbol-scroll hardening pass (April 9, 2026):
- updated `src/components/Sidebar.tsx` so the Symbols panel now uses a normal native scroll list instead of the old virtualized symbol-list path
- reserved stable scrollbar gutter space for the symbol list
- wired alphabet clicks to real group-header anchors and forwarded alphabet-rail wheel input into the real symbol-list scroller so the rail and the list behave like one scroll region
- see `SIDEBAR_SYMBOL_SCROLL_HARDENING_REPORT.md`

Completed in the chart menu/control cleanup pass (April 9, 2026):
- removed the top-toolbar `Magnet`, `Raw`, `Adj`, `Log`, `Vol`, and `Compare` buttons from `src/components/Toolbar.tsx`
- kept `Magnet` on the right chart tool dock and replaced its old generic glyph with a bar-magnet icon in `src/components/ChartToolDock.tsx`
- moved `Compare...`, `Magnet`, and explicit `Raw` / `Adjusted` actions into the native `Chart` menu through `src-tauri-shell/src/main.rs`
- moved compare-dialog open state into `src/store/uiStore.ts` and routed menu commands through `src/features/app/menuCommandRouter.ts`
- removed the old volume row from `src/components/ChartSettingsMenu.tsx`
- see `CHART_MENU_CONTROL_CLEANUP_REPORT.md`

Completed in the dynamic price-scale width pass (April 9, 2026):
- updated `src/engine/ChartEngine.ts` so the right price scale measures visible tick labels and active right-axis value tags instead of staying pinned to the old fixed width
- added an `axisWidthChange` event through `src/engine/types.ts` so `src/components/ChartCanvas.tsx` uses the same measured width for pane chrome and price-scale hit zones
- the right price scale now shrinks and expands to fit the current symbol's labels instead of staying permanently wide
- see `DYNAMIC_PRICE_SCALE_WIDTH_REPORT.md`

Completed in the chart-top price summary pass (April 9, 2026):
- reduced `src/components/ChartHeader.tsx` to a slim timeframe-only strip
- updated `src/engine/ChartEngine.ts` so the active symbol, timeframe, exchange, OHLC, and signed change now render in a TradingView-style top-left chart summary
- kept overlay and compare legends below the new chart-top summary instead of leaving symbol/price identity in the header
- see `CHART_TOP_PRICE_SUMMARY_REPORT.md`

Completed in the new-sheet plain-candle pass (April 9, 2026):
- updated `src/store/chartStore.ts` so the sheet `+` action no longer clones the active workspace
- new sheets now preserve the current symbol/timeframe but reset indicators, compare overlays, drawings, pane overrides, and layout back to a single plain-candle chart
- updated `src/components/SheetTabs.tsx` copy so the UI describes the action correctly
- see `NEW_SHEET_PLAIN_CANDLE_REPORT.md`

Completed in the single-row sheets + scrollbar pass (April 9, 2026):
- updated `src/components/ChartCanvas.tsx` so the bottom chart strip accepts inline leading content next to the existing scrollbar controls
- updated `src/components/SheetTabs.tsx` with an inline strip mode for AmiBroker-style bottom-row placement
- updated `src/RootApp.tsx` so charts no longer render a second standalone sheet row beneath the canvas
- see `SHEET_SCROLLBAR_SINGLE_ROW_REPORT.md`

Completed in the context-menu suppression and control relayout pass (April 9, 2026):
- updated `src/RootApp.tsx` so the native WebView/browser context menu is suppressed through a global window listener and the separate timeframe row is removed
- updated `src/components/Toolbar.tsx` and `src/components/ChartHeader.tsx` so timeframe controls live in the single toolbar row below chart tabs
- updated `src/components/ChartCanvas.tsx` so the `Scale` control sits inside the blank top header area of the right price-scale gutter instead of in the toolbar
- see `CONTEXTMENU_TIMEFRAME_SCALE_RELAYOUT_REPORT.md`

Completed in the sidebar indicator panel and axis-tag spacing pass (April 9, 2026):
- removed the `Active Chart` indicator chip section from `src/components/Sidebar.tsx`
- updated `src/engine/Renderer.ts` so the main price label stays anchored while study labels step away from it with clearer spacing
- updated `src/engine/ChartEngine.ts` to tag price, overlay, compare, and pane-indicator labels by role for the new axis stacking behavior
- see `SIDEBAR_INDICATOR_PANEL_AND_AXIS_TAG_SPACING_REPORT.md`

Good next directions:
- Validate the new database-open behavior on large local DBs and, if needed, continue with a second pass:
  - move deferred DB stats fully behind an idle timer or explicit panel request if the app still feels sticky on first open
  - add open-flow timing logs around workspace restore, watchlist hydration, DB stats, and symbol-browser hydration
  - consider moving workspace layout storage out of the active DB if DB-coupled settings still contribute to perceived open latency
- Continue P2 from the EOD-only parity list:
  - optional expand-all / collapse-all pane affordances if they fit the current shell without clutter
  - indicator per-series visibility toggles for multi-line studies if they can be added without bloating pane chrome
  - indicator line style controls
  - indicator line width controls
- Add line style controls for indicators
- Add line width controls for indicators
- Optional per-series visibility toggles for multi-series indicators
- Add more test coverage to other feature modules as new extractions happen
- Optional: keyboard shortcut for log scale toggle
- Optional lower-priority visual polish: candle wick stroke consistency, subtler grid opacity

Do not rewrite the chart engine. Do not redesign the app shell. Keep each pass incremental and behavior-preserving.

## Operating Posture

- develop against the active React + Vite + TypeScript renderer
- keep runtime-specific logic behind `src/platform/*`
- keep the desktop runtime Tauri-only
- prefer incremental performance work over broad redesign
- keep installer-first and macOS work deferred unless the prompt explicitly asks for them

## Hard Rules

- Do not recreate or depend on the removed `src-tauri` tree
- Do not add direct Tauri imports to renderer files outside `src/platform/*`
- Do not bypass the platform abstraction
- Do not reintroduce Electron runtime code
- Do not broadly redesign the UI
- Preserve TypeScript correctness
- Before changing any file, identify backup targets and the `.md` files that must be updated, then create a backup snapshot first
- Preferred backup command: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\create-project-backup.ps1 -ShortName <short_name>`

## Portable Windows Baseline To Preserve

- Supported staging command: `npm run tauri:portable:win`
- Supported portable launch entry: `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`
- The staged portable folder must contain:
  - `EOD Chart.exe`
  - `index.html`
  - `assets/`
- The generated launcher must start the exe with the portable folder as the working directory.
- The Tauri shell build must continue to invalidate when `dist/` changes.
- Portable runtime state lives under:
  - `portable-data/state`
  - `portable-data/logs/app-runtime.log`
- The recent-database registry lives at `portable-data/state/database-registry.json`
- Bare `EOD Chart.exe` launch is fallback-only; the launcher is the supported portable guarantee because it sets `EOD_CHART_PORTABLE_ROOT`

## Validation Baseline To Preserve

- `npm run typecheck:renderer` passes
- `npm run tauri:check` passes
- `npm run build` passes
- `npm run tauri:portable:win` passes
- bounded launch of the staged portable launcher succeeds
- no active renderer file outside `src/platform/*` imports Tauri packages directly

## Backup Baseline To Preserve

- The retained compact backup baseline is:
  - `backups/pre_opencode_changes_20260404_150804_compact_backup_baseline`
- Prefer creating new incremental backups in the existing timestamped style without rebuilding the old multi-GB backup sprawl.
- The scripted backup path now excludes generated/artifact folders by default, including `node_modules`, `dist`, `release`, `analysis`, `test-output`, `backups`, `EOD DATABASE`, `src-tauri-shell/target`, and `resources/release`.
- Optional retention review command: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prune-backups.ps1`

## Deliverables Required In The Next Thread

Return:
1. Which performance or UX bottleneck was addressed
2. Which files were backed up first
3. Which files were modified or created
4. What validation was performed
5. Which markdown files were updated
6. Whether the Tauri-only runtime structure was preserved
7. A ready continuation prompt for the next Windows-first development step

## Current Baseline To Preserve

- Tauri is now the sole active desktop runtime
- `src/platform/desktop.ts` and `src/platform/shell.ts` are Tauri-only
- the native menu order is:
  - `File`
  - `Database`
  - `Watchlist`
  - `Chart`
  - `View`
  - `Help`
- official watchlist management/import/update/live-source behavior is already in place
- the Watchlists panel shows a symbol-only list and uses right-click `Delete`
- the importer uses source tabs, a left-side multi-select group list, and a right-side constituent preview
- per-chart-window Sheets remain implemented
- chart header/timeframe, sidebar readability, and zoom-stability refinements remain implemented
- the current Tauri performance baseline includes:
  - persistent active SQLite connection reuse
  - lightweight snapshot split
  - SQL-first symbol listing/search
  - recent EOD cache reuse
  - watchlist-only refresh without DB-stats churn
  - cached DB stats for unchanged active databases
  - reduced watchlist-panel rerender churn during watchlist switching and chart interaction
  - virtualized large-list rendering in the Symbols and Watchlists sidebar panels
  - stronger zoom-anchor preservation for UI-driven zoom plus a tighter fixed right margin near the latest bar
  - pane-aware drawing placement, selection, and editing inside indicator panes for pane-valid tools
  - TradingView-style chart readability refinements including grouped numeric formatting, dynamic right-axis width, live pane indicator values, indicator right-axis value tags, and price-pane overlay live values
  - fib and gann drawings intentionally remain restricted to the main price pane
  - Store Split Pass 1 now separates shell UI/dialog/drawing-tool state into `src/store/uiStore.ts`, sidebar shell layout state into `src/store/workspaceStore.ts`, and thin feature service seams into `src/features/watchlists/watchlistService.ts` and `src/features/workspace/workspaceService.ts`
  - Store Split Pass 2 now separates workspace persistence/parsing into `src/features/workspace/workspacePersistence.ts` and snapshot lifecycle loading into `src/features/workspace/databaseSnapshotService.ts`, and `src/components/LayoutManagerDialog.tsx` now uses the shared workspace serializer directly
  - Store Split Pass 3 now extracts the native menu command dispatch table from `chartStore.init()` into `src/features/app/menuCommandRouter.ts`; `chartStore.ts` reduced to 2,002 lines
  - Store Split Pass 4 now extracts pure chart helpers into `src/features/charts/chartDataUtils.ts` and the database lifecycle execution pattern into `src/features/workspace/databaseLifecycleService.ts`; `chartStore.ts` reduced to 1,868 lines
  - Store Split Pass 5 now extracts pure official watchlist resolver helpers (`normalizeLookupToken`, `instrumentSymbolKey`, `instrumentIsinKey`, `buildUniqueWatchlistName`, `officialWatchlistSourceSignature`, `resolveOfficialWatchlistMember`, `buildOfficialWatchlistLookupMaps`) into `src/features/watchlists/officialWatchlistResolver.ts`; `chartStore.ts` reduced to 1,774 lines
  - Store Split Pass 6 now extracts official watchlist import/update business logic into `src/features/watchlists/officialWatchlistImportService.ts` (`runOfficialWatchlistImport`, `runOfficialWatchlistUpdate`); store retains refresh, selectedWatchlistId, dialog close, and toast; `chartStore.ts` reduced to 1,566 lines
  - Official Watchlist Testing Foundation added: `vitest` devDependency installed, `vitest.config.ts` created, `"test": "vitest run"` script added, 2 test files with 54 unit tests covering `officialWatchlistResolver.ts` (pure functions, zero mocking) and `officialWatchlistImportService.ts` (service tests with `vi.mock()`); all tests pass
  - "Last synced" readout added to `src/components/Sidebar.tsx` for official source-linked watchlists: `date-fns` format/parseISO used; hidden for manual watchlists; no sidebar redesign
  - Sync-status completion: timezone label + tooltip in sidebar; per-row last-synced sub-line in `WatchlistManagerDialog.tsx` (bulk view); sync remains manual-only
  - "Update All" bulk action added to `WatchlistManagerDialog.tsx` toolbar; `updateAllOfficialWatchlists()` in `chartStore.ts`; sequential per-watchlist update loop; summary toast; manual watchlists skipped; ASCII-safe strings fixed (mojibake `Updating...` / ` | N official`)
  - MACD histogram now uses 4-color momentum styling: `#26a69a` (positive+growing), `#b2dfdb` (positive+shrinking), `#ef5350` (negative+growing in magnitude), `#ffcdd2` (negative+shrinking); `colorValues` is optional on `RenderableHistogramSeries` so all non-MACD histograms retain two-color behavior; pane legend and right-axis tag colors also use momentum-aware color at the displayed bar index
  - per-chart-window sheet create/rename/delete actions now use in-app dialogs instead of browser-style `tauri.localhost` prompts
  - watchlist create/rename/delete actions now use in-app dialogs and toast-based errors instead of browser-style prompt, confirm, or alert UI
  - layout deletion now uses an in-app confirmation dialog instead of browser `confirm(...)`
  - indicator pane controls: per-pane gear (settings) and × (remove) buttons in `ChartCanvas.tsx`; `IndicatorSettingsDialog` shared component in `src/components/IndicatorSettingsDialog.tsx`; pane drag-resize was already in place
  - P2 pane ergonomics pass: `collapsedIndicatorPanes` now persists per chart tab; indicator panes can collapse into compact rails without losing remembered expanded heights; pane chrome now includes a fit/autoscale reset for manual pane scale overrides
  - P2 main price-pane last-value tags pass: the main price pane now renders right-axis last-value tags for the latest price and overlay-study values while preserving the existing dashed last-price marker
  - P2 EOD compare overlay pass: compare overlays are searched from the local symbol database, persist through `compareOverlays`, render rebased in the main price pane from the first visible shared bar, and expose relative-performance legend tokens plus right-axis tags without introducing intraday or trading-terminal behavior
  - High-Value Chart Features: **Supertrend** ATR overlay (period/multiplier/up-down colors); **log scale toggle** (`Log` button in Toolbar, price pane `buildScaleY` log-math, indicator panes always linear); **source input selector** (`IndicatorSource` type, dropdown in settings for 11 indicators); **volume toggle** (`Vol` button in Toolbar, `showVolume` persisted per chart tab); `logScale` and `showVolume` serialized in workspace
  - searchable indicator picker: `src/components/IndicatorPickerDialog.tsx` now provides grouped search over `INDICATOR_CATALOG`; `Toolbar.tsx` uses an `Indicators` button instead of the old plain dropdown/select add flow

## Start Now

Inspect the current feature request, then work only within the active Tauri app path while preserving the portable Tauri baseline.
