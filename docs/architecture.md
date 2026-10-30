# Architecture

## CA checkpoint; database work takes priority — 26 October 2026

No architecture change is introduced. Native completion plus persisted records
now establish 4,288 approvals, including NSE/BSE Split/Bonus. The approval flow
retains financial rechecks and targeted refresh; silent progress and whole-table
Checking need investigation. CA work is paused until the user-reported database
issue is scoped and addressed. Older bulk/Split acceptance limits below are
historical; numeric chart verification remains open.

This checkpoint supersedes older current-status claims below.
See [CA resume checkpoint](changes/2026-10-26_CA_PAUSE_DATABASE_PRIORITY_HANDOFF.md).

## Corporate Actions update — 25 October 2026

The current CA renderer retains a full loaded queue with local identity search and
an evidence Details view. Search ranks exact symbols before prefixes and broader
matches, and does not trigger data loading, validation or approval. Explicit
approval refreshes only the related symbol/full-ISIN group; unrelated readiness
survives and old confirmation drafts expire. Rust still owns financial rechecks.

User native observations establish selected Dividend commits, targeted refresh
and symbol/ranking/ISIN/empty-result behavior; Esc/× is user-confirmed. Chart-price,
Split/bulk and fresh BSE master-transport limits remain open. The older acceptance
statements below are historical. See [current handoff](../HANDOFF.md) and
[search evidence and remaining checks](changes/2026-10-25_CA_QUICK_SEARCH.md).

<!-- EOD-CANONICAL-STATUS-2026-10-17-R1 -->
## Current verified platform and Corporate Actions status — 17 October 2026 IST

**Current architecture addendum (documentation-only):** the original text below is retained for historical reference. The accepted live application combines a React/TypeScript renderer with a Rust/Tauri desktop shell, proprietary binary EOD price storage and auxiliary SQLite metadata/CA records. Future EOD2 identity/storage designs remain unpromoted; do not treat the old overview or future architecture as current source authority.

**Current CA contract:** preserve the active CA window; official action ingestion → data/identity validation → explicit approval within existing Rust transactional ledger → existing chart-cache/database-changed refresh. Live refresh remains unverified.

**Current acceptance boundary (17 October 2026 IST):** source-integrated and native-validation **PASS** (62/62 focused Vitest, 2/2 focused Rust tests, renderer typecheck, frontend Vite build, offline Cargo check). Two isolated Windows release builds also **PASS**; the static-CRT EXE has no direct/delay VC runtime imports. **Desktop CA UI and chart-refresh acceptance remain NOT VERIFIED:** the first disposable Sandbox run lacked Visual C++ CRT DLLs, the static-CRT attempt then lacked WebView2 Runtime. Operator stopped; no manual CA pass, no real NSE/BSE network-fetch pass, no production CA write acceptance, and no portable installation acceptance.

**Plugin P5-FINAL:** metadata-only import/discovery/reload architecture is closed with third-party external JavaScript evaluation and activation still **DISABLED**. C2 did not prove production guest process/IPC isolation; no plugin activation is permitted by the CA documents. The three previously unattributed P1/P2 files were accepted by exact isolated reconstruction on 17 October.

For ongoing technical authority see `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` and `docs/CURRENT_WORK_STATUS.md`.
<!-- END-EOD-CANONICAL-STATUS-2026-10-17-R1 -->

## System overview

```
NSE/BSE servers
      │ HTTP (bhavcopy CSV / ZIP)
      ▼
Rust (Tauri backend)
  bhavcopy.rs         — download, parse, insert
  database.rs         — SQLite schema + WAL setup
      │ rusqlite
      ▼
SQLite (.db file)
  instruments, eod_prices, download_log, settings, watchlists
      │ Tauri IPC (invoke / event)
      ▼
TypeScript platform layer  (src/platform/)
  getDesktopApi()     — typed wrappers around Tauri invoke
  onDownloadProgress  — event subscription
  onDownloadResult    — event subscription
      │
      ▼
Service + Controller layer  (src/features/charts/)
  chartInstrumentHydrationService   — fetch + cache EOD data
  chartTabStateMutationService      — pure tab state transformers
  chartIndicatorPaneService         — pane height / collapse / scale
  compareOverlayService             — compare overlay lifecycle
  chartSheetWorkspaceService        — sheets + workspace persist
  chartSymbolSearchService          — search + symbol browser
      │
      ▼
Zustand stores
  chartStore          — chart tabs, bars, indicators, drawings, viewport
  uiStore             — dialogs, drawing tool, sidebar flags
      │
      ▼
React components  (src/components/)
      │ props / useStore selectors
      ▼
Canvas engine  (src/engine/)
  ChartEngine         — orchestrates draw loop
  ScaleManager        — viewport ↔ pixel coordinate math
  drawCandles.ts      — OHLC rendering
  drawGrid.ts         — grid + axis labels
  Crosshair.ts        — mouse tracking
  [indicator].ts      — per-indicator draw functions
```

---

## Data flow — loading a symbol

```
User selects symbol
  → ChartInstrumentCompareController.loadInstrument(key)
  → setState: isLoadingBars=true, buildInstrumentLoadStartTab()
  → loadInstrumentResult()
      → readCachedInstrumentData()  [returns early if cached]
      → api.getEodData()            [Tauri IPC → SQLite]
      → writeCachedInstrumentData() [module-level Map cache]
  → applyEodResultToTab()
      → toBar() per row
      → aggregateBars(rawBars, timeframe)
      → createDefaultViewport() or normalizePersistedViewport()
  → setState: isLoadingBars=false, new ChartTabState
  → React re-renders → ChartEngine reads displayBars + viewport → redraws canvas
```

---

## Data flow — bhavcopy batch download

```
User clicks "Start Download"
  → handleDownload() in BhavcopyDownloadWindow.tsx
  → api.downloadBhavcopyBatch(config)  [Tauri IPC]
  → Rust: normalize_batch_config()
  → Rust: build_batch_plan()
      → resolve_exchange_date_window()  [Update/Range/FullHistory]
      → generate_calendar_days()
      → create_calendar_skip_result()   [weekends + holidays]
      → load_imported_trade_dates()     [pre-filter already-imported]
      → generate_[exchange]_candidates() per trading day
  → Rust: worker pool (Arc<Mutex<VecDeque<DownloadTask>>>)
      → process_download_task() per task
          → check download_log (skip if already ok)
          → fetch_candidate_bytes() with retry + backoff
          → extract_first_csv_from_zip() if zipped
          → parse_and_insert() → SQLite transaction
      → emit bhavcopy:result event  ← received by frontend useEffect
  → Rust returns Vec<DownloadResult>  ← received by handleDownload()
  → Frontend: reportDownloadResult() deduplicates via reportedDownloadResultsRef
```

---

## Store structure

### chartStore (src/store/chartStore.ts)

```ts
ChartStoreState {
  // Tabs
  chartTabs: ChartTabState[]
  activeChartTabId: string
  isLoadingBars: boolean

  // App-level
  snapshot: AppSnapshot | null      // DB path, watchlists
  selectedWatchlistId: string | null
  adjustedMode: boolean

  // Search
  searchQuery: string
  searchResults: InstrumentSummary[]
  symbolBrowserItems: InstrumentSummary[]
  isSymbolBrowserLoading: boolean

  // Toast notifications
  toasts: ToastMessage[]
}

ChartTabState {
  id, title, instrument, instrumentMeta, requestedInstrument
  rawBars: OHLCBar[]           // always daily
  displayBars: OHLCBar[]       // aggregated to current timeframe
  events: ChartMarkerEvent[]
  compareOverlays: ChartCompareOverlay[]
  timeframe: 'D'|'W'|'M'|'Q'|'Y'
  viewport: { startIndex, endIndex }
  visibleBarCount: number
  hoverBar: OHLCBar | null
  indicators: OverlayIndicator[]
  drawings: ChartDrawing[]
  selectedDrawingId: string | null
  indicatorPaneHeight: number         // global fallback (72–168)
  indicatorPaneHeights: { [id]: number }
  collapsedIndicatorPanes: { [id]: true }
  paneScaleOverrides: { [id|'price']: { min, max } }
  logScale: boolean
  showVolume: boolean
  invertPriceScale: boolean
  showValueLabels: boolean
  futureMarginMode: 'normal'|'tight'|'wide'
  loadedAdjusted: boolean | null
  sheets: Sheet[]
  activeSheetId: string | null
  layoutMode: 'single'|'tile'|'tile-h'|'tile-v'|'tile-grid'
}
```

### uiStore (src/store/uiStore.ts)

```ts
UiStoreState {
  uiFlags: { sidebarVisible, ohlcvBarVisible, statusBarVisible }
  activeDrawingTool: DrawingTool
  magnetEnabled: boolean
  drawingPropertiesDrawingId: string | null
  // Dialog open flags (boolean each):
  compareDialogOpen, quoteEditorOpen, mergeSymbolsOpen,
  corporateActionOpen, bhavcopyWindowOpen, deleteDatabaseDialogOpen,
  layoutManagerDialogOpen, watchlistManagerDialogOpen, commandPaletteOpen
  // Complex dialogs:
  importDialog: { open, filePaths }
  officialWatchlistImportDialog: { open, sourceId }
}
```

---

## Controller wiring (chartStore.init)

```
chartStore.init()
  ├── ChartInstrumentCompareController
  │     loadInstrument(), navigateSymbol(), addCompareOverlay(), removeCompareOverlay()
  ├── ChartTabSessionController
  │     createChartTab(), activateChartTab(), closeChartTab()
  │     saveCurrentAsSheet(), loadSheet(), deleteSheet(), renameSheet()
  │     setAdjustedMode(), loadWorkspaceFromLayout()
  ├── ChartSearchController
  │     setSearchQuery(), runSearch(), refreshSymbolBrowser()
  └── registerMenuCommandRouter()
        onMenuCommand() → routes to chartStore or uiStore actions
```

---

## Pane system

```
ChartTabState.indicators[]
  ├── placement='overlay'  → drawn on main price canvas
  │     EMA, SMA, WMA, DEMA, TEMA, VWAP, BOLL, PSAR
  └── placement='pane'     → own <canvas> element below price pane
        RSI, MACD, STOCH, ROC, CCI, WILLR, ATR, ADX, MFI, OBV, AROON, CMF, MOM

Pane height: indicatorPaneHeights[indicator.id] ?? indicatorPaneHeight
             clamped to [72, 168] by normalizeIndicatorPaneHeight()

Scale: auto-fit to visible data UNLESS paneScaleOverrides[indicator.id] is set
       (user can manually lock scale via drag)

Collapsed: collapsedIndicatorPanes[indicator.id] === true → render as 24px header only
```

---

## Instrument data cache

```ts
// chartInstrumentHydrationService.ts — module-level singleton
const instrumentDataCache = new Map<string, EodDataResult>();

// Cache key format:
`${databasePath}::${exchange}:${symbol}::${'adjusted'|'raw'}`

// Written on load, read before every IPC call
// Cleared by clearInstrumentDataCache() on database close
// Two entries written per result: requestedInstrument + resolvedInstrument
```

---

## Workspace persistence format

```ts
PersistedChartWorkspace {
  version: 1
  activeChartTabId: string
  chartTabs: PersistedChartContent[]
  layoutMode: LayoutMode
}

PersistedChartContent {
  id, title, instrument, compareOverlays, timeframe, viewport
  indicators: OverlayIndicator[]
  drawings: ChartDrawing[]
  indicatorPaneHeight, indicatorPaneHeights, collapsedIndicatorPanes
  paneScaleOverrides, logScale, showVolume, invertPriceScale, showValueLabels
  futureMarginMode
  // Sheet-specific:
  sheets?: Sheet[]
  activeSheetId?: string | null
}
```

**WARNING: Do not change field names — breaks existing saved workspace files.**
