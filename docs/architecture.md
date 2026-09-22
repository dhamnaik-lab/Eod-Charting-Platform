# Architecture

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
