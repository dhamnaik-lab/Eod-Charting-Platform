# B16 — Chart-focused D/W/M/Q/Y timeframe shortcuts

- **IST timestamp:** 2026-11-08 21:49 IST (UTC+05:30)
- **Authorized workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform`, GitHub-only; local checkout not accessed
- **Verified GitHub `main` source authority:** `6d7b781f572aa4ff8c1fa8ba1b75c75149fdc024`
- **Tracking:** [B16 issue #45](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/45), [master #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #92](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/92)
- **Approved policy:** D/W/M/Q/Y change timeframe only while the active chart viewport has keyboard focus, not globally.

## Previous defect and objective

RootApp intercepted D/W/M/Q/Y at `window` level for virtually every non-input target, including noneditable dialogs and toolbar controls, while the keyboard-help dialog did not list timeframe shortcuts. Existing chart drawing/zoom/pan shortcuts already require an explicitly focused active chart viewport. The accepted, user-approved correction is to scope timeframe shortcuts identically.

## Inspected files and evidence

`src/RootApp.tsx` (global handler); `src/components/ChartCanvas.tsx` (active chart focus and key dispatch); `src/features/charts/chartKeyboardFocusService.ts` (explicit event-origin guard); `src/components/KeyboardShortcutsDialog.tsx` (help); existing `chartKeyboardFocusService.test.ts`.

## Files modified / created

1. **Modified** `src/RootApp.tsx`: remove only the global timeframe keydown listener, obsolete `setTimeframe` and unused `addToast` selectors; retain the native editable-controls context-menu exclusion and unrelated app structure.
2. **Modified** `src/components/ChartCanvas.tsx`: map five timeframe keys within the existing `handleChartKeyDown`, after its active-chart and explicit viewport focus checks, and only without Ctrl/Meta/Alt. Same `setTimeframe` store action; preserve all other drawing/navigation/zoom key handling.
3. **Modified** `src/components/KeyboardShortcutsDialog.tsx`: document D/W/M/Q/Y under Chart with the focus/editable/dialog restrictions; preserve existing workspace, palette and drawing shortcut help.
4. **Created** `src/features/charts/chartTimeframeShortcutService.ts`: pure D/W/M/Q/Y → timeframe mapping.
5. **Created** `src/features/charts/__tests__/chartTimeframeShortcutB16.test.ts`: six focused mapping, active viewport, child/control, window-hook removal, chart action and help text parity regressions.
6. **Created** `docs/changes/2026-11-08_2149_IST_B16_CHART_FOCUSED_TIMEFRAME_KEYS.md`: this IST change record.

## Behavior change and preservation

- **Changed intentionally:** D/W/M/Q/Y do nothing when the chart viewport is not focused. The window-wide timeframe shortcut intercept is removed. Help reflects actual behavior.
- **Preserved:** existing D/W/M/Q/Y target timeframes, store state/persistence, focusable active chart viewport, chart drawing/arrow/zoom/delete keys, native text editing, menus, palette, tabs, modal controls, theme/layout/chart calculations and save behavior. No new dependencies, data/schema or backend changes.

## Actual validation

[GitHub Actions #42499088053](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42499088053) **SUCCESS** on code/test head `73402ccc3564d9437352c2af46e6e78bb8c96b04`. Actual job logs: `npm ci` PASS; `npm test` **242 test files passed, 1 skipped; 1,622 tests passed, 1 skipped, 0 failed**; new B16 **6/6 PASS**, prior chart focus **5/5 PASS**; `npm run typecheck:renderer` PASS; `npm run build:renderer` PASS (Vite 6.54 s).

**Final-head CI to be verified separately after this documentation commit.** Do not claim it passed until actual run confirms.

## Risks / manual checkpoints / rollback

- Focused-source/test service tests assert mapping and chart handler placement; full renderer suite passes. They do not simulate actual Windows keyboard focus transitions, noneditable floating dialogs, browser/SR behavior, or chart drag/re-focus. Manual acceptance still needed across chart focus and editability transitions.
- No Windows portable build, Tauri/Rust check or database access performed. One pre-existing Vitest skip remains.
- Before merge: close draft PR #92; after separate approved merge, revert B16 only after checking subsequent source. No data migration.

**Next step:** verify final documented-head CI, update issue #45 and master #28, keep PR unmerged. Only then start B22 measurement on the original verified `main`.
