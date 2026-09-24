# EOD Charting Platform - Project State

<!-- GANN-PLUGIN-IMPLEMENTATION:BEGIN -->
## Gann Price-Time Analysis Plugin implemented — 14 September 2026

**Classification:** `GANN_PRICE_TIME_PLUGIN_IMPLEMENTED__ALL_VALIDATION_GATES_PASSED`

The `gann-price-time` indicator plugin (bundled, `defaultEnabled: true`) is fully implemented and validated in the platform source tree. No external dependencies. No database writes. No changes to Fibonacci geometry (F1E.1 frozen baseline preserved). No guarded Vite chunk regressions.

### What was built

- **`src/plugins/analysis/gannPriceTime/types.ts`** — Pure TypeScript contracts for all Gann data shapes.
- **`src/plugins/analysis/gannPriceTime/engine.ts`** — Pure computational engine: Wilder ATR (14-bar), centred-window pivot detection (17-bar default window), Square of Nine harmonic levels ($P_\theta = (\sqrt{P_0} + \theta/360)^2$, θ ∈ {45…360}), 2×1/1×1/1×2 ATR-scale-locked angle rays, 45/90/180/360-bar time cycle boundaries with 5-bar breakout confirmation. Minimum 360-bar guard.
- **`src/plugins/analysis/gannPriceTime/canvasOverlay.ts`** — Canvas 2D renderer. All paths in `ctx.save()`/`ctx.restore()`. Geometry in bar-index/price space; pixel conversion at render time only.
- **`src/plugins/analysis/gannPriceTime/gannPlugin.ts`** — `RegisteredPlugin` manifest.
- **`src/plugins/analysis/gannPriceTime/__tests__/gannEngine.test.ts`** — 28 deterministic unit tests.

### Platform seam

`ChartEngine.setGannOverlayCallback()` registers a single canvas callback that fires at the end of every `renderOverlay()` RAF frame, inside the `leftAxisWidth` translate, before `ctx.restore()`. `ChartCanvas.tsx` wires this via `useEffect([bars])` using `scaleX.toPixel` / `priceScaleY.toPixel` as the coordinate mapper.

### Validation gates — all passed

| Gate | Result |
|---|---|
| Vitest `gannEngine.test.ts` | 28/28 PASS |
| `tsc --noEmit` | 0 errors |
| `npm run build:renderer` | All guarded chunks under 500 kB |
| `cargo check` | Exit 0 — 2 pre-existing warnings, 0 new |

### Known boundaries

- No in-app toggle UI (always active for series ≥ 360 bars).
- No user-configurable options UI (`DEFAULT_GANN_OPTIONS` hardcoded).
- Overlay seam is single-occupancy (one plugin callback at a time).
- Visual smoke test on a live symbol not yet run.
- No real Git staging performed.

Full report: `docs/changes/2026-09-14_0112_IST_GANN_PRICE_TIME_PLUGIN_IMPLEMENTATION.md`
<!-- GANN-PLUGIN-IMPLEMENTATION:END -->

<!-- R1A-R3-CONTINUITY-UPDATE:BEGIN -->
## Current V1.14AD operational override — 2026-08-31 02:02:16 IST

R1A-R4-R2 independently validated and formally closes the 35-path CA alternate-index staging-scope preflight. The live 508-file source/config authority remains `9832CB8F...`; HEAD and the real Git index are unchanged and clean; no real staging, commit, database access, or packaging occurred.

The next mandatory phase is `PARENT_BASELINE_REVIEW_REQUIRED`. That review must resolve whether current HEAD is the correct parent for the CA-only commit and establish safe commit ordering relative to unrelated newer live-source changes.

Real staging remains unauthorized until that review is completed and explicitly approved.
<!-- R1A-R3-CONTINUITY-UPDATE:END -->
## Current verified operational state — 31 August 2026

<!-- ACTIVE-V1.14AD-OPERATIONAL-STATE:BEGIN -->

- Newest confirmed source/evidence snapshot: `E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-31_000303_IST`.
- Snapshot ZIP SHA-256: `95F7C981628EBFB6D100CA4D187B987B0613AD622FD4E7B28D44BDD3DB296296`.
- Full snapshot identity: **771 files / 17,638,159 bytes / `1A25D9FFDD10609817580A9A86428E2B1D03E2205F1EE3BE33CA7E1C99B660C0`**.
- Build-relevant source/config identity: **508 files / 12,758,223 bytes / `9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D`**.
- That build-relevant identity is unchanged from the accepted R1B-R1 authority.
- Latest-source CA integration is functionally validated: renderer typecheck/build passed; focused V1.14AD Rust 4/0; full Rust 375/0/1 ignored; Cargo check passed.
- Watchlist reliability correction is closed: focused split test 3/3; full Vitest 632/632; renderer build/typecheck and split-chunk preservation passed.
- Current phase: **Controlled Corporate Action Staging Preflight**.
- Intended alternate-index staged scope: **35 source/test/config paths**.
- Latest R1A-R2 preflight reached exact EOF-hygiene RED→GREEN and strict `git diff --cached --check` GREEN, then failed only at the helper's final result emission because `out` was undefined.
- Final alternate-index verification/postflight is therefore **not yet accepted**.
- Real Git staging: **not authorized**.
- Commit: **not authorized**.
- Fresh portable rebuild from the eventual accepted staging/commit state: **not yet performed**.
- Parent-baseline/commit-order review remains required before any real staging.

For the exact blocker, next action, prohibited operations, and remaining sequence, read `docs\CURRENT_WORK_STATUS.md` and the latest continuity report.

<!-- ACTIVE-V1.14AD-OPERATIONAL-STATE:END -->

## Verified Corporate Action closure state — 24 August 2026

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

### Verified lineage

- **V1.14L** — source-only resolver hardening validated exact-active NSE symbol preservation for inactive-only historical-ISIN ambiguity while retaining `UNRESOLVED` for genuine active ambiguity.
- **V1.14K.1** — real production-candidate replay returned `3 READY / 0 BLOCKED / 0 DEDUPE CONFLICT`.
- **V1.14M** — controlled read-only preflight returned `READY` and locked the mutation/protected/schema/Apply-plan authority.
- **V1.14M.1.1** — all-three-or-rollback transaction committed exactly three `corporate_action_imports` updates and no other write class.
- **V1.14M.2** — independent read-only post-audit returned `FULL_SUCCESS` and verified the exact post-state, dedupe ownership, protected state, schema safety, and database integrity.
- **Current exact-tranche state** — `CLOSED / FULL_SUCCESS`.

## Latest Verified State (August 22, 2026 - V1.7D Storage Closeout, Zero-Warning Rust, and Embedded Quote Editor Rollback)

- Documentation/source basis: `Eod Charting Platform Source Code 2026-08-22_211417_IST`, uploaded ZIP SHA-256 `1A8F96F4BB339AE9FD1A7995F36A7D3CA4668244D3F3DC0772E6FE19D8ADC81D`, 721 files before this reconciliation.
- Bhavcopy/Generation-6 work through V1.7D is installed:
  - V1.3 baseline fast path;
  - V1.4 APPEND_NEWEST fast classification;
  - V1.5 Quote Editor download-metadata invalidation;
  - V1.6 localized state-row invalidation and post-checkpoint incremental VERIFIED publication;
  - V1.7A new/full-file `sync_data()` before rename plus checkpoint telemetry;
  - V1.7C checkpoint cap 2;
  - V1.7D binary import/write cap 2, with binary coverage prefilter cap preserved at 4.
- V1.7A runtime evidence on 2026-08-20: 8,804 source rows, 8,802 distinct symbols, 33 new files, 8,769 APPEND_NEWEST, 33 immediate new-file sync calls, 8,769 deferred checkpoint files, 132,580 ms four-worker checkpoint with phase/latency telemetry.
- V1.7B 1,000-file same-drive benchmark median favored two checkpoint workers. V1.7C installed cap 2. Genuine 2026-08-21 full-market checkpoint (8,783 files) completed in 146,799 ms with two workers versus the earlier close four-worker workload at 132,580 ms; therefore no guaranteed speedup is claimed and next genuine-day evidence remains required.
- Genuine 2026-08-21 download succeeded 4/4 with 8,810 source rows / 8,806 symbols, 23 new files, 8,783 APPEND_NEWEST, 23 immediate new-file sync calls, and zero binary errors. That run preceded V1.7D import cap 2.
- Final Rust warning reconciliation: production `cargo check`, Rust test compilation, and Tauri compile check passed with warnings denied. No blanket dead-code allow was added.
- Quote Editor exchange/filter/count/display and state-invalidation regressions passed. The native/taskbar Tauri child-window experiment was rejected and source-restored from the pre-change backup. Embedded `FloatingWindow` RED→GREEN rollback tests, renderer typecheck/build, warning-free Rust compile, portable build, and manual runtime smoke test all passed.
- Post-rollback runtime-validation portable executable SHA-256: `7C3E92E77ABBAD314F795C73577AED453E4641E6EB9C557C689019F14091847B`.
- Current live state audit: sidecar SHA-256 `9467D8828D6993CF237540FF023DE0D1A4B4E66962CCC795D1BAD996212D1BF6`, size 5,054,464 bytes, Generation 6 `COMPLETE`, 24,535 VERIFIED / 0 DIRTY / 0 UNKNOWN, physical `.eod` count 24,536, recovery sessions 0, SQLite integrity `ok`. One exact physical/index row remains pending evidence-first reconciliation.
- Current next gates: documentation apply/validation, final portable build/hash, next genuine trading-day V1.7D log, then separate read-only one-row gap audit.
- Evidence: `docs/changes/2026-08-22_2114_IST_STORAGE_QUOTE_EDITOR_WARNING_CLEANUP_CLOSEOUT.md`.

## Latest Verified State (August 18, 2026 - Corporate Actions V1.12.1 Final Identity Audit Closeout)

- Corporate Actions V1.12.1 final read-only identity classification is **ACCEPTED / CLOSED**.
- V1.11 controlled approval approved exactly 283 authorized READY rows with 0 unexpected extra approvals and left exactly 111 identity blockers.
- V1.12 Pass 1 reconciled the exact 111 residuals with stable fingerprints: residual ID `8a42afa94287f2c80531020d6df80030229f647f86d3419a55ab94d8d5272bef` and residual business `2e53917f05386379e4fb034f8a2e7a814bd4bca33ec6fa84e44668bb52482b72`.
- External-evidence research covered all 111 requests. Final evidence grades were B=15, C=54, D=42.
- V1.12.1 deterministic final states: 10 `SAFE_OFFICIAL_EXTERNAL_EVIDENCE`, 4 `SAFE_RENAME_OR_RESTRUCTURE`, 49 `MANUAL_COMPANY_IDENTITY_REVIEW`, 5 `CONFLICT_UNRESOLVED`, 42 `NO_EVIDENCE_FOUND`, 1 `DATA_INTEGRITY_ANOMALY`.
- Result: **14 SAFE future-write candidates / 97 manual or unresolved / 111 total**.
- Classification fingerprint: `f840120706f2450e8235beed6db63edf1a1b4b06f984d64f2eb90900a1149543`.
- SAFE-candidate fingerprint: `4211d104b21bb44837e15ef57a851380b615d557782fb8b7ebae11091550f58e`.
- Refreshed Pass-1 authority: `tmp/corporate-action-v1-12-pass1_20260818_004434/reports`.
- Accepted V1.12.1 final reports: `tmp/corporate-action-v1-12-1-final_20260818_011520_117/reports`.
- Windows long-path failure was isolated to Python `Path.resolve()` dereferencing a short mapped-drive alias back to the long physical evidence path. V1.12.1 formalized a temporary short evidence drive and added two Windows-path regression tests; the complete package suite passed 22/22 tests.
- Final report verification proved 111/111 input/output, 14 SAFE candidates, live DB/WAL/SHM unchanged, and zero database, identity/history, Corporate Action approval, or Quick Resolve writes.
- V1.13 design has started but implementation has **not** begun. The approved boundary is strict two-stage repair: write identity/history evidence only for the exact 14 SAFE candidates, then stop and perform an independent read-only recheck/post-audit before any Corporate Action status change.
- Git maintenance remains deferred.
- Documentation basis: `Eod Charting Platform Source Code 2026-08-18_015700_IST`, uploaded ZIP SHA-256 `E761D587BFE0134EAB6F7940332B97092823AE88AC85845E756B3D5C1036574D`.

## Latest Verified State (August 17, 2026 - Symbol & Timeframe Viewport and Zoom Preservation)

- **Symbol Navigation Viewport & Zoom Preservation** (`chartInstrumentCompareController.ts`, `chartInstrumentHydrationService.ts`, `ChartEngine.ts`):
  - **Zoom Level (Span) & Right-Edge Distance Preserved**: Switching between symbols (via watchlists, sidebar, search palette, or hotkeys) preserves the active horizontal zoom span (`endIndex - startIndex`) and right-edge distance offset (`(totalBars + futureBars) - endIndex`) instead of resetting to the arbitrary 120-bar default.
  - **Dynamic Price Scale Auto-Fit on Symbol Switch**: Clears stale `paneScaleOverrides.price` when switching symbols so the new instrument autoscales cleanly to its own price range while retaining indicator pane configurations.
  - **ChartEngine Initializer Guard**: Updated `loadBars` to preserve active viewport span whenever $\ge 5$ bars.
- **Timeframe & Chart Type Viewport Anchoring** (`chartDataUtils.ts`, `chartTabStateMutationService.ts`):
  - **Right-Aligned Edge Retention**: If the user was viewing the newest bar, timeframe switches (Daily $\leftrightarrow$ Weekly $\leftrightarrow$ Monthly $\leftrightarrow$ Renko) remain right-aligned with the target timeframe's newest bar.
  - **Historical Period Anchor**: If the user was scrolled back into historical data, `remapViewportAcrossTimeframe` anchors to the center bar timestamp via `findDisplayBarIndexForTimestamp`, keeping the visible date range steady without snapping back to today's date.
- **Verification**: 111 test files passed (637/637 unit tests), `npm run typecheck:renderer` passed with 0 errors, pre-edit backup created at `backups/pre_opencode_changes_20260817_134132_chart-view-preserve-symbol-timeframe`.

## Latest Verified State (August 17, 2026 - Warning Cleanup Closed, Clean Portable Baseline, Corporate Actions Resumption)

- Warning cleanup W1.1 through W1.4-B1 is **CLOSED**.
- Final production chart chunks: `feature-chart-canvas` ~204.45 kB, `feature-chart-core` ~297.28 kB, `feature-chart-analysis` ~164.40 kB, `vendor-technicalindicators` ~19.81 kB; `feature-official-watchlists` remains ~55.08 kB with W1.3 source-selective lazy payloads.
- No application JavaScript chunk exceeds 500 kB. Circular-chunk and Vite CJS Node API deprecation warnings are absent.
- `npm run tauri:portable:win` passed. Portable executable SHA-256: `07889C39B81D0F61D32A41C29FD9C7CBF210E6DE61BFB469D61F71D90DAB6281`. User manual smoke test passed.
- Corporate Actions remains **ACTIVE / UNFINISHED**. V1.9.2 handled 283 authorized `BOOTSTRAP_SAFE` imports at the identity-evidence layer, deduplicating to 281 exact-date historical identity tuples, without Corporate Action approval. V1.9.2.3 was reporting/source-only.
- Historical residual evidence requiring fresh read-only re-audit: 9 `COMPANY_IDENTITY_MISMATCH`, 3 `CONFLICTING_ISIN_HISTORY`, 49 earlier `NO_CANDIDATE`, plus the current post-bootstrap PENDING / READY / approved population. These historical counts are not current truth.
- Immediate next step: fresh read-only Corporate Actions current-state audit before any new write phase.
- Gann fidelity/acceptance remains future drawing work; the completed Fibonacci baseline remains protected.
- Git status/normalization is deferred to a separate governed maintenance phase. Source snapshots and SHA-256 guards remain the current safety mechanism.
- Fresh documentation basis snapshot: `Eod Charting Platform Source Code 2026-08-17_014948_IST`, uploaded ZIP SHA-256 `443bfb62aad39f1ccb25055425a86e8752a7487bf771a904cbabfb91bc650653`.

## Latest Verified State (August 16, 2026 - BSE Official Watchlist Expansion, BSE Stocks by Sector, and Sector Universe Refresh Script)

- **BSE Stocks by Sector Universe** (`bseSectorUniverseWatchlistData.generated.ts`): Added dedicated 6th official source tab with 13 official BSE macro-economic sector groups covering 1,527 BSE-listed equity stocks (Commodities, Consumer Discretionary, Diversified, Energy, FMCG, Financial Services, Healthcare, Industrials, IT, Other / Diversified, Services, Telecommunication, Utilities).
- **Automated Sector Universe Refresh Script** (`scripts/refresh-sector-universe.mjs`): Standalone on-demand CLI script to refresh both NSE and BSE industry sector snapshots with official exchange feeds (`--source nse|bse|all`).
- **BSE Sectors Catalog Expansion** (`officialWatchlistData.generated.ts`): Expanded from 5 to 27 official sector and thematic groups (Auto, Bankex, Capital Goods, Consumer Durables, Consumer Discretionary, Energy, FMCG, Financial Services, Healthcare, Industrials, IT, Metal, Oil & Gas, Power, Realty, TECK, Telecom, Utilities, Services, Commodities, PSU, CPSE, Infrastructure, Manufacturing, Defence, PSU Bank, Private Banks).
- **BSE Indices Catalog Expansion** (`officialWatchlistData.generated.ts`): Expanded from 2 to 15 official broad and market cap groups (SENSEX, SENSEX 50, SENSEX Next 50, BSE 100, BSE 200, BSE 500, BSE MidCap, BSE SmallCap, BSE LargeMidCap, BSE MidSmallCap, BSE ALLCAP, BSE 250 MicroCap, BSE Bharat 22, BSE IPO, BSE SME IPO).
- **BSE 500 Unhidden** (`officialWatchlistProviders.ts`): Fully populated with 501 official constituents and removed from `PARTIAL_GROUP_IDS`.
- **Power vs. Energy Separation**: Separated `BSE Power` (Code: 69) and `BSE Energy` (Code: 90) URLs and identifiers.
- **Official CSV Feed Integration** (`main.rs`, `officialWatchlistProviders.ts`): Whitelisted `www.bseindices.com` in backend fetch handler and added auto-detecting CSV constituent parser supporting BSE official columns (`Constituents`, `Symbol` / BSE security code, `Macro-Economic Sector`).
- **Verification**: 70 tests passed across `src/features/watchlists/`, renderer typecheck passed (`npm run typecheck:renderer`), pre-backup snapshot verified in `backups/pre_opencode_changes_20260816_163511_bse-stocks-by-sector-universe`.

## Latest Verified State (August 17, 2026 - Palette Keyboard Scrolling, Silent Timeframe Hotkeys, and Axis Auto-Scale Alignment)

- **Chart Double-Click Auto-Scale Alignment** (`ChartEngine.ts`):
  - **Price / Indicator Scale Auto-Fit**: Double-clicking the right Y-axis price scale or any indicator pane's Y-axis immediately resets manual vertical stretch/compression overrides (`paneScaleOverrides[paneId] = null`), returning that pane to dynamic Auto-Fit.
  - **Protected Chart Canvas**: Double-clicking inside the main chart plot area (candles/canvas) no longer forcibly resets the horizontal viewport, preventing disruption to active zoom/pan navigation.
  - **Time Axis Reset**: Double-clicking the bottom Date/Time axis resets horizontal viewport to default.
- **Command Palette Smooth Keyboard Scrolling** (`CommandPalette.tsx`): Attached dynamic element refs and automated `scrollIntoView({ block: 'nearest' })` on <kbd>↑</kbd> and <kbd>↓</kbd> keyboard navigation, ensuring selection highlight and viewport remain perfectly in sync.
- **Silent Timeframe Hotkeys** (`RootApp.tsx`): Streamlined single-key timeframe shortcuts (<kbd>D</kbd>, <kbd>W</kbd>, <kbd>M</kbd>, <kbd>Q</kbd>, <kbd>Y</kbd>) to execute instantly and silently without intrusive popup toast notifications, relying on top toolbar active button highlights.
- **Sidebar Watchlists Tab Space & Submenu Refinements** (`Sidebar.tsx`):
  - **Reclaimed Vertical Sidebar Space**: Removed redundant bulky `Source linked` and `Last synced` banner boxes from the sidebar; embedded sync status and timestamp directly into the `Update` button's tooltip.
  - **Seamless "Add to Watchlist" Submenu**: Eliminated hover-gap mouseleave race conditions via a seamless hitbox bridge and added the "Add to Watchlist ▾" submenu to both the Symbols panel and the Watchlists panel context menus.
  - **Inline Quick-Add Input & Sorting**: Maintained inline search with debounced dropdown and 1-click A-Z/Z-A sorting.
- **Sidebar Indicators Tab** (`Sidebar.tsx`): Pinned Favorites (★) group with persistent star toggles and 1-click Direct Add `+` hover button.
- **Verification**: 111 test files passed, TypeScript check passed (`npm run typecheck:renderer`), `check-doc-references.ps1` passed, pre-backup snapshot verified in `backups/pre_opencode_changes_20260817_121951_chart-axis-doubleclick-autoscale-fix`.

## Latest Verified State (August 15, 2026 - Floating Window Upgrades, Left Sidebar Rail Minimized Dock, and Candlestick Toggle)

- **Left Sidebar Navigation Rail Minimized Dock**: Minimized windows now dock cleanly at the bottom of the left rail (`Sidebar.tsx`), below `SYM`, `IND`, `WL`, `MOV`. Includes dedicated domain icon badges (`🔍`, `📥`, `⭐`, `📊`, `🔔`, `📝`, `🏢`, `⚙`), active green status dots, 1-click restore/focus, and right-click quick close. Frees up 100% of the chart canvas, date axis, volume histogram, and sheet tabs.
- **Fail-Safe Fallback Dock**: Updated `WindowTray.tsx` to render a discreet bottom-left floating dock only when the sidebar is completely hidden via the View menu.
- **Favorite Tools Floating Toolbar Mobility**: Updated `FavoriteToolsToolbar.tsx` to `position: 'fixed'` and mounted at application root (`RootApp.tsx`), providing unrestricted drag mobility across all app regions, sidebars, headers, and tabs without canvas clipping.
- **Indicators & Studies Floating Window**: Upgraded `IndicatorPickerDialog.tsx` to `FloatingWindow.tsx` (`960 × 620`); removed modal backdrop so clicking/panning on the chart canvas does not close the window.
- **Manage Watchlists Floating Window**: Converted `WatchlistManagerDialog.tsx` to `FloatingWindow.tsx` (`780 × 580`), removing blocking modal backdrops to enable side-by-side watchlist editing while monitoring charts.
- **Candlestick Pattern 1-Click Toggle**: Consolidated duplicate candlestick button from `ChartToolDock.tsx` into top toolbar `Toolbar.tsx` "Candles" button (1st click plots patterns, 2nd click removes, active blue accent styling).
- **Verification**: 103 test files passed (578/578 unit tests), TypeScript check passed (`npm run typecheck:renderer`), `check-doc-references.ps1` passed, and pre-backup snapshot verified in `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260815_143846_sidebar-minimized-windows-dock`.

## Latest Verified State (August 15, 2026 - Universal Command Palette Overlay & Keyboard Dismissal Fix)

- **Crystal-Clear Command Palette Backdrop**: Replaced the blocking dark blurred overlay in `src/components/CommandPalette.tsx` with a clean `rgba(0, 0, 0, 0.25)` zero-blur backdrop, ensuring candlesticks, indicators, and charts remain 100% visible and sharp behind the launcher.
- **Dedicated Header & Close Button (`✕`)**: Added a top titlebar with `🔍 Command Palette`, descriptive subtitle, keyboard `[ESC]` badge, and a prominent **Close (`✕`)** button.
- **Input `Escape` Trapping**: Directly handled `Escape` in `handleInputKeyDown` to dismiss the palette instantly from the search box.
- **Comprehensive Command Execution**: Added direct shortcuts for Scanner Window, Alert Manager, Quote Editor, Corporate Actions, Merge Symbols, Watchlist Manager, Layout Manager, Bhavcopy, Settings, Binary Parity, Shortcuts, and FAQ.
- **Crash Isolation**: Wrapped `<CommandPalette />` in `<ErrorBoundary name="CommandPalette" fallback={null}>` in `src/RootApp.tsx`.
- **Verification**: 103 test files passed (578/578 unit tests), TypeScript check passed (`npm run typecheck:renderer`), `check-doc-references.ps1` passed, and pre-backup snapshot verified in `E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-15_131258_IST`.

## Latest Verified State (August 14, 2026 - Indicator Subcategories, Hybrid Indicator Dialog, and Draggable Floating Windows)

- **Sidebar Indicator Hierarchy**: All 118 catalog indicators organized into 'Price' and 'Pane' placement groups with 9 collapsible/expandable subcategories (Moving Averages, Bands & Channels, Trend Following, Smart Money, Price Transforms, Momentum, Volatility & Risk, Trend Strength, Volume Flow) with count badges, universal search filtering, and persistent collapse states (`localStorage`).
- **Hybrid 3-Column Indicator Window**: Upgraded `src/components/IndicatorPickerDialog.tsx` with universal search + clear button, master segmented tabs (`All`, `Price`, `Pane`, `★ Favorites`), 9-category left navigation rail, fast 1-click `[+]` addition directly to chart, interactive favorite `★` pinning persistence (`eod-chart.indicator-favorites.v1`), and right parameter preview card.
- **Draggable Floating Windows Architecture**: Created `src/components/common/useDraggableFloatingWindow.ts` and `FloatingDialogShell.tsx` for smooth dragging with pointer tracking, boundary clamping, and session position memory (`eod-chart.floating-pos.*`).
- **Zero-Blur Chart Visibility**: Replaced blocking dark blur overlays across `IndicatorPickerDialog.tsx`, `IndicatorSettingsDialog.tsx`, and `ChartDrawingPropertiesDialog.tsx` with crystal-clear non-blur backgrounds (`rgba(0,0,0,0.15)`), keeping candlesticks, indicators, and drawings 100% visible and interactive in the background while dialogs are open.
- **Verification**: 101 test files passed (570/570 unit tests), TypeScript check passed (`npm run typecheck:renderer`), `check-doc-references.ps1` passed, and verified pre-backup snapshot created in `E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-14_170628_IST`.

## Latest Verified State (August 13, 2026 - Fibonacci Family Complete and Gann Handoff)

- Canonical documentation is reconciled against fresh Fibonacci-complete snapshot `Eod Charting Platform Source Code 2026-08-13_205303_IST`; uploaded basis ZIP SHA-256: `22417772772572badbf8abf088bc221eff8d4faee0c14842637c35d44fd1f23a`. The basis contains 487 source-policy files before this reconciliation report.
- The active drawing model contains 49 persisted drawing kinds. The `Fibonacci / Gann` dock group contains eleven Fibonacci kinds plus `gann` and `gannBox`.
- The Fibonacci family is **COMPLETE / CLOSED** after automated and manual acceptance of Fibonacci Retracement, Fib Projection (Legacy), Trend-Based Fib Extension, Fibonacci Channel, Fib Time Zone, Trend-Based Fib Time, Fib Circles, Fib Speed Resistance Arcs, Fib Wedge, Fib Spiral, and persisted `fibFan` with Fib Speed Resistance Fan geometry.
- Fibonacci Retracement retains the accepted corrected orientation/plotting and full level authority. Completed F1 tools are not to be casually redesigned during later drawing-family work.
- Fib Wedge's accepted geometry is data-space-first: stored bar/price anchors -> canonical wedge curves in data coordinates -> project sampled curve points through the current viewport.
- Fib Spiral's accepted final state is the restored F1D.1 implementation. Counterclockwise, color/style, persisted same-timeframe perpendicular basis, and same-timeframe zoom stability are retained. The F1D.2 absolute-time `basisPerpTime` / `timeDeltaMs` experiment caused coarse-timeframe distortion, was rejected, and was rolled back. Final rollback validation passed 13/13 files and 72/72 tests plus renderer typecheck/build; user manual acceptance passed.
- F1E reinterprets persisted kind `fibFan` as the accepted Fib Speed Resistance Fan geometry while preserving the stable workspace kind. Final F1E.1 removes the arbitrary far-data endpoint and constructs each visible ray from the exact projected apex and Fibonacci price/time target, then extends that projected ray only for pane clipping. `Renderer.ts` and `ChartEngine.ts` consume the shared `DrawingF1EGeometry.ts` path for render/hit-test parity.
- Final F1E.1 validation passed 15/15 focused test files, 81/81 tests, renderer TypeScript typecheck, and renderer production build. The user's portable/manual zoom-in/zoom-out test then passed, closing the final Fibonacci blocker.
- The exact next drawing-family gate is **Gann fidelity/acceptance**. Audit current `gann` (Gann Fan) and `gannBox` first; preserve persisted kinds, workspace compatibility, shared Properties architecture, and the closed Fibonacci baseline.
- This documentation reconciliation changes no Rust/TypeScript/runtime source. No portable rebuild is required solely for the documentation pass. After applying and validating it, create a fresh canonical source snapshot before starting Gann.
- Evidence: current source files `src/engine/DrawingF1CGeometry.ts`, `src/engine/DrawingF1DGeometry.ts`, `src/engine/DrawingF1EGeometry.ts`, final F1E.1 validation transcript/manual PASS, and `docs/changes/2026-08-13_2105_IST_FIBONACCI_FINAL_DOCUMENTATION_RECONCILIATION_V1.md`.

## Latest Verified State (August 13, 2026 - Bhavcopy Phase 2D, Prefilter, Calendar, and Final Runtime Acceptance)

- Canonical documentation was reconciled against fresh source snapshot `Eod Charting Platform Source Code 2026-08-13_165308_IST`; uploaded basis ZIP SHA-256: `a193a6630de691d148eb7abfe80485981b36a6339c7022d9f48a1ef1e83750dc`.
- Runtime Bhavcopy source identities in that snapshot: `src-tauri-shell/src/bhavcopy.rs` SHA-256 `b3e5a932804133744eb9b2b3f669c4c777e0c5fdf9cbf4f82efb0c1ee2386585`; `src-tauri-shell/src/bhavcopy_recovery.rs` SHA-256 `180b545f4b97b7afdeea341cc860c979eb222df45e37169d6410a97b73807bd1`.
- The older August 10 conclusion that Phase 2D was unnecessary is superseded by production evidence: an 8,570-file foreground deferred checkpoint on August 12 took `1,057,829 ms` (about 17m38s).
- Interrupted-checkpoint recovery now treats only `APPLIED` and `CHECKPOINTING` as resumable fast-checkpoint states. Exact binary length/header/scale/tail verification remains mandatory; verification failure retains the conservative rollback-and-durable-replay fallback.
- Phase 2D background checkpointing is implemented with a bounded 4-worker physical checkpoint after successful buffered APPEND_NEWEST imports. Production session `20260813T110934.752306Z-p18044-0` checkpointed 8,406 files in `125,405 ms` (about 2m05s), roughly 8.44x faster / 88.1% lower elapsed than the prior 8,570-file sequential checkpoint; the workload sizes are close but not identical.
- The corresponding August 13 import completed 3 success / 17 skipped / 0 failed with 8,453 rows: BSE 4,972; BSE Index 77; NSE 3,404. Binary writes covered 8,449 symbols with 43 new files, 8,406 APPEND_NEWEST files, zero binary errors, zero foreground `sync_data()` calls, 8,406 deferred syncs, and 57,456 ms binary-write wall time.
- A subsequent Update at 16:45 completed in about two seconds with zero jobs and no long retained-session recovery/checkpoint. NSE/BSE/BSE Index were already current through 2026-08-13; NSE Index remained through 2026-08-12 because the 2026-08-13 source was unavailable in the preceding Date Range run.
- Automatic Update now defers current-day probing until 18:00 local time. Runtime before-cutoff acceptance produced zero current-day jobs when the selected sources were already current through the previous day; manual Date Range remains unaffected.
- Calendar Safety V1.1 is exchange-aware and uses special-session override -> weekend -> known holiday -> normal probe precedence. Focused special-session/holiday tests pass; runtime Date Range logs preserved explicit weekend skips and reported current-day source misses as unavailable/missing rather than inventing a holiday.
- Prefilter Range Scan V1 retained metadata-vs-binary coverage reconciliation and the 80% threshold while replacing repeated per-date random binary searches with bounded range reads and at most four read workers. For the same eight target dates, the trigger run was NSE `523,371 ms` / BSE `171,131 ms`; first optimized runtime was NSE `147,048 ms` / BSE `77,687 ms`; a later same-range run was NSE `18,669 ms` / BSE `2,593 ms` plus sub-second index reconciliation. All runs preserved the same eight already-imported dates. File-system caching affects absolute timings, so no fixed 23-second cold-run guarantee is claimed.
- BSE/BSE Index candidate terminal classification now separates soft unavailable/mismatch outcomes from genuine hard errors so HTML-instead-of-CSV cannot mask a real hard error. Final validation: focused regression 1/1 PASS, Bhavcopy filter 50/50 PASS, `cargo check` PASS. The rebuilt current-day run imported BSE Index successfully (77 rows), so the exact all-soft terminal branch was not re-triggered after the fix.
- Prefilter V2 is deferred. The current V1 is accepted; no persistent coverage-index subsystem should be added unless repeated real cold-run evidence shows an operational need.
- Bhavcopy is again frozen for the current scope. Historical/current provider fixes, recovery/durability, same-day cutoff, calendar safety, prefilter reconciliation, and candidate classification are accepted at the boundaries above.
- Evidence: `docs/changes/2026-08-12_2102_IST_BHAVCOPY_INTERRUPTED_CHECKPOINT_RESUME_FIX_V1.md`, `docs/changes/2026-08-12_2353_IST_BHAVCOPY_PHASE2D_BACKGROUND_CHECKPOINT_V1.md`, `docs/changes/2026-08-13_0030_IST_BHAVCOPY_UPDATE_SAME_DAY_CUTOFF_V1.md`, `docs/changes/2026-08-13_0232_IST_BHAVCOPY_CALENDAR_SAFETY_V1_1.md`, `docs/changes/2026-08-13_1305_IST_BHAVCOPY_PREFILTER_RANGE_SCAN_V1.md`, and `docs/changes/2026-08-13_1555_IST_BHAVCOPY_BSE_INDEX_CANDIDATE_CLASSIFICATION_V1_1.md`.

## Latest Verified State (August 10, 2026 - Final Pre-Handoff Documentation Audit V2)

- Rechecked all 58 Markdown files and 14 text evidence files present in the post-reconciliation source snapshot, distinguishing maintained current authority from append-only/historical evidence.
- Corrected stale current guidance that still suggested a future NSE equity-series ingest whitelist/fresh-database path. Current policy is broad supported NSE equity/trade-for-trade/SME ingestion with series metadata retained; normal series filtering belongs in Symbols/sidebar browsing, while existing government-security exclusions remain a separate rule.
- Corrected the current feature matrix so the known intermittent SMA Daily-state/value-scale defect is `Partial`, not `Complete`, until the focused indicator audit closes it.
- Aligned `scripts/check-doc-references.ps1` to the eight maintained root documents; append-only `PROJECT_STATE_EOD_CHARTING_PLATFORM.md` remains presence-checked but is intentionally excluded from current-reference resolution because it retains historical links.
- Corrected the documentation matrix's obsolete August 4–5 / missing-`.cargo` note; `.cargo/config.toml` is present in the inspected source.
- Added an explicit caveat to the older DNN portable hash entry: it is not independently evidenced by the retained DNN change artifact/current source snapshot and must not be used as current build identity without re-verification.
- Evidence: `docs/changes/2026-08-10_1235_IST_FINAL_DOCUMENTATION_AUDIT_V2.md`.

## Latest Verified State (August 10, 2026 - Bhavcopy Final Acceptance and Documentation Reconciliation)

- Bhavcopy is accepted and frozen for the current scope after the Phase 2B.1 recovery hardening, Phase 2C APPEND_NEWEST buffering, BSE historical provider work, BSE Index literal-date fix, and compact progress renderer correction.
- The post-Bhavcopy implementation snapshot inspected for this reconciliation is `Eod Charting Platform Source Code 2026-08-10_121107_IST`; the pre-reconciliation ZIP SHA-256 is `75afdd6c37312f78a8c87295eaed23486a2386699ff1aff8ceb4187e0720ab69`.
- Phase 2C append-heavy Windows acceptance imported 43,081 rows with 9,312 `APPEND_NEWEST` files, 0 foreground `sync_data()` calls for those appends, 9,312 deferred syncs, and 23.325 s binary-write wall time.
- The earlier comparable 4-worker reference was approximately 305.8 s binary-write wall time, so the accepted append-heavy phase improved by about 92%.
- The following Bhavcopy operation checkpointed all 9,312 retained APPEND_NEWEST files in about four seconds. Phase 2D background checkpointing is therefore not required at present.
- Historical BSE October-2023 runtime test completed 40/40 BSE Equity/BSE Index jobs with 84,212 imported rows and zero failed jobs.
- BSE Index historical retrieval was then corrected by preserving literal `DD/MM/YYYY` values in the `IndexArchDailyAllPar` URL. Focused regression test: 1/1 PASS; Bhavcopy filter after the fix: 40/40 PASS; `cargo check`: PASS.
- Runtime acceptance for the four previously missing BSE Index dates succeeded: 2023-09-08, 2023-09-14, 2023-09-20, and 2023-09-25 each imported 57 rows; aggregate result 4 success, 0 failed, 228 rows.
- A later 2026-07-17 through 2026-07-31 missing-date BSE/BSE Index backfill completed 12/12 jobs with 53,813 rows and zero failures. Its slower binary phase was explained by 5,439 `REWRITE_TAIL` plus 300 `INSERT_HISTORICAL` files retaining immediate durability.
- Large BSE binary prefilter scans remain a non-blocking optimization opportunity; one accepted run scanned 16,687 files in about 39.1 seconds.
- Documentation was reconciled across the eight canonical root documents and the active August 9–10 change reports. No runtime/source behavior is changed by this documentation-only reconciliation.
- Evidence: `docs/changes/2026-08-10_1212_IST_BHAVCOPY_FINAL_ACCEPTANCE_AND_DOCUMENTATION_RECONCILIATION.md`.

## Latest Verified State (August 9–10, 2026 - Manual Import Recovery and Identity Boundary)

- Binary Manual Import recovery sessions are durable, database-bound, and retained as newest-first history across restart.
- Session-specific Undo removes only rows proven inserted by that session, restores overwrite before-images, preserves conflicting later mutations, and removes only provenance-proven session-created placeholder instruments.
- Quotation Editor date/range deletion is quote-only: deleting the final quotation does not remove instrument identity. The earlier orphan-symbol-prune proposal remains explicitly superseded.
- BSE identity fidelity is now an explicit operating requirement: do not synthesize trading symbols from company/security names. Legacy BSE bhavcopy may preserve the official numeric `SC_CODE`; any mapping to alpha trading symbols requires a separate audited identity-resolution step.

## Latest Implemented State (August 5, 2026 - DNN Research Dataset Export V1)

- Advanced the bundled DNN adapter to version `0.3.0` while keeping it disabled by default and independent of chart runtime behavior.
- Added a read-only Tauri dataset-export command backed by a dedicated `query_only` SQLite connection and the existing hybrid/binary EOD loader, identity-resolution logic, and corporate-action adjustment engine.
- The default full export covers NSE and BSE, the active database's complete date range, inactive instruments, capital-action-adjusted OHLCV, and excludes dividend and rights adjustments unless a future caller explicitly requests them.
- Added atomic staging/finalization and a versioned `dnn-research-dataset-v1` manifest. Successful exports create `dataset-manifest.json`, `instruments.csv`, `daily-bars.csv`, `corporate-actions.csv`, and `failures.csv` in a unique user-selected external directory.
- Per-instrument identity/data failures are explicit and counted. File-write/finalization errors abort publication and remove staging output. Empty eligible universes and invalid calendar/date ranges fail closed.
- Added typed renderer/backend contracts, progress events, a generic output-folder picker, a Settings action, service tests, JSON Schema, and external producer documentation.
- No database schema mutation, Python/ML dependency, model training, chart overlay, scanner signal, alert, broker route, or order execution was added.
- Artifact-environment validation and Windows validation status are recorded in `docs/changes/2026-08-05_2230_IST_DNN_RESEARCH_DATASET_EXPORT_V1.md`; Rust/Tauri and portable-package acceptance remain dependent on actual PowerShell output.

## Latest Implemented State (August 5, 2026 - Precomputed DNN Prediction Adapter V1)

- Promoted the DNN forecast entry from a planned foundation to a bundled, disabled-by-default precomputed adapter.
- Added a strict `dnn-trend-predictions-v1` JSON contract with model/feature metadata, exact daily as-of dates, dataset revisions, supported 5/10/20-session horizons, probability-sum validation, unknown-field and duplicate-key rejection, causal no-future fallback, a machine-readable JSON Schema, and bounded record counts.
- Added `PrecomputedDnnTrendInferenceProvider` behind the existing replaceable provider contract. Exact feature-version and data-revision parity are enforced when the provider is used through `DnnTrendPredictionService`.
- Added generic persisted `pluginConfigurations` to the app-profile settings file. The DNN adapter stores its prediction-source path without adding model logic to the chart engine.
- Added bounded generic plugin-data file selection and UTF-8 reading in `src-tauri-shell/src/plugin_data.rs`; the DNN route accepts JSON only and limits files to 16 MiB.
- Settings validates the source before enabling the plugin, forces it disabled when the source is cleared or invalid, displays source/model metadata, and provides a read-only exact prediction viewer with an optional Use Active Chart shortcut.
- Added a non-production sample source and source-contract documentation under `resources/dnn-trend/`.
- Windows validation completed: focused DNN/plugin tests `24/24`, full repository tests `232/232`, renderer typecheck, renderer build, Rust/Tauri check, integrated build, portable build, SHA-256 verification, and manual Settings/plugin smoke checks passed.
- Historical portable executable SHA-256 recorded in this state: `367743F3776B8056FFD999EA039CE7CF8A1E000AEF48BE4A9E37D0688FADF2DF`. Final August 10 documentation audit: this hash is not independently evidenced by the retained DNN change artifact/current source snapshot, so do not use it as current portable build identity without re-verifying the actual executable/build output.
- No trained model, ONNX/Python runtime, automatic chart inference, chart overlay, scanner integration, database schema change, broker route, or order execution was added.

## Latest Verified State (August 5, 2026 - DNN Trend Prediction Plugin Foundation)

- Extended the existing bundled renderer-side plugin registry rather than creating a second plugin framework.
- Added an explicit `defaultEnabled` contract: the Core EOD Scanner remains enabled by default, while the DNN Trend Prediction foundation is planned and disabled by default.
- Added a headless DNN trend foundation under `src/plugins/forecast/dnnTrend/` with versioned causal features, multi-horizon probability contracts, replaceable inference provider, deterministic non-production mock inference, revision-aware memory caching, cancellation, disposal, and fail-closed validation.
- Settings lists the planned foundation but disables its checkbox until the plugin status becomes `bundled`; no chart overlay, panel, backend command, trained model, external runtime, or order execution was added.
- Focused isolated TypeScript compile: PASS.
- Deterministic compiled runtime harness covering feature generation, mock inference, probability sums, cache reuse, cancellation, and disposal: PASS.
- Focused test-file TypeScript compile with a Vitest declaration stub: PASS.
- Full repository `npm ci`, Vitest, renderer typecheck, Rust check, frontend build, Tauri build, and portable packaging were not completed in this environment. `npm ci --ignore-scripts` failed because the internal npm mirror returned HTTP 404 for `zustand-4.5.7.tgz`; Windows PowerShell validation remains required.
- Evidence: `docs/changes/2026-08-05_1718_IST_DNN_TREND_PLUGIN_FOUNDATION.md`.

## Latest Verified State (August 5, 2026 - Documentation Reconciliation and Source Snapshot Audit)

- Reconciled the eight canonical root documents against the supplied August 4–5 Market Movers, manual-background-scan, Tauri-version, portable-build, root-target, and quarantine evidence.
- `AGENTS.md` was preserved byte-for-byte.
- Updated `README.md`, `HANDOFF.md`, `REQUIREMENTS.md`, `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`, `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md`, and this project-state history.
- Added the supplied top-level change evidence under `docs/changes/` and added a timestamped documentation reconciliation report.
- Confirmed from source that Market Movers contains manual Scan/Update/Cancel state, request-scoped progress/cancellation, a dedicated Rust read-only scan connection, and worker-side snapshot calculation.
- **Critical source-backup finding:** `.cargo/config.toml` is identified by the August 5 target-alignment report but is absent from the supplied source ZIP. The snapshot therefore does not independently reproduce the root `target/` topology until that verified live file is added.
- Documentation/archive integrity checks passed for the produced package. No application test, typecheck, Rust check, frontend build, Tauri build, or portable package was rerun during this documentation-only pass.

## Latest Verified State (August 5, 2026 - Root Cargo Target and Legacy Target Quarantine)

- Live-project Cargo/Tauri compiler output was redirected from `src-tauri-shell\target` to repository-root `target` through `.cargo\config.toml`.
- `scripts\prepare-tauri-portable.ps1` was aligned to the canonical root release executable.
- The obsolete `src-tauri-shell\target` cache was moved to `E:\TA Build Cache Quarantine\2026-08-05_1323_IST_LEGACY_SRC_TAURI_SHELL_TARGET` after root release/portable verification.
- Recorded canonical release executable: `target\release\eod-charting-platform-shell.exe`.
- Recorded portable executable: `release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`.
- Recorded final matching SHA-256: `0DB839A05355D67893F0F37436E4436AA368744E3728D74955E202EAF11456FF`.
- Evidence: `docs/changes/2026-08-05_1233_IST_ROOT_CARGO_TARGET_ALIGNMENT.md` and `docs/changes/2026-08-05_1323_IST_LEGACY_SRC_TAURI_TARGET_QUARANTINE.md`.

## Latest Verified State (August 5, 2026 - Portable Build Pipeline Hardening)

- Portable staging was changed to use one canonical release executable and verify the staged executable with SHA-256.
- Hash calculation uses `System.Security.Cryptography.SHA256`, avoiding dependence on unavailable `Get-FileHash` behaviour in the npm-launched Windows PowerShell process.
- Packaging fails closed on a source/staged executable mismatch.
- The report records parser validation, packaging-only validation, and full `npm run tauri:portable:win` as passed for that implementation stage.
- A later same-day change moved the canonical executable source from the shell-local target to root `target`; the root-target/quarantine state above supersedes the earlier path while preserving the hash-verification contract.
- Evidence: `docs/changes/2026-08-05_0205_IST_PORTABLE_BUILD_PIPELINE_FIX.md`.

## Latest Verified State (August 4–5, 2026 - Manual Background Market Scan V1)

- Opening Market Movers no longer starts a full-universe scan.
- Added explicit Scan, Update, and Cancel actions with dirty-state handling and previous-result retention during update.
- Added a dedicated read-only Rust SQLite scan connection, request-scoped progress events, request-ID cancellation, and duplicate-request coalescing.
- Added `marketMoversSnapshot.worker.ts` and `marketMoversSnapshotWorkerClient.ts` so frontend ranking/filtering runs off the renderer UI thread.
- Final corrected validation passed: 8 Market Movers test files / 60 tests, scanner regression tests, TypeScript semantic typecheck, renderer validation profile, focused Rust Market Movers tests, complete Rust cargo check, and integrated production build.
- Portable Windows packaging was not part of the final manual-background-scan validation run.
- The earlier `2315` patch preflight failed and explicitly changed no source; it is superseded by the corrected `2357` implementation.
- Evidence: `docs/changes/2026-08-04_2357_IST_MANUAL_BACKGROUND_MARKET_SCAN_V1.md` and companion validation/manifest/patch files.

## Latest Verified State (August 4, 2026 - Market Movers Hybrid Backend and UI Correction)

- Added Rust `get_daily_market_snapshot` batch retrieval with bounded history, adjustment/event data, database identity/revision, and failure accounting.
- Reused `calculateDailyMarketMetrics()` as the daily change/relative-volume calculation source.
- Added common modal market date selection, stale-symbol exclusion, corporate-action warning classification, deterministic rankings, shared cache/request state, and Sidebar/ScannerWindow snapshot sharing.
- Added TradingView-style MOV sidebar and expanded dual-column Gainers/Losers view with chart navigation.
- Follow-up UI correction removed horizontal scrolling in the intended layouts, improved accounting/header presentation, and hid unrelated scanner/watchlist status while Market Movers is active.
- Final UI-correction validation passed focused tests, TypeScript typecheck, renderer validation, and integrated production build.
- BSE group/series filtering was explicitly deferred.
- Evidence: `docs/changes/2026-08-04_1122_IST_MARKET_MOVERS_IMPLEMENTATION.md` and `docs/changes/2026-08-04_1617_IST_MARKET_MOVERS_UI_FIX.md`.

## Latest Verified State (August 3, 2026 - Scanner, Pattern Overlay, and Sidebar Polish)
- **Daily Market Scanners**:
  - Added native Top Gainers, Top Losers, Volume Surge, 52-Week High, and 52-Week Low presets with an All Watchlists target option through `dailyMarketScanners.ts`, `scannerPlugin.ts`, `scannerRunner.ts`, and `ScannerWindow.tsx`.
- **Chart overlays and indicator reliability**:
  - Candlestick pattern markers now use sentiment colors, concise badges, full-name hover details, and adaptive legend contrast.
  - Supertrend `style_linebr` series break cleanly at null values instead of drawing diagonal segments across trend flips.
  - Indicator cache signatures now include source, chaining, offset, timeframe, plot-style, and opacity settings.
- **Sidebar and chart controls**:
  - Watchlist and Symbols lists share stable-gutter, theme-colored scrollbars and preserve normal hover text/brightness; Sync/Link controls are available from Scale Settings and default to disabled.
- **Validation**:
  - `scripts\validate-change.ps1 -Profile renderer`: PASS (renderer typecheck and whitespace check).

## Latest Verified State (August 2, 2026 - Multi-Chart Synced Crosshairs & Symbol Linking)
- **Multi-Chart Synced Crosshairs & Symbol Linking**:
  - `src/store/uiStore.ts`: Added `syncedCrosshairDate`, `crosshairSyncEnabled`, `symbolLinkEnabled`, `setSyncedCrosshairDate`, `toggleCrosshairSync`, and `toggleSymbolLink`.
  - `src/features/charts/chartInstrumentCompareController.ts`: Updated `loadInstrument` to broadcast instrument updates to all linked grid tabs when `symbolLinkEnabled` is active.
  - `src/components/ChartCanvas.tsx` & `src/engine/ChartEngine.ts`: Added date-based crosshair synchronization across multi-chart grid cells with `setSyncedCrosshairBarIndex()`.
  - `src/components/Toolbar.tsx`: Added `🎯 Sync` and `🔗 Link` toolbar controls.
  - `src/engine/__tests__/syncedCrosshair.test.ts`: Added unit test suite.
- **Validation**:
  - `npx tsc --noEmit`: PASS (0 errors)
  - `npx vitest run`: PASS (10 test files / 29 tests passing)

## Latest Verified State (August 2, 2026 - Multi-Symbol Crossover & Signal Scanner)
- **Multi-Symbol Crossover & Signal Scanner**:
  - `src/plugins/scanner/signalScanners.ts`: Created signal scanner engine with built-in presets (Golden Cross, Death Cross, RSI Oversold Bounce, RSI Overbought Drop) and custom rule evaluation.
  - `src/plugins/scanner/scannerRunner.ts`: Integrated `signalScanners` evaluation in market universe batch scan loop.
  - `src/plugins/scanner/scannerPlugin.ts`: Registered `signalScannerDefinitions` under `visual_signals` category.
  - `src/components/ScannerWindow.tsx`: Passed `signalRules` from `uiStore` to batch runner with 1-click double-click chart navigation.
  - `src/plugins/scanner/__tests__/signalScanners.test.ts`: Added unit test suite.
- **Validation**:
  - `npx tsc --noEmit`: PASS (0 errors)
  - `npx vitest run`: PASS (9 test files / 27 tests passing)

## Latest Verified State (August 2, 2026 - Visual Alert & Crossover Signals Engine)
- **Visual Alert & Crossover Signals Engine**:
  - `src/engine/types.ts`: Added `SignalConditionType`, `SignalMarkerShape`, `SignalMarkerPosition`, `ChartSignalRule`, and `RenderableSignalMarker`.
  - `src/engine/Signals.ts`: Implemented `evaluateSignalRules()` for bar-by-bar crossover and threshold evaluation (e.g. Golden Cross, RSI Oversold/Overbought).
  - `src/engine/Renderer.ts`: Added `drawSignalMarkers()` for vector rendering of Buy/Sell arrows (`▲` / `▼`), shapes, and text badges on chart candles.
  - `src/components/SignalSettingsDialog.tsx`: Created Signal Manager modal for adding, editing, toggling, and removing crossover rules.
- **Pre-backup**: Git commit `bc28035`.
- **Validation**:
  - `npx tsc --noEmit`: PASS (0 errors)
  - `npx vitest run src/engine`: PASS (8 test files / 24 tests passing)

## Latest Verified State (August 2, 2026 - Indicator Settings Engine Modernization Phases 1–4 & New Indicators)
- **4-Phase Indicator Settings Modernization Engine**:
  - **Phase 1 (Universal Price Source & Numeric Constraints)**: `getSourceValues()` extended for `close`, `open`, `high`, `low`, `hl2`, `hlc3`, `ohlc4` across all indicators. `IndicatorFieldDefinition` updated with `min`, `max`, and `step` numeric range constraints.
  - **Phase 2 (Plot Styles, Opacity & Band Fills)**: Supported 6 plot styles (`Line`, `Step Line`, `Histogram`, `Area`, `Cross`, `Circles`) in `Renderer.ts`. Added `drawBandFills()` for polygon channel shading (Bollinger Bands, Keltner, Ichimoku Cloud). Added Opacity Sliders (`0–100%`) in `IndicatorSettingsDialog.tsx`.
  - **Phase 3 (Multi-Timeframe & Offset Engine)**: Added `applyOffset()` for plot displacement forward (`+N`) or backward (`-N`). Added `aggregateBarsToHTF()` for `Weekly`, `Monthly`, `Quarterly`, `Yearly` HTF overlays on daily charts.
  - **Phase 4 (Indicator Chaining & Study-as-Source)**: Updated `buildRenderableIndicators()` with topological evaluation and `sourceSeriesMap` allowing any active indicator (e.g. `RSI`, `OBV`) to serve as input source for another indicator (`SMA`, `Bollinger Bands`). `SourceField` updated with **Active Indicators (Study-as-Source)** optgroup.
- **New Core Indicators**:
  - `Central Pivot Range (CPR)`: Added pivot, TC, BC plot series.
  - `Stochastic RSI (StochRSI)`: Calculated Stochastic oscillator over RSI values.
  - `Anchored VWAP (AVWAP)`: Anchored volume-weighted average price.
- **Validation**:
  - `npx tsc --noEmit`: PASS (0 errors)
  - `npx vitest run src/engine`: PASS (7 test files / 22 tests passing)

## Latest Verified State (July 31, 2026 - 5 Next Feature Subsystems Plan Completed)
- **Subsystem 5: Interactive Chart Pattern Target Projections**:
  - `src/plugins/scanner/chartPatternTypes.ts`: Added `ChartPatternTargetProjection`, `targetPrice`, `stopLossPrice`, `potentialGainPct`, and `riskRewardRatio`.
  - `src/components/ScannerWindow.tsx`: Formatted and displayed measured target prices, stop loss levels, gain %, and Risk/Reward (R:R) ratios in pattern scanner detail views.
- **Subsystem 2: Volume Profile (FRVP) Canvas Overlays**:
  - `src/engine/VolumeProfile.ts` & `src/engine/Renderer.ts`: Activated live canvas fixed-range volume profile calculations.
  - `src/components/ChartSettingsMenu.tsx` & `src/components/ChartCanvas.tsx`: Added Volume Profile (FRVP) toggle to price scale settings menu.
- **Subsystem 4: Comprehensive EOD Alert Manager**:
  - `src/components/AlertManagerWindow.tsx` & `src/RootApp.tsx`: Mounted central Alert Manager floating window for rule management and trigger history.
  - `src/components/Toolbar.tsx`: Added direct Alerts launcher button on main chart toolbar.
- **Subsystem 1: Custom Formula Scanner & AFL Expression Engine**:
  - `src/plugins/scanner/scannerRunner.ts`: Implemented `runCustomFormulaScannerBatch` to scan symbol watchlists and market universes using custom AFL/indicator formulas.
- **Subsystem 3: Multi-Chart Grid Layouts & Synced Panes**:
  - `src/components/Toolbar.tsx`: Added Multi-Chart Layout mode selector (`Single`, `Split H (2x1)`, `Split V (1x2)`, `Grid (2x2)`) directly on chart toolbar.
- **Backups**: `backups/pre-pattern-target-projections-20260731`, `backups/pre-volume-profile-20260731`, `backups/pre-alert-manager-20260731`, `backups/pre-custom-formula-scanner-20260731`, `backups/pre-multi-chart-grid-20260731`.
- **Validation**:
  - `scripts/validate-change.ps1 -Profile renderer`: PASS

## Latest Verified State (July 31, 2026 - Corporate Actions Enhancements: Demergers, TERP Safety & Chart Badges)
- **De-mergers & Spin-offs (`DEMERGER`)**:
  - `src/types/desktop.ts` and `src/platform/types.ts` extended to include `'DEMERGER'` in `CorporateActionType` and `CorporateActionImportActionType`.
  - Database schema columns `cost_allocation_pct` and `spunoff_symbol` supported via auto-migrations in `src-tauri-shell/src/database/bootstrap.rs`.
  - Ingestion parser in `corporate_action_imports.rs` updated to recognize `DEMERGER`, `DE-MERGER`, `SPIN OFF`, `SPINOFF`, and `SCHEME OF ARRANGEMENT`.
  - Adjustment engine in `eod_data.rs` updated to include `DEMERGER` events in SQL filters and compute price factors from cost allocation percentages ($100 / (100 - \text{CostPct})$).
- **TERP Safety & Rights Validation**:
  - Enforced ratio and issue price safety rules for rights offerings to prevent out-of-the-money rights issues from miscalculating price adjustment factors.
- **Timeline Event Badges**:
  - Added **$M$** (Demerger) badge label alongside **$S$** (Split), **$B$** (Bonus), **$D$** (Dividend), and **$R$** (Rights) event markers in `eod_data.rs`.
  - Connected event markers to chart timeline rendering in `ChartCanvas.tsx` and filter types in `DatabaseToolsDialogs.tsx`.
- **Backup**: `backups/pre-corporate-actions-20260731`

## Latest Verified State (July 1, 2026 - Plugin Foundation And Core EOD Scanner)
- **Plugin-first scanner foundation is implemented and validated**:
  - V1 plugin support is renderer-side and bundled-only under `src/plugins/`; external folder plugins remain planned/disabled.
  - plugin metadata covers id/name/version/type/status/capabilities, with plugin enablement persisted in app profile settings.
  - Settings now includes a `Plugins` section showing the bundled Core EOD Scanner plugin and the disabled external-plugin note.
  - Chart > Scanner opens a read-only floating Scanner window using the existing desktop bridge and `getEodData`.
  - the Core EOD Scanner plugin ports the first OHLCV-only batch from `E:\TA Projects\TA Content Source Code`: `prev_day_high_break`, `prev_day_low_break`, `inside_bar`, `outside_bar`, `close_near_high`, `close_near_low`, `gap_up`, `gap_down`, `nr7`, and `wide_range_candle`.
  - scanner execution stays in TypeScript and does not mutate the database; DLL/COM/OLE/script execution, external folders, forecast/ML runtime, event/breadth/score/custom-formula scanners, and broader scanner families are deferred.
- **Backup**: `backups/pre_opencode_changes_20260701_033750_plugin_scanner_v1`
- **Validation**:
  - `npm.cmd run typecheck:renderer`: PASS
  - `npx.cmd vitest run src/plugins/__tests__/pluginRegistry.test.ts src/plugins/scanner/__tests__/coreOhlcvScanners.test.ts`: PASS, 2 files / 6 tests
  - `scripts/validate-change.ps1 -Profile renderer`: PASS
  - `scripts/validate-change.ps1 -Profile tauri`: PASS, including Rust format check, renderer typecheck, Tauri compile check, and whitespace check
- **Remaining QA**: manual UI verification after rebuild: Settings > Plugins persistence, Chart > Scanner active-chart scan, and a small watchlist scan.

## Latest Verified State (June 27, 2026 - Historical Corporate Actions Phase 6 Major-Liquid Source)
- **Phase 6 major-liquid batch source is implemented and validated**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now exposes read-only `list_historical_capital_action_major_liquid_candidates`
  - major-liquid candidates rank active NSE symbols by average recent local traded value from `eod_prices`, require at least 20 recent bars, and cap at the existing 25-symbol batch size
  - `src/types/desktop.ts`, `src/platform/types.ts`, `src/platform/tauriDesktop.ts`, and `src-tauri-shell/src/main.rs` wire the new command through the desktop bridge
  - `src/components/DatabaseToolsDialogs.tsx` now adds a `Major Liquid` source button beside `Current Chart`, `Watchlist`, `Sparse History`, and `Old Aliases`
  - the button only fills the historical batch textarea; it does not run the batch, approve rows, change canonical `corporate_actions`, or mutate raw `.eod` prices
- **Backup**: `backups/pre_opencode_changes_20260627_133523_historical-ca-phase6-major-liquid-source`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml major_liquid_candidates_rank_active_symbols_by_recent_traded_value`: PASS
  - `npm run typecheck:renderer`: PASS
  - `scripts/validate-change.ps1 -Profile corporate-actions`: PASS on retry, including Rust format check, 39 corporate-action tests, renderer typecheck, Tauri compile check, and whitespace check
- **Remaining QA**: portable UI check for the new `Major Liquid` button is pending; do not build portable unless explicitly requested.

## Latest Verified State (June 27, 2026 - Historical Corporate Actions Phase 6 Sparse Source)
- **Phase 6 sparse-history batch source is implemented and validated**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now exposes read-only `list_historical_capital_action_sparse_candidates`
  - sparse candidates rank active NSE symbols with unresolved split/bonus import review rows first, then long-history symbols with fewer than two known split/bonus actions/imports
  - `src/types/desktop.ts`, `src/platform/types.ts`, `src/platform/tauriDesktop.ts`, and `src-tauri-shell/src/main.rs` now wire the new command through the desktop bridge
  - `src/components/DatabaseToolsDialogs.tsx` now adds a `Sparse History` source button beside `Current Chart` and `Watchlist`
  - the button only fills the historical batch textarea; it does not run the batch, approve rows, change canonical `corporate_actions`, or mutate raw `.eod` prices
  - the existing 25-symbol batch limit remains enforced
- **Backup**: `backups/pre_opencode_changes_20260626_204922_historical-ca-phase6-sparse-source`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `npm run typecheck:renderer`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml sparse_candidates_prioritize_unresolved_then_long_history_sparse_symbols -- --nocapture`: PASS
  - `scripts/validate-change.ps1 -Profile corporate-actions`: PASS, including Rust format check, 37 corporate-action tests, renderer typecheck, Tauri compile check, and whitespace check
- **Portable QA**: PASS on 2026-06-27. User-built portable app confirmed `Sparse History` populated 25 NSE symbols, `Run Batch` completed 25/25 with 0 failed and 0 errors, duplicate-only results were reported as expected, and `Load Runs` displayed persisted run #3 above prior runs.
- **Next step**: decide whether the next Phase 6 source should be older-alias candidates or major-liquid-symbol candidates.

## Latest Verified State (June 27, 2026 - Historical Corporate Actions Phase 6 Old-Alias Source)
- **Phase 6 old-alias batch source is implemented and validated**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now exposes read-only `list_historical_capital_action_alias_candidates`
  - alias candidates rank active NSE symbols with identity-history old symbols by earliest alias date, alias count, first price date, and symbol
  - `src/types/desktop.ts`, `src/platform/types.ts`, `src/platform/tauriDesktop.ts`, and `src-tauri-shell/src/main.rs` wire the new command through the desktop bridge
  - `src/components/DatabaseToolsDialogs.tsx` now adds an `Old Aliases` source button beside `Current Chart`, `Watchlist`, and `Sparse History`
  - the button only fills the historical batch textarea; it does not run the batch, approve rows, change canonical `corporate_actions`, or mutate raw `.eod` prices
- **Backup**: `backups/pre_opencode_changes_20260627_024332_historical-ca-phase6-alias-source`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `npm run typecheck:renderer`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml alias_candidates_rank_active_symbols_with_old_identity_history -- --nocapture`: PASS
  - `scripts/validate-change.ps1 -Profile corporate-actions`: PASS, including Rust format check, 38 corporate-action tests, renderer typecheck, Tauri compile check, and whitespace check
- **Portable QA**: PASS on 2026-06-27. User-built portable app confirmed `Old Aliases` populated 25 NSE symbols, `Run Batch` completed 25/25 with 0 failed and 0 errors, duplicate-only results were reported as expected, and `Load Runs` displayed persisted run #4 above prior runs.

## Latest Verified State (June 26, 2026 - Full Zoom-Out Viewport Fit)
- **Full-history chart zoom-out now fits dense histories inside the plot width**:
  - `src/engine/ScaleManager.ts` now allows sub-pixel X spacing when the visible bar count exceeds available horizontal pixels, so a fully zoomed-out long-history chart can fit in the viewport instead of rendering beyond the plot edge.
  - `src/engine/__tests__/ScaleManager.test.ts` covers dense full-history X-scale fit and repeated zoom-out clamping to the allowed full-history span.
  - `FULL_ZOOM_OUT_VIEWPORT_FIX_REPORT.md` records the root cause, preserved behavior, validation, and portable QA result.
- **Backup**:
  - `backups/pre_opencode_changes_20260626_182803_zoom-viewport`
  - `backups/pre_opencode_changes_20260626_190346_docs-zoom-viewport`
- **Validation**:
  - `npm test -- --run src/engine/__tests__/ScaleManager.test.ts`: PASS
  - `scripts/validate-change.ps1 -Profile renderer`: PASS
- **Portable QA**: PASS. User rebuilt the Windows portable app and confirmed full zoom-out works without other observed issues.

## Latest Verified State (June 26, 2026 - Historical Corporate Actions Phase 6 Batch Sources)
- **Phase 6 priority-universe expansion has started with app-data batch sources**:
  - `src/components/DatabaseToolsDialogs.tsx` now adds `Current Chart` and `Watchlist` source buttons beside the historical batch textarea in `Official Imports`
  - `Current Chart` loads the active NSE chart symbol into the batch list
  - `Watchlist` loads NSE symbols from the selected watchlist, falling back to the first loaded watchlist when none is selected
  - source buttons only populate the textarea; they do not run the batch, approve imports, change canonical `corporate_actions`, or mutate raw `.eod` prices
  - the existing 25-symbol batch limit remains enforced by the existing run path
- **Backup**: `backups/pre_opencode_changes_20260626_010403_historical-ca-phase6-batch-sources`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `scripts/validate-change.ps1 -Profile corporate-actions`: PASS, including Rust format check, 36 corporate-action tests, renderer typecheck, Tauri compile check, and whitespace check
- **Next step at that checkpoint**: add a sparse-history candidate source that fills the same batch list from symbols with missing/unresolved historical capital-action coverage.

## Latest Verified State (June 26, 2026 - Historical Corporate Actions Phase 5 Closeout)
- **Phase 5 is complete and verified for the first controlled batch workflow**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now exposes `backfill_historical_capital_actions_batch`, a controlled multi-symbol wrapper around the existing Phase 3 single-symbol backfill implementation
  - `list_historical_capital_action_backfill_runs` now returns persisted run rows with their per-symbol rows for future UI display
  - `src-tauri-shell/src/database/bootstrap.rs` now creates `historical_capital_action_backfill_runs` and `historical_capital_action_backfill_run_symbols`
  - `src/components/DatabaseToolsDialogs.tsx` now adds a minimal `Official Imports` batch area for up to 25 NSE symbols, `stop on error`, latest batch result, and compact persisted run history
  - `Load Runs` now gives visible inline feedback with a refreshed timestamp/count before displaying the saved run-history rows
  - the batch input uses one common exchange/date window, up to 25 per-symbol requests, optional per-symbol BSE scrip codes, and optional `stopOnError`
  - the batch result now returns the persisted run id and per-symbol row ids/statuses while aggregating inserted/duplicate/evidence/error counters
  - the TypeScript desktop bridge now includes `backfillHistoricalCapitalActionsBatch` and `listHistoricalCapitalActionBackfillRuns`
  - review-first behavior is preserved: the new slice does not auto-approve rows, change canonical `corporate_actions`, or mutate raw `.eod` prices
- **Portable QA**: PASS on 2026-06-26 using the rebuilt portable app. A batch for `INFY`, `WIPRO`, and `KOTAKBANK` completed, persisted one run-history row, and `Load Runs` refreshed the displayed run list.
- **Backup**:
  - `backups/pre_opencode_changes_20260625_194906_historical-ca-phase5-ui-entry`
  - `backups/pre_opencode_changes_20260625_235914_historical-ca-load-runs-feedback`
  - `backups/pre_opencode_changes_20260626_005750_historical-ca-phase5-closeout`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `scripts/validate-change.ps1 -Profile corporate-actions`: PASS, including Rust format check, 36 corporate-action tests, renderer typecheck, Tauri compile check, and whitespace check
- **Next phase**: Phase 6 priority-universe expansion should add real data-driven ways to populate the batch list, starting with sparse-history/current-chart/watchlist candidates.

## Latest Verified State (June 25, 2026 - Historical Corporate Actions Phase 4 QA Closeout)
- **Phase 4 review evidence is now verified end to end for the remaining QA case**:
  - user-run `scripts/validate-change.ps1 -Profile corporate-actions` passed on 2026-06-25: Rust format check, 31 corporate-action tests, renderer typecheck, Tauri compile check, and whitespace check
  - portable visual QA covered a synthetic multi-source import row with long source locators in `Official Imports` and the existing resolve panel
  - the QA row showed `2 evidence` from `BSE_API,NSE_API`; the long locator and note wrapped cleanly in the hover tooltip and `Source Evidence` panel
  - the synthetic row deliberately had no matching instrument, so `Resolve To Selected` was disabled by design and did not indicate a Phase 4 failure
  - the isolated QA database stayed under `test-output/phase4-multisource-db-20260625_161323`, and the live database registry was restored after QA
  - corporate-action imports remain review-first; canonical `corporate_actions` and raw `.eod` prices are unchanged
- **Backup**: `backups/pre_opencode_changes_20260625_175005_historical-ca-phase4-docs-closeout`
- **Validation**:
  - `scripts/validate-change.ps1 -Profile corporate-actions`: PASS, run manually by the user before closeout
  - portable visual QA for long-locator / multi-source evidence rendering: PASS

## Latest Verified State (June 20, 2026 - Historical Corporate Actions Phase 4 Review Evidence)
- **Phase 4 now exposes historical import provenance inside the existing review flow**:
  - corporate-action import rows now carry evidence count, distinct source codes, and the latest evidence capture/locator/note from `corporate_action_import_evidence`
  - `Official Imports` and `Review Issues` show compact evidence/source context without adding a new approval path
  - the existing resolve panel shows the attached source evidence and resolver guidance reports the provenance sources behind the selected row
  - approval status, resolver matching policy, canonical `corporate_actions`, and raw `.eod` prices are unchanged
- **Backup**: `backups/pre_opencode_changes_20260620_210537_historical-ca-phase4-review-evidence`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - direct targeted test-binary run before the fixture correction: 27 PASS / 4 FAIL because four legacy unit fixtures omitted the Phase 2 evidence table
  - those four fixtures were updated to the current schema and an evidence-summary assertion was added; the final targeted-test relink exceeded 20 minutes in this Windows environment and was stopped, so a clean targeted test PASS is still pending

## Latest Verified State (June 12, 2026 - Historical Corporate Actions Phase 3 Pilot UI + BSE Inference)
- **Phase 3 is now usable from the `Official Imports` window instead of staying backend-only**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now performs a conservative BSE scrip-code inference when the historical pilot is run without an explicit `bseScripCode`: it only accepts a unique current `BSE` instrument found by exact same-ISIN match, and only when that BSE symbol looks like a numeric scrip code.
  - `src/components/DatabaseToolsDialogs.tsx` now adds a compact `Historical NSE` control row inside `Official Imports` with symbol, date range, optional BSE scrip code, `Current`, and `Backfill History`.
  - After a successful pilot run, the UI now switches back to the review queue, focuses the import search on the requested/canonical symbol, and reports whether an inferred BSE scrip code was used.
- **Behavior change**:
  - previous behavior: Phase 3 existed only as a typed backend/bridge command, and BSE deep-history support required the caller to supply a `bseScripCode` manually every time.
  - new behavior: the same pilot can now be launched directly from `Official Imports`, and it will try the lowest-risk BSE code inference path automatically before falling back to NSE-only historical coverage.
- **Backup**: `backups/pre_opencode_changes_20260612_104802_historical-ca-phase3-ui-resume`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS

## Latest Verified State (June 12, 2026 - Historical Corporate Actions Phase 3 Pilot Command)
- **Phase 3 now exists as a backend-only historical capital-actions pilot command**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now exposes `backfill_historical_capital_actions_for_symbol`, a typed single-symbol pilot command for historical split/bonus backfill.
  - The pilot is intentionally narrow in this slice:
    - target exchange is currently `NSE` only
    - it queries the official NSE structured API with a concrete `symbol=` parameter for the requested symbol plus every connected identity-history alias
    - it can also query official BSE deep history through the existing `DefaultData` API when the caller supplies an explicit `bseScripCode`
  - The pilot preserves the current review-first contract:
    - only split/bonus rows are processed
    - no row is auto-approved
    - raw `.eod` prices stay untouched
    - equivalent existing import rows are not recreated across sources; instead, new provenance is attached to the existing row through `corporate_action_import_evidence`
  - The result payload now reports searched symbols, source attempts, inserted rows, exact duplicates, evidence-attached rows, and warnings when the current official sources still do not expose older history.
- **Behavior change**:
  - previous behavior: the repo had a Phase 2 evidence foundation and a checked-in historical backfill plan, but no executable per-symbol pilot command to populate the review queue from symbol-scoped official history.
  - new behavior: the app backend and typed desktop bridge now support a real Phase 3 pilot command that can backfill review rows for an NSE symbol using symbol-scoped official sources, while staying explicit about the remaining deep-history coverage limits.
- **Backup**: `backups/pre_opencode_changes_20260612_023157_historical-ca-phase3-pilot`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/database.rs src-tauri-shell/src/database/corporate_action_imports.rs src-tauri-shell/src/main.rs src/types/desktop.ts src/platform/types.ts src/platform/tauriDesktop.ts`: PASS

## Latest Verified State (June 12, 2026 - Historical Corporate Actions Evidence Foundation)
- **Phase 2 foundation now exists for historical corporate-action provenance**:
  - `src-tauri-shell/src/database/bootstrap.rs` now creates `corporate_action_import_evidence`, a per-import evidence table that stores source code, source locator, captured time, symbol/ISIN/company/action/date/factor as seen, a compact raw reference payload, and a note.
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now writes one evidence snapshot automatically whenever a new official/CSV import row is inserted into `corporate_action_imports`.
  - Older databases now run a one-time backfill behind `migration.corporate_action_import_evidence_backfill_v1`, seeding one evidence row per existing `corporate_action_imports` record even though older builds did not preserve the full raw source payload separately.
  - This stays backend-only and does not change review status, approval semantics, resolver policy, or chart pricing behavior.
- **Behavior change**:
  - previous behavior: imported corporate-action rows stored only the flattened review candidate in `corporate_action_imports`, so later backfill work had no dedicated provenance table to attach or preserve source evidence against each import row.
  - new behavior: each import row now has a dedicated evidence layer, and older databases seed that layer once on open, giving future historical backfill work a stable place to store source proof without polluting `corporate_actions`.
- **Backup**: `backups/pre_opencode_changes_20260612_012106_historical-ca-evidence-foundation`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml bootstrap -- --nocapture`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS

## Latest Verified State (June 12, 2026 - Historical Corporate Actions Phase 1 Source Spike)
- **Phase 1 of the historical split/bonus backfill plan is now complete as a checked-in source audit**:
  - `HISTORICAL_CORPORATE_ACTIONS_SOURCE_SPIKE_REPORT.md` now compares the active local DB, the live NSE structured corporate-actions API, and symbol-level public history cross-checks for `KOTAKBANK`, `INFY`, `WIPRO`, `BAJFINANCE`, and `HDFCBANK`.
  - The report confirms that the current structured NSE feed is suitable for the app's recent-history review workflow, but not sufficient as the only deep-history split/bonus source.
  - `BAJFINANCE` and `HDFCBANK` emerged as useful control cases: their split/bonus history looks source-complete in the current feed, while their unresolved status still reflects historical ISIN drift rather than missing capital-action rows.
  - `KOTAKBANK`, `INFY`, and `WIPRO` remain proof cases that older split/bonus rows are absent from the current structured source path and therefore require a dedicated backfill source path.
- **Behavior change**:
  - previous behavior: the repository had a historical backfill phase plan, but not a checked-in Phase 1 source audit proving which sources were sufficient or insufficient on real symbols.
  - new behavior: the repository now has a concrete source-spike report that future implementation work can use to justify a historical evidence table and a single-symbol backend pilot without re-auditing the same symbols first.
- **Backup**: `backups/pre_opencode_changes_20260612_005259_historical_ca_phase1_source_spike`
- **Validation**:
  - `git diff --check -- HISTORICAL_CORPORATE_ACTIONS_SOURCE_SPIKE_REPORT.md README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md FUTURE_PROMPT_README_EOD_CHARTING_PLATFORM.md`: PASS

## Latest Verified State (June 12, 2026 - Historical Corporate Actions Backfill Phase Plan)
- **A phased plan now exists for deep historical split/bonus backfill**:
  - `HISTORICAL_CORPORATE_ACTIONS_BACKFILL_PHASE_PLAN.md` now documents why the current live NSE/BSE official-import feeds are insufficient for deep split/bonus history, while preserving the current review-first import contract.
  - The plan defines a narrow progression: source spike on known symbols, historical evidence model, single-symbol backend pilot command, later batch scaling, and validation/hardening phases.
  - The document keeps raw `.eod` data immutable, keeps `corporate_actions` canonical, and treats historical provenance as first-class instead of silently overwriting current identity fields.
- **Behavior change**:
  - previous behavior: the repo had working historical-ISIN review improvements and recent official import flows, but no checked-in phase plan for recovering older split/bonus rows missing from the live structured exchange feeds.
  - new behavior: the repo now has a concrete phase-by-phase backfill plan that future implementation work can follow without rediscovering scope or weakening current review guarantees.
- **Backup**: `backups/pre_opencode_changes_20260612_003642_historical_ca_phase_plan`
- **Validation**:
  - `git diff --check -- HISTORICAL_CORPORATE_ACTIONS_BACKFILL_PHASE_PLAN.md README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md FUTURE_PROMPT_README_EOD_CHARTING_PLATFORM.md`: PASS

## Latest Verified State (June 11, 2026 - Review Issues Toolbar Wrap Fix)
- **The `Review Issues` top action row now wraps at the default floating-window size**:
  - `src/components/DatabaseToolsDialogs.tsx` now uses a wrapping toolbar style for the `Review Issues` action row instead of the older single-line flex row.
  - This keeps `More Imports`, `Recheck Selected`, `Quick Resolve Selected`, and the grouped save/export actions visible inside the default Corporate Actions / Identity window width.
  - The change is UI-only and does not alter review, resolve, export, or approval semantics.
- **Behavior change**:
  - previous behavior: the `Review Issues` action row could clip horizontally at the default floating-window size, hiding part of the quick-resolve and export controls.
  - new behavior: that same action row now wraps onto additional lines so all controls remain reachable without enlarging the window first.
- **Backup**: `backups/pre_opencode_changes_20260611_233704_issue_review_toolbar_wrap_fix`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Compact Export Progress Badges)
- **The inline long-export progress now includes compact numeric counters**:
  - `src/components/DatabaseToolsDialogs.tsx` now tracks structured `issueExportProgressState` alongside the existing inline progress message.
  - The `Review Issues` export area now renders small badges for pages fetched, unresolved rows gathered, hint batches completed, and matching rows being written.
  - This stays UI-only and builds on the existing `All matching` progress and cancel flow.
- **Behavior change**:
  - previous behavior: the inline export progress showed a plain sentence only.
  - new behavior: the same progress area now exposes scan-friendly counters without removing the existing descriptive message.
- **Backup**: `backups/pre_opencode_changes_20260611_221447_issue-review-export-badges`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Inline Export Progress In Review Issues)
- **Long `All matching` exports now have a dedicated inline progress surface near the export controls**:
  - `src/components/DatabaseToolsDialogs.tsx` now keeps a separate `issueExportProgressMessage` state for the `Review Issues` export area.
  - During `All matching` export, that inline helper now shows fetch progress, hint-batch progress, write-to-file progress, and cancellation state directly under the export controls.
  - The shared status line still updates, but export progress no longer depends on it alone.
- **Behavior change**:
  - previous behavior: long exports relied on the shared status line for progress visibility.
  - new behavior: the export controls now show a dedicated inline `Export Progress` message while the long export is running.
- **Backup**: `backups/pre_opencode_changes_20260611_212612_issue-review-export-inline-progress`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Cancel Support For Full Matching Exports)
- **Long `All matching` review-issue exports can now be cancelled safely before file save**:
  - `src/components/DatabaseToolsDialogs.tsx` now tracks whether a full matching export is in progress and exposes a `Cancel Export` button only for that flow.
  - Cancellation is cooperative: it stops after the current page-fetch or hint-build batch completes, then exits with `Export cancelled. No file was written.`
  - This applies only to the long-running `All matching` export path; the smaller loaded-page export path stays unchanged.
- **Behavior change**:
  - previous behavior: large `All matching` exports had visible progress but had to run to completion or wait for the save dialog.
  - new behavior: the same path can now be cancelled safely before any output file is written.
- **Backup**: `backups/pre_opencode_changes_20260611_202411_issue-review-export-cancel`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Full Matching Export Progress Counters)
- **Large `All matching` review-issue exports now show progress while they run**:
  - `src/components/DatabaseToolsDialogs.tsx` now updates the review status line during `All matching` export paging, reporting how many unresolved rows have been fetched and from how many pages.
  - The same helper now builds resolution hints in batches for large unresolved sets and reports `built hint batches for X/Y unresolved row(s)` before the save dialog opens.
  - Right before file save, the status line now reports how many matched rows are about to be written to disk.
- **Behavior change**:
  - previous behavior: `All matching` export worked, but large queues only showed a generic preparing message until save completion.
  - new behavior: large exports now expose incremental fetch progress, hint-build progress, and the final write step without changing export content or review semantics.
- **Backup**: `backups/pre_opencode_changes_20260611_201812_issue-review-export-progress`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Full Matching Review-Issue Audit Exports)
- **The saved review-issue exports can now operate on all matching unresolved rows, not just the loaded page**:
  - `src-tauri-shell/src/database.rs` and `src-tauri-shell/src/database/corporate_action_imports.rs` now extend `CorporateActionImportListInput` with `offset`, and the import-row query now supports `LIMIT ... OFFSET ...` paging.
  - `src/components/DatabaseToolsDialogs.tsx` now adds an `All matching` export toggle in `Review Issues`.
  - When that toggle is enabled, `Save 1 Active`, `Save Multiple`, `Save No Active`, and `Save No Hint` fetch all matching unresolved import rows in pages using the current action-type and search filters, then save the chosen hint bucket through the existing native save dialog.
- **Behavior change**:
  - previous behavior: saved audit exports only operated on the currently loaded unresolved rows.
  - new behavior: saved audit exports still use the loaded page by default, but can optionally fetch and export the full matching unresolved result set.
- **Backup**: `backups/pre_opencode_changes_20260611_193013_issue-review-full-export`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/types/desktop.ts src-tauri-shell/src/database.rs src-tauri-shell/src/database/corporate_action_imports.rs src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Saved Review-Issue Audit Exports)
- **The hint-bucket audit exports now save to files instead of staying clipboard-only**:
  - `src-tauri-shell/src/imports.rs` now adds a small generic `save_text_export` command that opens a native save dialog with `rfd`, appends the default extension when needed, and writes the supplied text payload to disk.
  - `src/platform/tauriDesktop.ts`, `src/platform/types.ts`, and `src/types/desktop.ts` now expose that save-text export seam through the existing desktop bridge.
  - `src/components/DatabaseToolsDialogs.tsx` now routes the review-issues audit exports through that bridge and renames the toolbar actions to `Save 1 Active`, `Save Multiple`, `Save No Active`, and `Save No Hint`.
- **Behavior change**:
  - previous behavior: the grouped review-audit exports were copied to the clipboard only.
  - new behavior: each grouped audit export now opens a native save dialog and writes a `.tsv` file, while keeping the same tab-separated content shape and hint-bucket separation.
- **Backup**: `backups/pre_opencode_changes_20260611_185759_issue-review-save-export`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/types/desktop.ts src/platform/types.ts src/platform/tauriDesktop.ts src-tauri-shell/src/imports.rs src-tauri-shell/src/main.rs src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Review Issues Batch Audit Exports And Hint Summary Cleanup)
- **The remaining hint buckets can now be exported directly, and the summary now matches the visible labels**:
  - `src/components/DatabaseToolsDialogs.tsx` now replaces the one-off `Copy No Active` helper with a shared export path and adds `Save 1 Active`, `Save Multiple`, and `Save No Hint` beside the existing `Save No Active` action.
  - Each export refreshes quick-resolve hints for the currently loaded unresolved rows, exports only the chosen hint bucket, and includes symbol, company, ISIN, exchange, event date, type, review status, hint label, hint message, active suggestion count, total suggestion count, top suggestion, and row message in tab-separated audit text.
  - The default review status line now reports a compact hint summary: `1 active`, `multiple active`, `no active`, and `no hint`.
- **Behavior change**:
  - previous behavior: only the `No Active` bucket had a grouped export, and the `No Active` bucket still included `No hint` rows because both came from `NONE_ACTIVE`.
  - new behavior: all practical audit buckets can now be exported directly, and `No Active` now means `NONE_ACTIVE` with at least one related suggestion while `No Hint` covers rows with no structured suggestion path at all.
- **Backup**: `backups/pre_opencode_changes_20260611_184057_issue-review-batch-exports`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Copy No Active Audit Export In Review Issues)
- **`No Active` unresolved rows can now be copied out as a grouped audit set**:
  - `src/components/DatabaseToolsDialogs.tsx` now adds a `Copy No Active` action in the `Review Issues` toolbar.
  - The action refreshes quick-resolve hints for the currently loaded unresolved import rows, keeps only rows whose hint status is `NONE_ACTIVE`, and copies them to the clipboard as tab-separated text with symbol, company, ISIN, exchange, event date, type, review status, hint text, hint message, and row message.
  - This stays UI-only and review-first: it does not change the row statuses, resolver behavior, or approval rules.
- **Behavior change**:
  - previous behavior: `No Active` rows could be filtered and inspected in the table, but there was no grouped export for external audit or note-taking.
  - new behavior: the currently loaded `No Active` unresolved rows can be copied to the clipboard in one action for grouped manual review outside the table.
- **Backup**: `backups/pre_opencode_changes_20260611_183202_issue-no-active-export`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Row-Level No Active Help In Review Issues)
- **The row-level `No active` hint now explains itself before the filter is used**:
  - `src/components/DatabaseToolsDialogs.tsx` now adds a tooltip to the per-row quick-resolve hint badge in `Review Issues`.
  - When the hint status is `NONE_ACTIVE`, the tooltip now explains that no active current symbol was proven yet, lists the common causes already described by the filter helper, and explicitly states that this does not prove the company is unlisted.
- **Behavior change**:
  - previous behavior: the `No active` row hint badge was visible, but its tooltip did not distinguish resolver status from listing status.
  - new behavior: hovering the row-level hint now gives the same clarification directly at the point where the user first sees that status.
- **Backup**: `backups/pre_opencode_changes_20260611_182733_issue-row-no-active-help`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - No Active Help In Review Issues)
- **`No Active` now explains itself directly in the hint toolbar area**:
  - `src/components/DatabaseToolsDialogs.tsx` now adds a tooltip on the `No Active` filter label and a short inline helper line that appears when the filter is enabled.
  - That helper text makes the current meaning explicit: the resolver found no active current symbol yet, which can come from inactive aliases only, incomplete identity history, or no structured suggestion path; it does not prove the company is unlisted.
- **Behavior change**:
  - previous behavior: `No Active` was visible as a filter and row hint, but the UI did not explain that it was only a resolver-status hint.
  - new behavior: enabling the filter now exposes the intended interpretation directly in the review UI, reducing the chance that `No Active` is mistaken for a listing-status verdict.
- **Backup**: `backups/pre_opencode_changes_20260611_182206_issue-no-active-help`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - No Active Filter In Review Issues)
- **The unresolved queue can now be narrowed to rows with no active suggested current symbol**:
  - `src/components/DatabaseToolsDialogs.tsx` now adds a third optional `No Active` hint filter in `Review Issues`, alongside the existing `Only 1 Active` and `Multiple Active` filters.
  - When enabled, the issue table shows only unresolved rows whose cached hint is `NONE_ACTIVE`; if multiple hint filters are enabled together, the table shows the union of the selected unresolved hint subsets.
  - The issue status line now reports `No Active` counts, and the filtered empty-state text now explains no-active-only and mixed hint-filter cases instead of falling back to a generic no-rows message.
- **Behavior change**:
  - previous behavior: unresolved rows with no active suggested current symbol were mixed into the broader issue list and could not be isolated directly from the existing hint toolbar.
  - new behavior: those no-active unresolved rows can now be isolated directly for manual investigation, while the existing one-active quick-resolve and multiple-active ambiguity review flows stay unchanged.
- **Backup**: `backups/pre_opencode_changes_20260611_171024_issue-no-active-filter`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Multiple Active Filter In Review Issues)
- **The unresolved queue can now be narrowed to ambiguous rows with more than one active suggested current symbol**:
  - `src/components/DatabaseToolsDialogs.tsx` now adds a second optional `Multiple Active` hint filter in `Review Issues`, beside the existing `Only 1 Active` filter.
  - When enabled, the issue table shows only unresolved rows whose cached hint is `MULTIPLE_ACTIVE`; if both hint filters are enabled, the table shows the union of the one-active and multiple-active unresolved subsets.
  - The issue status line now reports both one-active and multiple-active hint counts, and the empty-state text now explains which hint-filter combination removed all visible rows.
- **Behavior change**:
  - previous behavior: the unresolved queue could be narrowed only to obvious one-candidate rows, while ambiguous multi-candidate rows still had to be found by scanning the broader issue list.
  - new behavior: ambiguous unresolved rows can now be isolated directly for manual review, while the existing one-candidate quick-resolve workflow remains unchanged.
- **Backup**: `backups/pre_opencode_changes_20260611_160937_issue-multiple-active-filter`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Only 1 Active Filter In Review Issues)
- **The unresolved queue can now be narrowed to rows that already have one active suggested current symbol**:
  - `src/components/DatabaseToolsDialogs.tsx` now adds an `Only 1 Active` filter in `Review Issues`, built on top of the existing quick-resolve hint cache.
  - When enabled, the issue table shows only unresolved rows whose cached hint is `ONE_ACTIVE`, and the unresolved-row selection / select-all behavior is scoped to the currently visible filtered rows.
  - This keeps `Quick Resolve Selected` focused on the obvious one-candidate subset without changing the underlying resolution rules.
- **Behavior change**:
  - previous behavior: users could see per-row hints and bulk quick-resolve selected rows, but still had to scan through the full unresolved issue list manually.
  - new behavior: the issue list can be narrowed directly to the one-active subset before selecting rows for batch quick resolve.
- **Backup**: `backups/pre_opencode_changes_20260611_160018_issue-only-one-active-filter`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Bulk Quick Resolve Selected In Review Issues)
- **Selected unresolved rows can now bulk-resolve when they already show one active suggestion**:
  - `src/components/DatabaseToolsDialogs.tsx` now adds `Quick Resolve Selected` to the `Review Issues` toolbar and reuses the existing selection checkboxes for unresolved rows.
  - The action refreshes quick-resolve hints for the selected rows, resolves only those with `ONE_ACTIVE` hint and a top suggested current symbol, reloads the issue list once, and leaves ambiguous rows untouched.
  - The tab status line now also shows how many selected unresolved rows currently have exactly one active suggestion.
- **Behavior change**:
  - previous behavior: even with per-row hints, obvious one-candidate cases still had to be cleared one row at a time.
  - new behavior: selected one-candidate rows can now be cleared in a batch while non-obvious rows remain manual-review rows.
- **Backup**: `backups/pre_opencode_changes_20260611_145641_issue-row-hints`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Per-Row Quick-Resolve Hints In Review Issues)
- **Unresolved review rows now show quick-resolve hints before you click**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now exposes `list_corporate_action_import_resolution_hints`, a read-only batch endpoint that summarizes each unresolved import row into `ONE_ACTIVE`, `MULTIPLE_ACTIVE`, `NONE_ACTIVE`, or `ERROR`, including the top suggested current symbol when one active candidate exists.
  - `src/components/DatabaseToolsDialogs.tsx` now loads those hints in the background for visible unresolved rows in `Review Issues` and shows compact row-level labels such as `1 active`, `2 active`, `No active`, or `No hint`.
  - The row action still stays manual-review-safe: it uses the cached one-active hint for a direct resolve when available, otherwise it falls back to opening the resolve panel.
- **Behavior change**:
  - previous behavior: users had to click `Quick Resolve` first to discover whether a row had one active suggested current symbol, multiple active candidates, or no active candidates.
  - new behavior: that quick-resolve shape is visible in the table before clicking, and the same cached hint is reused by the row action.
- **Backup**: `backups/pre_opencode_changes_20260611_145641_issue-row-hints`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/database.rs src-tauri-shell/src/database/corporate_action_imports.rs src/types/desktop.ts src/platform/types.ts src/platform/tauriDesktop.ts src-tauri-shell/src/main.rs src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Row-Level Quick Resolve In Review Issues)
- **Unresolved review rows now try the top suggestion directly from the table**:
  - `src/components/DatabaseToolsDialogs.tsx` now routes the unresolved row action in `Review Issues` through a `quickResolveIssueImport(...)` helper instead of always opening the resolve panel first.
  - That helper reuses the existing structured suggestion endpoint for the clicked row; when exactly one active suggested current symbol exists, it resolves directly from the table and reloads the issue list.
  - If quick resolve does not find a unique active suggestion, the same action falls back to opening the resolve panel for manual review.
- **Behavior change**:
  - previous behavior: unresolved review rows always required opening the resolve panel before any manual or suggested resolution could happen.
  - new behavior: obvious one-candidate cases can now resolve directly from the row, while ambiguous or weak cases still open the resolve panel.
- **Backup**: `backups/pre_opencode_changes_20260611_131757_issue-row-quick-resolve`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - One-Click Top Suggestion In Review Issues)
- **Resolve suggestions can now be applied directly when there is only one active current-symbol candidate**:
  - `src/components/DatabaseToolsDialogs.tsx` now derives a `topResolveSuggestion` from the already-loaded structured suggestion set whenever exactly one suggested candidate is active.
  - In that case, the resolve panel now shows a dedicated `Use Top Suggestion` button that resolves straight to that candidate without requiring the extra click of manually selecting it first.
  - This stays UI-only: the backend suggestion and manual resolve contracts are unchanged.
- **Behavior change**:
  - previous behavior: even if the resolve panel showed a single active suggested current symbol, the user still had to click the suggestion and then click `Resolve To Selected`.
  - new behavior: that exact case now offers a one-click direct action while keeping the existing `Auto Recheck`, `Resolve To Selected`, and free-form search workflow intact.
- **Backup**: `backups/pre_opencode_changes_20260611_130921_top-suggestion-action`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Structured Resolve Suggestions In Review Issues)
- **Unresolved official rows now preload suggested current symbols inside the resolve panel**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now exposes `list_corporate_action_import_resolution_suggestions`, a read-only helper that loads one unresolved import row plus structured current-symbol suggestions derived from the existing NSE identity chain and any matching historical ISIN evidence.
  - `src/components/DatabaseToolsDialogs.tsx` now calls that endpoint when the `Review Issues` resolve panel opens, preselects the first suggested match when one exists, and keeps the existing free-form symbol search as a fallback below the suggested list.
  - Suggestions explicitly show active/inactive status and the reason they were suggested, so exact historical-ISIN evidence and chain-only candidates are distinguishable before manual resolve.
- **Behavior change**:
  - previous behavior: the resolve panel only offered manual search results, even when the backend already knew a small set of likely current symbols through identity history.
  - new behavior: the resolve panel still stays manual and review-first, but now preloads those likely symbols as clickable suggestions before the user starts typing.
- **Backup**: `backups/pre_opencode_changes_20260611_123735_unresolved-resolve-suggestions`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/database.rs src-tauri-shell/src/database/corporate_action_imports.rs src/types/desktop.ts src/platform/types.ts src/platform/tauriDesktop.ts src-tauri-shell/src/main.rs src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Identity-Chain Ambiguity Messages For Review Issues)
- **Ambiguous identity-history auto-rechecks now explain themselves**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now keeps using the stronger identity-chain recheck path for unresolved NSE rows, but when that chain still points to multiple candidate database symbols it returns a more specific `UNRESOLVED` message instead of falling back to a generic unresolved reason.
  - The message now lists the candidate symbols and their active/inactive status, so the existing `Review Issues` message column and resolve panel helper text explain why manual resolve is still required.
- **Behavior change**:
  - previous behavior: ambiguous identity-chain rows stayed `UNRESOLVED`, but the message did not explain which database symbols were competing.
  - new behavior: ambiguous identity-chain rows still stay `UNRESOLVED`, but now carry an explicit candidate list for manual review.
- **Backup**: `backups/pre_opencode_changes_20260611_115659_unresolved-chain-explainer`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/database/corporate_action_imports.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Identity-Chain Auto-Recheck For Unresolved Official Imports)
- **Selected unresolved NSE rows can now climb a multi-step identity-history chain during auto-recheck**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now keeps the conservative single-hop identity match during fetch/import, but the unresolved auto-recheck path adds a stronger fallback that walks the connected NSE identity-history symbol chain for the requested symbol and official ISIN.
  - When that chain points to exactly one active current instrument, `Review Issues > Recheck Selected` can now promote the row to `PENDING` automatically instead of forcing a manual symbol resolve for old-to-mid-to-current rename chains.
  - If the chain still has no safe unique current candidate, the row stays `UNRESOLVED`; this pass does not widen fetch-time auto-matching or change manual approval rules.
- **Behavior change**:
  - previous behavior: unresolved auto-recheck only reused the same one-row identity-history lookup as fetch/import, so multi-step symbol chains could stay unresolved even when the database already had a clear active current symbol.
  - new behavior: unresolved auto-recheck can follow a connected identity-history chain and prefer the single active current symbol before leaving the row for manual resolve.
- **Backup**: `backups/pre_opencode_changes_20260611_112236_unresolved-identity-recheck`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/database/corporate_action_imports.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Targeted Bulk Recheck For Unresolved Official Imports)
- **Selected unresolved official rows can now be auto-rechecked without a full refetch**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now exposes `recheck_corporate_action_imports`, a bulk wrapper over the existing auto-recheck path used by single-row resolve with no manual symbol override.
  - The backend deduplicates selected ids, rechecks each row inside its own savepoint, and returns a summary of how many rows became reviewable versus stayed unresolved.
  - `src/components/DatabaseToolsDialogs.tsx` now adds unresolved-row selection plus `Recheck Selected` in `Review Issues`, while preserving the existing row-level `Resolve` path for manual symbol mapping when auto-recheck is still insufficient.
- **Behavior change**:
  - previous behavior: auto-recheck existed only one row at a time through the resolve panel, so cleaning a backlog of unresolved rows required repeated manual clicks or a full refetch.
  - new behavior: selected unresolved rows can be rechecked in bulk against the current database, symbol history, and ISIN evidence without calling the official source again.
- **Backup**: `backups/pre_opencode_changes_20260611_102355_historical-isin-live-reclassify`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml instrument_mutations -- --nocapture`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml bootstrap -- --nocapture`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/database/corporate_action_imports.rs src-tauri-shell/src/database/instrument_mutations.rs src/types/desktop.ts src/platform/tauriDesktop.ts src/components/DatabaseToolsDialogs.tsx src-tauri-shell/src/main.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Live Pending ISIN Mismatch Normalization)
- **New ISIN evidence now cleans up matching review rows immediately**:
  - `src-tauri-shell/src/database/instrument_mutations.rs` now promotes matching `corporate_action_imports` rows from `PENDING_ISIN_MISMATCH` to `PENDING` directly inside `upsert_instrument_isin_history_evidence(...)`.
  - That shared evidence-write path is already used by approved official imports, manual corporate-action approvals that carry an official ISIN, and the bootstrap backfill, so new evidence now normalizes the review queue immediately instead of waiting for a later reopen.
  - The same promotion also refreshes the review message to the confirmed-evidence wording used elsewhere in the resolver path.
- **Behavior change**:
  - previous behavior: future approvals wrote new `instrument_isin_history` evidence, but matching import rows only normalized on the next bootstrap-time migration or manual recheck/refetch.
  - new behavior: the matching review row becomes plain `PENDING` in the same evidence-write transaction when the exact symbol/date/ISIN combination is confirmed.
- **Backup**: `backups/pre_opencode_changes_20260611_102355_historical-isin-live-reclassify`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml bootstrap -- --nocapture`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml instrument_mutations -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/database/instrument_mutations.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Pending ISIN Mismatch Recheck Migration)
- **Already-stored exact-symbol ISIN mismatches now clean themselves up one time when historical evidence exists**:
  - `src-tauri-shell/src/database/bootstrap.rs` now runs a one-time `migration.pending_isin_mismatch_recheck_v1` pass after the ISIN-history backfill.
  - That pass updates `corporate_action_imports` rows from `PENDING_ISIN_MISMATCH` to `PENDING` when the database now has exact evidence for the same `exchange + symbol + official ISIN + ex-date` in `instrument_isin_history`.
  - The migration also replaces the stale mismatch message with the same “confirmed for this event date” message used by the active resolver path, so the queue explains why the row is now approvable.
- **Behavior change**:
  - previous behavior: older `PENDING_ISIN_MISMATCH` rows stayed in that status until the user re-fetched or manually resolved/rechecked them, even after ISIN history had already been backfilled.
  - new behavior: once the backfilled evidence proves the row, the queued import is normalized to `PENDING` automatically during database preparation.
- **Backup**: `backups/pre_opencode_changes_20260611_100258_historical-isin-reclassify`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml bootstrap -- --nocapture`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/database.rs src-tauri-shell/src/database/bootstrap.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Historical ISIN Backfill Migration)
- **Existing approved history now backfills ISIN evidence one time for older databases**:
  - `src-tauri-shell/src/database/bootstrap.rs` now runs a one-time `instrument_isin_history` backfill behind the new `migration.instrument_isin_history_backfill_v1` settings marker.
  - That backfill seeds the evidence table from both already-approved official import rows (`corporate_action_imports`) and existing canonical approved rows (`corporate_actions`) when they already carry an ISIN plus event date.
  - This keeps the new ISIN-history table useful for older databases immediately, instead of only improving after future approvals.
- **Behavior change**:
  - previous behavior: `instrument_isin_history` only accumulated new evidence from approvals performed after the historical-ISIN slice shipped.
  - new behavior: older databases seed `instrument_isin_history` once from existing approved history at open time, then continue adding evidence from future approvals.
- **Backup**: `backups/pre_opencode_changes_20260611_093749_historical-isin-backfill`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml bootstrap -- --nocapture`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/database.rs src-tauri-shell/src/database/bootstrap.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Historical ISIN Reviewable Official Imports)
- **Exact-symbol official ISIN mismatches are no longer treated as hard unresolved rows**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now downgrades the exact-symbol / different-ISIN case from `UNRESOLVED` to `PENDING_ISIN_MISMATCH` when the symbol match is otherwise clean.
  - That new status stays manually reviewable and approvable through the existing official-import approval flow, instead of forcing a manual remap first.
  - The same resolver now reuses exact event-date ISIN evidence from the new `instrument_isin_history` table, so a later re-fetch of an already-confirmed symbol/date/ISIN combination can return to plain `PENDING`.
- **Approved official imports now write ISIN evidence for future matching**:
  - `src-tauri-shell/src/database/bootstrap.rs` now creates `instrument_isin_history`.
  - `src-tauri-shell/src/database/instrument_mutations.rs` now records point-in-time ISIN evidence during approved price-adjustment actions when the action input carries an official ISIN.
  - `src-tauri-shell/src/database/corporate_action_imports.rs` also writes the approved official-import ISIN evidence row explicitly after approval, anchored to the approved symbol plus event date.
- **Review UI now exposes the new status cleanly**:
  - `src/components/DatabaseToolsDialogs.tsx` now explains `PENDING_ISIN_MISMATCH` in the status tooltip text.
  - `Review Issues` now allows `Approve` directly for approvable review rows such as exact-symbol ISIN mismatches, while keeping `Resolve` only for true `UNRESOLVED` rows.
- **Behavior change**:
  - previous behavior: exact-symbol official rows whose ISIN differed from the current `instruments.isin` snapshot were marked `UNRESOLVED`, even when the symbol match itself was strong.
  - new behavior: those rows stay reviewable as `PENDING_ISIN_MISMATCH`, can be approved manually, and approved rows feed a reusable historical ISIN evidence table for future fetches/rechecks.
- **Backup**: `backups/pre_opencode_changes_20260611_024510_historical-isin-reviewable`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/database/bootstrap.rs src-tauri-shell/src/database/instrument_mutations.rs src-tauri-shell/src/database/corporate_action_imports.rs src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 11, 2026 - Official Imports Approved View)
- **Official Imports now separates the approval queue from already-approved rows**:
  - `src/components/DatabaseToolsDialogs.tsx` now adds an inner `Review Queue` / `Approved` view switch inside `Corporate Actions > Official Imports`.
  - The `Review Queue` view now loads only non-approved rows, keeps manual selection plus `Update Selected`, and still exposes `Resolve` or `Approve` per row where eligible.
  - The new `Approved` view loads only `review_status = APPROVED` rows, hides bulk-selection controls, and shows `approvedAt` in the final column so previously promoted rows can be reviewed without mixing them back into the pending queue.
- **Behavior change**:
  - previous behavior: `Official Imports` mixed approved and non-approved rows in one list, so older approved items stayed interleaved with pending candidates.
  - new behavior: pending work stays in `Review Queue`, while approved rows are browsed separately in `Approved`.
- **Backup**: `backups/pre_opencode_changes_20260611_010102_official-import-approved-tab`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx`: PASS

## Latest Verified State (June 11, 2026 - Official Force Re-fetch Button)
- **Official Imports now uses an explicit request button instead of a sticky checkbox**:
  - `src/components/DatabaseToolsDialogs.tsx` now keeps normal cached fetches on `Fetch Official` and exposes a separate `Force Re-fetch` button for the one request that should bypass saved coverage.
  - No backend contract changed in this follow-up. `forceRefresh` still stays request-scoped on the existing `fetchOfficialCorporateActions` bridge, approvals remain manual, and raw prices remain untouched.
- **Behavior change**:
  - previous behavior: a session-level checkbox armed the next fetch path and could stay visually set until the window state reset.
  - new behavior: the cached path and forced path are separate buttons, so the bypass is explicit for exactly one click and never leaves a lingering armed state in the UI.
- **Backup**: `backups/pre_opencode_changes_20260611_003326_corp-action-force-refetch-button`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `git diff --check -- src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md`: PASS

## Latest Verified State (June 10, 2026 - Official Force Re-fetch Override)
- **Official fetch coverage reuse now has a request-scoped bypass**:
  - `src-tauri-shell/src/database.rs` and `src/types/desktop.ts` now carry an optional `forceRefresh` flag on `CorporateActionOfficialFetchInput`.
  - `src-tauri-shell/src/database/corporate_action_imports.rs` still keeps `corporate_action_fetch_coverage` as the default fetch optimizer, but now allows one request to bypass saved coverage and re-hit the full requested NSE/BSE date window.
  - `src/components/DatabaseToolsDialogs.tsx` originally exposed a session-only `Force re-fetch even if the requested day range is already cached` checkbox in `Official Imports`; this was later replaced on June 11, 2026 by the dedicated `Force Re-fetch` button above.
  - Normal fetch behavior is unchanged: coverage reuse remains the default path, approvals remain manual, and raw prices remain untouched.
- **Behavior change**:
  - previous behavior: once a date window was fully covered, `Fetch Official` would refuse to call the source again for that same covered request.
  - new behavior: the same covered request still reuses saved coverage by default, but the user can explicitly bypass coverage for one fetch when they need to refresh corrected or late-posted official rows.
- **Backup**: `backups/pre_opencode_changes_20260610_211909_corp-action-source-provenance`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml database::corporate_action_imports::tests::force_refresh_uses_requested_range_without_coverage_lookup -- --exact --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS

## Latest Verified State (June 10, 2026 - Official Approval Source Provenance Fix)
- **Approved corporate actions now keep the real official-import source**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` no longer rewrites every approved import row to `OFFICIAL_CSV` when promoting it into the canonical `corporate_actions` table.
  - Approved rows now preserve the source already stored on the import candidate, such as `NSE_API`, `BSE_API`, `NSE_CSV`, or `BSE_CSV`.
  - `source_ref` behavior is unchanged; it still keeps the original source file path when present, or a generated source/import identifier fallback otherwise.
- **Behavior change**:
  - previous behavior: official API rows lost provenance at approval time because they were saved into `corporate_actions` as `OFFICIAL_CSV`.
  - new behavior: canonical approved rows preserve the original import provenance so later audit/debug work can distinguish API fetches from CSV imports.
- **Backup**: `backups/pre_opencode_changes_20260610_211909_corp-action-source-provenance`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml database::corporate_action_imports::tests::approved_corporate_action_source_preserves_import_provenance -- --exact --nocapture`: PASS
  - `git diff --check -- src-tauri-shell/src/database/corporate_action_imports.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS

## Latest Verified State (June 10, 2026 - Dividend Parser Safety Follow-up)
- **Official dividend-purpose parsing is safer for multi-component cash announcements**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` no longer approves a dividend row by blindly taking the first numeric token from the official purpose text.
  - Single-component dividend rows still parse as before when a clear per-share cash amount is present.
  - Explicit segmented announcements such as `Interim Dividend ... & Special Dividend ...` now combine the per-share cash components into one approvable cash amount for later factor derivation at approval time.
  - Ambiguous multi-component dividend text that does not split cleanly into explicit segments now downgrades to `NEEDS_REVIEW` instead of silently guessing the first amount.
- **Behavior change**:
  - previous behavior: any dividend purpose with more than one numeric token could still be marked `PARSED` using the first extracted number only.
  - new behavior: multi-component dividend text is either combined safely when the segments are explicit or held for manual review when the text remains ambiguous.
- **Backup**: `backups/pre_opencode_changes_20260610_201252_corp-action-dividend-parser`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml database::corporate_action_imports::tests::parses_multiple_dividend_cash_components_when_segments_are_explicit -- --exact --nocapture`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml database::corporate_action_imports::tests::marks_ambiguous_multiple_dividend_components_for_review -- --exact --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS

## Latest Verified State (June 10, 2026 - Startup Adjusted-Mode Reopen Fix)
- **A database whose default price mode is `Adjusted` now reopens its visible chart in adjusted mode more reliably**:
  - `src/features/workspace/chartSnapshotHydrationService.ts` now resolves the active database default price mode first, applies that mode to store state, and passes the same resolved mode directly into the first startup tab hydration instead of relying only on ambient store state timing.
  - That same startup hydration now requests a forced fresh backend reload for the first visible tab so a stale raw result cannot survive the reopen path when the database default is already `adjusted`.
  - `src/features/charts/chartInstrumentHydrationService.ts` now accepts an optional `forceReload` flag in the shared hydration payload so this startup path can bypass cache without changing normal chart reload behavior elsewhere.
- **Behavior change**:
  - previous behavior: the restored workspace set `adjustedMode` before the first chart reload, but the first visible tab still depended on the normal ambient hydration path and could reopen raw-looking if startup timing or a stale cached result won the race.
  - new behavior: the first visible tab on database open is hydrated using the resolved database default mode explicitly, with a forced fresh read for that startup pass.
- **Backup**: `backups/pre_opencode_changes_20260610_173041_startup-adjusted-mode-fix`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS

## Latest Verified State (June 10, 2026 - Menu Restructuring Phase 3)
- **Settings shortcuts now stay lightweight while Help exposes real keyboard guidance**:
  - `src-tauri-shell/src/main.rs` now adds section-focused `Settings` menu entry points for `General Preferences...`, `Application Profile Folder...`, `Active Database Defaults...`, and `Chart Colors...`, plus `Help > Keyboard Shortcuts`.
  - `src/store/uiStore.ts` now tracks an optional requested settings section and a dedicated keyboard-shortcuts dialog open state so the existing dialog stack can reuse the normal floating-window path.
  - `src/features/app/menuCommandRouter.ts` now routes the section payloads into the existing settings dialog instead of introducing native-menu-owned copies of those controls.
  - `src/components/SettingsDialog.tsx` now scrolls the existing settings window to the requested section when a section-focused menu entry is used.
  - `src/components/KeyboardShortcutsDialog.tsx` plus `src/RootApp.tsx` now provide a dedicated help window for the currently implemented command-palette and chart-canvas shortcuts only.
- **Behavior change**:
  - previous behavior: `Settings` exposed only one generic entry point and `Help` had no dedicated keyboard-shortcuts reference.
  - new behavior: native `Settings` can jump directly into the relevant section of the same dialog, and `Help` now includes a focused keyboard-shortcuts window.
- **Backup**: `backups/pre_opencode_changes_20260610_152338_menu_phase3`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/store/uiStore.ts src/features/app/menuCommandRouter.ts src/components/SettingsDialog.tsx src/components/KeyboardShortcutsDialog.tsx src/RootApp.tsx src-tauri-shell/src/main.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md MENU_RESTRUCTURING_PHASE_PLAN_EOD_CHARTING_PLATFORM.md`: PASS

## Latest Verified State (June 10, 2026 - Adjusted Default Price Mode Follow-up)
- **Price mode now reopens as the last live choice, with `Adjusted` as the seeded default**:
  - `src/features/workspace/databaseSettingsService.ts` now falls back to `adjusted` when the database setting is missing, while still preserving an explicit saved `raw` value.
  - `src-tauri-shell/src/database/bootstrap.rs` now seeds new databases with `default_price_mode = adjusted` instead of `raw`.
  - `src/features/charts/chartTabSessionController.ts` now writes live `Chart > Price Mode` changes back into the active database default in the background, so reopening the same database follows the last live mode the user chose.
  - `src/components/SettingsDialog.tsx` now explains that the active database default is both the startup price mode and the default that live session price-mode changes keep updated for the next reopen.
- **Behavior change**:
  - previous behavior: startup always followed the stored database default, and live price-mode changes did not update that stored default.
  - new behavior: startup still follows the stored database default, but live price-mode changes now persist back into that same database default automatically.
- **Backup**: `backups/pre_opencode_changes_20260610_144804_adjusted_default_price_mode`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/features/workspace/databaseSettingsService.ts src/features/charts/chartTabSessionController.ts src/components/SettingsDialog.tsx src-tauri-shell/src/database/bootstrap.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md`: PASS

## Latest Verified State (June 10, 2026 - Menu State Sync Follow-up)
- **Nested native submenu items now resync correctly**:
  - `src-tauri-shell/src/main.rs` now searches native menu items recursively through nested submenus before calling `set_checked`, replacing the earlier `Menu::get(id)` lookup that only handled top-level menu items.
  - This specifically fixes the broken toolbar-to-menu checked-state sync for nested items like `Timeframe`, `Chart Type`, `Adjustments`, `Layout Mode`, and `Magnet`.
  - `Chart > Adjustments` remains a session-level inclusion toggle surface only. Its checked state does not mean the current symbol already has dividend or rights adjustments stored in the database.
- **Backup**: `backups/pre_opencode_changes_20260610_134747_menu_state_sync_fix`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/main.rs`: PASS

## Latest Verified State (June 10, 2026 - Menu Restructuring Phase 4)
- **Native menu checked state now follows the real chart and view state**:
  - `src-tauri-shell/src/main.rs` now uses checkable native menu items for timeframe, chart type, price mode, layout mode, sidebar / OHLCV / status visibility, and magnet, and adds a `sync_menu_state` Tauri command so the renderer can correct native checked state after any relevant state change.
  - `src/platform/types.ts` and `src/platform/shell.ts` now define a native menu-state payload plus shell bridge method, keeping the renderer-to-shell contract inside `src/platform/*`.
  - `src/features/workspace/chartRuntimeController.ts` now subscribes to active chart-session state and UI visibility state, pushes native menu state during init and after relevant changes, and forces a post-dispatch resync after routed native menu commands so already-selected check items cannot stay visually unchecked after a no-op click.
  - `src/store/chartStore.ts` now passes the Zustand subscription into the runtime controller, and `src/features/app/menuCommandRouter.ts` accepts the optional post-dispatch sync callback without changing the existing command-routing semantics.
- **Remaining note**:
  - This pass was validated by compile/test checks, but manual runtime verification is still recommended for native checked-state behavior across toolbar, settings popover, and native menu interactions.
- **Backup**: `backups/pre_opencode_changes_20260610_120629_menu_state_sync`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `npm run typecheck:renderer`: PASS
  - `cargo check --manifest-path src-tauri-shell/Cargo.toml --message-format short`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src/platform/types.ts src/platform/shell.ts src/features/app/menuCommandRouter.ts src/features/workspace/chartRuntimeController.ts src/store/chartStore.ts src-tauri-shell/src/main.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md MENU_RESTRUCTURING_PHASE_PLAN_EOD_CHARTING_PLATFORM.md`: PASS

## Latest Verified State (June 10, 2026 - Menu Label Polish)
- **Native menu wording is tighter without changing behavior**:
  - `src-tauri-shell/src/main.rs` now shortens several Phase 1 and Phase 2 labels: `Save Active Database`, `Indicators`, `Dividend Adjustments`, `Rights Adjustments`, `Lock / Unlock Drawing`, `Sidebar`, `OHLCV Bar`, and `Status Bar`.
  - No command ids, router behavior, or chart/session behavior changed in this pass; this is label-only cleanup on the native menu shell.
  - The built-in fullscreen item is intentionally unchanged, so it still uses Tauri's default fullscreen wording.
- **Backup**: `backups/pre_opencode_changes_20260610_032032_menu_label_polish`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/main.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md MENU_RESTRUCTURING_PHASE_PLAN_EOD_CHARTING_PLATFORM.md`: PASS

## Latest Verified State (June 10, 2026 - Menu Restructuring Phase 2)
- **Native menu now exposes existing chart type and adjusted-data inclusion controls**:
  - `src-tauri-shell/src/main.rs` now adds a native `Chart Type` submenu for `Candles`, `Line`, `Area`, `Bar (OHLC)`, `Baseline`, `HLC Area`, `Heikin Ashi`, and `Renko`, plus a native `Chart > Adjustments` submenu for dividend and rights inclusion.
  - `src/features/app/menuCommandRouter.ts` now declares `setChartType` on the minimal menu router handle and routes `menu:setChartType`, `menu:toggleDividendAdjustments`, and `menu:toggleRightsAdjustments` into the existing chart store actions instead of introducing any new desktop bridge.
  - The real adjusted-data reload behavior is intentionally unchanged in this pass: the existing chart session controller still handles rehydration when dividend/right inclusion changes while adjusted mode is active.
  - Native checked state for the dividend/right inclusion menu items is not yet synchronized when those same toggles are changed from the chart settings popover. Broader native menu state sync remains deferred to a later phase.
- **Backup**: `backups/pre_opencode_changes_20260610_021955_menu_phase2_impl`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/main.rs src/features/app/menuCommandRouter.ts MENU_RESTRUCTURING_PHASE_PLAN_EOD_CHARTING_PLATFORM.md README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md`: PASS

## Latest Verified State (June 10, 2026 - Menu Restructuring Phase 1)
- **Native menu structure is cleaner without changing core flows**:
  - `src-tauri-shell/src/main.rs` now promotes `Settings` to a top-level menu, splits drawing tools/actions into a top-level `Draw` menu, groups quote/merge/corporate/parity tools under `Database > Data Tools`, adds `Quarterly` and `Yearly` to the native timeframe submenu, and adds `View > Layout Mode` for the layout-mode payloads that were already supported in the store/router.
  - No renderer behavior was redesigned in this pass. Existing dialogs and actions still route through the same command bridge; this is a native-menu taxonomy cleanup plus exposure of already-supported `Q/Y` and layout-mode commands.
  - `MENU_RESTRUCTURING_PHASE_PLAN_EOD_CHARTING_PLATFORM.md` was aligned so Phase 1 now matches the implemented scope, and the remaining Phase 2 work is limited to chart-type and adjustment shortcuts.
- **Backup**: `backups/pre_opencode_changes_20260610_020328_menu_phase1_impl`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/main.rs MENU_RESTRUCTURING_PHASE_PLAN_EOD_CHARTING_PLATFORM.md README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md`: PASS

## Latest Verified State (June 10, 2026 - Corporate Action Official Re-fetch Coverage)
- **Official re-fetch now reuses saved coverage before calling the source again**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now records successful official NSE/BSE fetch date windows in a dedicated `corporate_action_fetch_coverage` table, computes uncovered date gaps per request, and fetches only those missing windows instead of blindly redownloading the full requested range.
  - The same backend file still stores fetched rows in `corporate_action_imports`, still dedupes by `dedupe_key`, and still keeps approval manual; the change is only in how official-source date coverage is reused.
  - `src/components/DatabaseToolsDialogs.tsx` now reports cached day reuse versus newly fetched missing days after `Fetch Official`, so the status line reflects whether the request actually hit the source.
  - `src-tauri-shell/src/database/bootstrap.rs` plus `docs/database-schema.md` now define the `corporate_action_fetch_coverage` table and index.
- **Backup**: `backups/pre_opencode_changes_20260610_011017_corp_action_gap_fetch`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `npm run typecheck:renderer`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `cargo check --manifest-path src-tauri-shell/Cargo.toml --message-format short`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS

## Latest Verified State (June 10, 2026 - Database Default Price Mode)
- **Each database can now choose its own startup price mode**:
  - `src/features/workspace/databaseSettingsService.ts` now wraps the database-scoped `default_price_mode` setting through the existing `getSetting` / `setSetting` bridge and normalizes it to `raw` or `adjusted`.
  - `src/components/SettingsDialog.tsx` now adds an `Active Database Defaults` section with a `Default Price Mode` selector. It is disabled when no database is open, and saving it does not override the current live chart session immediately.
  - `src/features/workspace/chartSnapshotHydrationService.ts` now reads that setting whenever a database open/activate flow applies a snapshot, so the restored workspace hydrates using the database default before chart data loads.
  - `src-tauri-shell/src/database/bootstrap.rs` now seeds new databases with `default_price_mode = raw`.
- **Behavior split remains intentional**:
  - `Chart > Price Mode` still changes the current session immediately.
  - the database default is applied when that database is opened again.
- **Backup**: `backups/pre_opencode_changes_20260610_003901_db-default-price-mode`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS

## Latest Verified State (June 9, 2026 - App Profile Settings + Recent Database Storage)
- **App-level settings and recent-database history are no longer tied to the rebuildable portable folder**:
  - `src-tauri-shell/src/app_profile.rs` now owns the application-profile storage model. By default it stores app-level settings and the recent-database registry under `Documents\EOD Chart Profile`, exposes a folder-picker command for the Settings dialog, and keeps a small profile-location pointer so portable and installed builds can reuse the same profile folder.
  - `src-tauri-shell/src/database/connection_registry.rs` now reads and writes the recent-database registry through that application profile, while still migrating older registry files from the runtime `state/` folder when needed.
  - `src/features/app/appSettingsService.ts` and `src/components/SettingsDialog.tsx` now treat theme/default-exchange/chart-color settings as app-profile data instead of database-table settings, and the Settings dialog now shows the current profile folder with `Browse...` and `Use Default` controls.
  - `src/components/AboutDialog.tsx` plus `src-tauri-shell/src/main.rs` now expose the active application profile path in Help > About so the user can confirm where app-level state is being read from.
  - Database-scoped settings are intentionally unchanged in this pass: workspace layout and other `get_setting` / `set_setting` database values still remain in the active database.
- **Backup**: `backups/pre_opencode_changes_20260609_234505_app-profile-settings`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo check --manifest-path src-tauri-shell/Cargo.toml --message-format short`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS

## Latest Verified State (June 9, 2026 - Corporate Action Live Chart Refresh)
- **Approving or saving a corporate action now refreshes the active chart more predictably**:
  - `src/components/DatabaseToolsDialogs.tsx` now matches reload requests against both the resolved active chart symbol and the originally requested symbol, so live refresh still works when identity history or merged symbol chains are involved.
  - The same dialog now reloads charts with `preserveViewport` during quote saves, merge-symbol operations, manual corporate-action saves, NSE identity apply/import refreshes, and official-import approvals, so the user does not need to close the window, reopen the database, or restart the app to see the latest state.
  - Approval/save status text now explains the most common "nothing changed" case: if the chart is still in `Raw` mode, the chart did refresh, but split/bonus adjustments will only change visible prices after switching to `Chart > Price Mode > Adjusted`. Dividend and rights approvals now also warn when their optional adjusted-mode toggles are still off.
- **Backup**: `backups/pre_opencode_changes_20260609_222149_corp-action-live-refresh`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS

## Latest Verified State (June 9, 2026 - Corporate Action Resolve + Search + Progress)
- **Official corporate-action review is easier to work through without auto-apply**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now emits live `corporate-actions:progress` updates during official NSE/BSE fetch, sorts official-import loads by newest ex-date, adds server-side symbol/company/ISIN filtering for official imports and scan results, and improves NSE matching with exact-ISIN plus identity-history fallback before leaving a row unresolved.
  - The same backend file now adds `resolve_corporate_action_import`, which lets unresolved rows be rechecked against the current database or manually mapped to an explicitly selected current symbol while still keeping approval manual.
  - `src/components/DatabaseToolsDialogs.tsx` now adds quick search inputs across `Identity Import`, `Official Imports`, `Scan Database`, and `Review Issues`, plus a `Current` shortcut that fills the active chart symbol into those filters.
  - The `Official Imports` tab now shows live fetch progress in percent, labels the numeric column as `Adj Factor`, and opens a resolve panel for `UNRESOLVED` rows so the user can auto-recheck or map them to a selected current symbol before `Approve` / `Update Selected`.
  - `Review Issues` now loads non-approved import rows directly and keeps ready-to-approve `PENDING` rows out of the issue list so the tab focuses on rows that still need resolution or manual review.
- **Backup**: `backups/pre_opencode_changes_20260609_201336_corp-action-resolve-progress-filters`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo check --manifest-path src-tauri-shell/Cargo.toml --message-format short`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS

## Latest Verified State (June 9, 2026 - Chart Event Menu Toggles)
- **Chart event visibility now has native menu control**:
  - `src-tauri-shell/src/main.rs` now adds a `Chart > Events` submenu for split, bonus, dividend, rights issue, symbol-change, and name-change markers.
  - `src/store/chartStore.ts` plus `src/features/app/menuCommandRouter.ts` now treat those menu clicks as session-level chart display toggles, and `src/components/ChartCanvas.tsx` filters event badges before sending them to the chart engine.
  - Result / earnings date markers are still out of scope for the active app because there is no current result-date source, storage, or chart-event feed in the repo.
- **Backup**: `backups/pre_opencode_changes_20260609_182342_chart-event-menu-toggles`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS

## Latest Verified State (June 9, 2026 - Chart Event Axis Placement Polish)
- **Chart event badges now sit at the bottom axis area**:
  - `src/engine/ChartEngine.ts` now positions chart event markers near the bottom of the price pane so corporate-action and identity badges sit just above the date bar instead of near the chart top.
  - `src/engine/Renderer.ts` now renders those badges with a neutral theme surface/border and keeps the existing event letters (`S`, `B`, `D`, `R`, `N`, `T`) instead of using bright filled per-action colors.
  - Hovered event details now render above the date bar near the hovered bar, which keeps the top-left price summary area clear.
- **Backup**: `backups/pre_opencode_changes_20260609_175913_chart-event-axis-marker-polish`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS

## Latest Verified State (June 9, 2026 - Corporate Action Filters + Optional Dividend/Rights Adjustments)
- **Corporate-action review stays manual, but coverage is broader**:
  - `src/components/DatabaseToolsDialogs.tsx` now adds manual multi-select action-type filters (`SPLIT`, `BONUS`, `RIGHTS`, `DIVIDEND`) to the Official Imports and Review Issues lists. Nothing auto-loads, nothing auto-approves, and `Update Selected` is still the only approval path.
  - Manual entry now also supports `DIVIDEND` and `RIGHTS` actions in addition to split/bonus. Dividend rows require a cash amount per share; rights rows require both the ratio and the issue/subscription price.
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now treats parseable dividend and rights official rows as approvable review candidates instead of hard review-only rows. Their final adjustment factors are still derived only at approval time from the local database, not guessed at import time.
- **Adjusted chart mode now supports optional dividend/right inclusion**:
  - `src-tauri-shell/src/database/instrument_mutations.rs` now saves approved dividend and rights actions into the canonical `corporate_actions` table, adding `cash_amount` plus derived-factor logic:
    - dividend factor uses the previous local close before ex-date
    - rights factor uses TERP from previous local close, ratio, and issue price
  - `src-tauri-shell/src/database/eod_data.rs` now loads approved `DIVIDEND` / `RIGHTS` actions alongside split/bonus actions and can apply them only when the corresponding chart toggle is enabled.
  - `src/components/ChartSettingsMenu.tsx`, `src/components/ChartCanvas.tsx`, and the chart hydration/store seams now expose `Include dividend adjustments` and `Include rights adjustments` as Adjusted-mode-only checkboxes. Raw price storage remains untouched.
  - Approved dividend and rights actions now also render chart event markers (`D` / `R`) in the same adjusted-data/event pipeline.
- **Identity import screenshot behavior**:
  - The `Import NSE Identity` status message can show a completed import while the review table still says `No current-universe preview loaded.` That is expected. Importing the archive and previewing current-universe sync are separate manual steps; `Preview Sync` must be clicked explicitly after import.
- **Backup**: `backups/pre_opencode_changes_20260609_114701_corp-action-adjustment-flags`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `cargo check --manifest-path src-tauri-shell/Cargo.toml --message-format short`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/database.rs src-tauri-shell/src/database/bootstrap.rs src-tauri-shell/src/database/eod_data.rs src-tauri-shell/src/database/instrument_mutations.rs src-tauri-shell/src/database/corporate_action_imports.rs src-tauri-shell/src/database/nse_identity_imports.rs src/types/desktop.ts src/engine/types.ts src/engine/Renderer.ts src/store/chartStore.ts src/store/chartStoreTypes.ts src/features/charts/chartTabWorkspaceService.ts src/features/charts/chartInstrumentHydrationService.ts src/features/charts/compareOverlayService.ts src/features/charts/chartInstrumentCompareController.ts src/features/charts/chartTabSessionController.ts src/features/charts/chartSheetWorkspaceService.ts src/features/workspace/chartSnapshotHydrationService.ts src/components/ChartCanvas.tsx src/components/ChartSettingsMenu.tsx src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md docs/database-schema.md`: PASS
  - targeted `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`: attempted, but did not complete within the local timeout window

## Latest Verified State (June 9, 2026 - NSE Current Universe Sync)
- **Manual NSE current-universe reconciliation**:
  - `src-tauri-shell/src/database/nse_identity_imports.rs` now adds `preview_nse_current_universe_sync` and `apply_nse_current_universe_sync` on top of the existing archive-root flow.
  - The sync reads the official current NSE securities master from the raw archive, including supported equity / trade-for-trade / SME series (`EQ`, `BE`, `BZ`, `SM`, `ST`, `SZ`), and compares that universe against `instruments`.
  - `Preview Sync` is review-only and reports which symbols would be inserted/reactivated, metadata-refreshed, or deactivated. `Apply Sync` then upserts current official rows as active and marks missing current-NSE symbols inactive, without deleting history or touching raw `.eod` prices.
  - `src/components/DatabaseToolsDialogs.tsx` now extends the existing `Identity Import` tab with manual `Preview Sync` and `Apply Sync` actions plus a review table. Old/renamed/delisted symbols remain resolvable through identity history and chart loading; they are just hidden from the normal symbol browser after apply.
- **Backup**: `backups/pre_opencode_changes_20260609_020116_nse-current-universe-sync-impl`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `cargo test --manifest-path Cargo.toml nse_identity_imports -- --nocapture`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS
  - `git diff --check -- src-tauri-shell/src/database/nse_identity_imports.rs src-tauri-shell/src/main.rs src/platform/tauriDesktop.ts src/platform/types.ts src/types/desktop.ts src/components/DatabaseToolsDialogs.tsx`: PASS

## Latest Verified State (June 9, 2026 - Corporate Review Manual Load + Symbol Browser Cap Lift)
- **Corporate-actions review loading stays manual**:
  - `src/components/DatabaseToolsDialogs.tsx` now keeps `Review Issues` explicitly manual and adds `Load More` controls for official-import and scan result lists instead of silently stopping at a small first page.
  - Official fetch/import and scan status messaging now explicitly says nothing is approved or applied automatically; split/bonus approval still requires manual row selection plus `Update Selected`.
  - Backend list-result caps for corporate-action imports and scan results were raised from `2,000` to `10,000` in `src-tauri-shell/src/database/corporate_action_imports.rs`.
- **Symbol browser cap lift**:
  - `src/features/charts/chartSymbolSearchService.ts` and `src-tauri-shell/src/database/symbol_search.rs` now lift the symbol-browser load cap from `5,000/10,000` to `50,000`, so the sidebar can load the full current symbol set instead of stopping early while scrolling.
- **Backup**: `backups/pre_opencode_changes_20260609_012543_corp-review-manual-load-fix`
- **Validation**:
  - pending this pass

## Latest Verified State (June 9, 2026 - NSE Identity Archive Import)
- **NSE identity archive import**:
  - Added `src-tauri-shell/src/database/nse_identity_imports.rs` plus the `import_nse_identity_archive` command to import the official NSE identity archive from a raw-root path without replacing the existing manual corporate-action engine.
  - The importer upserts the current NSE EQ securities master into `instruments`, then imports historical symbol changes, name changes, and same-date combined symbol+name changes through the existing canonical identity-history save path in `instrument_mutations.rs`.
  - Symbol-change chains are expanded backward from current NSE EQ symbols and existing NSE symbols already present in the database, so older tickers can be linked before later split/bonus approval work.
  - The importer now accepts the real official NSE `symbolchange.csv` layout even when the file is headerless; it falls back to the documented positional order `company,old,new,date`.
  - `src/components/DatabaseToolsDialogs.tsx` now adds an `Identity Import` tab inside `Corporate Actions / Identity` for the archive-root path and manual trigger. Raw `.eod` prices remain untouched.
- **Backup**:
  - `backups/pre_opencode_changes_20260608_230033_nse-identity-import`
  - `backups/pre_opencode_changes_20260609_003523_nse-identity-headerless-fix`
- **Validation**:
  - `cargo test --manifest-path Cargo.toml loads_headerless_symbol_change_rows -- --nocapture`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS
  - `npm run tauri:check`: PASS

## Latest Verified State (June 8, 2026 - CSV Import Parallel Symbol Pass)
- **CSV import parallel symbol processing**:
  - `src-tauri-shell/src/imports.rs` now processes binary duplicate filtering and binary `.eod` writes as symbol-level worker jobs instead of forcing the whole import to run strictly one symbol at a time.
  - The importer still parses source files serially, but once symbol batches are queued it now parallelizes the expensive binary-storage stage across a small bounded worker pool.
  - Live progress remains stage-aware: duplicate filtering reports `Checking existing binary EOD ...`, then the write stage reports `Writing binary EOD ...` as symbol jobs complete.
  - `src-tauri-shell/src/database/binary_eod.rs` keeps the date-window overlap check and exact full-block skip behavior used by the worker jobs.
- **Backup**: pending for this pass
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `git diff --check -- src-tauri-shell/src/imports.rs src-tauri-shell/src/database/binary_eod.rs`: PASS
  - focused `cargo test` / compile verification was not completed in this pass
  - next verification is the user's manual build plus rerun of the overlapping monthly import benchmark

## Latest Verified State (June 8, 2026 - Recent Databases Dialog)
- **Recent-database reopen/cleanup UI**:
  - Added a new floating `Recent Databases` dialog that uses the existing backend registry (`snapshot.knownDatabases`) to reopen previously used databases without browsing for the folder again.
  - The dialog also exposes a non-destructive `Remove` action for stale registry entries; this is separate from database deletion and does not remove the actual database folder.
  - Wired the feature into the native Database menu, command palette, `uiStore`, and `RootApp` lazy dialog mounting.
  - Added `remove_recent_database` to `src-tauri-shell/src/database/connection_registry.rs` plus the matching desktop bridge contract.
- **Backup**: `backups/pre_opencode_changes_20260608_153952_recent_database`
- **Validation**:
  - pending manual build and runtime verification

## Latest Verified State (June 8, 2026 - Build Metadata + About Dialog)
- **Automatic build metadata stamping**:
  - `package.json` now runs `scripts/generate-build-metadata.cjs` before `tauri:build` and `tauri:bundle:nsis`.
  - The generator validates semantic-version alignment across `package.json`, `src-tauri-shell/Cargo.toml`, and `src-tauri-shell/tauri.conf.json`.
  - It writes `src-tauri-shell/gen/build-info.json` with `version`, `buildNumber`, and `builtAt`.
- **About dialog**:
  - `src-tauri-shell/src/main.rs` now extends `get_app_info` with `buildNumber` and `builtAt`.
  - `src/components/AboutDialog.tsx` replaces the old toast-only Help > About behavior with a floating dialog that shows app version/build metadata, runtime profile, runtime paths, and manual version notes from `src/features/app/appVersionHistory.ts`.
  - `scripts/prepare-tauri-portable.ps1` now copies the same build metadata into the staged portable `README.txt`.
- **Backup**: `backups/pre_opencode_changes_20260608_141703_app-version-build-info`
- **Validation**:
  - `node .\scripts\generate-build-metadata.cjs`: PASS
  - `npm run typecheck:renderer`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `git diff --check -- package.json scripts\generate-build-metadata.cjs scripts\prepare-tauri-portable.ps1 src\components\AboutDialog.tsx src\features\app\appVersionHistory.ts src\features\app\menuCommandRouter.ts src\RootApp.tsx src\store\uiStore.ts src\types\desktop.ts src-tauri-shell\build.rs src-tauri-shell\gen\build-info.json src-tauri-shell\src\main.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md APP_VERSION_BUILD_METADATA_REPORT.md`: PASS
  - compile/build intentionally not run in this pass because the user will validate through the next manual build
  - future version bumps must update `package.json`, `src-tauri-shell/Cargo.toml`, `src-tauri-shell/tauri.conf.json`, and the matching `src/features/app/appVersionHistory.ts` entry together

## Latest Verified State (June 8, 2026 - CSV Import Skip Fast-Path Refinement)
- **Binary overlap skip refinement**:
  - `src-tauri-shell/src/database/binary_eod.rs` now filters incoming duplicate-check ranges by loading only the overlapping existing date span once per symbol and comparing dates against that overlap set, instead of doing one binary-search probe against the file for every incoming row.
  - `src-tauri-shell/src/imports.rs` now tracks symbol/date summary fields from parsed source rows, so full-skip overlap imports still report meaningful `symbolCount`, `dateRange`, and sample-symbol context even when `rowsInserted` is zero.
- **Backup**: `backups/pre_opencode_changes_20260608_144539_importer_skip_fastpath`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml filter_records_against_existing -- --nocapture`: attempted twice, but did not complete within the local timeout window
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml imports -- --nocapture`: attempted twice, but did not complete within the local timeout window
  - the timed-out background `cargo` / `rustc` processes were terminated before leaving the pass
  - next verification is the user's manual rebuild plus rerun of the overlapping monthly import benchmark

## Latest Verified State (June 8, 2026 - CSV Import Batch Progress + Binary Write Aggregation)
- **CSV import progress and batch-write optimization**:
  - `src-tauri-shell/src/imports.rs` now sorts selected import files deterministically before processing so daily `YYYYMMDD` files run in chronological order.
  - Import progress is now phase-aware: parsing emits live row/symbol messages during the file read, then the backend emits a separate binary-write stage with per-symbol progress instead of sitting at `0% Starting import` until completion.
  - Multi-file imports now aggregate binary `.eod` records across the whole selected batch and write them once per symbol after SQLite work completes, instead of repeating one binary append/merge per symbol for every input file.
  - Binary dual-write failures now increment `rowsError` and surface in the result instead of being treated as silent success.
  - Binary-mode `On Duplicate: Skip` now inspects existing binary symbol/date coverage before writing, so overlapping imports skip already-present dates instead of reprocessing the whole overlapping month.
  - `src-tauri-shell/src/database/binary_eod.rs` now provides a binary-search-based `filter_records_against_existing()` helper so overlap checks do not need to load whole `.eod` files just to test date membership.
- **Backup**: `backups/pre_opencode_changes_20260608_103134_importer-batch-progress`
- **Validation**:
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml filter_records_against_existing -- --nocapture`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml imports -- --nocapture`: PASS (2 importer tests, 8 total filtered test run)
  - `git diff --check -- src-tauri-shell\src\imports.rs src-tauri-shell\src\database\binary_eod.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md CSV_IMPORT_BATCH_PROGRESS_OPTIMIZATION_REPORT.md`
  - compile/build intentionally skipped in this pass because the user requested no app build while the running app instance stayed open

## Latest Verified State (May 25, 2026 - Corporate Actions Automatic Fetch + Scanner)
- **Automatic official corporate action fetch**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now adds `fetch_official_corporate_actions` for direct official-source fetches without needing a downloaded CSV first.
  - NSE fetch uses the current NSE corporate-actions JSON endpoint after warming the NSE session; BSE fetch uses the current BSE `DefaultData/w` corporate-actions endpoint after warming the BSE page session.
  - Fetched rows are stored in the existing `corporate_action_imports` review table and still require manual selection plus `Update Selected`; there is still no auto-apply.
  - Split/bonus rows remain the only approvable rows in this slice. Dividend/rights rows are fetched/stored for review, but price adjustment/TERP logic remains inactive.
- **Scanner**:
  - `Scan Official` checks parsed official split/bonus candidates against actual local EOD bars around ex-date.
  - `Blind Scan` scans local `.eod`/SQLite EOD data for split/bonus-like price gaps and writes review-only scan results; it does not approve or mutate anything.
- **Backup**: `backups/pre_opencode_changes_20260525_163528_corporate-actions-auto-fetch`
- **Validation**:
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS (3 files, 68 tests)
  - `npm run tauri:check`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `git diff --check`: PASS

## Latest Verified State (May 25, 2026 - Corporate Actions Backend Bulk Approval)
- **Official import selected-row approval**:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now exposes `approve_corporate_action_imports` so selected official import rows are approved through one backend command.
  - The bulk command deduplicates selected IDs, runs under one database transaction, uses per-row savepoints for recoverable row failures, and still calls the same canonical approved-action save path used by manual split/bonus entry.
  - `src/components/DatabaseToolsDialogs.tsx` lets users tick parsed split/bonus official import rows in the Official Imports tab and applies them with `Update Selected`.
  - Non-parsed, non-split/bonus, already approved, or unresolved rows remain unselectable; dividends and rights remain review-only.
  - Raw EOD `.eod` prices remain untouched.
- **Backup**: `backups/pre_opencode_changes_20260525_114425_corporate-actions-bulk-command`
- **Validation**:
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS (3 files, 68 tests)
  - `npm run tauri:check`: PASS
  - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`: PASS
  - `git diff --check`: PASS

## Latest Verified State (May 25, 2026 - Corporate Actions Official Import)
- **Corporate actions official CSV import**:
  - `src-tauri-shell/src/database/bootstrap.rs` now creates `corporate_action_imports`, `scan_runs`, and `corporate_action_scan_results` while keeping `corporate_actions` as the canonical approved/manual table.
  - `src-tauri-shell/src/database/corporate_action_imports.rs` adds official NSE/BSE CSV import, NSE date parsing (`DD-MMM-YYYY`), BSE date parsing (`DD/MM/YYYY`), split/bonus parsing, duplicate candidate handling, approval into the existing split/bonus engine, and local-bar scan results.
  - `src-tauri-shell/src/database/instrument_mutations.rs` remains the approved-action save path; approval calls the existing canonical logic and raw EOD `.eod` prices remain untouched.
  - `src/components/DatabaseToolsDialogs.tsx` keeps Manual Entry and adds Official Imports, Scan Database, and Review Issues tabs in the Corporate Actions / Identity floating window.
  - Dividends and rights are stored as review-only candidates in this slice; no dividend/rights adjustment or TERP logic is active.
- **Backup**: `backups/pre_opencode_changes_20260525_102155_corporate-actions-import`
- **Validation**:
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports`: PASS
  - `npm run typecheck:renderer`: PASS
  - `npm run tauri:check`: PASS
  - `npm run test`: PASS (3 files, 68 tests)

## Latest Verified State (May 25, 2026 - Crosshair Date Label Theme Polish)
- **Crosshair date label theme polish**:
  - `src/engine/Crosshair.ts` now draws the bottom crosshair date label with the chart axis background and crosshair-colored border instead of filling it with the crosshair color.
  - This removes the strong blue date label block visible in Classic Light while preserving the crosshair line color.
  - Menu bar behavior and labels were not changed.
- **Backup**: `backups/pre_opencode_changes_20260525_005131_theme-crosshair-date-label`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `git diff --check`: PASS

## Latest Verified State (May 24, 2026 - Theme Video Review Polish)
- **Theme polish from portable build video review**:
  - `src/engine/Renderer.ts` now draws indicator-pane title capsules with chart-theme contrast instead of the old fixed dim dark capsule, improving labels such as `STOCH(5,3)`.
  - `src/engine/ChartEngine.ts` now uses theme-aware muted label text for indicator-pane K/D/value legend labels.
  - `src/components/IndicatorPickerDialog.tsx`, `src/components/CompareOverlayDialog.tsx`, and `src/components/SettingsDialog.tsx` now use softer outline/neutral active and primary button surfaces instead of heavy dark-blue filled popup buttons.
  - Native menu bar behavior and labels were not changed.
- **Backup**: `backups/pre_opencode_changes_20260524_235632_theme-video-review-fixes`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `git diff --check`: PASS

## Latest Verified State (May 24, 2026 - Theme Completion Pass)
- **Theme completion pass**:
  - Theme tokens now cover the remaining high-traffic app chrome: chart settings, pane controls, tile headers, command palette, toasts, OHLC bar, window tray, drawing dialogs, custom formula dialog, indicator picker/settings, compare dialog, watchlist dialogs, official watchlist import, CSV import, layout manager, database tools, delete database, FAQ, error boundary, and Bhavcopy source/download windows.
  - The remaining literal colors in `src/components` are limited to shadow/text-shadow effects, semantic fallback colors such as warning yellow, data/indicator defaults, or intentionally fixed chart/tool glyph colors.
  - Terminal Pro Dark remains available but its palette was intentionally not tuned after the user rejected that theme direction.
- **Backup**: `backups/pre_opencode_changes_20260524_225136_theme-completion-pass`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `git diff --check`: PASS
  - Renderer build/package intentionally left for the user after this completion pass.

## Latest Verified State (May 24, 2026 - Theme Hardening Pass 1)
- **Theme hardening from Classic Light manual pass**:
  - `src/components/ChartHeader.tsx` now uses theme tokens for the timeframe control group, removing the dark-theme island visible in Classic Light.
  - `src/components/SheetTabs.tsx` now uses theme tokens for sheet tabs, the new-sheet button, and the sheet rename/delete dialog instead of dark hard-coded tab colors.
  - `src/components/ChartPriceLegendOverlay.tsx` now uses theme-aware legend text, muted text, action button, and up/down semantic tokens so Classic Light chart legend text no longer relies on white/dark-only styling.
  - `src/components/ChartToolDock.tsx` now gives non-active drawing buttons tokenized control surfaces/borders, improving light-theme visibility while preserving existing tool behavior.
  - `src/styles/global.css` adds shared control and chart-legend tokens used by Midnight Slate Pro, AMOLED Black, and Classic Light. Terminal Pro Dark color values were intentionally not tuned in this pass.
- **Backup**: `backups/pre_opencode_changes_20260524_222949_theme-hardening-pass`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)

## Latest Verified State (May 24, 2026 - Theme System Foundation)
- **Multi-theme foundation**:
  - `THEME_IMPLEMENTATION_PLAN_20260524.md` defines the active theme implementation contract before code changes.
  - `src/features/app/themeService.ts` now defines four app theme ids: `midnight-slate-pro` (default), `amoled-black`, `classic-light`, and `terminal-pro-dark`.
  - `src/RootApp.tsx` reads the saved app theme on startup, applies it to the document root through `data-theme`, and stores the active theme in `uiStore`.
  - `src/components/SettingsDialog.tsx` now exposes the four-theme selector. Theme changes preview immediately, Save persists them through existing settings storage, and Cancel/close reverts the preview.
  - `src/components/ChartCanvas.tsx` now passes matching chart theme tokens to `ChartEngine`, so chart background, grid, axes, crosshair, candles, and volume colors switch with the app theme.
  - `src/styles/global.css` now owns theme CSS custom properties for app surfaces, typography, controls, borders, shadows, scrollbars, and the main chart shell.
- **Backup**: `backups/pre_opencode_changes_20260524_210847_theme-system-prechange`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)

## Latest Verified State (May 24, 2026 - Bhavcopy Inline Log Scroll Correction)
- **Bhavcopy downloader log layout correction**:
  - `src/components/BhavcopyDownloadWindow.tsx` is back to a single floating downloader window with a left control column and a right Activity Log panel.
  - The separate `BhavcopyActivityLogWindow` floating window has been removed; opening Bhavcopy now opens/focuses only `bhavcopy-download`.
  - Activity Log filtering, auto-scroll, copy, progress, and run counters remain available in the inline log panel.
  - The log list is the scrollable region; Bhavcopy download/parsing/storage behavior and the shared `bhavcopyStore` log retention are unchanged.
- **Backup**: `backups/pre_opencode_changes_20260524_202159_bhavcopy-inline-log-scroll`
- **Validation**:
  - `npm run typecheck:renderer`: PASS

## Latest Verified State (May 24, 2026 - Scrollbar Sheet Viewport Sync)
- **Chart engine/store viewport alignment on data changes**:
  - `src/components/ChartCanvas.tsx` now keeps a latest viewport ref and reapplies the current store viewport immediately after loading a new `bars` array into `ChartEngine`.
  - This prevents the chart canvas from resetting to `ChartEngine.loadBars()` latest-bar viewport while the React bottom scrollbar/range label still reflects the tab or sheet's stored viewport.
  - Scrollbar drag handling, sheet viewport preservation rules, and chart store viewport mutation actions were not changed.
- **Backup**: `backups/pre_opencode_changes_20260524_165914_scrollbar-sheet-viewport-sync`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)

## Latest Verified State (May 24, 2026 - Scale Menu Bounds And Indicator Padding)
- **Scale menu clipping and indicator pane breathing room**:
  - `src/components/ChartCanvas.tsx` now computes a chart-viewport-aware maximum height for the scale settings menu.
  - `src/components/ChartSettingsMenu.tsx` now applies bounded height with internal vertical scrolling, so the bottom-right scale menu no longer opens clipped off the top of the chart.
  - `src/engine/ChartEngine.ts` now gives indicator panes stronger internal Y-scale padding (`0.12 / 0.12`) and allows built-in fixed ranges such as Stoch/RSI-style `0-100` panes to keep that padding. Manual pane scale overrides remain exact/locked.
- **Backup**: `backups/pre_opencode_changes_20260524_155849_scale-menu-indicator-padding`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)

## Latest Verified State (May 24, 2026 - Horizontal Scrollbar Visual Polish)
- **Bottom chart scrollbar styling**:
  - `src/components/ChartCanvas.tsx` now assigns the native chart scrollbar a scoped `chart-native-scrollbar` class and reduces the bottom scrollbar strip height/background weight.
  - `src/styles/global.css` now styles that scrollbar with a thinner transparent track and subtle thumb/hover colors.
  - Scrollbar drag handling, viewport synchronization, sheet-switch behavior, zoom/reset controls, and chart store logic were not changed.
- **Backup**: `backups/pre_opencode_changes_20260524_140148_scrollbar-visual-polish`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)

## Latest Verified State (May 24, 2026 - Hide Auto Scale Badge)
- **Right-scale status badge cleanup**:
  - `src/engine/Renderer.ts` no longer draws the orange `A` axis status badge near the bottom of price and indicator scales.
  - The log-scale `L` badge remains available for log-scale state.
  - Value labels, scale settings, auto-fit/manual-scale behavior, and axis drag behavior were not changed.
- **Backup**: `backups/pre_opencode_changes_20260524_134615_hide-auto-scale-badge`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)

## Latest Verified State (May 24, 2026 - Scale Label Settings Refinements)
- **Scale label/settings refinements**:
  - `src/engine/types.ts` and `src/engine/valueLabelSettings.ts` now include separate scale-label settings for symbol name, previous close, high/low labels, and indicator name labels in addition to the existing last-price/value/no-overlap controls.
  - `src/components/ChartSettingsMenu.tsx` expands the bottom-right scale menu `Labels` section with TradingView-style controls for all scale labels, symbol name, symbol last price, previous close, high/low, indicator names, overlay indicator values, compare values, indicator-pane values, and no-overlap.
  - `src/engine/ChartEngine.ts` renders those added labels on the right scale: symbol name can combine with last price, previous close is labeled when available, visible price-pane high/low can be labeled, and indicator labels can prefix value tags when enabled.
  - New label categories default off where they would add clutter; existing symbol last price, overlay indicator value, compare value, and indicator-pane value defaults are preserved.
- **Backup**: `backups/pre_opencode_changes_20260524_133328_scale-label-settings-refinements`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)
  - `git diff --check -- src/components/ChartSettingsMenu.tsx src/engine/ChartEngine.ts src/engine/types.ts src/engine/valueLabelSettings.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md SCALE_LABEL_SETTINGS_REFINEMENTS_REPORT.md`: PASS
  - `rg -n "[ \t]+$" src/components/ChartSettingsMenu.tsx src/engine/ChartEngine.ts src/engine/types.ts src/engine/valueLabelSettings.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md SCALE_LABEL_SETTINGS_REFINEMENTS_REPORT.md`: PASS (no trailing whitespace matches)

## Latest Verified State (May 24, 2026 - Indicator Pane Padding And Controls Visibility)
- **Indicator-pane plot breathing room and controls reveal**:
  - `src/engine/ChartEngine.ts` now uses `0.10 / 0.10` internal Y-scale padding for indicator panes instead of the previous `0.06 / 0.06`, so pane indicators such as Stoch have more room away from the pane borders.
  - `src/components/ChartPaneControlsOverlay.tsx` now keeps pane action controls at `opacity: 0` by default and reveals them to full opacity on hover or keyboard focus within the control cluster.
  - Pane height, in-plot indicator legend placement, and the existing pane controls/actions were otherwise preserved.
- **Backup**: `backups/pre_opencode_changes_20260524_132632_indicator-pane-padding-controls-hover`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)

## Latest Verified State (May 24, 2026 - NSE Index Historical API)
- **NSE Index full-history source**:
  - `src-tauri-shell/src/bhavcopy.rs` now routes default `NSE Index` downloads through NSE's official Historical Index Data endpoint (`/api/historicalOR/indicesHistory`) when no custom NSE index URL override is configured.
  - Multi-year user-selected ranges are split internally into inclusive 365-day-or-less chunks, so the UI can keep one selected range while the backend satisfies NSE's date-window limit.
  - First-slice coverage is intentionally limited to canonical `NIFTY` and `BANKNIFTY`: `NIFTY 50`, `S&P CNX NIFTY`, and `CNX NIFTY` map to `NIFTY`; `NIFTY BANK`, `BANK NIFTY`, and `CNX BANK` map to `BANKNIFTY`.
  - Close-only old NIFTY rows with zero open/high/low are skipped instead of being written as artificial OHLC candles.
  - API rows continue through existing SQLite/binary EOD storage and write per-date `download_log` entries for update-mode detection.
- **Backup**: `backups/pre_opencode_changes_20260524_124610_nse-index-history-api`
- **Validation**:
  - `cargo check --manifest-path src-tauri-shell/Cargo.toml`: PASS
  - `cargo test --manifest-path src-tauri-shell/Cargo.toml -- --nocapture`: PASS (`27` tests, run with isolated `TEMP`/`TMP` to avoid stale global temp `.eod` test artifacts)

## Latest Verified State (May 24, 2026 - Future TV Chart UI Notes)
- **Documentation-only future implementation note**:
  - `FUTURE_TV_CHART_UI_IMPLEMENTATION_NOTES_20260524.md` records the TradingView chart UI reference links and the current chart UI baseline.
  - Future implementation items captured: indicator-pane internal Y-scale padding, horizontal scrollbar visual polish, and scale label menu refinement.
  - The note explicitly keeps legend overlays inside the plot, preserves full-pane grid/crosshair continuity, and treats scale-label visibility separately from legend/status-line behavior.
- **Backup**: `backups/pre_opencode_changes_20260524_012818_future-tv-chart-ui-notes`
- **Validation**:
  - `git diff --check -- PROJECT_STATE_EOD_CHARTING_PLATFORM.md FUTURE_TV_CHART_UI_IMPLEMENTATION_NOTES_20260524.md`: PASS
  - `rg -n "[ \t]+$" PROJECT_STATE_EOD_CHARTING_PLATFORM.md FUTURE_TV_CHART_UI_IMPLEMENTATION_NOTES_20260524.md`: PASS (no trailing whitespace matches)

## Latest Verified State (May 24, 2026 - Price Legend Gap And Vertical Overlay Labels)
- **Price legend in-plot spacing and overlay label layout**:
  - `src/engine/ChartEngine.ts` now applies `PRICE_LEGEND_IN_PLOT_CLEARANCE` through price-scale top padding when the canvas price legend is disabled, so plotted price content gets breathing room while grid/crosshair rendering continues through the full price pane.
  - `src/components/ChartPriceLegendOverlay.tsx` now renders price-pane overlay indicator labels as a vertical one-by-one stack below the main price/OHLC row, restoring the previous vertical reading pattern while keeping the chevron show/hide behavior unchanged.
  - The change keeps the price legend inside the plot area and does not restore the old full-height outside legend strip.
- **Backups**:
  - `backups/pre_opencode_changes_20260524_002637_price-legend-gap-vertical-indicators`
  - `backups/pre_opencode_changes_20260524_005211_price-legend-gap-grid-continuity`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)
  - `git diff --check -- src/engine/ChartEngine.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md PRICE_LEGEND_GAP_VERTICAL_INDICATORS_REPORT.md`: PASS
  - `rg -n "[ \t]+$" src/components/ChartPriceLegendOverlay.tsx src/engine/ChartEngine.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md PRICE_LEGEND_GAP_VERTICAL_INDICATORS_REPORT.md`: PASS (no trailing whitespace matches)

## Latest Verified State (May 23, 2026 - TradingView-Style Scale Label Settings)
- **Scale settings placement and label controls**:
  - `src/components/ChartCanvas.tsx` now places the scale settings trigger as a compact gear button in the chart's bottom-right scale/x-axis corner instead of a text `Scale` button near the upper-right plot area.
  - The scale settings menu can open upward/left from that bottom-right scale trigger, while right-clicking the active price scale still opens the same settings surface at the pointer location.
  - `src/components/ChartSettingsMenu.tsx` now includes a dedicated `Labels` section with separate controls for all value labels, symbol last price label, overlay indicator value labels, compare value labels, indicator-pane value labels, and no-overlap label layout.
  - `src/engine/ChartEngine.ts` now applies those individual label settings when building/drawing price-pane and indicator-pane right-scale value tags.
  - `src/engine/valueLabelSettings.ts`, `src/store/chartStoreTypes.ts`, `src/store/chartStore.ts`, and workspace persistence services now preserve the new label-settings object while keeping legacy `showValueLabels` restore behavior for older saved sheets.
- **Backup**: `backups/pre_opencode_changes_20260523_203113_scale-label-settings-tv-style`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)
  - `git diff --check -- src/components/ChartCanvas.tsx src/components/ChartSettingsMenu.tsx src/engine/ChartEngine.ts src/engine/Renderer.ts src/engine/types.ts src/engine/valueLabelSettings.ts src/features/charts/chartSheetWorkspaceService.ts src/features/charts/chartTabStateMutationService.ts src/features/charts/chartTabWorkspaceService.ts src/features/workspace/workspacePersistence.ts src/store/chartStore.ts src/store/chartStoreTypes.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md SCALE_LABEL_SETTINGS_TV_STYLE_REPORT.md`: PASS
  - `rg -n "[ \t]+$" src/components/ChartCanvas.tsx src/components/ChartSettingsMenu.tsx src/engine/ChartEngine.ts src/engine/Renderer.ts src/engine/types.ts src/engine/valueLabelSettings.ts src/features/charts/chartSheetWorkspaceService.ts src/features/charts/chartTabStateMutationService.ts src/features/charts/chartTabWorkspaceService.ts src/features/workspace/workspacePersistence.ts src/store/chartStore.ts src/store/chartStoreTypes.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md SCALE_LABEL_SETTINGS_TV_STYLE_REPORT.md`: PASS (no trailing whitespace matches)

## Latest Verified State (May 23, 2026 - Compact Indicator Label Consistency)
- **TradingView-style compact indicator labels**:
  - `src/indicators/catalog.ts` now exposes `getCompactIndicatorDisplayLabel()` as the shared compact label helper for function-style labels such as `SMA(20)`, `EMA(21)`, `WMA(20)`, and `MACD(12,26,9)`.
  - `src/components/Toolbar.tsx` now uses the same compact labels in the top Studies chips, so the chip row no longer shows the old spaced format like `SMA (20)`.
  - `src/engine/Indicators.ts` now uses compact indicator titles for renderable overlays and separate indicator panes, so canvas pane legends inherit the same label contract.
  - `src/components/ChartPaneControlsOverlay.tsx` now uses compact labels for pane resize/settings/show-hide/remove accessibility and tooltip text.
  - `src/components/ChartPriceLegendOverlay.tsx` now delegates its existing compact price-pane overlay labels to the shared catalog helper.
- **Backup**: `backups/pre_opencode_changes_20260523_200733_compact-indicator-labels`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing CJS API deprecation and large-chunk warnings)
  - `git diff --check -- src/indicators/catalog.ts src/engine/Indicators.ts src/components/Toolbar.tsx src/components/ChartPaneControlsOverlay.tsx src/components/ChartPriceLegendOverlay.tsx PROJECT_STATE_EOD_CHARTING_PLATFORM.md COMPACT_INDICATOR_LABEL_CONSISTENCY_REPORT.md`: PASS
  - `rg -n "[ \t]+$" src/indicators/catalog.ts src/engine/Indicators.ts src/components/Toolbar.tsx src/components/ChartPaneControlsOverlay.tsx src/components/ChartPriceLegendOverlay.tsx PROJECT_STATE_EOD_CHARTING_PLATFORM.md COMPACT_INDICATOR_LABEL_CONSISTENCY_REPORT.md`: PASS (no trailing whitespace matches)

## Latest Verified State (May 23, 2026 - Scrollbar Drag Viewport Sync Fix)
- **Horizontal scrollbar regression fix**:
  - `src/components/ChartCanvas.tsx` now tracks the native-scrollbar programmatic sync timer in a ref and always clears `syncingNativeScrollbarRef` when no programmatic sync is active, preventing user drag events from being swallowed after React rerenders.
  - The viewport-to-engine effect now depends on `viewport.startIndex` and `viewport.endIndex` instead of only the viewport object reference, preserving the older hardening strategy documented in the scrollbar sync audit.
  - Scrollbar geometry, future-margin math, chart store actions, and engine viewport clamping were left unchanged.
- **Backup**: `backups/pre_opencode_changes_20260523_171321_scrollbar-drag-viewport-sync`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing large-chunk warning for `feature-official-watchlists`)
  - `git diff --check -- src/components/ChartCanvas.tsx PROJECT_STATE_EOD_CHARTING_PLATFORM.md CHART_SCROLLBAR_VIEWPORT_SYNC_REGRESSION_AUDIT.md`: PASS
  - `rg -n "[ \t]+$" src/components/ChartCanvas.tsx PROJECT_STATE_EOD_CHARTING_PLATFORM.md CHART_SCROLLBAR_VIEWPORT_SYNC_REGRESSION_AUDIT.md`: PASS (no trailing whitespace matches)

## Latest Verified State (May 23, 2026 - Indicator Legend In-Plot Phase 3D)
- **Follow-up label restoration**:
  - `src/components/ChartPriceLegendOverlay.tsx` preserves function-style overlay indicator names such as `SMA(20)`, `EMA(21)`, and `WMA(20)` instead of flattening them to `SMA 20` / `EMA 21` / `WMA 20`.
  - The price-pane chevron show/hide behavior is unchanged.
  - **Backup**: `backups/pre_opencode_changes_20260523_163803_restore-indicator-function-labels`
  - **Validation**: `npm run typecheck:renderer`: PASS; `git diff --check -- src/components/ChartPriceLegendOverlay.tsx`: PASS; `rg -n "[ \t]+$" src/components/ChartPriceLegendOverlay.tsx`: PASS (no trailing whitespace matches)
- **TradingView-style indicator-pane legend placement correction**:
  - `src/engine/ChartEngine.ts` now uses a `0` reserved legend height for non-collapsed indicator panes, so indicator plots no longer lose a top header band to the live pane legend.
  - Indicator pane titles and live legend values remain canvas-rendered, but they now overlay the plotted indicator area at the top-left of each pane, matching the same in-pane placement rule used for the price legend.
  - Collapsed indicator pane chrome remains unchanged.
- **Backup**: `backups/pre_opencode_changes_20260523_150331_tv-like-indicator-legend`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing large-chunk warning for `feature-official-watchlists`)
  - `git diff --check -- src/engine/ChartEngine.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md INDICATOR_PANE_LEGEND_IN_PLOT_TV_STYLE_REPORT.md`: PASS
  - `rg -n "[ \t]+$" src/engine/ChartEngine.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md INDICATOR_PANE_LEGEND_IN_PLOT_TV_STYLE_REPORT.md`: PASS (no trailing whitespace matches)

## Latest Verified State (May 23, 2026 - Price Legend In-Plot Phase 3C)
- **TradingView-style price legend placement correction**:
  - `src/engine/ChartEngine.ts` now uses a `0` price-pane legend height when `setCanvasPriceLegendEnabled(false)` is active, so the price plot no longer loses the old reserved top legend band.
  - `src/components/ChartPriceLegendOverlay.tsx` remains the React/HTML price legend surface, but it now sits over the top-left of the actual price plot, matching TradingView-style in-pane placement instead of behaving like a separate strip.
  - The price row stays visible while overlay/compare legend rows can be collapsed or expanded with a compact legend chevron; the existing per-indicator settings, hide/show, and remove actions remain hover-revealed.
  - Separate indicator-pane legends remain canvas-rendered; this slice only changes the main price-pane legend/overlay legend behavior.
- **Backup**: `backups/pre_opencode_changes_20260523_142738_tv-like-price-legend`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run build:renderer`: PASS (Vite emitted the existing large-chunk warning for `feature-official-watchlists`)
  - `git diff --check -- src/engine/ChartEngine.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md PRICE_PANE_LEGEND_IN_PLOT_TV_STYLE_REPORT.md`: PASS
  - `rg -n "[ \t]+$" src/components/ChartPriceLegendOverlay.tsx src/engine/ChartEngine.ts PROJECT_STATE_EOD_CHARTING_PLATFORM.md PRICE_PANE_LEGEND_IN_PLOT_TV_STYLE_REPORT.md`: PASS (no trailing whitespace matches)

## Latest Verified State (May 23, 2026 - Price Pane HTML Legend Phase 3B)
- **TradingView-style price-pane legend slice**:
  - `src/components/ChartPriceLegendOverlay.tsx` now renders the price-pane symbol/OHLC row and price-pane overlay/compare legend rows as a React/HTML overlay above the canvas.
  - Overlay indicator legend rows now expose hover-revealed settings, show/hide, and remove actions using the existing `IndicatorSettingsDialog`, `CustomFormulaDialog`, `updateIndicator`, and `removeIndicator` flows.
  - `src/engine/ChartEngine.ts` now supports disabling only the canvas-rendered price-pane legend, so the new HTML legend does not duplicate the old canvas text.
  - Separate indicator-pane legends remain canvas-rendered in this phase; a future phase can move those pane legends to the same HTML overlay architecture.
- **Backup**: `backups/pre_opencode_changes_20260523_013344_pane_legend_phase3b_price_html_20260523`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS (3 files / 68 tests)
  - `npm run build:renderer`: PASS (Vite emitted the existing large-chunk warning for `feature-official-watchlists`)
  - `git diff --check`: PASS

## Latest Verified State (May 23, 2026 - X-Axis Edge Label Clamp)
- **Chart axis visual fix**:
  - `src/engine/Renderer.ts` now clamps X-axis tick label text inside the chart axis rectangle, so right-edge labels such as `May` do not draw outside the chart border while their tick marks remain at the true date position.
- **Backup**: `backups/pre_opencode_changes_20260523_011531_xaxis_tick_label_clamp_20260523`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS (3 files / 68 tests)
  - `git diff --check`: PASS

## Latest Verified State (May 22, 2026 - Database No-API Feedback Guard)
- **Final review fix**:
  - `src/features/workspace/databaseLifecycleService.ts` now throws a frontend-visible error when database lifecycle actions are invoked without an available desktop API, so the new database-operation status guard does not remain stuck in renderer-only/no-API contexts.
  - `src/components/ChartCanvas.tsx` also dropped the now-unused Magnet shortcut selector left behind after removing the plain `M` keyboard toggle.
- **Backup**: `backups/pre_opencode_changes_20260522_203646_database_no_api_feedback_guard_20260522`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS (3 files / 68 tests)
  - `git diff --check`: PASS

## Latest Verified State (May 22, 2026 - Dormant Chart Feature Truth)
- **Antigravity dormant feature audit**:
  - `src/engine/VolumeProfile.ts` and related renderer hooks exist, but no active UI/store/menu path enables `volumeProfileConfig`.
  - `src/engine/Heatmap.ts` and `ChartEngine.setHeatmapConfig()` exist, but no active UI/store/menu path supplies heatmap cells.
  - `BackgroundZone` / `setBackgroundZones()` exist, but no active UI/store/menu path supplies configurable zones.
  - The current `sessionHighlight` theme value is subtle automatic major-period banding in the vertical-grid renderer, not configurable market-session highlighting.
  - `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md` and `FILE_INVENTORY.md` now mark these as dormant/internal helpers rather than user-facing complete features.
- **Backup**: `backups/pre_opencode_changes_20260522_200534_dormant_chart_feature_truth_20260522`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS (3 files / 68 tests)
  - `git diff --check`: PASS

## Latest Verified State (May 22, 2026 - Hidden Data Conflation Disabled)
- **Data conflation safety gate**:
  - `src/engine/ChartEngine.ts` now defaults `dataConflationEnabled` to `false`, so normal chart rendering uses original bars instead of hidden grouped bars at wide zoom levels.
  - `loadBars()` no longer precomputes conflation levels while the feature is disabled.
  - `src/engine/DataConflation.ts` remains as a dormant helper for a future deliberate performance pass, but it is not active by default.
  - This avoids hidden alignment risk between grouped render bars and normal crosshair, drawing, overlay, and heatmap/index paths.
- **Backup**: `backups/pre_opencode_changes_20260522_195255_disable_hidden_data_conflation_20260522`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS (3 files / 68 tests)
  - `git diff --check`: PASS

## Latest Verified State (May 22, 2026 - Scale Settings Visible Trigger)
- **Scale Settings discoverability restore**:
  - `src/components/ChartCanvas.tsx` again shows a compact `Scale` button in the top-right chart header slot just left of the right price axis.
  - The visible button opens the existing `ChartSettingsMenu` and does not change scale/menu behavior.
  - Existing right-click-on-price-axis access is preserved, including the left-axis context path when the optional left price scale is enabled.
- **Backup**: `backups/pre_opencode_changes_20260522_184104_scale_settings_visible_trigger_20260522`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS (3 files / 68 tests)
  - `git diff --check`: PASS

## Latest Verified State (May 22, 2026 - Magnet Shortcut Cleanup)
- **Magnet activation cleanup**:
  - `src/components/ChartCanvas.tsx` no longer toggles Magnet from the plain `M` key while the chart surface is focused, preventing accidental activation during normal keyboard use.
  - The right-side Magnet tool button and native Chart > Magnet menu route remain active.
  - `src/components/ChartToolDock.tsx` now describes the actual drawing behavior: Magnet snaps drawing points to candle high/low values.
- **Backup**: `backups/pre_opencode_changes_20260522_183256_magnet_shortcut_cleanup_20260522`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS (3 files / 68 tests)
  - `git diff --check`: PASS

## Latest Verified State (May 22, 2026 - Crosshair Visual Cleanup)
- **Crosshair hover-bar cleanup**:
  - `src/engine/Crosshair.ts` no longer paints the Antigravity-added hovered-bar background column. The normal crosshair lines, labels, center marker, magnet behavior, and chart panning behavior remain active.
  - `src/engine/ChartEngine.ts` was updated at the `drawCrosshair` call site to match the simplified crosshair renderer contract.
  - Scale Settings behavior was inspected but intentionally left unchanged; it still opens through the chart price-axis context-menu path.
  - Kinetic scrolling remains enabled.
- **Backup**: `backups/pre_opencode_changes_20260522_180219_remove_crosshair_bar_highlight_20260522`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS (3 files / 68 tests)
  - `git diff --check`: PASS

## Latest Verified State (May 22, 2026 - Database Open Feedback)
- **Open Database UX hardening**:
  - `src/store/chartStore.ts` now sets an immediate database-transition status before create/open/activate/close database operations begin.
  - Duplicate database open/create/close commands are ignored while a database operation is already in progress, with an informational toast instead of launching a second operation.
  - Successful create/open/activate operations now show a database toast when the active database path changes, for example `Database opened: Nse`.
  - Backend/database logic was not changed in this pass; this is a frontend feedback and duplicate-command guard around the existing lifecycle path.
- **Backup**: `backups/pre_opencode_changes_20260522_172151_database_open_feedback_20260522`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS (3 files / 68 tests)

## Latest Verified State (May 22, 2026 - Audit Corrections)
- **Runtime instruction correction**: `AGENTS.md` now matches the checked-out app reality: the active runtime is Tauri, not Electron. Old `src-tauri` remains legacy/disconnected and Electron runtime/packaging must not be reintroduced as the active baseline.
- **Chart type consistency fix**:
  - `src/features/charts/chartTypeTransformService.ts` now preserves every chart type exposed by `src/components/Toolbar.tsx`: `candles`, `line`, `area`, `bar`, `baseline`, `hlcArea`, `heikinAshi`, and `renko`.
  - `src/engine/ChartEngine.ts` now renders `area` through an explicit area branch instead of falling through to candles.
  - `src/features/charts/__tests__/chartTypeTransformService.test.ts` now covers selectable chart-type normalization and unknown-value fallback.
- **Repo-truth documentation correction**:
  - `FILE_INVENTORY.md` now lists the May 21 chart-engine helper files and clarifies that `Patterns.ts` is candlestick-pattern indicator support, not a full scanner.
  - `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md` now separates chart-type rendering status, candlestick pattern indicator status, and the still-not-built scanner window.
  - `SESSION_LOG_20260521_INDICATOR_SETTINGS_PORTAL_FIX.md` now explicitly scopes itself to the one-file `8a4bf49` portal/controls fix and points auditors to the broader `9b39de1` chart-engine checkpoint separately.
- **Backup**: `backups/pre_opencode_changes_20260522_163027_audit_corrections_20260522`
- **Validation**:
  - `npm run typecheck:renderer`: PASS
  - `npm run test`: PASS (3 files / 68 tests)

## Latest Verified State (May 19, 2026 - POP5 FloatingWindow Migration Complete)
- **FloatingWindow Migration (POP5)**:
  - **Commit**: fdb7890
  - **Tag**: pop5e-bhavcopy-floating-window-migration-20260519
  - **Status**: All major utility windows migrated to `FloatingWindow` and manually QA verified.
  - **Migrated Windows**:
    - FAQ (POP3)
    - Settings (POP3B)
    - Quote Editor, Merge Symbols, Corporate Actions, Binary EOD Parity Audit (POP4B)
    - Import CSV (POP5B)
    - Official Watchlist Import (POP5C)
    - Bhavcopy Download Window (POP5E)
  - **Stabilization (POP4B1D)**: Fixed the Quote Editor close blackout and workspace blanking issues by stabilizing the `FloatingWindow` close lifecycle.
  - **Bhavcopy Persistence (POP5D/E)**: Extracted Bhavcopy runtime state into a dedicated store (`bhavcopyStore.ts`), ensuring logs, progress, and run summaries persist across window close/reopen cycles.
  - **Final QA (POP5F)**:
    - `npm run typecheck:renderer`: PASS
    - `npm run tauri:check`: PASS
    - `npm run build`: PASS
    - Manual All-Window QA: PASS (Verified movement, resize, minimize/restore, maximize, focus-on-trigger, and clean close).
    - Workspace Stability: No black screens, no ErrorBoundary fallbacks, and no right-click Refresh required after closing windows.
    - Process Cleanup: Verified `EOD Chart.exe` does not linger in Task Manager after normal application exit.

### Future UI Requirements - Scanner Windows
- **FloatingWindow Foundation**: All future scanner windows (Pattern Scanner, Chart Scanner, etc.) must utilize the `FloatingWindow` foundation to inherit shared move, resize, minimize, maximize, and focus-management behaviors.
- **Resizing & Layout**:
  - **Dimensions**: Use a large default size with sensible minimum width/height constraints.
  - **Grid/Table**: Implement resizable columns for results grids.
  - **Scrolling**: Ensure both horizontal and vertical scrolling are supported for large result sets.
  - **Aesthetics**: Ensure the layout is maximize-friendly and handles fluid scaling.
  - **Persistence**: Preferably persist window size and position across sessions.
- **Scope**: This is a future UI requirement only. No changes to existing scanner logic, pattern detection, or indicator code are included in this phase.

## Latest Verified State (May 16, 2026 - Fresh Binary DB Backend)
- **Binary EOD Phase 4C9B**: Fresh Binary Database Backend Creation Flow.
  - Updated `create_database_interactive` and `create_database_at_internal` to support an optional requested storage mode.
  - Updated `seed_defaults` in `bootstrap.rs` to include `price_storage_mode = hybrid` using `INSERT OR IGNORE` for safety.
  - **Existing Database Safety**: Opening or "creating" a database in a folder that already contains an EOD Chart database preserves the existing storage mode.
  - **Fresh Binary Database**: A brand-new database can now be initialized in `Binary` mode explicitly during creation.
  - **Normal Creation**: Defaults to `Hybrid` mode, preserving legacy dual-write/fallback behavior.
  - Wiring: Updated `DesktopApi` and `tauriDesktop.ts` just enough to support the new backend signature while keeping frontend UI changes for Phase 4C9C.
- **Validation**: Added and passed Rust unit tests in `bootstrap.rs` verifying `seed_defaults` safety. Full test suite (25 tests) passed.

## Latest Verified State (May 16, 2026 - Read-Path Mode Awareness)
- **Binary EOD Phase 4C8**: Chart and Quote Read Path Mode Awareness.
  - Updated `load_unified_price_rows` (chart path) and `list_quotes_internal` (quote list path) to respect `PriceStorageMode`.
  - **Hybrid Mode (Default)**: Preserves current binary-first + SQLite fallback/merge behavior for charts and quote lists.
  - **Binary Mode**: Skips SQLite OHLCV fallback. Charts and quote lists read from Binary `.eod` files only.
  - Returns normal empty/no-data responses if `.eod` files are missing in Binary mode, rather than falling back to SQLite `eod_prices`.
  - System Integrity: DB stats and Parity Audit paths remain unchanged in this phase. SQLite remains for all metadata.
- **Validation**: Added and passed Rust unit tests in `eod_data.rs` and `quotes.rs` verifying mode-aware read behavior. Full test suite (23 tests) passed.

## Latest Verified State (May 16, 2026 - Skip SQLite OHLCV Pass)
- **Binary EOD Phase 4C6**: Skip SQLite OHLCV Writes.
  - Updated `bhavcopy.rs` and `imports.rs` to conditionally skip `eod_prices` writes when in `Binary` mode.
  - **Binary Mode**: Skips SQLite OHLCV inserts/updates but continues to write Binary `.eod` files and metadata (`instruments`, `download_log`).
  - **Hybrid Mode (Default)**: Preserves full dual-write behavior (SQLite + Binary).
  - Verified that `rows_inserted` and `max_volume` reporting remains accurate in both modes.
- **Validation**: Added and passed Rust unit tests in `bhavcopy.rs` and `imports.rs` verifying SQLite skip behavior in Binary mode. Full test suite (19 tests) passed.

## Latest Verified State (May 16, 2026 - Bhavcopy State Checks Pass)
- **Binary EOD Phase 4C5**: Storage Mode State Checks.
  - Updated `bhavcopy.rs` to respect `PriceStorageMode` for state-check operations.
  - Added storage-mode aware wrapper helpers: `storage_mode_has_imported_rows_for_date`, `storage_mode_get_latest_imported_trade_date`, etc.
  - **Hybrid Mode (Default)**: Continues to use `eod_prices` for imported date and stale-row checks.
  - **Binary Mode**: Uses `download_log` metadata for coverage checks, allowing `eod_prices` to be bypassed for state tracking.
  - Behavior preserved: Actual OHLCV writes still target both SQLite and Binary; read fallbacks remain active.
- **Validation**: Added and passed Rust unit tests in `bhavcopy.rs` (3 tests) covering mode-selection and metadata-based stale-row detection. `npm run typecheck:renderer`, `npm run test`, and `cargo check` passed.

## Latest Verified State (May 16, 2026 - Storage Mode Foundation)
- **Binary EOD Phase 4C4**: Storage Mode Flag.
  - Introduced `PriceStorageMode` enum (Hybrid, Binary) in the Rust backend (`src-tauri-shell/src/database/storage_mode.rs`).
  - Added helpers to read/write `price_storage_mode` from the SQLite `settings` table.
  - Default mode is `Hybrid` (dual-write/fallback); invalid/missing values safely resolve to `Hybrid`.
  - Foundation only: No behavioral changes to writes, reads, or UI were introduced in this phase.
- **Validation**: Rust unit tests for `PriceStorageMode` passed (4 tests); `npm run typecheck:renderer` and `npm run test` passed; `cargo check` passed.

## Latest Verified State (May 15, 2026 - Bhavcopy Metadata Pass)
- **Binary EOD Phase 4C3**: Bhavcopy Metadata Coverage.
  - Added `max_volume` column to `download_log` table in SQLite schema.
  - Updated Bhavcopy import flow to compute and store `max_volume` per file.
  - Added metadata-based helper functions in `bhavcopy.rs` (`metadata_has_imported_rows_for_date`, etc.) to allow status checks without querying `eod_prices`.
  - Foundation laid for future binary-only storage mode; default hybrid behavior (SQLite fallback) remains active and unchanged.
- **Validation**: `cargo test` (10 tests) passed; `npm run tauri:check` passed with expected dead-code warnings for future helpers.

## Latest Verified State (May 15, 2026 - Binary Parity Audit Pass)
- **Binary EOD Phase 4B1 & 4B2**: Read-only Binary Parity Audit.
  - Added backend parity validation (`validate_binary_parity`) checking SQLite against Binary `.eod` files.
  - Parity checks: `BINARY_MISSING`, `COUNT_MISMATCH`, `DATE_RANGE_MISMATCH`, `FILE_CORRUPT`.
  - Added frontend Parity Audit UI (`src/components/BinaryEodParityDialog.tsx`).
  - UI supports Global, Exchange, and Symbol scopes with summary counts and issue detail rendering (first 500 issues).
  - Diagnostic-only scope: No repair, rebuild, sync, or data mutation logic was added.
  - Export: Supports "Copy JSON Report" for full audit details.
- **Validation**: `cargo check`, `npm run typecheck:renderer`, `npm run test` (66 tests) passed; `cargo fmt` applied.

## Latest Verified State (May 15, 2026 - Binary Quote Editor Pass)
- **Binary EOD Phase 4A2**: Unified Quote Editor List.
  - Quote Editor list backend now aggregates binary `.eod` data plus SQLite fallback.
  - Binary rows take priority by date; SQLite rows fill missing dates or act as fallback.
  - Performance: Quote listing uses optimized latest-N binary reads instead of loading full-history files into memory.
  - System Integrity: Existing Quote Editor API response shape is preserved; no frontend or chart visual changes were made.
  - Data Integrity: Edit/delete dual-write behavior remains unchanged; full-history storage support is preserved (no date caps).
- **Validation**: `cargo check`, `npm run typecheck:renderer`, `npm run test` (66 tests) passed; `cargo fmt` applied.

## Latest Verified State (May 15, 2026 - Binary DB Stats Pass)
- **Binary EOD Phase 4A1**: Unified database statistics.
  - DB stats now aggregate binary `.eod` files plus SQLite fallback.
  - Binary-backed symbols prefer binary count and date range for accuracy.
  - SQLite stats are used as fallback for symbols without valid binary data.
  - Hardened fallback: Empty, corrupt, or unreadable binary files do not suppress SQLite fallback.
  - Total database size calculation now includes SQLite file size plus all valid binary `.eod` file sizes.
  - Full-history support remains preserved; no date caps or row limits were introduced.
  - System integrity: No frontend or chart visual changes were made; chart loading remains binary-first.
- **Validation**: `cargo check`, `npm run typecheck:renderer`, `npm run test` (66 tests) passed; build verified.

## Latest Verified State (May 14, 2026 - Binary Parity Pass)
- **Binary EOD Phase 3B1**: Added status inspection and manual quote parity.
  - New `get_binary_eod_status` command for health checks.
  - Manual quote edits (upsert/delete) now dual-write to binary `.eod` files.
- **Binary EOD Phase 3B2**: Added symbol merge parity.
  - `merge_symbols` now physically merges binary data between `.eod` files.
  - Respects `overwrite_duplicates` and `delete_source_after_merge` flags.
  - Renames remain virtual, leveraging the identity history resolver in `eod_data.rs`.
- **Validation**: All 9 backend tests passing; build and typecheck verified.

## Latest Verified State (May 14, 2026 - Binary Dual-Write Pass)
- **Binary EOD Phase 3A**: Integrated dual-writing into the import pipeline.
  - Bhavcopy downloads and CSV imports now write to both SQLite and `.eod` files.
  - `open_interest` support added to SQLite schema and dual-write logic.
  - Robust error reporting for binary storage failures without compromising SQLite data integrity.
  - Removed premature `is_binary` tracking column; SQLite fallback remains the primary source.

## Latest Verified State (May 13, 2026 - Binary Integration Pass)
- **Binary EOD Migration**: Implemented `migrate_to_binary_eod` command to move price history from SQLite to `.eod` files.
- **Binary EOD Integration**: `get_eod_data` now prioritizes binary files for price retrieval, bypassing large SQL table scans.
- **Database Optimization**: Added missing index on `instruments(isin)` to resolve full table scans identified in performance audits.

## Latest Verified State (May 13, 2026 - Binary Foundation Pass)
- **Binary EOD Foundation**: Implemented isolated binary storage (`.eod`) for OHLCV data.
  - Compact 64-byte fixed-size records (Date, Flags, OHLC, Prev Close, Vol, OI).
  - Explicit Little-Endian encoding with `i64` scaled prices (precision 0.0001).
  - $O(\log N)$ date-range reads via binary search directly on the file.
  - Atomic write safety using `.tmp` swap pattern.
  - Technical specification documented in `docs/binary-eod-database.md`.

## Latest Verified State (May 11, 2026 - Performance Pass)
- **High-Performance Engine**: All core indicators refactored to $O(N)$ sliding window algorithms. Infinite layout recursion resolved via deferred event emission.
- **Scale Optimization**: Implemented jumping index loops for extreme zoom responsiveness.
- **Workspace Stability**: Sheet transitions now preserve scroll position; store serialization is throttled and optimized.
- **Architecture**: Refined the separation between synchronous rendering and asynchronous state hydration to prevent UI thread lockup.

## Active Feature Status
- **TA-Lib Implementation**: 25+ indicators live, now running with linear complexity.
- **Premium UX**: Momentum scrolling and adaptive scaling verified stable.
- **Sheets/Layouts**: Fully persistent and viewport-aware.

## Superseded Historical Note
- As of April 4, 2026, Electron is no longer part of the active runtime path.
- Older entries below may mention Electron as historical migration context. Those references are superseded by the Tauri-only retirement pass recorded in `TAURI_ONLY_ELECTRON_RETIREMENT_REPORT.md`.
- Historical report/prompt references below now resolve under `docs/archive/`, even when older entries mention only a filename or the former root placement.

## Latest Verified Update
- On May 15, 2026, completed the "Binary EOD Parity Audit" pass (Phase 4B1 & 4B2), providing deep read-only validation between SQLite and Binary storage:
  - **Phase 4B1 (Backend)**: implemented `validate_binary_parity` command in `src-tauri-shell/src/database/binary_eod.rs`; identifies `BINARY_MISSING`, `COUNT_MISMATCH`, `DATE_RANGE_MISMATCH`, and `FILE_CORRUPT` issues.
  - **Phase 4B2 (Frontend)**: added `src/components/BinaryEodParityDialog.tsx` and wired into Database Tools; provides Global, Exchange, and Symbol-level audit controls with summary statistics.
  - **UI Hardening**: limited detailed issue rendering to the first 500 items for UI performance; provided "Copy JSON Report" for full audit analysis.
  - **Diagnostic Scope**: confirmed diagnostic-only implementation; no repair, rebuild, or data mutation behavior introduced.
  - validation passed: `cargo check`, `npm run typecheck:renderer`, `npm run test` (66 tests).
  - report: `SESSION_LOG_20260515_3_PHASE4B2_UI.md`
- On May 11, 2026, completed the "Premium Charting & TA-Lib Integration" pass, transforming the application into a professional-grade analytical tool:
  - **Implemented Global Settings UI**: added `src/features/app/appSettingsService.ts` and `src/components/SettingsDialog.tsx`; users can now customize theme, default exchange, and chart colors (Candle, Grid, Crosshair) via File > Settings.
  - **Comprehensive TA-Lib Expansion**: added 25+ high-value indicators including Ichimoku Cloud, KAMA, HMA, ALMA, Ultimate Oscillator, TRIX, APO, PPO, DPO, and a full suite of Price Transforms; all math implemented locally in `src/engine/Indicators.ts` with full parameter support.
  - **Candlestick Pattern Engine**: added `src/engine/Patterns.ts` and integrated a "Pattern Scanner" indicator capable of detecting 13 major reversal/continuation patterns (Hammer, Doji, Engulfing, etc.) with on-chart visual markers.
  - **Premium Chart Interactivity**:
    - implemented **Momentum (Kinetic) Scrolling** for smooth chart panning.
    - added **Interactive X-Axis Drag Scaling** on the date bar.
    - implemented **Adaptive Precision & Date Formatting**; price labels and time axis now intelligently adjust based on zoom level.
    - added **Crosshair Snap-to-Price (Magnet)** mode for precise data inspection.
    - added interactive **'A' (Auto) and 'L' (Log)** status badges to the Y-axis for direct scale management.
  - **UI/UX Polish**: added hover-to-reveal controls for indicator panes, visibility toggles (Eye icon), and "Ghost Line" feedback during pane resizing.
  - **Visual Audit**: completed a "Crisp Rendering" pass in `Renderer.ts`, ensuring pixel-perfect alignment for all lines and rectangles.
  - validation passed: `npm run typecheck:renderer`, `cargo check`, `npm run test` (66 tests), `npm run tauri:build -- --no-bundle`.
  - report: `SESSION_LOG_20260511.md`
- On May 2, 2026, applied the Claude/Anthropic warm-dark palette redesign across all UI components and restored three files that were truncated in the prior session:
  - updated `src/styles/global.css` so the 9 `:root` CSS custom properties now use the Claude warm-dark palette: `--bg: #141413`, `--bg2: #1a1918`, `--bg3: #1f1e1c`, `--border: #2a2825`, `--border2: #363330`, `--text: #faf9f5`, `--text-dim: #b0aea5`, `--text-mute: #6b6760`, `--accent: #d97757`, `--blue: #6a9bcc`, `--blue-dim: #2d1f18`; also updated focus-ring and placeholder colors from cool-blue to warm-orange
  - replaced all hardcoded cool-blue hex/rgba values across 26 component and feature files: `src/components/Sidebar.tsx`, `src/components/SheetTabs.tsx`, `src/components/TileHeader.tsx`, `src/components/Toolbar.tsx`, `src/components/ChartTabs.tsx`, `src/components/StatusBar.tsx`, `src/components/ChartCanvas.tsx`, `src/components/ChartHeader.tsx`, `src/components/ChartSettingsMenu.tsx`, `src/components/ChartToolDock.tsx`, `src/components/ChartPaneControlsOverlay.tsx`, `src/components/CommandPalette.tsx`, `src/components/BhavcopyDownloadWindow.styles.ts`, `src/components/CompareOverlayDialog.tsx`, `src/components/IndicatorSettingsDialog.tsx`, `src/components/IndicatorPickerDialog.tsx`, `src/components/CustomFormulaDialog.tsx`, `src/components/ChartDrawingPropertiesDialog.tsx`, `src/components/ChartDrawingContextMenu.tsx`, `src/components/DatabaseToolsDialogs.tsx`, `src/components/WatchlistDialogs.tsx`, `src/features/charts/compareOverlayService.ts` (default overlay line color `#5dafff` → `#6a9bcc`), and related dialogs; active/highlight colors now use `rgba(217, 119, 87, ...)` orange instead of `rgba(74–96, 150–185, 221–255, ...)` blue across interactive states, focus rings, and accent borders
  - preserved intentionally: chart semantic colors `--green: #26a69a`, `--red: #ef5350`, individual indicator draw colors in `src/indicators/catalog.ts` (chart series colors, not UI chrome), and BarMagnet icon pole gradients (blue/red semantic)
  - restored `src/components/ChartPaneControlsOverlay.tsx` which was truncated at line 179 — missing pane resize handle and pane action button style constants restored with warm-palette values
  - restored `src/components/ChartToolDock.tsx` which was truncated at line 335 — missing full `function ToolButton(...)` signature, `BASE_DOCK`, `collapseToggleStyle`, `toolButtonStyle`, `moreButtonStyle`, and `barMagnetIconShellStyle` style definitions restored
  - restored `src/components/CommandPalette.tsx` which was truncated at line 264 — missing `itemDescStyle` tail, `noResultsStyle`, `hintStyle`, and `footerStyle` constants restored
  - validation passed: `npm run typecheck:renderer`, `npm run build`, `npm run tauri:portable:win`
- On April 22, 2026, added the first custom formula engine MVP on top of the active indicator pipeline instead of introducing a parallel study subsystem:
  - added `src/modules/formulaEngine/customFormulaEngine.ts` as the controlled parser/evaluator for assignment-based chart formulas; the MVP supports numeric and boolean series, variable assignment, arithmetic/comparison expressions, and the built-in functions `SMA`, `EMA`, `RSI`, `highest`, `lowest`, `ref`, `change`, `crossover`, `crossunder`, `abs`, `min`, and `max`
  - updated `src/engine/types.ts`, `src/engine/Indicators.ts`, `src/store/chartStoreTypes.ts`, `src/store/chartStore.ts`, and `src/features/charts/chartTabStateMutationService.ts` so custom formulas are now a first-class persisted indicator kind (`CUSTOM`) that flows through the existing workspace JSON and render pipeline
  - added `src/components/CustomFormulaDialog.tsx` and updated `src/components/Toolbar.tsx` plus `src/components/ChartPaneControlsOverlay.tsx` so charts now expose a compact formula entry/edit flow without replacing the existing built-in indicator picker/settings path
  - preserved intentionally: custom formulas currently persist inside the existing chart/workspace state only; this pass did not add a separate SQLite `custom_formulas` library table or a standalone formula browser
  - current MVP limitation: numeric assignments render as overlay/pane lines, while boolean assignments are supported for helper logic but are not yet rendered as marker/signal overlays
  - validation passed: `npm run typecheck:renderer`, `npm run build`, `npm run tauri:portable:win`
  - report: `CUSTOM_FORMULA_ENGINE_MVP_REPORT.md`
  - backup: `backups/pre_opencode_changes_20260422_140223_formula_engine_mvp`
- On April 22, 2026, extended the existing chart drawing system with the missing Fibonacci variants instead of rewriting the drawing stack:
  - updated `src/engine/types.ts`, `src/engine/ChartEngine.ts`, and `src/engine/Renderer.ts` so the active drawing model now supports `fibExtension` and `fibFan` in addition to the already-existing `fib` retracement and `gann` fan tools
  - updated `src/components/ChartToolDock.tsx`, `src/components/ChartCanvas.tsx`, and `src/components/ChartDrawingPropertiesDialog.tsx` so the new Fibonacci tools are selectable from the live dock, show correct labels/hints, and reuse the current anchored-drawing properties flow
  - preserved intentionally: drawings still persist through the existing workspace JSON path; this pass did not introduce a new SQLite drawings table or change workspace compatibility
  - validation passed: `npm run typecheck:renderer`, `npm run build`, `npm run tauri:portable:win`
  - report: `DRAWING_FIBONACCI_FOUNDATION_PASS_REPORT.md`
  - current limitation: the built-in drawing stack still does not provide a separate Fibonacci value readout on-chart, and broader advanced-analysis work such as a formula engine or dedicated SQLite drawing storage remains for later passes
  - backup: `backups/pre_opencode_changes_20260422_130840_drawings_fib_pass`
- On April 22, 2026, completed the first chart-type foundation pass without changing database/import/watchlist/sidebar/sheet ownership behavior:
  - added `src/features/charts/chartTypeTransformService.ts` as the new chart-type transform seam for aggregated timeframe bars plus `candles`, `line`, `heikinAshi`, and fixed-brick `renko`
  - updated `src/store/chartStoreTypes.ts`, `src/store/chartStore.ts`, and `src/features/workspace/workspacePersistence.ts` so `chartType` and `renkoBrickSize` are persisted per chart tab
  - updated `src/features/charts/chartInstrumentHydrationService.ts`, `src/features/charts/chartTabStateMutationService.ts`, `src/features/charts/compareOverlayService.ts`, `src/features/charts/chartInstrumentCompareController.ts`, and `src/features/charts/chartSheetWorkspaceService.ts` so hydration, timeframe changes, compare overlay reaggregation, and workspace restore all follow the active chart type
  - updated `src/components/Toolbar.tsx`, `src/components/ChartCanvas.tsx`, `src/RootApp.tsx`, and `src/engine/ChartEngine.ts` so the active chart now exposes a compact chart-type selector, optional Renko brick-size input, line rendering, Heikin Ashi rendering, and Renko rendering
  - intentionally preserved: new sheets still reset to fresh plain-candle sheets instead of cloning the active chart type/layout
  - current limitation: Renko compare overlays are intentionally suppressed in this pass because the active compare normalization path is still date-based
  - validation passed: `npm run typecheck:renderer`, `npm run build`, `npm run tauri:portable:win`
  - report: `CHART_TYPES_FOUNDATION_REPORT.md`
  - backup: `backups/pre_opencode_changes_20260422_110955_chart_types_pass`
- On April 22, 2026, corrected the active chart `Volume` toggle so built-in volume now renders as an overlay inside the main price pane instead of reserving a separate bottom strip:
  - updated `src/engine/ChartEngine.ts` so `computeChartLayout(...)` no longer subtracts `volumeHeight` from the main chart area; indicator panes now start directly below the price pane and the configured volume height is treated as overlay depth inside that price pane
  - updated `src/engine/ChartEngine.ts` render order so `drawVolume(...)` paints inside the price pane before candles/overlays, keeping price action readable while preserving the existing `Volume` toggle behavior
  - updated `src/components/Toolbar.tsx` so the chart toolbar now describes the control as chart volume overlay instead of a separate volume panel
  - important: if older NSE cash history still shows blank volume on the left side of a long stock chart, that is stored data coverage rather than renderer layout; only dates re-imported after the April 21-22 cash-volume fixes will have non-zero stored volume
  - backup: `backups/pre_opencode_changes_20260422_024530_volume_overlay_fix`
- On April 22, 2026, completed the approved lower-priority Bhavcopy maintenance cleanup without changing the active downloader workflow:
  - updated `src-tauri-shell/src/bhavcopy.rs` so NSE holiday data is now grouped by year and resolved through a small helper instead of one monolithic flat list lookup
  - updated `src-tauri-shell/src/bhavcopy.rs` so `warm_session(...)` no longer pays an unconditional 500ms sleep on every base-site warmup; it now only applies a short backoff on request failure
  - updated `src/components/BhavcopyDownloadWindow.tsx` so persisted Bhavcopy setting writes now flow through one helper instead of repeating the same save block across exchange toggles, worker changes, and exclude-series edits
  - added `src/components/BhavcopyDownloadWindow.styles.ts` and updated `src/components/BhavcopyDownloadWindow.tsx` so the downloader window's large static style block now lives in a dedicated file and the component stays focused on state, event handling, and render logic
  - backup: `backups/pre_opencode_changes_20260422_010642_bhavcopy_zero_volume_refresh`
- On April 22, 2026, fixed stale zero-volume NSE cash Bhavcopy dates so already-imported dates with broken historical `volume = 0` rows can be refreshed instead of being skipped forever:
  - updated `src-tauri-shell/src/bhavcopy.rs` so `Update` / `Full History` prefiltering no longer treats imported `NSE` trading dates with all-zero stored volume as healthy completed dates
  - updated `src-tauri-shell/src/bhavcopy.rs` so task execution no longer returns `Already downloaded` for `NSE` dates whose existing rows are present but every stored volume value is still zero; those dates now proceed to re-download and overwrite via the existing `INSERT OR REPLACE` path
  - updated `src/components/BhavcopyDownloadWindow.tsx` so live per-result event handling is idempotent and the final batch array is now used only as a fallback for entries that were not already received through the event stream
  - preserved intentionally: healthy previously imported dates still skip as before, and the stale-date refresh rule is narrowly scoped to `NSE` cash rows with all-zero stored volume
  - backup: `backups/pre_opencode_changes_20260422_010642_bhavcopy_zero_volume_refresh`
- On April 21, 2026, surfaced the built-in chart volume panel in the active renderer so users can toggle a visible volume indicator directly from the chart toolbar:
  - updated `src/components/ChartCanvas.tsx` so the active `ChartEngine` is no longer created with `volumePct: 0`; it now uses a live volume pane allocation and applies the per-tab `showVolume` flag to the engine
  - updated `src/components/Toolbar.tsx` so the active chart toolbar now exposes a `Volume` toggle button wired to the existing `chartStore.setShowVolume(...)` action
  - updated `src/features/charts/chartSheetWorkspaceService.ts` so plain-candle sheet creation/reset now keeps `showVolume: true`, matching the normal chart-tab default instead of silently hiding the volume pane in sheet flows
  - important: this surfaces the volume panel UI, but VWAP and any volume-based study on historical `NSE` cash rows still depend on re-importing Bhavcopy data written before the April 21, 2026 cash-volume header fix
  - backup: `backups/pre_opencode_changes_20260421_194939_volume_indicator_ui`
- On April 21, 2026, fixed active NSE cash Bhavcopy header matching so volume-backed indicators like VWAP can consume real cash-market volume on newly imported data:
  - updated `src-tauri-shell/src/bhavcopy.rs` so the CSV parser now recognizes the live NSE cash volume header `TTL_TRD_QNTY` in addition to older aliases, and the live trades header `NO_OF_TRADES`
  - verified against the official NSE cash file shape at `sec_bhavdata_full_ddmmyyyy.csv`, where the active header row uses `TTL_TRD_QNTY` / `NO_OF_TRADES`
  - important: existing NSE cash rows already stored with `volume = 0` are not rewritten by this code change alone; they need Bhavcopy re-import/update after installing the rebuilt app
  - backup: `backups/pre_opencode_changes_20260421_185251_nse_bhavcopy_volume_header_fix`
- On April 21, 2026, hardened desktop shutdown so closing the main Tauri window exits the app process instead of leaving `EOD Chart.exe` alive in Task Manager:
  - updated `src-tauri-shell/src/main.rs` to handle the main-window `CloseRequested` event explicitly and call app exit
  - preserved intentionally: renderer dialogs remain renderer-local, and this only changes native app-process shutdown behavior
  - backup: `backups/pre_opencode_changes_20260421_182119_window_close_exit_fix`
- On April 21, 2026, removed the same-kind indicator replacement rule so chart tabs can hold multiple instances of the same study:
  - updated `src/features/charts/chartDataUtils.ts` so the add-helper is now `appendIndicator(...)` instead of replacing an existing entry by `indicator.kind`
  - updated `src/features/charts/chartIndicatorPaneService.ts` so add-indicator flows append a new indicator instance and preserve the existing id-based update/remove behavior
  - preserved intentionally: indicator settings edits, pane ordering, pane persistence, and indicator removal still operate by unique indicator id
  - backup: `backups/pre_opencode_changes_20260421_164402_multi_indicator_instances`
- On April 13, 2026, made Bhavcopy calendar skips explicit in the packaged Tauri app so non-trading days are visible in the Activity Log:
  - updated `src-tauri-shell/src/bhavcopy.rs` so batch planning now enumerates the full date span, emits explicit skip results for Saturdays/Sundays across exchanges, and emits explicit skip results for known official NSE / NSE Index holidays instead of silently omitting those dates from the run
  - extended the built-in NSE holiday table to cover the 2023 and 2024 historical ranges used in current backfill validation, while preserving special-trading-day exceptions such as muhurat trading dates
  - updated the batch progress summary in `src-tauri-shell/src/bhavcopy.rs` so the run now reports logged non-trading calendar days instead of only exchange-holiday skips
  - validation passed: `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`, `npm run tauri:check`, `npm run build`
  - backup: `backups/pre_opencode_changes_20260413_002842_bhavcopy_calendar_logs`
- On April 12, 2026, added DB-aware `Update` / `Full History` Bhavcopy flow and smoothed long historical runs in the packaged Tauri app:
  - updated `src-tauri-shell/src/bhavcopy.rs` so batch downloads now accept `range`, `update`, and `fullHistory` modes; `update` resolves from the latest imported date already present in the active SQLite database, `fullHistory` uses built-in exchange baseline dates, and long runs prefilter already imported trading days before scheduling worker tasks
  - replaced the old chunked ordered-join worker model in `src-tauri-shell/src/bhavcopy.rs` with a completion-order worker queue/result channel flow, which removes per-chunk head-of-line blocking and lets progress/results stream as workers finish instead of in chunk order
  - updated `src/components/BhavcopyDownloadWindow.tsx`, `src/types/desktop.ts`, and `src/platform/types.ts` so the Bhavcopy window now exposes `Date Range`, `Update`, and `Full History` modes, hides manual date inputs when the backend is resolving the range automatically, caps retained Activity Log lines to the most recent 2,000 entries, and keeps incremental run-summary counters instead of storing the entire result set in React state during long backfills
  - validation passed: `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`, `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests), `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`, bounded launch of `release/tauri-portable-win/EOD Chart Portable/EOD Chart.exe`
  - backup: `backups/pre_opencode_changes_20260412_225839_bhavcopy_full_history`
- On April 12, 2026, completed a second bhavcopy hardening pass after validating the packaged Tauri downloader against a mixed NSE + NSE Index date range:
  - updated `src-tauri-shell/src/database/bootstrap.rs` so the migration path now adds the missing `download_log.note` column for existing databases
  - updated `src-tauri-shell/src/bhavcopy.rs` so download-log writes are now conflict-safe `UPSERT`s, missing-date archive misses are treated as non-fatal skip results instead of hard failures, and candidate parse failures continue to the next URL instead of aborting on the first bad response
  - added live `bhavcopy:result` emission from `src-tauri-shell/src/bhavcopy.rs` so the renderer can append per-date result lines while the batch is still running
  - updated `src/platform/tauriDesktop.ts`, `src/platform/types.ts`, `src/types/desktop.ts`, and `src/components/BhavcopyDownloadWindow.tsx` so the Bhavcopy window now listens for live per-result events and no longer waits for the batch promise to resolve before showing date-level success/skip/fail lines
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests), `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`, bounded launch of `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`
  - backup: `backups/pre_opencode_changes_20260412_193644_bhavcopy_log_stream_fix`
- On April 12, 2026, hardened the Tauri bhavcopy batch flow after a packaged runtime failure during mixed NSE + NSE Index downloads:
  - updated `src-tauri-shell/src/database/bootstrap.rs` so backend SQLite connections now apply a `busy_timeout`, which reduces avoidable `database is locked` failures when bhavcopy worker threads hit the same active database
  - updated `src-tauri-shell/src/bhavcopy.rs` so a single worker-side backend error now becomes a per-task failed `DownloadResult` instead of aborting the whole batch command
  - updated `src/components/BhavcopyDownloadWindow.tsx` so Tauri string-style invoke rejections are shown verbatim in the Activity Log instead of collapsing into the generic `Unknown error occurred`
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - backup: `backups/pre_opencode_changes_20260412_191322_bhavcopy_batch_error_fix`
- On April 12, 2026, completed the chartStore completion shell pass so `chartStore.ts` is no longer a primary hotspot:
  - added `src/store/chartStoreTypes.ts` for shared store state/tab/toast/progress definitions
  - added `src/features/charts/chartSearchController.ts` for search query and symbol-browser controller wiring
  - added `src/features/charts/chartInstrumentCompareController.ts` for direct instrument-load flow, compare-overlay orchestration, and watchlist-based previous/next navigation
  - added `src/features/watchlists/watchlistStoreController.ts` for watchlist store wiring and snapshot merge updates
  - added `src/features/workspace/chartRuntimeController.ts` for store-side init, snapshot refresh, listener registration, and bhavcopy download refresh orchestration
  - updated `src/store/chartStore.ts` into a thin Zustand shell that composes the extracted controllers/helpers, keeps autosave subscription glue, and exports `getActiveChartTab`
  - reduced `src/store/chartStore.ts` from 1,042 to 498 lines in the current checkout; the new extracted files are `chartStoreTypes.ts` (190), `chartSearchController.ts` (79), `chartInstrumentCompareController.ts` (237), `watchlistStoreController.ts` (171), and `chartRuntimeController.ts` (222)
  - updated `FILE_INVENTORY.md`, `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`, `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md`, and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` so the chartStore completion baseline is the new source of truth
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_145937_chart_store_completion_pass`
- On April 12, 2026, completed the next behavior-preserving `chartStore.ts` split around chart-tab/session orchestration:
  - added `src/features/charts/chartTabSessionController.ts` for layout mode, sheet save/load/delete/rename flows, adjusted-mode retune scheduling, create/activate/close tab orchestration, and layout restore orchestration
  - updated `src/store/chartStore.ts` so those tab/session flows keep the same store API while delegating controller-style session orchestration to the new feature module
  - reduced `src/store/chartStore.ts` from 1,120 to 1,042 lines in the current checkout; the new `src/features/charts/chartTabSessionController.ts` is 166 lines
  - updated `FILE_INVENTORY.md`, `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`, `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md`, and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` so the new seam is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_145241_chart_store_next_orchestration_split`
- On April 12, 2026, completed the next behavior-preserving `chartStore.ts` split around pure chart-tab mutation helpers:
  - added `src/features/charts/chartTabStateMutationService.ts` for pure timeframe/viewport/display-flag helpers, pane height/collapse/scale mutations, indicator mutations, and drawing mutations
  - updated `src/store/chartStore.ts` so chart-tab viewport/display/pane/indicator/drawing actions keep the same store API while delegating the pure tab-state mutation block to the new feature module
  - reduced `src/store/chartStore.ts` from 1,336 to 1,120 lines in the current checkout; the new `src/features/charts/chartTabStateMutationService.ts` is 483 lines
  - updated `FILE_INVENTORY.md`, `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`, `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md`, and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` so the new seam is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_143910_chart_store_viewport_state_split`
- On April 12, 2026, completed the next behavior-preserving Rust backend split inside `src-tauri-shell/src/database.rs`:
  - added `src-tauri-shell/src/database/bootstrap.rs` for connection pragmas, schema migrations, one-time legacy data normalization/backfill guard, default-setting seeding, and DB stats loading
  - updated `src-tauri-shell/src/database.rs` to keep the shared helper/re-export surface while delegating bootstrap/migration/stats coordination to the new `bootstrap` submodule; `connection_registry.rs` continues to use the same parent-level helper names without behavior changes
  - reduced `src-tauri-shell/src/database.rs` from 891 to 550 lines in the current checkout after formatting; the new `src-tauri-shell/src/database/bootstrap.rs` is 346 lines
  - updated `FILE_INVENTORY.md`, `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`, `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md`, and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` so the eighth backend submodule boundary is part of the current handoff baseline
  - validation passed: `cargo fmt`, `cargo check`, `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_143109_database_rs_migration_stats_split`
- On April 12, 2026, completed the next behavior-preserving Rust backend split inside `src-tauri-shell/src/database.rs`:
  - added `src-tauri-shell/src/database/eod_data.rs` for `get_eod_data`, alias-aware instrument resolution, unified EOD price-row selection, corporate-action adjustment, chart-event shaping, and shared instrument lookup helpers
  - updated `src-tauri-shell/src/database.rs` to keep the same Tauri command surface through re-exports while delegating the EOD-resolution/loading command family to the new `eod_data` submodule; `instrument_mutations.rs` continues to use the re-exported instrument-resolution helpers without behavior changes
  - reduced `src-tauri-shell/src/database.rs` from 1,551 to 891 lines in the current checkout after formatting; the new `src-tauri-shell/src/database/eod_data.rs` is 672 lines
  - updated `FILE_INVENTORY.md`, `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`, `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md`, and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` so the seventh backend submodule boundary is part of the current handoff baseline
  - validation passed: `cargo fmt`, `cargo check`, `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_141951_database_rs_eod_loading_split`
- On April 12, 2026, completed the next behavior-preserving Rust backend split inside `src-tauri-shell/src/database.rs`:
  - added `src-tauri-shell/src/database/symbol_search.rs` for symbol list/search Tauri commands, SQL-first search/list queries, alias-aware instrument search entry building, and ranking helpers
  - updated `src-tauri-shell/src/database.rs` to keep the same Tauri command surface through re-exports while delegating the symbol-search command family to the new `symbol_search` submodule
  - reduced `src-tauri-shell/src/database.rs` from 2,033 to 1,551 lines in the current checkout after formatting; the new `src-tauri-shell/src/database/symbol_search.rs` is 497 lines
  - updated `FILE_INVENTORY.md`, `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`, and `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md` so the sixth backend submodule boundary is part of the current handoff baseline
  - validation passed: `cargo fmt`, `cargo check`, `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_140744_database_rs_symbol_search_split`
- On April 12, 2026, completed the next behavior-preserving Rust backend split inside `src-tauri-shell/src/database.rs`:
  - added `src-tauri-shell/src/database/connection_registry.rs` for active-connection cache state, database create/open/activate/close/delete commands, snapshot loading, manifest/registry helpers, and DB-stats cache coordination
  - updated `src-tauri-shell/src/database.rs` to keep the same Tauri command surface through re-exports while delegating the database lifecycle/registry/snapshot command family to the new `connection_registry` submodule; `bhavcopy.rs` and `imports.rs` continue to use the re-exported connection helpers without behavior changes
  - reduced `src-tauri-shell/src/database.rs` from 2,628 to 2,033 lines in the current checkout after formatting; the new `src-tauri-shell/src/database/connection_registry.rs` is 619 lines
  - updated `FILE_INVENTORY.md`, `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`, and `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md` so the fifth backend submodule boundary is part of the current handoff baseline
  - validation passed: `cargo fmt`, `cargo check`, `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_135025_database_rs_followup_split`
- On April 12, 2026, completed the next behavior-preserving Rust backend split inside `src-tauri-shell/src/database.rs`:
  - added `src-tauri-shell/src/database/settings.rs` for layout CRUD commands, generic setting read/write commands, theme loading, and saved-layout serialization helpers
  - updated `src-tauri-shell/src/database.rs` to keep the same Tauri command surface through re-exports while delegating settings/layout logic to the new `settings` submodule; legacy migration flags now reuse the extracted setting helpers
  - reduced `src-tauri-shell/src/database.rs` from 2,801 to 2,628 lines in the current checkout after formatting; the new `src-tauri-shell/src/database/settings.rs` is 132 lines
  - updated `FILE_INVENTORY.md`, `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`, and `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md` so the fourth backend submodule boundary is part of the current handoff baseline
  - validation passed: `cargo fmt`, `cargo check`, `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_131532_database_rs_next_split`
- On April 12, 2026, completed the next behavior-preserving `chartStore.ts` split around snapshot/apply and tab-hydration orchestration:
  - added `src/features/workspace/chartSnapshotHydrationService.ts` to own apply-snapshot orchestration, persisted workspace restore, tab rehydration scheduling, and restore-flag coordination
  - updated `src/store/chartStore.ts` to delegate snapshot/apply and tab-hydration control to the new workspace service while preserving the existing store API and autosave wiring
  - reduced `src/store/chartStore.ts` from 1,515 to 1,336 lines in the current checkout; the new `src/features/workspace/chartSnapshotHydrationService.ts` is 255 lines
  - updated `FILE_INVENTORY.md`, `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`, and `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md` so the new seam is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_014017_chart_store_snapshot_hydration_split`
- On April 12, 2026, corrected active handoff docs after the archive move so future sessions do not follow stale paths or priorities:
  - updated `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` so archived reports/prompts are now referenced under `docs/archive/` instead of as if they still lived at the repo root
  - updated `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md` so the current split status reflects the extracted `menuCommandRouter.ts`, `src/features/charts/*`, `src/features/watchlists/*`, and the backend `database/*` submodules
  - replaced the stale `Store Split Pass 3` priority note with the current guidance: continue shrinking `chartStore.ts` through the smallest safe remaining seam, then take isolated `database.rs` seams only when they are clear
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_012814_handoff_doc_recheck_fix`
- On April 12, 2026, added a scripted backup/retention workflow so backup bloat does not recur:
  - added `scripts/create-project-backup.ps1` as the canonical pre-change backup path using the existing `backups/pre_opencode_changes_<timestamp>_<short_name>` naming style
  - the new backup script excludes bulky/generated folders by default, including `node_modules`, `dist`, `release`, `analysis`, `test-output`, `backups`, `EOD DATABASE`, `src-tauri-shell/target`, and `resources/release`
  - added `scripts/prune-backups.ps1` as a dry-run-first retention helper that preserves the retained compact baseline unless you explicitly change its preserve list
  - updated `AGENTS.md`, `README.md`, `FILE_INVENTORY.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, and `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md` so future sessions use the scripted workflow instead of ad hoc folder copies
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests), `scripts/create-project-backup.ps1` smoke run, `scripts/prune-backups.ps1` dry run
  - backup: `backups/pre_opencode_changes_20260412_011025_backup_workflow_hardening`
- On April 12, 2026, organized root historical documentation into a single archive folder:
  - moved 111 non-live root markdown files into `docs/archive/`
  - kept only live handoff/state/inventory/project docs at the repo root
  - updated `README.md`, `FILE_INVENTORY.md`, and this state file so the archive location is explicit
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_005723_folder_cleanup_artifact_prune`
- On April 12, 2026, completed a workspace cleanup pass focused on non-active runtime/artifact bloat:
  - removed `src-tauri-shell/target/` because it is generated Rust/Tauri build output, not source
  - pruned oversized backup snapshots that had captured generated build output: `backups/pre_opencode_changes_20260408_234909_future_bars_rendering_fix`, `backups/pre_opencode_changes_20260411_140820_chart_store_watchlist_orchestration_split`, and the superseded `backups/pre_opencode_changes_20260412_003530_electron_residue_cleanup_finalize`
  - cleared artifact contents under `analysis/` and `test-output/` while keeping those folders available for future review/test runs
  - removed temporary root screenshots/logs created by prior verification passes
  - root historical markdown reports/prompts were then moved into `docs/archive/` in the follow-up organization pass instead of being deleted
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_005723_folder_cleanup_artifact_prune`
- On April 12, 2026, finalized the Tauri-only Electron residue cleanup:
  - removed the remaining legacy Electron packaging artifacts from `resources/release/`, including `win-unpacked/`, `builder-debug.yml`, and the old installer/unpacked exe outputs
  - removed the stale `dist-electron/` ignore entry from `.gitignore`
  - updated `README.md` and `FILE_INVENTORY.md` so the active repo baseline no longer describes retained Electron packaging output under `resources/release/`
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_003530_electron_residue_cleanup_finalize`
- On April 12, 2026, completed a small Tauri-only cleanup pass to remove the last inactive Electron residue from the active repo baseline:
  - removed `scripts/runtime-smoke-check.js` and `scripts/import-worker-smoke.js` because they still required `electron` and only targeted deleted `dist-electron/*` output
  - updated `tsconfig.json` so the active renderer TypeScript config no longer excludes a non-active `electron` tree
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the active Tauri-only baseline no longer implies any Electron-targeted script/tooling residue in the live path
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260412_000638_electron_residue_cleanup`
- On April 11, 2026, completed the third behavior-preserving Rust backend split inside `src-tauri-shell/src/database.rs`:
  - added `src-tauri-shell/src/database/instrument_mutations.rs` for merge-symbol command handling, corporate-action / identity-history mutation command handling, adjustment-factor helpers, identity-history writes, and related symbol-mutation internals
  - updated `src-tauri-shell/src/database.rs` to keep the same Tauri command surface through re-exports while delegating merge-symbol and corporate-action mutation flows to the new `instrument_mutations` submodule
  - reduced `src-tauri-shell/src/database.rs` from 3,953 to 3,068 lines in the current checkout after formatting; the new `src-tauri-shell/src/database/instrument_mutations.rs` is 898 lines
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the third backend submodule boundary is part of the current handoff baseline
  - validation passed: `cargo fmt`, `cargo check`, `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_234441_database_rs_merge_corporate_module_split`
- On April 11, 2026, completed the second behavior-preserving Rust backend split inside `src-tauri-shell/src/database.rs`:
  - added `src-tauri-shell/src/database/watchlists.rs` for watchlist CRUD command handlers, official watchlist update application, watchlist source-meta normalization/mapping, deduped instrument-key validation, and watchlist snapshot loading
  - updated `src-tauri-shell/src/database.rs` to keep the same Tauri command surface through re-exports while delegating watchlist persistence/update internals and watchlist snapshot hydration helpers to the new `watchlists` submodule
  - reduced `src-tauri-shell/src/database.rs` from 4,337 to 3,953 lines in the current checkout after formatting; the new `src-tauri-shell/src/database/watchlists.rs` is 542 lines
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the second backend submodule boundary is part of the current handoff baseline
  - validation passed: `cargo check`, `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_201016_database_rs_quote_module_split`
- On April 11, 2026, completed the first behavior-preserving Rust backend split inside `src-tauri-shell/src/database.rs`:
  - added `src-tauri-shell/src/database/quotes.rs` for quote list/upsert/delete internals, quote normalization, and `prev_close` recomputation
  - updated `src-tauri-shell/src/database.rs` to keep the same Tauri command surface while delegating quote-editing internals to the new `quotes` submodule; merge-symbol and quote-mutation flows still reuse the same `prev_close` recomputation helper
  - reduced `src-tauri-shell/src/database.rs` from 4,586 to 4,337 lines in the current checkout; the new `src-tauri-shell/src/database/quotes.rs` is 272 lines
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the first backend submodule boundary is part of the current handoff baseline
  - validation passed: `cargo check`, `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_201016_database_rs_quote_module_split`
- On April 11, 2026, completed a targeted renderer bundle-size pass to remove the large Vite production chunk warning without changing app behavior:
  - updated `src/RootApp.tsx` so optional windows/dialogs now load lazily when opened instead of being imported into the startup shell path (`BhavcopyDownloadWindow`, `DeleteDatabaseDialog`, `LayoutManagerDialog`, `WatchlistManagerDialog`, `ImportCsvDialog`, `OfficialWatchlistImportDialog`, and `DatabaseToolsDialogs`)
  - updated `src/features/watchlists/watchlistOrchestrationService.ts` so official watchlist import/update workflows dynamically import `officialWatchlistImportService.ts` on demand instead of startup-linking the packaged official snapshot path through `chartStore.ts`
  - updated `vite.config.ts` to apply stable manual chunk boundaries for `vendor-react`, `vendor-zustand`, `vendor-date-fns`, `feature-shell-ui`, `feature-utility-dialogs`, `feature-chart-runtime`, and `feature-official-watchlists`
  - verified `npm run build:renderer` now completes without the previous `Some chunks are larger than 500 kB after minification` warning; the largest chunk is `feature-official-watchlists` at 451.28 kB and the entry shell chunk is 19.16 kB in the current checkout
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the lazy-loading and chunking strategy are part of the current handoff baseline
  - validation passed: `npm run build:renderer`, `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_172123_bundle_size_targeted_split`
- On April 11, 2026, completed the next behavior-preserving `chartStore.ts` split around indicator pane/layout helpers:
  - added `src/features/charts/chartIndicatorPaneService.ts` for pane-height normalization, pane id derivation, collapsed/scale override pruning, and pane-indicator add/reorder helpers
  - updated `src/store/chartStore.ts` so indicator pane height, collapse, scale override, add/remove, and pane reorder flows keep the same store behavior while delegating pane/layout helpers to the new feature module
  - reduced `src/store/chartStore.ts` from 1,663 to 1,596 lines in the current checkout
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the new seam is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_154028_chart_store_indicator_pane_helpers_split`
- On April 11, 2026, completed the next behavior-preserving `chartStore.ts` split around sheet/workspace state helpers:
  - added `src/features/charts/chartSheetWorkspaceService.ts` for future-margin mode normalization, persisted chart-tab restoration, plain-candle sheet workspace builders, and sheet save/load/delete/rename state builders
  - updated `src/store/chartStore.ts` so sheet save/load/delete/rename actions and persisted workspace restoration keep the same store behavior while delegating sheet/workspace state builders to the new feature module
  - reduced `src/store/chartStore.ts` from 1,840 to 1,663 lines in the current checkout
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the new seam is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_152019_chart_store_sheet_workspace_split`
- On April 11, 2026, completed the next behavior-preserving `chartStore.ts` split around watchlist navigation helpers:
  - added `src/features/watchlists/watchlistNavigationService.ts` for selected-watchlist lookup shared with watchlist UI and watchlist-based previous/next instrument target resolution
  - updated `src/store/chartStore.ts` so `navigateSymbol` keeps the same store behavior while delegating watchlist-based previous/next target selection to the new feature module
  - updated `src/components/Sidebar.tsx` and `src/components/WatchlistManagerDialog.tsx` to import selected-watchlist lookup from the new watchlist navigation helper instead of from `chartStore.ts`
  - reduced `src/store/chartStore.ts` from 1,874 to 1,840 lines in the current checkout
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the new seam is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_151425_watchlist_navigation_service_split`
- On April 11, 2026, completed the next behavior-preserving `chartStore.ts` split around symbol search and symbol-browser helpers:
  - added `src/features/charts/chartSymbolSearchService.ts` for empty search/browser state builders, chart symbol search wrapping, symbol-browser result shaping, and active-database request tagging
  - updated `src/store/chartStore.ts` so `runSearch`, `clearSearch`, and `refreshSymbolBrowser` keep the same store behavior while delegating symbol search/browser helper logic to the new feature module
  - reduced `src/store/chartStore.ts` from 1,888 to 1,874 lines in the current checkout
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the new seam is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_143013_chart_store_symbol_search_split`
- On April 11, 2026, completed the next behavior-preserving `chartStore.ts` split around watchlist orchestration:
  - added `src/features/watchlists/watchlistOrchestrationService.ts` for selected-watchlist resolution, snapshot watchlist merge helpers, CRUD/add-remove refresh workflows, and official watchlist import/update/update-all toast/result shaping
  - updated `src/store/chartStore.ts` so watchlist CRUD, official watchlist import/update/update-all, and add/remove watchlist actions keep the same store API while delegating watchlist orchestration helpers to the new feature module
  - reduced `src/store/chartStore.ts` from 1,976 to 1,888 lines in the current checkout
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the new seam is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_141042_chart_store_watchlist_orchestration_split`
- On April 11, 2026, completed the next behavior-preserving `chartStore.ts` split around instrument loading and hydration helpers:
  - added `src/features/charts/chartInstrumentHydrationService.ts` for EOD cache helpers, instrument load result fetching, compare-overlay hydration wrapping, EOD-to-tab adaptation, and load/hydration failure builders
  - updated `src/store/chartStore.ts` so `loadInstrument` and `hydrateChartTabData` keep the same store behavior while delegating cache-heavy instrument loading and hydration helpers to the new feature module
  - reduced `src/store/chartStore.ts` from 2,016 to 1,845 lines in the current checkout
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the new seam is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_131554_chart_store_tab_workspace_split`
- On April 11, 2026, completed the next behavior-preserving `chartStore.ts` split around chart-tab/workspace state helpers:
  - added `src/features/charts/chartTabWorkspaceService.ts` for blank tab creation, workspace reset, create/activate/close tab state builders, and the activated-tab hydration decision
  - updated `src/store/chartStore.ts` to keep the existing `createChartTab`, `activateChartTab`, and `closeChartTab` store API while delegating the tab/workspace state helpers to the new feature module
  - reduced `src/store/chartStore.ts` from 2,083 to 2,016 lines in the current checkout
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the new seam is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_131554_chart_store_tab_workspace_split`
- On April 11, 2026, completed the third behavior-preserving `ChartCanvas.tsx` UI split:
  - added `src/components/ChartDrawingContextMenu.tsx` as the extracted drawing context menu for chart-side Properties / Lock / Delete actions
  - updated `src/components/ChartCanvas.tsx` to delegate drawing context menu rendering to the new component while preserving the existing engine bridge, pane-controls overlay, drawing-properties dialog, and scrollbar behavior
  - reduced `src/components/ChartCanvas.tsx` from 1,055 to 1,011 lines in the current checkout
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the new component boundary is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_130347_chart_canvas_context_menu_split`
- On April 11, 2026, completed the second behavior-preserving `ChartCanvas.tsx` UI split:
  - added `src/components/ChartPaneControlsOverlay.tsx` as the extracted pane-controls overlay for per-pane resize handles, pane action buttons, and the chart-side indicator settings dialog entrypoint
  - updated `src/components/ChartCanvas.tsx` to delegate pane-controls rendering to the new component while preserving the existing engine bridge, drawing context menu, drawing-properties dialog, and scrollbar behavior
  - reduced `src/components/ChartCanvas.tsx` from 1,183 to 1,055 lines in the current checkout
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the new component boundary is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_124802_chart_canvas_pane_controls_split`
- On April 11, 2026, completed the first behavior-preserving `ChartCanvas.tsx` UI split:
  - added `src/components/ChartDrawingPropertiesDialog.tsx` as the extracted drawing-properties modal for chart drawings
  - updated `src/components/ChartCanvas.tsx` to delegate drawing-properties modal rendering to the new component while preserving the existing engine bridge, pane controls, context menu, and scrollbar behavior
  - reduced `src/components/ChartCanvas.tsx` from 1,469 to 1,183 lines in the current checkout
  - updated `FILE_INVENTORY.md` and `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` so the new component boundary is part of the current handoff baseline
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backup: `backups/pre_opencode_changes_20260411_123807_chart_canvas_drawing_panel_split`
- On April 11, 2026, completed a behavior-preserving compare-overlay store split and tightened root test discovery:
  - added `src/features/charts/compareOverlayService.ts` for compare-overlay instrument equality checks, color selection, cached overlay loading, persisted overlay hydration, and timeframe reaggregation helpers
  - updated `src/store/chartStore.ts` to use the new compare-overlay seam while preserving existing compare-overlay behavior and store-owned orchestration
  - reduced `src/store/chartStore.ts` from 2,330 to 2,083 lines in the current checkout
  - updated `vitest.config.ts` to exclude `analysis/`, `backups/`, `dist/`, `release/`, `resources/release/`, `src-tauri-shell/target/`, `test-output/`, `EOD DATABASE/`, and the nested `EOD Charting Platform/` worktree from test discovery
  - validation passed: `npm run typecheck:renderer`, `npm run test` (2 files, 54 tests)
  - backups: `backups/pre_opencode_changes_20260411_121151_compare_overlay_store_split`, `backups/pre_opencode_changes_20260411_121543_vitest_artifact_exclusion`
- On April 11, 2026, synchronized the operational repo-state docs with the actual folder layout:
  - updated `README.md`, `FILE_INVENTORY.md`, and `RISK_REGISTER.md` so future work can distinguish the active Tauri app path from retained artifacts, live local data, and support folders
  - documented that `EOD DATABASE/` is live local SQLite data kept in the repo and is not part of the source baseline
  - documented that `resources/release/win-unpacked/` is retained legacy packaging output and that `EOD Charting Platform/nice-merkle/` is a linked git worktree under the repo root
  - documented that the April 4 compact backup baseline is still retained, but later work has created additional timestamped backup snapshots under `backups/`
  - no runtime behavior changed in this pass; this was a repo-state and handoff-doc synchronization step only
  - backup: `backups/pre_opencode_changes_20260411_120727_docs_state_sync`
- On April 9, 2026, completed the scale right-axis trigger fix pass:
  - updated `src/components/ChartCanvas.tsx` so the visible `Scale` trigger now lives in the top-right price-scale header region and opens the menu from the right axis instead of the top toolbar
  - updated `src/engine/Renderer.ts` and `src/engine/ChartEngine.ts` so the main price axis again reserves a compact top header band before drawing tick labels, keeping the right-axis trigger separate from the top scale labels
  - updated `src/components/Toolbar.tsx` to remove the temporary top-toolbar `Scale` trigger
  - this supersedes the earlier toolbar placement pass and matches the TradingView-style right-axis menu entrypoint more closely
  - backup: `backups/pre_opencode_changes_20260409_210015_scale_right_axis_trigger_fix`
  - report: `SCALE_RIGHT_AXIS_TRIGGER_FIX_REPORT.md`
- On April 9, 2026, completed the TradingView-style scale toolbar placement fix pass:
  - updated `src/components/Toolbar.tsx` so the visible `Scale` trigger now lives in the top control strip beside the timeframe and indicator controls instead of inside the chart or price-scale gutter
  - updated `src/components/ChartCanvas.tsx` so the visible axis button is removed while the existing right-click-on-price-scale shortcut still opens the same scale settings menu
  - reverted the temporary price-axis top-header reservation in `src/engine/Renderer.ts` and `src/engine/ChartEngine.ts` because the final visible trigger no longer lives inside the axis gutter
  - this supersedes the earlier axis-header placement experiments and matches the TradingView-style top-control placement more closely
  - backup: `backups/pre_opencode_changes_20260409_204231_scale_toolbar_tradingview_fix`
  - report: `SCALE_TOOLBAR_TRADINGVIEW_FIX_REPORT.md`
- On April 9, 2026, completed the TradingView-style scale axis-header fix pass:
  - updated `src/components/ChartCanvas.tsx` so the `Scale` control now sits back inside the top of the measured right price-axis gutter as a compact centered axis-header control instead of floating over the chart area
  - updated `src/engine/Renderer.ts` and `src/engine/ChartEngine.ts` so the main price axis now reserves a top header band before drawing tick labels, preventing the top scale labels from fighting with the new control placement
  - backup: `backups/pre_opencode_changes_20260409_201611_scale_tradingview_axis_header_fix`
  - report: `SCALE_TRADINGVIEW_AXIS_HEADER_FIX_REPORT.md`
- On April 9, 2026, completed the scale header alignment refinement pass:
  - updated `src/components/ChartCanvas.tsx` so the top-right `Scale` button and its popover anchor sit a little farther left of the measured right axis with a slightly wider header-control footprint
  - this keeps the control visually in the blank chart header slot instead of reading like an overlay on the price-scale pane
  - backup: `backups/pre_opencode_changes_20260409_195220_scale_header_alignment_refinement`
  - report: `SCALE_HEADER_ALIGNMENT_REFINEMENT_REPORT.md`
- On April 9, 2026, completed the scale header-slot move pass:
  - updated `src/components/ChartCanvas.tsx` so the `Scale` control and its settings popover anchor now sit in the blank top-right chart header area just left of the measured right price scale
  - this keeps the control out of the price-scale pane itself while preserving the existing right-click-on-axis entrypoint for chart scale settings
  - backup: `backups/pre_opencode_changes_20260409_191757_scale_header_slot_move`
  - report: `SCALE_HEADER_SLOT_MOVE_REPORT.md`
- On April 9, 2026, completed the context-menu suppression and control relayout pass:
  - updated `src/RootApp.tsx` so the native WebView/browser context menu is suppressed through a global window listener and the separate timeframe row is removed
  - updated `src/components/Toolbar.tsx` and `src/components/ChartHeader.tsx` so timeframe controls now live in the single toolbar row below chart tabs
  - updated `src/components/ChartCanvas.tsx` so the `Scale` control now sits inside the blank top header area of the measured right price-scale gutter
  - backup: `backups/pre_opencode_changes_20260409_174434_contextmenu_timeframe_scale_relayout`
  - report: `CONTEXTMENU_TIMEFRAME_SCALE_RELAYOUT_REPORT.md`
- On April 9, 2026, completed the single-row sheets + scrollbar pass:
  - updated `src/components/ChartCanvas.tsx` so the bottom chart strip now accepts inline leading content beside the existing scrollbar controls
  - updated `src/components/SheetTabs.tsx` with an inline strip mode so sheets can live inside the chart bottom strip without their old standalone bar
  - updated `src/RootApp.tsx` so charts no longer render a second row for sheets under the canvas
  - backup: `backups/pre_opencode_changes_20260409_170137_sheets_scrollbar_single_row`
  - report: `SHEET_SCROLLBAR_SINGLE_ROW_REPORT.md`
- On April 9, 2026, completed the native context-menu suppression pass:
  - updated `src/components/ChartCanvas.tsx` so right-clicking the chart pane no longer shows the WebView/browser menu
  - updated `src/components/Sidebar.tsx` so right-clicking the sidebar no longer shows the native browser menu
  - preserved the custom drawing/price-scale context menu behavior in the chart and the watchlist item delete menu in the sidebar
  - backup: `backups/pre_opencode_changes_20260409_163851_native_context_menu_suppression_fix`
  - report: `NATIVE_CONTEXT_MENU_SUPPRESSION_REPORT.md`
- On April 9, 2026, completed the summary crosshair protection pass:
  - updated `src/engine/ChartEngine.ts` and `src/engine/Crosshair.ts` so the chart-top price summary and stacked overlay legend reserve a protected top band
  - crosshair pointer math now clamps below that band and the vertical crosshair line starts below it instead of running through the summary area
  - backup: `backups/pre_opencode_changes_20260409_154820_summary_crosshair_protection_fix`
  - report: `SUMMARY_CROSSHAIR_PROTECTION_REPORT.md`
- On April 9, 2026, completed the price-summary style refinement pass:
  - updated `src/engine/ChartEngine.ts` so the chart-top symbol title and OHLC line now render at the same 14px scale
  - removed the old chart-top live-status circle
  - changed OHLC values and signed change to follow the active candle-direction color while `O / H / L / C` labels now use a neutral theme-aware contrast color
  - backup: `backups/pre_opencode_changes_20260409_152546_price_summary_style_fix`
  - report: `PRICE_SUMMARY_STYLE_REFINEMENT_REPORT.md`
- On April 9, 2026, completed the stacked overlay legend pass:
  - updated `src/engine/ChartEngine.ts` so multiple price-pane overlay studies now render as separate chart-top legend rows instead of one flattened horizontal line
  - kept the TradingView-style price summary line unchanged while adding a little more vertical spacing before the first study row
  - compare overlays in the same chart-top legend area now also render row-by-row
  - backup: `backups/pre_opencode_changes_20260409_145128_stacked_overlay_legend_fix`
  - report: `STACKED_OVERLAY_LEGEND_REPORT.md`
- On April 9, 2026, completed the sidebar indicator panel and axis-tag spacing pass:
  - removed the `Active Chart` indicator chip section from `src/components/Sidebar.tsx`
  - updated `src/engine/Renderer.ts` so the right-axis price label stays as the anchor while study labels stack with clearer spacing
  - updated `src/engine/ChartEngine.ts` to tag price, overlay, compare, and pane-indicator labels by role for the new axis stacking logic
  - backup: `backups/pre_opencode_changes_20260409_143248_sidebar_indicator_axis_tag_cleanup`
  - report: `SIDEBAR_INDICATOR_PANEL_AND_AXIS_TAG_SPACING_REPORT.md`
- On April 9, 2026, completed the new-sheet plain-candle pass:
  - updated `src/store/chartStore.ts` so the sheet `+` action no longer clones the active workspace into a new sheet
  - new sheets now preserve the current symbol/timeframe but reset indicators, compare overlays, drawings, pane overrides, and layout back to a single plain-candle chart
  - updated `src/components/SheetTabs.tsx` copy to describe plain-candle sheet creation
  - backup: `backups/pre_opencode_changes_20260409_141215_new_sheet_plain_chart_fix`
  - report: `NEW_SHEET_PLAIN_CANDLE_REPORT.md`
- On April 9, 2026, completed the chart-top price summary pass:
  - reduced `src/components/ChartHeader.tsx` to a slim timeframe-only strip
  - updated `src/engine/ChartEngine.ts` so the active symbol, timeframe, exchange, OHLC, and signed change now render in a TradingView-style top-left chart summary
  - kept overlay and compare legends below the new chart-top summary instead of leaving symbol/price identity in the header
  - backup: `backups/pre_opencode_changes_20260409_132347_chart_top_price_summary`
  - report: `CHART_TOP_PRICE_SUMMARY_REPORT.md`
- On April 9, 2026, completed the dynamic price-scale width pass:
  - updated `src/engine/ChartEngine.ts` so the right price scale no longer stays pinned to the old fixed width and instead measures visible tick labels plus active value tags
  - added an `axisWidthChange` engine event through `src/engine/types.ts` so `src/components/ChartCanvas.tsx` can use the same measured width for pane chrome and price-scale hit zones
  - the right axis now shrinks and expands based on the current visible labels instead of staying permanently wide
  - backup: `backups/pre_opencode_changes_20260409_121036_dynamic_price_scale_width_fix`
  - report: `DYNAMIC_PRICE_SCALE_WIDTH_REPORT.md`
- On April 9, 2026, completed the sidebar symbol-scroll hardening pass:
  - updated `src/components/Sidebar.tsx` so the Symbols panel now uses a normal native scroll list instead of the old virtualized symbol-list path
  - reserved stable scrollbar gutter space for the symbol list so the right edge stays consistent when the list becomes scrollable
  - wired alphabet clicks to real group-header anchors and forwarded mouse-wheel input from the alphabet rail into the actual symbol-list scroll container, so the rail and the list behave like one scroll region
  - backup: `backups/pre_opencode_changes_20260409_112731_sidebar_symbol_scroll_hardening`
  - report: `SIDEBAR_SYMBOL_SCROLL_HARDENING_REPORT.md`
- On April 9, 2026, completed the chart menu/control cleanup pass:
  - removed the top-toolbar `Magnet`, `Raw`, `Adj`, `Log`, `Vol`, and `Compare` buttons from `src/components/Toolbar.tsx`
  - kept `Magnet` on the right chart tool dock in `src/components/ChartToolDock.tsx` and replaced the old generic symbol with a bar-magnet icon
  - moved `Compare...`, `Magnet`, and explicit `Raw` / `Adjusted` mode actions into the native `Chart` menu in `src-tauri-shell/src/main.rs`
  - moved compare-dialog open state into `src/store/uiStore.ts` and routed menu actions through `src/features/app/menuCommandRouter.ts`
  - removed the old volume row from `src/components/ChartSettingsMenu.tsx`, leaving only the active EOD scale options in that menu
  - backup: `backups/pre_opencode_changes_20260409_023504_chart_control_cleanup_menu_pass`
  - report: `CHART_MENU_CONTROL_CLEANUP_REPORT.md`
- On April 9, 2026, completed the sidebar symbol-index click fix:
  - updated `src/components/Sidebar.tsx` so the symbol alphabet rail no longer changes sections on mouse drag/hover
  - symbol-group jumps now happen only on click, and unavailable letters are disabled
  - aligned the alphabet rail to the symbol list body height and distributed letters vertically so it fits beside the symbol scrollbar area more naturally
  - backup: `backups/pre_opencode_changes_20260409_014628_sidebar_symbol_index_click_fix`
  - report: `SIDEBAR_SYMBOL_INDEX_CLICK_FIX_REPORT.md`
- On April 9, 2026, completed the sidebar empty-state label fix:
  - updated `src/engine/ChartEngine.ts` so the `No chart data loaded` message is centered inside the visible chart viewport instead of being painted at a hardcoded left-edge position
  - the centered placement now respects the reserved right-axis width and bottom x-axis strip, so the empty-state label no longer looks clipped or attached to the sidebar seam
  - backup: `backups/pre_opencode_changes_20260409_011441_sidebar_empty_state_label_fix`
  - report: `SIDEBAR_EMPTY_STATE_LABEL_FIX_REPORT.md`
- On April 9, 2026, completed the sidebar indicator double-click fix:
  - changed the sidebar indicator list in `src/components/Sidebar.tsx` so indicators are added on double-click instead of single-click
  - drag-to-chart behavior remains unchanged
  - updated sidebar indicator hint/tooltip copy to match the new behavior
  - backup: `backups/pre_opencode_changes_20260409_004402_sidebar_indicator_double_click_fix`
  - report: `SIDEBAR_INDICATOR_DOUBLE_CLICK_FIX_REPORT.md`
- On April 9, 2026, completed the overlay legend duplicate-label fix:
  - removed the duplicate DOM overlay study-label block from `src/components/ChartCanvas.tsx`
  - the canvas overlay legend remains the single rendered source for overlay study names and values in the top-left chart area
  - this fixes EMA and other overlay studies looking doubled or blurry because the same label was being painted by both DOM and canvas layers
  - backup: `backups/pre_opencode_changes_20260409_002550_overlay_label_duplicate_fix`
  - report: `OVERLAY_LEGEND_DUPLICATE_LABEL_FIX_REPORT.md`
- On April 8, 2026, completed the future-bars rendering pass:
  - the chart engine already had logical future slots through `futureMarginMode`, but the renderer and crosshair were still treating the area after the last real bar as a dead blank margin
  - `src/engine/ScaleManager.ts` now generates future-aware X-axis ticks and labels across the full logical viewport for `D/W/M/Q/Y`, including synthesized dates for future slots
  - `src/engine/Crosshair.ts` now moves through future slots and shows synthesized future dates instead of snapping the crosshair back onto the last real candle
  - `src/engine/Renderer.ts`, `src/engine/ChartEngine.ts`, and `src/components/ChartCanvas.tsx` now render the right-side margin as chart time rather than dead space
  - backup: `backups/pre_opencode_changes_20260408_235142_future_bars_rendering_fix`
  - report: `FUTURE_BARS_RENDERING_REPORT.md`
- On April 8, 2026, completed the DB-open async command fix:
  - converted the main DB activation/snapshot commands in `src-tauri-shell/src/database.rs` to async command handlers that move blocking DB work onto `tauri::async_runtime::spawn_blocking(...)`
  - `get_app_snapshot`, `get_db_stats`, `create_database_interactive`, `open_database_interactive`, and `activate_database_path` no longer execute their blocking DB work directly on the synchronous command path
  - this complements the DB-open migration fix by reducing native window event-loop blocking even when DB activation still has real work to do
  - backup: `backups/pre_opencode_changes_20260408_233249_db_open_async_command_fix`
  - report: `DB_OPEN_ASYNC_COMMAND_FIX_REPORT.md`
- On April 8, 2026, completed the DB-open migration root fix:
  - identified that `src-tauri-shell/src/database.rs` was still running legacy data migration work on every database open inside `run_migrations()`, including a repeated backfill from `eod_prices` into `instruments`
  - moved those legacy normalization/backfill statements behind a one-time per-database migration marker (`migration.legacy_data_v1`) so open-time DB activation no longer rescans historical price data on every open
  - added backend setting helpers to persist migration completion cleanly inside the active DB settings store
  - backup: `backups/pre_opencode_changes_20260408_233008_db_open_migration_fix`
  - report: `DB_OPEN_MIGRATION_FIX_REPORT.md`
- On April 8, 2026, completed an AmiBroker-style database open flow pass:
  - `chartStore.ts` no longer wipes the current chart workspace immediately during `Open Database`; the lightweight snapshot now activates first while the previous visible chart stays on screen until the restored workspace is ready
  - watchlists now hydrate before DB stats, and DB stats are explicitly deferred out of the critical open path instead of being awaited during the first post-open hydration step
  - the sidebar symbol browser no longer hydrates from `applySnapshot(...)`; it now lazy-loads from `Sidebar.tsx` when the Symbols panel actually needs data
  - `StatusBar.tsx` and `Sidebar.tsx` now expose explicit database-transition/loading states so DB activation reads as "opening" or "loading stats/symbols" instead of looking frozen
  - backup: `backups/pre_opencode_changes_20260408_231250_amibroker_style_db_open_flow`
  - report: `AMIBROKER_STYLE_DATABASE_OPEN_FLOW_REPORT.md`
- On April 8, 2026, completed the viewport/price-scale root fix:
  - replaced the old split axis geometry with a shared stable axis width between `ChartEngine.ts` and `ChartCanvas.tsx`, so zoom/unzoom no longer changes the drawable chart width while the user is interacting
  - removed per-frame price-axis width remeasurement in `ChartEngine.ts`, which was a major source of horizontal chart drift during zoom
  - changed wheel zoom and chart `+/-` zoom to keep the current right edge fixed instead of using cursor/hover anchoring, so zoom-out reveals more history to the left without horizontal chart scroll
  - updated `Renderer.ts` so y-axis labels are clipped to pane bounds and stop at the pane/window edge instead of scratching into the pane below or the x-axis area
  - backups: `backups/pre_opencode_changes_20260408_191048_viewport_scale_root_fix`, `backups/pre_opencode_changes_20260408_194456_zoom_anchor_center_fix`
  - report: `VIEWPORT_SCALE_ROOT_FIX_REPORT.md`
- On April 8, 2026, completed an EOD-only TradingView-style scale settings pass:
  - added a new `Scale` menu in `Toolbar.tsx` through `src/components/ChartSettingsMenu.tsx`, then refined the chart-side entrypoint in `ChartCanvas.tsx` into a right-click interaction on the price-scale zone so the same menu can be opened from the axis area like TradingView while keeping that axis space visually blank
  - the new menu exposes only EOD-relevant working options: auto-fit price pane, fit all panes, regular/log mode, invert price scale, right-axis value labels, and future-bar spacing
  - `chartStore.ts` and `workspacePersistence.ts` now persist `invertPriceScale`, `showValueLabels`, and `futureMarginMode` per chart tab and per sheet
  - `ChartEngine.ts`, `ScaleManager.ts`, `ChartCanvas.tsx`, and `chartDataUtils.ts` now honor those settings so panning, scrollbar movement, zooming, reset, double-click reset, and axis rendering all stay aligned with the selected future-bar space and scale mode
  - backup: `backups/pre_opencode_changes_20260408_160925_chart_settings_menu`
  - report: `CHART_SETTINGS_MENU_REPORT.md`
- On April 8, 2026, completed the right-scroll dead-space fix:
  - tightened the time-scale future/right margin in `ScaleManager.ts` so scroll-to-end states keep only a small fixed future-bar space instead of a large dynamic blank zone
  - aligned the bottom scrollbar end-position with drag/right-button movement through `ChartCanvas.tsx`, so all rightward movement paths now land on the same future-bar space
  - this specifically removes the irritating inconsistency where one path touched the price scale while another path showed the intended future-bar area
  - backup: `backups/pre_opencode_changes_20260408_153534_right_scroll_gap_fix`
  - report: `RIGHT_SCROLL_GAP_FIX_REPORT.md`
- On April 8, 2026, completed the P2 EOD compare overlay pass:
  - added EOD-only compare overlays sourced from the existing local symbol database; compare state now persists per chart tab and per sheet through `compareOverlays`
  - added `src/components/CompareOverlayDialog.tsx` and updated `Toolbar.tsx` so compare overlays can be searched, added, reviewed, and removed without leaving the app shell
  - `ChartEngine.ts` now rebases compare lines from the first visible shared bar, renders them in the main price pane, and exposes compare legend tokens plus right-axis tags showing relative performance instead of introducing a second price-scale model
  - `workspacePersistence.ts` now serializes/restores compare overlay descriptors only; compare data bars remain rehydrated from the local database on demand
  - backup: `backups/pre_opencode_changes_20260408_143938_p2_compare_overlays`
  - report: `P2_COMPARE_OVERLAYS_REPORT.md`
- On April 8, 2026, completed the P2 main price-pane last-value tags pass:
  - the main price pane now renders right-axis last-value tags for the latest price bar and latest overlay-study values, using the existing price scale instead of introducing a second price-axis path
  - the existing dashed EOD last-price marker remains intact; the new tags complement it rather than replacing it
  - axis-width measurement now also considers the latest price-pane tag values so the right axis can expand when needed for longer formatted values
  - backup: `backups/pre_opencode_changes_20260408_142610_p2_price_tags`
  - report: `P2_PRICE_PANE_LAST_VALUE_TAGS_REPORT.md`
- On April 8, 2026, completed the first P2 pane ergonomics pass:
  - indicator panes now support persisted collapse/expand state per chart tab via `collapsedIndicatorPanes`, without destroying the remembered expanded pane heights stored in `indicatorPaneHeights`
  - `ChartCanvas.tsx` now exposes pane-level collapse/expand and fit/autoscale controls directly in pane chrome; fit clears only manual pane scale overrides and leaves fixed-range panes unchanged
  - `ChartEngine.ts` now renders collapsed panes as compact rails, excludes collapsed panes from interactive axis scaling, and keeps pane layout computation aware of collapsed vs expanded pane heights
  - `workspacePersistence.ts` now serializes and restores `collapsedIndicatorPanes` so pane visibility state survives workspace/layout reloads
  - backup: `backups/pre_opencode_changes_20260408_134252_p2_pane_controls`
  - report: `P2_PANE_COLLAPSE_FIT_REPORT.md`
- On April 8, 2026, completed the P1 EOD chart parity upgrade pass:
  - per-pane indicator heights are now persisted per chart tab via `indicatorPaneHeights`, while the legacy single `indicatorPaneHeight` field remains as the default height fallback for older workspaces and newly added panes
  - pane order is now user-adjustable from `ChartCanvas.tsx` with per-pane move-up/move-down controls; pane ordering continues to flow through the existing indicator array instead of introducing a second pane-order model
  - the chart engine now supports price-scale drag/wheel resizing on the right axis for the price pane and non-fixed-range indicator panes, plus axis double-click reset back to autoscale for the active pane
  - `ScaleManager.ts` now treats explicit manual ranges as locked visible ranges and improves EOD X-axis labeling for long daily histories with year/quarter/month boundary emphasis
  - `workspacePersistence.ts` now serializes and restores `indicatorPaneHeights` and `paneScaleOverrides` so pane layout and manual scale state survive workspace/layout reloads
  - backup: `backups/pre_opencode_changes_20260408_130224_p1_parity_upgrade`
  - report: `P1_EOD_PARITY_UPGRADE_REPORT.md`
- On April 8, 2026, completed a searchable indicator dialog pass:
  - added `src/components/IndicatorPickerDialog.tsx` as a grouped searchable modal over `INDICATOR_CATALOG`
  - results are grouped by Trend / Volatility / Momentum / Volume and match on label, short label, description, kind, group, and placement
  - each result shows a compact details pane with placement, description, and default setup
  - keyboard behavior: Enter adds the selected indicator; Escape closes the picker; double-click adds immediately
  - `src/components/Toolbar.tsx` now uses an `Indicators` button instead of the plain add-study dropdown
  - existing `addIndicatorCatalog(...)`, indicator chips, and `IndicatorSettingsDialog` behavior remain unchanged
  - backup: `backups/pre_opencode_changes_20260408_105106_searchable_indicator_dialog`
  - see `SEARCHABLE_INDICATOR_DIALOG_REPORT.md`
- On April 7, 2026, completed the High-Value Chart Features pass:
  - **Supertrend** overlay added: ATR-based trend direction; dual-series rendering (uptrend green / downtrend red); `SUPERTREND` added to `ChartIndicator` union; `calculateSupertrend()` in `Indicators.ts`; period 10 / multiplier 3 defaults; gear settings show Period + Multiplier + Up/Down colors
  - **Log scale toggle** added: compact `Log` button in Toolbar alongside Magnet; `setLogScale()` in ChartEngine + chartStore; `buildScaleY` now accepts optional `logScale` param with proper `Math.log`/`Math.exp` math; price pane only — indicator panes always use linear
  - **Source input selector** added: `IndicatorSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4'` in types.ts; `source?` field on SMA/EMA/WMA/WEMA/DEMA/TEMA/BOLL/RSI/MACD/ROC/MOM; dropdown in `IndicatorSettingsDialog` for those 11 indicators; CCI/WILLR/ATR/MFI/CMF unchanged
  - **Volume toggle** added: compact `Vol` button in Toolbar; `setShowVolume()` in ChartEngine + chartStore; `showVolume: true` default; persisted in workspace via `showVolume?: boolean` in `PersistedChartContent`
  - `logScale` and `showVolume` serialized in `workspacePersistence.ts` with safe defaults on deserialization
  - `SUPERTREND` added to `INDICATOR_CATALOG` in `catalog.ts`; `getIndicatorDisplayLabel` updated
  - `ChartCanvas.tsx` gains `useEffect` hooks for `setLogScale` and `setShowVolume`; SUPERTREND-safe overlay color guard
  - all 54 unit tests pass; `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win` all pass
  - backup: `backups/pre_opencode_changes_20260408_003950_high_value_chart_features`
  - see `HIGH_VALUE_CHART_FEATURES_PASS_REPORT.md`
- On April 7, 2026, added indicator pane controls (gear settings + remove actions):
  - created `src/components/IndicatorSettingsDialog.tsx` — shared indicator settings dialog; props `{ indicator, onSave, onRemove, onClose }`; manages internal draft state; contains all `IndicatorFields`, `NumberField`, `ColorField`, `toHexColor`, `toRgbaColor` helpers extracted from Toolbar; uses `position: fixed` modal backdrop
  - `src/components/Toolbar.tsx` updated: replaced inline dialog JSX and helper functions with `<IndicatorSettingsDialog>`; removed `indicatorDraft` state and draft-sync `useEffect`; removed all extracted helper functions and dialog styles; simplified to ~100 lines less
  - `src/components/ChartCanvas.tsx` updated: added `updateIndicator`/`removeIndicator` store hooks; added `paneIndicators` useMemo; added `paneSettingsIndicatorId` state and `paneSettingsIndicator` useMemo; added per-pane gear (&#9881;) and close (×) button overlays at `right: 68, top: splitterTop + index * layout.paneHeight + 6, zIndex: 7`; added `<IndicatorSettingsDialog>` conditional render; added `paneActionButtonStyle`
  - pane drag-resize was already implemented in ChartCanvas.tsx — no changes needed
  - validation passed: `npm run test` (54), `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - backup: `backups\\pre_opencode_changes_20260407_201556_indicator_pane_controls`
  - see `INDICATOR_PANE_CONTROLS_REPORT.md`
- On April 7, 2026, added MACD 4-color histogram momentum styling:
  - `src/engine/Indicators.ts`: added `colorValues?: Array<string | null>` to `RenderableHistogramSeries`; MACD case now computes per-bar momentum colors (teal/muted-teal for positive-growing/shrinking, red/muted-pink for negative-growing/shrinking)
  - `src/engine/Renderer.ts`: `drawHistogram` accepts optional `colorValues` parameter; uses per-bar color when present, falls back to existing `positiveColor`/`negativeColor` per bar
  - `src/engine/ChartEngine.ts`: `drawHistogram` call passes `pane.histogram.colorValues`; `buildPaneLegendTokens` and `buildIndicatorValueTags` use `colorValues?.[valueIndex]` for histogram color display
  - no changes to non-MACD indicators; `RenderableHistogramSeries` is backward-compatible
  - validation passed: `npm run test` (54), `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - backup: `backups\\pre_opencode_changes_20260407_172455_macd_4color_histogram`
  - see `MACD_4COLOR_HISTOGRAM_REPORT.md`
- On April 7, 2026, added manual "Update All Official Watchlists" bulk action:
  - `src/store/chartStore.ts`: added `updateAllOfficialWatchlists()` to interface + implementation — loops all official source-linked watchlists, calls `runOfficialWatchlistUpdate` per entry, single `refreshWatchlistsOnly()` at end, summary toast (updated/failed counts); manual watchlists skipped automatically
  - `src/components/WatchlistManagerDialog.tsx`: "Update All" button added to Manage Watchlists toolbar; `isUpdatingAll` loading state; `officialWatchlistCount` shown in toolbar meta; `updateAllButtonStyle` added; subtitle updated
  - sidebar "Update" button unchanged — still single-watchlist only
  - no background sync; no scheduled sync; no behavior changes to Import or single Update
  - validation passed: `npm run test` (54), `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - backup: `backups\\pre_opencode_changes_20260407_160731_update_all_official_watchlists`
  - see `OFFICIAL_WATCHLIST_UPDATE_ALL_REPORT.md`
- On April 7, 2026, completed the official watchlist sync-status UX in one pass:
  - `src/components/Sidebar.tsx`: added timezone label (`LOCAL_TZ_LABEL` via `Intl.DateTimeFormat`) to the "Last synced" line; added raw ISO tooltip via `title` attribute
  - `src/components/WatchlistManagerDialog.tsx`: added per-row "Last synced" sub-line for official watchlists in the Manage Watchlists dialog (bulk view); `date-fns` import and `formatSyncDate` helper added; manual watchlist rows unaffected
  - `OFFICIAL_WATCHLIST_TESTING_FOUNDATION_REPORT.md`: backup process gap acknowledged; `npm run build` combined-command gap noted
  - sync remains manual-only; no background/scheduled sync added; no behavior changes to import/update logic
  - validation passed: `npm run test` (54), `npm run typecheck:renderer`, `npm run tauri:check`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - backup: `backups\\pre_opencode_changes_20260407_150030_sync_status_completion`
  - see `OFFICIAL_WATCHLIST_SYNC_STATUS_COMPLETION_REPORT.md`
- On April 7, 2026, added a "Last synced" date readout to the Watchlists sidebar panel:
  - `src/components/Sidebar.tsx` updated: added `date-fns` import (`format`, `parseISO`); added `lastSyncedDisplay` computed value; added a small readout below the existing hint line when the selected watchlist is official and `lastSyncedAt` is non-null; hidden for all manual watchlists
  - format: `"Last synced: dd MMM yyyy, HH:mm"` (e.g. "Last synced: 07 Apr 2026, 11:15")
  - no sidebar redesign; no import/update behavior changes; no new runtime dependency
  - validation passed: `npm run test` (54 passed), `npm run typecheck:renderer`, `npm run tauri:check`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - backup: `backups\\pre_opencode_changes_20260407_123049_last_synced_ui`
  - see `OFFICIAL_WATCHLIST_LAST_SYNCED_UI_REPORT.md` for the focused summary
- On April 7, 2026, added the official watchlist testing foundation:
  - installed `vitest` as a devDependency; added `"test": "vitest run"` script to `package.json`
  - created `vitest.config.ts` with `environment: node` and the `@` alias replicating `vite.config.ts`
  - created `src/features/watchlists/__tests__/officialWatchlistResolver.test.ts` — 35 pure function tests, zero mocking, zero Tauri coupling; covers `normalizeLookupToken`, `instrumentSymbolKey`, `instrumentIsinKey`, `buildUniqueWatchlistName`, `officialWatchlistSourceSignature`, `resolveOfficialWatchlistMember`, `buildOfficialWatchlistLookupMaps` including ISIN-first resolution invariant
  - created `src/features/watchlists/__tests__/officialWatchlistImportService.test.ts` — 19 service tests with `vi.mock()` for `@/platform`, `watchlistService`, and `officialWatchlistProviders`; resolver functions run for real inside service tests; covers happy-path import, duplicate prevention, unresolved member counting, ISIN-first resolution through service, update add/remove/unchanged/unresolvedCount
  - `npm run test` result: 2 test files, 54 tests passed
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build:renderer`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - no runtime code changed; Tauri-only runtime structure preserved; no direct Tauri imports in test files
  - see `OFFICIAL_WATCHLIST_TESTING_FOUNDATION_REPORT.md` for the focused summary
- On April 7, 2026, completed Store Split Pass 6 as a behavior-preserving extraction of the official watchlist import/update business logic:
  - added `src/features/watchlists/officialWatchlistImportService.ts` — `runOfficialWatchlistImport` and `runOfficialWatchlistUpdate` own the full fetch/resolve/diff/mutation logic; both return structured result objects
  - `chartStore.ts` retains `refreshWatchlistsOnly()`, `set({ selectedWatchlistId: ... })`, `closeOfficialWatchlistImportDialog()`, and `addToast(...)` — all store-side orchestration stays in the store
  - all imports for `officialWatchlistResolver`, `buildOfficialWatchlistSourceLinkMeta`, `getOfficialWatchlistSource`, `loadOfficialWatchlistGroupBySourceLinkMeta`, `loadOfficialWatchlistGroups`, and `applyOfficialWatchlistUpdate` removed from `chartStore.ts`
  - `src/store/chartStore.ts` reduced from 1,774 lines to 1,566 lines (−208 lines) in this pass
  - preserved intentionally: the Tauri-only runtime structure, `src/platform/*`, watchlists, Sheets, sidebar behavior, chart behavior, pane-aware drawing support, official watchlist behavior (ISIN-first resolution, duplicate prevention, live-source fetch with packaged fallback, diff logic, source signature, naming, logging), and toast/dialog behavior
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - backup: `backups\\pre_opencode_changes_20260407_101803_store_split_pass6`
  - see `STORE_SPLIT_PASS6_REPORT.md` for the focused implementation summary
- On April 7, 2026, completed Store Split Pass 5 as a behavior-preserving extraction of pure official watchlist resolver helpers:
  - added `src/features/watchlists/officialWatchlistResolver.ts` — seven pure helpers extracted verbatim from `chartStore.ts`: `normalizeLookupToken`, `instrumentSymbolKey`, `instrumentIsinKey`, `buildUniqueWatchlistName`, `officialWatchlistSourceSignature`, `resolveOfficialWatchlistMember`, `buildOfficialWatchlistLookupMaps`
  - `type OfficialWatchlistMember` import removed from `chartStore.ts` (no longer referenced directly); all seven helper call sites in `importOfficialWatchlists` and `updateOfficialWatchlist` remain intact
  - ISIN-first then symbol-fallback resolution order preserved verbatim
  - `src/store/chartStore.ts` reduced from 1,868 lines to 1,774 lines (−94 lines) in this pass
  - preserved intentionally: the Tauri-only runtime structure, `src/platform/*`, watchlists, Sheets, sidebar behavior, chart behavior, pane-aware drawing support, and the current visual parity and performance baseline
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - backup: `backups\\pre_opencode_changes_20260407_014825_store_split_pass5`
  - see `STORE_SPLIT_PASS5_REPORT.md` for the focused implementation summary
- On April 7, 2026, completed Store Split Pass 4 as two sequential behavior-preserving extractions:
- added `src/features/charts/chartDataUtils.ts` — pure chart helpers `toBar`, `aggregateBars`, `createDefaultViewport`, `fitViewportToBarCount`, and the indicator-add helper later renamed from `upsertIndicator` to `appendIndicator`, extracted from the bottom of `chartStore.ts`; all `date-fns` imports and the `EodRow` import removed from `chartStore.ts`
  - added `src/features/workspace/databaseLifecycleService.ts` — `bindDatabaseLifecycle(handlers)` owns the repeated get-api/suppress-event/apply-snapshot pattern; the four database lifecycle actions in `chartStore.ts` are now 1-line delegates
  - `src/store/chartStore.ts` reduced from 2,002 lines to 1,868 lines (−134 lines) in this pass
  - preserved intentionally: the Tauri-only runtime structure, `src/platform/*`, watchlists, Sheets, sidebar behavior, chart behavior, pane-aware drawing support, and the current visual parity and performance baseline
  - validation passed: `npm run typecheck:renderer` (twice), `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - backup: `backups\\pre_opencode_changes_20260407_012434_store_split_pass4`
  - see `STORE_SPLIT_PASS4_REPORT.md` for the focused implementation summary
- On April 7, 2026, completed Store Split Pass 3 (menu command router extraction) as the next behavior-preserving frontend architecture pass:
  - added `src/features/app/menuCommandRouter.ts` — extracts the 115-line `menu:*` dispatch if-chain from `chartStore.init()` into a dedicated `registerMenuCommandRouter` function; defines `MenuRouterChartHandle` as the minimal structural interface the router requires
  - `src/store/chartStore.ts` now delegates menu command routing through `registerMenuCommandRouter` instead of owning the dispatch table inline; `getDesktopCapabilities` and `DrawingTool` imports removed as no longer needed in the store
  - `src/store/chartStore.ts` reduced from 2,111 lines to 2,002 lines (−109 lines)
  - preserved intentionally: the Tauri-only runtime structure, `src/platform/*`, watchlists, Sheets, sidebar behavior, chart behavior, pane-aware drawing support, and the current visual parity and performance baseline
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - backup: `backups\\pre_opencode_changes_20260407_004730_store_split_pass3_menu_router`
  - see `STORE_SPLIT_PASS3_MENU_ROUTER_REPORT.md` for the focused implementation summary
- On April 5, 2026, added a focused Claude handoff + current-architecture documentation bundle so future AI sessions start from the active Tauri-only repo reality instead of the older scaffold-era prompt:
  - added `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md` as the strict current-state handoff prompt for Claude
  - added `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` as the current architecture and project-structure guide
  - added `CLAUDE_HANDOFF_ARCHITECTURE_REPORT.md` as the focused doc pass report
  - updated `README.md`, `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md`, and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` to reference the new handoff docs
  - updated `EOD_CHART_CODEX_PROMPT_REVISED.md` with a historical-status notice so it is no longer mistaken for the live implementation baseline
  - this was a docs-only pass; no runtime code changed and no build/package validation was rerun
  - backup: `backups\\pre_opencode_changes_20260405_164349_claude_handoff_docs`
  - see `CLAUDE_HANDOFF_ARCHITECTURE_REPORT.md` for the focused summary
- On April 5, 2026, completed Store Split Pass 2 as the next behavior-preserving frontend architecture refactor:
  - added `src/features/workspace/workspacePersistence.ts` for persisted workspace/sheet/layout types plus shared workspace serialization, stringification, parsing, and restoration helpers
  - added `src/features/workspace/databaseSnapshotService.ts` for lightweight snapshot fetches, active-database snapshot refresh loading, and post-open snapshot hydration helpers
  - `src/store/chartStore.ts` now delegates workspace persistence parsing/serialization and snapshot detail loading through those feature modules instead of owning those implementations directly
  - `src/components/LayoutManagerDialog.tsx` now saves layouts through the shared workspace serializer instead of importing that serializer from `chartStore`
  - `src/store/chartStore.ts` was reduced from 2173 lines to 1953 lines in this pass without changing the current chart/watchlist/session behavior
  - preserved intentionally: the Tauri-only runtime structure, `src/platform/*`, watchlists, Sheets, sidebar behavior, chart behavior, pane-aware drawing support, and the recent visual parity/performance baseline
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded packaged self-check passed: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd` launched successfully and exposed a running `EOD Chart` window after the pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `STORE_SPLIT_PASS2_REPORT.md` for the focused implementation summary
- On April 5, 2026, completed a focused layout dialog refinement pass so deleting a saved layout no longer uses browser-style `confirm(...)` UI:
  - `src/components/LayoutManagerDialog.tsx` now opens an in-app delete confirmation dialog instead of calling browser confirm directly
  - the existing save/load/delete layout workflow was preserved
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded packaged self-check passed: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd` launched successfully and exposed a running `EOD Chart` window after the pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `LAYOUT_DIALOG_REFINEMENT_REPORT.md` for the focused implementation summary
- On April 5, 2026, completed a focused watchlist dialog refinement pass so the remaining watchlist workflow no longer uses browser-style prompt, confirm, or alert UI:
  - `src/store/chartStore.ts` now requires an explicit watchlist name for `createWatchlist(...)` and throws normal errors instead of opening browser prompts or alerts
  - added `src/components/WatchlistDialogs.tsx` as a small shared in-app dialog layer for watchlist naming and delete confirmation
  - `src/components/Sidebar.tsx` now opens an in-app create-watchlist dialog from the `New` action and routes official-update failures through toast messaging instead of browser alerts
  - `src/components/WatchlistManagerDialog.tsx` now uses in-app dialogs for create, rename, and delete instead of browser-native prompt/confirm calls
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded packaged self-check passed: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd` launched successfully and exposed a running `EOD Chart` window after the pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `WATCHLIST_DIALOG_REFINEMENT_REPORT.md` for the focused implementation summary
- On April 5, 2026, completed a focused sheet dialog refinement pass so per-chart-window sheet actions no longer open browser-style `tauri.localhost` prompts:
  - `src/components/SheetTabs.tsx` now opens in-app dialogs for create, rename, and delete
  - the existing per-chart-window sheet ownership model and tab-scoped store actions were preserved
  - the `+` action now confirms the sheet name before creating from the current chart window state
  - click-to-load and double-click-to-rename behavior were preserved
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded packaged self-check passed: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd` launched successfully and exposed a running `EOD Chart` window after the pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `SHEET_DIALOG_REFINEMENT_REPORT.md` for the focused implementation summary
- On April 5, 2026, completed Store Split Pass 1 as a behavior-preserving frontend architecture refactor:
  - added `src/store/uiStore.ts` so shell visibility, command palette, utility dialogs, import dialogs, drawing-tool state, magnet state, and drawing-properties requests no longer live directly inside `src/store/chartStore.ts`
  - added `src/store/workspaceStore.ts` so the persisted sidebar shell layout state (`width`, `collapsed`, `pinned`) no longer lives as local component state inside `src/RootApp.tsx`
  - added `src/features/watchlists/watchlistService.ts` and `src/features/workspace/workspaceService.ts` as the first thin feature-service wrappers over the Tauri desktop bridge
  - updated `src/RootApp.tsx`, `src/components/ChartCanvas.tsx`, `src/components/ChartToolDock.tsx`, `src/components/Toolbar.tsx`, `src/components/CommandPalette.tsx`, `src/components/ImportCsvDialog.tsx`, `src/components/OfficialWatchlistImportDialog.tsx`, and `src/components/DatabaseToolsDialogs.tsx` to consume the new UI/workspace stores instead of pulling those concerns from `chartStore`
  - `src/store/chartStore.ts` still owns chart/workspace/watchlist/data orchestration in this pass, but no longer stores the extracted shell UI/dialog/drawing-tool slices directly
  - preserved intentionally: the Tauri-only runtime structure, `src/platform/*`, watchlists, Sheets, sidebar behavior, chart behavior, pane-aware drawing support, the recent visual parity pass, and the current portable Windows workflow
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded packaged self-check passed: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd` launched successfully and exposed a running `EOD Chart` window after the pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `STORE_SPLIT_PASS1_REPORT.md` for the detailed report
- On April 5, 2026, completed a focused TradingView-style visual parity pass for the active Tauri-only chart engine:
  - `src/engine/Renderer.ts` now provides shared grouped numeric formatting, dynamic right-axis width measurement, indicator right-axis value tags, and lightweight in-canvas legend token rendering helpers
  - `src/engine/Crosshair.ts` now reuses the shared formatter so the crosshair Y label stays aligned with axis formatting
  - `src/components/ChartHeader.tsx` now uses grouped numeric formatting for last price, OHLC, and change readouts without altering the existing header layout
  - `src/engine/ChartEngine.ts` now measures and applies dynamic axis width consistently across layout, render, overlay, and pan math; tightens non-fixed indicator pane scaling slightly; renders live indicator pane values in the overlay layer; and renders live overlay-indicator values in the price pane
  - preserved intentionally: the Tauri-only runtime structure, `src/platform/*`, watchlists, Sheets, sidebar behavior, pane-aware drawing support, and the current chart interaction model
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded packaged self-check passed: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd` launched successfully and exposed a running `EOD Chart` window after the pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `VISUAL_PARITY_TRADINGVIEW_REPORT.md` for the detailed report
- On April 5, 2026, completed a focused pane-aware drawing interaction pass so drawing tools are no longer limited to the main price pane:
  - `src/engine/types.ts` now stores optional drawing `paneId` ownership plus pane-aware crosshair metadata without breaking older saved price-pane drawings
  - `src/engine/ChartEngine.ts` now detects the active pane under the pointer, maps hit-testing and editing through that pane's own Y scale, renders pane-owned drawings inside the correct indicator pane, and keeps vertical lines global across the stacked chart area
  - `src/engine/Crosshair.ts` now carries pane-aware crosshair value data so the right-axis label follows the active pane scale instead of always using the main price scale
  - `src/components/ChartCanvas.tsx` now keeps drawing-properties wording consistent for pane-owned drawings by using `Value`, `Start Value`, and `End Value` inside indicator panes
  - pane-valid tools now work inside indicator panes: horizontal line, vertical line, trendline, ray, arrow, rectangle, text, and channel; fib and gann remain intentionally restricted to the main price pane
  - preserved intentionally: the Tauri-only runtime structure, `src/platform/*`, watchlists, Sheets, sidebar behavior, pane rendering, pane resize behavior, and the existing chart engine architecture
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `PANE_AWARE_DRAWING_SUPPORT_REPORT.md` for the detailed report
- On April 4, 2026, completed a video-guided database-open and zoom refinement pass after reviewing direct local recordings of database opening, EOD zoom behavior, and TradingView zoom behavior:
  - reviewed `C:\Users\Admin\Videos\Captures\EOD charting platfor database opening.mp4`, `C:\Users\Admin\Videos\Captures\EOD Charting Platform ZOOM-IN ZOOM-OUT.mp4`, and `C:\Users\Admin\Videos\Captures\Tradingview ZOOM-IN ZOOM-OUT.mp4`
  - `src/components/Sidebar.tsx` now virtualizes the Symbols panel rows and Watchlists panel rows, which materially reduces first-open and large-list paint cost without redesigning the sidebar
  - `src/store/chartStore.ts` now delays the initial post-open symbol-browser refresh slightly so workspace/chart hydration gets a cleaner first paint before the full symbol list lands
  - `src/engine/types.ts`, `src/engine/Crosshair.ts`, `src/engine/ChartEngine.ts`, `src/components/ChartCanvas.tsx`, and `src/engine/ScaleManager.ts` now preserve a stronger logical zoom anchor and allow a bounded dynamic future/right margin during zoom-out, which keeps EOD zoom behavior materially closer to the TradingView reference clip
  - preserved intentionally: the Tauri-only runtime structure, `src/platform/*`, watchlist behavior, Sheets behavior, sidebar structure, and the current chart engine architecture
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded packaged self-check passed: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd` launched successfully and exposed a running `EOD Chart` window after the pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `DATABASE_OPEN_ZOOM_VIDEO_REFINEMENT_REPORT.md` for the detailed report
- On April 4, 2026, fixed a deeper Tauri build invalidation issue behind the portable blank-window regression:
  - `src-tauri-shell\\build.rs` now emits `cargo:rerun-if-changed=../dist`
  - this forces Cargo/Tauri to rebuild the desktop shell when the frontend `dist\\` output changes, instead of silently reusing a stale executable built against older frontend assets
  - preserved intentionally: the Tauri-only runtime structure, `src-tauri-shell`, `src/platform/*`, and all current chart/watchlist/workspace behavior
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded self-check passed: the staged launcher started successfully after the rebuild, and the regenerated executable timestamp advanced beyond the earlier stale portable exe
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `TAURI_FRONTEND_ASSET_REBUILD_INVALIDATION_REPORT.md` for the detailed report
- On April 4, 2026, hardened the portable launcher after the asset-staging fix so normal Windows launch context does not break frontend asset resolution:
  - `scripts\\prepare-tauri-portable.ps1` now generates `Launch Portable EOD Chart.cmd` with `start "" /D "%~dp0" "%~dp0EOD Chart.exe"` instead of launching the exe without an explicit working directory
  - the launcher still sets `EOD_CHART_PORTABLE_ROOT`, but now also forces the working directory to the portable app folder so `index.html` and `assets\\` resolve consistently
  - preserved intentionally: the Tauri-only runtime structure, the active `src-tauri-shell` backend path, `src/platform/*`, and all current chart/watchlist/workspace behavior
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded self-check passed: the regenerated staged launcher started successfully after the workdir hardening pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `PORTABLE_LAUNCHER_WORKDIR_FIX_REPORT.md` for the detailed report
- On April 4, 2026, fixed a portable Tauri packaging regression where the staged portable app could open with `asset not found: index.html`:
  - `scripts\\prepare-tauri-portable.ps1` had been copying only the raw Tauri release executable into `release\\tauri-portable-win\\EOD Chart Portable\\`
  - the portable folder did not include the built frontend files from `dist\\`, so the staged app could launch without `index.html` or `assets\\`
  - the staging script now verifies `dist\\index.html` exists and copies the full built renderer output into the portable folder beside `EOD Chart.exe`
  - preserved intentionally: the Tauri-only runtime structure, the active `src-tauri-shell` backend path, `src/platform/*`, and all current chart/watchlist/workspace behavior
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded self-check passed: the staged portable launcher started successfully after the fix, and the portable folder now includes `index.html` plus `assets\\`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `PORTABLE_ASSET_STAGING_FIX_REPORT.md` for the detailed report
- On April 4, 2026, completed a focused watchlist-switching renderer performance pass so the sidebar watchlist panel is no longer tied to full active-tab churn:
  - `src/components/Sidebar.tsx` no longer subscribes to the full `chartTabs` array just to track the active symbol or active indicators; it now uses narrower derived selectors for the active instrument key, active indicators, database path, DB stats, and watchlists
  - `SymbolListRow` in `src/components/Sidebar.tsx` is now memoized and uses stable item-based open/context-menu callbacks, reducing row rerender churn during watchlist use and general chart interaction
  - `src/store/chartStore.ts` now treats `selectWatchlist(...)` as a no-op when the requested watchlist is already selected, avoiding redundant state updates
  - preserved intentionally: the Tauri-only runtime structure, current watchlist behavior, official import/update/live-source behavior, symbol matching rules, Sheets behavior, chart behavior, and the current sidebar layout/pin behavior
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded self-check passed: the packaged launcher started successfully after this pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `WATCHLIST_SWITCHING_PERFORMANCE_REPORT.md` for the detailed report
- On April 4, 2026, completed a focused DB-stats cache pass in the active Tauri backend so routine shell refreshes do not keep recounting the active database when the SQLite file has not changed:
  - `src-tauri-shell/src/database.rs` now stores an optional `db_stats_cache` alongside the active cached SQLite connection and reuses DB stats based on the active database file signature (file length plus modified timestamp)
  - `get_db_stats(...)` now returns cached stats for unchanged databases, and `get_app_snapshot_internal(...)` now reuses that same cache whenever stats are requested
  - changing the active database folder still resets the connection cache and the attached DB-stats cache together, so the optimization stays scoped safely to the current active database
  - preserved intentionally: the Tauri-only runtime structure, `src/platform/*`, current watchlist behavior, Sheets behavior, sidebar behavior, chart behavior, and the existing performance passes for connection reuse, lightweight snapshots, symbol search, EOD cache reuse, and watchlist-only refreshes
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded self-check passed: the packaged launcher started successfully after the DB-stats cache pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `DB_STATS_CACHE_PERFORMANCE_REPORT.md` for the detailed report
- On April 4, 2026, reset backup retention to reclaim disk space while keeping one current recovery point:
  - created a new compact retained baseline at `backups\\pre_opencode_changes_20260404_150804_compact_backup_baseline`
  - the retained baseline intentionally includes active source/config/docs only and excludes generated output, databases, and prior backup folders
  - removed the older backup folders after confirming the compact baseline existed and was readable
  - cleaned up several stale backup folders that contained an invalid Windows `nul` file entry by deleting them through a verified long-path cleanup path
  - backup footprint dropped from about `4.76 GB` across `58` folders to about `126.8 MB` in `1` retained folder
  - see `BACKUP_RETENTION_RESET_REPORT.md` for the detailed summary
- On April 4, 2026, removed the unused legacy `src-tauri` tree after confirming the active build/runtime path no longer referenced it:
  - backed up the full `src-tauri` directory and the active docs first under `backups\\pre_opencode_changes_20260404_144330_legacy_src_tauri_removal`
  - deleted `src-tauri\\` from the workspace root because all active scripts, runtime code, packaging, and docs already pointed only to `src-tauri-shell`
  - updated `README.md`, `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `FILE_INVENTORY.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, `src-tauri-shell\\README.md`, and `TAURI_ONLY_ELECTRON_RETIREMENT_REPORT.md` so future threads do not assume that `src-tauri` still exists
  - preserved intentionally: the active `src-tauri-shell` backend path, `src/platform/*`, the current Tauri-only runtime structure, watchlists, Sheets, chart behavior, and the recent Tauri performance baseline
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded self-check passed: the packaged launcher started successfully after the removal pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
- On April 4, 2026, completed the Tauri-only Electron retirement pass so the active desktop runtime is now Tauri only:
  - added `src/types/desktop.ts` as the shared desktop contract surface and updated `src/platform/types.ts`, `src/platform/desktop.ts`, and `src/platform/shell.ts` so the renderer no longer resolves or references an Electron runtime path
  - updated `src/components/BhavcopyDownloadWindow.tsx` to use runtime-neutral bridge messaging instead of the old Electron-specific error wording
  - removed the active Electron runtime source path under `electron/`, removed `src/types/electron.d.ts`, removed `tsconfig.electron.json`, and removed Electron scripts/dependencies/builder config from `package.json`
  - Electron generated output under `dist-electron/` is now legacy artifact state and no longer part of the active build path
  - preserved intentionally: `src/platform/*` as the renderer/runtime seam, the active `src-tauri-shell` backend path, the legacy/disconnected `src-tauri` tree, current chart/watchlist/workspace behavior, and the recent Tauri performance baseline
  - validation passed: `npm run typecheck:renderer`, `npm run tauri:check`, `npm run build`, `npm run tauri:portable:win`
  - bounded self-check passed: the packaged launcher started successfully after the retirement pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `TAURI_ONLY_ELECTRON_RETIREMENT_REPORT.md` for the detailed report
- On April 4, 2026, completed a focused watchlist duplicate-import + symbol-context-menu fix so official groups no longer re-import into a second source-linked watchlist and the Watchlists panel now shows a cleaner symbol-only list:
  - `src/store/chartStore.ts` now derives a stable official-source signature from `sourceType`, `sourceExchange`, `sourceGroupType`, and `sourceKey`, and `importOfficialWatchlists(...)` now skips already-linked official groups instead of creating another watchlist with a `(2)` suffix
  - when a selected official group is already present, the import flow now logs `[official-watchlist-import] already-linked`, keeps the existing linked watchlist, and surfaces a compact toast explaining that the selected group is already imported rather than creating a duplicate
  - `src/components/Sidebar.tsx` now renders the Watchlists panel as a symbol-only list, removes the noisy inline delete buttons, and adds a compact right-click context menu with `Delete` for current-watchlist symbol removal
  - the Watchlists panel now includes a small helper line clarifying that symbol removal is available through right-click, while preserving the existing `New`, contextual `Update`, selector, and top-menu import workflow
  - preserved intentionally: official import/update/live-source behavior, source-linked metadata, ISIN-first then symbol-fallback matching, Bhavcopy behavior, Sheets behavior, sidebar pin/auto-hide behavior, chart/workspace behavior, Electron fallback, and the `src/platform/*` runtime seam
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - bounded self-check passed: the packaged launcher started successfully after this fix pass
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `WATCHLIST_DUPLICATE_IMPORT_AND_SYMBOL_CONTEXT_MENU_FIX_REPORT.md` for the detailed report
- On April 3, 2026, completed a focused Watchlist menu + official import window refinement pass so watchlists now feel like a first-class desktop feature area instead of a sidebar-only utility:
  - the native menu order is now `File / Database / Watchlist / Chart / View / Help` in both Electron and the active `src-tauri-shell` menu wiring
  - the new top-level `Watchlist` menu now exposes `Manage Watchlists` and `Import Official Watchlists`
  - `src/components/WatchlistManagerDialog.tsx` now provides a minimal low-risk management surface for list/create/rename/delete watchlist tasks, while `src/store/chartStore.ts`, `electron/db.ts`, `electron/ipc/handlers.ts`, `electron/preload.ts`, `src/platform/types.ts`, `src/platform/tauriDesktop.ts`, `src/types/electron.d.ts`, `src-tauri-shell/src/database.rs`, and `src-tauri-shell/src/main.rs` now carry the required rename/delete wiring across Electron and Tauri
  - `src/components/Sidebar.tsx` no longer carries `Import` in the Watchlists action row; the sidebar now stays focused on current watchlist usage with `New`, contextual `Update`, the selector, and a helper line pointing to `Watchlist > Import Official Watchlists`
  - `src/components/OfficialWatchlistImportDialog.tsx` now uses a larger two-pane management window with source tabs, a left-side multi-select group list, and a right-side constituent preview instead of the old narrow single-column popup
  - `src/features/watchlists/officialWatchlistData.generated.ts` now expands the packaged reliable NSE catalog to 22 sector groups and 21 index groups, while the currently validated BSE coverage remains 5 sector groups and 2 visible index groups in the importer; `src/features/watchlists/officialWatchlistProviders.ts` now also forces snapshot fallback when a live BSE constituent page is paginated so partial first-page parses are not treated as complete live results
  - preserved intentionally: official watchlist import/update/live-source behavior, source-linked metadata, ISIN-first then symbol-fallback matching, Bhavcopy behavior, Sheets behavior, sidebar pin/auto-hide behavior, chart/workspace behavior, Electron fallback, and the `src/platform/*` runtime seam
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - bounded self-check passed: the packaged launcher spawned `release\\tauri-portable-win\\EOD Chart Portable\\EOD Chart.exe`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `WATCHLIST_MENU_IMPORT_WINDOW_REFINEMENT_REPORT.md` for the detailed report
- On April 3, 2026, completed a focused watchlist action discoverability fix so the Watchlists panel makes `Import` and `Update` clearly reachable without relying on hidden right-click or low-visibility access patterns:
  - `src/components/Sidebar.tsx` now uses a compact dedicated watchlist action block with visible `New`, `Import`, and `Update` buttons above the selector instead of burying actions inside the crowded selection row
  - the `Update` button remains conditional on the currently selected watchlist being an official source-linked watchlist and stays disabled for manual watchlists or when no database is open
  - a compact helper/status line now clarifies whether the selected watchlist is manual, official linked, or unavailable because no database is open
  - official watchlist import behavior, source-linked metadata, manual update flow, live-source provider logic, symbol matching, Bhavcopy behavior, Sheets behavior, sidebar pin/auto-hide behavior, and chart/workspace behavior were preserved intentionally
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `WATCHLIST_ACTION_DISCOVERABILITY_FIX_REPORT.md` for the detailed report
- On April 3, 2026, completed a focused official watchlist live-source provider pass so manual import and manual update now try to fetch the latest constituent lists from official NSE/BSE sources while preserving the existing watchlist UI, metadata model, symbol resolution, and fallback snapshot behavior:
  - `electron/ipc/handlers.ts`, `electron/preload.ts`, `src/types/electron.d.ts`, `src/platform/types.ts`, `src/platform/tauriDesktop.ts`, and `src-tauri-shell/src/main.rs` now expose a dedicated official-watchlist source fetch bridge across both Electron and Tauri while restricting requests to the approved official NSE/BSE hosts
  - `src/features/watchlists/officialWatchlistProviders.ts` now keeps the existing snapshot metadata for UI listing and source-key lookup, but adds async live loaders, official-source parsers for NSE CSV and BSE HTML, provider-side normalization logging, and snapshot fallback when live fetch/parsing fails
  - `src/store/chartStore.ts` now uses the new live-aware provider loaders during manual import and manual `Update`, while preserving the existing ISIN-first / symbol-fallback resolution logic and the existing add/remove/unchanged/unresolved diff behavior
  - manual watchlists, source-linked metadata storage, the watchlist sidebar structure, workspace behavior, Sheets behavior, Bhavcopy flows, Electron fallback, and the `src/platform/*` runtime seam were preserved intentionally
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `OFFICIAL_WATCHLIST_LIVE_SOURCE_REPORT.md` for the detailed report
- On April 3, 2026, completed a focused official watchlist source-link/update pass so imported official NSE/BSE sector/index watchlists can be manually refreshed from their packaged official provider source without affecting manual watchlists:
  - `electron/db.ts` and `src-tauri-shell/src/database.rs` now extend the `watchlists` table with optional nullable official-source metadata fields: `source_type`, `source_exchange`, `source_group_type`, `source_key`, `source_display_name`, and `last_synced_at`
  - `src/types/electron.d.ts`, `src/platform/types.ts`, `electron/preload.ts`, `electron/ipc/handlers.ts`, `src/platform/tauriDesktop.ts`, and `src-tauri-shell/src/main.rs` now expose a metadata-aware `createWatchlist` contract plus a transactional `applyOfficialWatchlistUpdate` desktop API across both Electron and Tauri
  - `src/features/watchlists/officialWatchlistProviders.ts` now derives stable source keys and can resolve a stored official source-link back to the packaged provider/group definition
  - `src/store/chartStore.ts` now stores official source metadata during import, reuses the existing exchange-aware ISIN-first/symbol-fallback resolution logic for update, computes `add/remove/unchanged/unresolved` diffs, and applies official updates through a single backend operation
  - `src/components/Sidebar.tsx` now exposes a minimal `Update` action for selected official source-linked watchlists while preserving the existing watchlist panel structure
  - manual watchlists, existing symbol matching rules, workspace behavior, sidebar behavior, Sheets behavior, and Bhavcopy flows were preserved intentionally
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `OFFICIAL_WATCHLIST_UPDATE_REPORT.md` for the detailed report
- On April 3, 2026, completed a focused official watchlist import foundation pass so the app can manually create packaged NSE/BSE sector and index watchlists from official-source snapshots without adding auto-sync behavior:
  - `src/features/watchlists/officialWatchlistData.generated.ts` now packages the current official constituent snapshot used by this pass, including NSE sector/index groups plus the currently verified BSE sector/index groups
  - `src/features/watchlists/officialWatchlistProviders.ts` now exposes modular provider metadata for `NSE Sectors`, `NSE Indices`, `BSE Sectors`, and `BSE Indices` without hardcoding group data inside UI components
  - `src/components/OfficialWatchlistImportDialog.tsx`, `src/components/Sidebar.tsx`, and `src/RootApp.tsx` now provide the compact checkbox selection flow opened from `Import Watchlist > {source}`
  - `src/store/chartStore.ts` now imports one new watchlist per selected group, avoids duplicate names, resolves symbols against the active database using exchange-aware symbol/ISIN matching, skips unresolved constituents safely, and logs created watchlists plus unresolved symbols
  - existing watchlist CRUD, Bhavcopy download, workspace behavior, Sheets behavior, sidebar auto-hide behavior, database schema, and symbol identity rules were preserved intentionally
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `OFFICIAL_WATCHLIST_IMPORT_FOUNDATION_REPORT.md` for the detailed report
- On April 2, 2026, fixed the immediate Windows build blocker and rebuilt the portable EXE without reopening the chart UI or runtime architecture:
  - `src/engine/Indicators.ts` no longer imports missing top-level `DEMA` / `TEMA` exports from `technicalindicators`; those two overlays are now calculated locally from chained `EMA` results so the current package version builds cleanly
  - `src/components/Toolbar.tsx` now resolves the indicator swatch color safely for all indicator union variants, including pane indicators like `AROON` that do not expose a single `color` field
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
- On April 2, 2026, completed a focused chart window UI gap follow-up so the single-chart top area feels less fragmented and indicator panes read more like deliberate panes without reopening the wider workspace redesign:
  - `src/components/ChartHeader.tsx`, `src/components/Toolbar.tsx`, and `src/RootApp.tsx` now make the single-chart top area read as one continuous chart band instead of two separate stacked bars
  - `src/engine/Renderer.ts` now gives each indicator pane a clearer title rail and top separator line
  - `src/components/ChartCanvas.tsx` now gives the pane resize boundary a more visible grip-and-label treatment
  - per-window sheets, in-strip new-sheet placement, sidebar pin/auto-hide/readability, crosshair fixes, and zoom-stability work were preserved intentionally
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `CHART_WINDOW_UI_GAP_FOLLOWUP_REPORT.md` for the detailed report
- On April 2, 2026, completed a focused chart rendering/layout fix pass so the canvas renderer matches the recent workspace polish more closely without reopening the broader UI work:
  - `src/engine/Crosshair.ts` now renders the crosshair date label in the shared bottom X-axis strip with a human-readable full-year date, crosshair-accent background, white text, and clamped placement inside the plot width
  - `src/engine/ScaleManager.ts` now keeps an 8px left plot gutter, preserves a 4-slot right-side future margin at the latest bar, and derives Y-axis tick density from pane height instead of a fixed count
  - `src/engine/Renderer.ts` now uses the pane height when drawing horizontal grid/tick levels and forces indicator pane titles to render left-aligned in compact monospace text, fixing the truncated `2)` title artifact
  - the shared bottom X-axis structure, per-chart-window sheets, sidebar pin/auto-hide behavior, sidebar readability refinements, and recent zoom-stability work were preserved intentionally
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
- On April 2, 2026, completed a focused chart header/timeframe refinement pass so the top chart area reads more clearly without undoing the recent sheets/sidebar/zoom work:
  - `src/components/ChartHeader.tsx` now groups symbol identity, exchange / `EOD` / mode context, last price/change, OHLC, and timeframe controls into clearer compact sections
  - `src/components/Toolbar.tsx` now reads more like a deliberate top control strip by grouping price-mode, magnet, and study-add controls more clearly and making study pills easier to scan
  - `src/components/TileHeader.tsx` now mirrors the same clarity direction in tiled mode with stronger identity, price/change, and timeframe grouping
  - `D/W/M/Q/Y` remain visible, and the active timeframe now carries stronger visual emphasis in both single and tiled headers
  - larger sheet tabs, in-strip new-sheet `+`, sidebar auto-hide/pin behavior, sidebar readability refinements, and zoom-stability refinements were preserved intentionally
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `CHART_HEADER_TIMEFRAME_REFINEMENT_REPORT.md` for the detailed report
- On April 2, 2026, completed a small chart workspace UX refinement pass so the left sidebar reads more clearly and zoom-out behavior is stricter without undoing the prior sheet-strip or sidebar auto-hide work:
  - `src/components/Sidebar.tsx` now uses slightly larger and brighter text across symbol rows, metadata, section labels, compact buttons, search fields, and list headers while keeping the sidebar compact
  - `src/styles/global.css` now brightens `.sidebar-compact-input::placeholder` so sidebar placeholders are less faint
  - `src/engine/ScaleManager.ts` now preserves the half-bar center offset in zoom anchoring, which removes the residual pixel-anchor error that was still causing zoom-out drift
  - `src/engine/ChartEngine.ts` and `src/components/ChartCanvas.tsx` now use reciprocal zoom in/out factors so repeated zoom cycles no longer accumulate the previous subtle span mismatch
  - larger sheet tabs, in-strip new-sheet `+`, sidebar pin/auto-hide behavior, click-reopen rail, and per-chart-window sheet ownership were preserved intentionally
  - AmiBroker executables were directly accessible on this PC, so the remaining zoom-out stabilization work was implemented toward that local behavioral target
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `CHART_WORKSPACE_UX_REFINEMENT_REPORT.md` for the detailed report
- On April 2, 2026, completed a strict chart workspace UX stability pass so sheet tabs, sidebar behavior, and zooming feel closer to an AmiBroker-style desktop workflow without changing sheet ownership or the runtime seam:
  - `src/components/SheetTabs.tsx` now uses roomier workbook tabs, clearer active-state styling, and keeps the new-sheet `+` immediately after the last visible sheet tab instead of detaching it at the far right edge
  - `src/components/Sidebar.tsx` and `src/RootApp.tsx` now give the left sidebar larger rail/panel controls plus a click-based pin/auto-hide mode with a slim reopen rail and click-away collapse when unpinned
  - `src/engine/ChartEngine.ts`, `src/components/ChartCanvas.tsx`, and `src/store/chartStore.ts` now anchor wheel and zoom-control behavior to the current cursor or hover focus instead of forcing viewport-center zoom, and the bottom scrollbar stays aligned with the true visible range during zoom changes
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `CHART_WORKSPACE_UX_STABILITY_REPORT.md` for the detailed report
- On April 2, 2026, completed a strict chart readability/space pass so the chart area feels larger by removing wasted chrome instead of shrinking text:
  - `src/components/ChartHeader.tsx` now keeps the single-chart timeframe strip clearly visible with larger 10px timeframe buttons and more readable OHLC text
  - `src/components/Toolbar.tsx` stays compact but uses slightly more readable control and active-indicator text without reintroducing duplicated timeframes
  - `src/components/TileHeader.tsx` and `src/components/SheetTabs.tsx` remain compact while making per-tile timeframe buttons and bottom workbook tabs slightly easier to read
  - `src/components/ChartCanvas.tsx` trims shell padding and the bottom control strip while raising overlay indicator labels to readable plain text
  - `src/engine/Renderer.ts` now renders dedicated indicator pane titles at a clearer 11px compact size
  - `src/engine/ScaleManager.ts` now uses a 10px inner plot gutter, which preserves clear left padding and gives the last candle more right-side breathing room while keeping the existing price-scale gap
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `CHART_READABILITY_SPACE_PASS_REPORT.md` for the detailed report
- On April 2, 2026, completed a chart-window UI cleanup pass to push the shell closer to a disciplined AmiBroker-style desktop hierarchy without changing chart/state architecture:
  - `src/components/Toolbar.tsx` no longer presents active indicators as a chip/badge row; indicator management is now shown as compact plain-text controls so the toolbar stops reading like a dashboard banner
  - `src/components/Sidebar.tsx` now uses a quieter rail, tighter panel header, cleaner symbol search row, and a less intrusive A-Z jump strip while preserving existing symbols/indicators/watchlist behavior
  - `src/components/ChartToolDock.tsx` is now a narrower drawing rail with grouped controls but without section-label clutter or the old status card
  - `src/components/ChartCanvas.tsx` now shows tool status as subtle text instead of a floating card-like block inside the chart
  - `src/components/StatusBar.tsx` now removes low-value developer chrome such as `SQLite WAL` from the constant footer view and keeps the footer denser
  - sheet ownership remains per-chart-window and this pass did not touch `src/store/chartStore.ts`
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `CHART_WINDOW_UI_CLEANUP_REPORT.md` for the detailed report
- On April 1, 2026, cleaned up chart indicator labels so they render as plain compact text in the pane they belong to instead of highlighted chart-area chips:
  - `src/indicators/catalog.ts` now exposes a shared indicator display-label helper so indicator name plus parameters stay consistent across overlay and pane contexts
  - `src/engine/Indicators.ts` now uses that display label for pane titles, so dedicated indicator panes show compact name-plus-parameter text at the top-left of the pane
  - `src/engine/Renderer.ts` now draws pane titles with lighter, smaller text so pane labels read like chart annotations rather than badges
  - `src/components/ChartCanvas.tsx` no longer renders the highlighted indicator chip row inside the chart area
  - overlay indicators in the main price pane now render as plain compact text labels at the top-left of that pane
  - pane indicators continue to label their own panes, now with parameterized titles and without pill/chip styling
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - sheet behavior, tile behavior, indicator calculations, and chart-engine behavior were preserved
  - see `INDICATOR_LABEL_UI_CLEANUP_REPORT.md` for the detailed report
- On April 1, 2026, completed a compact chart UI pass to move the workspace closer to an AmiBroker-style dense desktop layout without changing chart/state architecture:
  - `src/components/ChartHeader.tsx` now renders only symbol, timeframe selector, and OHLC line in a compact single row
  - chart header height is now effectively 30px in single-chart mode
  - `src/components/Toolbar.tsx` no longer duplicates timeframe controls in single-chart mode; tile mode keeps its own compact per-tile timeframe selector through `src/components/TileHeader.tsx`
  - `src/components/TileHeader.tsx` is now a compact 28px single-row tile header with tighter padding and smaller timeframe buttons
  - `src/components/SheetTabs.tsx` keeps sheets per-chart-window while reducing the strip to 23px and individual workbook tabs to 22px
  - `src/components/ChartCanvas.tsx` now uses tighter shell padding and slimmer bottom controls so the chart drawing area dominates more of the viewport
  - `src/RootApp.tsx` keeps tile spacing and tile borders minimal so tiled windows waste less space
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - sheets remain per-chart-window; this pass did not change store ownership or workspace serialization
  - see `CHART_UI_COMPACT_PASS_REPORT.md` for the detailed UI-pass report
- On April 1, 2026, refactored chart-window sheet ownership so sheets are now truly per-chart-window instead of implicitly global:
  - `src/store/chartStore.ts` now persists `sheets`, `activeSheetId`, and `layoutMode` inside each `ChartTabState` workspace payload used by autosave and named layouts
  - `saveCurrentAsSheet`, `loadSheet`, `deleteSheet`, and `renameSheet` are now tab-scoped actions keyed by the owning chart window id
  - loading a sheet no longer restores the whole top-level workspace; it now restores only the owning chart window/tab from that sheet snapshot
  - `src/components/SheetTabs.tsx` now renders and acts only against the owning chart window passed from `RootApp.tsx`, with no fallback to implicit active-tab behavior
  - named layouts now preserve per-window sheets because they use the same serializer/parser path as workspace autosave
  - validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - portable output: `release\\tauri-portable-win\\EOD Chart Portable\\`
  - launcher to test: `release\\tauri-portable-win\\EOD Chart Portable\\Launch Portable EOD Chart.cmd`
  - see `CHART_WINDOW_SHEETS_REFACTOR_REPORT.md` for the full implementation report
- On April 1, 2026, performed strict visual-correction pass for chart workspace (follow-up):
  - Fixed extra tab scrollbar visibility in `src/components/ChartTabs.tsx` and `src/styles/global.css`:
    - Added CSS class `tab-strip-scroll` to hide scrollbar while keeping scroll functionality
    - Scrollbar was visible between last tab and `+` when tabs overflowed
  - Fixed scrollbar movement during zoom in `src/components/ChartCanvas.tsx`:
    - Added `prevVisibleSpanRef` to detect zoom vs scroll operations
    - Scrollbar now stays stable during zoom, only moves on explicit scroll
  - Moved SheetTabs inside chart window (AmiBroker style) in `src/RootApp.tsx`:
    - SheetTabs now appears at bottom of chart workspace, not app level
    - Changed `chartWorkspaceShellStyle` to use `flexDirection: 'column'`
    - Added `chartContentRowStyle` wrapper for single-mode chart content
  - Build validation passed: `npm run typecheck:renderer`, `npm run typecheck:electron`, `npm run build`, `npm run tauri:portable:win`
  - Portable output: `release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`
  - See `MIMO_CORRECTION_PASS_REPORT.md` for detailed report
- On March 31, 2026, cleaned up chart crosshair/hover behavior for AmiBroker-style UI:
  - Removed floating hover popup/card from chart area (`hoverReadoutCardStyle` removed from ChartCanvas.tsx)
  - OHLCV data continues to show in ChartHeader and OhlcvBar (not in chart overlay)
  - Crosshair date is shown on bottom axis near the vertical crosshair line (already implemented in Crosshair.ts)
  - Chart area is now cleaner without floating overlays
  - Removed unused code and styles from ChartCanvas.tsx
  - Build validation passed: `npm run build`
- On March 31, 2026, performed second polish pass for tab bar and sidebar:
  - Tab `+` button: Removed margin-left separation, made it directly attached to tabs
  - Tab `+` button: Changed border-radius to match tabs (6px top corners)
  - Tab `+` button: Reduced width from 28px to 26px for better proportion
  - Sidebar rail: Increased width from 24px to 26px for better readability
  - Sidebar buttons: Increased padding from 6px to 8px for more breathing room
  - Sidebar collapse button: Increased height to 24px, font size to 12px
  - Build validation passed: `npm run build`
- On March 31, 2026, performed visual polish follow-up for tab bar and sidebar:
  - Fixed tab container height to fixed 26px for consistent alignment with `+` button
  - Added `lineHeight: 1` to tab labels to prevent text clipping
  - Increased sidebar rail gap from 3px to 4px for better spacing
  - Added hover state support to sidebar vertical buttons with subtle color transitions
  - Collapse button now shows hover feedback (background and text color change)
- On March 31, 2026, fixed two specific UI spacing/readability issues:
  - Fixed tab `+` button placement in `src/components/ChartTabs.tsx`:
     - Removed `flex: 1` from tab list so it only takes needed space
     - `+` button now sits immediately after the last tab (browser-style)
  - Fixed left sidebar vertical menu readability in `src/components/Sidebar.tsx`:
     - Increased font size from 10 to 11 for vertical buttons
     - Increased button height from 70px to 76px
     - Improved contrast: active text `#d9ecff`, inactive `#8ea6bf`
     - Added font weight 600 for better legibility
     - Improved collapse button styling to match
  - Build validation passed: `npm run build`
- On March 31, 2026, UI polish and chart gutter fixes were implemented:
  - Fixed chart window left gutter and right-side gap issues in `src/engine/ScaleManager.ts`:
    - Added `gutterPx = 4` parameter for proper gutters on both sides
    - First bar now starts at `leftGutter` from the left edge
    - Last bar properly extends to the right edge before the Y-axis
  - Updated `src/components/ChartTabs.tsx` with browser-style tab design (like reference image):
    - Tabs are at same level with rounded top corners
    - Active tab has dark blue background, inactive tabs are gray
    - Close button (X) always visible on all tabs
    - New tab button (+) at far right with matching style
    - Border radius on top corners, flat bottom
    - Clean integrated browser-tab appearance
  - Build validation passed: `npm run typecheck:renderer` and `npm run build`
  - Tauri release build passed: `cargo build --release` produced `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
- On March 31, 2026, a phase-1 chart-tools hardening pass was implemented without changing the runtime seam or touching the active Tauri backend path
- Added `CHART_TOOLS_HARDENING_REPORT.md` as the authoritative hardening report for the current chart-tool baseline
- `src/store/chartStore.ts` now exposes the shared chart-workspace serializer used by autosave and named layouts, and named layout restore now uses the same parser/sanitizer path as workspace autosave
- `src/components/LayoutManagerDialog.tsx` now saves `activeChartTabId` alongside the tab payload, so named layouts preserve the active chart instead of silently falling back to the first tab
- `src/store/chartStore.ts` now explicitly treats the active drawing tool as global ephemeral UI state:
  - it resets to `cursor` on chart-tab create/activate/close
  - it also resets during workspace hydration and named layout load
- Magnet state remains global by design as a chart-input preference; this pass did not move it into per-tab persisted state
- `src/components/ChartCanvas.tsx` now clears stale drawing context menus when selection changes or is cleared, which makes tool switching, selection clearing, and delete flows more predictable
- Drawings continue to persist through both workspace autosave and named layouts; this pass preserved the existing drawing payload shape rather than introducing a new persistence layer
- Validation passed for:
  - `npm run build`
- Seam-purity checks still confirm that no active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`
- This pass did not modify Rust/Tauri/platform behavior, so `cargo check --manifest-path src-tauri-shell/Cargo.toml`, `npm run tauri:build`, and `npm run tauri:portable:win` were not rerun here
- On March 31, 2026, the next Windows-first chart-tools pass was implemented on top of the portable Tauri baseline without changing the runtime seam
- Added `CHART_TOOLS_ADDITIONS_REPORT.md` as the authoritative chart-tools implementation and follow-up report
- `src/components/ChartCanvas.tsx` now shows a chart-side hover readout card with visible date, OHLC, change, percent change, and volume information
- `src/engine/Crosshair.ts` now renders a clearer crosshair with stronger labels, clamped placement, and a center marker for desktop hover readability
- `src/engine/ChartEngine.ts` now supports shift-wheel horizontal pan, clearer dragging/panning cursor feedback, left-button-only pan start, and more predictable wheel zoom behavior
- `src/components/ChartToolDock.tsx` now emphasizes the primary daily-use tools first, groups advanced tools behind an explicit toggle, and shows clearer active-mode hints
- `src/store/chartStore.ts` now resets drawing mode and drawing-properties state to `cursor` on chart-tab create/activate/close transitions so tool state does not leak across charts
- `src/components/ChartCanvas.tsx` now supports keyboard shortcuts for the common tools:
  - `H` horizontal line
  - `V` vertical line
  - `L` trend line
  - `C` cursor
  - `M` magnet
- Delete behavior is now safer:
  - `Delete` / `Backspace` delete only the selected drawing
  - `Shift+Delete` remains the explicit clear-all path
- Drawings continue to persist through the existing workspace architecture; this pass preserved that behavior rather than introducing new persistence plumbing
- Chart-tools validation passed for:
  - `npm run build`
  - `cargo check --manifest-path src-tauri-shell/Cargo.toml`
  - `npm run tauri:portable:win`
  - bounded launch of `release/tauri-portable-win/EOD Chart Portable/EOD Chart.exe`
  - bounded launch of the local Electron fallback through `node_modules/electron/dist/electron.exe`
  - launcher-path evidence that `Launch Portable EOD Chart.cmd` updated `portable-data/logs/app-runtime.log`
- Seam-purity checks still confirm that no active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`
- This pass only claims build/startup-level validation for the new chart tools; full interactive manual smoke validation is still outstanding
- On March 30, 2026, the portable Windows development baseline pass was implemented so the fresh Tauri shell can be used as the preferred day-to-day Windows runtime on this PC or another Windows PC
- Added `PORTABLE_WINDOWS_DEV_BASE_REPORT.md` as the authoritative portable-baseline implementation and workflow report
- Added `src-tauri-shell/src/runtime.rs` for runtime-context resolution, portable/system path detection, runtime diagnostics, portable log routing, and user-friendly startup error formatting
- Added `scripts/prepare-tauri-portable.ps1` and the `npm run tauri:portable:win` workflow to stage a launcher-first portable folder at `release/tauri-portable-win/EOD Chart Portable`
- The supported portable workflow is now:
  - build/stage with `npm run tauri:portable:win`
  - launch with `Launch Portable EOD Chart.cmd`
- The staged portable launcher now sets `EOD_CHART_PORTABLE_ROOT` so runtime state and diagnostics live under:
  - `portable-data/state`
  - `portable-data/logs/app-runtime.log`
- `src-tauri-shell/src/database.rs` now stores the recent-database registry in `state/database-registry.json`, migrates the older root-level registry when present, and initializes registry state during startup so permission failures surface early
- `src-tauri-shell/src/main.rs` now logs startup diagnostics and shows a user-facing startup error dialog instead of only crashing through an internal panic path
- `electron/ipc/handlers.ts` now returns richer `getAppInfo()` diagnostics so Electron fallback and Tauri portable mode expose comparable runtime/path information to the renderer
- `src/store/chartStore.ts` now surfaces runtime/build/data-mode/path details through the existing About flow instead of a runtime-neutral minimal message
- Portable validation passed for:
  - `npm run build`
  - `cargo check --manifest-path src-tauri-shell/Cargo.toml`
  - `npm run tauri:build`
  - `npm run tauri:portable:win`
  - bounded launch of the local Electron fallback through `node_modules/electron/dist/electron.exe`
  - bounded launch of `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
  - bounded launch of `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`
  - creation of `portable-data/logs/app-runtime.log`
  - creation of `portable-data/state/database-registry.json`
- Tauri is now the preferred Windows portable development base, while Electron remains the working fallback/runtime escape hatch
- Installer-first work, signed-release work, and macOS readiness are still deferred
- On March 28, 2026, the post-Phase-6 blocker pass was implemented by porting the remaining deferred mutation flows into the fresh Tauri shell and re-running packaged Windows build/startup validation
- Added `PHASE7_MUTATION_PARITY_REPORT.md` as the authoritative Phase 7 mutation-parity and cutover-status report
- `src/platform/tauriDesktop.ts` now routes quote editor CRUD, merge-symbol flows, and corporate-action / identity-history mutations to the fresh Tauri backend instead of rejecting them as Electron-only
- `src-tauri-shell/src/database.rs` now exposes Tauri commands for:
  - quote listing, upsert, and delete
  - merge-symbol operations
  - corporate-action / identity-history mutation flows
- `src-tauri-shell/src/main.rs` now registers the mutation commands and forwards:
  - `menu:openQuoteEditor`
  - `menu:openMergeSymbols`
  - `menu:openCorporateAction`
- `src/components/CommandPalette.tsx` no longer hides the deferred mutation tools while the active runtime is Tauri
- Phase 7 validation passed for `npm run build`, `cargo check --manifest-path src-tauri-shell/Cargo.toml`, `npm run tauri:build`, and `npm run tauri:bundle:nsis`
- Bounded launch checks confirmed again:
  - `release/win-unpacked/EOD Chart.exe` starts and exposes `EOD Chart`
  - `release/EOD Chart Setup 0.1.0.exe` starts and exposes `EOD Chart Setup`
  - `src-tauri-shell/target/release/eod-charting-platform-shell.exe` starts and exposes `EOD Chart`
  - `src-tauri-shell/target/release/bundle/nsis/EOD Chart_0.1.0_x64-setup.exe` starts and exposes `EOD Chart Setup`
- Seam-purity checks still confirm that no active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports but remain outside the active runtime path
- The remaining Tauri blocker is now validation depth rather than missing adapter coverage
- The current cutover recommendation after Phase 7 is **Windows-preview-only**
- Phase 7 explicitly still does not claim:
  - full packaged interactive Tauri parity across database/import/bhavcopy/mutation flows
  - signed Windows release readiness
  - macOS packaging, signing, notarization, or runtime validation
- On March 28, 2026, Phase 6 was implemented by validating packaged Electron and packaged Tauri Windows behavior, adding an explicit parity matrix, and documenting cutover rules
- Added `PHASE6_PACKAGING_CUTOVER_REPORT.md` and `PARITY_MATRIX_ELECTRON_VS_TAURI.md` as the authoritative Phase 6 packaging/parity references
- Added `tauri:bundle:nsis` to `package.json` so the validated Windows Tauri installer path can be reproduced explicitly without changing default `tauri build` behavior
- Phase 6 validation passed for `npm run typecheck:renderer`, `npm run build`, `npm run dist:dev`, `npm run dist:installer`, `cargo check --manifest-path src-tauri-shell/Cargo.toml`, `npm run tauri:build`, and `npm run tauri:bundle:nsis`
- Bounded launch checks confirmed:
  - `release/win-unpacked/EOD Chart.exe` starts and exposes `EOD Chart`
  - `release/EOD Chart Setup 0.1.0.exe` starts and exposes `EOD Chart Setup`
  - `src-tauri-shell/target/release/eod-charting-platform-shell.exe` starts and exposes `EOD Chart`
  - `src-tauri-shell/target/release/bundle/nsis/EOD Chart_0.1.0_x64-setup.exe` starts and exposes `EOD Chart Setup`
- Seam-purity checks still confirm that no active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports but remain outside the active runtime path
- Phase 6 explicitly did not claim:
  - full interactive Tauri database/import/bhavcopy parity
  - full `npm run tauri:dev` debug-shell verification
  - macOS packaging, signing, notarization, or runtime validation
- The current cutover decision after Phase 6 is still **no-go** for making Tauri the default runtime because quote editor CRUD, merge-symbol flows, corporate-action writes, and macOS release readiness remain incomplete
- On March 28, 2026, Phase 5 was implemented by porting CSV import, bhavcopy download, and long-running progress/event flows behind `src/platform/*` using the fresh Tauri shell path at `src-tauri-shell`
- Added `src-tauri-shell/src/imports.rs` for Tauri-backed CSV file picking, preview, import execution, and `import:progress` event emission
- Added `src-tauri-shell/src/bhavcopy.rs` for Tauri-backed bhavcopy settings, single-date download, batch download, download logging, and `bhavcopy:progress` event emission
- Updated `src/platform/tauriDesktop.ts` so the Tauri business adapter now backs the Phase 5 import/download surface instead of rejecting it
- Updated `src-tauri-shell/src/main.rs` so the fresh shell now registers Phase 5 commands and forwards import/bhavcopy menu ids into the renderer
- Updated `src/components/CommandPalette.tsx` so Import Data and Download Bhavcopy are now available in Tauri while Quote Editor remains deferred
- Phase 5 validation passed for `npm run typecheck:renderer`, `cargo check --manifest-path src-tauri-shell/Cargo.toml`, `npm run build`, and `npm run tauri:build`
- Bounded launch checks confirmed that both the Electron fallback path and the rebuilt Tauri production shell still start and remain alive long enough to confirm shell/window startup
- Seam-purity checks still confirm that no active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports but remain outside the active runtime path
- The following flows intentionally remain Electron-only after Phase 5:
  quote editor CRUD, merge symbols, and corporate-action / identity-history mutation flows
- On March 28, 2026, Phase 4 was implemented by porting the database and persistence subset behind `src/platform/*` using the fresh Tauri shell path at `src-tauri-shell`
- Added `src-tauri-shell/src/database.rs` for the Tauri-backed persistence/backend subset:
  registry handling, DB lifecycle, migrations/defaults, settings, layouts, symbol reads, EOD reads, and watchlist CRUD
- Added `src/platform/tauriDesktop.ts` and updated `src/platform/desktop.ts` so the business-service bridge now resolves Electron first and then the Tauri persistence adapter when Electron is absent
- `src/store/chartStore.ts` now handles Tauri-driven database menu commands for create/open/close and reports backend availability in runtime-neutral language
- `src/components/CommandPalette.tsx` now suppresses Electron-only Phase 5 tools when the runtime is Tauri so unsupported flows are not exposed there
- Phase 4 validation passed for `npm run typecheck:renderer`, `npm run build`, `cargo check --manifest-path src-tauri-shell/Cargo.toml`, and `npm run tauri:build`
- The rebuilt fresh Tauri production shell executable still launched successfully and stayed alive long enough to confirm the window opens after the Phase 4 persistence work
- Seam-purity checks still confirm that no active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports but remain outside the active runtime path
- The following flows intentionally remain Electron-only after Phase 4:
  quote editor CRUD, merge symbols, corporate-action writes, CSV import, bhavcopy, and worker/event parity
- On March 28, 2026, Phase 3 was implemented by dual-wiring low-risk runtime services behind `src/platform/*`
- Added `src/platform/shell.ts` as the shell-facing runtime bridge for app metadata, external-link opening, runtime detection, and menu command subscriptions
- `src/store/chartStore.ts` now registers menu events through the shell bridge, so low-risk menu-driven UI behavior can work in both Electron and the fresh Tauri shell without changing renderer callers
- `electron/preload.ts` and `electron/ipc/handlers.ts` now expose Electron-backed shell helpers for `getAppInfo()` and `openExternal()`
- `src-tauri-shell/src/main.rs` now exposes low-risk Tauri commands for app info and external links, and emits existing menu command identifiers back into the renderer through `menu:command`
- Phase 3 validation passed for `npm run build`, `cargo check --manifest-path src-tauri-shell/Cargo.toml`, and `npm run tauri:build`
- The fresh production shell executable still launched successfully and opened an `EOD Chart` window after the Phase 3 runtime changes
- A bounded `npm run tauri:dev` re-check again reached Vite dev-server readiness, but full debug shell/window launch is still not claimed as verified
- Seam-purity checks confirmed that no active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`; the old legacy files `src/app.js` and `src/modules/*` still contain historical Tauri imports but remain outside the active runtime path. `window.electronAPI` usage remains isolated to the platform layer
- On March 28, 2026, Phase 2 was implemented by adding a fresh Tauri 2 shell under `src-tauri-shell`
- The legacy `src-tauri` tree was deliberately left untouched as legacy/disconnected reference and was not used as the migration baseline
- `package.json` now includes `tauri:dev`, `tauri:check`, and `tauri:build` scripts that run the CLI from `src-tauri-shell`
- `vite.config.ts` now uses `strictPort: true` so the fresh Tauri dev shell can reliably target `http://localhost:5173`
- The new shell builds the existing React frontend for production via `build.frontendDist = ../dist` and points development at the existing Vite dev server
- Phase 2 validation passed for `npm run build`, `cargo check --manifest-path src-tauri-shell/Cargo.toml`, and `npm run tauri:build`
- The fresh production shell executable `src-tauri-shell/target/release/eod-charting-platform-shell.exe` launched successfully and opened an `EOD Chart` window
- A bounded `npm run tauri:dev` check reached Vite dev-server readiness, but first-run debug compilation did not complete within the bounded validation window, so full dev-mode shell launch is not yet claimed
- On March 28, 2026, Phase 1 of the Electron-to-Tauri migration prep was implemented by adding a renderer-facing desktop abstraction under `src/platform/*`
- Active renderer call sites now route through `getDesktopApi()` from `src/platform/desktop.ts` instead of referencing `window.electronAPI` directly
- Direct renderer-to-Electron touchpoints were reduced to the platform bridge and the ambient Electron type file, which preserves the current Electron runtime while preparing for a future runtime swap
- Phase 1 touched `src/store/chartStore.ts`, import/layout/database tooling dialogs, and renderer type-only imports so the active UI now depends on platform types instead of Electron types where practical
- Phase 1 validation passed for `npm run typecheck:renderer`, `npm run typecheck:electron`, and `npm run build`
- A runtime smoke launch also reached Electron startup, window creation, and renderer load, but the data-driven smoke assertions could not complete because the fixture file `E:\TA Projects\EOD Downloader\output\NSE\EQ\19941103.csv` was missing on this machine
- On March 28, 2026, `electron/bhavcopy.ts` was fixed so NSE index bhavcopy downloads parse and import correctly
- Root cause was strict literal header matching (`INDEX_NAME`) against the live NSE index CSV headers (`Index Name`)
- The importer now normalizes headers, uses quote-aware CSV row splitting, and mirrors the working NSE index symbol logic from the Go downloader reference project
- On March 28, 2026, the bhavcopy skip logic was hardened so stale `download_log` entries no longer cause false `0 rows` skips when `eod_prices` has no matching data
- On March 28, 2026, `src/components/BhavcopyDownloadWindow.tsx` was restyled so the Activity Log follows the EOD Downloader pattern more closely with progress, counters, and simplified log lines
- On March 28, 2026, `electron/bhavcopy.ts` was updated to skip official NSE / NSE Index holidays for 2025 and 2026 instead of queueing predictable archive misses as failures
- The NSE holiday list includes the January 15, 2026 special closure announced by NSE circular `NSE/CMTR/72260`, while still allowing the October 21, 2025 Muhurat Trading session
- The bhavcopy importer now validates the actual CSV trade date and rejects responses whose internal date does not match the requested date, preventing previous-session data from being stored under a holiday date
- On March 28, 2026, existing invalid NSE holiday rows were removed from `EOD DATABASE/NSE/market-data.sqlite3`, along with the matching `download_log` entries, after a timestamped backup was created in `backups/`
- On March 28, 2026, the chart workspace UI was refreshed to feel closer to a TradingView/AmiBroker hybrid, with restored chart chrome, a denser header, and a cleaner chart container
- On March 28, 2026, the chart time axis was improved with larger axis gutters, adaptive date labels, vertical time-grid guides, and a clearer crosshair date label so dates remain readable
- On March 28, 2026, the bhavcopy dialog and main-process progress path were tuned to reduce Electron `Not Responding` freezes during large batch downloads by throttling progress traffic, removing per-task log spam, and disabling debug file dumps by default

## Latest Confirmed Direction
- The canonical project specification is now `EOD_CHART_CODEX_PROMPT_REVISED.md`
- The target stack is now Electron 31 + Vite 5 + React 18 + TypeScript 5 + `better-sqlite3`
- The target charting stack is now a custom HTML5 Canvas engine
- The current Tauri/Rust codebase remains in the repository, but it is no longer the architectural target
- The new renderer-side desktop contract lives under `src/platform/*` and is the required seam for any future Tauri work
- `src/platform/shell.ts` is now the shell/runtime bridge for low-risk dual-runtime services, while `src/platform/desktop.ts` remains the business-service bridge
- The fresh Tauri shell path is now `src-tauri-shell`, and it is the only Phase 2+ shell path that should be extended
- The fresh Tauri shell now also has a practical portable Windows workflow through `npm run tauri:portable:win` plus `Launch Portable EOD Chart.cmd`
- The old `src-tauri` tree remains legacy/disconnected and must not be used as the migration baseline
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md` and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` have been realigned to the revised prompt

## Active Strategic Priorities
- Use the revised prompt as the sole implementation spec for new work
- Avoid mixing the legacy Tauri implementation with the new Electron architecture in ad hoc ways
- Keep `src/platform/*` as the only renderer entry point for privileged desktop operations
- Use the portable Tauri workflow as the preferred Windows development base while keeping Electron as the release fallback
- Keep `src-tauri-shell` as the only active Tauri backend path while packaged interaction parity is still being proven
- Continue Windows-first feature development from the active repo-root app and portable Tauri shell rather than shifting into installer-first or macOS work yet
- Keep the symbol identity and DB lifecycle rules consistent from the beginning

## Important Saved Decisions
- Database lifecycle is explicit and supports multiple database files
- Recent databases are tracked outside the market-data DB in a registry file under app user data
- The app may start with no database open
- Instrument identity is always `{ symbol, exchange }`
- The local scaffold currently uses `better-sqlite3` `^12.8.0` for Node 24 compatibility
- The main process owns dialogs, DB open/create/close, schema, import, bhavcopy, and IPC
- The renderer owns UI state, search, watchlists, timeframe aggregation, and chart rendering
- The renderer should no longer call `window.electronAPI` directly outside `src/platform/desktop.ts` and `src/platform/shell.ts`
- Low-risk shell services can now be dual-wired, but business-critical flows remain Electron-backed until later phases
- v1 indicator scope is limited to SMA / EMA / Bollinger overlays
- The active drawing tool is intentionally global ephemeral UI state and should reset to `cursor` on chart/workspace transitions rather than persist per tab
- Magnet state is intentionally global and is currently treated as a chart-input preference, not a per-tab persisted property
- Unsupported features from the earlier prompt should remain out of scope

## Architectural Guardrails
- Do not reuse the current Tauri IPC or Rust command layer as the basis for new implementation work
- Do not port TradingView Lightweight Charts assumptions into the new chart engine
- Do not model app state around bare `symbol` keys
- Do not treat the old workspace/import-preset/chart-tab design as binding on the new prompt unless deliberately reintroduced
- Keep the new file structure aligned to the revised prompt before expanding feature work
- Keep future runtime adapters behind `src/platform/*` instead of introducing new direct runtime globals in renderer files
- Do not add direct Tauri imports to renderer files outside `src/platform/*`

## Last Completed Milestone
- Watchlist action discoverability fix completed on April 3, 2026: the Watchlists panel now exposes visible `New`, `Import`, and conditional `Update` actions in a compact control block without changing the underlying import/update/provider behavior

## Current Open Task
- Manual visual validation of the Watchlists-panel action discoverability fix in the portable Tauri runtime, then only low-risk follow-up fixes if any Import/Update visibility, action-state clarity, fallback, unresolved-symbol logging, or provider parsing edge cases appear

## Current Known Themes
- explicit multi-database lifecycle
- local SQLite-backed workflows
- exchange-aware symbol identity
- custom canvas chart rendering
- chart-first desktop UI
- prompt-driven scaffold-first implementation
- runtime abstraction before runtime swap
- dual-shell migration with explicit legacy isolation

## Files Most Recently Relevant
- `EOD_CHART_CODEX_PROMPT_REVISED.md`
- `package.json`
- `package-lock.json`
- `.gitignore`
- `tsconfig.json`
- `tsconfig.electron.json`
- `vite.config.ts`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/Cargo.lock`
- `src-tauri-shell/tauri.conf.json`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/imports.rs`
- `src-tauri-shell/src/bhavcopy.rs`
- `src-tauri-shell/src/runtime.rs`
- `scripts/prepare-tauri-portable.ps1`
- `src-tauri-shell/capabilities/default.json`
- `electron/db.ts`
- `electron/csvImporter.ts`
- `electron/ipc/handlers.ts`
- `electron/preload.ts`
- `electron/main.ts`
- `src/platform/desktop.ts`
- `src/platform/tauriDesktop.ts`
- `src/platform/shell.ts`
- `src/platform/types.ts`
- `src/platform/index.ts`
- `src/RootApp.tsx`
- `src/components/SheetTabs.tsx`
- `src/components/Sidebar.tsx`
- `src/store/chartStore.ts`
- `src/features/watchlists/officialWatchlistProviders.ts`
- `src/features/watchlists/officialWatchlistData.generated.ts`
- `src/engine/ChartEngine.ts`
- `src/engine/Crosshair.ts`
- `src/engine/ScaleManager.ts`
- `src/components/ChartCanvas.tsx`
- `src/components/ChartTabs.tsx`
- `src/components/ChartToolDock.tsx`
- `src/components/CommandPalette.tsx`
- `PORTABLE_WINDOWS_DEV_BASE_REPORT.md`
- `CHART_TOOLS_ADDITIONS_REPORT.md`
- `CHART_TOOLS_HARDENING_REPORT.md`
- `CHART_WORKSPACE_UX_STABILITY_REPORT.md`
- `PHASE7_MUTATION_PARITY_REPORT.md`
- `PHASE5_IMPORT_BHAVCOPY_PROGRESS_REPORT.md`
- `OFFICIAL_WATCHLIST_LIVE_SOURCE_REPORT.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Current Known Risks
- The repository still contains a healthy but now-legacy Tauri implementation that can confuse imports, file resolution, and future edits if treated as active code
- The repository now contains both `src-tauri` and `src-tauri-shell`, so future work must be explicit about which tree is legacy and which tree is active
- The fresh Tauri shell now forwards low-risk menu commands, but native menu parity is still intentionally partial and must not be mistaken for business-feature parity
- The fresh Tauri shell now owns the persistence subset, import/download flows, and mutation flows, but packaged interactive parity is still only partially verified and can still hide runtime gaps
- The supported portable workflow currently depends on the generated launcher setting `EOD_CHART_PORTABLE_ROOT`; bare executable launch is not the primary portable guarantee
- The official watchlist live-source path now depends on third-party NSE/BSE response structure remaining stable; provider parsers may need follow-up if those official pages or CSV headers change
- The bhavcopy flow is implemented, but runtime smoke-testing in the packaged Electron app is still needed after the NSE index parser fix
- The runtime smoke script currently depends on local fixture files under `E:\TA Projects\EOD Downloader\output\NSE\EQ`, so data-flow validation is environment-sensitive until fixtures are copied into the repo or the script is made self-contained
- The fresh Tauri production shell is validated, but the Tauri dev-mode shell has not yet been fully verified through first-run compile completion in a bounded check
- Windows packaged startup is now validated for both Electron and the fresh Tauri shell, but signed release readiness is still missing for both runtimes
- Tauri Windows installer generation now works through an explicit NSIS packaging step, but default `tauri build` still remains non-bundling by design
- macOS packaging, signing, notarization, and runtime validation are still entirely unproven from this repository state
- `electron/csvImporter.ts` is functional but still simplistic for some CSV edge cases outside the bhavcopy path
- The chart engine scaffold renders bars and interactions, but indicator overlays and some UX details are still incomplete
- The phase-1 chart-tools baseline is now harder and more internally consistent, but interactive manual validation of the new hover/readout and drawing behaviors is still only partial
- Active tool mode and magnet remain global by design, which keeps the current implementation low-risk but leaves full per-tab tool isolation explicitly deferred
- `resources/icon.ico` is currently only a placeholder file for packaging
- The legacy `src-tauri` tree still exists and must not be mistaken for the correct Phase 2 baseline

## Verification Snapshot
- Verified on March 31, 2026: `npm run typecheck:renderer` passes after the UI spacing fixes
- Verified on March 31, 2026: `npm run build` passes after the UI spacing fixes
- Verified on March 31, 2026: `npm run typecheck:renderer` passes after the chart gutter and tab-style fixes
- Verified on March 31, 2026: `npm run build` passes after the chart gutter and tab-style fixes
- Verified on March 31, 2026: `cargo build --release --manifest-path src-tauri-shell/Cargo.toml` passes and produces `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
- Verified on March 31, 2026: `npm run build` passes after the phase-1 chart-tools hardening pass
- Verified on March 31, 2026: no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly after the phase-1 chart-tools hardening pass
- Verified on March 31, 2026: `npm run build` passes after the chart-tools additions pass
- Verified on March 31, 2026: `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes after the chart-tools additions pass
- Verified on March 31, 2026: `npm run tauri:portable:win` passes after the chart-tools additions pass
- Verified on March 31, 2026: the staged portable executable `release/tauri-portable-win/EOD Chart Portable/EOD Chart.exe` still launches successfully in a bounded startup check after the chart-tools changes
- Verified on March 31, 2026: a bounded Electron fallback launch through `node_modules/electron/dist/electron.exe` still starts successfully after the chart-tools changes
- Verified on March 31, 2026: `Launch Portable EOD Chart.cmd` still updates `release/tauri-portable-win/EOD Chart Portable/portable-data/logs/app-runtime.log` during launch after the chart-tools changes
- Verified on March 31, 2026: no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly after the chart-tools changes
- Verified on April 4, 2026: the active Tauri shell now keeps one cached SQLite connection per active database folder instead of reopening and re-preparing SQLite on nearly every command
- Verified on April 4, 2026: `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes after introducing the managed active-connection cache in `src-tauri-shell/src/database.rs`
- Verified on April 4, 2026: `npm run tauri:portable:win` passes after the Tauri performance pass 1 backend change and refreshes `release/tauri-portable-win/EOD Chart Portable`
- Verified on April 4, 2026: the desktop contract now supports a lightweight snapshot path plus a dedicated `getDbStats()` call across both Electron and the active Tauri shell
- Verified on April 4, 2026: `chartStore.ts` now opens databases by applying a lightweight shell snapshot first, then loading watchlists and DB stats separately in the background
- Verified on April 4, 2026: normal symbol-browser listing now avoids the full in-memory alias/search catalog on both Electron and the active Tauri shell by using a direct SQL-backed no-query list path
- Verified on April 4, 2026: explicit symbol search now uses a fast SQL-first path before falling back to the heavier alias-aware ranking logic on both runtimes
- Verified on April 4, 2026: `chartStore.ts` now reuses recent EOD results for repeated symbol loads and sheet restores within the same active database path and adjusted/raw mode
- Verified on April 4, 2026: watchlist-only actions now refresh watchlists without re-requesting DB stats, and routine watchlist hydration now skips per-item instrument-name resolution on both Electron and the active Tauri shell
- Verified on March 28, 2026: `npm run typecheck:renderer` passes after the Phase 5 import/download adapter work
- Verified on March 28, 2026: `npm run dist:dev` passes and produces `release/win-unpacked/EOD Chart.exe`
- Verified on March 28, 2026: the unpacked Electron package launches successfully and exposes an `EOD Chart` window title in a bounded startup check
- Verified on March 28, 2026: `npm run dist:installer` passes and produces `release/EOD Chart Setup 0.1.0.exe`
- Verified on March 28, 2026: the Electron NSIS installer launches successfully and exposes an `EOD Chart Setup` window title in a bounded startup check
- Verified on March 28, 2026: `npm run tauri:bundle:nsis` passes and produces `src-tauri-shell/target/release/bundle/nsis/EOD Chart_0.1.0_x64-setup.exe`
- Verified on March 28, 2026: the Tauri NSIS installer launches successfully and exposes an `EOD Chart Setup` window title in a bounded startup check
- Verified on March 28, 2026: `npm run build` passes after the Phase 5 import/download work and Electron remains intact
- Verified on March 28, 2026: `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes after adding `src-tauri-shell/src/imports.rs` and `src-tauri-shell/src/bhavcopy.rs`
- Verified on March 28, 2026: `npm run tauri:build` passes after the Phase 5 import/download work
- Verified on March 28, 2026: the rebuilt fresh Tauri production shell executable launched successfully and stayed alive long enough to confirm the window opens after the Phase 5 import/download work
- Verified on March 28, 2026: a bounded Electron fallback launch still starts successfully after the Phase 5 changes
- Verified on March 28, 2026: no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly after the Phase 4 changes; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports
- Verified on March 28, 2026: `window.electronAPI` usage remains isolated to `src/platform/desktop.ts` and `src/platform/shell.ts`
- Verified on March 28, 2026: the fresh Tauri shell now compiles with the Phase 4 persistence subset plus the Phase 5 CSV preview/import, bhavcopy download, and progress-event surface
- Verified on March 28, 2026: `npm run build` passes after the Phase 3 shell/runtime bridge changes
- Verified on March 28, 2026: `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes after adding low-risk shell commands and menu event wiring
- Verified on March 28, 2026: `npm run tauri:build` passes after the Phase 3 runtime changes
- Verified on March 28, 2026: the fresh Tauri production shell executable launched successfully and opened an `EOD Chart` window after the Phase 3 runtime changes
- Verified on March 28, 2026: no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly after the Phase 3 bridge changes; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports
- Verified on March 28, 2026: `window.electronAPI` usage remains isolated to `src/platform/desktop.ts` and `src/platform/shell.ts`
- Verified on March 28, 2026: a bounded `npm run tauri:dev` run reached Vite dev-server readiness again, but full debug shell/window launch still was not confirmed within the bounded validation window
- Verified on March 28, 2026: `cargo check --manifest-path src-tauri-shell/Cargo.toml` passes for the fresh Tauri shell
- Verified on March 28, 2026: `npm run tauri:build` passes and builds `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
- Verified on March 28, 2026: the fresh Tauri production shell executable launched successfully and opened an `EOD Chart` window
- Verified on March 28, 2026: a bounded `npm run tauri:dev` run reached Vite dev-server readiness on `http://localhost:5173`
- Verified on March 28, 2026: no active React/TypeScript renderer file outside `src/platform/*` imports Tauri packages directly; legacy inactive files `src/app.js` and `src/modules/*` still contain historical imports
- Verified on March 28, 2026: `npm run typecheck:renderer` passes after the Phase 1 desktop abstraction refactor
- Verified on March 28, 2026: `npm run typecheck:electron` passes after the Phase 1 desktop abstraction refactor
- Verified on March 28, 2026: `npm run build` passes after the Phase 1 desktop abstraction refactor
- Verified on March 28, 2026: the Electron runtime smoke launch still reached startup, main-window creation, and renderer load after the Phase 1 refactor
- Verified on March 28, 2026: the runtime smoke script could not complete import/data assertions because `E:\TA Projects\EOD Downloader\output\NSE\EQ\19941103.csv` was missing in this environment
- Verified on March 28, 2026: `npm run typecheck:electron` passes after the NSE index bhavcopy parser fix
- Verified on March 28, 2026: `npm run build:electron` passes after the NSE index bhavcopy parser fix
- Verified on March 28, 2026: live NSE index archive headers such as `Index Name` now map correctly in `electron/bhavcopy.ts`
- Verified on March 28, 2026: a real Electron backend smoke test imported 130 `NSE_INDEX` rows for March 27, 2026 into a fresh throwaway database and returned chartable `NIFTY` data
- Verified on March 28, 2026: a stale-log regression test proved the app now re-downloads data when `download_log` says `ok` but `eod_prices` has no matching rows
- Verified on March 28, 2026: the Electron desktop app stayed running through startup during a smoke launch and did not exit early
- Verified on March 28, 2026: `npm run build` passes after the chart-shell and date-axis refresh
- Verified on March 28, 2026: the Electron desktop app stayed running through startup during a second smoke launch after the chart UI refresh
- Verified on March 28, 2026: `npm run build` passes after the bhavcopy freeze mitigation changes
- Verified on March 20, 2026: `EOD_CHART_CODEX_PROMPT_REVISED.md` exists in the workspace root
- Verified on March 20, 2026: project brief/state/next-thread docs now point at the revised prompt
- Verified on March 20, 2026: `npm install --no-audit --no-fund` completed successfully after aligning `better-sqlite3` with the local Node 24 runtime
- Verified on March 20, 2026: `npm run build` passes for renderer typecheck, Electron typecheck, Electron compile, and Vite production build
- Verified on March 20, 2026: root Electron scaffold files now coexist with the legacy Tauri implementation

## What Still Needs Attention

> **Historical migration checklist.** This section predates the August 10 post-Bhavcopy handoff and is retained as append-only history. Current priorities and invariants are defined at the top of this file and in `HANDOFF.md`. In particular, the older NSE Bhavcopy exclusion/fresh-database items below are superseded: supported NSE equity/trade-for-trade/SME series remain broadly ingested with series metadata, and normal series filtering belongs in Symbols/sidebar browsing.
- [x] Replace the bhavcopy stub with a real download/unzip/import implementation
- [x] Fix NSE index bhavcopy parsing against live NSE archive headers
- [x] Harden CSV preview/import for quoted values, malformed rows, and better progress/error reporting
- [x] Introduce a renderer-side desktop abstraction and isolate direct Electron global access
- [x] Build a fresh Tauri 2 shell around the active React app without reusing the legacy `src-tauri` implementation as the baseline
- [x] Add low-risk dual-runtime shell services behind `src/platform/*` for app info, external links, and menu command forwarding
- [x] Port the Phase 4 database/persistence subset behind `src/platform/*` for the fresh Tauri shell
- [x] Port the Phase 5 CSV import, bhavcopy, and long-running progress/event subset behind `src/platform/*` for the fresh Tauri shell
- [ ] Smoke-test create/open/close database flows interactively in the fresh Tauri shell
- [ ] Smoke-test CSV import and bhavcopy flows interactively in the fresh Tauri shell
- [x] Port quote editor CRUD into the fresh Tauri shell and through the platform seam
- [x] Port merge-symbol flows into the fresh Tauri shell and through the platform seam
- [x] Port corporate-action / identity-history mutation flows into the fresh Tauri shell and through the platform seam
- [ ] Implement NSE symbol exclusion/filter rules in the bhavcopy download/import flow (rules are already designed).
- [ ] Create a fresh clean database after NSE filters are implemented and re-import data cleanly.
- [ ] Validate DB stats, Quote Editor, charts, and Binary EOD Parity Audit against the fresh database.
- [ ] Smoke-test quote editor CRUD interactively in the packaged Tauri shell.
- [ ] Smoke-test merge-symbol flows interactively in the packaged Tauri shell
- [ ] Smoke-test corporate-action / identity-history mutation flows interactively in the packaged Tauri shell
- [ ] Validate the portable Tauri workflow on a second Windows machine with WebView2 already present or freshly installed
- [ ] Validate signed packaged installers on Windows instead of unsigned startup-only checks
- [ ] Validate macOS `.app` / `.dmg` packaging, signing, notarization, and runtime behavior on a Mac host
- [x] Split the desktop snapshot path so shell state can load before DB stats and watchlists
- [x] Stop rebuilding the full symbol-search catalog for normal sidebar/symbol-browser usage
- [x] Add a recent-symbol EOD cache and reduce sheet-switch rehydration churn
- [ ] Finish indicator overlay rendering and remaining chart UX gaps beyond the date-axis and chart-shell refresh
- [x] Add the next chart-tools usability pass for crosshair clarity, hover readout, and primary drawing-tool workflow
- [ ] Manually smoke-test the new chart-tool interactions inside the portable Tauri runtime
- [ ] Decide whether the next chart-tools pass should focus on advanced-tool UX, drawing-object management, or stronger edit handles
- [ ] Fully verify `npm run tauri:dev` through first-run compile and shell/window load without a bounded-time shortcut
- [ ] Make the runtime smoke test fixture path self-contained so it can run on any machine without external data dependencies

## Next Technical Priority

> **Historical priority note.** The line below records the earlier migration priority and is not the current handoff. The current next priority is the intermittent SMA Daily-state/value-scale audit documented at the top of this file and in `HANDOFF.md`.

- Prefer full Tauri runtime/package validation now that `chartStore.ts` is down to a thin shell, then take the next isolated `ChartCanvas.tsx` seam while preserving the current Tauri-only runtime seam, chart behavior, watchlists, Sheets, and sidebar behavior

## Handoff Note

For future Claude sessions, use:

- `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`

Do not use `EOD_CHART_CODEX_PROMPT_REVISED.md` alone as the current implementation baseline.

<!-- V1.13-FINAL-CLOSEOUT:BEGIN -->
## Corporate Actions Phase 1 — V1.13 six-row identity repair closeout (2026-08-19)

### Latest verified Corporate Actions state

- V1.13B-1 six-row historical ISIN repair: **CLOSED / FULL_SUCCESS**.
- Preflight authority: `tmp/corporate-action-v1-13b-1-preflight_20260818_144646_557/reports`.
- Apply evidence: `tmp/corporate-action-v1-13b-1-apply_20260818_170635_303/reports`.
- Verified pre-write backup: `backups/pre_corporate_action_v1_13b1_apply_20260818_170635_303`.
- Independent post-audit: `tmp/corporate-action-v1-13c-1-2-1-post-audit_20260819_003421_289/reports`.
- Final audit result: 6 authorized history additions, 8 protected imports unchanged, 0 forbidden table changes, 0 Corporate Action status promotions, 0 Quick Resolves, 0 approvals, 0 database writes by the audit.
- SQLite checkpoint compatibility was explicitly audited: the committed live state was main-only; the historical Preflight semantic baseline used exact main DB + WAL while treating SHM as transient WAL-index state.
- Remaining Corporate Actions identity scope: eight protected imports only. No blanket identity repair is authorized for them.
<!-- V1.13-FINAL-CLOSEOUT:END -->

<!-- V1.14E-SOURCE-IMPLEMENTATION:BEGIN -->
## Corporate Actions Phase 1 — V1.14E source implementation boundary (2026-08-19)

- Approved design: dedicated historical event-identity resolution state; raw import identity remains immutable.
- Exact source authority: 184 events / 44 NSE symbol-transition chains, all raw-source verified by V1.14D.1.
- Source implementation includes: embedded exact authority, resolution projection/store, read-only Tauri API, Split/Bonus event-symbol projection, UI provenance display, controlled Preflight/Apply maintenance path, and independent post-audit tooling.
- First-tranche Apply semantics: resolution-table rows only; `corporate_action_imports` updates 0; decision rows 0; Quick Resolves 0; approvals 0.
- Automatic startup migration of the V1.14E table is forbidden in this tranche.
- Current live-database state remains **NOT APPLIED** until a separately reviewed Preflight and explicit live-write approval.
<!-- V1.14E-SOURCE-IMPLEMENTATION:END -->

<!-- V2-P0-SECURITY-LISTING-PRICE-STREAM:BEGIN -->
## Approved future architecture — Security / Listing / Price-Stream V2

**Status: DOCUMENTATION FROZEN / APPROVED FUTURE ARCHITECTURE / IMPLEMENTATION NOT STARTED.**

V2 is a bounded future redesign of the instrument/price identity and binary-storage keying layer for **NSE, BSE, NSE_INDEX, and BSE_INDEX**. It introduces `security_id`, `listing_id`, and `price_stream_id`, exchange-specific NSE Series/BSE Group classification, EOD2 shadow storage, and the invariant that Index Series is **not applicable** rather than `No series`.

Current production authority is unchanged: **EOD1 + Generation 6 + current SQLite/current runtime behavior**. No V2 reader/writer/schema migration has been promoted.

Authoritative V2-P0 documents:

- `docs/architecture/SECURITY_LISTING_PRICE_STREAM_V2_ARCHITECTURE_R1.md`
- `docs/architecture/EOD2_PRICE_STREAM_STORAGE_SPEC_R1.md`
- `docs/architecture/SECURITY_IDENTITY_V2_MIGRATION_AND_COMPATIBILITY_R1.md`
- `docs/plans/SECURITY_LISTING_PRICE_STREAM_V2_IMPLEMENTATION_PLAN_R1.md`
- `docs/architecture/decisions/ADR-001-security-listing-price-stream-identity.md` through `ADR-006-corporate-action-security-boundary.md`

Evidence binding: 2026-09-06 source snapshot SHA-256 `1E45A2F8CF8D0C69ABA1E4813B46018EA57ED72A8D9F0191DAA1F0F2056539A0`; R2 evidence ZIP SHA-256 `0992F1DDBA3CA33181FB916020D1738761AB5000D127DD037A8A3AF96E557DF5`; R3 evidence ZIP SHA-256 `403E75701DA18EBB662E8D600192F83EF7019E12BE1F59F512E8ADFC176548E4`.
<!-- V2-P0-SECURITY-LISTING-PRICE-STREAM:END -->

<!-- CA-R1A-2026-09-24:BEGIN -->
## Corporate Actions — R1-A reconciliation current state (24 September 2026)

- R1-A source implementation and copy-local real-cohort acceptance are **CLOSED / CURRENT**.
- Accepted evidence SHA-256: `E730F28CCD592FA0FB2A4A32118EA1A150B83E35E9188B9B415A3FC02443B2DA`.
- Fresh Snapshot V3 authority: `Eod Charting Platform Source Code 2026-09-24_201002_IST.zip`, SHA-256 `B4C3E9AB71B79B2E3F9B0A703E43EF68F56B0DC89B655244BBC606634AF03719`.
- Live source inventory: **569**; protected source: **563**.
- R1-A added the backend read-only reconciliation preflight, diagnostic panel integration, CSV export and tab-separated TXT export.
- Current 112-row result: `REPAIR_CANDIDATE=10`, `CLASSIFICATION_REVIEW=43`, `EVIDENCE_BLOCKED=59`.
- `databaseComplete=false`; historical `coverageCertification=NOT_ASSESSED`.
- R1-A executed **0 repairs** and **0 approvals**.
- Existing Auto-Approval Safe V1, manual approval, `PENDING_ISIN_MISMATCH`, AUTO-ID1, 20MICRONS, duplicate protection and raw-price adjustment-on-read remain preserved.
- R1-B deterministic repair/TDD is **NOT STARTED**.
- R1-C controlled TEST-DB apply/portable acceptance is **NOT STARTED**.

Current authority document: `docs/superpowers/specs/2026-09-24-corporate-action-reconciliation-r1a-current-authority.md`.
<!-- CA-R1A-2026-09-24:END -->
