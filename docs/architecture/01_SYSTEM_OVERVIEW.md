# System Overview & Architecture Topology

## 1. High-Level System Architecture

The **EOD Charting Platform** is an enterprise-grade, local-first technical analysis and end-of-day market data analytics desktop application built specifically for Indian financial markets (NSE & BSE equities, indices, and derivatives).

The system operates across two core tiers:
1. **Frontend Presentation & Engine Tier (React 18 + TypeScript + Custom Canvas 2D Engine)**: Executes in the Tauri Webview, handling zero-latency user interaction, layered multi-pane canvas rendering, math-heavy geometry calculations, mathematical indicator computation (TA-Lib compatible), drawing tools persistence, and reactive workspace state.
2. **Backend Storage & Ingestion Tier (Rust Tauri 2 Core Shell)**: Executes as a native operating system process, managing direct OS file system I/O, SQLite database connections with WAL mode, custom high-performance `.eod` fixed-record binary file layouts, resilient multi-threaded Bhavcopy ingestion engines, corporate actions reconciliation, and secure Tauri IPC bridges.

```mermaid
graph TB
    subgraph Frontend ["Frontend Tier (Webview: React 18 + TypeScript)"]
        UI[RootApp / React Components / Modals]
        ZStore[Zustand Stores: chartStore, uiStore, windowStore]
        Engine[ChartEngine: Interaction, Viewport & Panes]
        Renderer[Renderer.ts: Custom Multi-Layer Canvas 2D Engine]
        ScaleMgr[ScaleManager.ts: Linear/Log & Date Scale Math]
        IndEngine[Indicators / Patterns / Scanners / Alerts]
        PlatformBridge[src/platform/tauriDesktop.ts]
        
        UI --> ZStore
        UI --> Engine
        Engine --> ScaleMgr
        Engine --> Renderer
        Engine --> IndEngine
        UI --> PlatformBridge
    end

    subgraph IPC ["Tauri 2 IPC Layer"]
        IPC_Invoke[Tauri Commands / Invokes (Async/Sync)]
        IPC_Events[Tauri Event Emitter / Streams]
    end

    subgraph Backend ["Backend Tier (Rust / src-tauri-shell)"]
        MainRouter[main.rs: Command Dispatcher & Route Handlers]
        ConnRegistry[connection_registry.rs: Connection Pool & DB State]
        BinaryEngine[binary_eod.rs: 64-Byte Record Direct Binary I/O]
        SqliteEngine[database/*.rs: SQLite 3 Engine (WAL Mode)]
        BhavcopyWorker[bhavcopy.rs & bhavcopy_recovery.rs: Ingestion & Checkpoint Pipeline]
        CorpActionEngine[corporate_action_imports.rs: Identity & Adjustment Engine]
        DNNExporter[dnn_research_export.rs: Machine Learning Dataset Exporter]
    end

    subgraph Storage ["Local Storage Tier (Local Disk)"]
        BinaryFiles["Binary Storage (*.eod files in /data/eod/)"]
        SQLiteDB["market-data.sqlite3 (Metadata, Watchlists, Settings)"]
        Journals["Recovery Journals & Checkpoint Manifests"]
        ProfileConfig["app-profile.json & Layout Profiles"]
    end

    PlatformBridge <--> |Tauri IPC Invokes| IPC_Invoke
    IPC_Events <--> |Progress / Streaming Events| PlatformBridge
    IPC_Invoke --> MainRouter
    MainRouter --> ConnRegistry
    MainRouter --> BhavcopyWorker
    MainRouter --> BinaryEngine
    MainRouter --> SqliteEngine
    MainRouter --> CorpActionEngine
    MainRouter --> DNNExporter
    BhavcopyWorker --> BinaryEngine
    BhavcopyWorker --> Journals
    BinaryEngine <--> BinaryFiles
    SqliteEngine <--> SQLiteDB
    ConnRegistry <--> ProfileConfig
```

---

## 2. Directory Tree & Responsibility Boundaries

```
EOD Charting Platform/
├── .cargo/
│   └── config.toml                  # Root Cargo configuration (routes build targets to /target)
├── docs/
│   ├── architecture/                # Deep architectural blueprints & system specifications
│   └── changes/                     # Historical change manifests and verification logs
├── resources/                       # Static app icon assets and ML prediction schemas
├── scripts/                         # Build, backup, validation, and snapshot PowerShell/Node scripts
├── src/                             # Frontend React 18 + TypeScript Application
│   ├── assets/                      # Static icons, svgs, and UI graphic assets
│   ├── components/                  # React UI components (Panels, Dialogs, Docks, Overlays)
│   │   ├── common/                  # Draggable shells, floating windows, error boundaries
│   │   ├── drawings/                # Visual drawing properties and template inspectors
│   │   ├── ChartCanvas.tsx          # Dual-layer Canvas mounting and event binding orchestrator
│   │   ├── Sidebar.tsx              # 4-Rail Navigation Sidebar (SYM, IND, WL, MOV)
│   │   └── Toolbar.tsx              # Top navigation, timeframe selectors, chart types, auto-plot
│   ├── engine/                      # Core High-Performance Canvas 2D Engine
│   │   ├── ChartEngine.ts           # Central interaction controller, hit testing, viewport state
│   │   ├── Renderer.ts              # Pixel-level rendering routines (Candles, Bars, Grid, Axes)
│   │   ├── ScaleManager.ts          # Mathematical coordinate transformations (Price-to-Y, Time-to-X)
│   │   ├── Indicators.ts            # Indicator computation pipelines & multi-pane transformers
│   │   ├── Crosshair.ts             # High-frequency crosshair tracking and tooltip generation
│   │   ├── VolumeProfile.ts         # Session and visible range volume distribution algorithms
│   │   ├── Heatmap.ts               # Intensity matrix and liquidity visualizers
│   │   ├── DataConflation.ts        # Dynamic LOD downsampling for multi-million point series
│   │   ├── DrawingGeometry.ts       # Geometric primitives, ray projections, line intersections
│   │   └── DrawingF1*Geometry.ts    # Advanced Fibonacci & Gann mathematical projection models
│   ├── features/                    # Domain feature modules
│   │   ├── alerts/                  # Price, drawing, and indicator threshold alerting engine
│   │   ├── app/                     # Application settings, theme services, layout managers
│   │   ├── candlestick/             # Japanese Candlestick pattern recognition rules
│   │   ├── charts/                  # Timeframe transforms, screenshot renderer, hydration
│   │   ├── corporateActions/        # Corporate action approval, splits, bonuses, dividends UI
│   │   ├── marketMovers/            # Gainers, losers, volume shockers, 52-week breakout filters
│   │   └── watchlists/              # Predefined official NSE/BSE groups and custom user watchlists
│   ├── indicators/                  # 118 Modular Technical Analysis Indicators Catalog
│   ├── platform/                    # Abstracted Desktop Bridge interface & Tauri 2 implementations
│   ├── plugins/                     # Extensible plugin system (Scanners, Forecasts, ML Adapters)
│   ├── store/                       # Reactive Zustand state stores (chartStore, uiStore, windowStore)
│   └── types/                       # Global TypeScript type definitions and IPC interfaces
├── src-tauri-shell/                 # Native Rust Backend (Tauri 2 Core)
│   ├── src/
│   │   ├── app_profile.rs           # Multi-profile paths and active workspace registry
│   │   ├── bhavcopy.rs              # High-throughput multi-threaded Bhavcopy download & parser
│   │   ├── bhavcopy_recovery.rs     # Journal-based crash-resilient ACID ingestion recovery
│   │   ├── database/                # SQLite3 database access layer & schema migrations
│   │   │   ├── binary_eod.rs        # 64-byte fixed record binary file reader/writer/migrator
│   │   │   ├── bootstrap.rs         # SQLite table schemas, pragmas, index optimizations
│   │   │   ├── connection_registry.rs# Thread-safe connection pooling and cache invalidation
│   │   │   ├── corporate_action_imports.rs # Corporate actions parsing, ISIN resolution & adjustments
│   │   │   ├── daily_market_snapshot.rs   # Bulk snapshot cache for high-speed market scanners
│   │   │   ├── dnn_research_export.rs     # Machine learning training feature matrix exporter
│   │   │   ├── eod_data.rs          # EOD quote reader (seamless Hybrid/Binary/SQLite resolution)
│   │   │   ├── quotes.rs            # Quote CRUD, date-range deletes, prev_close recalculations
│   │   │   └── symbol_search.rs     # High-speed prefix & fuzzy symbol index search
│   │   ├── manual_import_recovery.rs# User CSV import tracking and reversible undo journals
│   │   ├── runtime.rs               # Diagnostic logging and runtime environment detection
│   │   └── main.rs                  # Native application entry, OS menus, IPC command registry
│   ├── Cargo.toml                   # Rust dependencies and compiler optimization profiles
│   └── tauri.conf.json              # Tauri 2 window permissions, security capabilities, bundle config
└── package.json                     # Frontend dependencies, scripts, and tooling config
```

---

## 3. Technology Stack & Core Dependencies

### Frontend Tier
* **Framework**: React `18.3.1` with React DOM
* **Language**: TypeScript `5.4.5` (Strict Mode)
* **Bundler & Dev Server**: Vite `5.3.1` with `@vitejs/plugin-react`
* **Desktop API Binding**: `@tauri-apps/api` `2.11.1`
* **State Management**: Zustand `4.5.2` (Subscribed slice architecture)
* **Date Manipulation**: `date-fns` `3.6.0`
* **Mathematical & Technical Indicators**: `technicalindicators` `3.1.0` + custom internal SIMD/vectorized engines
* **Unit Testing**: Vitest `4.1.2` with jsdom environment

### Native Desktop & Backend Tier
* **Runtime Core**: Tauri `2.11.5` / `tauri-build` `2.5.6`
* **Systems Language**: Rust `2021 Edition` (rustc 1.78+)
* **Database Engine**: `rusqlite` `0.31.0` (with `bundled` SQLite 3.45+)
* **Async Runtime**: `tokio` (via Tauri async command dispatcher)
* **Serialization/Deserialization**: `serde` `1.0` (with `derive` macro), `serde_json` `1.0`
* **Network & HTTP Client**: `reqwest` `0.12.24` (`rustls-tls`, `cookies`, `blocking`)
* **CSV Streaming & Parsing**: `csv` `1.4.0`
* **Cryptography & Integrity**: `sha2` `0.10` (SHA-256 manifest validation)
* **Compression**: `zip` `0.6.6` (Deflate extraction for bhavcopy archives)
* **Native Dialogs**: `rfd` `0.15.4` (Native OS file pickers)
* **Date & Time**: `chrono` `0.4.42`
