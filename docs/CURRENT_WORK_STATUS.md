# Current Work Status

## Identity maintenance checkpoint — 30 October 2026

BSE company-name history now has official refresh, reviewed preview, confirmed
Apply and saved receipts. The user's native Apply saved 1,531 names at 11:15:56
IST; the read-only audit found zero mismatches. Native confirmation, completed
100% status, Recent Applied and expanded source/plan evidence are confirmed.
Security ID history remains held for separately verified dated evidence.

The latest report polish is implemented: saved wording, friendly/copyable source
evidence, counted historical outcome filters with display preferences, and a
clearer Corporate Actions readiness notice. PASS: 41 focused tests, renderer
typecheck, CSS/docs/whitespace checks and isolated UI/reload checks. Native polish,
clipboard and restart persistence are **deferred: the user will test later**.
No new Apply is required. This documentation closeout runs no application tests
or live mutations. See [current handoff](../HANDOFF.md) and the
[deferred test checklist](changes/2026-10-30-identity-report-polish/REPORT.md).

## Chart UI native closeout - 29 October 2026

The user rebuilt/restarted and provided native screenshots confirming the reported
date-axis density/collision corrections, removal of persistent tool instructions,
and successful Adj OFF/ON reload notifications without the previous false failure.
The startup `Loading DB...` status clears after a few seconds; the settled screenshot
shows green `EOD DATABASE` and range `1991-01-02` to `2026-10-26`.

The reported UI issues are closed. Deliberate rapid-toggle/database-switch races
and comparison fault injection remain automated-only; these screenshots do not
prove complete historical data. No new task or CA resumption is authorized by this
documentation update. See [native closeout and evidence](changes/2026-10-29_CHART_NATIVE_ACCEPTANCE_CLOSEOUT.md).

<!-- DOC01-STORAGE-MAINTENANCE-2026-10-28 -->
## Storage / temporary artifacts checkpoint — 28 October 2026 IST

DC-01 and DC-02 exact-path Cargo-cache cleanup completed with hash-verified preservation; the two operations recorded a summed 18.841 GiB free-space increase across their measurement intervals. BUILD-01 established an opt-in shared Cargo wrapper and verified repeated `cargo check` cache reuse. TMP-01 R2 fixed the initial timestamp-parser failure and passed marker-only scratch Create / Preview / Cleanup acceptance. Existing unmarked `tmp` folders, databases, production application code and portable executables were preserved.

For **current storage operating instructions, limits, rollback and evidence hashes**, read [EOD storage maintenance](operations/EOD_STORAGE_MAINTENANCE_2026-10-28.md). This storage-only checkpoint does not change the Corporate Actions/database priority or supersede other domain handoffs.
<!-- END-DOC01-STORAGE-MAINTENANCE-2026-10-28 -->


## Database priority; CA paused — 26 October 2026

This historical checkpoint prioritized the user-reported database issue over CA.
The chart UI closeout above records the subsequently resolved scoped issues;
the next task is for the user to select. CA latest run has 4,288 persisted approvals
including 3 BSE Split/Bonus actions. Do not replay any completed approvals.
Outstanding: live approval progress, combined totals, unrelated Checking-state
investigation, completed timer labelling, Approved-history paging/counts, and
unchanged native warm-validation measurement. No such UI fix is implemented yet.

This checkpoint supersedes older current-status claims below.
See [CA resume checkpoint](changes/2026-10-26_CA_PAUSE_DATABASE_PRIORITY_HANDOFF.md).

## Latest Corporate Actions status — 25 October 2026 IST

The 17 October and lower sections are historical checkpoints for this workstream.
Selected native Dividend approvals now have user screenshot evidence: HEGAM saved
history/chart marker and ICICIGI/HDBFS targeted queue refresh in 4/2 seconds. Full
queue and unrelated readiness remain available; no automatic full scan after each
approval. Refresh implementation: 88 focused tests, renderer/whitespace PASS.

Quick search implementation: 34 focused tests, renderer/whitespace PASS. Native
screenshots now confirm mixed-case symbol matching, exact-symbol priority, full
ISIN matching through Details and explicit empty results with the loaded count
unchanged at 33,971. User confirms Esc/× clear. Whitespace padding, exact BSE-code
lookup and measured typing speed remain unverified natively. Preserve Details and
its source/ISIN/blocker explanations. Remaining chart-price, Split/bulk
and BSE transport limits are recorded in [HANDOFF](../HANDOFF.md). Continue from
that latest handoff; do not resume the obsolete stopped-Sandbox workflow below.
Details: [refresh](changes/2026-10-25_CA_POST_APPROVAL_QUEUE_REFRESH.md),
[quick search](changes/2026-10-25_CA_QUICK_SEARCH.md).

<!-- EOD-CANONICAL-STATUS-2026-10-17-R1 -->
## Current verified platform and Corporate Actions status — 17 October 2026 IST

**Active project/workstream:** `E:\TA Projects\EOD Charting Platform`.

**Newest accepted work:** P5-FINAL fail-closed closeout → P1/P2 source-identity reconciliation → integrated Corporate Actions R1 native gates → desktop attempts stopped for runtime dependencies.

**Integrated Corporate Actions R1:** approved normal workflow `Fetch from Officials → Load & Validate → Approve Ready`, implemented in the existing CA window without replacing advanced maintenance. Load does not automatically approve Split/Bonus. Future ex-dates remain scheduled and local EOD readiness must be satisfied before explicit operator approval; the backend rechecks readiness at approval. Existing adjustment ledger/transactions and chart-refresh hooks are preserved, but production write/refresh behavior has **not** been manually accepted.

**Current acceptance boundary (17 October 2026 IST):** source-integrated and native-validation **PASS** (62/62 focused Vitest, 2/2 focused Rust tests, renderer typecheck, frontend Vite build, offline Cargo check). Two isolated Windows release builds also **PASS**; the static-CRT EXE has no direct/delay VC runtime imports. **Desktop CA UI and chart-refresh acceptance remain NOT VERIFIED:** the first disposable Sandbox run lacked Visual C++ CRT DLLs, the static-CRT attempt then lacked WebView2 Runtime. Operator stopped; no manual CA pass, no real NSE/BSE network-fetch pass, no production CA write acceptance, and no portable installation acceptance.

**Plugin P5-FINAL:** metadata-only import/discovery/reload architecture is closed with third-party external JavaScript evaluation and activation still **DISABLED**. C2 did not prove production guest process/IPC isolation; no plugin activation is permitted by the CA documents. The three previously unattributed P1/P2 files were accepted by exact isolated reconstruction on 17 October.

**Do not resume obsolete historical CA phases from lower sections as the current task.** They remain historical records. Present bounded task is canonical documentation reconciliation only.

**Still open:** actual normal desktop workflow observation; official-feed integration under separately authorized network conditions; non-destructive/controlled approval and chart/cache refresh manual verification; optional portable Windows packaging. No further test environment redesign or production database modification is implied by this documentation update.

**Evidence:** P1/P2 three-file authority 4B97997A5B55DE56…; native CA 762203D79459BC29…; first stopped desktop 8A41ADAF68C9BF4A…; static CRT stopped desktop 46D6BEA22CB1083A…. Full SHA256 identities and limitations are in the new docs reconciliation record.
<!-- END-EOD-CANONICAL-STATUS-2026-10-17-R1 -->

<!-- STANDALONE-PLUGIN-ARCHITECTURE-P1-P3-2026-10-16:BEGIN -->
## Standalone External Plugin Architecture and SDK — P1–P3 status

- **Design boundary:** The EOD Charting Platform remains the protected core. Plugin Manager owns generic lifecycle controls; each plugin owns its own menu-opened interface and settings. External developers should integrate through the SDK and host interfaces rather than editing platform core code.
- **P1/P2 implemented components (reported, not independently reaccepted here):** `src/plugins/pluginHost.ts`, `src/plugins/types.ts`, `src/plugins/pluginLoader.ts`, `src/engine/ChartEngine.ts`, `src/components/SettingsDialog.tsx`, and `src-tauri-shell/src/plugin_data.rs` provide extension registrations, loading and user-facing controls. The SDK is in `packages/eod-plugin-sdk/` with a development sample plugin.
- **P3 accepted import-cycle fix (15 October 2026):** `src/plugins/hostRuntime.ts` owns the shared runtime singleton. Plugin registries, dynamic indicator registrations and scanners integrate through the lightweight host. The accepted P3 evidence records renderer typecheck PASS, six focused Vitest suites **22/22 PASS**, and renderer Vite build PASS; see `docs/changes/2026-10-15_1740_IST_P3_PLUGIN_IMPORT_CYCLE_LEAN_FIX_R1.md`.
- **P4 boundary:** This section records implementation state and verified P3 evidence. It does **not** establish a full installed external-plugin lifecycle, production/manual activation, security review or portable Tauri build. Existing charts, CA functionality and database behavior remain protected. Corporate Actions write activation is not authorized here.
<!-- STANDALONE-PLUGIN-ARCHITECTURE-P1-P3-2026-10-16:END -->


<!-- BHAVCOPY-MODULAR-REFACTOR-PHASES-1-TO-9-2026-10-15:BEGIN -->
## Completed — Bhavcopy Modular Architectural Refactor Phases 1–9 (2026-10-15 00:50 IST)

- **Classification:** `MODULAR_CODE_HYGIENE_AND_ARCHITECTURE_REFACTOR__ALL_VALIDATION_GATES_PASSED`
- **Plan Artifact:** `BHAVCOPY_MODULAR_REFACTOR_PLAN.md`
- **Core Outcome:** Decomposed the ~7,980-line monolithic `src-tauri-shell/src/bhavcopy.rs` into a structured, highly maintainable subpackage (`src-tauri-shell/src/bhavcopy/`) with zero regressions and 100% backward compatibility for all 8 public Tauri IPC commands.

### Module Topology:
1. **`src-tauri-shell/src/bhavcopy/mod.rs` (1,118 lines):**
   - Public facade: `download_bhavcopy` (single) and `download_bhavcopy_batch` (batch).
   - Task worker pools, channel coordination, and batch planning execution.
2. **`src-tauri-shell/src/bhavcopy/types.rs` (246 lines):**
   - Core domain types: `BhavcopySettings`, `BatchDownloadConfig`, `DownloadResult`, `DownloadTask`, `StagedDownload`, `AppResult<T>`.
3. **`src-tauri-shell/src/bhavcopy/settings.rs` (194 lines):**
   - Persistent settings commands: `get_bhavcopy_default_templates`, `get_bhavcopy_settings`, `save_bhavcopy_settings`.
   - Settings validation, default configurations, and series exclusion normalizers.
4. **`src-tauri-shell/src/bhavcopy/transport.rs` (193 lines):**
   - HTTP/1.1 client configuration, connection pooling (10s idle, max 4 per host), session warming, candidate streaming, and causal error chain diagnostics.
5. **`src-tauri-shell/src/bhavcopy/calendar.rs` (455 lines):**
   - Market holiday commands: `list_market_holidays`, `add_market_holiday`, `delete_market_holiday`.
   - Special trading session overrides (Muhurat, disaster-recovery sessions), date math, 18:00 IST evening probe cutoff.
6. **`src-tauri-shell/src/bhavcopy/sources/` (308 lines):**
   - `sources/mod.rs`: `Candidate`, `CandidateKind`, `apply_template`.
   - `sources/nse.rs`: NSE Equity & Index candidate generators and referer headers.
   - `sources/bse.rs`: BSE Equity (UDiFF & legacy ZIP) & BSE Index candidate generators and referer headers.
7. **`src-tauri-shell/src/bhavcopy/parsers/` (722 lines):**
   - `parsers/zip.rs`: Bounded ZIP archive extractor with 128 MB security guard.
   - `parsers/json.rs`: BSE Index Arch JSON & NSE historical API row normalizers.
   - `parsers/csv.rs`: NSE/BSE UDiFF CSV parser, legacy EQ parser, IndexSummary parser.
   - `parsers/mod.rs`: `ParsedBhavcopyRow`, `ParsedBhavcopyFile`, duplicate symbol-date row detection.
8. **`src-tauri-shell/src/bhavcopy/ingestion.rs` (3,409 lines):**
   - SQLite download log tracking, transactions, and storage mode pre-filter queries.
   - Durability-governed binary writer pool (`write_bhavcopy_binary_records_parallel` preserving 2-worker default and 4-worker maximum cap).
   - Recovery journal session lifecycle: `prepare_bhavcopy_recovery_session`, `capture_recovery_binary_baselines`, `recover_pending_bhavcopy_sessions`, background checkpoint worker.
   - Fast-path baseline classification & shadow inspection engine.
9. **`src-tauri-shell/src/bhavcopy/tests.rs` (1,478 lines):**
   - Isolated unit tests covering parser parity, shadow classification, durability baselines, date window boundaries, and candidate URL templates.

### Validation Passed:
- `cargo test --bin eod-charting-platform-shell -- bhavcopy::tests::`: **50/50 PASS** (0.77s, 0 compiler warnings).
- `npm run typecheck:renderer`: **PASS** (0 errors).
<!-- BHAVCOPY-MODULAR-REFACTOR-PHASES-1-TO-9-2026-10-15:END -->

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

IST: 2026-09-20 00:37:39 +05:30

Official Imports Pending Review now uses compact Actions / Filters / Status presentation while preserving FIX2 approval, exact-ID, reconciliation, filters, cancellation and exception behavior. Protected source: 553 files. Automated frontend validation passed; WebView2 geometry/keyboard/theme acceptance is still pending.

Change record: docs/changes/2026-09-20_0035_IST_PENDING_ACTIONS_COMPACT_LAYOUT_R1.md
Evidence: E:\TA Projects\EOD Charting Platform\tmp\CA_PENDING_COMPACT_LAYOUT_R1_RESUME2_2026-09-20_003515_IST_cf05fda0_evidence.zip

Deferred: list rendering/performance remediation, app-wide CPU/GPU/memory profiling, Rust warning cleanup and final source snapshot. No final Official Imports closure is implied.

---

# Official Imports FIX2 — installed / automated gates passed / manual recheck pending

IST: 2026-09-19 04:52:45 +05:30

Read-only exact-ID lookup, counted preparation, explicit non-ready reasons, Other category completeness, and accurate Apply/refresh phases installed. Protected source: 552 files; existing approval rules/schema/raw EOD behaviour unchanged.

Change record: docs/changes/2026-09-19_0420_IST_CA_OFFICIAL_IMPORTS_FIX2_EXACT_ID_PROGRESS.md
Evidence: E:\TA Projects\EOD Charting Platform\tmp\CA_OFFICIAL_IMPORTS_FIX2_RESUME1_2026-09-19_042022_IST_09f877f3_evidence.zip

No final acceptance or snapshot. BSE referer and Gann deferrals unchanged. TEST-only manual acceptance remains required.

---

# CURRENT TASK â€” OFFICIAL IMPORTS USER-FRIENDLY APPROVAL

**Automated implementation installed:** `2026-09-19 01:25:26 +05:30`
**Status:** `AUTOMATED GREEN AFTER FIX1 / MANUAL PORTABLE CHECKPOINT PENDING`
**Bounded workstream:** `Official Imports frontend simplification only`

Current implementation:

- existing `CorporateActionDialog` remains active; no reconstruction workspace was activated;
- normal Review is now `Load & Prepare` â†’ pending symbol/action review â†’ `Apply Selected` / `Apply All Ready`;
- all outstanding pending imports, including older unapproved records, are enumerated before routine Apply can enable;
- strict matching and Split/Bonus validation are application-managed preparation steps;
- ambiguous identity, ISIN exception and price exception decisions remain explicit operator review;
- ordinary Apply is preceded by an inline confirmation and a stale/material-evidence recheck;
- backend/schema/IPC and Identity Import behavior remain unchanged;
- automated validation passed; manual WebView2 acceptance on the TEST database is still required.

Change record: `docs\changes\2026-09-19_0125_IST_CA_OFFICIAL_IMPORTS_USER_FRIENDLY_APPROVAL_FIX1_TYPE_CONTRACT.md`
Automated evidence: `E:\TA Projects\EOD Charting Platform\tmp\CA_OFFICIAL_IMPORTS_UX_FIX1_RESUME1_2026-09-19_012526_IST_evidence.zip`

---

# Current authorized Official Imports task â€” 2026-09-18 IST

<!-- CA-OFFICIAL-IMPORTS-UX-R1:BEGIN -->
## Approved direction â€” documentation first; implementation not started

Workstream: `E:\TA Projects\EOD Charting Platform`.
Source: `Eod Charting Platform Source Code 2026-09-18_140123_IST.zip`; SHA256 `0EF8966CD8F4C29DAE0F032372322B88827FF44985968688AE1C4BFA6897666F`; 548 protected source files.

The user approved a **bounded frontend improvement of Official Imports in the existing CorporateActionDialog**, with all outstanding pending imports (including older unapproved records), Load & Prepare, expandable symbol/action review, Apply All Ready and Apply Selected. Implementation follows successful docs installation/source preflight; approval and validation have not yet occurred in the application.

Read the approved contract: `docs/superpowers/specs/2026-09-18-official-imports-user-friendly-approval-approved-scope-r1.md`. Execute: `docs/superpowers/plans/2026-09-18-official-imports-user-friendly-approval-bounded-implementation-r1.md`.

Do not reactivate the superseded Normal/Maintenance reconstruction, economic-event grouping or replacement app. Preserve backend policy/commands, existing tabs, CSV/Force Re-fetch/backfill, and explicit exceptional decisions. Identity Import UX is a separate later task.

This scoped block supersedes older CA next-task/staging/reconstruction statements below; it authorizes no Git activity. For Gann, use `docs/superpowers/specs/2026-09-18-gann-price-time-analysis-deferred-manual-disposition.md` (deferred/default OFF; manual geometry not accepted), not the older completed-plugin snippet below. ER4 remains governed by `docs/superpowers/specs/2026-09-17-identity-er4-final-closure-current-authority.md`; ER5 stays deferred.

Documentation installer: no source, DB, network, build, test or snapshot. Ordinary preparation may later persist staged resolution/scan evidence through existing APIs, but never final/exceptional approval without user authorization.
<!-- CA-OFFICIAL-IMPORTS-UX-R1:END -->

---
## Preserved previous status document â€” historical content below

# EOD Charting Platform â€” Current Work Status

<!-- GANN-PLUGIN-CHECKPOINT:BEGIN -->
## Completed â€” Gann Price-Time Analysis Plugin (2026-09-14 01:12 IST)

Classification: `GANN_PRICE_TIME_PLUGIN_IMPLEMENTED__ALL_VALIDATION_GATES_PASSED`

The `gann-price-time` indicator plugin is fully implemented, registered, and validated.

**5 new files** in `src/plugins/analysis/gannPriceTime/`:
- `types.ts` â€” pure TypeScript contracts
- `engine.ts` â€” pure computational engine (ATR, pivots, Square of Nine, angle rays, time cycles)
- `canvasOverlay.ts` â€” Canvas 2D renderer
- `gannPlugin.ts` â€” `RegisteredPlugin` manifest (`defaultEnabled: true`)
- `__tests__/gannEngine.test.ts` â€” 28/28 unit tests PASS

**4 surgical platform edits:**
- `src/engine/ChartEngine.ts` â€” `setGannOverlayCallback()` overlay extension seam
- `src/plugins/registry.ts` â€” registration
- `src/components/ChartCanvas.tsx` â€” `useEffect([bars])` wiring
- `vitest.config.ts` â€” fixed overly-broad `**/analysis/**` exclude â†’ `**/EOD Charting Platform Source Audit/**`

**Validation gates:** Vitest 28/28 PASS Â· TSC 0 errors Â· Build chunks under 500 kB Â· `cargo check` exit 0

Full details: `docs/changes/2026-09-14_0112_IST_GANN_PRICE_TIME_PLUGIN_IMPLEMENTATION.md`

No real Git staging was performed.
<!-- GANN-PLUGIN-CHECKPOINT:END -->

<!-- R1A-R3-CONTINUITY-UPDATE:BEGIN -->
## Current override â€” R1A-R4-R2 alternate-index preflight closed (2026-08-31 02:02:16 IST)

This block supersedes older current-blocker / next-action statements lower in this document.

### Current classification

`V114AD_CA_ALT_INDEX_STAGING_SCOPE_VALIDATED__REAL_INDEX_UNCHANGED__PARENT_BASELINE_REVIEW_REQUIRED`

### R1A-R4-R2 closeout â€” independently verified

R1A-R4-R2 formally closes the alternate-index CA staging-scope and preservation preflight.

Independent audit of the uploaded R1A-R4-R2 reports ZIP confirms:

- reports ZIP SHA-256: `8312FFFE190A4F036721B0B675638165BCD96241F7959F44B57BF38B9BE51031`;
- R1A-R4-R2 summary SHA-256: `1AA3CA228AB43BE428F29EC662BA923D81E32C824DA8801B2B0F7891294B14BD`;
- R1A-R4-R2 change report SHA-256: `4E887255349CC557E08C36B485E613C91BF1B9A46C244578F6DE9DED575D5F6C`;
- child stage-verification SHA-256: `FC781E100B227EC52C896677A91FF850619985C4E262E52C98B4B714CF1EE5DA`;
- exact child R1A-R3 operator SHA-256: `9886E9ABABFC071A6C5F19D36577FA25F276947AD000D15F32D6D09D84329676`;
- exact staged path count: **35**;
- raw alternate-index blob verification: **true**;
- checkout-materialized bytes used as authority: **false**;
- exact fresh-snapshot whole-file count: **24**;
- exact one-byte staged-only hygiene POST: `E482352BBA472B8705C978FC0530DE8B65412BA7B01CBC16B9004F9271D3524F`;
- all 10 special/shared locked hashes passed;
- exact latest-source remainder count: **10**;
- preservation sentinels remained unstaged;
- strict staged whitespace check: **GREEN**.

### Final preservation postflight

R1A-R4-R2 completed the missing postflight under a sanitized Git environment:

- live source/config after preflight: **508 files / 12,758,223 bytes / `9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D`**;
- post-report live-source postflight repeated the same exact identity;
- real Git index SHA-256 before: `3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A`;
- real Git index SHA-256 after: `3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A`;
- real Git index unchanged: **true**;
- real Git index clean: **true**;
- cached staged path count: **0**;
- HEAD before/after: `f4278bc62649552f119fa6438b688a10dccef25e`;
- real staging performed: **false**;
- commit performed: **false**;
- database opened: **false**;
- packaging performed: **false**.

### Current authorization boundary

The alternate-index preflight is **closed**, but real staging remains **not authorized**:

`readyForRealStaging = false`

The mandatory next phase is:

`PARENT_BASELINE_REVIEW_REQUIRED`

### Exact next action â€” parent-baseline / commit-order review

The review must determine how the validated 35-path CA-only staged tree relates to the current Git HEAD and to unrelated newer live-source changes.

It must answer, without staging anything:

1. what exact tree a CA-only commit on current HEAD would produce;
2. which validated latest-source files/changes would remain outside that commit;
3. whether those omitted newer changes are prerequisites, independent work, or should precede/follow the CA commit;
4. whether the current HEAD is an acceptable parent for the CA commit;
5. the safe commit ordering needed to preserve the already-validated latest-source state;
6. whether any documentation-only current changes should be committed separately;
7. the exact authorization prerequisites before any real `git add`.

Do not run real `git add`, commit, packaging, or production-database work during this review.
<!-- R1A-R3-CONTINUITY-UPDATE:END -->
**Continuity checkpoint:** `V1.14AD-CONTINUITY-2026-08-31-R1`
**Last updated:** 2026-08-31 00:25:09 IST
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Read this first

This is the operational handoff authority for the current workstream. A new chat, coding agent, or reviewer should start here rather than relying on previous-chat memory.

Before changing code:

1. verify the current live project against the source authority below;
2. read the latest relevant `docs\changes` reports named here;
3. inspect the current staging-preflight operator before proposing a fix;
4. preserve unrelated working-tree changes;
5. do not perform real Git staging, commit, packaging, or production-database work unless explicitly authorized.

## Current classification

`V1_14AD_LATEST_SOURCE_VALIDATED__WATCHLIST_RELIABILITY_CLOSED__CA_CONTROLLED_STAGING_PREFLIGHT_BLOCKED_ON_VERIFIER_OUTPUT_VARIABLE`

The latest-source Corporate Action implementation is functionally validated. The Watchlist deterministic-test reliability correction is closed. The active task is **Controlled Corporate Action Staging Preflight**.

Real Git staging is **not authorized**.

## Current source and evidence authority

### Fresh snapshot â€” newest confirmed source

`E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-31_000303_IST`

Uploaded snapshot ZIP SHA-256:

`95F7C981628EBFB6D100CA4D187B987B0613AD622FD4E7B28D44BDD3DB296296`

Fresh snapshot full identity:

- files: **771**
- bytes: **17,638,159**
- deterministic tree SHA-256: `1A25D9FFDD10609817580A9A86428E2B1D03E2205F1EE3BE33CA7E1C99B660C0`

Build-relevant source/config identity:

- files: **508**
- bytes: **12,758,223**
- deterministic tree SHA-256: `9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D`

The 508-file build-relevant identity is unchanged from the accepted R1B-R1 latest-source authority. Therefore the failed staging-preflight and documentation-operator attempts did not alter build-relevant source/config before this snapshot was created.

### Key current hashes

- `package.json`: `62CA8FA100A46242C669877064C2332D93C842B16CC95B72045EC02A17F9F9EA`
- `package-lock.json`: `051C0060536DFE588CD67F0645888D719E7DF365E63E04F8F896429A88D002BC`
- `vite.config.mts`: `C98861D87BEA4A395799160C9735E38C73C58CD61EA32539C0B4BDC35C3C7748`
- `vitest.config.ts`: `5069F555008385720753A36FF2D985C42BCD0624E4F2F828CE3DA1C7A26B9466`
- `src-tauri-shell\Cargo.toml`: `D1199096F9EA2548FD011BC120ABD15407849A75D9AAA14240DF1D250A020D42`
- `src-tauri-shell\Cargo.lock`: `68A14D7A9C904F0C981BC6529E82C439B2352EABBF2AA8BE221F7F79FCA778C5`
- `src-tauri-shell\src\database\corporate_action_imports.rs`: `450507EA2E6E195FCA0B654BD359A1E956BC5DBC9F57C81FF08FC215FF5C749B`
- `src\features\watchlists\__tests__\officialWatchlistDataSplit.test.ts`: `5F2E5BA604E671A7748BD69C7020557CE3D9FB9748CB8ACD23CA00263EF1034A`
- `src\features\corporateActions\corporateActionCompoundValidation.ts`: `938A9F551C2F0DE53C4B2026D8613BC3DAD5D8C222D1AEDF4C5839D39F6B1551`

## Completed V1.14AD work

### 1. Cumulative Corporate Action implementation and dependency attribution

The cumulative Corporate Action implementation was reconstructed and audited against Git HEAD and current source. The accepted attribution model consists of:

- **25 whole-file-safe Corporate Action source/test paths**;
- reviewed contextual hunks in shared integration files;
- the CA-required `sha2` Cargo closure;
- compile-proven `database.rs`, `DatabaseToolsDialogs.tsx`, and frontend type-contract closures.

Older assembly-R3/R4 trees remain attribution and dependency evidence only. They are **not** the current source authority and must not be replayed wholesale onto latest source.

Relevant reports:

- `docs\changes\2026-08-29_1417_IST_V1_14AD_CUMULATIVE_BASELINE_ASSEMBLY_DEPENDENCY_PREFLIGHT_R3.md`
- `docs\changes\2026-08-30_0138_IST_V1_14AD_CUMULATIVE_BASELINE_DISPOSABLE_COMPILE_TEST_VALIDATION_R4.md`

### 2. Latest-source controlled regression â€” R1/R1A

The latest-source audit established:

`NO_SOURCE_OVERLAY_REQUIRED__LATEST_SNAPSHOT_ALREADY_CONTAINS_PROVEN_CA_CLOSURES`

R1A actual validation evidence:

- renderer typecheck: exit 0;
- renderer production build: exit 0;
- Official Watchlist split/chunk preservation: exit 0;
- `cargo fetch --locked`: exit 0;
- Cargo manifests unchanged after cache hydration;
- `cargo metadata --locked --offline`: exit 0;
- focused V1.14AD Rust: **4 passed / 0 failed**;
- bhavcopy holiday sentinel: passed;
- BSE UDiff sentinel: passed;
- bootstrap seed-default sentinels: passed;
- full Rust serial suite: **375 passed / 0 failed / 1 ignored**;
- `cargo check --locked --offline`: exit 0.

R1A's only remaining failure was the Watchlist deterministic-generation test exceeding Vitest's default 5-second timeout.

Relevant reports:

- `docs\changes\2026-08-30_1326_IST_V1_14AD_LATEST_SOURCE_CONTROLLED_INTEGRATION_FULL_REGRESSION_R1.md`
- `docs\changes\2026-08-30_1409_IST_V1_14AD_LATEST_SOURCE_CONTROLLED_INTEGRATION_FULL_REGRESSION_R1A.md`

### 3. Watchlist deterministic-test reliability â€” R1B-R1

Only:

`src\features\watchlists\__tests__\officialWatchlistDataSplit.test.ts`

changed. The deterministic-generation test received an explicit test-scoped `15_000` ms timeout. The test body, generator, generated data, Vite chunking, global Vitest configuration, Corporate Action source, and Rust source were preserved.

Actual R1B-R1 validation:

- focused Watchlist split test: **3/3 runs passed**;
- full Vitest: **110/110 files, 632/632 tests passed**;
- renderer typecheck: exit 0;
- renderer build: exit 0;
- transformed modules: 742;
- Official Watchlist feature chunk: 55,083 bytes;
- largest required Watchlist chunk: 376,088 bytes;
- no JS chunk above 500,000 bytes;
- candidate/live integrity gates: passed;
- fresh latest-source snapshot created and verified.

Final R1B-R1 classification:

`R1B_WATCHLIST_TIMEOUT_VALIDATED__FRESH_LATEST_SOURCE_AUTHORITY_CREATED__READY_FOR_CONTROLLED_CA_STAGING`

Relevant report:

- `docs\changes\2026-08-30_1902_IST_V1_14AD_R1B_R1_WATCHLIST_DETERMINISTIC_TEST_TIMEOUT_RELIABILITY.md`

## Current running task â€” Controlled Corporate Action Staging Preflight

### Objective

Construct and verify the exact CA-only staged tree in a **disposable alternate Git index and external Git object directory**, without modifying the real `.git\index`.

### Intended source/test/config staging scope

Exactly **35 paths**:

- 25 whole-file-safe CA paths;
- 10 special/shared Cargo and integration paths.

The 10 special/shared paths are:

1. `src-tauri-shell\Cargo.toml`
2. `src-tauri-shell\Cargo.lock`
3. `src-tauri-shell\src\database.rs`
4. `src-tauri-shell\src\database\eod_data.rs`
5. `src-tauri-shell\src\database\instrument_mutations.rs`
6. `src-tauri-shell\src\main.rs`
7. `src\components\DatabaseToolsDialogs.tsx`
8. `src\platform\tauriDesktop.ts`
9. `src\platform\types.ts`
10. `src\types\desktop.ts`

The exact 25-path whole-file allowlist remains encoded in the current staging-preflight operator and must be re-read before any real staging step.

### Deliberately excluded preservation sentinels

These must not enter the CA staged set:

- `package.json`
- `src\features\watchlists\__tests__\officialWatchlistDataSplit.test.ts`
- `src\components\CommandPalette.tsx`
- `src-tauri-shell\src\bhavcopy.rs`
- `src-tauri-shell\src\database\bootstrap.rs`

## Staging-preflight attempt history

### R1

- External alternate index initialized from exact Git HEAD.
- 25 whole-file CA paths staged.
- Shared CA contextual patch applied.
- Cargo/DB/UI/type closures applied.
- Strict `git diff --cached --check` stopped on the already-known redundant terminal LF in `corporateActionCompoundValidation.ts`.

No real staging was authorized.

### R1A

Design added the exact previously proven one-byte staged-only hygiene normalization:

- source PRE SHA-256: `938A9F551C2F0DE53C4B2026D8613BC3DAD5D8C222D1AEDF4C5839D39F6B1551`
- staged hygienic POST SHA-256: `E482352BBA472B8705C978FC0530DE8B65412BA7B01CBC16B9004F9271D3524F`
- bytes removed: exactly 1 terminal LF.

The first R1A operator stopped at a null-unsafe Git discovery expression before staging.

### R1A-R1

Git discovery/environment handling was corrected.

Actual run then proved:

- staging assembly reached the hygiene check;
- exact blank-at-EOF RED reproduced;
- one-byte normalization applied;
- strict `git diff --cached --check` became GREEN.

The verifier then falsely rejected `corporate_action_imports.rs` because it compared `checkout-index` materialized Windows bytes rather than raw alternate-index blobs.

### R1A-R2 â€” current attempt

Raw staged-blob verification replaced checkout-materialized byte verification.

Actual run confirmed:

- exact project Git root / HEAD / clean real index at preflight start;
- latest-source authority gate passed;
- alternate index initialized from HEAD;
- 25 whole-file paths staged;
- 8 shared contextual paths applied cleanly;
- Cargo patch applied cleanly;
- `database.rs` closure applied cleanly;
- `DatabaseToolsDialogs.tsx` closure applied cleanly;
- `src\types\desktop.ts` closure applied cleanly;
- exact blank-at-EOF RED reproduced;
- exact one-byte staged-only hygiene normalization applied;
- strict `git diff --cached --check` GREEN.

The Python `mode_stagecheck` then reached its final result-emission statement and failed with:

`NameError: name 'out' is not defined`

The function parameter is `out_s`, but the function never binds `out = pathlib.Path(out_s).resolve()` before calling `emit(out, result)`.

### Important interpretation of the current blocker

Inspection of the R1A-R2 helper shows all staged-path, raw-blob, whole-file hash, special-hash, latest-source remainder-set, and preservation-sentinel checks occur **before** the failing final `emit(out, result)` call.

The run did not report any earlier Python exception. This is evidence that those checks did not raise during that run.

However, the staging preflight is **not accepted or closed** because:

- the stagecheck result artifact was not emitted;
- the PowerShell operator treated the helper exit as failure;
- final live-source/real-index postflight was not reached;
- the reports ZIP has not been independently accepted.

## Current blocker

**File:** `V1.14AD-Controlled-CA-Staging-Preflight-R1A-R2.ps1`
**Operator SHA-256:** `F30C8E8755B4FCE31DDCF000B368EA8E14E938D601E2AF96FC046CF270703CAD`

Embedded helper defect:

```python
def mode_stagecheck(snapshot_s, repo_s, names_json_s, out_s):
    ...
    emit(out, result)
```

Missing binding:

```python
out = pathlib.Path(out_s).resolve()
```

This is currently classified as a **bounded verifier implementation defect**, not a staging-scope redesign.

## Exact next action

Before coding, inspect:

1. `docs\CURRENT_WORK_STATUS.md`;
2. `V1.14AD-Controlled-CA-Staging-Preflight-R1A-R2.ps1`;
3. `mode_stagecheck`;
4. the fresh source authority `E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-31_000303_IST`;
5. the R1B-R1 change report.

Then:

1. fix only the missing `out` binding in `mode_stagecheck`;
2. preserve all raw alternate-index blob checks;
3. preserve the exact 35-path scope;
4. preserve the strict one-byte EOF REDâ†’GREEN check;
5. preserve external alternate index/object isolation;
6. rerun from a fresh alternate index;
7. require the stagecheck JSON artifact to be emitted;
8. require final live-source and real-index preservation postflight;
9. independently inspect the resulting reports ZIP;
10. update this file and create a new timestamped `docs\changes` report before starting the next task.

## Remaining V1.14AD sequence

1. Correct only the R1A-R2 `mode_stagecheck` output-variable defect.
2. Complete the alternate-index CA staging preflight.
3. Independently verify the exact 35-path staged manifest, raw blob hashes, preservation sentinels, and postflight.
4. Resolve `PARENT_BASELINE_REVIEW_REQUIRED` and commit ordering against current Git HEAD.
5. Obtain explicit authorization for real-index staging.
6. Perform controlled real-index staging only.
7. Independently verify the real staged tree and confirm unrelated latest-source work is excluded.
8. Establish/approve commit strategy.
9. Create commit only after explicit authorization.
10. Revalidate the accepted committed/latest source state as required.
11. Build a fresh Windows portable package.
12. Verify portable location, executable SHA-256, Watchlist split preservation, and required runtime smoke behavior.
13. Complete final V1.14AD closeout documentation.

## Parent-baseline / commit-order boundary

Even after the alternate-index scope preflight succeeds, real staging remains blocked pending parent-baseline review.

Expected staging-preflight classification:

`V114AD_CA_ALT_INDEX_STAGING_SCOPE_VALIDATED__REAL_INDEX_UNCHANGED__PARENT_BASELINE_REVIEW_REQUIRED`

Expected authorization state:

`readyForRealStaging = false`

until commit-order review is explicitly resolved.

## Do not do

- Do not run broad `git add .`, `git add -A`, or stage entire shared files blindly.
- Do not commit yet.
- Do not replay old R3/R4 cumulative assembly over current latest source.
- Do not restore the old ~630 KB Official Watchlist feature chunk baseline.
- Do not discard unrelated current working-tree changes.
- Do not use production SQLite for staging validation.
- Do not package from an unreviewed staged or commit state.
- Do not treat an older chat, ZIP, source folder, or operator completion statement as newer authority without verifying it.

## Confirmed facts / assumptions / not-yet-tested

### Confirmed

- The 2026-08-31 00:03 IST snapshot contains 771 files and was reported by the snapshot tool as 0 missing / 0 unexpected / 0 hash mismatches.
- Independent snapshot analysis gives full identity `1A25D9FFDD10609817580A9A86428E2B1D03E2205F1EE3BE33CA7E1C99B660C0`.
- Independent build-relevant analysis gives the unchanged `9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D` authority.
- R1A-R2 strict staged whitespace check reached GREEN.
- The current failure is the undefined `out` variable at final `mode_stagecheck` emission.

### Assumptions

- None are required to identify the next code correction.

### Not yet tested / not yet authorized

- A corrected R1A-R2/R3 staging preflight has not run.
- Final alternate-index postflight has not passed.
- Real Git staging has not been authorized.
- Commit ordering has not been resolved.
- No fresh portable package has been built from the eventual accepted staging/commit state.

## Documentation operating rule

After every meaningful source, validation, staging, build, packaging, or blocker-resolution task:

1. perform the task;
2. validate it using actual command output;
3. create the timestamped `docs\changes` report;
4. update this `docs\CURRENT_WORK_STATUS.md`;
5. mirror the current task/blocker/next action at the top of `HANDOFF.md`;
6. only then start the next task.

`PROJECT_STATE_EOD_CHARTING_PLATFORM.md` and `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md` should be updated when a phase boundary or material project state changes.

## Snapshot-continuity note

The current `scripts\Create-EOD-Source-Code-Snapshot-v3.ps1` includes the root `HANDOFF.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, and `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`, plus `docs\changes`, but it does **not** currently select `docs\CURRENT_WORK_STATUS.md`.

Therefore this checkpoint also mirrors the active state into the root `HANDOFF.md`, which is snapshot-included. A later bounded snapshot-tool enhancement may explicitly include `docs\CURRENT_WORK_STATUS.md`; that script change is **not** part of this documentation-only checkpoint.

## New-chat bootstrap

Use this prompt when a new chat/session is required:

> Project: EOD Charting Platform
> Root: `E:\TA Projects\EOD Charting Platform`
> First read `docs\CURRENT_WORK_STATUS.md`. If working only from a source snapshot that does not contain that file, read the top **Current active handoff** section of `HANDOFF.md`, then the referenced latest `docs\changes` report. Verify the source/snapshot/hash authority before changing anything. Do not rely on previous-chat memory. Continue only from **Current blocker**, **Exact next action**, and **Remaining V1.14AD sequence**. Preserve unrelated working-tree changes and do not perform real Git staging unless explicitly authorized.

## Current continuity report

`docs\changes\2026-08-31_0025_IST_V1_14AD_CONTINUITY_DOCUMENTATION_DIRECT_SNAPSHOT_UPDATE.md`
