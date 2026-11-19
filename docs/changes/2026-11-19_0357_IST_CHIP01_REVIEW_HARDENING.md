# CHIP-01 — Follow-Up Review Hardening, Edge-Case Tests & Real-DOM / CSP Browser Verification

**Timestamp:** 2026-11-19 03:57 IST (`UTC+05:30`)  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Task ID:** `CHIP-01` (independent review & hardening)  
**Status:** Automated Vitest suites (28 files / 178 tests), `npm.cmd run typecheck:renderer`, `npm.cmd run build:renderer`, `scripts/check-doc-references.ps1`, real headless Chromium Web Worker responsiveness + all-54-pattern parity, React 18 `<StrictMode>` DOM `<Toolbar />` integration, and production `dist/` Tauri-CSP worker execution checks **PASS**; Windows portable rebuild & manual `.eod` smoke test remain **PENDING** user execution.

---

## 1. Pre-Edit Backup & SHA-256 Evidence

- **Pre-edit backup directory:** `backups/pre_opencode_changes_20261119_033351_chip01-review-fixes`
- **Backup manifest:** `backups/pre_opencode_changes_20261119_033351_chip01-review-fixes/backup-manifest.json` (`fileCount: 6`, `totalBytes: 292380`)

| File | Before SHA-256 | After SHA-256 |
|---|---|---|
| `src/features/chartPatterns/workerClient.ts` | `B7D3FB53180112108335484F090F05C80CADA65B4EE8F55D09A257C6FCEF6599` | `517ED1B624814BBA665EB1CE27651A415FB36704CBB7D322DD27BFCA93A939C4` |
| `src/components/Toolbar.tsx` | `DAC00AFD5C41A01A3E427CFAE5D0D33E9D52E55B18A061FEDE01945073B36EFF` | `4B63100874FE5BF984FDCB4F9C687A47A86288D232AF37BC5E70AEBEBB510961` |
| `src/features/chartPatterns/__tests__/toolbarChartPatternWorkerCHIP01.test.ts` | `25866043A07A688B66EE3B4B3EC2CA31C2261727138D10E53EE64F9D9140AF33` | `B7E859C6078DF6B1BCDBAD9D1F4200100C7A87CF10E294BBC701E1B100CF2FE4` |
| `src/components/__tests__/ToolbarChartPatternChipCHIP01.test.tsx` | `B73D9DCE61FC0FFC11F8C48D89BD1C14BF6B9ACEBC4A540ED24BCF42E63B5E3F` | `8731DDE135129E7F6A438B7C27C850CFEEFB4C398EA9397B71B9DA9DA60BAB82` |

---

## 2. Review Findings & Hardening Changes

1. **Worker constructor, `messageerror`, and inline mixed-call cancellation (`src/features/chartPatterns/workerClient.ts`):**
   - Moved `ensureWorker()` (`createWorker()`) and `requestId` allocation inside the `new Promise(...)` `try/catch` in both `evaluate()` and `evaluateToolbar()` so synchronous `new Worker(...)` failures return a rejected `Promise` cleanly rather than throwing synchronously before Promise creation.
   - Added a `'messageerror'` listener (`handleMessageError`, cleaned up in `terminateWorker()`) so structured-clone deserialization failures terminate the worker and reject the pending request instead of hanging `Scanning...` indefinitely.
   - Updated `createInlineExecutor().evaluate()` to invoke and clear `activeToolbarCancel` immediately if an inline toolbar scan is active when `evaluate()` begins.
2. **Toolbar freshness checks & comparator allocation hygiene (`src/components/Toolbar.tsx`):**
   - Strengthened `currentTab` / `postEvalTab` stale-completion guards in `handleRunChartPatternScan` to compare `instrument` and `requestedInstrument` identity (`exchange` and `symbol`) in addition to `id`, `priceBasis`, `rawBars`, `timeframe`, `databasePath`, and `isDatabaseTransitioning`.
   - Cancelled any obsolete in-flight scan and cleared `chartPatternScanRunning` if `!priceBasis || rawBars.length === 0 || isDatabaseTransitioning` triggers an early exit.
   - Hoisted `recentDates` (`new Set(bars.slice(-30).map(...))`) out of the pairwise comparator inside `selectBestChartPatternResult()` so sorting avoids repeated per-comparison `Set` allocations on the UI thread while preserving exact sort order and AST-harness compatibility.
3. **Expanded focused regression tests:**
   - `src/features/chartPatterns/__tests__/toolbarChartPatternWorkerCHIP01.test.ts` (7 → 10 tests): added all-54-pattern (`minScore = 40`) parity against `runActiveChartPatternScan`, `createWorkerExecutor()` constructor/`postMessage`/`messageerror` failure & recovery checks, and `createInlineExecutor()` mixed `evaluateToolbar()` + `evaluate()` cancellation.
   - `src/components/__tests__/ToolbarChartPatternChipCHIP01.test.tsx` (8 → 9 tests): added rapid synchronous double-click supersession, non-conflicting `Volume` chip toggle mid-scan, rapid tab switching (`tab-1` → `tab-2` → `tab-1`) cancellation, and rapid `ON` → `OFF` → `ON` cycling.

---

## 3. Verification Evidence

- **Headless Chrome (`--headless=new` + CDP) real Web Worker, React 18 `<StrictMode>` DOM, and `dist/` Tauri-CSP checks** (disposable `TMP-01` workspaces `chip01rev_082eaf1c01234fd4852df800db72053a` and `chip01dom_677f05582fd04be3a84eb341696b1aba` removed cleanly via `Invoke-EOD-TmpLifecycle.ps1 -Action Cleanup -RetentionDays 0 -ConfirmExactWorkspace`):
  - **Worker responsiveness & parity:**
    - `1,000 bars` (`6` matches, parity `true`): Before `maxRafGapMs = 431.2 ms` (`maxTimerDelayMs = 431.9 ms`, `5` frames) → After Worker `maxRafGapMs = 18.4 ms` (`maxTimerDelayMs = 6.2 ms`, `32` frames).
    - `2,500 bars` (`14` matches, parity `true`): Before `maxRafGapMs = 873.0 ms` (`maxTimerDelayMs = 873.6 ms`, `4` frames) → After Worker `maxRafGapMs = 17.6 ms` (`maxTimerDelayMs = 6.1 ms`, `62` frames).
    - `4,000 bars` (`24` matches, parity `true`): Before `maxRafGapMs = 1,407.8 ms` (`maxTimerDelayMs = 1,408.3 ms`, `4` frames) → After Worker `maxRafGapMs = 18.1 ms` (`maxTimerDelayMs = 6.1 ms`, `97` frames).
    - All-54-pattern (`minScore = 40`) custom selection on `1,000` bars: `all54Parity = true` (`82` matches).
    - Live worker `cancel()` on `2,500` bars resolved `{ results: [], cancelled: true }` in `0.2 ms`.
  - **Real React 18 `<StrictMode><Toolbar /></StrictMode>` DOM mount (`window.__TAURI_INTERNALS__` stubbed, real Web Worker):** verified `Chart Patterns` click (`Scanning...`, `disabled: true`, `63` rAF frames, `maxRafGapMs = 23.5 ms`), `⚙` → `Scan Active Chart` stale-closure fix while active (`overlayClearedDuringRescan: true`, new overlay generated), toggle OFF (`aria-pressed="false"`), mid-scan symbol switch `ABC` → `XYZ` cancellation (`scanningAfterSwitch: false`, `overlayAfterMidScanSwitch: null`), and mid-scan `root.unmount()` disposal (`overlayAfterUnmount: null`).
  - **Production `dist/` Tauri CSP worker check:** served built `dist/` with exact `src-tauri-shell/tauri.conf.json` `Content-Security-Policy` (`worker-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval' blob:`) and verified `evaluation.worker-GtMhcDVp.js` loaded and replied `{ type: 'complete-toolbar', output: { cancelled: false } }`.
- **Final post-documentation Vitest, typecheck, build, and doc checks:** recorded in `HANDOFF.md` after final edits.

## 7. User portable acceptance — 19 November 2026 IST

- **Manual checkpoint:** User reported Windows portable smoke test **PASS** after CHIP-01. This supersedes the original pre-acceptance pending status at the top of this historical change record.
- The reported multi-second Chart Pattern chip freeze is accepted as corrected. A separate Chart Pattern issue known to predate CHIP-01 remains deferred, with no fix or diagnosis authorized in this task.
- Portable executable SHA-256, exact build timestamp, and a line-by-line native smoke-test transcript were not supplied; do not infer them from automated browser results.
- No application source files or test outputs were altered during this documentation-only update.
