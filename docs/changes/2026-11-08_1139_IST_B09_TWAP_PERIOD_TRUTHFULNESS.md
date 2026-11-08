# B09 — TWAP Period setting truthfulness

- **IST timestamp:** 2026-11-08 11:39 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform
- **Authorized Windows root:** `E:\TA Projects\EOD Charting Platform` (GitHub-only work; local checkout not accessed)
- **Confirmed GitHub base:** `main` `7d82b5754e9f8c3f461e2c0588d18c509fb80f6c`
- **Tracking:** [audit issue #38](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/38), [master #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #79](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/79)
- **Scope:** One bounded renderer settings defect. No parallel audit fixes.

## Objective and previous defect

The TWAP settings dialog assigned `standardSourceSchema`, advertising a **Period** input in addition to Source. The active `buildTWAP` implementation, however, calculates a *cumulative* average of the selected price source from the first bar, never reads a rolling period, and the supported `ChartIndicator` TWAP type has no `period` field. The displayed Period input was therefore ineffective and misleading.

## Files changed

1. `src/components/IndicatorSettingsDialog.tsx`: replace only TWAP's schema with `{ inputs: [sourceField()], style: standardStyle }`. Add a comment explaining the cumulative behavior.
2. `src/indicators/__tests__/indicatorTwapPeriodTruthfulness.test.tsx`: 10 focused generated Vitest cases covering supported input controls, cumulative OHLC4 numerical reference, functional source switching, five legacy malformed/out-of-range period values, persisted layout restoration, and missing/unknown source fallback.
3. `docs/changes/2026-11-08_1139_IST_B09_TWAP_PERIOD_TRUTHFULNESS.md`: this IST change record.

## Final implementation and accepted behavior preserved

- TWAP's Inputs tab displays **Source** but **not Period**; Save remains available and the existing Color control remains on the Style tab.
- EMA and every other indicator retain their own settings schema.
- The TWAP builder, accumulation algorithm, initial-bar behavior, input-source selection, registry, catalog default (OHLC4), indicator type, chart layouts, and workspace serialization **are unchanged**.
- Historical workspace TWAP objects with `period` (even `0`, negative, string, or null) remain stored and restored unchanged; that field remains computationally inert as it was previously. No migration or destructive cleanup is introduced.
- Missing or invalid source values still fall back to Close; explicitly selected OHLC4 and High/Low work as before.
- No dependencies, backend files, database access, configuration, or new architecture.

## Actual validation evidence

First code/test PR-head commit `1098e9ea3310f7963e7c5f401ae718e8d200d23f` was verified in [GitHub Actions run #42453442590](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42453442590), conclusion **SUCCESS**. Job `Renderer tests, typecheck, build` completed successfully:

- `npm ci`: **PASS** (locked dependencies).
- `npm test`: **PASS**, 230 test files passed, 1 skipped; **1,540 tests passed, 1 skipped, 0 failed**.
- New `indicatorTwapPeriodTruthfulness.test.tsx`: **10/10 PASS**, as shown in the Vitest log.
- `npm run typecheck:renderer`: **PASS**.
- `npm run build:renderer`: **PASS**, Vite completed in 4.65 seconds.

**Final-head CI after adding this document must be inspected independently.** The earlier CI run does not demonstrate that a later Git commit passed.

## Risks, limitations and untested items

- Legacy inert `period` metadata is intentionally preserved, so it can remain present in existing stored TWAP objects.
- Rolling-window or session-reset TWAP is **not implemented**; either would require separate approval and numeric reference tests.
- Windows desktop manual UI and workspace-reopen checkpoints **not performed**. Native Tauri/Rust and Windows portable builds **not performed**. No local database or checkout accessed.
- One pre-existing Vitest skip remains; none added.

## Rollback

Before merge, abandon draft PR #79; `main` is not modified. After a later separately approved merge, revert only the B09 merge commit through normal GitHub review, retaining unrelated intervening changes. Restoring `standardSourceSchema` would reintroduce the misleading Period selector but not change TWAP calculations.

## Completion gate

Verify full Vitest, renderer TypeScript, and Vite build on the final documented PR head. Then request **separate merge approval**. Do not start B10 under this authorization.
