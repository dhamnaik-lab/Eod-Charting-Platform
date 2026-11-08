# B08 — STDEV Source control truthfulness

- **IST timestamp:** 2026-11-08 11:20 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform
- **Authorized local root:** `E:\TA Projects\EOD Charting Platform` (not accessed)
- **GitHub source baseline:** `main` `01be89661d4d1cf9a796cda2c96580a14834b198`
- **Tracking:** [issue #37](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/37), [master register #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #78](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/78)
- **Implementation scope:** B08 alone. No other audit issue, backend, database, dependencies, or local checkout modifications.

## Objective and previous limitation

The Standard Deviation (STDEV) settings dialog exposed a **Source** selector through `standardSourceSchema`, although the existing `buildSTDEV` implementation reads only the Close series and the STDEV indicator type has no source parameter. Changing Source therefore appeared effective while doing nothing to the plotted values.

The approved minimum correction removes the misleading selector without introducing a new source-dependent calculation or changing existing numerical results.

## Files changed

1. `src/components/IndicatorSettingsDialog.tsx` — switch only the STDEV input schema from `standardSourceSchema` to the existing `standardPeriodSchema`; include an explanatory comment.
2. `src/indicators/__tests__/indicatorStdevSourceTruthfulness.test.tsx` — add five focused regression tests for UI controls, independent Close-based numerical reference, legacy source field remaining inert, persistence of legacy STDEV metadata, and short-history warmup.
3. `docs/changes/2026-11-08_1120_IST_B08_STDEV_SOURCE_CONTROL.md` — this record.

## Final implementation and preserved behavior

- STDEV Inputs shows Period but not the unsupported Source selector; Color remains on the Style tab. The source selector for EMA and other supported indicators remains available.
- `src/indicators/standard/volatility/standard-deviation.ts`, `src/engine/types.ts`, the registry and workspace serialization are **unchanged**.
- STDEV continues calculating on Close only, with its existing default period, color, warmup `null` values, and calculation order.
- Legacy saved STDEV objects containing a `source` property are not rewritten or removed; source remains inert as before. Loading old workspaces preserves their fields.
- No changes to chart timeframes, other indicator calculations, alerts, databases, native code or packaging.

## Actual validation and evidence

First CI run on code/test commit `cfc91f0a731953492e3ae71182fbdb35a49e450c`:
[GitHub Actions #42452181232](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42452181232) — **SUCCESS**.

- `npm ci` — PASS.
- `npm test` — PASS: **229 test files passed, 1 skipped; 1,530 tests passed, 1 skipped, 0 failed**.
- Focused new `indicatorStdevSourceTruthfulness.test.tsx` — **5/5 PASS** (reported by Vitest in the CI log).
- `npm run typecheck:renderer` — PASS.
- `npm run build:renderer` — PASS (Vite 6.4.3 built in 7.08 s).

The final-head run after this documentation commit must be checked separately; do not infer it from the earlier run. A passing renderer CI does not validate Windows installed-app interactions, native Rust, or portable packaging.

## Risks and untested items

- Older workspaces may still carry an inert STDEV `source` property. This is deliberately preserved rather than destructively migrated.
- Adding genuinely source-selectable STDEV would be a separate numerical-behavior change requiring explicit approval and reference tests.
- Windows manual indicator-dialog and workspace-reopen checkpoints, native/Rust testing, and Windows portable build **not performed**.
- One previously skipped Vitest test remains skipped; no tests were disabled for B08.

## Rollback

Keep `main` unchanged until review and separate merge authorization. Before merge, close or abandon draft PR #78. If later merged, revert only the B08 commit (including focused tests and change record) after reviewing its impact; do not overwrite intervening changes. Reintroducing the old Source schema would restore the misleading selector, not add source-aware calculation.

## Acceptance and next step

Require the documented final PR head to pass renderer Vitest, TypeScript typecheck and Vite build, then request separate merge approval. Do **not** start B09 as part of B08.
