# EOD Charting Platform — BananaPatterns Source-Specific Read-Only Audit

**Audit timestamp:** 25 August 2026, 00:25 IST  
**Audit mode:** Static, read-only source review  
**Project represented by snapshot:** `E:\TA Projects\EOD Charting Platform`  
**Supplied archive:** `c8f8205f-7c65-4896-be0e-586c449619e2.zip`  
**Archive SHA-256:** `D15A1165C9BDAEC4F764048DA2E469A7245114D4AD18A5ACC5856463F1D470B9`  
**Snapshot folder label:** `Eod Charting Platform Source Code 2026-08-25_001225_IST`

---

## 1. Objective, scope, and constraints

### Goal

Determine how the publicly observed BananaPatterns workflow can fit the actual EOD Charting Platform source without duplicating existing capabilities or disturbing current Corporate Action work.

### Scope

- Application architecture
- Scanner definitions and execution
- Historical pattern evaluation
- Scanner workspaces and result handling
- Chart overlays and Pattern Map
- Symbol search and identity resolution
- Watchlists
- Market Movers
- Data provenance and database boundaries
- Test inventory
- Backtesting, breadth, sector, and industry feature gaps

### Constraints

- Read-only audit only
- No source edits
- No database access or database writes
- No Corporate Action implementation changes
- No test, typecheck, build, Rust check, package, or executable run
- No assumptions that this snapshot remains current after the separate Corporate Action work advances

### Files inspected first

- `AGENTS.md`
- `README.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `package.json`
- `src-tauri-shell/Cargo.toml`
- `src/`
- `src-tauri-shell/`

---

## 2. Executive conclusion

The source-specific conclusion is narrower and more favorable than the earlier public comparison:

> The EOD Charting Platform already has the scanner engine, chart-pattern library, worker execution, geometry model, chart-overlay bridge, saved scanner configurations, alerts, full-universe Market Movers foundation, historical identity aliases, and custom Canvas renderer needed for a BananaPatterns-style research workflow.

The platform therefore does **not** need:

- a second chart renderer;
- KLineChart;
- a replacement scanner engine;
- a parallel watchlist system;
- a new pattern geometry format built from zero;
- strategy logic embedded into the chart renderer.

The primary missing layer is:

> **Technical Scan Persistence, Provenance, and Lifecycle**

This layer should wrap the existing scanner rather than replace it. It should record immutable scan runs and observations, project them into durable pattern occurrences, compute run-to-run changes, and expose deterministic explanations through a dedicated inspector.

The implementation should be deferred until the separate Corporate Action work reaches a confirmed checkpoint and a newer source snapshot is verified. The current audit snapshot should not be used as an implementation base after Corporate Action changes continue.

---

## 3. Snapshot integrity and static inventory

### Confirmed

| Item | Result |
|---|---:|
| Archive integrity test | PASS (`unzip -tq`) |
| Archive entries | 851 |
| Extracted regular files | 727 |
| Extracted directories, including root | 125 |
| Files under `src` and `src-tauri-shell` | 479 |
| Archive size | 4,904,115 bytes |
| Archive SHA-256 | `D15A1165...D470B9` |

### Architecture confirmed from source

- React 18 + TypeScript + Vite frontend
- Tauri 2 + Rust backend
- SQLite metadata and operational store
- Hybrid SQLite/binary EOD price storage
- Custom Canvas chart engine under `src/engine`
- Zustand application state
- Renderer-side technical scanner subsystem
- Worker-backed chart-pattern history evaluation
- Read-only backend batch route for Market Movers
- Corporate-action adjustment engine shared by chart and batch data paths

### Large active source hotspots

Static line counts identified these relevant hotspots:

| File | Approximate lines | Audit implication |
|---|---:|---|
| `src/engine/ChartEngine.ts` | 4,901 | Mature renderer; do not replace for this workflow |
| `src/engine/Renderer.ts` | 4,827 | Mature renderer; avoid strategy coupling |
| `src/plugins/scanner/chartPatternScanners.ts` | 4,950 | Broad detector library already exists |
| `src/components/Sidebar.tsx` | 3,440 | Search/watchlist UI hotspot |
| `src/components/ChartCanvas.tsx` | 2,955 | Overlay adaptation is already embedded here |
| `src/components/ScannerWindow.tsx` | 2,618 | New lifecycle UI should not be added monolithically |
| `src-tauri-shell/src/database/corporate_action_imports.rs` | 12,915 | Corporate Action area is high-risk and out of scope |

The generated official-watchlist data files are larger but are data payloads rather than active architectural hotspots.

---

## 4. Existing capabilities that should be reused

## 4.1 Scanner plugin and detector library

Relevant files:

- `src/plugins/scanner/types.ts`
- `src/plugins/scanner/scannerPlugin.ts`
- `src/plugins/scanner/scannerRunner.ts`
- `src/plugins/scanner/dailyMarketScanners.ts`
- `src/plugins/scanner/coreOhlcvScanners.ts`
- `src/plugins/scanner/chartPatternScanners.ts`
- `src/plugins/scanner/signalScanners.ts`

The bundled scanner plugin already registers:

- five daily-market definitions;
- ten core OHLCV definitions;
- a large chart-pattern family generated from several definition groups;
- signal/crossover definitions and custom signal rules.

`ScannerDefinition` already carries:

- stable scanner ID;
- name and category;
- priority;
- scanner type;
- human-readable description and logic;
- required data;
- suggested output columns;
- chart-pattern metadata;
- safety notes and limitations.

`ScannerResult` already carries:

- symbol and exchange;
- scanner identity;
- match date;
- direction and score;
- reasons;
- structured values;
- pattern details and geometry;
- warnings;
- historical episode summary.

This is a strong base for deterministic explanation and durable observations. It should be extended, not replaced.

## 4.2 Worker-backed historical pattern evaluation

Relevant files:

- `src/plugins/scanner/chartPatternEvaluation.ts`
- `src/plugins/scanner/chartPatternEvaluation.worker.ts`
- `src/plugins/scanner/chartPatternWorkerClient.ts`

The application can evaluate chart-pattern definitions over historical endpoints without blocking the main UI thread. Responsive and fast execution modes are tested for equivalent output, and cancellation is propagated into active history evaluation.

This is directly reusable for historical pattern occurrence generation.

## 4.3 Pattern Map and chart navigation

Relevant files:

- `src/plugins/scanner/scannerPatternMap.ts`
- `src/components/ScannerWindow.tsx`
- `src/components/ChartCanvas.tsx`
- `src/store/uiStore.ts`

The platform already supports:

- scanner result to chart navigation;
- levels such as breakout, support, resistance, and neckline;
- structured zones, trend lines, pivots, labels, and projections;
- same-date marker clustering;
- read-only scanner geometry overlays;
- promotion of supported range geometry into editable native drawings.

The renderer therefore already consumes structured scanner geometry through a drawing adapter. No second renderer is justified.

## 4.4 Saved scanner workspaces

Relevant file:

- `src/plugins/scanner/scannerWorkspace.ts`

Versioned scanner workspace configuration already persists:

- exchange;
- universe source;
- selected watchlists;
- selected scanners;
- lookback;
- maximum symbols;
- execution mode;
- result filters and view;
- priority filters and sort;
- active scanner section.

This is functionally similar to saved scanner screens. The missing piece is persistence of actual runs and outcomes, not persistence of scan configuration.

## 4.5 Alerts

Relevant files:

- `src/features/alerts/eodAlerts.ts`
- `src/features/alerts/indicatorAlertContracts.ts`
- `src/components/AlertManagerWindow.tsx`

Price, indicator, drawing, and scanner-match alerts already converge into persisted alert rules and history. Future pattern lifecycle alerts should reuse this alert subsystem rather than create another notification mechanism.

## 4.6 Market Movers batch architecture

Relevant files:

- `src-tauri-shell/src/database/daily_market_snapshot.rs`
- `src/features/marketMovers/marketMoversSnapshotService.ts`
- `src/features/marketMovers/marketMoversSnapshot.worker.ts`
- `src/features/marketMovers/marketMoversStore.ts`

Market Movers provides a strong precedent for full-universe technical processing:

- dedicated read-only SQLite connection;
- active NSE/BSE universe selection;
- bounded history;
- request-scoped cancellation;
- progress events;
- explicit failures;
- database identity and revision;
- common modal market date and coverage diagnostics;
- deterministic ranking;
- worker-side filtering and ranking;
- corporate-action warning classification.

A future full-universe technical scan route should reuse these operational patterns.

## 4.7 DNN research export provenance precedent

Relevant files:

- `src-tauri-shell/src/database/dnn_research_export.rs`
- `src/plugins/forecast/dnnTrend/dnnResearchDatasetExportService.ts`
- `resources/dnn-trend/`

The DNN research export already demonstrates:

- a read-only backend route;
- canonical symbol resolution;
- hybrid price loading;
- explicit adjustment settings;
- a versioned manifest;
- output failures;
- atomic publication outside source directories.

This is the best existing design precedent for technical scan and future backtest manifests.

---

## 5. BananaPatterns capability mapping against the actual source

| Workflow capability | Current EOD source | Assessment |
|---|---|---|
| Rule-based EOD scanner | Implemented | Reuse |
| Large chart-pattern library | Implemented | Reuse |
| Background pattern evaluation | Implemented for chart-pattern history | Reuse |
| Pattern geometry on chart | Implemented | Reuse and extract adapter |
| Saved scanner screens | Implemented as scanner workspaces | Reuse |
| Scanner-to-chart navigation | Implemented | Reuse |
| Historical grouped episodes | Implemented in memory for chart patterns | Partial |
| Confirmed versus developing states | UI vocabulary exists; output is confirmed only | Missing detector semantics |
| Daily “what changed” feed | Not present | Add |
| Durable scan-run history | Not present | Add |
| Rule/data/adjustment provenance | Market Movers partial; scanner absent | Add |
| Plain-language explanation | `reasons` and `values` exist; no unified inspector | Extend |
| State-aware research watchlist | Basic watchlists only | Extend later |
| Alias-aware search | Historical symbol/name matching exists | Partial |
| ISIN quick search | Not implemented in general quick search | Add |
| Stable canonical instrument ID | Not present; symbol + exchange is canonical key | Long-term migration |
| Market movers | Implemented | Reuse |
| Market breadth and rotation | Not present | Add later |
| Sector/industry analytics | Schema fields and official groups exist; analytics absent | Add later |
| Portfolio backtesting | Not present | Separate later phase |
| Point-in-time universe | Not present for technical research/backtests | Required before credible backtesting |

---

## 6. Critical findings

## 6.1 Scanner price semantics are implicit and currently raw

**Severity:** High data-semantics risk  
**Confirmed behavior:** Preserved by current tests

`scannerRunner.ts` calls `getEodData` with symbol, exchange, and optional end date, but does not pass `adjusted`, dividend, or rights settings.

`src-tauri-shell/src/database/eod_data.rs` defaults:

```text
adjusted = false
includeDividendAdjustments = false
includeRightsAdjustments = false
```

`scannerHistory.test.ts` explicitly expects the call without an adjustment flag. This means the behavior is not accidental from a test perspective.

By contrast, `daily_market_snapshot.rs` defaults Market Movers to adjusted bars, excluding dividend and rights adjustments unless selected.

### Consequences

- General scanner and Market Movers can evaluate different price semantics.
- Long-horizon pattern results can be affected by split, bonus, demerger, rights, or dividend discontinuities.
- A scanner result does not state whether it used raw or adjusted data.
- A saved workspace cannot record price mode.
- A future durable result would be irreproducible without adding these fields.

### Recommendation

Do **not** silently change the existing default. Preserve raw mode initially and add an explicit scanner price-mode contract:

```text
Raw — current behavior
Adjusted — capital actions
Adjusted + dividends
Adjusted + rights
```

Every run and observation must record the selected mode. A later decision to change the default should require comparison runs and approval after Corporate Action stabilization.

## 6.2 Scanner runs and results are transient

**Severity:** High product and research gap

`ScannerWindow.tsx` keeps `results` in local React state. It clears results at the start of a run and replaces them when the run completes. Scanner workspaces persist configuration only.

Missing durable fields include:

- run ID;
- prior run ID;
- scanner/plugin version;
- rule version or rule hash;
- database identity and revision;
- adjustment mode;
- universe snapshot;
- canonical identity revision;
- Corporate Action revision;
- target-level failures;
- immutable observations;
- lifecycle transitions.

This prevents a true daily change feed, audit trail, reproducible historical comparison, and reliable backtest input.

## 6.3 Existing `scan_runs` is a Corporate Action table

**Severity:** High integration risk

The SQLite schema already contains:

- `scan_runs`
- `corporate_action_scan_results`

`scan_runs` is used by `corporate_action_imports.rs` and is semantically coupled to Corporate Action price validation.

### Recommendation

Do not reuse or generalize this table during ongoing Corporate Action work. Use an isolated namespace:

- `technical_scan_runs`
- `technical_scan_observations`
- `technical_pattern_occurrences`

Any later consolidation into a generic run framework should be a separately approved migration after Corporate Action closure.

## 6.4 “Developing” is not currently produced

**Severity:** Medium, but important for BananaPatterns parity

`ScannerPatternMapStatus` allows `confirmed | developing`, and the UI exposes both filters. However, `buildScannerPatternMapEntries` always assigns `confirmed`, and the UI explicitly states that developing output is reserved for a later candidate phase.

Current detector contracts are primarily binary: matched result or no result. They cannot honestly explain a forming/developing setup because they do not return failed criteria or near-match measurements.

### Recommendation

Implement lifecycle in two stages:

**Stage 1 — no detector redesign**

- confirmed active;
- no longer detected;
- reappeared;
- superseded by data revision;
- invalidated by identity/adjustment revision.

**Stage 2 — explicit candidate contracts**

- developing;
- triggered;
- progressing;
- failed;
- completed.

Do not infer “developing” from arbitrary score thresholds. Each supported scanner must provide explicit candidate criteria and blocking reasons.

## 6.5 Historical episode grouping is useful but not a durable occurrence model

**Severity:** Medium

Historical chart-pattern output groups continuous matches using:

```text
scannerId + direction
```

When a group remains active, only `lastMatchedDate` and `matchCount` are updated. The first result’s reasons, values, score, and geometry remain the stored representation for the episode.

### Consequences

- Evolving geometry and measurements inside one active episode are not retained.
- The grouped result is not an immutable per-date observation ledger.
- A detector whose anchors shift while remaining matched can display the first geometry rather than the latest or complete history.
- Only chart-pattern definitions receive all-history endpoint evaluation; core/daily/signal families remain latest-endpoint evaluations.

### Recommendation

Persist immutable observations per run/date, then derive occurrence episodes as a rebuildable projection. Occurrence matching should use a scanner-specific fingerprint that can include pattern anchors, family, direction, and rule version—not only scanner ID and direction.

## 6.6 Full-universe general scanning is not yet an after-close batch system

**Severity:** Medium for BananaPatterns-style operation

The general scanner:

- runs from the renderer;
- calls `getEodData` sequentially for each target;
- defaults the symbol-list universe to 50 symbols;
- allows larger watchlist universes but still processes one target at a time;
- uses the worker only for chart-pattern evaluation after each symbol’s data is loaded.

This is adequate for interactive and bounded scans. It is not yet the same operational model as a scheduled full-market after-close materialization.

### Recommendation

Use the Market Movers backend architecture as the precedent, but stream bounded symbol batches to the existing TypeScript worker instead of returning the whole market and full 800-bar histories in one payload.

A safe target flow is:

```text
Read-only backend connection
    ↓
Resolve explicit universe snapshot
    ↓
Load 25–100 instruments per chunk
    ↓
Return bars + resolved identity + adjustment flags + failures
    ↓
Evaluate existing scanner definitions in worker
    ↓
Persist immutable observations
    ↓
Project lifecycle and daily differences
```

## 6.7 Canonical identity remains symbol + exchange

**Severity:** Medium-to-high long-term design risk

Frontend `InstrumentKey`, the `instruments` primary key, `eod_prices`, watchlists, and Corporate Actions use symbol + exchange as the canonical key.

The database has strong supplementary identity evidence through:

- `instrument_identity_history`;
- `instrument_isin_history`;
- alias-aware resolution;
- current symbol projection.

However, there is no stable, surrogate `instrument_id` carried through the application contract.

### Recommendation

Do not perform a broad identity-key migration while Corporate Action work is active. For the first technical-scan persistence phase, record an identity snapshot:

- requested symbol/exchange;
- resolved current symbol/exchange;
- ISIN where available;
- lifecycle status;
- identity revision or source hash.

A stable `instrument_id` migration should be a separate, fully tested program after current identity and Corporate Action work closes.

## 6.8 Quick search does not fully expose available identity evidence

**Severity:** Medium UX gap

Confirmed strengths:

- historical symbols and former names are included in fallback ranking;
- results can carry `resolvedFromAlias`, `matchedSymbol`, and `matchedName`;
- the full Symbol Browser includes inactive instruments;
- the Symbol Browser parses `NSE:` and `BSE:` prefixes.

Confirmed limitations:

- quick search excludes inactive instruments;
- direct SQL search checks current symbol and current name only;
- ISIN is not a search criterion;
- direct results can return before alias ranking when 20 or more matches exist;
- Command Palette does not display alias match reason, lifecycle status, or ISIN;
- Command Palette quick search does not parse exchange prefixes itself;
- there is no typo tolerance or normalized punctuation/`&` versus `AND` handling.

These can be improved without waiting for a stable `instrument_id` migration.

## 6.9 Watchlists are symbol collections, not research-state collections

**Severity:** Medium expansion gap

`watchlist_items` stores:

- watchlist ID;
- symbol;
- exchange;
- added timestamp;
- sort order.

The frontend item adds only name. There is no note, tag, added reason, related scanner occurrence, stage at addition, or last evaluated run.

### Recommendation

Preserve the existing watchlist schema initially. Add separate research metadata only after durable occurrence IDs exist. Do not overload official-source watchlists with strategy state.

## 6.10 Backtesting and market breadth are genuinely absent

**Severity:** Not a defect; confirmed future scope

Static source search found no portfolio backtesting engine, trade ledger, equity curve, walk-forward engine, or strategy execution model.

Likewise, no market-breadth, sector-strength, industry-strength, or rotation analytics module was found. The schema contains sector and industry fields, and official sector/index groups provide useful universe metadata, but analytical aggregation is not implemented.

These should remain later phases. Backtesting should not precede durable run provenance, explicit price semantics, point-in-time universe support, and inactive/delisted instrument handling.

---

## 7. Recommended target architecture

## 7.1 Preserve the current detection layer

Keep:

- `ScannerDefinition`
- existing detector functions
- worker-backed chart-pattern evaluation
- `ScannerResult.reasons`
- `ScannerResult.values`
- pattern geometry
- scanner alerts
- scanner workspaces
- scanner-to-chart navigation

Add explicit version/provenance fields around them rather than rewriting them.

## 7.2 Add isolated technical-scan persistence

Recommended logical tables:

### `technical_scan_runs`

One immutable run manifest.

Suggested fields:

```text
id
started_at
completed_at
status
prior_run_id
as_of_date
universe_type
universe_snapshot_json
scanner_plugin_id
scanner_plugin_version
scanner_rule_manifest_json
lookback_bars
price_mode
include_dividend_adjustments
include_rights_adjustments
resolve_identity
database_identity
database_revision
identity_revision
corporate_action_revision
target_count
scanned_count
match_count
error_count
message
```

### `technical_scan_observations`

Immutable result or explicit target outcome for one run, instrument, and scanner.

Suggested fields:

```text
id
run_id
scanner_id
rule_version
requested_symbol
requested_exchange
resolved_symbol
resolved_exchange
isin_snapshot
observation_date
match_status
direction
score
reasons_json
values_json
geometry_json
warnings_json
error_message
occurrence_fingerprint
```

### `technical_pattern_occurrences`

Rebuildable projection that links observations into research episodes.

Suggested fields:

```text
id
scanner_id
rule_version
resolved_symbol
resolved_exchange
isin_snapshot
fingerprint
first_seen_run_id
last_seen_run_id
first_observation_date
last_observation_date
current_state
state_changed_at
latest_observation_id
closed_run_id
```

The immutable observations remain the audit source of truth; occurrences are a derived convenience projection.

## 7.3 Add explicit scanner run contracts

A future request should contain at least:

```ts
interface TechnicalScanRunRequest {
  targets: ScannerRunTarget[];
  scannerIds: string[];
  lookbackBars: number | null;
  asOfDate: string | null;

  priceMode: 'raw' | 'adjusted';
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  resolveIdentity: boolean;

  evaluateHistory: boolean;
  executionMode: 'responsive' | 'fast';
}
```

The output should include a run manifest rather than only arrays of results and errors.

## 7.4 Extract the chart adapter, not the renderer

`ChartCanvas.tsx` currently converts scanner geometry into native `ChartDrawing` objects. This proves the adapter approach works, but the conversion code is located inside an already large component.

Recommended extraction:

```text
src/features/analysisOverlays/scannerOverlayAdapter.ts
```

Responsibilities:

- scanner geometry to native drawings;
- stable overlay IDs;
- chart instrument matching;
- read-only versus editable conversion;
- marker clustering;
- later Corporate Action/fundamental event overlays through separate adapters.

No `src/engine` redesign is required.

## 7.5 Add a deterministic Analysis Inspector

Use existing `reasons`, `values`, metadata, history, and geometry.

Recommended sections:

```text
Overview
Rule evidence
Measurements
Pattern geometry
Run provenance
Occurrence history
Peers — later
Corporate Action context — read only
Fundamentals — later
```

The explanation should be deterministic and traceable to stored fields. It should not depend on a generative model.

## 7.6 Add daily change projection

Once two compatible runs exist, derive:

```text
NEW CONFIRMED
STILL ACTIVE
NO LONGER DETECTED
REAPPEARED
RESULT CHANGED AFTER DATA REVISION
RESULT CHANGED AFTER IDENTITY REVISION
RESULT CHANGED AFTER ADJUSTMENT REVISION
RUN FAILED / INCOMPLETE
```

Candidate-aware statuses such as developing and triggered should be added only after the relevant scanner contracts can emit explicit candidate evidence.

---

## 8. Safe implementation sequence after Corporate Action checkpoint

## Phase 0 — source re-verification

1. Obtain a new snapshot after the separate Corporate Action work reaches a confirmed checkpoint.
2. Compare it against this audit snapshot.
3. Reinspect `database/bootstrap.rs`, `database/eod_data.rs`, scanner files, and relevant tests.
4. Confirm no new schema or identity contract supersedes these findings.

## Phase 1 — contracts only, behavior preserved

1. Add explicit scanner price-mode fields.
2. Default them to current raw behavior.
3. Add scanner plugin/rule version contracts.
4. Add run-manifest types.
5. Add tests proving existing raw results remain unchanged.
6. Do not persist yet if Corporate Action database changes are still active.

## Phase 2 — read-only batched data route

1. Reuse the Market Movers read-only connection and cancellation patterns.
2. Return bounded chunks with database identity/revision and target failures.
3. Preserve the current scanner worker and detector logic.
4. Compare results against the existing per-symbol path.

## Phase 3 — isolated technical-scan tables

1. Add `technical_*` migrations only.
2. Persist run manifests and immutable observations.
3. Keep Corporate Action `scan_runs` unchanged.
4. Add rollback-safe migration tests.

## Phase 4 — occurrence projection and daily differences

1. Define scanner-specific occurrence fingerprints.
2. Link compatible observations.
3. Produce run-to-run change states.
4. Add revision-change handling.

## Phase 5 — UI extraction and inspector

1. Extract scanner results presentation from `ScannerWindow.tsx` incrementally.
2. Extract overlay conversion from `ChartCanvas.tsx`.
3. Add run selector, daily changes, and Analysis Inspector.
4. Preserve current scanner navigation, alerts, and drawings.

## Phase 6 — candidate/developing semantics

1. Select one pattern family, not all definitions.
2. Define explicit pass, fail, and blocking criteria.
3. Add candidate result contracts.
4. Validate against historical examples before enabling the `developing` UI filter.

## Phase 7 — market context

1. Breadth statistics.
2. Sector and industry aggregation.
3. Relative-strength ranking and change.
4. Linked cross-filtering into scanner results.

## Phase 8 — backtesting

Begin only after:

- explicit adjustment semantics;
- immutable run data;
- point-in-time universe;
- inactive/delisted coverage;
- execution, slippage, and cost models;
- reproducible manifests;
- complete trade ledger.

---

## 9. Risks and possible regressions

| Risk | Why it matters | Required control |
|---|---|---|
| Silent raw-to-adjusted change | Changes current scanner results | Preserve raw default; add explicit mode and comparison tests |
| Collision with Corporate Action `scan_runs` | Could damage an active subsystem | Use `technical_*` tables only |
| Implementing from stale snapshot | Corporate Action work is continuing elsewhere | Re-snapshot before implementation |
| Symbol-key instability | Renames can split one economic instrument | Store identity snapshot now; stable ID later |
| False “developing” classification | Current detectors do not emit candidate evidence | Add scanner-specific candidate contracts |
| Historical geometry drift | Current grouped episode preserves first geometry | Persist per-run observations |
| Full-universe memory pressure | Thousands of instruments × long histories | Stream bounded chunks |
| Renderer component growth | `ChartCanvas.tsx` is already large | Extract overlay adapter |
| Scanner UI growth | `ScannerWindow.tsx` is already large | Extract results/inspector components |
| Survivorship bias | Current universes are active-instrument oriented | Add point-in-time universe before backtesting |
| Revision ambiguity | CA/identity/data changes can alter history | Record revisions and mark superseded runs |

---

## 10. Static test inventory

No test was executed.

A static inventory found:

- 135 files containing frontend or Rust test material;
- approximately 623 JavaScript/TypeScript `test`/`it` declarations;
- approximately 342 Rust `#[test]` declarations;
- 10 scanner/Market Movers test files containing approximately 73 test declarations.

Relevant scanner/market test files include:

- `src/plugins/scanner/__tests__/chartPatternPrimitives.test.ts`
- `src/plugins/scanner/__tests__/chartPatternScanners.test.ts`
- `src/plugins/scanner/__tests__/coreOhlcvScanners.test.ts`
- `src/plugins/scanner/__tests__/scannerHistory.test.ts`
- `src/plugins/scanner/__tests__/scannerPatternMap.test.ts`
- `src/plugins/scanner/__tests__/scannerPriority.test.ts`
- `src/plugins/scanner/__tests__/scannerWorkspace.test.ts`
- `src/plugins/scanner/__tests__/signalScanners.test.ts`
- `src/features/marketMovers/__tests__/marketMoversSnapshotService.test.ts`
- `src/features/marketMovers/__tests__/marketMoversStore.test.ts`

The existing test foundation is credible, but it does not substitute for tests of run manifests, price-mode reproducibility, immutable observations, lifecycle projection, identity revisions, or schema isolation.

---

## 11. Files inspected

### Root and architecture

- `AGENTS.md`
- `README.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `package.json`
- `src-tauri-shell/Cargo.toml`

### Scanner

- `src/plugins/scanner/types.ts`
- `src/plugins/scanner/scannerPlugin.ts`
- `src/plugins/scanner/scannerRunner.ts`
- `src/plugins/scanner/scannerRunConfig.ts`
- `src/plugins/scanner/scannerWorkspace.ts`
- `src/plugins/scanner/chartPatternEvaluation.ts`
- `src/plugins/scanner/chartPatternWorkerClient.ts`
- `src/plugins/scanner/chartPatternEvaluation.worker.ts`
- `src/plugins/scanner/scannerPatternMap.ts`
- `src/plugins/scanner/chartPatternTypes.ts`
- `src/plugins/scanner/chartPatternScanners.ts`
- `src/plugins/scanner/coreOhlcvScanners.ts`
- `src/plugins/scanner/dailyMarketScanners.ts`
- `src/plugins/scanner/signalScanners.ts`
- scanner test files listed above

### UI and chart bridge

- `src/components/ScannerWindow.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/CommandPalette.tsx`
- `src/components/Sidebar.tsx`
- `src/store/uiStore.ts`
- `src/store/chartStore.ts`

### Search, identity, watchlists

- `src/features/charts/chartSymbolSearchService.ts`
- `src/features/charts/chartSearchController.ts`
- `src/features/watchlists/*` relevant service/type files
- `src/types/desktop.ts`
- `src/platform/types.ts`
- `src-tauri-shell/src/database/symbol_search.rs`
- `src-tauri-shell/src/database/eod_data.rs`
- `src-tauri-shell/src/database/bootstrap.rs`
- `src-tauri-shell/src/database.rs`

### Market Movers and provenance precedents

- `src-tauri-shell/src/database/daily_market_snapshot.rs`
- `src/features/marketMovers/marketMoversTypes.ts`
- `src/features/marketMovers/marketMoversSnapshotService.ts`
- `src/features/marketMovers/marketMoversStore.ts`
- `src/features/marketMovers/marketMoversSnapshot.worker.ts`
- `src-tauri-shell/src/database/dnn_research_export.rs`
- `src/plugins/forecast/dnnTrend/dnnResearchDatasetExportService.ts`

### Corporate Action boundary

- Corporate Action schema and call-site references were inspected only far enough to confirm ownership of `scan_runs`, adjustment defaults, and integration boundaries.
- The large Corporate Action implementation was not audited or altered.

---

## 12. Files created, modified, and behavior changed

### Files created

- This external audit report only:
  - `/mnt/data/2026-08-25_0025_IST_BANANAPATTERNS_SOURCE_SPECIFIC_READ_ONLY_AUDIT.md`

### Project files created

- None

### Project files modified

- None

### Database files opened or modified

- None

### Behavior changed

- None

### Behavior deliberately preserved

- All application behavior
- Scanner raw-data default
- Scanner definitions and output
- Chart renderer and drawings
- Market Movers
- Search and identity behavior
- Watchlists and alerts
- Corporate Action schema, imports, evidence, resolver, approval gates, and adjustments
- Build and packaging configuration

---

## 13. Validation performed and results

| Validation | Result |
|---|---|
| Archive SHA-256 | Confirmed |
| ZIP integrity test | PASS |
| Static archive/file inventory | Completed |
| Static source searches and targeted file inspection | Completed |
| Test inventory | Completed, not executed |
| TypeScript typecheck | Not run |
| Vitest | Not run |
| Frontend build | Not run |
| Cargo check | Not run |
| Rust tests | Not run |
| Tauri build | Not run |
| Portable packaging | Not run |
| Database migration/runtime validation | Not run |
| UI runtime/accessibility/performance validation | Not run |

---

## 14. Recommended next step

Continue the Corporate Action work in its existing chat and source branch/snapshot without applying changes from this audit.

After that work reaches a verified checkpoint, provide the newest confirmed source snapshot. The next task should be a **design-only Technical Scan Persistence and Lifecycle specification**, including:

- exact current-source diff;
- explicit scanner price-mode decision while preserving current raw behavior;
- isolated `technical_*` schema;
- run and observation contracts;
- occurrence fingerprint rules;
- daily-difference semantics;
- read-only batch architecture;
- test plan;
- migration and rollback plan;
- zero changes to Corporate Action `scan_runs`.

