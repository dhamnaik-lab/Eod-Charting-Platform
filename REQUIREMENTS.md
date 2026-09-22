# EOD Charting Platform — Product Requirements

Updated: 2026-08-22 21:14 IST (+05:30)

Updated: 2026-08-13

Local-first, high-performance end-of-day charting desktop platform for Indian equities and indices (NSE/BSE).

## 1. Core product principles

- **Local-first and private:** Market data, databases, settings, workspaces, alerts, and audit evidence remain under user-controlled local folders.
- **Chart-first performance:** The custom Canvas 2D chart engine must remain responsive across long EOD histories and multi-chart layouts.
- **Typed desktop boundary:** Renderer code must use `src/platform/*` and `src/types/desktop.ts`; components must not add ad-hoc Tauri calls.
- **Review-first data correction:** Corporate-action candidates and identity evidence require explicit review. Raw `.eod` history must not be silently rewritten or auto-approved.
- **Fail-closed release handling:** Portable packaging must use the canonical release executable and verify source/destination identity before declaring success.
- **Exchange identity fidelity:** Imports must preserve official exchange identifiers. Do not manufacture trading symbols from company/security names; any identifier-to-symbol translation must use an audited identity mapping.
- **Recoverable mutation:** Binary import acceleration must not remove the ability to prove, roll back, or durably replay protected mutations after interruption.

## 2. Technical and build architecture

- **Desktop shell:** Tauri 2 under `src-tauri-shell/`.
- **Frontend:** React 18, TypeScript 5, Vite 5, Zustand.
- **Rust manifest:** `src-tauri-shell/Cargo.toml`.
- **Canonical Cargo output:** Repository-root `target/`, configured by the live project’s `.cargo/config.toml`.
- **Portable source executable:** `target/release/eod-charting-platform-shell.exe`.
- **Portable destination:** `release/tauri-portable-win/EOD Chart Portable/EOD Chart.exe`.
- **Portable verification:** Packaging must fail if the source and staged executable SHA-256 values differ.
- **Generated output:** `node_modules/`, `dist/`, `release/`, `target/`, and legacy `src-tauri-shell/target/` are non-source.
- **Warning-free Rust contract:** production `cargo check`, Rust test compilation, and Tauri compile checks must pass with warnings denied; blanket `#[allow(dead_code)]` is not an acceptable substitute for source ownership/gating.

## 3. Functional requirements

### 3.1 Data management and exchange integration

- Create, open, activate, close, delete, and track local folder-based databases.
- Download and ingest NSE/BSE bhavcopy data with holiday/import-history awareness, historical/new-format provider cutovers, and explicit fallback handling.
- Bhavcopy protected imports must persist durable recovery evidence before binary mutation. Existing-file `APPEND_NEWEST` may use recovery-journal-buffered durability; conservative rewrite/update/historical mutation paths and recovery replay must remain immediately durable unless a separately validated contract replaces them.
- New/full binary-file writes must cross an explicit `sync_data()` durability barrier before the temporary file is renamed into canonical position; they may not rely on the deferred APPEND_NEWEST checkpoint.
- The binary-state sidecar must support localized row invalidation and post-checkpoint incremental VERIFIED publication without requiring a generation rebuild. Missing/unindexed rows must fail safe to per-symbol fallback and must not silently poison or fabricate global state.
- Bhavcopy concurrency policies are independent: binary import/write workers are capped at 2, read-only binary coverage prefilter workers are capped at 4, and deferred APPEND_NEWEST checkpoint workers are capped at 2. Do not merge or change these policies without a comparable same-drive contention benchmark plus a genuine workload check.
- Deferred APPEND_NEWEST checkpointing must remain recovery-journal verified, expose phase/latency telemetry, and preserve restart-safe `APPLIED`/`CHECKPOINTING` resume semantics.
- Automatic Bhavcopy `Update` must defer current-day probing until 18:00 local time; before that cutoff it may probe only through the previous calendar day. Manual Date Range and Full History semantics remain independent of this cutoff.
- Bhavcopy market-calendar precedence must be: known special trading session -> trading day; otherwise weekend -> skip; otherwise known exchange holiday -> skip; otherwise probe the source. Source-unavailable/mismatch results must not be classified as holidays.
- Binary Date Range prefiltering must not trust import metadata alone: for bounded target-date sets it must reconcile usable physical binary coverage fail-closed before suppressing download jobs.
- Manual Binary Import must retain durable per-session recovery history and conflict-safe session-specific Undo.
- Quotation/date-range deletion must remove quotation history only and must not auto-delete instrument identity because the final quote was removed.
- Successful Quote Editor mutations must invalidate affected `download_log` completion metadata and the exact affected binary-state rows; zero-row mutations must leave metadata/state unchanged.
- Quote Editor is an in-app modeless `FloatingWindow` owned by the main EOD Chart renderer. A separate native/taskbar `WebviewWindow` is not the accepted current UX unless separately approved.
- Support current symbols, aliases, old symbols, delisted/suspended instruments, NSE/BSE indices, series/group metadata, and time-aware identity evidence.
- Preserve broad NSE equity ingestion: supported equity/trade-for-trade/SME series such as `EQ`, `BE`, `BZ`, `SM`, `ST`, and `SZ` must not be dropped by a newly introduced equity-series whitelist. Persist series metadata and perform normal browsing filters in the Symbols/sidebar layer. Existing configured government-security exclusions remain a separate non-equity rule.
- Preserve official BSE identifiers exactly as received. Historical files that expose only `SC_CODE` must not be converted into synthetic tickers from `SC_NAME`; any alpha-symbol resolution must use audited BSE identity data such as security-code/ISIN mappings.
- Maintain raw and adjusted chart modes with review-first corporate-action handling.
- Support SQLite and binary EOD storage with explicit storage-mode and parity behaviour.

### 3.2 Charting and workspace

- Multi-chart layouts: `1x1`, `2x1`, `1x2`, and `2x2`.
- Date-synchronized crosshairs and optional symbol linking across chart panes.
- Candlestick, OHLC bar, line, area, baseline/HLC-area, Heikin-Ashi, and bounded Renko transforms.
- Daily, weekly, monthly, quarterly, and yearly aggregation.
- Persist tabs, sheets, layouts, indicators, drawings, pane state, chart type, viewport, compare overlays, and visual settings.
- Preserve chart state and viewport during database refreshes where the underlying symbol remains valid.

### 3.3 Indicators, drawings, signals, and alerts

- Support core moving averages, momentum/volatility studies, volume studies, Ichimoku, Supertrend, CPR, AVWAP, Stochastic RSI, and the maintained indicator catalog.
- Support price sources, study-as-source chaining, offsets, plot presentation, pane state, and persisted settings.
- Support chart drawings, drawing properties, selection, image export, and supported drawing-derived alerts.
- Drawing renderer and hit-testing must use the same canonical geometry, or mathematically equivalent geometry, for geometry-sensitive tools; a rendered level/ray/curve must not have a stale hit-test approximation.
- Within one timeframe, persisted drawing anchors and their analytical geometry must remain stable across zoom, pan, reset-view, and price auto-scale changes. Screen angles/shapes may change with scale, but data-coordinate meaning must not migrate.
- The completed Fibonacci family is a protected regression baseline. Fib Wedge must remain data-space-first; Fib Spiral must retain the accepted F1D.1 basis rather than the rejected F1D.2 absolute-time basis; and `fibFan` must retain the accepted F1E.1 exact projected apex-to-Fibonacci-target ray construction. Reopen these behaviors only for a reproducible defect.
- Gann fidelity work must start from the existing `gann` and `gannBox` persisted kinds and preserve workspace compatibility and the completed Fibonacci baseline.
- Support persisted EOD price, indicator, scanner-match, and supported drawing alerts with history and explicit enable/disable state.

### 3.4 Scanner and Market Movers

- Scanner definitions remain registered under `src/plugins/scanner/*` and execute through the scanner runner/workspace contracts.
- Daily scanner formulas for change and relative volume must use `calculateDailyMarketMetrics()` as the shared calculation source.
- Market Movers must use one backend batch request, not one renderer IPC call per symbol.
- The backend scan must use a dedicated read-only database connection and bounded recent history.
- Opening Market Movers must never auto-start a full-universe scan.
- The UI must provide explicit `Scan`, `Update`, and `Cancel` actions with progress and error state.
- Existing results must remain visible during an update.
- Exchange, filter, and database changes must mark results dirty without automatic rescanning.
- Concurrent duplicate requests must be coalesced; stale request completions must not overwrite newer state.
- Frontend ranking/filtering must run off the renderer UI thread when using the worker path.
- The snapshot must choose a common market date by symbol coverage, exclude stale/insufficient/invalid rows, expose coverage and failure accounting, and distinguish registered corporate actions from unexplained extreme moves.
- Gainers, losers, and volume-surge rankings must be deterministic and chart-navigation capable.
- BSE group/series eligibility requires a separate audited rule before being described as complete.

## 4. Documentation and verification requirements

The canonical maintained documents are:

1. `AGENTS.md` — operating rules and repository boundaries.
2. `HANDOFF.md` — current state, known gaps, evidence, and exact next step.
3. `README.md` — orientation, setup, build, and current baseline.
4. `REQUIREMENTS.md` — product and non-functional requirements.
5. `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` — current component/data/build architecture.
6. `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md` — concise status and evidence matrix.
7. `FILE_INVENTORY.md` — active source/config/document ownership and snapshot completeness.
8. `PROJECT_STATE_EOD_CHARTING_PLATFORM.md` — append-only verified history.
9. `docs/changes/YYYY-MM-DD_HHMM_IST_*.md` — timestamped change evidence.

Validation rules:

- Use the narrowest relevant tests/checks first.
- Record exact commands and actual results.
- Do not equate source inspection with runtime validation.
- Do not claim a portable build passed without command output and executable-location/hash verification.
- Documentation-only passes must verify required documents, internal consistency, changed-file inventory, and archive integrity.
- Bhavcopy performance claims must report workload shape (`APPEND_NEWEST` vs conservative paths), binary wall time, physical/deferred sync counts, and imported row/error counts; do not compare unlike workloads as regressions.
- Worker-policy acceptance must distinguish synthetic benchmark evidence from genuine full-market runtime evidence; no guaranteed speedup may be claimed from unlike workloads.
- Current documentation must state unresolved physical/index census gaps explicitly and must not describe an integrity-checked but incompletely indexed sidecar as fully reconciled.
- A source/provider fix is not runtime-accepted until the previously failing real exchange/date case succeeds in the rebuilt application.
