# B23 — Truthful Indicator Settings pane-scale status

- **IST timestamp:** 2026-11-08 21:11 IST (UTC+05:30)
- **Active workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform` (GitHub-only)
- **Source authority:** current GitHub `main` `d0ad1d00619f6822366948751d7602b2fe6737ec`
- **Tracking:** [B23 #52](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/52), [master #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #91](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/91)

## Objective / prior issue

The Indicator Settings > Scale tab previously displayed **Automatic** unconditionally, even when the corresponding indicator/price pane had an active manual scale override. Existing chart state `paneScaleOverrides` already controls scale behavior and the pane's ⟲ Fit enablement. The fix is status display only; no scale system or mathematics changes.

## Files inspected

- `src/components/IndicatorSettingsDialog.tsx`: previously hardcoded Scale read-only value
- `src/components/ChartPaneControlsOverlay.tsx`: actual `paneScaleOverrides[indicator.id]` and Fit/reset action
- `src/components/ChartPriceLegendOverlay.tsx`: price overlay settings entry point
- `src/components/ChartCanvas.tsx`: shared `paneScaleOverrides`, engine wiring and both dialog entry points
- `src/engine/types.ts`, `src/store/chartStoreTypes.ts`, `src/features/charts/chartTabStateMutationService.ts`: pane override storage and reset behavior

## Files modified / created

1. **Created** `src/features/charts/indicatorPaneScaleStatusService.ts`: pure resolver: overlay indicator → price-pane override; pane indicator → indicator ID override; returns `automatic` or `manual`.
2. **Modified** `src/components/IndicatorSettingsDialog.tsx`: accept optional current scaleMode and display *Manual override* / *Automatic*, or *Unavailable* if invoked outside chart context. Add read-only guidance to chart axis and existing Fit control.
3. **Modified** `src/components/ChartPaneControlsOverlay.tsx`: pass resolved current pane scale mode to the existing dialog.
4. **Modified** `src/components/ChartPriceLegendOverlay.tsx`: pass resolved price-pane scale mode to the same dialog when available.
5. **Modified** `src/components/ChartCanvas.tsx`: pass existing `paneScaleOverrides` to the price legend; unchanged engine scale wiring.
6. **Created** `src/features/charts/__tests__/indicatorPaneScaleStatusB23.test.tsx`: six focused SSR/state and source-wiring regressions: automatic default, manually overridden pane, price overlay, missing context, actual existing Fit reset and both settings entry points.
7. **Created** `docs/changes/2026-11-08_2111_IST_B23_INDICATOR_PANE_SCALE_STATUS.md`: this record.

## Behavior changed / preserved

- **Changed only:** informational Scale label reflects the pane currently used by the indicator, including price overlays. An isolated dialog without chart scale context no longer falsely assumes Automatic; it shows Unavailable. Users see guidance to existing Fit control.
- **Unchanged:** underlying `paneScaleOverrides` data, manual range values, Fit/reset actions, chart zoom and auto-fit mathematics, rendering, pane ordering, saved sheet/workspace serialization, default indicator parameters, drag/collapse, and settings Save/Cancel.
- No new dependencies or backend/Rust/data modifications.

## Actual CI evidence

Code/tests head `7e557de3cd11687b6d327a6c2ddcd901cb900d61`: [GitHub Actions #42495880917](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42495880917) **SUCCESS**. Actual job output: `npm ci` PASS, **239 Vitest files passed / 1 skipped; 1,605 tests passed / 1 skipped / 0 failures**, new B23 **6/6** PASS; `npm run typecheck:renderer` PASS; `npm run build:renderer` PASS (Vite 5.03s).

**Final-head CI pending:** separately verify documented commit after this change record is committed.

## Risks / limitations / rollback

- **Known batch file overlap:** B14 PR #89 also edits `IndicatorSettingsDialog.tsx`, based on the same original `main` SHA. These PRs must not be merged blindly or assumed conflict-free: reconcile source against the first merged head, run combined full CI, and verify merged tree matches CI-tested integration tree. B21 PR #90 remains independent.
- Status accuracy is determined by currently supplied `paneScaleOverrides`; manual browser checks needed when switching panes/tabs, using Fit and reopening workspace. Tests include SSR and store service; they do not simulate a complete Windows UI interaction.
- Real Windows screenshots (seven themes/axes), native Tauri/Rust, portable Windows build and real DB tests not performed. One pre-existing Vitest skip remains.
- Before merge: close draft PR #91. After separately approved merge, revert only B23 changes after reviewing subsequent commits. No migration required.

## Next checkpoint

After final-head CI, update #52 and #28, leave PRs #89/#90/#91 **draft and unmerged** until separate user batch merge authorization. **No other audit task started.**

## Approved batch merge reconciliation — 2026-11-08 21:25 IST

- User approved sequential merging B14 #89, B21 #90, B23 #91, with exact SHA guards, reconciliation and full combined renderer CI **before** B23 merge.
- B14 merged `6eecab450edb7d07578e792473d97519adc8d6d6`; its final Git tree exactly matched the tested B14 head `e7b6eeb2e8dc1f064fe060f62a877fc69a37d2e1`.
- B21 merged `e45b43299261fe2ca6918aa81f07785d143627d5`; all three B21 file blobs matched the tested B21 head `4a2c1d441c1250538c0ea1f6387633bc8cf2ecfe`.
- **Reconciliation method:** verify and reapply B23's nine original `IndicatorSettingsDialog.tsx` scale-status substitutions to the B14-protected dialog from the updated GitHub `main`. Preserve B14 numeric validation, Save guard and invalid-text recovery. Preserve the five other B23 implementation/test files and originally reviewed content, except add one focused integration test asserting B14 invalid numeric Save prevention and B23 Manual scale status together.
- Rebase B23 draft PR branch onto exact updated `main` `e45b43299261fe2ca6918aa81f07785d143627d5` with a protected expected-old-head branch lease; do not edit GitHub `main` directly.
- **Final integration CI pending** on the newly reconciled B23 PR head and its GitHub synthetic merge. Do not claim success until complete `npm test`, renderer TypeScript typecheck, renderer build and focused suites pass; verify the synthetic merge parents and exact post-merge Git tree equality.
- **Risks/checkpoints unchanged:** actual Windows UI and Fit, Tauri/Rust, portable Windows build, DB and manual acceptance are not covered by Linux renderer CI. Roll back via reverting only approved change commits if subsequently needed; no data migration.
