# EOD Charting Platform — Market Movers Hybrid Implementation

**Change timestamp:** 2026-08-04 11:22 IST (+05:30)  
**UTC equivalent:** 2026-08-04 05:52 UTC  
**Implementation status:** Source implementation complete; full toolchain execution pending on the intended Windows development machine.

---

## 1. Source provenance

The working project was assembled from two supplied archives:

1. **Complete-project and backend baseline**  
   `Eod Charting Platform Source Code 03 08 2026.zip`

2. **Latest frontend baseline**  
   `src (2).zip`

Assembly procedure:

- Extracted the complete original project.
- Preserved its Rust/Tauri backend, package files, build configuration, scripts, resources, and documentation.
- Replaced the original `src/` directory with the complete `src/` directory from `src (2).zip`.
- Applied the changes documented below to that assembled source tree.

The supplied archives did not contain `.git`; therefore this record provides Git-compatible file status and content hashes, but not the original branch, staged state, or commit history.

---

## 2. Objective

Convert the Daily Market Movers feature from a frontend-heavy, per-symbol Tauri request flow into a hybrid architecture:

- **Rust backend:** full eligible-universe retrieval, bounded recent-history loading, existing corporate-action adjustment, event metadata, database identity/revision, and batch failure accounting.
- **TypeScript scanner layer:** one canonical calculation function for daily change and 20-session volume metrics.
- **Shared frontend state:** one batch request, one in-flight promise, one cache, one database-change listener, and one result snapshot shared by Sidebar and ScannerWindow.
- **React UI:** TradingView-style compact Sidebar panel, expanded dual-column view, filters, chart linkage, warnings, and accurate counts.

---

## 3. Architecture after implementation

```text
Active EOD database / binary EOD storage
                 │
                 ▼
Rust get_daily_market_snapshot
  • eligible NSE/BSE universe
  • bounded 180-calendar-day read window
  • last 21–120 sessions per symbol
  • existing corporate-action adjustment engine
  • action events and adjustment flags
  • database identity/revision and failure details
                 │ one Tauri IPC batch response
                 ▼
marketMoversSnapshotService.ts
  • shared calculateDailyMarketMetrics()
  • modal common market date
  • stale-symbol exclusion and coverage
  • event-type-specific corporate-action status
  • deterministic rankings and filter accounting
                 │
                 ▼
marketMoversStore.ts (Zustand)
  • one in-flight batch request
  • request-generation protection
  • shared cache and database invalidation
  • no expensive rescan when hidden
                 │
          ┌──────┴────────┐
          ▼               ▼
MarketMoversPanel   MarketMoversFullView
Sidebar             ScannerWindow
```

---

## 4. Backend changes

### New batch command

Added:

`src-tauri-shell/src/database/daily_market_snapshot.rs`

The command `get_daily_market_snapshot`:

- accepts `NSE`, `BSE`, or `ALL`;
- uses the existing NSE equity-series filter for NSE;
- obtains active instruments through the existing symbol-search infrastructure;
- performs the market scan inside one Rust blocking task and one active database connection;
- restricts reads to a bounded calendar window rather than transmitting full symbol history;
- retains the latest requested number of sessions, clamped to 21–120;
- uses the existing unified SQLite/binary data loader;
- uses the existing corporate-action adjustment engine;
- returns corporate-action events and separate dividend/rights adjustment flags;
- returns target, fetched, failed, and bounded failure-detail records;
- returns database identity, database revision, and latest known database date.

### Command exposure

Modified:

- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/main.rs`

The new backend module is registered and its command is exposed through Tauri.

### Internal helper visibility

Modified:

- `src-tauri-shell/src/database/eod_data.rs`
- `src-tauri-shell/src/database/symbol_search.rs`

Only the minimum helper visibility required by the sibling batch module was widened to `pub(super)`.

No database schema or stored EOD data was changed.

---

## 5. Frontend data contract and API changes

Modified:

- `src/types/desktop.ts`
- `src/platform/types.ts`
- `src/platform/tauriDesktop.ts`

Added typed contracts for:

- `DailyMarketSnapshotInput`
- `DailyMarketSnapshotSymbol`
- `DailyMarketSnapshotFailure`
- `DailyMarketSnapshotResult`

Added `DesktopBridgeApi.getDailyMarketSnapshot()` and the Tauri invocation for `get_daily_market_snapshot`.

---

## 6. Scanner calculation source of truth

The existing `src/plugins/scanner/dailyMarketScanners.ts` remains the canonical TypeScript calculation layer.

Its exported `calculateDailyMarketMetrics()` is consumed by both:

- normal Daily Market scanner handlers;
- Market Movers snapshot construction.

The shared calculation covers:

- latest close;
- previous-session close;
- absolute change;
- percentage change;
- 20-session average volume;
- volume ratio.

This avoids separate frontend formulas for the same scanner definitions.

---

## 7. Snapshot correctness

`marketMoversSnapshotService.ts` now:

- consumes the backend batch instead of issuing one frontend IPC call per symbol;
- selects the common market date by greatest symbol frequency, with latest date only as a tie-break;
- prevents one rogue future-dated symbol from replacing the market date;
- calculates common-date coverage;
- excludes symbols whose latest bar does not match the selected market date;
- separately records insufficient history, stale date, invalid metrics, price filter, volume filter, and corporate-action exclusion;
- sorts gainers, losers, and volume surge deterministically, including exchange and symbol tie-breaks;
- uses nullable `asOfDate` instead of storing status text in a date field.

### Corporate-action classification

Classification uses actual event markers and the adjustment flags returned by the backend:

- `SPLIT`, `BONUS`, `DEMERGER` require the general adjusted series;
- `RIGHTS` additionally requires `includeRightsAdjustments`;
- `DIVIDEND` additionally requires `includeDividendAdjustments`;
- a move of at least 50% without a registered event is labelled an unexplained extreme move, not automatically called a corporate action.

---

## 8. Shared state and refresh lifecycle

`marketMoversStore.ts` owns:

- settings;
- shared snapshot;
- status and error;
- database-change generation;
- one in-flight key and promise;
- request-generation cancellation protection;
- completed snapshot cache;
- visible consumer count.

Important behavior:

- Sidebar and full view share one backend request and one snapshot.
- Changing only the displayed result count does not rerun the expensive market batch.
- Database changes invalidate the cache.
- When no Market Movers view is visible, database changes mark the snapshot dirty without immediately launching a full scan.
- The next visible consumer refreshes the dirty snapshot.

---

## 9. UI and interaction corrections

### Compact Sidebar

The Market Movers Sidebar supports:

- Gainers, Losers, and Volume tabs;
- NSE, BSE, and combined selection;
- Top 5/10/20 display count;
- draft filter values with Apply/Cancel;
- a portal-based filter popover that is not clipped by Sidebar overflow;
- common-date, coverage, incomplete-universe, failed-symbol, and exclusion information;
- exchange-aware record identity;
- listbox keyboard behavior: arrows change selection, Enter loads the selected symbol;
- delayed single click and double-click cancellation;
- context menu and chart actions.

### Expanded view

The ScannerWindow view:

- shares the same snapshot as the Sidebar;
- displays gainers and losers side by side;
- handles loading, error, empty, stale, failure, and warning states;
- renders results in pages of 100 to avoid immediately mounting the entire universe;
- supports active-chart and duplicated-tab loading.

### ScannerWindow navigation

The requested `market-movers` section is now treated as a one-shot UI command:

- workspace settings hydrate first;
- the explicit requested section is applied afterwards;
- the request is then consumed;
- generic future ScannerWindow openings do not remain permanently forced to Market Movers.

### Styling

Market Movers styling uses project CSS variables and React style objects. No Tailwind framework or Tailwind utility dependency was introduced.

---

## 10. Files added or modified

See the companion file:

`docs/changes/2026-08-04_1122_IST_MARKET_MOVERS_FILE_MANIFEST.txt`

A unified source patch is included at:

`docs/changes/2026-08-04_1122_IST_MARKET_MOVERS.patch`

---

## 11. Validation status

See:

`docs/changes/2026-08-04_1122_IST_MARKET_MOVERS_VALIDATION.txt`

Completed in the available environment:

- isolated TypeScript/TSX parser/transpilation check for all changed frontend files;
- static API-contract and Tauri-command registration checks;
- static confirmation that Market Movers no longer performs per-symbol `getEodData`/`listSymbols` calls;
- static confirmation that unsupported Tailwind utility classes are absent;
- archive integrity verification.

Not completed in this Linux execution environment:

- dependency installation;
- Vitest execution;
- complete TypeScript semantic typecheck;
- Vite production build;
- Rust `cargo check` / Rust tests;
- rebuilt Windows/Tauri visual QA.

The public npm dependency installation attempt timed out, and the environment does not contain Cargo/Rust or PowerShell. These items must be run on the intended Windows development machine before merge or release.

---

## 12. Recommended repository commands

After extracting the delivered ZIP into a working repository:

```powershell
npm ci
npx vitest run src/features/marketMovers
npx vitest run src/plugins/scanner
npx tsc --noEmit
powershell -ExecutionPolicy Bypass -File .\scripts\validate-change.ps1 -Profile renderer
npm run build
cargo test --manifest-path .\src-tauri-shell\Cargo.toml daily_market_snapshot
cargo check --manifest-path .\src-tauri-shell\Cargo.toml

git status --short
git diff --stat
git diff
```

Manual rebuilt-application checks should include:

1. Sidebar styling under every supported theme.
2. Filter popover visibility and Apply/Cancel behavior.
3. One shared scan while Sidebar and full view are both open.
4. Correct NSE/BSE/combined universe counts.
5. Market date and stale/coverage warnings.
6. Single-click, double-click, keyboard, and context-menu chart linkage.
7. ScannerWindow opening directly on Market Movers and later opening normally.
8. Database-change invalidation while Market Movers is visible and hidden.
9. Corporate-action flags for split, bonus, demerger, rights, and dividend examples.
10. Runtime speed and memory on the complete market universe.

---

## 13. Safety statement

This change does not modify:

- database schemas;
- stored market records;
- chart rendering algorithms;
- indicator mathematics unrelated to Daily Market metrics;
- trading or strategy rules;
- broker/live-order routes;
- import or corporate-action mutation workflows.

The new backend route is read-only with respect to EOD data.
