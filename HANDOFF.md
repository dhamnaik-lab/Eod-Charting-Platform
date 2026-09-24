# Current Handoff

<!-- GANN-PLUGIN-IMPLEMENTATION:BEGIN -->
## Completed — Gann Price-Time Analysis Plugin (2026-09-14 01:12 IST)

**Classification:** `GANN_PRICE_TIME_PLUGIN_IMPLEMENTED__ALL_VALIDATION_GATES_PASSED`  
**Plugin ID:** `gann-price-time` · **Type:** `indicator` · **Status:** `bundled` · `defaultEnabled: true`

The Gann Price-Time Analysis subsystem plugin is fully implemented, registered, and validated directly in the platform source tree. No external dependencies. No database writes. Frozen Fibonacci tools (F1E.1) untouched. Guarded Vite chunks unchanged.

### Files created — `src/plugins/analysis/gannPriceTime/`

- `types.ts` — pure TypeScript contracts (`GannBar`, `GannPivot`, `GannAngleRay`, `SquareOfNineLevel`, `GannCycleSignal`, `GannSetup`, `GannPluginOptions`, `GannCoordinateMapper`)
- `engine.ts` — pure computational engine: Wilder ATR · centred-window pivot detection · Square of Nine harmonic levels · 2×1/1×1/1×2 angle rays · 45/90/180/360-bar time cycles with 5-bar breakout confirmation
- `canvasOverlay.ts` — Canvas 2D renderer; all paths in `ctx.save()`/`ctx.restore()`
- `gannPlugin.ts` — `RegisteredPlugin` manifest
- `__tests__/gannEngine.test.ts` — 28/28 deterministic unit tests PASS

### Surgical platform edits

- `src/engine/ChartEngine.ts` — added `setGannOverlayCallback()` public seam; callback fires at end of `renderOverlay()` before `ctx.restore()`
- `src/plugins/registry.ts` — +1 import, +1 `BUILT_IN_PLUGINS` entry
- `src/components/ChartCanvas.tsx` — `useEffect([bars])` computes `GannSetup` and registers the overlay callback
- `vitest.config.ts` — replaced overly-broad `**/analysis/**` exclude with `**/EOD Charting Platform Source Audit/**`

### Validation gates

| Gate | Result |
|---|---|
| `npx vitest run gannEngine.test.ts` | ✅ 28/28 PASS |
| `npx tsc -p tsconfig.json --noEmit` | ✅ 0 errors |
| `npm run build:renderer` | ✅ All guarded chunks under 500 kB |
| `cargo check` | ✅ Exit 0 — pre-existing warnings only |

Full report: `docs/changes/2026-09-14_0112_IST_GANN_PRICE_TIME_PLUGIN_IMPLEMENTATION.md`  
No real Git staging performed.
<!-- GANN-PLUGIN-IMPLEMENTATION:END -->

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


<!-- R1A-R3-CONTINUITY-UPDATE:BEGIN -->
## Current active handoff — R1A-R4-R2 preflight closed; parent-baseline review required (2026-08-31 02:02:16 IST)

- Exact 35-path CA alternate-index scope: **VALIDATED / CLOSED**.
- Raw staged-blob verification: **PASS**.
- 24 snapshot whole-file blobs + 1 exact hygiene blob: **PASS**.
- 10 special/shared hashes and exact 10-path remainder: **PASS**.
- Strict staged whitespace check: **GREEN**.
- Full 508-file live-source postflight: **PASS**.
- Real Git index SHA unchanged and clean: **PASS**.
- HEAD unchanged: **PASS**.
- Real staging performed: **NO**.
- Current authorization: `readyForRealStaging = false`.
- Next phase: **PARENT_BASELINE_REVIEW_REQUIRED**.
- Do not run real `git add` or commit yet.

Read `docs\CURRENT_WORK_STATUS.md` for exact evidence, parent-baseline questions, and remaining sequence.
<!-- R1A-R3-CONTINUITY-UPDATE:END -->
## Current active handoff — V1.14AD controlled staging preflight (2026-08-31 00:25:09 IST)

<!-- CURRENT-WORK-STATUS-MIRROR:BEGIN -->

**Primary operational status:** `docs\CURRENT_WORK_STATUS.md`  
**Current source snapshot:** `E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-31_000303_IST`  
**Build-relevant authority:** `9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D`

### Completed

- Latest-source CA integration decision: `NO_SOURCE_OVERLAY_REQUIRED__LATEST_SNAPSHOT_ALREADY_CONTAINS_PROVEN_CA_CLOSURES`.
- R1A: renderer typecheck/build, Watchlist split preservation, focused V1.14AD Rust, bhavcopy/bootstrap sentinels, full Rust **375 passed / 0 failed / 1 ignored**, and Cargo check all passed.
- R1B-R1: Watchlist deterministic test timeout corrected in one test file; focused test passed 3/3; full Vitest passed **632/632**; renderer typecheck/build and Watchlist chunk preservation passed.
- Fresh 2026-08-31 snapshot confirms the build-relevant source/config remains **508 files / 12,758,223 bytes / `9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D`**.

### Current task

**Controlled Corporate Action Staging Preflight** using an external alternate Git index/object store. Intended staged source/test/config scope is exactly **35 paths**. Real Git staging is not authorized.

### Current blocker

Latest external operator (not retained in the clean source tree): V1.14AD-Controlled-CA-Staging-Preflight-R1A-R2.ps1
SHA-256: `F30C8E8755B4FCE31DDCF000B368EA8E14E938D601E2AF96FC046CF270703CAD`

The R1A-R2 run reached strict staged-whitespace GREEN and raw-stage verification logic, then failed at the final helper result emission:

`NameError: name 'out' is not defined`

`mode_stagecheck(..., out_s)` is missing `out = pathlib.Path(out_s).resolve()` before `emit(out, result)`.

### Exact next action

Fix only that helper output-variable binding, rerun the alternate-index preflight from a fresh external index, require final stagecheck/postflight artifacts, independently audit the reports ZIP, then update `docs\CURRENT_WORK_STATUS.md` before proceeding.

### Remaining boundary

Even after a successful alternate-index preflight:

`readyForRealStaging = false`

until `PARENT_BASELINE_REVIEW_REQUIRED` / commit ordering is explicitly resolved.

**Do not:** broad-stage shared files, commit, replay old R3/R4 assembly, replace current Watchlist split files, package, or use production SQLite during this staging audit.

<!-- CURRENT-WORK-STATUS-MIRROR:END -->

## Immediate handoff — V1.14M three-row repair closed

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

### Operator handoff

No further database gate is required for this exact three-row repair. After this documentation closeout is verified, normal application operation may resume. Future Corporate Action work must start from the closed fingerprints above and must not reinterpret these three imports as approved Corporate Actions; they remain reviewable `PENDING_ISIN_MISMATCH` imports.

## Current objective

Maintain the warning-clean V1.7D Tauri 2 EOD Charting Platform from fresh source snapshot `Eod Charting Platform Source Code 2026-08-22_211417_IST` (uploaded ZIP SHA-256 `1A8F96F4BB339AE9FD1A7995F36A7D3CA4668244D3F3DC0772E6FE19D8ADC81D`). The accepted current Quote Editor UX is the embedded in-app `FloatingWindow`; the separate native/taskbar WebviewWindow experiment is rejected and fully rolled back.

The storage closeout currently comprises:

- Generation-6 binary-state sidecar with V1.3 baseline and V1.4 APPEND_NEWEST fast paths;
- V1.5 Quote Editor `download_log` invalidation;
- V1.6 localized sidecar invalidation and post-checkpoint incremental VERIFIED publication;
- V1.7A immediate new/full-file durability plus checkpoint phase/latency telemetry;
- V1.7C checkpoint cap 2;
- V1.7D binary import/write cap 2 while binary coverage prefilter remains 4.

Current runtime-validation portable SHA-256: `7C3E92E77ABBAD314F795C73577AED453E4641E6EB9C557C689019F14091847B`. Embedded Quote Editor smoke test passed. The final post-documentation portable build is still required.

Current operational database state is integrity-checked but not fully reconciled: Generation 6 is `COMPLETE`, sidecar has 24,535 VERIFIED / 0 DIRTY / 0 UNKNOWN, physical `.eod` census is 24,536, and recovery sessions are zero. The exact one-row gap is a separate read-only audit; do not rebuild or repair it during documentation/final-build work.

Immediate sequence:

1. apply the August 22 canonical documentation reconciliation;
2. build the final portable executable and record its hash;
3. on the next genuine trading day, capture the full Bhavcopy log to validate V1.7D two-worker import responsiveness/performance;
4. separately identify/reconcile the one missing state row through a read-only evidence-first audit.

Corporate Actions, Gann fidelity, and Git housekeeping retain their prior governed boundaries and must not be mixed into this closeout.

## Accepted Chart Viewport & Zoom Preservation Baseline (August 19, 2026 — confirmed working)

- **Root cause fixed**: `buildInstrumentLoadStartTab` zeroes `viewport → {0, 0}` for new instruments before the async data fetch. The previous implementation of `applyEodResultToTab` read from the already-zeroed loading-state tab, so the condition `tab.viewport.endIndex > tab.viewport.startIndex` was always `0 > 0 = false`, silently falling back to `createDefaultViewport`. The pre-load viewport was never preserved.
- **Symbol Viewport & Zoom Retention**: `loadInstrument` in `chartInstrumentCompareController.ts` now snapshots all tab viewports synchronously before `buildInstrumentLoadStartTab` zeroes them. The snapshot is passed as optional `previousViewport` to `applyEodResultToTab`, which uses `isViewportMeaningful(previousViewport)` to decide whether to restore or default. Switching symbols via watchlists, sidebar, search palette, or hotkeys now correctly preserves the user's horizontal zoom span and right-edge offset.
- **Timeframe & Chart Type Viewport Anchoring**: `applyTimeframeToTab` → `remapViewportAcrossTimeframe` was already structurally correct. It was silently falling back to `createDefaultViewport` because after a symbol switch the stored viewport was `{0, 0}` (from the broken symbol path above). With the symbol fix in place, the store always holds a meaningful viewport for the remap to anchor from.
- **Dynamic Price Scale Auto-Fit**: Stale manual price scale overrides (`paneScaleOverrides.price`) are cleared on instrument switch so the new symbol auto-scales to its own range.
- **Verification**: 111 test files / 637 tests PASS, `npm run typecheck:renderer` PASS (exit 0).
- **Files changed**: `src/features/charts/chartInstrumentHydrationService.ts` (+1 optional param `previousViewport` to `applyEodResultToTab`), `src/features/charts/chartInstrumentCompareController.ts` (viewport snapshot before first setState, passed through to `applyEodResultToTab`).

## Accepted Future Date Axis Year Label Fix (August 19, 2026)

- **Root cause**: `collectBoundaryTicks` and `averageBoundaryGapPx` in `ScaleManager.ts` hard-capped their scan at `bars.length - 1`, so year/month boundary ticks were never generated for future bar slots. `getPreviousBarLogicalDate` returned `null` for any future index (`index > bars.length - 1`), making year-boundary comparison against `null` unreliable for future indices. Result: when the viewport extended into the future zone past a year boundary, the current year label was repeated instead of showing the correct next year.
- **Fix**: Three targeted patches in `src/engine/ScaleManager.ts` only (~6 lines):
  - `collectBoundaryTicks`: `realEnd` now uses the caller-provided `end` (already capped at `bars.length + 500`) instead of `Math.min(end, bars.length - 1)` — boundary ticks are now generated across the full visible range including future slots.
  - `averageBoundaryGapPx`: same `realEnd` fix — boundary mode resolver is accurate when the viewport is mostly future bars.
  - `getPreviousBarLogicalDate`: guard relaxed from `index > bars.length - 1 → null` to `index <= 0 → null`; now delegates to `getLogicalDateForIndex` for all indices, which correctly extrapolates future dates from the last real bar.
- **Verification**: 111 test files / 637 tests PASS, `npm run typecheck:renderer` PASS (exit 0).
- **File changed**: `src/engine/ScaleManager.ts` only.


## Accepted Official Watchlist & Sector Universe Expansion Baseline (August 16, 2026)

- **BSE Stocks by Sector Universe** (`src/features/watchlists/bseSectorUniverseWatchlistData.generated.ts`): Added 6th official source tab with 13 official BSE macro-economic sector groups covering 1,527 BSE-listed equity stocks (*Commodities, Consumer Discretionary, Diversified, Energy, FMCG, Financial Services, Healthcare, Industrials, IT, Other / Diversified, Services, Telecom, Utilities*).
- **Automated Universe Refresh CLI** (`scripts/refresh-sector-universe.mjs`): Standalone on-demand script to fetch live feeds from `www.bseindices.com` and generate updated sector universe catalogs (`--source nse|bse|all`).
- **BSE Sectors & Indices Catalog Expansion** (`src/features/watchlists/officialWatchlistData.generated.ts`): Expanded BSE Sectors to 27 groups, BSE Indices to 15 groups (including fully populated BSE 500 with 501 members), disentangled BSE Power (Code: 69) and Energy (Code: 90), and whitelisted `www.bseindices.com` in backend fetch handler.
- **Manual-Only Trigger Contract**: Preserved strict user-initiated updates (zero silent background network calls on app open).
- **Verification**: 70/70 tests passed across `src/features/watchlists/`, 105 test files passing across project, `npm run typecheck:renderer` passed, `npm run tauri:check` passed. Pre-edit backup created at `backups/pre_opencode_changes_20260816_163511_bse-stocks-by-sector-universe`.

## Current source of truth

- Live project root: `E:\TA Projects\EOD Charting Platform`.
- Documentation basis snapshot: `Eod Charting Platform Source Code 2026-08-22_211417_IST`.
- Uploaded basis ZIP SHA-256: `1A8F96F4BB339AE9FD1A7995F36A7D3CA4668244D3F3DC0772E6FE19D8ADC81D`.
- Snapshot file count: 721 before this reconciliation.
- Active renderer: `src/`; active Rust backend: `src-tauri-shell/`.
- Typed renderer/backend seam: `src/platform/*` and `src/types/desktop.ts`.
- Cargo output: repository-root `target/` via `.cargo/config.toml`.
- Canonical release executable: `target\release\eod-charting-platform-shell.exe`.
- Portable destination: `release\tauri-portable-win\EOD Chart Portable`.
- Current runtime-validation portable SHA-256: `7C3E92E77ABBAD314F795C73577AED453E4641E6EB9C557C689019F14091847B`.

## Accepted Warning-Cleanup Baseline (August 22, 2026)

- W1.1–W1.4-B1 remains closed.
- Final Rust warning reconciliation is also closed: production `cargo check`, Rust test compilation, and Tauri compile check pass with `RUSTFLAGS=-D warnings`.
- No blanket `#[allow(dead_code)]` was added; unused release-only state/bootstrap surface was removed or test-gated without changing Generation 6, durability, or worker policy.
- Accepted renderer chunks after the embedded Quote Editor rollback build: `feature-chart-canvas` ~206.72 kB, `feature-chart-core` ~298.43 kB, `feature-chart-analysis` ~164.40 kB, `vendor-technicalindicators` ~19.81 kB, `feature-official-watchlists` ~55.08 kB.
- Runtime-validation portable build/manual smoke test: PASS; executable SHA-256 `7C3E92E77ABBAD314F795C73577AED453E4641E6EB9C557C689019F14091847B`.
- Evidence: `docs/changes/2026-08-22_2114_IST_STORAGE_QUOTE_EDITOR_WARNING_CLEANUP_CLOSEOUT.md`.

## Corporate Actions V1.12.1 Closeout / V1.13 Boundary

- V1.11 controlled approval approved exactly 283 authorized READY rows and left exactly 111 identity blockers.
- V1.12/V1.12.1 researched and classified all 111 residuals. Accepted result: 14 SAFE future-write candidates and 97 manual/unresolved.
- Final states: 10 `SAFE_OFFICIAL_EXTERNAL_EVIDENCE`, 4 `SAFE_RENAME_OR_RESTRUCTURE`, 49 `MANUAL_COMPANY_IDENTITY_REVIEW`, 5 `CONFLICT_UNRESOLVED`, 42 `NO_EVIDENCE_FOUND`, 1 `DATA_INTEGRITY_ANOMALY`.
- V1.12.1 final verification: 111/111, 22/22 package/regression tests, live DB/WAL/SHM unchanged, database writes 0, identity/history writes 0, Corporate Action approvals 0, Quick Resolves 0.
- V1.13 implementation has not started. Its approved scope is strict two-stage identity repair: exact 14 SAFE identity/history evidence writes only, followed by an independent read-only status recheck/post-audit. The other 97 rows remain untouched.

## Repository Maintenance Boundary

Git status/normalization remains intentionally deferred. Do not mix Git cleanup with the next Corporate Actions audit. Until a separate Git-maintenance phase is approved, source snapshots plus SHA-256 package/source guards remain the recovery baseline.

## Accepted August 20–22 storage and Quote Editor baseline

- Bhavcopy binary import/write cap = 2; read-only coverage prefilter cap = 4; deferred checkpoint cap = 2.
- New/full-file writes sync before rename; only durable-journal existing-file APPEND_NEWEST may defer sync.
- Checkpoint telemetry exposes verify/sync/publish and p50/p95/max.
- V1.5/V1.6 Quote Editor mutations invalidate download metadata and only affected state rows; zero-row operations preserve state.
- Quote Editor exchange scope defaults to ALL and includes NSE/NSE-INDEX/BSE/BSE-INDEX/reserved MCX; ALL loads report per-exchange counts.
- Quote Editor remains in-app `FloatingWindow`; native child-window experiment is rejected/rolled back.
- Genuine 2026-08-21 import succeeded 4/4 with 8,810 source rows, 23 new files, and 8,783 APPEND_NEWEST files. That run occurred before V1.7D import cap 2, so next genuine-day validation is still required.
- Current one-row physical/index gap is non-blocking but unresolved; keep it separate from UI/docs/final-build work.

## Accepted import/recovery baseline

### Manual Import Recovery and identity boundary

- Binary Manual Import uses durable, database-bound recovery sessions with manifest/journal integrity and newest-first persisted history.
- Session-specific Undo removes only proven inserted rows, restores overwrite before-images, preserves conflicting later edits, and may remove only provenance-proven session-created placeholder symbols.
- Quotation Editor deletion is quote-only. Removing the final quote does not delete instrument identity.
- Do not synthesize BSE symbols from `SC_NAME`, `SC_SHORT_NAME`, or company-name text. Legacy historical files may preserve official numeric `SC_CODE`; alpha resolution is a separate audited identity task.
- Keep NSE equity ingestion broad across supported equity/trade-for-trade/SME series and filter normal browsing in Symbols/sidebar; configured government-security exclusions are separate.

### Bhavcopy Phase 2B.1 and interrupted checkpoint resume

- Protected imports persist exact pre-mutation binary boundaries and a SHA-256 protected recovery manifest before mutation.
- Exact APPEND_NEWEST tail verification rejects unknown later dates, changed same-date rows, malformed headers/scale, and journal mismatch.
- Fast deferred-checkpoint resume accepts only `APPLIED` and `CHECKPOINTING`; other recovery states retain conservative handling.
- The August 12 restart case proved why this matters: the earlier sequential 8,570-file checkpoint took `1,057,829 ms` (about 17m38s) after the session resumed through the checkpoint path.

### Bhavcopy Phase 2C

- Current binary import/write concurrency is capped at 2 workers. The August 13 evidence below is the historical 4-worker baseline; binary coverage prefilter remains independently capped at 4.
- Only recovery-journal-governed existing-file `APPEND_NEWEST` writes may defer physical `sync_data()`.
- `REWRITE_TAIL`, `UPDATE_EXISTING`, `INSERT_HISTORICAL`, recovery replay, and Manual Import remain immediately durable.
- August 13 production import: 8,453 rows, 8,449 symbols, 43 new files, 8,406 APPEND_NEWEST files, 0 binary errors, 0 foreground `sync_data()` calls, 8,406 deferred syncs, and 57,456 ms binary-write wall time.
- Exchange results for that run: BSE 4,972 rows; BSE Index 77 rows; NSE 3,404 rows; NSE Index source unavailable for 2026-08-13.

### Bhavcopy Phase 2D background checkpoint

- After a successful buffered import, retained APPEND_NEWEST durability work is scheduled as a blocking background task rather than deferred to the next normal Bhavcopy run.
- Physical checkpointing remains fail-closed: journal/binary verification precedes `sync_data()`. Current checkpoint concurrency is capped at 2 workers; the August 13 evidence below is the historical 4-worker baseline.
- Process-local lifecycle serialization prevents foreground/background checkpoint/recovery races. A Bhavcopy operation started while the background checkpoint is still running may wait for that lifecycle lock; the supplied runtime acceptance did not exercise that exact concurrent-start case.
- Production Phase 2D runtime: session `20260813T110934.752306Z-p18044-0`, 8,406 APPEND_NEWEST files, 4 workers, start 16:40:39, complete 16:42:44, `elapsedMs=125405` (about 2m05s).
- Against the prior 8,570-file sequential checkpoint at `1,057,829 ms`, the observed elapsed time was about 8.44x faster / 88.1% lower. Workloads are close but not identical, so treat the percentage as operational evidence rather than a microbenchmark.
- The next Update at 16:45 completed in about two seconds with 0 jobs and did not perform a long retained-session recovery/checkpoint.

### Update cutoff, calendar safety, and source classification

- Automatic `Update` probes only through the previous calendar day before 18:00 local time; at/after 18:00 it may probe the current day. Manual Date Range and Full History are unchanged.
- Calendar precedence is special trading session first, then weekend, then known exchange holiday, then normal source probing. Special-session rules are exchange-aware for NSE/NSE Index and BSE/BSE Index.
- Date-by-date weekend/holiday logs remain visible. A date that reached the downloader and has no source is reported as unavailable/missing rather than being invented as a holiday.
- BSE/BSE Index HTML-instead-of-CSV responses are soft candidate mismatches. Soft mismatch text cannot overwrite a genuine hard candidate error; terminal SKIP is allowed only when no hard error remains.
- Final Rust validation after the candidate-classification correction: focused regression 1/1 PASS, Bhavcopy filter 50/50 PASS, `cargo check` PASS. The rebuilt current-day run then completed 3 success / 17 skipped / 0 failed with 8,453 imported rows. Because BSE Index data had become available, the exact all-soft terminal branch was not re-triggered in that rebuilt runtime run.

### Date Range prefilter

- Prefilter Range Scan V1 retains metadata-vs-binary reconciliation, the 80% usable-coverage threshold, the 31-target-date cap, fail-closed I/O behavior, and a maximum of 4 read workers.
- Trigger baseline for eight target dates: NSE 523,371 ms across 7,132 files; BSE 171,131 ms across 16,722 files.
- First optimized runtime: NSE 147,048 ms; BSE 77,687 ms, with the same eight already-imported dates preserved.
- Later same-range runtime: NSE 18,669 ms; BSE 2,593 ms; NSE Index 294 ms; BSE Index 27 ms. File-system/OS caching materially affects absolute timings, so the later 23-second planning stage is not a guaranteed cold-run figure.
- Prefilter V2/persistent coverage indexing is not currently justified. Reopen only if repeated real cold runs again become operationally unacceptable.

## Historical BSE/BSE Index acceptance retained

- BSE historical Equity/Index October-2023 coverage was runtime-tested successfully.
- BSE Index `IndexArchDailyAllPar` preserves literal `DD/MM/YYYY` query dates.
- Previously missing 2023-09-08, 14, 20, and 25 each imported 57 BSE Index rows; aggregate 4 success, 0 failed, 228 rows.
- A later July-2026 BSE/BSE Index missing-date backfill completed 12/12 jobs with 53,813 rows and 0 failures; its slower binary work used conservative rewrite/historical paths and is not a Phase 2C regression.


## Accepted Fibonacci baseline

- The Fibonacci family is **COMPLETE / CLOSED** at this checkpoint. The production group contains eleven Fibonacci kinds: `fib`, `fibExtension`, `trendFibExtension`, `fibChannel`, `fibTimeZone`, `fibTimeExtension`, `fibCircles`, `fibSpiral`, `fibArcs`, `fibWedge`, and `fibFan`.
- Fibonacci Retracement retains the accepted corrected orientation/plotting and full level authority. Trend-Based Fib Extension remains the reference-working three-anchor implementation.
- Fib Circles and Fib Speed Resistance Arcs are manually accepted.
- Fib Wedge retains the accepted data-space-first rule: stored bar/price anchors -> canonical wedge curves in data coordinates -> project sampled points through the current viewport. Do not restore screen-authored ellipse geometry.
- Fib Spiral is accepted on the restored **F1D.1** geometry. Counterclockwise, color/style, persisted same-timeframe perpendicular basis, and same-timeframe zoom stability are retained. The F1D.2 absolute-time/timeDeltaMs experiment was rejected because it distorted coarse timeframes and was rolled back; do not reintroduce it.
- Persisted kind `fibFan` now uses the accepted F1E Fib Speed Resistance Fan geometry. Its public metadata title is still `Fibonacci Fan`; this is a naming/compatibility detail, not a separate accepted geometry. F1E.1 builds each visible ray from the exact projected apex and Fibonacci price/time target, extends that projected ray for clipping, and shares canonical geometry with hit-testing.
- Completed Fibonacci geometry is a protected regression baseline during Gann work.

## Accepted Indicator Engine Baseline (118 Modular Indicators)

- The indicator subsystem is **COMPLETE & DECENTRALIZED** with a 1-file-per-indicator modular architecture under `src/indicators/standard/` and `src/indicators/community/`.
- All **47 missing standard TradingView indicators** across 5 batches are implemented, registered, and verified with dedicated test suites (`IndicatorsBatch1` through `IndicatorsBatch5`).
- **20 top high-value Community indicators** across two batches are implemented and tested (`IndicatorsCommunity.test.ts` and `IndicatorsCommunityBatch2.test.ts`):
  - Batch 1: `UT_BOT`, `WADDAH_ATTAR`, `SQUEEZE_MOMENTUM`, `WAVETREND`, `QQE_MOD`, `CHANDELIER_EXIT`, `SSL_CHANNEL`, `RIPSTER_EMA_CLOUDS`, `ALPHA_TREND`, `VFI`, `HALF_TREND`, `LINREG_CHANNEL`.
  - Batch 2: `SUPERTREND_AI`, `ORDER_BLOCKS`, `FVG`, `MARKET_CIPHER_B`, `RANGE_FILTER_DW`, `DONCHIAN_RIBBON`, `TRENDLINES_BREAKS`, `CM_VIX_FIX`.
- Full UI integration with typed schemas in `IndicatorSettingsDialog.tsx`, search catalog and label formatters in `catalog.ts`, and the **Hybrid Indicator Window** in `IndicatorPickerDialog.tsx` (top search + segmented master tabs, 9-category left navigation rail, 1-click `[+]` add buttons, favorite `★` pinning persistence, and right preview card).
- **Draggable Floating Window Architecture**: Reusable hook `src/components/common/useDraggableFloatingWindow.ts` and `FloatingDialogShell.tsx` provide smooth draggable titlebars, boundary clamping, and session position memory.
- **Zero-Blur Chart Visibility**: All dialogs (`IndicatorPickerDialog.tsx`, `IndicatorSettingsDialog.tsx`, `ChartDrawingPropertiesDialog.tsx`) use ultra-light clear overlays without blur, keeping price candles, indicators, and chart drawings 100% sharp and visible underneath.
- Sidebar organized into 'Price' and 'Pane' placement groups with 9 collapsible/expandable subcategories (`src/indicators/catalog.ts`, `src/components/Sidebar.tsx`).
- Total verification: 101 test files, 570 unit tests passing (`indicatorCatalogSubcategories.test.ts`, `useDraggableFloatingWindow.test.ts`). Full details documented in `docs/indicator-catalog.md`.

## Accepted Japanese Candlestick Patterns Baseline (44 Patterns, 3 Categories)

- The Japanese Candlestick Pattern Engine is **COMPLETE & PARITY-VERIFIED** under `src/engine/candlestick/` and `src/engine/Patterns.ts`.
- All **44 official TradingView candlestick patterns** are implemented and explicitly categorized into:
  - **Single-Candle Patterns (15)**: Doji, Dragonfly/Gravestone Doji, Doji Stars, Hammer, Inverted Hammer, Hanging Man, Shooting Star, Marubozu White/Black, Spinning Tops, Long Shadows.
  - **Two-Candle Patterns (15)**: Bullish/Bearish Engulfing, Harami, Harami Cross, Piercing Line, Dark Cloud Cover, Tweezer Top/Bottom, Kicking, Windows, On Neck.
  - **Multi-Candle Patterns (14)**: Morning/Evening Stars, Morning/Evening Doji Stars, Abandoned Babies, 3 White Soldiers, 3 Black Crows, Tri-Star, Rising/Falling Three Methods, Tasuki Gaps.
- Exact PineScript $C\_$ property vectorization (14 EMA body smoothing, shadow domination ratios, trend slope filters, range invariants).
- **Directional Colors & Label Spacing**: Bullish patterns render in emerald green (`#22c55e`), Bearish in coral red (`#ef4444`), and Neutral in amber (`#f59e0b`), with high-contrast text and 15px clearance above/below wicks.
- **Persistence & 1-Click Toolbar Toggle**: Pattern selections and colors persist via `src/features/candlestick/candlestickSettingsService.ts`. The top toolbar `Toolbar.tsx` provides a 1-click `Candles` toggle button (1st click scans and plots patterns, 2nd click removes, active blue accent styling). Redundant button removed from `ChartToolDock.tsx`.
- UI integration with categorized pattern picker sections in `IndicatorSettingsDialog.tsx` and "Select All / Clear" helpers per category.
- Total verification: 98 test files, 556 unit tests passing (`CandlestickPatterns.test.ts`, `candlestickSettingsService.test.ts`).

## Accepted Sidebar Suite, Quick Symbol Switcher & Global Hotkeys Baseline (August 17, 2026)

- **Command Palette Smooth Keyboard Scrolling** (`src/components/CommandPalette.tsx`): Attached dynamic element refs and automated `scrollIntoView({ block: 'nearest' })` on <kbd>↑</kbd> and <kbd>↓</kbd> keyboard navigation, ensuring selection highlight and viewport remain perfectly in sync.
- **Silent Timeframe Hotkeys** (`src/RootApp.tsx`): Streamlined single-key timeframe shortcuts (<kbd>D</kbd>, <kbd>W</kbd>, <kbd>M</kbd>, <kbd>Q</kbd>, <kbd>Y</kbd>) to execute instantly and silently without intrusive popup toast notifications, relying on top toolbar active button highlights.
- **Sidebar Watchlists Tab Space & Submenu Refinements** (`src/components/Sidebar.tsx`):
  - **Reclaimed Vertical Sidebar Space**: Removed redundant bulky `Source linked` and `Last synced` banner boxes from the sidebar; embedded sync status and timestamp directly into the `Update` button's tooltip.
  - **Seamless "Add to Watchlist" Submenu**: Eliminated hover-gap mouseleave race conditions via a seamless hitbox bridge and added the "Add to Watchlist ▾" submenu to both the Symbols panel and the Watchlists panel context menus.
  - **Inline Quick-Add Input & Sorting**: Maintained inline search with debounced dropdown and 1-click A-Z/Z-A sorting.
- **Chart Double-Click Auto-Scale Alignment** (`src/engine/ChartEngine.ts`):
  - **Price / Indicator Scale Auto-Fit**: Double-clicking the right Y-axis price scale or any indicator pane's Y-axis immediately resets manual vertical stretch/compression overrides (`paneScaleOverrides[paneId] = null`), returning that pane to dynamic Auto-Fit.
  - **Protected Chart Canvas**: Double-clicking inside the main chart plot area (candles/canvas) no longer forcibly resets the horizontal viewport, preventing disruption to active zoom/pan navigation.
  - **Time Axis Reset**: Double-clicking the bottom Date/Time axis resets horizontal viewport to default.
- **Verification**: All 111 test files passing, `npm run typecheck:renderer` PASS.

## Accepted Floating Windows & Left Sidebar Rail Dock Baseline (August 15, 2026)

- **Left Sidebar Navigation Rail Minimized Dock** (`src/components/Sidebar.tsx`): Minimized windows dock cleanly at the bottom of the left rail (`SYM`, `IND`, `WL`, `MOV`). Provides dedicated domain icon badges (`🔍` Scanner, `📥` Bhavcopy, `⭐` Watchlists, `📊` Indicators, `🔔` Alerts, `📝` Quote Editor, `🏢` Corporate Actions, `⚙` Settings), active green status dots, 1-click restore/focus, and right-click quick close. Frees up 100% of the chart canvas, date axis, volume histogram, and sheet tabs.
- **Fail-Safe Fallback Dock** (`src/components/WindowTray.tsx`): Discreet bottom-left floating dock renders only when the sidebar is completely hidden via the View menu.
- **Favorite Tools Floating Toolbar Mobility** (`src/components/FavoriteToolsToolbar.tsx`): Updated to `position: 'fixed'` and mounted at application root (`src/RootApp.tsx`), enabling unrestricted drag mobility across all app regions, sidebars, headers, and tabs without canvas clipping.
- **Indicators & Studies Floating Window** (`src/components/IndicatorPickerDialog.tsx`): Registered in `useWindowStore` with `FloatingWindow.tsx` (`960 × 620`); removed modal backdrop so clicking/panning on the chart canvas does not close the window.
- **Manage Watchlists Floating Window** (`src/components/WatchlistManagerDialog.tsx`): Converted to `FloatingWindow.tsx` (`780 × 580`), removing blocking modal backdrops to enable side-by-side watchlist editing while monitoring live charts.
- Total verification: 103 test files, 578 unit tests passing.

## Accepted Drawing Templates & Favorite Quick Toolbar Baseline

- **Drawing Templates Engine** (`src/features/drawings/drawingTemplates.ts`): Persistent template management system allowing users to save, name, apply, and designate default visual styles per drawing tool kind directly from `ChartDrawingPropertiesDialog.tsx`. Verified with dedicated unit tests (`drawingTemplates.test.ts`).
- **Floating Favorite Tools Toolbar** (`src/components/FavoriteToolsToolbar.tsx`): Draggable floating quick toolbar with active tool highlight, keyboard shortcuts, and horizontal/vertical layout toggle.
- **Interactive Star Toggles** (`src/components/ChartToolDock.tsx`): ⭐ star icons next to all tools in flyouts to pin/unpin favorites directly into the floating toolbar, with a dedicated dock toggle button.
- Total verification: 98 test files, 556 unit tests passing.

## Current non-blocking boundaries

- The next genuine trading-day Bhavcopy log is required to validate the V1.7D two-worker binary import policy; do not manufacture the workload through Quote Editor deletion.
- Checkpoint synthetic benchmark and real full-market evidence disagree; retain two workers for now and judge only from comparable workload telemetry.
- Generation 6 currently has one physical `.eod` file without a sidecar row. SQLite integrity is `ok`; per-symbol fallback remains safe. Exact key/cause/reconciliation are pending read-only audit.
- Large backward historical fills can remain slower because conservative mutations sync immediately. Prefer chronological oldest-to-newest loading when practical.
- BSE historical alpha-symbol resolution remains a separate identity audit.
- No Prefilter V2/provider redesign is planned without new measured evidence.

## Files to inspect first for Bhavcopy maintenance

1. `AGENTS.md`
2. `HANDOFF.md`
3. `REQUIREMENTS.md`
4. `src-tauri-shell/src/bhavcopy.rs`
5. `src-tauri-shell/src/bhavcopy_recovery.rs`
6. `src-tauri-shell/src/database/binary_eod.rs`
7. `src-tauri-shell/src/database/eod_binary_state.rs`
8. `src-tauri-shell/src/database/quotes.rs`
9. `src/components/DatabaseToolsDialogs.tsx`
10. `src/features/quoteEditor/quoteEditorExchangeScope.ts`
11. `docs/changes/2026-08-22_2114_IST_STORAGE_QUOTE_EDITOR_WARNING_CLEANUP_CLOSEOUT.md`
12. `docs/changes/2026-08-12_2102_IST_BHAVCOPY_INTERRUPTED_CHECKPOINT_RESUME_FIX_V1.md`
13. `docs/changes/2026-08-12_2353_IST_BHAVCOPY_PHASE2D_BACKGROUND_CHECKPOINT_V1.md`
14. `docs/changes/2026-08-13_0030_IST_BHAVCOPY_UPDATE_SAME_DAY_CUTOFF_V1.md`
15. `docs/changes/2026-08-13_0232_IST_BHAVCOPY_CALENDAR_SAFETY_V1_1.md`
16. `docs/changes/2026-08-13_1305_IST_BHAVCOPY_PREFILTER_RANGE_SCAN_V1.md`
17. `docs/changes/2026-08-13_1555_IST_BHAVCOPY_BSE_INDEX_CANDIDATE_CLASSIFICATION_V1_1.md`

## Files to inspect first for Gann work

1. `AGENTS.md`
2. `HANDOFF.md`
3. `src/components/DrawingToolGroups.ts`
4. `src/engine/DrawingMetadata.ts`
5. `src/engine/DrawingAdvancedGeometry.ts`
6. `src/engine/DrawingStyleSchema.ts`
7. `src/engine/Renderer.ts`
8. `src/engine/ChartEngine.ts`
9. `src/engine/types.ts`
10. `src/engine/__tests__/DrawingS23Contracts.test.ts` and Gann-relevant drawing tests
11. `docs/changes/2026-08-13_2105_IST_FIBONACCI_FINAL_DOCUMENTATION_RECONCILIATION_V1.md`

## Exact next step

Apply the August 22 documentation-only reconciliation and run the documentation reference/consistency checks. Then perform the final portable build and record its executable SHA-256.

On the next genuine trading day, send the complete Bhavcopy log from planning through background checkpoint completion. Confirm `Bhavcopy binary write stats: workers 2`, checkpoint `workers 2`, imported row/path counts, sync counts, and phase telemetry. Do not use Quote Editor to create an artificial workload.

After the release/build gate, run a separate read-only one-row binary-state gap audit. Do not rebuild, republish, or edit live data until the exact missing exchange/symbol and cause are identified.

Corporate Actions, Gann fidelity, and Git maintenance retain their prior governed boundaries.

<!-- V1.13-FINAL-CLOSEOUT:BEGIN -->
## Corporate Actions Phase 1 — V1.13 six-row identity repair closeout (2026-08-19)

### Current Corporate Actions handoff

The authorized six-row V1.13B-1 historical-ISIN repair is closed at `FULL_SUCCESS`.

**Closed tranche**
- Import 42274 PARSVNATH → history row 11602
- Import 19888 SBIN → history row 11603
- Import 24224 HINDCOMPOS → history row 11604
- Import 24025 GAYAPROJ → history row 11605
- Import 23036 BAJFINANCE → history row 11606
- Import 12841 TITAN → history row 11607

**Preserved boundary**
- Corporate Action imports/status were not promoted.
- Quick Resolve count: 0.
- Approval count: 0.
- Protected imports remain unresolved/unapproved: 819, 19896, 19973, 19977, 22969, 41025, 41574, 42863.

**Next Corporate Actions work**
Start a new read-only classification/design phase for the eight protected imports only. Do not reuse or rerun the closed six-row Apply. Keep successor/restructure cases separate from stale-association cases and from missing historical-symbol evidence.
<!-- V1.13-FINAL-CLOSEOUT:END -->


<!-- CA-R1A-2026-09-24:BEGIN -->
## Corporate Actions — Reconciliation R1-A current handoff (24 September 2026)

Current authority: `docs/superpowers/specs/2026-09-24-corporate-action-reconciliation-r1a-current-authority.md`.

- Fresh source snapshot: `Eod Charting Platform Source Code 2026-09-24_201002_IST.zip`
- Snapshot SHA-256: `B4C3E9AB71B79B2E3F9B0A703E43EF68F56B0DC89B655244BBC606634AF03719`
- Accepted live source: **569**
- Protected source: **563**
- R1-A source + copy-local acceptance: **CLOSED / CURRENT**
- 112-row accounting: **112/112**
- R1-A repair writes: **0**
- R1-A CA approvals: **0**
- R1-B deterministic repairs/TDD: **NOT STARTED**
- R1-C controlled TEST-DB apply/portable acceptance: **NOT STARTED**

Exact next bounded task: R1-B date-valid historical-symbol evidence reconciliation, beginning with imports 819, 19896 and 22888 as fixtures for one general evidence-backed rule. Do not hard-code symbol exceptions and do not broaden into price-data/no-active-candidate repair classes in the first slice.

Read next: `docs/superpowers/specs/2026-09-24-corporate-action-new-chat-handoff-after-r1a.md`.
<!-- CA-R1A-2026-09-24:END -->
