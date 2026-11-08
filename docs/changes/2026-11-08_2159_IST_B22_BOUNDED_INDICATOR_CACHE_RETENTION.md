# B22 — Bound obsolete indicator-cache signatures after measured growth

- **IST:** 2026-11-08 21:59 IST (UTC+05:30)
- **Active workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform`; source edits GitHub-only
- **Verified main source authority:** `6d7b781f572aa4ff8c1fa8ba1b75c75149fdc024`
- **Tracking:** [B22 issue #51](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/51), [master #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #93](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/93)

## Objective and previous limitation

The registry held each live `OHLCBar[]` in a `WeakMap` whose value contains a `Map` of renderable settings signatures. When settings changed repeatedly but the bars array/data signature stayed the same, the bucket retained *every* past signature indefinitely. This is a bounded memory-retention problem; numerical calculations, upstream chaining/invalidation and current chart behavior must remain unchanged.

## Inspected files

- `src/indicators/registry.ts`: cache weak key, data mutation and set signatures, chained keys, cache hit/read/write and sibling calculations.
- `src/engine/__tests__/IndicatorsCache.test.ts`: isolation across arrays, active settings invalidation, upstream chain invalidation, same-array bar changes, corporate-action historical updates, sibling renderable identity.

## Measure first — actual baseline CI evidence

Benchmark/test-only commit `b7bf22971364765c61ca84f80bfaeaa35dcb36c9`, [GitHub Actions #42499689889](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42499689889) **SUCCESS**, no registry changes.

Using 80 deterministic completed OHLCV bars in a stable array, one SMA sibling and 800 sequential unique BOLL stdDev edits:

| Metric | Baseline (unbounded) |
|---|---:|
| Settings edits | 800 |
| Retained renderable keys | **802** |
| Retained sibling object identity | TRUE |
| Scan/edit loop | 190.43 ms |
| Raw Node heap delta | +42,784,160 bytes |

**Important:** the heap delta is not attributable exclusively to cache retained renderables; Node/Vitest allocations, garbage collection and other processes affect it. The exact `Map.size=802` confirms linear signature retention, which is sufficient evidence for bounding this bucket.

## Implemented bounded correction

- **Modified** `src/indicators/registry.ts`: retain at most **256** entries per existing weak-key bars bucket. For every actual cache hit, refresh LRU order. On insert, evict the oldest renderable key if over cap. Preserve existing data mutation signature, weak-key ownership, upstream chaining keys and entire indicator formula and output logic.
- **Created and expanded** `src/engine/__tests__/indicatorCacheRetentionB22.test.ts`: three tests: 800-edit retained-entry benchmark and unchanged sibling identity, recomputation of an evicted signature with identical numeric output, correct cache replacement on an in-place changed interior bar. Existing six cache tests remain enabled.
- **Created** `docs/changes/2026-11-08_2159_IST_B22_BOUNDED_INDICATOR_CACHE_RETENTION.md`: this IST record.

## Post-change measured evidence

Code/test head `ac1759eaa09dd007b1024eba66cdc36736b5e7d0`, [GitHub Actions #42499939842](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42499939842) **SUCCESS**:

| Metric | Post-change |
|---|---:|
| Settings edits | 800 |
| Retained renderable keys | **256** |
| Retained sibling object identity | TRUE |
| Edit loop | 184.17 ms |
| Raw Node heap delta | +42,642,064 bytes |

**Interpretation:** retained *entry count* is bounded; the two single-run heap deltas are nearly identical and do **not** establish a measured reduction in total live heap or memory pressure. Don't infer overall memory or speed gains from these runs. Evicted historical settings compute anew if revisited. The LRU cap could cause additional recomputation if one chart somehow uses more than 256 distinct live renderables; that is the intentional bounded trade-off.

## Actual test / typecheck / build validation

[GitHub Actions #42499939842](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42499939842): `npm ci` PASS; `npm test` **242 test files passed / 1 skipped, 1,619 tests passed / 1 skipped / 0 failed**; B22 **3/3** and existing cache suite **6/6** PASS; `npm run typecheck:renderer` PASS; `npm run build:renderer` PASS (Vite 5.45 seconds).

**Final-head CI not yet checked:** after docs commit, verify entire workflow again rather than extrapolate this run.

## Behavior preservation, limitations, rollback

- **Preserved:** stable sibling-cache object identity under repeated edits, numerical results even after eviction, correct upstream source dependencies, cache isolation across different bars arrays, invalidation for changed interior/tail bars and corporate action adjustments, weak-key garbage collection eligibility. No new dependency, schema, database or UI changes.
- **Untested:** long-running Windows process memory under actual editing workloads, V8 heap snapshots, GC-normalized retained heap, Tauri/Rust/portable builds and real DB use. One pre-existing Vitest skip remains.
- **Rollback:** close draft PR #93 before merge; if separately approved later, revert this bounded cache change and regression/doc as scoped after evaluating intervening changes. No migration needed.

**Closure:** verify docs-head CI, update B22 issue #51 and master #28, leave PR draft/unmerged and then begin B26 as the next independent bounded task.
