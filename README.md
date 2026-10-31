# EOD Charting Platform

## Identity maintenance checkpoint — 30 October 2026

NSE/BSE Identity maintenance shares reviewed confirmations and saved reporting.
BSE company-name history has native refresh/preview/Apply/receipt evidence; its
Security ID history remains held for verified dated sources. The latest saved-report
UI polish has native user evidence for saved wording, original-reason hover,
outcome views, search in All and exact path/hash copying. Display preferences
survive restart according to the user. Search with a non-All filter, validation
notice wording and clipboard failure handling remain unverified natively.
No additional Apply is needed for these report checks.
See [current handoff](HANDOFF.md) and [native evidence and remaining limits](docs/changes/2026-10-30-identity-report-polish/REPORT.md).

## Latest checkpoint: database issue takes priority — 26 October 2026

Corporate Actions is paused at the user request while the database issue is
scoped and addressed. Native approval screenshots plus a direct read-only audit
confirm 4,288 actions approved today across NSE and BSE. This supersedes earlier
statements that no bulk/Split approvals have been observed; chart arithmetic and
full acceptance remain separate. Progress reporting and history completeness
still need work. Do not replay the completed approvals.

This checkpoint supersedes older current-status claims below.
See [CA resume checkpoint](docs/changes/2026-10-26_CA_PAUSE_DATABASE_PRIORITY_HANDOFF.md).

## Latest Corporate Actions status — 25 October 2026

This update supersedes the older CA acceptance statements below. User screenshots
confirm selected Dividend approvals, HEGAM saved approval history/chart marker,
and targeted post-approval refresh for ICICIGI/HDBFS in 4/2 seconds while retaining
the full queue and unrelated readiness. Full rescanning after each approval has
been removed. Native search screenshots confirm mixed-case identity matching,
exact-symbol priority, full-ISIN matching and empty results without queue reload;
the user confirms Esc/× clear. Details exposes ISIN, source evidence and blocker
reasons. Whitespace padding, exact BSE-code lookup and measured typing speed remain
unverified natively. Adjusted/unadjusted chart-price comparison,
Split/bulk acceptance and automatic fresh BSE master transport remain unproven.
See [current handoff](HANDOFF.md), [refresh evidence](docs/changes/2026-10-25_CA_POST_APPROVAL_QUEUE_REFRESH.md)
and [quick search](docs/changes/2026-10-25_CA_QUICK_SEARCH.md).

<!-- EOD-CANONICAL-STATUS-2026-10-17-R1 -->
## Current verified platform and Corporate Actions status — 17 October 2026 IST

**Integrated Corporate Actions R1:** approved normal workflow `Fetch from Officials → Load & Validate → Approve Ready`, implemented in the existing CA window without replacing advanced maintenance. Load does not automatically approve Split/Bonus. Future ex-dates remain scheduled and local EOD readiness must be satisfied before explicit operator approval; the backend rechecks readiness at approval. Existing adjustment ledger/transactions and chart-refresh hooks are preserved, but production write/refresh behavior has **not** been manually accepted.

**Current acceptance boundary (17 October 2026 IST):** source-integrated and native-validation **PASS** (62/62 focused Vitest, 2/2 focused Rust tests, renderer typecheck, frontend Vite build, offline Cargo check). Two isolated Windows release builds also **PASS**; the static-CRT EXE has no direct/delay VC runtime imports. **Desktop CA UI and chart-refresh acceptance remain NOT VERIFIED:** the first disposable Sandbox run lacked Visual C++ CRT DLLs, the static-CRT attempt then lacked WebView2 Runtime. Operator stopped; no manual CA pass, no real NSE/BSE network-fetch pass, no production CA write acceptance, and no portable installation acceptance.

**Plugin P5-FINAL:** metadata-only import/discovery/reload architecture is closed with third-party external JavaScript evaluation and activation still **DISABLED**. C2 did not prove production guest process/IPC isolation; no plugin activation is permitted by the CA documents. The three previously unattributed P1/P2 files were accepted by exact isolated reconstruction on 17 October.

**Still open:** actual normal desktop workflow observation; official-feed integration under separately authorized network conditions; non-destructive/controlled approval and chart/cache refresh manual verification; optional portable Windows packaging. No further test environment redesign or production database modification is implied by this documentation update.

Current handoff: `HANDOFF.md`. Current feature status: `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`.
<!-- END-EOD-CANONICAL-STATUS-2026-10-17-R1 -->

## Bhavcopy Modular Architecture Refactor — October 15, 2026

<!-- BHAVCOPY-MODULAR-REFACTOR-OCT15-README -->

> **Bhavcopy Modular Architectural Refactor Phases 1–9 Closure — 15 October 2026.**  
> Decomposed the monolithic ~7,980-line `src-tauri-shell/src/bhavcopy.rs` into structured, single-responsibility submodules (`src-tauri-shell/src/bhavcopy/`) with zero breaking changes to public Tauri IPC commands, guaranteed preservation of the 4-worker binary concurrency limit and recovery journal contracts, passing all 50/50 unit tests and frontend typechecks.

### Highlights
- **Module Topology:** Decomposed into `mod.rs` (orchestrator facade), `types.rs` (domain contracts), `settings.rs` (settings persistence & templates), `transport.rs` (HTTP/1.1 client & connection pool), `calendar.rs` (trading calendar & holidays), `sources/` (NSE/BSE candidate URL generators), `parsers/` (CSV/ZIP/JSON normalizers), `ingestion.rs` (storage, binary writer pool, recovery journal lifecycle, background checkpoints), and `tests.rs` (unit tests).
- **Public IPC Backward Compatibility:** All 8 public Tauri commands (`download_bhavcopy`, `download_bhavcopy_batch`, `get_bhavcopy_settings`, `save_bhavcopy_settings`, `get_bhavcopy_default_templates`, `list_market_holidays`, `add_market_holiday`, `delete_market_holiday`) and event contracts remain identical.
- **Durability Contracts:** Retained 4-worker maximum concurrency cap, `APPEND_NEWEST` deferred-sync contract with journal protection, and immediate sync on historical/rewrite paths.
- **Verification:** 50/50 tests passed (`cargo test --bin eod-charting-platform-shell -- bhavcopy::tests::`), `npm run typecheck:renderer` passed with 0 errors.

## Dedicated Symbol Search & Workflow Enhancements — October 13, 2026

<!-- DEDICATED-SYMBOL-SEARCH-OCT13-README -->

> **Dedicated Symbol Search, SQLite Search Controller Wiring & Floating Window Ergonomics — 13 October 2026.**  
> High-speed instrument search triggered via single-key `S`, exchange filters (`All`, `NSE`, `BSE`), recent symbols fallback, fixed stable dimensions (580px × 480px), and modeless window dragging. All validation gates passed (`typecheck:renderer` 0 errors, Vitest passed).

### Highlights
- **SQLite Search Controller Fix:** Corrected asynchronous query synchronization in `chartSearchController.ts` so SQLite search results match the active query state.
- **Dedicated Symbol Search (`S` Hotkey):** Single keypress opens focused instrument search; displays security series badges (`EQ`, `BE`, `SM`); falls back to recently viewed symbols on empty search query for instant `S` &rarr; `↓` &rarr; `Enter` symbol switching.
- **Floating Window Ergonomics:** Fixed 580px × 480px panel geometry with `flex: 1` auto-scrolling results list; draggable window header bar with localStorage position memory via `useDraggableFloatingWindow`.
- **Full Report:** `docs/changes/2026-10-13_1225_IST_DEDICATED_SYMBOL_SEARCH_AND_SEARCH_CONTROLLER_FIX.md`.

## Technical and UX Audit — October 12, 2026

<!-- TECHNICAL-AND-UX-AUDIT-OCT12-README -->

> **Technical and UX Audit Phases 1, 2, and 3 Closure — 12 October 2026.**  
> Execution of performance optimizations, UI modernization (left-rail tool dock, 24px/11px status bar, 4-cluster toolbar), and formal plugin architecture with fault-isolated `PluginHost`. All validation gates passed (`typecheck:renderer` 0 errors, 21/21 Vitest tests, production Vite build in 5.10s).

### Highlights
- **Performance:** Pruned dead dependencies (`axios`, `unzip-stream`); introduced `isOverlayDirty` in `ChartEngine.ts` to stop 60–144Hz idle redraws; memoized tab hover bar mutations in `chartStore.ts` to eliminate React re-render cascades; split mega-effects in `ChartCanvas.tsx`.
- **UI Modernization:** Moved `ChartToolDock` to the left rail with rightward flyouts; modernized `StatusBar.tsx` to 24px height and 11px font with high-contrast mono badges; streamlined `Toolbar.tsx` into 4 distinct functional clusters with 24–26px button heights.
- **Formal Plugin Architecture:** Created `PluginHost` (`src/plugins/pluginHost.ts`) with formal lifecycle hooks (`init`, `destroy`, `onBarsUpdated`, `onInstrumentChanged`) and error-boundary sandboxing so faulty plugins cannot crash the chart canvas. Bound built-in plugins through singleton `pluginHost` in `src/plugins/registry.ts`.
- **Report & Evidence:** Full report at `docs/changes/2026-10-12_2245_IST_TECHNICAL_AND_UX_AUDIT_PHASES_1_2_3_COMPLETION.md`.

## Corporate Actions — August 24 three-row repair closure

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

## Active Architecture

- Desktop runtime: Tauri 2 only
- Frontend: React 18 + Vite 5 + TypeScript 5
- Backend: Rust shell under `src-tauri-shell`
- Storage: local hybrid database folders with SQLite metadata/operations, canonical binary EOD files, and a Generation-6 binary-state sidecar
- Charting: custom HTML5 Canvas engine

The active app now lives under:

- `src/*`
- `src/platform/*`
- `src-tauri-shell/*`

## Verified Baseline — August 22, 2026

- **Fresh documentation basis:** `Eod Charting Platform Source Code 2026-08-22_211417_IST`, uploaded ZIP SHA-256 `1A8F96F4BB339AE9FD1A7995F36A7D3CA4668244D3F3DC0772E6FE19D8ADC81D`. The supplied clean snapshot contains 721 files and reflects the warning-clean V1.7D source after the Quote Editor native-window rollback.
- **Bhavcopy binary-state architecture V1.1–V1.7D is active in source.** The Generation-6 `eod_binary_state.sqlite` sidecar supports verified binary identity, V1.3 baseline fast-path eligibility, V1.4 APPEND_NEWEST fast classification, V1.5 download-metadata invalidation after Quote Editor mutation, V1.6 localized state-row invalidation plus post-checkpoint incremental publication, V1.7A new-file durability and checkpoint telemetry, V1.7C checkpoint worker policy, and V1.7D binary-import worker policy.
- **Current production concurrency contract:** binary import/write workers = **2**; binary coverage prefilter workers = **4**; deferred APPEND_NEWEST checkpoint workers = **2**. These are independent policies and must not be collapsed back into one shared constant.
- **Durability contract:** new/full-file writes cross explicit `sync_data()` before rename; protected existing-file APPEND_NEWEST may defer physical sync only while covered by the durable Bhavcopy recovery journal; conservative rewrite/update/historical paths remain immediately durable.
- **V1.7A production evidence:** a forced 2026-08-20 refresh imported 8,804 source rows across 8,802 distinct symbols, created 33 new files, appended 8,769 existing files, recorded 33 immediate new-file `sync_data()` calls, and checkpointed 8,769 deferred files in 132,580 ms with four workers while exposing verify/sync/publish and p50/p95/max telemetry.
- **V1.7B/V1.7C evidence boundary:** the same-drive 1,000-file benchmark favored two checkpoint workers by median, but the genuine 2026-08-21 full-market run checkpointed 8,783 files in 146,799 ms with two workers versus the earlier 132,580 ms four-worker run on a close but non-identical workload. The two-worker production policy remains installed, but its real-world performance decision is still subject to the next genuine trading-day log; no guaranteed speedup is claimed.
- **V1.7D import policy:** binary import/write concurrency is now capped at two workers to reduce HDD contention and UI slowdown; the four-worker read-only prefilter cap and two-worker checkpoint cap remain separate. Runtime validation on the next genuine trading day is pending.
- **Quote Editor current boundary:** exchange selector defaults to `ALL` and supports `ALL`, `NSE`, `NSE-INDEX`, `BSE`, `BSE-INDEX`, and reserved `MCX`; ALL-load status reports per-exchange counts; long table text is clipped/ellipsized; quote mutations retain audit logging, download-metadata invalidation, quote-only identity semantics, and localized binary-state invalidation. The accepted UI remains the in-app `FloatingWindow`; the separate native `WebviewWindow` experiment was rejected and fully rolled back.
- **Warning-clean Rust baseline:** production `cargo check`, Rust test compilation, and `npm run tauri:check` all passed with `RUSTFLAGS=-D warnings`. The warning cleanup removed/gated only demonstrably unused release surface and did not change Bhavcopy durability, concurrency, schema, or Generation 6.
- **Portable runtime-validation build:** `npm run tauri:portable:win` passed after the embedded Quote Editor rollback. Portable executable SHA-256: `7C3E92E77ABBAD314F795C73577AED453E4641E6EB9C557C689019F14091847B`. Manual smoke testing confirmed Quote Editor opens, moves, resizes, closes, and reopens inside the main EOD Chart window without a separate taskbar window.
- **Current operational state:** SQLite integrity check is `ok`; Generation 6 metadata remains `COMPLETE`; sidecar rows are 24,535 VERIFIED / 0 DIRTY / 0 UNKNOWN at generation 6 while the physical binary census is 24,536 and recovery sessions are zero. This exact one-row physical/index gap is pending read-only identification/reconciliation. It is not described as corruption and must not be silently repaired or hidden.
- **Immediate next steps:** apply this canonical documentation reconciliation, perform one final portable build to establish the post-documentation executable hash, then collect the next genuine trading-day Bhavcopy log to validate the two-worker import policy. The one-row state gap remains a separate read-only operational audit.
- **Closeout evidence:** `docs/changes/2026-08-22_2114_IST_STORAGE_QUOTE_EDITOR_WARNING_CLEANUP_CLOSEOUT.md`.

## Verified Baseline — August 18, 2026

- **Warning cleanup W1.1 through W1.4-B1 remains CLOSED.** Rust warning hygiene, Vite ESM/CJS cleanup, Official Watchlists source-selective lazy-data partitioning, and Chart Runtime/ChartCanvas static bundle partitioning remain accepted.
- **Accepted production bundle state**: `feature-chart-canvas` ~204.45 kB, `feature-chart-core` ~297.28 kB, `feature-chart-analysis` ~164.40 kB, `vendor-technicalindicators` ~19.81 kB, and `feature-official-watchlists` ~55.08 kB. No application JavaScript chunk exceeds 500 kB; the circular-chunk warning and Vite CJS Node API deprecation warning are absent.
- **Portable Windows baseline**: `npm run tauri:portable:win` passed. Portable executable SHA-256: `07889C39B81D0F61D32A41C29FD9C7CBF210E6DE61BFB469D61F71D90DAB6281`. User manual smoke test passed.
- **Corporate Actions identity-audit V1.12.1 is CLOSED / ACCEPTED as a read-only phase.** V1.11 approved exactly 283 previously READY rows. The remaining exact 111 identity blockers were audited, externally researched, and deterministically classified by V1.12/V1.12.1 into **14 SAFE future-write candidates** and **97 manual/unresolved rows**.
- **Accepted V1.12.1 final states**: 10 `SAFE_OFFICIAL_EXTERNAL_EVIDENCE`, 4 `SAFE_RENAME_OR_RESTRUCTURE`, 49 `MANUAL_COMPANY_IDENTITY_REVIEW`, 5 `CONFLICT_UNRESOLVED`, 42 `NO_EVIDENCE_FOUND`, and 1 `DATA_INTEGRITY_ANOMALY`. Final verification proved 111/111 output, 22/22 package/regression tests, live DB/WAL/SHM unchanged, and zero database, identity/history, approval, or Quick Resolve writes.
- **Immediate next Corporate Actions phase**: finish the V1.13 Controlled Identity Repair design for the exact 14 SAFE candidates. The approved write boundary is identity/history evidence only; Corporate Action status changes are deferred to a separate read-only recheck/post-audit, and the remaining 97 rows stay untouched.
- **Git status/normalization is explicitly deferred.** Verified source snapshots and SHA-256 package/source guards remain the current recovery and change-control mechanism until a separate Git-maintenance phase is approved.
- **Fresh documentation basis**: `Eod Charting Platform Source Code 2026-08-18_015700_IST`, uploaded ZIP SHA-256 `E761D587BFE0134EAB6F7940332B97092823AE88AC85845E756B3D5C1036574D`.

## Verified Baseline — August 16, 2026

- **BSE Official Watchlists & Sector Universe Expansion**:
  - **BSE Stocks by Sector**: Added 6th official source tab with 13 official macro-economic sectors covering 1,527 BSE-listed equity stocks.
  - **Automated Universe Refresh CLI** (`scripts/refresh-sector-universe.mjs`): On-demand CLI utility to refresh NSE and BSE sector universes with live exchange feeds.
  - **BSE Sectors & Indices Expansion**: Expanded BSE Sectors to 27 groups and BSE Indices to 15 groups (including fully populated BSE 500), disentangled BSE Power and Energy, and enabled `www.bseindices.com` CSV feed parsing.
  - **Manual Trigger Only**: In-app updates remain strictly user-initiated on explicit "Update" clicks.
- **Complete Sidebar Suite (Symbols, Watchlists, Indicators)**:
  - **Symbols Panel**: Debounced search (150ms), rich right-click context menu with seamless *Add to Watchlist ▾* submenu, collapsible Recently Viewed Symbols section (`localStorage` up to 8 symbols), and persistent BSE filter state.
  - **Watchlists Panel**: Reclaimed vertical screen space by moving sync details into the Update tooltip; inline Quick-Add symbol input with live autocomplete dropdown; 1-click A-Z/Z-A sorting; and expanded right-click context menu (*Open Chart*, *Open in New Tab*, *Add to Watchlist ▾*, *Copy Symbol/ISIN*, *Edit Quotes*, *Delete*).
  - **Indicators Panel**: Pinned Favorites (★) group at top with star toggle buttons and `localStorage` persistence, plus 1-click Direct Add `+` hover button for instant plotting.
- **Chart Double-Click Auto-Scale Alignment**:
  - Double-clicking the price axis or any indicator pane's axis resets vertical compression/stretch back to dynamic Auto-Fit (`paneScaleOverrides = null`).
  - Double-clicking inside the main chart plot area (candles/canvas) is protected and will never disrupt your horizontal zoom or pan position.
  - Double-clicking the bottom date axis resets horizontal viewport to default.
- **Verification**: 111 test files passed, TypeScript check passed (`npm run typecheck:renderer`).

## Verified Baseline — August 13, 2026

The August 13 documentation reconciliation was based on Fibonacci-complete snapshot `Eod Charting Platform Source Code 2026-08-13_205303_IST`, uploaded ZIP SHA-256 `22417772772572badbf8abf088bc221eff8d4faee0c14842637c35d44fd1f23a`. That dated basis is retained as historical evidence and is superseded for current authority by the August 22 baseline above.

- Active runtime remains Tauri 2 + React 18 + TypeScript 5 + Rust under `src/` and `src-tauri-shell/`; `.cargo/config.toml` continues to route Cargo output to repository-root `target/`.
- Binary Manual Import has durable, database-bound recovery sessions with newest-first history, conflict-safe session-specific Undo, overwrite restoration, and provenance-scoped cleanup of session-created placeholders. Quotation Editor deletion remains quote-only and identity-preserving.
- Bhavcopy Phase 2B.1 preserves exact pre-import binary boundaries and recovery-manifest integrity. Interrupted deferred checkpoints now resume through the fast verified checkpoint path when state is `APPLIED` or `CHECKPOINTING`; other recovery states retain conservative handling.
- Phase 2C keeps the storage-oriented worker cap at 4 and allows only recovery-journal-governed existing-file `APPEND_NEWEST` writes to defer physical `sync_data()`; conservative mutation paths and Manual Import remain immediately durable.
- August 13 production import: 8,453 rows / 8,449 symbols, 43 new files, 8,406 APPEND_NEWEST files, 0 binary errors, 0 foreground `sync_data()` calls, 8,406 deferred syncs, and 57,456 ms binary-write wall time. Exchange results were BSE 4,972, BSE Index 77, NSE 3,404; NSE Index source was unavailable for that date.
- The older conclusion that Phase 2D was unnecessary is superseded. An 8,570-file sequential foreground checkpoint took 1,057,829 ms (~17m38s). Phase 2D then checkpointed 8,406 files in the background with 4 workers in 125,405 ms (~2m05s), about 8.44x faster / 88.1% lower elapsed on a close but not identical workload. The next Update completed in about two seconds with 0 jobs and no long retained-session recovery.
- Automatic Update defers current-day probing until 18:00 local time; manual Date Range and Full History are unchanged.
- Calendar Safety V1.1 is exchange-aware: known special trading sessions override weekend/holiday skipping, weekend/holiday decisions remain date-by-date, and dates that reach the network layer but have no source are reported as unavailable/missing rather than invented holidays.
- Date Range Prefilter Range Scan V1 retains metadata-vs-binary coverage reconciliation, the existing 80% usable-coverage threshold, fail-closed I/O behavior, and a maximum of four read workers. For the same eight target dates, NSE/BSE reconcile timings moved from 523,371/171,131 ms to 147,048/77,687 ms on the first optimized runtime; a later cached run measured 18,669/2,593 ms. All runs preserved the same eight already-imported dates. Prefilter V2 is deferred unless repeated cold-run evidence justifies it.
- BSE/BSE Index candidate terminal classification separates soft unavailable/source-mismatch outcomes from genuine hard errors so HTML-instead-of-CSV cannot mask a real hard error. Final validation after V1.1: focused regression 1/1 PASS, Bhavcopy filter 50/50 PASS, `cargo check` PASS. The rebuilt current-day run completed 3 success / 17 skipped / 0 failed; BSE Index was available and imported 77 rows, so the exact all-soft branch was not re-triggered after the fix.
- BSE Index `IndexArchDailyAllPar` continues to preserve literal `DD/MM/YYYY` query dates; the four previously missing September-2023 dates (08, 14, 20, 25) each imported 57 rows after that fix.
- Exchange identity fidelity remains explicit: do not derive BSE trading symbols from company/security names. Preserve official identifiers unless an audited mapping resolves them. NSE supported equity/trade-for-trade/SME series remain broadly ingested with series metadata; normal series filtering belongs in Symbols/sidebar, with configured government-security exclusions separate.
- Detailed Bhavcopy diagnostics remain in the Activity Log; compact renderer progress surfaces intentionally show concise status/progress rather than full diagnostic payloads.
- **Fibonacci drawing family is COMPLETE / CLOSED.** The accepted family comprises Fibonacci Retracement, Fib Projection (Legacy), Trend-Based Fib Extension, Fibonacci Channel, Fib Time Zone, Trend-Based Fib Time, Fib Circles, Fib Speed Resistance Arcs, Fib Wedge, Fib Spiral, and persisted `fibFan` with accepted Fib Speed Resistance Fan geometry.
- Fib Wedge remains data-space-first. Fib Spiral remains on restored F1D.1 geometry; the rejected F1D.2 absolute-time basis is not part of the final baseline. F1E.1 uses exact projected apex-to-Fibonacci-target rays and shared renderer/hit-test geometry; final validation passed 15 files / 81 tests plus renderer typecheck/build, and the user manually passed zoom-in/zoom-out stability.
- The next drawing-family work is **Gann fidelity/acceptance** for the existing `gann` and `gannBox` tools. Completed Fibonacci geometry should not be redesigned during that work without a new reproducible defect.
- This August 13 handoff ordering is historical. As of the August 17 canonical baseline, the immediate project step is the read-only Corporate Actions current-state audit; Gann remains the next drawing-family workstream after that governed Corporate Actions checkpoint.

## Important Repository Note

- `src-tauri-shell` is the only active desktop backend path.
- the old `src-tauri` tree was removed on April 4, 2026 because it was not part of the active build/runtime path.
- Electron runtime files have been retired from the active app path.
- Renderer runtime access must continue to flow through `src/platform/*`.
- Project-level Codex guidance now lives in `AGENTS.md` and `HANDOFF.md`, with narrow validation/reference helpers under `scripts/`.
- Removed repo skills are archived reference only. Do not recreate `.codex/skills` or stale skill routing without explicit approval.
- The eight canonical root documents listed in `REQUIREMENTS.md` are sufficient for a clean source snapshot. Historical prompts/reports may remain in the full repository archive, but they are not current implementation authority.

## Repository Reality

- `EOD DATABASE/` is a live local database folder kept in the repo for local use and testing; it is not the source baseline.
- `analysis/`, `test-output/`, `dist/`, `release/`, `backups/`, and root `target/` are artifact or support areas, not active app source. `src-tauri-shell/target/` is a quarantined legacy build-output location and must not be restored as an alternate source tree.
- `mockup/` is a static HTML design-reference area for chart-workspace UI review concepts; it is not runtime code.
- `analysis/` and `test-output/` are on-demand artifact folders and may be empty between review/test runs; root `target/` is generated Rust/Tauri workspace build output and may be absent after cleanup until the next build.
- `backups/` retains snapshot history, but oversized snapshots that accidentally captured generated build output were pruned on April 12, 2026.
- `resources/release/` remains a non-active packaging/support area; the old Electron `win-unpacked/` and installer outputs were removed from the live repo baseline on April 12, 2026.
- `EOD Charting Platform/nice-merkle/` is a linked git worktree under the repo root and is not part of the active app path.
- Historical root reports/prompts were moved into `docs/archive/` on April 12, 2026; they are not active runtime/source files.
- Use `FILE_INVENTORY.md` when you need the full current folder-role map rather than only the active runtime path.

## Current Product Scope

- bundled plugin controls with a disabled-by-default `DNN Trend Prediction Adapter` that can validate and read a versioned precomputed JSON source, persist only its source path, provide an exact read-only symbol/date/horizon viewer, and export a read-only versioned external-research dataset from the active database; no trained model, automatic chart inference, overlay, scanner route, alert route, broker route, or order execution is active
- explicit create/open/close/delete database flow
- recent database tracking plus a Recent Databases reopen/remove dialog
- app-level settings plus recent-database profile storage under `Documents\EOD Chart Profile` by default, with a Settings dialog browse override and runtime logs kept local to the active runtime folder
- section-focused native `Settings` entry points that still land inside the same `SettingsDialog`, plus `Help > Keyboard Shortcuts` for the currently supported app/chart shortcuts
- database-scoped default price mode (`Raw` / `Adjusted`) that is applied when each database opens, now seeded to `Adjusted` for new or missing settings and updated automatically when the live `Chart > Price Mode` session changes
- official corporate-action fetch coverage caching per database, so re-fetch can reuse already covered date windows and call NSE/BSE only for missing dates
  - `Official Imports` also exposes a one-shot `Force re-fetch` override when you need to bypass saved coverage and recheck an already-covered official date window
  - exact-symbol official rows whose ISIN differs from the current instrument snapshot now stay manually reviewable/approvable instead of being treated as hard unresolved, and approved official rows store point-in-time ISIN evidence for future matching
  - older databases now backfill that ISIN-evidence table one time from existing approved official imports and canonical approved corporate actions when they first open on the newer build
  - the same upgrade path also reclassifies already-stored `PENDING_ISIN_MISMATCH` rows back to plain `PENDING` when the newly available ISIN evidence proves the exact symbol/date/ISIN combination
  - future approvals that write new ISIN evidence now perform that same `PENDING_ISIN_MISMATCH -> PENDING` normalization immediately, so the review queue updates without requiring a reopen or re-fetch
  - `Review Issues` now supports targeted bulk auto-recheck for selected `UNRESOLVED` official rows, so symbol-history and ISIN-evidence changes can be applied to a chosen backlog slice without a full refetch
  - that unresolved recheck path can now follow a multi-step NSE identity-history chain and prefer the single active current symbol in that chain before falling back to manual resolve
  - when that identity-history chain is still ambiguous, the unresolved row message now lists the candidate database symbols so `Review Issues` and the resolve panel explain why manual resolve is still required
  - the `Review Issues` resolve panel now preloads structured current-symbol suggestions from the NSE identity chain and historical ISIN evidence, so manual resolve can often be completed directly from suggested matches before running a free-form search
  - when those suggestions narrow to exactly one active current symbol, the same resolve panel now exposes a one-click `Use Top Suggestion` action instead of making the user manually select the already-proven top candidate first
  - `Review Issues` row actions now try that same quick path first for unresolved rows, resolving directly when there is exactly one active suggested current symbol and only opening the resolve panel when manual review is still needed
  - `Review Issues` now also preloads compact per-row quick-resolve hints (`1 active`, `2 active`, `No active`, `No hint`) so obvious and ambiguous cases are visible before you click the row action
  - `Review Issues` now adds `Quick Resolve Selected`, which resolves only the selected unresolved rows that already show exactly one active suggested current symbol and skips the rest for manual review
  - `Review Issues` now also adds an `Only 1 Active` filter so the unresolved queue can be narrowed to rows that already have exactly one active suggested current symbol before bulk quick resolve
  - `Review Issues` now also adds a `Multiple Active` filter so ambiguous unresolved rows with more than one active suggested current symbol can be isolated for manual review without losing the existing one-candidate batch path
  - `Review Issues` now also adds a `No Active` filter so unresolved rows with no active suggested current symbol can be isolated for delisting, identity-history-gap, or manual-research review, and the filter now shows inline help clarifying that `No Active` is a resolver-status hint rather than proof that the company is unlisted
  - the row-level `No active` hint badge in `Review Issues` now carries the same clarification in its tooltip, so the meaning is visible before using the filter
  - `Review Issues` now also adds `Save No Active`, which exports unresolved rows whose hint is `No Active` through a native save dialog as tab-separated audit text for grouped review outside the table
  - `Review Issues` now also adds `Save 1 Active`, `Save Multiple`, and `Save No Hint`, and the hint summary now breaks the unresolved backlog into `1 active`, `multiple active`, `no active`, and `no hint` counts so audit/export buckets match the labels shown in the table
  - the same toolbar now adds an `All matching` export toggle, so those saved audit exports can optionally fetch every unresolved row matching the current type and search filters instead of only the loaded page
  - when `All matching` export is enabled, the status line now reports page-fetch progress, hint-batch progress, and the final file-write step during large audit exports
  - the same long-running `All matching` export flow now also exposes `Cancel Export`, which stops after the current fetch or hint batch and exits without writing a file
  - the `Review Issues` export area now also shows a dedicated inline `Export Progress` message during those long `All matching` exports, so progress is visible even without watching the shared status line
  - that inline export progress area now also shows compact numeric badges for pages fetched, unresolved rows gathered, hint batches completed, and matches being written
  - the `Review Issues` top action toolbar now wraps inside the default Corporate Actions floating-window width, so the quick-resolve and export actions stay visible without horizontal clipping
  - deeper historical split/bonus backfill beyond the current live NSE/BSE structured feeds remains a planned follow-up; see `HISTORICAL_CORPORATE_ACTIONS_BACKFILL_PHASE_PLAN.md`
  - Phase 1 of that backfill effort is now documented in `HISTORICAL_CORPORATE_ACTIONS_SOURCE_SPIKE_REPORT.md`, which confirms that the current structured NSE feed misses older split/bonus history for symbols such as `KOTAKBANK`, `INFY`, and `WIPRO`
  - Phase 2 foundation is now partially in place: every newly inserted official/CSV import row also records one source-evidence snapshot in `corporate_action_import_evidence`, and older databases backfill one evidence snapshot per existing import row the first time they open on the newer build
  - Phase 3 now has a typed historical backfill pilot that is callable from `Official Imports`: `backfillHistoricalCapitalActionsForSymbol` keeps the current review-first model, runs symbol-scoped historical backfill for NSE target symbols, queries the current NSE official API per symbol plus optional BSE deep-history rows, now tries to infer the BSE scrip code from a unique same-ISIN current BSE instrument when the user leaves that field blank, focuses the review queue on the requested symbol after the run, attaches new evidence to equivalent existing imports instead of recreating cross-source duplicates, and returns source-attempt coverage warnings when deeper history is still missing
  - Phase 4 now carries that evidence into the existing review surfaces: import rows expose evidence count/source codes plus latest capture context, `Official Imports` and `Review Issues` show compact provenance labels, and the resolve panel explains which attached sources support the selected row without changing approval behavior
- native menu checked-state sync for active timeframe, chart type, price mode, adjustment inclusion, event visibility, layout mode, sidebar/status visibility, and magnet state
- symbol search and watchlists
- manual official watchlist import plus source-linked manual update for official NSE/BSE sector and index groups, using live official-source fetch with packaged snapshot fallback
- native `Watchlist` menu with management/import flows
- chart tabs, named layouts, and per-chart-window Sheets
- EOD-only compare overlays from the local symbol database, rebased from the first visible bar
- searchable indicator picker dialog with 118 fully modular technical indicators across standard and community suites
- **Gann Price-Time Analysis plugin** (`gann-price-time`): ATR-scale-locked angle rays (2×1, 1×1, 1×2), Square of Nine harmonic levels, and 45/90/180/360-bar time cycle boundaries with breakout confirmation overlaid on the chart canvas; pure in-memory, zero database writes
- CSV preview/import
- bhavcopy download/import workflows
- Binary EOD Parity Audit (Phase 4B) with read-only validation UI for Global, Exchange, and Symbol scopes
- Binary EOD broad-equity ingestion plus Symbols/sidebar series filtering: supported NSE equity/trade-for-trade/SME rows stay stored with series metadata; do not introduce a new equity-series whitelist/drop step in Bhavcopy. Existing configured government-security exclusions remain separate.
- quote editing, symbol merge, corporate actions, NSE identity archive import, manual NSE current-universe sync, and optional dividend/rights inclusion in adjusted chart mode
- chart-first workspace shell with custom canvas rendering
- future-bar-aware X-axis / crosshair rendering for `D/W/M/Q/Y`, pane-aware drawing tools, per-pane resize/reorder/collapse controls, pane fit/autoscale reset, axis drag autoscale overrides, pane titles, protected chart-top summary hover behavior, stacked chart-top overlay legend rows, refined TradingView-style chart-top symbol/OHLC summary styling, app-wide native right-click suppression, compare overlay legends/right-axis tags, chart-side scale settings above the right price scale, toolbar-row timeframe controls below chart tabs, and a single-row AmiBroker-style sheets + horizontal scrollbar strip
- Windows-first portable Tauri workflow for daily use

## Desktop Contract

Renderer code must stay behind the platform seam:

- `src/platform/desktop.ts`
- `src/platform/shell.ts`
- `src/platform/types.ts`
- `src/platform/index.ts`

`src/platform/desktop.ts` is now Tauri-only and resolves the business-service bridge through `src/platform/tauriDesktop.ts`.

`src/platform/shell.ts` is now Tauri-only and carries app metadata, external-link opening, native menu-command subscriptions, and renderer-to-shell native menu-state sync.

No active renderer file outside `src/platform/*` should import `@tauri-apps/*` directly.

## Main Folders

```text
.
|-- src/               React renderer, store, components, chart engine, platform seam
|-- src-tauri-shell/   active Tauri shell, Rust backend, menu, runtime, database/import/bhavcopy services
|-- .codex/            reserved project metadata; no active repo skills
|-- scripts/           packaging and support scripts
|-- resources/         static desktop assets plus non-active packaging/support files
|-- EOD DATABASE/      live local SQLite database folder kept in repo
|-- analysis/          on-demand review artifacts when present
|-- mockup/            static HTML mockups for design review, not active app runtime
|-- test-output/       on-demand smoke-check logs, screenshots, and temp DB fixtures
|-- backups/           retained pre-change snapshots after oversized generated-output backups were pruned
|-- dist/              Vite production build output
|-- release/           packaged/staged Tauri output
`-- EOD Charting Platform/nice-merkle/ linked git worktree, not active app source
```

## Development

Install dependencies:

```powershell
npm install
```

Run the renderer only:

```powershell
npm run dev:renderer
```

Run the active Tauri app in development:

```powershell
npm run dev
```

Type-check the renderer:

```powershell
npm run typecheck:renderer
```

Run the unit tests:

```powershell
npm run test
```

Run a Rust-side compile check for the active Tauri shell:

```powershell
npm run tauri:check
```

Run scoped change validation without a broad build:

```powershell
.\scripts\validate-change.ps1 -Profile docs
.\scripts\validate-change.ps1 -Profile renderer
.\scripts\validate-change.ps1 -Profile tauri
.\scripts\validate-change.ps1 -Profile corporate-actions
```

Profiles run serially and stop on failure. `-Full` explicitly adds the broader unit-test/renderer-build checks; packaging is never implicit. `scripts/check-doc-references.ps1` is read-only and checks the live documentation allowlist for missing files, removed-skill references, and stale project roots.

Create a production build:

```powershell
npm run build
```

Stage the portable Windows folder:

```powershell
npm run tauri:portable:win
```

`npm run tauri:build`, `npm run tauri:portable:win`, and `npm run tauri:bundle:nsis` now stamp build metadata automatically before the Tauri build starts. The metadata generator:

- validates that `package.json`, `src-tauri-shell/Cargo.toml`, and `src-tauri-shell/tauri.conf.json` all use the same semantic version
- writes `src-tauri-shell/gen/build-info.json` with the current `version`, `buildNumber`, and `builtAt`
- feeds that metadata into Help > About and the staged portable `README.txt`

Version-specific change notes shown in Help > About are maintained in:

- `src/features/app/appVersionHistory.ts`

When you intentionally bump the app version, update all three version fields plus the matching release-notes entry.

The portable staging script now resolves the sole executable source from `target\release\eod-charting-platform-shell.exe`, calculates SHA-256 with `System.Security.Cryptography.SHA256`, fails closed on a source/staged mismatch, and copies:

- the verified release Tauri executable
- `dist/index.html`
- `dist/assets/*`

into `release/tauri-portable-win/EOD Chart Portable`, so the staged portable app has the frontend assets it needs beside `EOD Chart.exe`.

The generated launcher now also forces the working directory to the portable app folder, which helps frontend asset resolution stay stable across normal Windows launch contexts.

Portable rebuild note:

- portable runtime state and logs still live under `portable-data\`
- app-level settings and the recent-database registry now live in the application profile folder instead of the portable folder itself
- the default application profile folder is `Documents\EOD Chart Profile`
- the Settings dialog can browse to a different profile folder when you want app settings to follow a OneDrive-backed or user-selected location across portable and installed builds

The Tauri shell build now explicitly watches `dist/`, so frontend asset changes invalidate the Rust/Tauri executable instead of letting a stale exe survive across renderer rebuilds.

Build the Tauri shell directly:

```powershell
npm run tauri:build
```

Bundle the Tauri shell as a Windows NSIS installer:

```powershell
npm run tauri:bundle:nsis
```

## Current Validation Snapshot

Verified on August 20–22, 2026:

- Quote Editor exchange/filter tests: 10/10 PASS; embedded-window rollback contract: 1/1 PASS; renderer typecheck and production build PASS.
- Warning-clean Rust contract: production `cargo check`, Rust test compilation, and Tauri compile check PASS with warnings denied.
- Generation-6 binary-state tests: 11 passed, 1 explicitly ignored real-database audit; V1.6 incremental publication and V1.7A durability/telemetry regressions PASS.
- V1.7D worker-policy regression confirms binary import/write cap 2; separate regression preserves binary prefilter cap 4; V1.7C checkpoint cap remains 2.
- Portable runtime-validation executable SHA-256: `7C3E92E77ABBAD314F795C73577AED453E4641E6EB9C557C689019F14091847B`; embedded Quote Editor smoke test PASS.
- Current state audit: sidecar 24,535 VERIFIED rows, 0 DIRTY, 0 UNKNOWN, generation 6; physical binary files 24,536; SQLite integrity `ok`; recovery sessions 0. One-row reconciliation remains pending.

- Fibonacci F1E.1 final focused validation (2026-08-13): 15/15 test files PASS, 81/81 tests PASS, `npm run typecheck:renderer` PASS, `npm run build:renderer` PASS; user manual Fib Speed Resistance Fan zoom/unzoom test PASS.
- The final accepted F1D state is the F1D.1 rollback baseline; its rollback validation passed 13/13 test files and 72/72 tests plus renderer typecheck/build, followed by manual acceptance.

- **Gann Price-Time Analysis Plugin** (2026-09-14): `src/plugins/analysis/gannPriceTime/` — Vitest 28/28 PASS · TSC `--noEmit` 0 errors · `npm run build:renderer` all guarded chunks under 500 kB (`feature-chart-canvas` 332 kB, `feature-chart-core` 299 kB, `feature-chart-analysis` 164 kB) · `cargo check` exit 0. No new Rust warnings. Evidence: `docs/changes/2026-09-14_0112_IST_GANN_PRICE_TIME_PLUGIN_IMPLEMENTATION.md`.

Verified on August 9–13, 2026:

- Manual Import Recovery acceptance:
  - durable recovery sessions persisted across restart;
  - newest-first history displayed multiple independent sessions;
  - session-specific Undo removed/restored only provenance-backed rows and preserved conflicts;
  - quote deletion remained identity-preserving rather than auto-pruning symbols.
- Bhavcopy Phase 2B.1 / Phase 2C validation remained green through later changes. Final August 13 Bhavcopy filter after candidate-classification V1.1: 50/50 PASS; focused classification regression: 1/1 PASS; `cargo check`: PASS.
- Interrupted-checkpoint resume correction accepts only `APPLIED` and `CHECKPOINTING` as fast-checkpoint resume states and preserves exact tail verification plus conservative fallback.
- Production evidence that triggered Phase 2D: 8,570-file sequential foreground checkpoint = 1,057,829 ms (~17m38s).
- August 13 append-heavy runtime:
  - 8,453 imported rows / 8,449 symbols;
  - 43 new files;
  - 8,406 `APPEND_NEWEST` files;
  - 0 foreground `sync_data()` calls and 8,406 deferred syncs;
  - 57,456 ms binary-write wall time;
  - 3 successful source jobs, 17 skipped, 0 failed.
- Phase 2D production background checkpoint:
  - session `20260813T110934.752306Z-p18044-0`;
  - 8,406 APPEND_NEWEST files;
  - workers = 4;
  - elapsed = 125,405 ms (~2m05s);
  - later Update completed in about two seconds with 0 jobs and no long retained-session recovery.
- Update same-day cutoff validation and runtime acceptance passed: before 18:00 local, automatic Update does not probe the current day; at/after 18:00 it may do so.
- Calendar Safety V1.1 focused special-session/holiday regressions passed. Repeated Date Range runtime showed explicit weekend skips and source-unavailable wording rather than false holiday classification.
- Prefilter Range Scan V1:
  - focused exact-count and 4-worker-cap regressions PASS;
  - same eight prefiltered dates preserved for NSE/BSE/NSE Index/BSE Index;
  - trigger NSE/BSE binary reconcile = 523,371/171,131 ms;
  - first optimized runtime = 147,048/77,687 ms;
  - later cached runtime = 18,669/2,593 ms, with index reconciliation below 0.3 s each.
- BSE Index literal-date historical acceptance remains: 2023-09-08/14/20/25 each returned 57 rows; 4 success, 0 failed, 228 rows.
- BSE/BSE Index candidate-classification V1.1 prevents soft HTML/no-file outcomes from masking hard errors. In the rebuilt August 13 runtime, BSE Index data had become available and imported 77 rows, so the exact all-soft terminal case was not reproduced after the fix; automated regression protects the policy.
- The compact Bhavcopy progress UI remains present; a dedicated screenshot-only acceptance record is still not required for the backend finalization.

Verified on June 10, 2026:

- Startup adjusted-mode reopen regression fix:
  - `src/features/workspace/chartSnapshotHydrationService.ts` now passes the resolved database default price mode directly into the first startup tab hydration after a database snapshot is restored, instead of relying only on the store state having settled before that reload runs.
  - The same startup hydration now forces the first visible chart reload to bypass any stale cached result for that open, so a database whose default is `Adjusted` no longer reopens with a raw-looking active chart because of restore timing.
  - `src/features/charts/chartInstrumentHydrationService.ts` now accepts an optional `forceReload` flag for chart hydration payloads so the startup restore path can explicitly request a fresh backend read when needed.
  - validation for this pass:
    - `npm run typecheck:renderer`
    - `npm run test`
    - `npm run tauri:check`

- Menu restructuring Phase 3:
  - `src-tauri-shell/src/main.rs` now adds section-focused `Settings` menu entry points for `General Preferences...`, `Application Profile Folder...`, `Active Database Defaults...`, and `Chart Colors...`, while keeping all detailed edits inside the existing `SettingsDialog`.
  - `src/store/uiStore.ts`, `src/features/app/menuCommandRouter.ts`, and `src/components/SettingsDialog.tsx` now carry a small requested-section hint so those menu items can open and scroll the existing settings window to the correct section instead of duplicating controls in the native menu.
  - `src/components/KeyboardShortcutsDialog.tsx` plus `src/RootApp.tsx` now add `Help > Keyboard Shortcuts`, documenting the real currently wired command-palette and chart-canvas shortcuts only.
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `npm run typecheck:renderer`
    - `npm run test`
    - `npm run tauri:check`

- Adjusted default price mode follow-up:
  - `src/features/workspace/databaseSettingsService.ts` now treats `Adjusted` as the fallback database default when the setting is missing or the desktop bridge is unavailable, while still honoring an explicit saved `raw` value.
  - `src-tauri-shell/src/database/bootstrap.rs` now seeds new databases with `default_price_mode = adjusted` instead of `raw`.
  - `src/features/charts/chartTabSessionController.ts` now persists live `Chart > Price Mode` changes back into the active database default in the background, so closing the app on `Adjusted` reopens that same database in `Adjusted` next time.
  - `src/components/SettingsDialog.tsx` now reflects that the active database default is both the startup mode and the mode that live price-mode changes keep updated for the next reopen.
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `npm run typecheck:renderer`
    - `npm run test`
    - `npm run tauri:check`

- Menu restructuring Phase 4 follow-up:
  - `src-tauri-shell/src/main.rs` now resolves native checked-state sync targets recursively through nested submenus instead of relying on `Menu::get(id)`, which only finds top-level menu items.
  - This fixes the broken toolbar-to-menu sync path for nested checked items such as `Timeframe`, `Chart Type`, `Adjustments`, `Layout Mode`, and `Magnet`.
  - `Chart > Adjustments` still represents inclusion toggles only; it does not imply that dividend or rights adjustments already exist in the database for the current symbol.
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `npm run tauri:check`

- Menu restructuring Phase 4:
  - `src-tauri-shell/src/main.rs` now converts the stateful native menu items for timeframe, chart type, price mode, layout mode, sidebar / OHLCV / status visibility, and magnet into checkable menu items, and adds a `sync_menu_state` Tauri command so the renderer can push the true current state back into the native shell.
  - `src/platform/types.ts` and `src/platform/shell.ts` now define the native menu-state payload and bridge method, keeping renderer runtime access behind `src/platform/*`.
  - `src/features/workspace/chartRuntimeController.ts` now subscribes to active chart-session state plus UI visibility state, pushes native menu state during init and after relevant store changes, and also forces a post-dispatch resync after native menu commands so clicking an already-selected check item cannot leave the native menu visually stale.
  - `src/store/chartStore.ts` now passes the Zustand store subscription into the runtime controller, and `src/features/app/menuCommandRouter.ts` now accepts an optional post-dispatch callback for shell resync without changing the existing command-routing behavior.
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `npm run typecheck:renderer`
    - `cargo check --manifest-path src-tauri-shell/Cargo.toml --message-format short`
    - `npm run test`
    - `npm run tauri:check`
  - manual runtime verification is still recommended for native checked-state behavior across toolbar, settings popover, and menu interactions

- Menu label polish:
  - `src-tauri-shell/src/main.rs` now trims several native menu labels without changing behavior: `Save Active Database`, `Indicators`, `Dividend Adjustments`, `Rights Adjustments`, `Lock / Unlock Drawing`, `Sidebar`, `OHLCV Bar`, and `Status Bar`.
  - the built-in fullscreen item is intentionally unchanged in this pass, so it still uses Tauri's default fullscreen wording.
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `npm run tauri:check`

- Menu restructuring Phase 2:
  - `src-tauri-shell/src/main.rs` now adds a native `Chart Type` submenu for `Candles / Line / Area / Bar (OHLC) / Baseline / HLC Area / Heikin Ashi / Renko`, plus a native `Chart > Adjustments` submenu for dividend and rights inclusion.
  - `src/features/app/menuCommandRouter.ts` now routes those native chart-type and adjustment commands into the existing chart store actions; no new renderer-to-desktop bypass was introduced.
  - The actual adjusted-data reload behavior still stays in the existing session controller path, so enabling dividend or rights inclusion from the native menu reuses the same adjusted-mode rehydration flow as the chart settings popover.
  - native checked state for the dividend/right inclusion menu items is not yet synchronized when those same toggles are changed from the chart settings popover; broader menu state sync remains a later phase.
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `npm run typecheck:renderer`
    - `npm run test`
    - `npm run tauri:check`

- Menu restructuring Phase 1:
  - `src-tauri-shell/src/main.rs` now promotes `Settings` to a top-level menu, splits drawing tools/actions into a top-level `Draw` menu, groups quote/merge/corporate/parity tools under `Database > Data Tools`, adds native `Quarterly` / `Yearly` timeframe entries, and adds `View > Layout Mode` for the already-supported layout-mode payloads.
  - No chart/runtime behavior was redesigned in this pass; the same dialogs and actions still route through the existing command bridge.
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `npm run typecheck:renderer`
    - `npm run tauri:check`

- Corporate-actions official re-fetch coverage:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now records successful official NSE/BSE fetch windows in `corporate_action_fetch_coverage`, computes uncovered date gaps before each re-fetch, and calls the source only for those missing windows instead of redownloading the full requested range every time.
  - `src/components/DatabaseToolsDialogs.tsx` now reports how many requested days were reused from cached database coverage versus actually fetched from the source, while keeping approval manual and review-first.
  - the same `Official Imports` surface now exposes a request-scoped `Force Re-fetch` button that bypasses saved coverage for one fetch without disabling coverage reuse globally.
  - `src-tauri-shell/src/database/bootstrap.rs` and `docs/database-schema.md` now define the new coverage table and index.
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `npm run typecheck:renderer`
    - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`
    - `cargo check --manifest-path src-tauri-shell/Cargo.toml --message-format short`
    - `npm run test`
    - `npm run tauri:check`

- Corporate-actions review follow-up:
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now emits live `corporate-actions:progress` updates during official NSE/BSE fetch, retries more NSE matches through exact ISIN and identity-history fallbacks, adds a manual `resolve_corporate_action_import` command for remaining `UNRESOLVED` rows, and orders official-import lists by newest ex-date instead of raw insert time.
  - `src/components/DatabaseToolsDialogs.tsx` now adds quick symbol/company/ISIN filters across Identity Import, Official Imports, Scan Database, and Review Issues, including a `Current` shortcut that fills the active chart symbol into the relevant filter.
  - Official Imports now labels the numeric column as `Adj Factor`, shows live fetch progress in percent while the official download is running, and opens a manual resolve panel for unresolved rows so they can be rechecked automatically or mapped to a selected current database symbol before approval.
  - Review Issues now loads non-approved import rows directly, keeps unresolved rows separate from ready-to-approve `PENDING` rows, and exposes the same resolve workflow there instead of forcing the user back to manual SQL or re-fetch cycles.
  - Active-chart refresh after quote / merge / corporate-action changes now matches both resolved and requested chart symbols, keeps the current viewport during reload, and explains when a fresh approval was applied but the chart is still showing `Raw` mode instead of `Adjusted`.
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`
    - `cargo check --manifest-path src-tauri-shell/Cargo.toml --message-format short`
    - `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`
    - `npm run typecheck:renderer`
    - `npm run test`
    - `npm run tauri:check`

- Chart event menu toggles:
  - `src-tauri-shell/src/main.rs` now adds a native `Chart > Events` submenu for the existing chart-event categories: splits, bonus, dividend, rights issue, symbol changes, and name changes.
  - `src/store/chartStore.ts`, `src/features/app/menuCommandRouter.ts`, and `src/components/ChartCanvas.tsx` now treat those menu clicks as session-level chart display toggles and filter markers before render, so the badges above the date axis can be shown or hidden without changing stored corporate-action data.
  - Current limit: upcoming result / earnings dates are not added in this pass because the active repo does not yet have a result-date fetch/storage/event pipeline.
  - validation for this pass:
    - `npm run typecheck:renderer`
    - `npm run test`
    - `npm run tauri:check`

- Chart event marker placement polish:
  - `src/engine/ChartEngine.ts` and `src/engine/Renderer.ts` now place corporate-action and identity event badges just above the bottom date axis instead of pinning them near the chart top.
  - Event badges now use a neutral theme surface and border instead of bright per-action filled colors, while keeping the existing event letters (`S`, `B`, `D`, `R`, `N`, `T`).
  - Hovered event details now render above the date bar near the hovered bar instead of occupying the chart top-left overlay area.
  - validation for this pass:
    - `npm run typecheck:renderer`
    - `npm run test`

- Corporate-actions filters + optional dividend/rights adjustments:
  - `src/components/DatabaseToolsDialogs.tsx` now adds manual multi-select action-type filters (`SPLIT`, `BONUS`, `RIGHTS`, `DIVIDEND`) to Official Imports and Review Issues without auto-loading or auto-approving anything
  - the same Corporate Actions / Identity window now supports manual dividend and rights entry/approval when the official/manual row includes the required cash terms
  - `src-tauri-shell/src/database/corporate_action_imports.rs` now treats parseable dividend and rights rows as approvable review candidates instead of permanent review-only rows; derived factors are computed later at approval time from the local previous close
  - dividend-purpose parsing no longer guesses from the first numeric token when an official row contains multiple cash components; explicit segmented dividend announcements can be combined, while ambiguous multi-component text now stays in manual review
  - when an official import row is approved into `corporate_actions`, its stored provenance now preserves the original import source (`NSE_API`, `BSE_API`, `NSE_CSV`, `BSE_CSV`) instead of flattening everything to one generic CSV label
  - `src-tauri-shell/src/database/instrument_mutations.rs` now saves approved dividend/right actions into the canonical `corporate_actions` table, deriving dividend factors from the prior close and rights factors from TERP using the local previous close plus issue price
  - `src-tauri-shell/src/database/eod_data.rs` plus `src/components/ChartSettingsMenu.tsx` now keep raw `.eod` storage untouched while exposing adjusted-mode-only checkboxes for `Include dividend adjustments` and `Include rights adjustments`; split/bonus adjustments remain part of normal Adjusted mode
  - chart events now include dividend (`D`) and rights (`R`) markers when approved actions exist
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`
    - `cargo check --manifest-path src-tauri-shell/Cargo.toml --message-format short`
    - `npm run typecheck:renderer`
    - `npm run test`
    - `npm run tauri:check`
    - `git diff --check -- src-tauri-shell/src/database.rs src-tauri-shell/src/database/bootstrap.rs src-tauri-shell/src/database/eod_data.rs src-tauri-shell/src/database/instrument_mutations.rs src-tauri-shell/src/database/corporate_action_imports.rs src-tauri-shell/src/database/nse_identity_imports.rs src/types/desktop.ts src/engine/types.ts src/engine/Renderer.ts src/store/chartStore.ts src/store/chartStoreTypes.ts src/features/charts/chartTabWorkspaceService.ts src/features/charts/chartInstrumentHydrationService.ts src/features/charts/compareOverlayService.ts src/features/charts/chartInstrumentCompareController.ts src/features/charts/chartTabSessionController.ts src/features/charts/chartSheetWorkspaceService.ts src/features/workspace/chartSnapshotHydrationService.ts src/components/ChartCanvas.tsx src/components/ChartSettingsMenu.tsx src/components/DatabaseToolsDialogs.tsx README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md docs/database-schema.md`
    - targeted `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture` was attempted but did not complete within the local timeout window

Verified on June 8, 2026:

- Recent Databases dialog:
  - added a new Recent Databases floating dialog that reads the existing backend registry from `snapshot.knownDatabases`, lets the user reopen a prior database directly, and can remove stale entries from the recent list without deleting the underlying database folder
  - wired the dialog into the native Database menu (`Recent Databases`), command palette, `uiStore`, and `RootApp` lazy-dialog mounting
  - added `remove_recent_database` in `src-tauri-shell/src/database/connection_registry.rs` so the recent list can be cleaned independently from the destructive delete-database flow
  - validation for this pass:
    - pending manual build and runtime check

- App build metadata + About dialog:
  - added `scripts/generate-build-metadata.cjs` and hooked it into the `tauri:build` / `tauri:bundle:nsis` prebuild path so builds now stamp `version`, `buildNumber`, and `builtAt` into `src-tauri-shell/gen/build-info.json`
  - updated `src-tauri-shell/src/main.rs` so `get_app_info` returns that build metadata along with the existing runtime/path diagnostics
  - replaced the old toast-only Help > About behavior with `src/components/AboutDialog.tsx`, a floating dialog that shows version/build/runtime/path info and manual version notes from `src/features/app/appVersionHistory.ts`
  - updated `scripts/prepare-tauri-portable.ps1` so staged portable `README.txt` includes the same version/build metadata
  - validation for this pass:
    - `node .\scripts\generate-build-metadata.cjs`
    - `npm run typecheck:renderer`
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `git diff --check -- package.json scripts\generate-build-metadata.cjs scripts\prepare-tauri-portable.ps1 src\components\AboutDialog.tsx src\features\app\appVersionHistory.ts src\features\app\menuCommandRouter.ts src\RootApp.tsx src\store\uiStore.ts src\types\desktop.ts src-tauri-shell\build.rs src-tauri-shell\gen\build-info.json src-tauri-shell\src\main.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md APP_VERSION_BUILD_METADATA_REPORT.md`
    - app build intentionally left to the user's manual build flow

- CSV import overlap skip fast-path refinement:
  - updated `src-tauri-shell/src/database/binary_eod.rs` so duplicate-skip overlap checks now read only the relevant existing date range once per symbol and compare incoming dates against that in-memory overlap set, instead of probing the binary file once per incoming date
  - updated `src-tauri-shell/src/imports.rs` so symbol/date-range summary fields now track the parsed import scope even when every row is skipped, which keeps full-skip imports from reporting `Symbols: 0` and blank date ranges
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `cargo test --manifest-path src-tauri-shell/Cargo.toml filter_records_against_existing -- --nocapture` (attempted twice, but did not complete within the local timeout window)
    - `cargo test --manifest-path src-tauri-shell/Cargo.toml imports -- --nocapture` (attempted twice, but did not complete within the local timeout window)
    - the timed-out cargo/rustc processes were terminated before leaving the pass

- CSV import parallel symbol pass:
  - updated `src-tauri-shell/src/imports.rs` so binary duplicate filtering and binary `.eod` writes now run as symbol-level worker jobs in a small bounded parallel pool instead of forcing all symbol work through one serial loop
  - the importer still parses source files serially, but the expensive binary-storage stage now reports live symbol progress as worker results complete
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `git diff --check -- src-tauri-shell/src/imports.rs src-tauri-shell/src/database/binary_eod.rs`
    - compile/build verification intentionally left to the next manual build
    - next real verification is the user's manual rebuild and overlap import benchmark

- CSV import batch progress and binary-write reduction:
  - updated `src-tauri-shell/src/imports.rs` so multi-file imports now sort selected files deterministically, emit live phase-aware progress during row parsing and binary-write stages, and aggregate binary `.eod` writes across the whole selected batch instead of writing once per symbol per input file
  - the importer now reports messages such as file position within the batch, parsed row counts, queued symbol counts, and binary write position by symbol while the import is still running
  - binary dual-write failures now increment `rowsError` instead of being treated as silent success, and binary-mode `On Duplicate: Skip` now filters already-present symbol/date rows before binary writes so overlapping monthly imports no longer reprocess the full overlap
  - updated `src-tauri-shell/src/database/binary_eod.rs` with a binary-search-based record-membership helper so overlap filtering no longer has to load whole `.eod` files just to answer date-existence checks
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `cargo test --manifest-path src-tauri-shell/Cargo.toml filter_records_against_existing -- --nocapture`
    - `cargo test --manifest-path src-tauri-shell/Cargo.toml imports -- --nocapture`
    - `git diff --check -- src-tauri-shell\src\imports.rs src-tauri-shell\src\database\binary_eod.rs README.md PROJECT_STATE_EOD_CHARTING_PLATFORM.md FILE_INVENTORY.md CSV_IMPORT_BATCH_PROGRESS_OPTIMIZATION_REPORT.md`
    - app build / `cargo check` intentionally skipped in this pass because the user requested no app build while the current app instance was running

Verified on May 26, 2026:

- Bhavcopy database-change chart refresh:
  - updated `src/features/workspace/chartRuntimeController.ts` so backend `db:changed` events clear the in-memory EOD cache and rehydrate every open chart tab with a loaded/requested instrument, not only the active tab
  - open tabs keep their existing viewport during the forced rehydration, so a post-download refresh should show newly imported history without requiring the user to manually reopen the symbol
  - validation for this pass:
    - `npm run typecheck:renderer`
    - `git diff --check -- src\features\workspace\chartRuntimeController.ts src\store\chartStore.ts README.md FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`

Verified on May 25, 2026:

- Bhavcopy series/group metadata foundation:
  - updated `src-tauri-shell/src/bhavcopy.rs` so NSE `SERIES`, BSE `GROUP`, and available `ISIN` values are persisted into `instruments` during equity bhavcopy imports
  - updated `src-tauri-shell/src/database/bootstrap.rs` so existing databases receive `instruments.series_as_of_date`; this prevents older full-history/backfill workers from overwriting newer daily-use series classification
  - retained broad equity import behavior so `BE/BZ` and SME equity series can remain stored for later symbol-browser filtering instead of being dropped at download time
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `cargo test --manifest-path src-tauri-shell/Cargo.toml bhavcopy -- --nocapture` (10 passed)
    - `npm run tauri:check`
    - `git diff --check -- src-tauri-shell\src\bhavcopy.rs src-tauri-shell\src\database\bootstrap.rs docs\database-schema.md FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md README.md`

- Symbols panel NSE series filter:
  - updated `src-tauri-shell/src/database/symbol_search.rs` so `list_symbols` / `search_symbols` accept an optional NSE series filter without deleting or skipping imported OHLCV history
  - updated `src/components/Sidebar.tsx` so Symbols defaults to `NSE Equity` for daily browsing and can switch between `All`, `NSE Equity`, `NSE EQ`, `EQ+BE/BZ`, and `NSE SME` while showing the stored series/group label beside each row
  - `NSE Equity` includes NSE `EQ`, `BE`, `BZ`, `SM`, `ST`, and `SZ` series so SME remains visible while government/security/debt-only series are hidden from daily symbol browsing; `All` remains available for inspection
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `cargo test --manifest-path src-tauri-shell/Cargo.toml symbol_search -- --nocapture` (5 passed)
    - `npm run typecheck:renderer`
    - `npm run tauri:check`
    - `git diff --check -- src-tauri-shell\src\database\symbol_search.rs src-tauri-shell\src\database.rs src\types\desktop.ts src\platform\types.ts src\store\chartStoreTypes.ts src\store\chartStore.ts src\features\charts\chartSearchController.ts src\features\charts\chartSymbolSearchService.ts src\features\workspace\databaseSnapshotService.ts src\features\workspace\chartRuntimeController.ts src\components\Sidebar.tsx FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md README.md`

Verified on May 15, 2026:

- Binary EOD Parity Audit (Phase 4B1 & 4B2):
  - Added backend `validate_binary_parity` command checking for missing files, count mismatches, date range mismatches, and corruption.
  - Added frontend Parity Audit UI with Global, Exchange, and Symbol scopes.
  - Confirmed read-only/diagnostic-only scope; no data mutation or repair logic added.
  - validation for this pass:
    - `cargo check`
    - `npm run typecheck:renderer`
    - `npm run test` (66 tests passed)

Verified on April 13, 2026:

- bhavcopy calendar-skip visibility for packaged Tauri:
  - updated `src-tauri-shell/src/bhavcopy.rs` so batch planning now enumerates the full requested date span and emits explicit skip results for Saturdays/Sundays across exchanges plus known official NSE / NSE Index holidays, instead of silently omitting those dates from the run
  - extended the built-in NSE holiday table to cover the 2023 and 2024 historical backfill range while preserving special-trading-day exceptions
  - updated the batch progress summary so the Activity Log now reports logged non-trading calendar days rather than only exchange-holiday skips
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `npm run tauri:check`
    - `npm run build`

Verified on April 12, 2026:

- bhavcopy full-history/update flow and long-run smoothing for packaged Tauri:
  - updated `src-tauri-shell/src/bhavcopy.rs` so batch downloads now accept `range`, `update`, and `fullHistory` modes; update mode resolves from the latest imported date in the active SQLite database, full-history mode uses built-in exchange baseline dates, and long runs prefilter already imported trading days before scheduling worker tasks
  - replaced the old chunked ordered-join worker flow in `src-tauri-shell/src/bhavcopy.rs` with completion-order worker result streaming so progress/results arrive as workers finish instead of waiting on chunk order
  - updated `src/components/BhavcopyDownloadWindow.tsx`, `src/types/desktop.ts`, and `src/platform/types.ts` so the window now exposes `Date Range`, `Update`, and `Full History` modes, caps retained Activity Log lines to the most recent 2,000 entries, and tracks incremental run-summary counters instead of retaining the full result array in React state during long historical downloads
  - validation for this pass:
    - `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
    - `npm run typecheck:renderer`
    - `npm run test`
    - `npm run tauri:check`
    - `npm run build`
    - `npm run tauri:portable:win`
    - bounded launch of `release/tauri-portable-win/EOD Chart Portable/EOD Chart.exe`

Verified on April 12, 2026:

- bhavcopy live-result + migration hardening for packaged Tauri:
  - updated `src-tauri-shell/src/database/bootstrap.rs` so existing databases now migrate `download_log.note`
  - updated `src-tauri-shell/src/bhavcopy.rs` so download-log writes use conflict-safe `UPSERT`s, missing-date archive misses become non-fatal skip results, and failed candidate parses continue to the next URL before the task is marked failed
  - added live `bhavcopy:result` emission so `src/components/BhavcopyDownloadWindow.tsx` can append per-date success/skip/fail rows while the batch is still running
  - updated `src/platform/tauriDesktop.ts`, `src/platform/types.ts`, and `src/types/desktop.ts` for the new live bhavcopy result listener surface
  - validation for this pass:
    - `npm run typecheck:renderer`
    - `npm run test`
    - `npm run tauri:check`
    - `npm run build`
    - `npm run tauri:portable:win`
    - bounded launch of `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`

Verified on April 12, 2026:

- bhavcopy batch error hardening for packaged Tauri:
  - updated `src-tauri-shell/src/database/bootstrap.rs` so backend SQLite connections now apply a `busy_timeout`
  - updated `src-tauri-shell/src/bhavcopy.rs` so a worker-side backend error is returned as a per-task failed result instead of aborting the whole batch command
  - updated `src/components/BhavcopyDownloadWindow.tsx` so Tauri invoke rejections that arrive as strings are shown directly in the Activity Log instead of as `Unknown error occurred`
  - validation for this pass:
    - `npm run typecheck:renderer`
    - `npm run tauri:check`
    - `npm run build`
    - `npm run tauri:portable:win`

Verified on April 5, 2026:

- `SIDEBAR_INDICATOR_PANEL_AND_AXIS_TAG_SPACING_REPORT.md` cleaned up the sidebar and right-axis tag stacking:
  - removed the `Active Chart` indicator chip section from `src/components/Sidebar.tsx`
  - updated `src/engine/Renderer.ts` and `src/engine/ChartEngine.ts` so the main price label stays anchored and study labels step away from it with clearer spacing

- `NEW_SHEET_PLAIN_CANDLE_REPORT.md` changed new-sheet creation to a fresh chart flow:
  - updated `src/store/chartStore.ts` so the sheet `+` action no longer clones the active workspace
  - new sheets now open as fresh plain-candle charts for the current symbol/timeframe, with indicators, compare overlays, drawings, and pane overrides cleared
  - updated `src/components/SheetTabs.tsx` copy so the UI reflects plain-candle sheet creation

- `SHEET_SCROLLBAR_SINGLE_ROW_REPORT.md` merged sheet tabs into the chart scrollbar strip:
  - updated `src/components/ChartCanvas.tsx` so the bottom strip accepts inline leading content next to the existing scrollbar controls
  - updated `src/components/SheetTabs.tsx` with an inline strip mode for the shared bottom row
  - updated `src/RootApp.tsx` so charts no longer render a second standalone sheet row

- `CONTEXTMENU_TIMEFRAME_SCALE_RELAYOUT_REPORT.md` removed the remaining layout/menu waste:
  - updated `src/RootApp.tsx` to suppress the native context menu at the app-shell level and drop the standalone timeframe row
  - updated `src/components/Toolbar.tsx` and `src/components/ChartHeader.tsx` so timeframe controls live inside the single toolbar row below chart tabs
  - updated `src/components/ChartCanvas.tsx` so the `Scale` control sits above the right price scale instead of in the toolbar

- `CHART_TOP_PRICE_SUMMARY_REPORT.md` moved the active symbol/price summary onto the chart:
  - reduced `src/components/ChartHeader.tsx` to a slim timeframe-only strip
  - updated `src/engine/ChartEngine.ts` so the active symbol, timeframe, exchange, OHLC, and signed change now render in a TradingView-style top-left chart summary
  - kept overlay and compare legends below that top summary instead of leaving the price identity in the header

- `CHART_MENU_CONTROL_CLEANUP_REPORT.md` cleaned up the duplicated chart controls:
  - removed the top-toolbar `Magnet`, `Raw`, `Adj`, `Log`, `Vol`, and `Compare` buttons from `src/components/Toolbar.tsx`
  - kept `Magnet` on the right chart tool dock in `src/components/ChartToolDock.tsx` and replaced the old generic symbol with a bar-magnet icon
  - moved `Compare...`, `Magnet`, and explicit `Raw` / `Adjusted` price mode actions into the native `Chart` menu through `src-tauri-shell/src/main.rs`
  - routed menu-driven compare opening through `src/store/uiStore.ts` and `src/features/app/menuCommandRouter.ts`

- `DYNAMIC_PRICE_SCALE_WIDTH_REPORT.md` restored content-fit right-axis width:
  - updated `src/engine/ChartEngine.ts` so the right price scale no longer stays pinned to the old fixed width
  - reused measured axis-label/value-tag text widths and mirrored the measured width into `src/components/ChartCanvas.tsx`
  - the right price scale now shrinks and expands based on the current visible labels instead of staying permanently wide

- `SIDEBAR_SYMBOL_INDEX_CLICK_FIX_REPORT.md` changed the symbol alphabet rail from drag-scrub behavior to click-only jumps:
  - updated `src/components/Sidebar.tsx` so moving the mouse over the alphabet strip no longer changes the symbol group
  - clicking a letter now jumps to that symbol section, and the alphabet rail now aligns with the symbol list body height beside the scrollbar area

- `SIDEBAR_SYMBOL_SCROLL_HARDENING_REPORT.md` hardened the Symbols sidebar scroll behavior:
  - updated `src/components/Sidebar.tsx` so the Symbols panel now uses a normal native scroll list instead of the old virtualized symbol-list path
  - reserved stable scrollbar gutter space for the symbol list so the list/rail layout stays steady
  - wired alphabet clicks to real group-header anchors and forwarded mouse-wheel input from the alphabet strip into the actual symbol-list scroll container

- `SIDEBAR_EMPTY_STATE_LABEL_FIX_REPORT.md` fixed the awkward left-edge `No chart data loaded` text when the sidebar is open:
  - updated `src/engine/ChartEngine.ts` so the empty-state message is centered inside the visible chart viewport
  - the centered placement now respects the reserved right-axis width and bottom x-axis strip instead of using a hardcoded left x-position

- `SIDEBAR_INDICATOR_DOUBLE_CLICK_FIX_REPORT.md` changed sidebar indicator plotting from single-click to double-click:
  - `src/components/Sidebar.tsx` no longer adds indicators on the first click
  - sidebar indicators now add on double-click, while drag-to-chart remains unchanged
  - sidebar hint/tooltip copy was updated to match the new behavior

- `OVERLAY_LEGEND_DUPLICATE_LABEL_FIX_REPORT.md` fixed the doubled-looking EMA/overlay label at the top-left of the chart:
  - removed the duplicate DOM overlay study-label block from `src/components/ChartCanvas.tsx`
  - kept the canvas-rendered overlay legend as the single source of truth for overlay study names and values

- `FUTURE_BARS_RENDERING_REPORT.md` turned the old dead right margin into rendered future-bar time space:
  - `src/engine/ScaleManager.ts` now generates future-aware X-axis ticks across the full logical viewport for `D/W/M/Q/Y`
  - `src/engine/Crosshair.ts` now lets the crosshair move through future slots and display synthesized future dates instead of snapping back to the last real bar
  - `src/engine/Renderer.ts`, `src/engine/ChartEngine.ts`, and `src/components/ChartCanvas.tsx` now share the same future-bar timeline so right-side margin space renders as future time, not a dead visual gap

- `VIEWPORT_SCALE_ROOT_FIX_REPORT.md` fixed the shared viewport/price-scale geometry:
  - added a shared stable right-axis width in `src/engine/ChartEngine.ts` and updated `src/components/ChartCanvas.tsx` to use the same width instead of a separate hardcoded layout
  - removed per-frame axis-width remeasurement so zoom/unzoom no longer changes chart width while the user is interacting
  - changed wheel zoom and chart `+/-` zoom to keep the current right edge fixed instead of using cursor/hover anchoring, so zoom-out reveals more history to the left without horizontal chart scroll
  - updated `src/engine/Renderer.ts` so y-axis labels are clipped to pane bounds and stop at the chart window instead of bleeding into the pane below or the x-axis area

- `FULL_ZOOM_OUT_VIEWPORT_FIX_REPORT.md` fixed the dense full-history zoom-out viewport fit:
  - updated `src/engine/ScaleManager.ts` so X-scale spacing can become sub-pixel when the visible bar span is wider than the plot width
  - added `src/engine/__tests__/ScaleManager.test.ts` coverage for dense full-history fit and repeated zoom-out clamping
  - user rebuilt the Windows portable app and confirmed full zoom-out works without other observed issues

- `CHART_SETTINGS_MENU_REPORT.md` added an EOD-only TradingView-style scale settings menu:
  - added `src/components/ChartSettingsMenu.tsx` as a dark popover for auto-fit, regular/log scale mode, invert scale, right-axis value labels, and future-bar spacing
  - updated `src/components/Toolbar.tsx` and `src/components/ChartCanvas.tsx` so the same menu can open from both the toolbar and a right-click interaction on the price-scale zone, keeping the axis visually blank
  - added `Fit all panes` so manual scale overrides across price and indicator panes can be cleared in one action
  - updated `src/store/chartStore.ts`, `src/features/workspace/workspacePersistence.ts`, `src/features/charts/chartDataUtils.ts`, `src/components/ChartCanvas.tsx`, `src/engine/ChartEngine.ts`, `src/engine/ScaleManager.ts`, and `src/engine/types.ts` so those settings persist per chart tab and drive viewport/axis behavior
  - future-bar spacing is now configurable as `tight`, `normal`, or `wide` instead of living as a hidden fixed constant, and the price scale now supports invert mode without pulling in TradingView options that do not fit an EOD/offline product
  - chart area right-click opens a context menu first (`Reset chart view`, `Chart settings...`, `Remove drawings`, `Remove indicators`); removal rows expand into explicit one-item-at-a-time choices instead of clearing every drawing or indicator on the first click, and price-scale right-click still opens the focused scale popover
  - the chart settings dialog has functional Symbol, Status line, Scales and lines, Canvas, Alerts, and Events sections; there is no Trading tab, and Alerts now manages persisted EOD scan alert rules for current-chart price and preset indicator conditions
  - Renko settings support ATR / Traditional / Percentage (LTP), source, one-sided wicks with Reversal attempt or Full source range modes, color-picker controls for up/down/projection/wick colors, and incomplete-brick projection up/down display; Traditional defaults to a 10-point box unless the user changes it, accepts manual boxes from 0.05 upward, keeps typing as a text draft, and reports dialog-origin Renko guard failures inline on OK instead of closing the modal
  - Renko conversion uses one-box continuation and two-box reversal gating so reversal bricks behave closer to TradingView-style Renko charts
  - Renko wicks default to TradingView-style reversal-attempt behavior, remain one-sided and anchor-aware, and can be switched to full source range when source high/low wicks are desired
  - Canvas settings now persist per chart/sheet for grid visibility/color, background color, crosshair visibility/color, watermark visibility/color, and Renko visual colors; the right-side tool dock keeps Cursor / Select as the default and exposes Crosshair as an explicit mode
  - drawing tools now create new plots in blue by default, and Drawing Properties uses an app-controlled color chooser with presets, RGB sliders, outside-click close, and OK confirmation
  - the chart-top status label includes the company name plus symbol and active Renko settings/value, for example `Canara Bank (CANBK) | D | NSE | Renko [Traditional, 2]`
  - the Renko generated-brick safety cap is intentionally high enough for practical low-point Traditional histories while still blocking tick-sized full-history outputs that would create extreme synthetic bar counts
  - price-scale right-click and the chart-side gear open the separate scale settings popover for auto-fit, log/invert scale, labels, panes, and future-bar spacing
  - EOD alerts persist rules and scan-time alert history in the app profile, Chart Settings > Alerts remains current-chart focused for review/settings, Chart > Alert Manager lists all persisted rules with symbol/type/status filters, enable/disable, lock/unlock, protected delete, and recent history, Scanner > Alerts owns a compact `Run alert scan` surface with active-chart/symbol-list/watchlist scope controls and tabbed Latest scan matches / Alert history tables, price-only, indicator-only, and drawing-line alerts evaluate completed bars without normal scanner selection, scanner-match alerts run their configured scanner IDs, indicator output contracts cover RSI threshold crosses, MACD/signal crosses, EMA crosses, and close/EMA crosses, supported chart indicators can create preset alert rules from their chart-side controls/legend rows, drawing alerts can be created from horizontal line/trendline/ray context menus, duplicate active drawing alerts are blocked, deleted linked drawings disable their rules as missing drawings, frequency can be once, once per symbol/date, every scan, or once until reset, and triggered alerts appear in the latest-scan and persistent history tables

- `SEARCHABLE_INDICATOR_DIALOG_REPORT.md` added a searchable indicator picker flow:
  - added `src/components/IndicatorPickerDialog.tsx` as a grouped searchable modal over `INDICATOR_CATALOG`
  - updated `src/components/Toolbar.tsx` to replace the plain indicator `<select>` with an `Indicators` button
  - preserved `addIndicatorCatalog(...)` and the existing `IndicatorSettingsDialog` flow
  - validation for this pass:
    - `npm run test`
    - `npm run typecheck:renderer`
    - `npm run tauri:check`
    - `npm run build`
    - `npm run tauri:portable:win`

- `CLAUDE_HANDOFF_ARCHITECTURE_REPORT.md` added a repo-safe Claude handoff bundle:
  - added `CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md` as the strict current-state prompt for future Claude sessions
  - added `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md` as the current Tauri-only architecture and structure guide
  - updated core docs so these handoff docs are part of the active repo baseline
  - marked `EOD_CHART_CODEX_PROMPT_REVISED.md` as historical scaffold context instead of the live implementation baseline
- `STORE_SPLIT_PASS2_REPORT.md` completed the next behavior-preserving frontend architecture pass:
  - added `src/features/workspace/workspacePersistence.ts` for persisted workspace/sheet/layout types plus workspace serialization, parsing, and restoration helpers
  - added `src/features/workspace/databaseSnapshotService.ts` for lightweight snapshot fetch, active-database refresh loading, and post-open snapshot hydration helpers
  - updated `src/store/chartStore.ts` so workspace persistence and snapshot detail loading no longer live directly inside the store
  - updated `src/components/LayoutManagerDialog.tsx` so saved layouts use the shared workspace serializer instead of importing serialization from `chartStore`
  - reduced `src/store/chartStore.ts` from 2173 lines to 1953 lines while preserving the current chart/watchlist/session behavior
  - latest validation for that pass:
    - `npm run typecheck:renderer`
    - `npm run tauri:check`
    - `npm run build`
    - `npm run tauri:portable:win`
    - bounded launch of `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`
- `STORE_SPLIT_PASS1_REPORT.md` completed a behavior-preserving frontend architecture pass:
  - added `src/store/uiStore.ts` for shell UI/dialog/drawing-tool state
  - added `src/store/workspaceStore.ts` for persisted sidebar shell layout state
  - added `src/features/watchlists/watchlistService.ts` and `src/features/workspace/workspaceService.ts` as the first feature-service extraction seams
  - reduced `src/store/chartStore.ts` back toward chart/workspace/watchlist orchestration instead of shell UI ownership
- latest validation for that pass:
  - `npm run typecheck:renderer`
  - `npm run tauri:check`
  - `npm run build`
  - `npm run tauri:portable:win`
  - bounded launch of `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`
- bounded launch of `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`
- active packaged process observed as `EOD Chart`
- TradingView-style visual parity pass now adds:
  - shared comma/grouped numeric formatting across the axis, crosshair, and chart header
  - dynamic right-axis width based on visible labels
  - live indicator pane values in the overlay layer
  - indicator right-axis value tags
  - live overlay-indicator readouts in the price pane
- P2 pane ergonomics pass now adds:
  - per-pane collapse/expand controls with compact collapsed rails
  - persisted collapsed-pane state per chart tab
  - per-pane fit/autoscale reset for manual indicator-pane scale overrides
- P2 price-scale pass now adds:
  - main price-pane last-value tags on the right axis for the primary price series and overlay studies
- P2 compare overlay pass now adds:
  - EOD-only compare overlays from the local symbol database
  - persisted compare overlay state per chart tab and sheet
  - compare rebasing from the first visible bar in the main price pane
  - compare legend tokens and right-axis tags showing relative performance
- Right-scroll gap fix now adds:
  - a tighter fixed future-bar margin on the time scale so right-scroll actions no longer open a wide empty zone after the last bar
  - bottom-scrollbar end-position now aligns with drag/right-button movement instead of snapping flush to the price scale

Latest packaged portable output:

- folder: `release/tauri-portable-win/EOD Chart Portable`
- launcher: `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`
- executable: `release/tauri-portable-win/EOD Chart Portable/EOD Chart.exe`

## Backup Baseline

- On April 4, 2026, the old multi-folder backup set was pruned to reclaim disk space.
- The retained compact baseline backup is:
  - `backups/pre_opencode_changes_20260404_150804_compact_backup_baseline`
- That compact baseline intentionally contains active source/config/docs only and excludes generated output, databases, and prior backups.
- Normal pre-change backups should now be created with:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\create-project-backup.ps1 -ShortName <short_name>`
- The scripted backup path should preserve the timestamped folder style while excluding generated/output folders. It must continue to include source configuration such as `.cargo/config.toml`; the verified August 13 reconciliation-basis snapshot includes that directory and remains aligned with root-target portable builds.
- Backup retention review now has a dry-run helper:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prune-backups.ps1`

## Current Rollout Direction

- Tauri is now the sole active desktop runtime.
- Windows portable workflow is the primary daily-use/dev baseline.
- Installer-first hardening and macOS work remain deferred.
- Performance work should continue inside the current Tauri-only architecture rather than by rewriting the chart engine.
- Bhavcopy durability remains frozen. Current independent caps are binary import/write = 2, binary coverage prefilter = 4, and deferred checkpoint = 2. Do not change any cap without a comparable storage-contention benchmark and a genuine workload check.
- Quote Editor is an embedded in-app `FloatingWindow`; a separate native Tauri child window is not the accepted UX.
- The next genuine trading-day Bhavcopy log is required before judging V1.7D responsiveness/performance.
- The current one-row physical/index mismatch is a separate read-only reconciliation item and must not be silently repaired during unrelated work.
- Historical backward fills can remain slower because conservative binary mutations physically sync immediately; prefer chronological oldest-to-newest bulk history loading when practical.
- The current backend performance baseline now includes:
  - persistent active SQLite connection reuse
  - lightweight snapshot split
  - SQL-first symbol listing/search
  - recent EOD cache reuse
  - watchlist-only refresh without DB-stats churn
  - cached DB stats for unchanged active databases
  - reduced watchlist-panel rerender churn during watchlist switching and chart interaction
  - lighter first-open sidebar rendering through symbol/watchlist list virtualization
  - AmiBroker-style database-open flow that keeps the current chart visible during DB switch, hydrates watchlists before DB stats, and lazy-loads the symbol browser after open
  - DB-open migration fix that stops rerunning legacy `eod_prices -> instruments` backfill work on every database open
  - async backend DB-open commands that move blocking snapshot/open/stats work off the direct command path
  - stronger UI-driven zoom anchoring that preserves the last logical hover focus instead of dropping back to a weaker pivot when the pointer leaves the plot area
  - pane-aware drawing placement, selection, and editing inside indicator panes for pane-valid tools while keeping fib/gann restricted to the main price pane
- The current frontend architecture baseline now also includes:
  - `src/store/uiStore.ts` for shell UI/dialog/drawing-tool state
  - `src/store/workspaceStore.ts` for persisted sidebar shell layout state
  - thin feature-service seams under `src/features/watchlists/` and `src/features/workspace/`
  - `src/features/workspace/workspacePersistence.ts` for shared workspace parsing/serialization helpers
  - `src/features/workspace/databaseSnapshotService.ts` for shared snapshot lifecycle loading helpers
  - a slimmer `chartStore` boundary that no longer owns shell dialog visibility or sidebar shell persistence directly
  - `src/components/SheetTabs.tsx` now uses in-app create/rename/delete dialogs instead of browser-style `tauri.localhost` prompts
  - watchlist create/rename/delete flows now use in-app dialogs and toast feedback instead of browser-style prompts, confirms, or alerts
  - layout deletion in `src/components/LayoutManagerDialog.tsx` now uses an in-app confirmation dialog instead of browser `confirm(...)`
  - `src/features/watchlists/officialWatchlistResolver.ts` now holds the seven pure official watchlist resolver helpers extracted from `chartStore`
  - `src/features/watchlists/officialWatchlistImportService.ts` now holds the official watchlist import/update business logic (`runOfficialWatchlistImport`, `runOfficialWatchlistUpdate`); `chartStore.ts` is now at 1,566 lines
  - Official Watchlist Testing Foundation: `vitest` installed, `vitest.config.ts` created, `"test": "vitest run"` script added, 2 test files with 54 unit tests for `officialWatchlistResolver.ts` and `officialWatchlistImportService.ts`; all tests pass
  - "Last synced" readout added to Watchlists sidebar panel for official source-linked watchlists; hidden for manual watchlists
  - Sync-status completion: timezone label + tooltip on sidebar readout; per-row last-synced sub-line in Manage Watchlists dialog; sync remains manual-only
  - "Update All" bulk action in Manage Watchlists dialog; `updateAllOfficialWatchlists()` store action; sequential update loop; summary toast; manual watchlists skipped
  - MACD histogram now uses 4-color momentum styling: teal/muted-teal for positive-increasing/decreasing bars, red/muted-pink for negative-decreasing/increasing bars; all other histogram indicators retain two-color behavior
  - indicator pane controls added: per-pane gear (settings) and × (remove) action buttons in `ChartCanvas.tsx`; `IndicatorSettingsDialog` extracted from `Toolbar.tsx` into `src/components/IndicatorSettingsDialog.tsx` as a shared component; pane drag-resize was already in place
  - P2 pane ergonomics pass: per-pane collapse/expand state persisted per chart tab; collapsed panes render as compact rails without destroying remembered expanded heights; indicator panes now expose a pane-level fit/autoscale reset in chart chrome
  - P2 price-pane last-value tags pass: the main price pane now renders right-axis last-value tags for the latest price and overlay-study values while preserving the existing dashed EOD last-price marker
  - High-Value Chart Features pass: **Supertrend** ATR overlay (period 10, multiplier 3, up/down color); **log scale toggle** (Log button in Toolbar, `buildScaleY` log-math branch, price pane only); **source input selector** (close/open/high/low/hl2/hlc3/ohlc4 for 11 indicators: SMA/EMA/WMA/WEMA/DEMA/TEMA/BOLL/RSI/MACD/ROC/MOM); **volume toggle** (Vol button in Toolbar, `showVolume` persisted per tab); `logScale` and `showVolume` serialized in workspace

## Current High-Value Reports

Current August 8–13 import/download evidence is retained under `docs/changes/`, including Manual Import Recovery, Phase 2B.1/2C, interrupted-checkpoint resume, Phase 2D background checkpointing, Update cutoff, Calendar Safety V1.1, Prefilter Range Scan V1, BSE/BSE Index candidate classification, compact progress UI, BSE historical compatibility, and BSE Index literal-date recovery. August 4–5 Market Movers and portable/Cargo-target alignment evidence remains retained as earlier baseline evidence.

Older historical reports live under `docs/archive/`.

Recent high-value change evidence:

- `docs/changes/2026-08-22_2114_IST_STORAGE_QUOTE_EDITOR_WARNING_CLEANUP_CLOSEOUT.md`
- `docs/changes/2026-08-09_1450_IST_MANUAL_IMPORT_RECOVERY_SESSIONS_V1.md`
- `docs/changes/2026-08-09_1702_IST_MANUAL_IMPORT_RECOVERY_HISTORY_V1_2.md`
- `docs/changes/2026-08-09_2110_IST_BHAVCOPY_RECOVERY_HARDENING_PHASE2B_1_V1.md`
- `docs/changes/2026-08-09_2323_IST_BHAVCOPY_APPEND_NEWEST_BUFFERED_DURABILITY_PHASE2C_V1.md`
- `docs/changes/2026-08-10_0145_IST_BHAVCOPY_COMPACT_PROGRESS_UI_FIX_V1.md`
- `docs/changes/2026-08-10_BSE_INDEX_LITERAL_DATE_URL_FIX_V1.md`
- `docs/changes/2026-08-10_1212_IST_BHAVCOPY_FINAL_ACCEPTANCE_AND_DOCUMENTATION_RECONCILIATION.md`
- `docs/changes/2026-08-12_2102_IST_BHAVCOPY_INTERRUPTED_CHECKPOINT_RESUME_FIX_V1.md`
- `docs/changes/2026-08-12_2353_IST_BHAVCOPY_PHASE2D_BACKGROUND_CHECKPOINT_V1.md`
- `docs/changes/2026-08-13_0030_IST_BHAVCOPY_UPDATE_SAME_DAY_CUTOFF_V1.md`
- `docs/changes/2026-08-13_0232_IST_BHAVCOPY_CALENDAR_SAFETY_V1_1.md`
- `docs/changes/2026-08-13_1305_IST_BHAVCOPY_PREFILTER_RANGE_SCAN_V1.md`
- `docs/changes/2026-08-13_1555_IST_BHAVCOPY_BSE_INDEX_CANDIDATE_CLASSIFICATION_V1_1.md`
- `docs/changes/2026-08-13_1658_IST_BHAVCOPY_FINAL_DOCUMENTATION_RECONCILIATION_V3.md`

- `CLAUDE_HANDOFF_ARCHITECTURE_REPORT.md`
- `STORE_SPLIT_PASS1_REPORT.md`
- `STORE_SPLIT_PASS2_REPORT.md`
- `SHEET_DIALOG_REFINEMENT_REPORT.md`
- `WATCHLIST_DIALOG_REFINEMENT_REPORT.md`
- `LAYOUT_DIALOG_REFINEMENT_REPORT.md`
- `TAURI_PERFORMANCE_PASS1_REPORT.md`
- `TAURI_LIGHTWEIGHT_SNAPSHOT_SPLIT_REPORT.md`
- `TAURI_SYMBOL_SEARCH_EOD_CACHE_REPORT.md`
- `WATCHLIST_LOAD_DB_STATS_PERFORMANCE_REPORT.md`
- `DB_STATS_CACHE_PERFORMANCE_REPORT.md`
- `WATCHLIST_SWITCHING_PERFORMANCE_REPORT.md`
- `PORTABLE_ASSET_STAGING_FIX_REPORT.md`
- `PORTABLE_LAUNCHER_WORKDIR_FIX_REPORT.md`
- `TAURI_FRONTEND_ASSET_REBUILD_INVALIDATION_REPORT.md`
- `DATABASE_OPEN_ZOOM_VIDEO_REFINEMENT_REPORT.md`
- `AMIBROKER_STYLE_DATABASE_OPEN_FLOW_REPORT.md`
- `DB_OPEN_MIGRATION_FIX_REPORT.md`
- `DB_OPEN_ASYNC_COMMAND_FIX_REPORT.md`
- `PANE_AWARE_DRAWING_SUPPORT_REPORT.md`
- `VISUAL_PARITY_TRADINGVIEW_REPORT.md`
- `P2_PANE_COLLAPSE_FIT_REPORT.md`
- `P2_PRICE_PANE_LAST_VALUE_TAGS_REPORT.md`
- `OFFICIAL_WATCHLIST_TESTING_FOUNDATION_REPORT.md`
- `OFFICIAL_WATCHLIST_LAST_SYNCED_UI_REPORT.md`
- `OFFICIAL_WATCHLIST_SYNC_STATUS_COMPLETION_REPORT.md`
- `OFFICIAL_WATCHLIST_UPDATE_ALL_REPORT.md`
- `MACD_4COLOR_HISTOGRAM_REPORT.md`
- `INDICATOR_PANE_CONTROLS_REPORT.md`
- `OFFICIAL_WATCHLIST_IMPORT_FOUNDATION_REPORT.md`
- `OFFICIAL_WATCHLIST_UPDATE_REPORT.md`
- `OFFICIAL_WATCHLIST_LIVE_SOURCE_REPORT.md`
- `WATCHLIST_MENU_IMPORT_WINDOW_REFINEMENT_REPORT.md`
- `WATCHLIST_DUPLICATE_IMPORT_AND_SYMBOL_CONTEXT_MENU_FIX_REPORT.md`
- `TAURI_ONLY_ELECTRON_RETIREMENT_REPORT.md`
- `BACKUP_RETENTION_RESET_REPORT.md`

## Legacy Note

Older migration reports may still discuss Electron and the deleted `src-tauri` tree as historical context. Those references are superseded by the April 4, 2026 Tauri-only retirement pass and legacy-tree removal follow-up.

<!-- V1.13-FINAL-CLOSEOUT:BEGIN -->
## Corporate Actions Phase 1 — V1.13 six-row identity repair closeout (2026-08-19)

V1.13B-1 is **FULL_SUCCESS** after independent V1.13C-1.2.1 post-audit.

- Original write authority: V1.13B-1 Preflight `20260818_144646_557`, status `READY`.
- Controlled Apply: `20260818_170635_303`, `COMMITTED_PENDING_POST_AUDIT`, exactly 6 `instrument_isin_history` inserts.
- Independent post-audit: `20260819_003421_289`, `FULL_SUCCESS`.
- Verified side effects: 0 forbidden-table changes, 0 Corporate Action status promotions, 0 Quick Resolves, 0 approvals.
- The post-Apply database was a valid checkpointed main-only SQLite state; the audit opened only private copies.
- The six-row tranche is closed. Do not rerun V1.13B-1 Apply.
- Eight protected imports remain unresolved/unapproved and must be handled as a separate governed workstream; they are not implicitly repairable by the six-row history-only method.

Evidence and exact hashes are recorded in `docs/changes/evidence/2026-08-19-corporate-action-v1-13-final-closeout.json`.
<!-- V1.13-FINAL-CLOSEOUT:END -->

<!-- V1.14E-SOURCE-IMPLEMENTATION:BEGIN -->
## Corporate Actions Phase 1 — V1.14E historical event identity resolution source implementation (2026-08-19)

V1.14E source implementation introduces a dedicated, structured historical event-identity resolution layer for the exact reviewed **184 Corporate Action imports across 44 NSE symbol-transition chains**.

- Raw `corporate_action_imports.symbol` / `isin` remain source provenance and are not rewritten by V1.14E.
- The first tranche resolves **event-time symbol only**. Historical `eventIsin` remains null unless independently established by a future separately authorized evidence phase.
- Runtime reads fall back to raw identity while the V1.14E table is absent.
- The new table is **not** part of automatic `bootstrap.rs` migrations in this tranche. It can be created only by the controlled V1.14E Apply transaction after an exact read-only Preflight and separate live-write approval.
- Split/Bonus scan candidate lookup uses the effective event-time symbol when a V1.14E resolution exists.
- Official Imports / Review Identity UI preserves the raw API symbol and shows the historical event symbol separately.
- V1.14E source implementation does not itself Quick Resolve, approve, mutate identity history, mutate ISIN history, or change raw EOD data.
- Live database application remains a later explicit gate and is not authorized by source installation.
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
## Bhavcopy download fallback

Choose exchanges and Date Range, Update or Full History, then press **Start Download**. The downloader tries the configured URL and existing official alternatives first. If BSE equity or index requests fail because of blocking or source/transport errors, it can retry the official daily sources through an internal browser session. There is no separate browser choice, security-code entry or download-only mode. NSE retains its existing URL fallback chain.

A 403 response is reported as blocked; a confirmed 404 remains unavailable. Browser recovery is bounded, serialized and stopped after source refusal/repeated failures. Recovered original daily-source responses pass through normal staging/import validation. A missing archive is not a holiday, and browser recovery does not make unpublished archives available. The separate security-wise history API is retained internally for source evidence, but is not silently substituted for a complete Bhavcopy or used to manufacture ticker identity or missing volume.

Normal download/import durability and identity safeguards remain in place. Batch staging avoids per-date database migrations, uses bounded SQLite log-write retries, and stops/joins workers on fatal failure. Command completion/error settles the download status; skipped dates are counted separately from imported jobs.
