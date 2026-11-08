# B13 — Validated Study-as-Source choices in both settings entry points

- **IST timestamp:** 2026-11-08 17:32 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform` (GitHub-only)
- **Verified source baseline:** `main` `c6646d0a8d2be8c7c3bc5cd9496c0b38dd0e1295` (tree `403492bba5e559433edfe52dd0a787dd8ee39e09`)
- **Tracking:** [issue #42](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/42), [master #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #86](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/86)
- **Scope:** B13 only; B17/B19 are separately approved sequential tasks; no merge authorized.

## Objective / previous defect

The settings dialog already included Study-as-Source UI, but neither the pane-controls nor price-legend settings mount supplied `allIndicators`. The selector therefore never offered real upstream studies from either entry point. The earlier picker also advertised all other studies without checking hidden/failed/missing/duplicate/cyclic dependencies or output plot availability, and silently displayed Price Close when a saved source could not be found.

B05 (merged) provides strict dependent-series semantics: compute in dependency order, preserve warmup nulls, reject missing/hidden/cyclic/ambiguous/failed sources, and honor `sourcePlotKey`. The UI should only offer options compatible with this established engine.

## Files inspected

`ChartPaneControlsOverlay.tsx`, `ChartPriceLegendOverlay.tsx`, `ChartCanvas.tsx`, `IndicatorSettingsDialog.tsx`, `registry.ts`, `chaining.ts`, `base.ts`, `engine/types.ts`, B05 `IndicatorsChainingCorrectness.test.ts` and documented B05 source behavior.

## Source files created or modified

1. **Created** `src/indicators/studySourceChoices.ts`: calculate validated source-choice options from the existing B05 renderable indicator bundle. Require currently visible, unambiguous, non-self/non-cyclic upstream indicators, actual finite numeric aligned output lines/histograms, and a supported dependent kind. Encode ID/plot key unambiguously in HTML select option values.
2. **Modified** `src/components/IndicatorSettingsDialog.tsx`: supply eligible upstream choices with exact output labels and keys, keep the standard seven OHLC price choices, save selected `sourceIndicatorId` and `sourcePlotKey` together, clear both when switching to price, and show a disabled unavailable-source placeholder for a saved unresolved reference instead of suggesting Close. Existing saved `sourceIndicatorId` without `sourcePlotKey` still resolves to first valid source line. No automatic rewrite of saved data.
3. **Modified** `src/components/ChartPaneControlsOverlay.tsx`: forward full source-indicator list and chart bars; new props optional with backwards-compatible defaults for existing mounts/tests.
4. **Modified** `src/components/ChartCanvas.tsx`: pass full `overlays` indicator list and `bars` to pane-controls settings mount.
5. **Modified** `src/components/ChartPriceLegendOverlay.tsx`: pass existing full `overlays` and `bars` to price-legend settings mount.
6. **Created** `src/indicators/__tests__/studyAsSourceUiB13.test.tsx`: eight real SSR/UI/engine/persistence regressions covering both mounts, plot options including MACD histogram, hidden/missing/cyclic/duplicate filtering, no valid-bar output, saved source metadata, OHLC choices, and numerical/reorder parity with SMA.
7. **Created** `docs/changes/2026-11-08_1732_IST_B13_STUDY_AS_SOURCE_UI.md`: this IST record.

## Behavior changed / preserved

- **Changed:** Both existing indicator Settings entry points now offer truthful, currently calculable upstream line/histogram choices and present invalid saved sources explicitly as unavailable.
- **Preserved:** Existing source price choices, indicator builders and numerical outputs, segmentation/warmup/cycle behavior from B05, persisted workspace IDs/plot keys, unrelated chart-pane/legend controls, Save/Remove/Cancel and normal chart appearance. Source selections are not rewritten on open. No new dependencies, database, backend, Rust, new settings system, or workspace migration.
- **Cost/limitation:** Candidate discovery invokes cached indicator rendering when the selector is mounted; very long histories/complex charts should receive a manual UI responsiveness check. A choice requires at least one currently finite bar; an unavailable/warmup-only source is hidden until its output exists.

## Actual validation

- **Initial source/test head** `194265f168c4741588f33390e4f57931ce5065d8`: [Actions #42477968965](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42477968965): full Vitest **1,586 passed / 1 skipped / 0 failed**, B13 **8/8**, build PASS; TypeScript FAIL because an existing `indicatorAlertSourceParity.test.tsx` component fixture did not supply newly required pane-overlay props.
- **Corrections** `85f9d06bad0fe36a99836f24839ac90271550b11` and `cd66e3d568a05cbc0d9eed73ba7af81a9c5d9f00`: make the new pane props optional with safe defaults, require exact source plot alignment to bar count. No chart calculation change.
- **Corrected code/test CI:** [Actions #42478165740](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42478165740), **SUCCESS**, verified actual GitHub job steps/logs: `npm ci` PASS; `npm test` **236 test files passed / 1 skipped; 1,586 tests passed / 1 skipped / 0 failed**; B13 **8/8**, B05 chaining **14/14**; `npm run typecheck:renderer` PASS; `npm run build:renderer` PASS (Vite 5.37 s).
- **Final-head requirement:** rerun GitHub Actions on this documentation commit and record exact final SHA/run result separately. The corrected run above is not final documentation-head evidence.

## Risks and outstanding manual validation

- Real Windows GUI source-select keyboard/mouse interactions, cross-chart tab isolation, dynamic source removal while settings open, save/reopen with native data and large-history responsiveness not manually tested.
- Additional upstream sources with no currently finite value are intentionally unavailable in the selector; saved invalid references are preserved, not silently repaired.
- Native Tauri/Rust checks, Windows portable build and database operations were not performed. The pre-existing one skipped Vitest remains skipped.

## Rollback and closure gate

Before merge, abandon draft PR #86 without touching `main`. After separately authorized merge, revert only B13 after reviewing newer changes. No data migration to undo. Confirm final-head CI, update issues #42/#28, leave PR draft/unmerged, and only then begin B17.
