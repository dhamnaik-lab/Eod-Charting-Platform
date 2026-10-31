# Feature Status Matrix — EOD Charting Platform

## Identity maintenance checkpoint — 30 October 2026

| Feature | Evidence / remaining limit |
| --- | --- |
| Shared NSE/BSE reviewed confirmations | Implemented and checked; BSE company-name dialog confirmed natively; other native routes retain their acceptance limits. |
| BSE company-name history | Native Refresh/Preview and successful 1,531-name Apply; persisted receipt audit has zero mismatches. |
| BSE completed status / saved reporting | Native green 100%, APPLIED rows, disabled repeat Apply, Recent Applied and expanded hashes confirmed. |
| Saved-report polish | Implemented: saved wording, path/hash Copy, counted outcome filters, display preferences and clarified readiness notice; 41 focused tests plus renderer/CSS/docs checks PASS. |
| Native polish / clipboard / app restart persistence | User screenshots/pasted values confirm saved wording, hover, outcome views, search in All and exact path/hash copying; restart persistence is user-confirmed. Newer run: 2 Applied / 2,845 All / 1,310 Skipped / 1,533 Duplicates. |
| Remaining native report limits | Search with a non-All outcome filter, validation-notice wording, clipboard failure and other native routes remain unverified. No new Apply required for report checks. |
| BSE Security ID history | Held pending separately verified dated source evidence. |

See [handoff](HANDOFF.md) and [native evidence and remaining limits](docs/changes/2026-10-30-identity-report-polish/REPORT.md).

## Latest CA acceptance and deferred work — 26 October 2026

| Feature | Evidence / remaining limit |
| --- | --- |
| Bulk explicit approval | Native completion and read-only audit: 4,288 persisted actions including NSE/BSE Split/Bonus; no replay. |
| Table exchange | Native Approved subset: 994 NSE events, 997 all exchanges; Fetch scope remains separate. |
| Performance | Native seed 16m28s; approval/refresh 16m32s; unchanged warm reuse unmeasured. |
| Progress and result UI | Incomplete: silent Checking period, Dividend-only subtotal, truncated summary, stale timer. |
| Approved history | 1,000 loaded imports are a subset; full history discoverability/counts need work. |
| Current priority | Database issue first; CA paused. Chart arithmetic and specific Stage 2A blocker native checks remain open. |

This checkpoint supersedes older current-status claims below.
See [CA resume checkpoint](docs/changes/2026-10-26_CA_PAUSE_DATABASE_PRIORITY_HANDOFF.md).

## Corporate Actions acceptance update — 25 October 2026

This dated update supersedes older CA rows below; unrelated feature status is unchanged.

| Feature | Current evidence and limit |
| --- | --- |
| Selected Dividend approval/report/chart marker | User native screenshots: HEGAM import 44439 committed, saved history and chart marker. Numeric chart comparison remains unverified. |
| Targeted post-approval queue refresh | 88 focused tests, renderer/whitespace PASS; native ICICIGI/HDBFS approvals refreshed 2/3 related events in 4/2 seconds, retaining full queue and unrelated readiness. |
| Identity quick search | 34 focused tests, renderer/whitespace PASS; native symbol/case, exact-symbol priority, full-ISIN and empty results observed with 33,971 loaded unchanged. |
| Esc and × clear | Explicitly confirmed working by the user. |
| Details evidence view | Native ISIN, official terms, source provenance and blocker explanations visible; user confirms this option is needed. |
| Remaining search checks | Whitespace padding, exact BSE-code lookup and measured typing speed are not yet verified natively. |
| Other acceptance boundaries | Split/bulk approval, adjusted/unadjusted chart prices, independent live raw hashes and fresh BSE master transport remain open. |

Evidence: [current handoff](HANDOFF.md), [targeted refresh](docs/changes/2026-10-25_CA_POST_APPROVAL_QUEUE_REFRESH.md),
[quick search](docs/changes/2026-10-25_CA_QUICK_SEARCH.md). No approval authorization is granted by this matrix.

<!-- EOD-CANONICAL-STATUS-2026-10-17-R1 -->
## Current verified platform and Corporate Actions status — 17 October 2026 IST

| Feature / obligation | Verified disposition |

|---|---|

| Existing CA active window and advanced controls | Source preserved; desktop observation NOT VERIFIED |

| Official Fetch, Load & Validate, explicit Approve Ready | Integrated source + focused tests PASS; live feeds NOT TESTED |

| Upcoming ex-date and missing EOD guards | Unit/focused tests PASS; manual integration NOT VERIFIED |

| Normal Load auto-approval prohibition | Implemented and focused tests PASS |

| Rust CA approval transaction and existing chart invalidation | Preserved code; controlled live manual checkpoint NOT VERIFIED |

| Renderer typecheck / focused Vitest / Vite build | PASS / 62 of 62 / PASS |

| Rust focused tests / offline cargo check | 2 of 2 PASS / PASS (7 warnings) |

| Offline normal release and separate static-CRT build | PASS / PASS; static PE direct+delay VC imports clear |

| Windows Sandbox app initialization | BLOCKED (CRT first attempt; WebView2 second) |

| Real official feed / production DB approval / portable installation | NOT TESTED / NOT AUTHORIZED / NOT VERIFIED |

| External JavaScript plugin activation | DISABLED; production guest isolation UNVERIFIED |

**Plugin P5-FINAL:** metadata-only import/discovery/reload architecture is closed with third-party external JavaScript evaluation and activation still **DISABLED**. C2 did not prove production guest process/IPC isolation; no plugin activation is permitted by the CA documents. The three previously unattributed P1/P2 files were accepted by exact isolated reconstruction on 17 October.

**Still open:** actual normal desktop workflow observation; official-feed integration under separately authorized network conditions; non-destructive/controlled approval and chart/cache refresh manual verification; optional portable Windows packaging. No further test environment redesign or production database modification is implied by this documentation update.
<!-- END-EOD-CANONICAL-STATUS-2026-10-17-R1 -->

<!-- STANDALONE-PLUGIN-ARCHITECTURE-P1-P3-2026-10-16:BEGIN -->
## Standalone External Plugin Architecture and SDK — P1–P3 status

- **Design boundary:** The EOD Charting Platform remains the protected core. Plugin Manager owns generic lifecycle controls; each plugin owns its own menu-opened interface and settings. External developers should integrate through the SDK and host interfaces rather than editing platform core code.
- **P1/P2 implemented components (reported, not independently reaccepted here):** `src/plugins/pluginHost.ts`, `src/plugins/types.ts`, `src/plugins/pluginLoader.ts`, `src/engine/ChartEngine.ts`, `src/components/SettingsDialog.tsx`, and `src-tauri-shell/src/plugin_data.rs` provide extension registrations, loading and user-facing controls. The SDK is in `packages/eod-plugin-sdk/` with a development sample plugin.
- **P3 accepted import-cycle fix (15 October 2026):** `src/plugins/hostRuntime.ts` owns the shared runtime singleton. Plugin registries, dynamic indicator registrations and scanners integrate through the lightweight host. The accepted P3 evidence records renderer typecheck PASS, six focused Vitest suites **22/22 PASS**, and renderer Vite build PASS; see `docs/changes/2026-10-15_1740_IST_P3_PLUGIN_IMPORT_CYCLE_LEAN_FIX_R1.md`.
- **P4 boundary:** This section records implementation state and verified P3 evidence. It does **not** establish a full installed external-plugin lifecycle, production/manual activation, security review or portable Tauri build. Existing charts, CA functionality and database behavior remain protected. Corporate Actions write activation is not authorized here.
<!-- STANDALONE-PLUGIN-ARCHITECTURE-P1-P3-2026-10-16:END -->


<!-- TECH-AUDIT-PHASES-1-TO-5C-2026-10-14:BEGIN -->
## Completed — Technical Audit & Internal Hardening Phases 1A-5C (2026-10-14 19:10 IST)

- **Classification:** `INTERNAL_PERFORMANCE_STORAGE_IPC_AND_SECURITY_HARDENING__ALL_VALIDATION_GATES_PASSED`
- **Report:** `docs/changes/2026-10-14_1910_IST_TECHNICAL_AUDIT_PHASES_1_TO_5C_COMPLETE.md`

### Key Deliverables:
1. **Multi-Layer Canvas & Memory Lifecycle (Phases 1A & 1B):**
   - Reused `cachedRenderState` in `ChartEngine.getPointerState()` and isolated crosshair/synced-crosshair/drawing-preview repaints strictly to `overlayCanvas` (`src/engine/ChartEngine.ts`, `src/components/ChartCanvas.tsx`, `src/engine/__tests__/ChartLayerPartition.test.ts`).
   - Added `blur`, `pointercancel`, and window close/minimize/maximize drag-listener teardown in `src/components/FloatingWindow.tsx` and `src/components/common/useDraggableFloatingWindow.ts`; zeroed detached `<canvas>` buffers on `unmount()`.
2. **Windows Storage Lock Resilience & Single-Handle Reuse (Phase 1C):**
   - Eliminated duplicate `OpenOptions::open` calls in `src-tauri-shell/src/database/binary_eod.rs` (`upsert_single_record_by_date` & `rewrite_from_first_incoming_record`) and added bounded retry backoff for transient Windows `ERROR_SHARING_VIOLATION` (`os error 32`) and `os error 5` in `binary_eod.rs` and `src-tauri-shell/src/bhavcopy_recovery.rs`.
3. **Full-Series FNV-1a Indicator Cache & Scanner Throughput (Phases 2A & 2B):**
   - Replaced 2-endpoint bar checks in `src/indicators/registry.ts` with an O(N) FNV-1a checksum (`getBarsMutationSignature`) and recursive upstream cache keys (`getChainedIndicatorCacheKey`).
   - Bounded historical pattern evaluation sliding window to 260 bars in `src/plugins/scanner/chartPatternEvaluation.ts`, yielded to the event loop every 8 symbols in `src/plugins/scanner/scannerRunner.ts`, and hoisted `get_price_storage_mode` out of the per-symbol loop in `src-tauri-shell/src/database/daily_market_snapshot.rs`.
4. **Packed 64-Byte Binary Bar IPC, 48-Symbol LRU Cache & Security Hardening (Phases 2C, 3A, 4, 5B & 5C):**
   - Added `get_eod_data_binary` in `src-tauri-shell/src/database/eod_data.rs` and `decodeBinaryEodBars` in `src/platform/binaryEodDecoder.ts` (`src/platform/__tests__/binaryEodDecoder.test.ts`), paired with a 48-entry LRU cache and mutation invalidation in `src/platform/tauriDesktop.ts`.
   - Enabled `is_html_response()` across all exchanges and capped ZIP extraction at 128 MB in `src-tauri-shell/src/bhavcopy.rs`; guarded `open_external` and `fetch_official_watchlist_source` in `src-tauri-shell/src/main.rs`; enabled a production CSP in `src-tauri-shell/tauri.conf.json`; resolved all 7 Rust compiler warnings.
<!-- TECH-AUDIT-PHASES-1-TO-5C-2026-10-14:END -->

<!-- GANN-PLUGIN-IMPLEMENTATION:BEGIN -->
## Gann Price-Time Analysis Plugin — 2026-09-14 01:12 IST

| Area | Feature | Status | Evidence | Boundary |
|---|---|---|---|---|
| Analysis plugins | `gann-price-time` engine (ATR · pivots · Square of Nine · angle rays · time cycles) | **IMPLEMENTED / VALIDATED** | 28/28 Vitest PASS; TSC 0 errors | Pure memory; 360-bar minimum guard; `computeGannSetup` returns `null` for short series |
| Analysis plugins | `gann-price-time` canvas overlay (rays · levels · cycle verticals · breakout boxes) | **IMPLEMENTED / VALIDATED** | `npm run build:renderer` PASS; guarded chunks unchanged | `ctx.save()`/`ctx.restore()` isolated; fired inside `leftAxisWidth` translate at end of `renderOverlay()` |
| Analysis plugins | `gann-price-time` platform registration | **IMPLEMENTED** | `BUILT_IN_PLUGINS` entry; `ChartCanvas.tsx` `useEffect([bars])` wiring | `defaultEnabled: true`; no in-app toggle UI yet |
| Chart engine | `ChartEngine.setGannOverlayCallback()` overlay extension seam | **IMPLEMENTED** | TSC 0 errors; `cargo check` exit 0 | Single-occupancy — one plugin at a time; multi-callback registry deferred |
| Unit tests | `gannEngine.test.ts` — 28 deterministic tests | **28/28 PASS** | `npx vitest run gannEngine.test.ts` | `vitest.config.ts` exclude fixed (`**/EOD Charting Platform Source Audit/**`) |
| Renderer build | Guarded chunk budget post-plugin | **NO REGRESSION** | `feature-chart-canvas` 332 kB · `feature-chart-core` 299 kB · `feature-chart-analysis` 164 kB | All under 500 kB cap |
| Rust backend | `cargo check` post-plugin | **PASS / EXIT 0** | 2 pre-existing warnings, 0 new | No Rust source changes introduced by this plugin |
| Toggle UI | In-app enable/disable for `gann-price-time` | **NOT STARTED** | — | Deferred; plugin always active when ≥360 bars available |
| Options UI | User-configurable `GannPluginOptions` (pivot radius, colors, fixedScale) | **NOT STARTED** | — | `DEFAULT_GANN_OPTIONS` hardcoded for now |
| Visual smoke test | Runtime confirmation overlay renders on a live symbol | **NOT RUN** | — | Recommended next step |

Full report: `docs/changes/2026-09-14_0112_IST_GANN_PRICE_TIME_PLUGIN_IMPLEMENTATION.md`
No real Git staging performed.
<!-- GANN-PLUGIN-IMPLEMENTATION:END -->

<!-- R1A-R3-CONTINUITY-UPDATE:BEGIN -->
## V1.14AD status override — 2026-08-31 02:02:16 IST

| Area | Status | Current evidence / boundary |
|---|---|---|
| CA alternate-index scope | **VALIDATED / CLOSED** | Exact 35 paths; raw blobs; 24+1 whole-file/hygiene contract; 10 special hashes; strict whitespace GREEN |
| Live-source preservation | **PASS** | 508 files / 12,758,223 bytes / `9832CB8F...` after preflight and after report write |
| Real Git index | **UNCHANGED / CLEAN** | SHA before=after `3B1C9A68...`; cached path count 0 |
| HEAD | **UNCHANGED** | `f4278bc62649552f119fa6438b688a10dccef25e` before/after |
| Real Git staging | **NOT AUTHORIZED** | `readyForRealStaging = false` |
| Next phase | **PARENT BASELINE REVIEW REQUIRED** | Resolve parent/commit ordering before any real `git add` |
<!-- R1A-R3-CONTINUITY-UPDATE:END -->
## August 31 V1.14AD current-status override

<!-- ACTIVE-V1.14AD-STATUS:BEGIN -->

| Area | Feature / phase | Status | Evidence | Current boundary |
|---|---|---|---|---|
| Corporate Actions | V1.14AD latest-source cumulative integration | **FUNCTIONALLY VALIDATED** | R1A: renderer typecheck/build PASS; focused V1.14AD 4/0; full Rust 375/0/1 ignored; Cargo check PASS | No old assembly overlay required; latest source is authority. |
| Official Watchlists | W1.3 split + deterministic-generation reliability | **CLOSED / GREEN** | R1B-R1: focused 3/3; full Vitest 632/632; build/typecheck PASS; largest required chunk 376,088 bytes | Preserve current split; do not restore old ~630 KB feature chunk. |
| Corporate Actions | Controlled CA-only alternate-index staging | **IN PROGRESS / BLOCKED ON PREFLIGHT VERIFIER** | R1A-R2 reached strict staged-whitespace GREEN; helper then failed at final `emit(out, result)` because `out` is undefined | Fix only output binding; no real staging yet. |
| Git attribution | Parent-baseline / commit ordering | **REVIEW REQUIRED** | Staging design intentionally returns `PARENT_BASELINE_REVIEW_REQUIRED` | Resolve before authorizing real index staging. |
| Packaging | Fresh portable from accepted staged/commit state | **NOT STARTED** | Prior V1.14AD portable evidence exists, but not from eventual accepted staging/commit state | Package only after staging/commit authority is resolved. |

Current source authority: `E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-31_000303_IST`
Build-relevant identity: `9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D`

See `docs\CURRENT_WORK_STATUS.md` for the exact current blocker, next action, and remaining task sequence.

<!-- ACTIVE-V1.14AD-STATUS:END -->

## August 24 Corporate Action final status override

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

| Area | Feature | Status | Evidence | Current boundary |
|---|---|---|---|---|
| Corporate Actions | V1.14M exact three-row production-candidate repair | **CLOSED / FULL_SUCCESS** | V1.14L; V1.14K.1; V1.14M; V1.14M.1.1; independent V1.14M.2 | Exact three-row repair independently verified and closed. The repaired imports remain `PENDING_ISIN_MISMATCH` / unapproved; this row does not mark the entire Corporate Action program complete. |

## Current governed priorities

- **Immediate gate:** apply the August 22 canonical documentation reconciliation, then create the final portable build and record its executable SHA-256.
- **Next genuine trading day:** capture the full Bhavcopy log to validate V1.7D two-worker binary import responsiveness/performance; do not force a workload through Quote Editor.
- **Binary-state operations:** identify the exact one physical `.eod` key missing from the Generation-6 sidecar and choose a read-only/incremental reconciliation path. Do not rebuild or patch it during unrelated work.
- **Quote Editor:** embedded `FloatingWindow` architecture is accepted; native child-window work is closed/rejected.
- **Corporate Actions / Gann / Git maintenance:** retain their existing governed boundaries; do not mix them into this storage/documentation closeout.

<!-- V1.13-FINAL-CLOSEOUT:BEGIN -->
## Corporate Actions Phase 1 — V1.13 six-row identity repair closeout (2026-08-19)

| Corporate Actions item | State | Evidence / boundary |
|---|---|---|
| V1.13B-1 six-row historical ISIN repair | **CLOSED — FULL_SUCCESS** | 6 exact `instrument_isin_history` inserts; C-1.2.1 independent post-audit passed |
| V1.13B-1 Corporate Action status changes | **NONE** | 0 promotions, 0 Quick Resolves, 0 approvals |
| V1.13B-1 protected imports | **OPEN / PROTECTED** | 8 unchanged/unresolved/unapproved |
| V1.13C post-audit compatibility | **CLOSED** | checkpointed main-only post-state supported; Preflight main+WAL exact; SHM transient/non-authoritative |
| Next identity phase | **NOT STARTED** | classify protected eight; separate stale association, successor/restructure, and missing-symbol-evidence cases |
<!-- V1.13-FINAL-CLOSEOUT:END -->

<!-- V1.14E-SOURCE-IMPLEMENTATION:BEGIN -->
## Corporate Action V1.14E Historical Event Identity Resolution

| Capability | Status | Boundary |
|---|---|---|
| Exact 184-event / 44-chain authority | Implemented in source | SHA/fingerprint bound; no auto-discovery |
| Dedicated event-identity projection | Implemented in source | Raw import identity preserved |
| Historical event symbol UI | Implemented in source | Raw/API symbol remains visible |
| Split/Bonus event-symbol scan lookup | Implemented in source | Factor/price policy unchanged |
| Controlled V1.14E Preflight/Apply | Implemented in source package | Live Apply requires later explicit approval |
| Automatic startup table migration | Forbidden | Table absent is valid pre-Apply state |
| Event-time ISIN inference | Not implemented | Must not be fabricated from a symbol transition |
| Quick Resolve / CA approval side effect | Forbidden | Separate existing workflow remains authoritative |
| Live 184-row resolution tranche | NOT APPLIED | Pending read-only Preflight + approval + post-audit |
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
- `docs/architecture/decisions/ADR-001-security-listing-price-stream-identity.md` through `docs/architecture/decisions/ADR-006-corporate-action-security-boundary.md`

Evidence binding: 2026-09-06 source snapshot SHA-256 `1E45A2F8CF8D0C69ABA1E4813B46018EA57ED72A8D9F0191DAA1F0F2056539A0`; R2 evidence ZIP SHA-256 `0992F1DDBA3CA33181FB916020D1738761AB5000D127DD037A8A3AF96E557DF5`; R3 evidence ZIP SHA-256 `403E75701DA18EBB662E8D600192F83EF7019E12BE1F59F512E8ADFC176548E4`.
<!-- V2-P0-SECURITY-LISTING-PRICE-STREAM:END -->

<!-- CA-R1A-2026-09-24:BEGIN -->
## Corporate Action Reconciliation R1-A

| Capability | Status | Boundary |
|---|---|---|
| Backend reconciliation preflight | **CLOSED / CURRENT** | Read-only diagnostic/preflight owner |
| Reconciliation panel | **CLOSED / CURRENT** | Diagnostic selection independent of approval checkboxes |
| CSV export | **CLOSED / CURRENT** | Reconciliation-table export only |
| Tab-separated TXT export | **CLOSED / CURRENT** | Reconciliation-table export only |
| 112-row accounting | **112/112 PASS** | 10 repair candidates / 43 classification review / 59 evidence blocked |
| R1-A repair execution | **0 / NOT AUTHORIZED** | Proposal only |
| R1-A CA approval writes | **0 / NOT AUTHORIZED** | Existing approval authority preserved |
| Database completeness | **false** | Historical coverage NOT_ASSESSED |
| R1-B deterministic repair/TDD | **NOT STARTED** | First class: date-valid historical-symbol reconciliation |
| R1-C controlled TEST-DB apply | **NOT STARTED** | Separately gated after R1-B |

Authority: `docs/superpowers/specs/2026-09-24-corporate-action-reconciliation-r1a-current-authority.md`.
<!-- CA-R1A-2026-09-24:END -->
