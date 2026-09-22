# EOD Chart - Revised Codex Implementation Prompt

## Historical Status Notice

This file is a **historical scaffold-era prompt**.

Do **not** use it as the primary source of truth for the current repository state.

For current implementation work, use:

- `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

Use this prompt instead of the earlier draft. It keeps the same product direction, but removes the contradictions that would otherwise force the agent to invent missing architecture.

## Objective

Build a Windows-first desktop End-of-Day charting application for Indian markets (NSE/BSE) using:

- Electron 31
- Vite 5
- React 18
- TypeScript 5
- SQLite via `better-sqlite3`
- A custom HTML5 Canvas chart engine
- A native Electron menu bar
- CSV import for user-provided OHLCV files
- NSE bhavcopy download for daily EOD updates

The app must be cross-platform-safe in code, but only Windows packaging is in scope for v1.

## Critical Decisions

These decisions are fixed. Do not improvise around them.

1. Database lifecycle is explicit and supports multiple database files.
   The app starts in either:
   - a reopened last-active database state, if the last database still exists, or
   - a no-database-open state.

2. The app does not hardcode a single SQLite path for market data.
   Instead, the main process keeps a registry of recently opened databases in:
   `app.getPath('userData')/database-registry.json`

3. Database identity is file-path based.
   The renderer always knows:
   - known databases
   - active database path, if any

4. Instrument identity is always `{ symbol, exchange }`.
   Never pass a bare symbol through IPC or store state where exchange could matter.

5. The main process owns:
   - dialog interactions
   - database open/create/close
   - schema setup
   - CSV import
   - bhavcopy download
   - IPC

6. The renderer owns:
   - UI layout
   - symbol search and watchlist interactions
   - chart state
   - timeframe aggregation
   - chart rendering

7. v1 chart scope:
   - candlesticks
   - volume pane
   - crosshair
   - pan and zoom
   - daily / weekly / monthly aggregation
   - SMA / EMA / Bollinger Band overlays

8. Out of scope for v1:
   - live feeds
   - broker APIs
   - symbol editor
   - export CSV
   - import folder
   - auto-scheduled nightly jobs
   - RSI / MACD panes
   - screener
   - API keys

## Project Layout

Create this exact structure:

```text
eod-chart/
  electron/
    main.ts
    preload.ts
    db.ts
    menuBar.ts
    bhavcopy.ts
    csvImporter.ts
    ipc/
      handlers.ts
  src/
    main.tsx
    App.tsx
    types/
      electron.d.ts
    engine/
      types.ts
      ScaleManager.ts
      Renderer.ts
      Crosshair.ts
      ChartEngine.ts
    components/
      ChartCanvas.tsx
      Sidebar.tsx
      Toolbar.tsx
      OhlcvBar.tsx
      StatusBar.tsx
      ImportCsvDialog.tsx
    store/
      chartStore.ts
    styles/
      global.css
  resources/
    icon.ico
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  tsconfig.electron.json
```

## Package Configuration

Use this package model:

```json
{
  "name": "eod-chart",
  "version": "0.1.0",
  "description": "EOD charting platform for Indian markets",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "dev:electron": "concurrently \"tsc -p tsconfig.electron.json --watch\" \"vite\" \"wait-on http://localhost:5173 dist-electron/main.js && electron .\"",
    "typecheck:renderer": "tsc -p tsconfig.json --noEmit",
    "typecheck:electron": "tsc -p tsconfig.electron.json --noEmit",
    "build:renderer": "vite build",
    "build:electron": "tsc -p tsconfig.electron.json",
    "build": "npm run typecheck:renderer && npm run typecheck:electron && npm run build:electron && npm run build:renderer",
    "dist:win": "npm run build && electron-builder --win nsis"
  },
  "dependencies": {
    "adm-zip": "^0.5.14",
    "axios": "^1.7.2",
    "better-sqlite3": "^9.4.3",
    "date-fns": "^3.6.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "technicalindicators": "^3.1.0",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@types/adm-zip": "^0.5.5",
    "@types/better-sqlite3": "^7.6.10",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "concurrently": "^8.2.2",
    "electron": "^31.0.1",
    "electron-builder": "^24.13.3",
    "typescript": "^5.4.5",
    "vite": "^5.3.1",
    "wait-on": "^7.2.0"
  },
  "build": {
    "appId": "com.example.eodchart",
    "productName": "EOD Chart",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "dist-electron/**/*",
      "resources/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "resources/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

Notes:

- Do not include `csv-parse`.
- Do not include `node-schedule`.
- Do not include mac packaging in v1.

## TypeScript Configuration

### tsconfig.json

Use renderer settings with no emit:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "electron"]
}
```

### tsconfig.electron.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist-electron",
    "types": ["node"]
  },
  "include": ["electron"],
  "exclude": ["node_modules", "src"]
}
```

## Vite Config

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
```

## index.html

Use a normal Vite shell:

- Mount React to `#root`
- Set `body` background to `#0b0f16` to avoid white flash
- Load JetBrains Mono and Syne from Google Fonts
- Import `/src/main.tsx`

## Main Process Architecture

### electron/db.ts

This file manages both:

1. The active SQLite connection
2. The recent-database registry JSON

Exports:

- `getDb(): Database`
- `hasOpenDb(): boolean`
- `getActiveDatabasePath(): string | null`
- `listKnownDatabases(): KnownDatabase[]`
- `createDatabaseAt(filePath: string): AppSnapshot`
- `openDatabaseAt(filePath: string): AppSnapshot`
- `activateDatabasePath(filePath: string): AppSnapshot`
- `closeDatabase(): AppSnapshot`
- `getAppSnapshot(): AppSnapshot`
- `getDbStats(): DbStats | null`

Registry file:

- Path: `app.getPath('userData')/database-registry.json`
- Shape:

```ts
interface KnownDatabase {
  path: string;
  label: string;
  lastOpenedAt: string;
}

interface DatabaseRegistryFile {
  recent: KnownDatabase[];
  lastActivePath: string | null;
}
```

Behavior:

- On startup, load the registry file if it exists.
- If `lastActivePath` exists on disk, open it automatically.
- If it does not exist, start with no open database.
- Keep at most 12 recent databases.
- Deduplicate by absolute path.

SQLite pragmas on every open:

- `journal_mode = WAL`
- `synchronous = NORMAL`
- `cache_size = -64000`
- `temp_store = MEMORY`
- `mmap_size = 268435456`
- `foreign_keys = ON`

Schema:

1. `instruments`
   - `symbol TEXT NOT NULL`
   - `exchange TEXT NOT NULL DEFAULT 'NSE'`
   - `isin TEXT`
   - `name TEXT`
   - `series TEXT`
   - `sector TEXT`
   - `industry TEXT`
   - `is_active INTEGER NOT NULL DEFAULT 1`
   - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
   - `PRIMARY KEY (symbol, exchange)`

2. `eod_prices`
   - `symbol TEXT NOT NULL`
   - `exchange TEXT NOT NULL DEFAULT 'NSE'`
   - `date TEXT NOT NULL`
   - `open REAL NOT NULL`
   - `high REAL NOT NULL`
   - `low REAL NOT NULL`
   - `close REAL NOT NULL`
   - `prev_close REAL`
   - `volume INTEGER NOT NULL DEFAULT 0`
   - `trades INTEGER`
   - `delivery_qty INTEGER`
   - `delivery_pct REAL`
   - `PRIMARY KEY (symbol, exchange, date)`

3. `download_log`
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - `trade_date TEXT NOT NULL`
   - `exchange TEXT NOT NULL DEFAULT 'NSE'`
   - `rows_inserted INTEGER NOT NULL DEFAULT 0`
   - `downloaded_at TEXT NOT NULL DEFAULT (datetime('now'))`
   - `status TEXT NOT NULL DEFAULT 'ok'`
   - `UNIQUE (trade_date, exchange)`

4. `watchlists`
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - `name TEXT NOT NULL`
   - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`

5. `watchlist_items`
   - `watchlist_id INTEGER NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE`
   - `symbol TEXT NOT NULL`
   - `exchange TEXT NOT NULL DEFAULT 'NSE'`
   - `added_at TEXT NOT NULL DEFAULT (datetime('now'))`
   - `sort_order INTEGER NOT NULL DEFAULT 0`
   - `PRIMARY KEY (watchlist_id, symbol, exchange)`

6. `settings`
   - `key TEXT PRIMARY KEY`
   - `value TEXT NOT NULL`
   - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`

Indexes:

- `CREATE INDEX IF NOT EXISTS idx_eod_symbol_exchange_date ON eod_prices(symbol, exchange, date DESC)`
- `CREATE INDEX IF NOT EXISTS idx_instruments_name ON instruments(name)`
- `CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist ON watchlist_items(watchlist_id, sort_order, symbol)`

Default rows:

- `watchlists`: insert `My Watchlist` if no watchlist exists
- `settings`:
  - `theme = dark`
  - `default_exchange = NSE`
  - `candle_up_color = #26a69a`
  - `candle_down_color = #ef5350`
  - `grid_color = #1e2a3a`
  - `crosshair_color = #5588aa`

### electron/csvImporter.ts

Purpose:

- Preview and import large CSV / TXT / TSV OHLCV files without loading the full file into memory

Use:

- `fs.createReadStream`
- `readline.createInterface`

Do not use `csv-parse`.

Import input model:

```ts
interface ImportOptions {
  filePath: string;
  exchange?: string;
  hasHeader?: boolean;
  dateFormat?: 'auto' | 'YYYYMMDD' | 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'DD-MM-YYYY' | 'DD/MM/YYYY' | 'DD-MMM-YYYY';
  delimiter?: ',' | '\t' | ';';
  onDuplicate?: 'skip' | 'overwrite' | 'error';
  trimWhitespace?: boolean;
  win?: BrowserWindow;
}
```

Duplicate handling:

- `skip` -> `INSERT OR IGNORE`
- `overwrite` -> `INSERT OR REPLACE`
- `error` -> abort on first duplicate detection in the batch

CSV assumptions:

- Canonical order if no header is detected:
  `symbol, date, open, high, low, close, volume`
- Auto-detect delimiter from the first line
- Auto-detect header aliases
- Normalize dates to `YYYY-MM-DD`
- Batch 2,000 rows per transaction
- Emit `import:progress` every 10,000 rows
- Collect at most 20 sample error messages

Also export:

- `previewCsv(filePath: string, maxRows = 5): Promise<CsvPreview>`

Preview contract:

```ts
interface CsvPreview {
  headers: string[];
  rows: string[][];
  detectedDelimiter: string;
  totalEstimatedRows: number;
}
```

### electron/bhavcopy.ts

Purpose:

- Download NSE cash-market bhavcopy zip
- Extract the CSV
- Parse supported formats
- Insert rows into the active database

Rules:

- Requires an open database
- Warm up `https://www.nseindia.com` first to obtain cookies
- Reuse the same session/cookies for the zip request
- Set a desktop browser user-agent and referer
- Skip download if `download_log` already contains that `trade_date` and `exchange='NSE'` with status `ok`
- Only import `EQ` and `BE` series
- Use transactions for inserts
- Emit `bhavcopy:progress` at meaningful steps

Exports:

- `downloadBhavcopy(targetDate?: string, win?: BrowserWindow): Promise<DownloadResult>`
- `getLastTradingDay(): string`

### electron/menuBar.ts

Build a native Electron menu.

Only include supported actions.

File:

- New Database
- Open Database
- Close Database
- separator
- Import CSV
- Download Bhavcopy
- separator
- Exit

View:

- Toggle Sidebar
- Toggle OHLCV Bar
- Toggle Status Bar
- separator
- Reload
- Toggle DevTools

Chart:

- Timeframe: Daily / Weekly / Monthly
- separator
- Add SMA
- Add EMA
- Add Bollinger Bands
- Clear Indicators

Help:

- About EOD Chart

Menu behavior:

- Database items are handled fully in the main process, then emit a renderer refresh event
- UI toggle and chart command items send a renderer menu event

### electron/preload.ts

Expose a typed `window.electronAPI` using `contextBridge`.

Required methods:

```ts
getAppSnapshot(): Promise<AppSnapshot>
createDatabaseInteractive(): Promise<AppSnapshot>
openDatabaseInteractive(): Promise<AppSnapshot>
activateDatabasePath(filePath: string): Promise<AppSnapshot>
closeDatabase(): Promise<AppSnapshot>

searchSymbols(input: { query: string; exchange?: string | null }): Promise<InstrumentSummary[]>
getEodData(input: { symbol: string; exchange: string; from?: string; to?: string }): Promise<EodRow[]>

getWatchlists(): Promise<Watchlist[]>
createWatchlist(name: string): Promise<Watchlist>
addToWatchlist(input: { watchlistId: number; symbol: string; exchange: string }): Promise<{ success: boolean }>
removeFromWatchlist(input: { watchlistId: number; symbol: string; exchange: string }): Promise<{ success: boolean }>

pickCsvFile(): Promise<string | null>
previewCsv(filePath: string): Promise<CsvPreview>
importCsv(options: ImportOptions): Promise<ImportResult>

downloadBhavcopy(date?: string): Promise<DownloadResult>

getSetting(key: string): Promise<string | null>
setSetting(input: { key: string; value: string }): Promise<{ success: boolean }>

onMenuCommand(callback: (command: string, payload?: unknown) => void): () => void
onImportProgress(callback: (pct: number, message: string) => void): () => void
onDownloadProgress(callback: (pct: number, message: string) => void): () => void
onDatabaseChanged(callback: (snapshot: AppSnapshot) => void): () => void
```

### electron/ipc/handlers.ts

Register every `ipcMain.handle()` call here.

This file receives a `BrowserWindow` reference when initialized so import and bhavcopy functions can emit progress to the active renderer.

Handlers:

- `app:getSnapshot`
- `db:createInteractive`
- `db:openInteractive`
- `db:activate`
- `db:close`
- `data:searchSymbols`
- `data:getEod`
- `watchlist:getAll`
- `watchlist:create`
- `watchlist:addSymbol`
- `watchlist:removeSymbol`
- `import:pickFile`
- `import:preview`
- `import:run`
- `bhavcopy:download`
- `settings:get`
- `settings:set`

Search query behavior:

- Exact symbol matches first
- Prefix matches second
- Name contains last
- Limit 30

### electron/main.ts

Responsibilities:

- App entry
- Window creation
- Automatic reopen of last active database if it still exists
- IPC registration
- Menu setup
- Navigation hardening

BrowserWindow:

- width `1440`
- height `900`
- minWidth `960`
- minHeight `640`
- backgroundColor `#0b0f16`
- `titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'`
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: false`
- `show: false`

Startup order:

1. `app.whenReady()`
2. Create the window
3. Register IPC handlers with the window reference
4. Build the menu
5. Attempt to reopen `lastActivePath` from the registry
6. Show the window on `ready-to-show`

Security:

- Prevent unexpected navigation
- Open external URLs with `shell.openExternal`

## Renderer Contracts

### src/types/electron.d.ts

Create an ambient declaration for `window.electronAPI`.

Also define the shared renderer-facing interfaces used by the preload contract:

- `KnownDatabase`
- `DbStats`
- `InstrumentKey`
- `InstrumentSummary`
- `Watchlist`
- `WatchlistItem`
- `EodRow`
- `CsvPreview`
- `ImportResult`
- `DownloadResult`
- `AppSnapshot`

### Shared Renderer Model

Use these key shapes:

```ts
interface InstrumentKey {
  symbol: string;
  exchange: string;
}

interface AppSnapshot {
  activeDatabasePath: string | null;
  knownDatabases: KnownDatabase[];
  dbStats: DbStats | null;
  watchlists: Watchlist[];
  theme: 'dark';
}

interface OHLCBar {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  prevClose?: number;
}
```

## Chart Engine

### src/engine/types.ts

Define:

- `OHLCBar`
- `Viewport`
- `ScaleX`
- `ScaleY`
- `CrosshairState`
- `ChartTheme`
- `OverlayIndicator`
- `ChartEngineConfig`

`DARK_THEME` must match the UI palette.

### src/engine/ScaleManager.ts

Pure math only.

Implement:

- `buildScaleX`
- `buildScaleY`
- `buildVolumeScaleY`
- `clampViewport`
- `zoomViewport`
- `panViewport`
- `niceYTicks`
- `niceXTicks`

### src/engine/Renderer.ts

Pure canvas draw functions only.

Implement:

- background fill
- grid
- y-axis
- x-axis
- volume bars
- candles
- overlay lines
- Bollinger fill and lines
- last price marker

Do not render the OHLCV header strip here.
That belongs to the React `OhlcvBar` component.

### src/engine/Crosshair.ts

Implement:

- `computeCrosshair`
- `drawCrosshair`
- `hitTestBar`
- `formatVolume`
- `formatPrice`

### src/engine/ChartEngine.ts

Main class with two overlapping canvases:

- base canvas for expensive redraws
- overlay canvas for crosshair and hover feedback

Public API:

- `mount()`
- `unmount()`
- `resize()`
- `setSymbol(instrumentKey | null)`
- `loadBars(bars: OHLCBar[])`
- `setOverlays(overlays: OverlayIndicator[])`
- `setTheme(theme: ChartTheme)`
- `on(listener)`

Events emitted:

- `crosshairMove`
- `viewportChange`

Interactions:

- wheel zoom around cursor
- left-drag pan
- double-click reset viewport to last 120 bars

## Zustand Store

### src/store/chartStore.ts

Use a single store.

State:

- `snapshot: AppSnapshot | null`
- `activeInstrument: InstrumentKey | null`
- `rawBars: OHLCBar[]`
- `displayBars: OHLCBar[]`
- `timeframe: 'D' | 'W' | 'M'`
- `isLoadingBars: boolean`
- `searchQuery: string`
- `searchResults: InstrumentSummary[]`
- `hoverBar: OHLCBar | null`
- `visibleBarCount: number`
- `uiFlags: { sidebarVisible: boolean; ohlcvBarVisible: boolean; statusBarVisible: boolean }`
- `importDialog: { open: boolean; filePath: string | null }`
- `importProgress`
- `downloadProgress`
- `indicators: OverlayIndicator[]`

Actions:

- `init()`
- `refreshSnapshot()`
- `loadInstrument(key: InstrumentKey)`
- `setTimeframe(tf)`
- `setSearchQuery(query)`
- `runSearch(query)`
- `setHoverBar(bar)`
- `setVisibleBarCount(count)`
- `toggleSidebar()`
- `toggleOhlcvBar()`
- `toggleStatusBar()`
- `openImportDialog(filePath?)`
- `closeImportDialog()`
- `setImportProgress(...)`
- `setDownloadProgress(...)`
- `addIndicator(kind)`
- `clearIndicators()`

Behavior:

- `init()` fetches the initial snapshot
- `init()` registers `onMenuCommand`, `onDatabaseChanged`, `onImportProgress`, `onDownloadProgress`
- `loadInstrument()` always calls `getEodData({ symbol, exchange })`
- `setTimeframe()` recomputes `displayBars` from `rawBars`
- Weekly and monthly bars are aggregated in the renderer/store layer from daily rows

## React Components

### src/App.tsx

Layout:

- full viewport
- no document scroll
- sidebar on the left when visible
- toolbar above chart
- optional OHLCV bar below toolbar
- chart fills remaining space
- optional status bar at bottom
- import dialog overlays the app

Call `store.init()` on mount once.

### src/components/ChartCanvas.tsx

Props:

- `instrument: InstrumentKey | null`
- `bars: OHLCBar[]`
- `overlays: OverlayIndicator[]`
- `loading: boolean`

Behavior:

- create `ChartEngine` on mount
- connect `crosshairMove` to `store.setHoverBar()`
- connect `viewportChange` to `store.setVisibleBarCount()`
- update engine when bars, overlays, or instrument change

### src/components/Toolbar.tsx

Show:

- active symbol and exchange
- instrument name if available from search result context
- timeframe buttons: D / W / M
- quick buttons for Import CSV and Download Bhavcopy

### src/components/OhlcvBar.tsx

Render the hovered bar if available, otherwise the latest visible bar.

Display:

- symbol
- date
- O
- H
- L
- C
- absolute change
- percent change
- volume in Indian units

### src/components/Sidebar.tsx

Sections:

1. App header
2. Active database selector
3. Database actions
4. Symbol search
5. Search results
6. Watchlist
7. Footer status

Database section:

- `<select>` of known database paths from the app snapshot
- `New` button -> `createDatabaseInteractive()`
- `Open` button -> `openDatabaseInteractive()`
- `Close` button -> `closeDatabase()`

When the user selects a different database from the dropdown:

- call `activateDatabasePath(path)`
- then refresh the snapshot

Search:

- debounce 250ms
- search by symbol and name
- selecting a result loads `{ symbol, exchange }`

Watchlist:

- show items as `EXCHANGE:SYMBOL`
- clicking loads that instrument
- add/remove actions preserve exchange

### src/components/StatusBar.tsx

Fixed height `22px`.

Left side:

- DB name or `No DB`
- symbol count
- bar count
- date range
- import progress if running

Right side:

- active instrument label
- visible bar count
- db size in MB
- clock

### src/components/ImportCsvDialog.tsx

Modal behavior:

- click backdrop to close
- Escape to close
- browse button uses `pickCsvFile()`
- once a file is chosen, call `previewCsv()`

Options:

- exchange
- date format
- duplicate handling
- has header
- trim whitespace

On import:

- subscribe to `onImportProgress`
- call `importCsv`
- unsubscribe when done
- refresh the app snapshot on success

## Styling Rules

Use only:

- inline style objects in React components
- `src/styles/global.css` for reset / scrollbar / root sizing

Do not use:

- Tailwind
- CSS modules
- styled-components
- Emotion

Palette:

- `--bg: #0b0f16`
- `--bg2: #0d1219`
- `--bg3: #111820`
- `--border: #1a2535`
- `--border2: #1e2e42`
- `--text: #c9d6e3`
- `--text-dim: #546e7a`
- `--green: #26a69a`
- `--red: #ef5350`
- `--blue: #3a7bd5`
- `--accent: #4a9edd`

Fonts:

- JetBrains Mono for all labels, numbers, prices, and status text
- Syne for app title and symbol header

Keep the UI dense, chart-first, and desktop-oriented.

## Implementation Order

Build in this order:

1. `package.json`, `tsconfig.json`, `tsconfig.electron.json`, `vite.config.ts`, `index.html`
2. `electron/db.ts`
3. `electron/csvImporter.ts`
4. `electron/bhavcopy.ts`
5. `electron/preload.ts`
6. `electron/ipc/handlers.ts`
7. `electron/menuBar.ts`
8. `electron/main.ts`
9. `src/types/electron.d.ts`
10. `src/engine/types.ts`
11. `src/engine/ScaleManager.ts`
12. `src/engine/Renderer.ts`
13. `src/engine/Crosshair.ts`
14. `src/engine/ChartEngine.ts`
15. `src/store/chartStore.ts`
16. `src/components/StatusBar.tsx`
17. `src/components/ImportCsvDialog.tsx`
18. `src/components/Toolbar.tsx`
19. `src/components/OhlcvBar.tsx`
20. `src/components/ChartCanvas.tsx`
21. `src/components/Sidebar.tsx`
22. `src/App.tsx`
23. `src/main.tsx`
24. `src/styles/global.css`

## Acceptance Criteria

The implementation is complete only when all of the following are true:

1. `npm run build` passes.
2. `npm run dist:win` is ready to produce a Windows installer.
3. The app can start with no database open.
4. The user can create a new database file and open an existing database file.
5. The database selector shows recent databases and switching works.
6. CSV preview works before import.
7. CSV import inserts bars and instruments into the active database.
8. Bhavcopy download inserts data into the active database.
9. Search returns instruments and loads the chart using `{ symbol, exchange }`.
10. Watchlists preserve exchange and can load instruments correctly.
11. Chart supports zoom, pan, crosshair, daily/weekly/monthly aggregation, and overlay indicators.

## Final Rule

Implement only what is specified in this revised prompt.
Do not resurrect unsupported menu items or placeholder features from the earlier draft.
