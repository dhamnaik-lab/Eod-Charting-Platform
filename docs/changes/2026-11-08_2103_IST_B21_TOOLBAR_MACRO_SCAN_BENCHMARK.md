# B21 — Toolbar historical macro-pattern scan benchmark (no worker migration)

- **IST:** 2026-11-08 21:03 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform, authorized Windows path `E:\TA Projects\EOD Charting Platform`, GitHub-only
- **Source baseline:** GitHub `main` `d0ad1d00619f6822366948751d7602b2fe6737ec`
- **Tracking:** [B21 issue #50](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/50), [master #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #90](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/90)

## Objective and source evidence

The Toolbar's `handleRunChartPatternScan` awaits full EOD history then synchronously calls local `runActiveChartPatternScan`. That function scans each completed endpoint with a bounded 220-bar context, evaluates macro definitions, rejects low scores, deduplicates and clusters milestones. It is distinct from the batch runner's existing worker-capable `chartPatternWorkerClient` and `chartPatternEvaluation` path. Avoid conflating them; **no worker migration or change to the toolbar algorithm is authorized here**.

Files inspected: `src/components/Toolbar.tsx`, `src/plugins/scanner/chartPatternScanners.ts`, `chartPatternScanService.ts`, `chartPatternWorkerClient.ts`, `chartPatternEvaluation.ts`, `scannerRunner.ts`, `scannerPatternMap.ts`, and existing scanner tests.

## Files changed

1. `src/components/Toolbar.tsx` — add `export` to **unchanged** `runActiveChartPatternScan`, so the exact production function can be measured directly. No algorithmic, rendering, cancellation or input behavior change.
2. `src/plugins/scanner/__tests__/toolbarPatternScanBenchmarkB21.test.ts` — two reproducible tests: measure the actual toolbar scan on deterministic 260/520/1,000 completed OHLCV histories twice, with warmup; compare full stable result payloads ignoring nondeterministic `generatedAt`, check source-bar immutability, milestone uniqueness, history fields and below-minimum handling. Print `B21_BENCHMARK` structured measurements and event-loop timer delay.
3. `docs/changes/2026-11-08_2103_IST_B21_TOOLBAR_MACRO_SCAN_BENCHMARK.md` — this IST record.

## Actual baseline measurement

**Source of measurements:** GitHub-hosted Linux CI runner, [Actions run #42495147819](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42495147819), code/test head `89cedde1a0f6c301f7801d4b50b75715526b7864`.

| Synthetic EOD bars | Run 1 scan ms | Run 2 scan ms | Timer delay ms (run 1 / 2) | Matched milestones | Repeatable output |
|---:|---:|---:|---:|---:|---|
| 260 | 87.94 | 76.98 | 88.16 / 77.58 | 1 | YES |
| 520 | 178.21 | 160.41 | 179.26 / 160.66 | 7 | YES |
| 1,000 | 339.84 | 334.69 | 340.21 / 334.96 | 17 | YES |

**Interpretation:** The measured toolbar algorithm blocks the Node event loop for roughly its synchronous scan duration, reaching around **335–340 ms for 1,000 synthetic bars** on this runner. Results are stable across repeats, source inputs untouched and milestones deduplicated. The timings are not normalized CPU benchmarks, not Windows/Tauri UI measurements, and **not proof of browser frame-time or user-visible dropped frames**. The actual workstation, live NSE/BSE histories, browser startup, full data retrieval, overlay selection and rendering are not measured.

## Automated validation

[GitHub Actions #42495147819](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42495147819) **SUCCESS**: `npm ci` PASS; `npm test` **239 files passed / 1 skipped; 1,601 tests passed / 1 skipped / 0 failures**, B21 **2/2 PASS** (benchmark test 1,268 ms total); `npm run typecheck:renderer` PASS, `npm run build:renderer` PASS (Vite 6.62 s). Full existing scanner regression suite passed.

**Final-head CI:** separately reverify after committing this documentation; this first successful run does not certify a later head.

## Preservation, findings, risks and follow-up

- **Behavior preserved:** exact pattern detection, macro-family filtering, score threshold, deduplication, clustering, strongest-match selection, completed-bar restrictions, overlay behavior and existing chart toggling, renderer/source outputs and batch scanner cancellation. No dependencies, source algorithm changes or new background worker.
- The current Toolbar macro scan is synchronous and does not support in-loop cancellation. Its existing desktop API load and chart toggle behavior were not modified. A responsive worker implementation would require separately approved design and parity/cancellation tests.
- The **performance concern is supported by measured event-loop delay**; recommending a worker migration needs representative Windows UI frame/interaction profiling and user approval. Do not treat B21 benchmark evidence as approval to migrate.
- **Untested:** real Windows browser responsiveness, actual instrument history, screenshots, Tauri/Rust, portable Windows build, native IO/DB. One pre-existing Vitest skip remains.
- **Rollback:** before merge, close draft PR #90; if approved and merged, revert only B21 export/test/doc commit. No data migration.

**Completion:** verify final documented-head CI, update issue #50 and master #28. Keep B21 draft/unmerged alongside B14 and B23; B23 next independent task.
