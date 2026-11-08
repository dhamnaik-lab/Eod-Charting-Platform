# B12 — MACD plot type and opacity controls truthfulness

- **IST:** 2026-11-08 16:07 IST
- **Authorized workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform`
- **GitHub authority:** `main` at `ed8cd93e614aaff864d12f5da0aab3742eeb8745`
- **Tracking:** [issue #41](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/41), [master #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #83](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/83)

## Objective / previous defect

MACD settings previously advertised **Plot Type** and **Opacity** controls on its two lines, plus **Opacity** on its histogram. The MACD builder reads plot visibility, plot colors, line widths and line styles, but does not read `plotStyle` or `opacity`. Users could save these ineffective controls without affecting rendering. The scoped decision is **hide unsupported controls for MACD only**; no modification of other indicator plot controls or new render semantics.

## Files changed

1. `src/components/IndicatorSettingsDialog.tsx`: Add optional capability flags `plotStyleEditable` and `opacityEditable`, defaulting to the existing visible behavior. Set the flags false only for the affected MACD macd/signal lines and histogram; guard the matching controls in the existing `PlotControl` rendering function. Existing colors, line width, line style and visibility controls retained.
2. `src/indicators/__tests__/indicatorMacdPlotControlsB12.test.tsx`: Five focused cases: MACD field visibility, untouched ADX controls, golden equality of MACD/signal/histogram values with ignored legacy plot settings, supported style/visibility behavior, and saved-workspace field restoration.
3. `docs/changes/2026-11-08_1607_IST_B12_MACD_PLOT_CONTROLS_TRUTHFULNESS.md`: this change record.

## Exact behavior changed and preserved

- **Changed:** MACD users no longer see controls that do not change the plotted output.
- **Preserved:** MACD calculations, per-plot visibility, colors, line width/style, histogram colors and bars, default rendering, unrelated indicators, selected chart/sheet state, persistence and arbitrary legacy `plotStyle`/`opacity` metadata. No migration or destructive update.
- No backend, Rust, dependencies, database, templates or source directory build artefacts.

## Validation performed (actual evidence)

Code/test PR head `8e79256e1cd0f8b4687bf622b4feb0bec2c3b74d`: [GitHub Actions run #42472085678](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42472085678) **SUCCESS**. Confirmed via job steps and full logs:
- `npm ci` PASS.
- `npm test` PASS: **233 test files passed / 1 skipped; 1,559 tests passed / 1 skipped / 0 failed**.
- New B12 MACD suite: **5/5 PASS**.
- `npm run typecheck:renderer` PASS.
- `npm run build:renderer` PASS; Vite build 4.04 seconds.

**Mandatory final-head check:** CI must run again after this documentation commit. Earlier CI is not a substitute.

## Risks and untested checkpoints

- Existing saved ineffective plotStyle/opacity values remain in persisted configurations, intentionally untouched.
- Other indicators may also have ineffective controls; this B12 correction intentionally covers only MACD, as authorized. They require separate bounded decisions and tests.
- No Windows GUI screenshot / pointer Save/Reopen acceptance, native/Rust check, portable Windows package or local database test was performed; CI is renderer-only. One existing Vitest skip remains.

## Rollback

Before merge, abandon PR #83 and leave `main` unchanged. After future separately approved merge, revert only B12 commit after checking newer changes. No database rollback/migration needed.

## Completion gate

Check full CI on final documented PR head, update issues #41/#28 with evidence, leave draft unmerged until batch merge approval. Then begin B15 only as the next bounded task.
