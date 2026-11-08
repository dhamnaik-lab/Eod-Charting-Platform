# B17 — Truthful toolbar and drawing-dock toggle accessibility

- **Timestamp:** 2026-11-08 17:46 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform` (GitHub-only)
- **Current source authority:** GitHub `main` `c6646d0a8d2be8c7c3bc5cd9496c0b38dd0e1295`
- **Tracking:** [B17 issue #46](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/46), [master #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #87](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/87)
- **Scope:** Only B17; B13 separately verified/unmerged, B19 not yet started. No merge authorization.

## Objective / previous defect

Persistent chart toolbar modes such as Volume, capital-adjustment (Adj), Candles and chart-pattern scanning lacked true programmatic on/off state. The Signals button opens a settings dialog rather than toggling signals, yet its active styling could imply a pressed toggle. The screenshot menu opener lacked expanded state. The drawing tool dock assigned `aria-pressed={false}` to one-shot actions such as Delete/Undo, rather than reserving pressed semantics for selectable modes/toggles.

## Source files inspected

`src/components/Toolbar.tsx`, `src/components/ChartToolDock.tsx`, `src/components/__tests__/ToolbarAdjustedControls.test.tsx`, chart/UI store toggle state and button handlers.

## Files modified or created

1. **Modified** `src/components/Toolbar.tsx`: `aria-pressed` reflects current Volume, Adj requested adjustment mode, Candles PATTERN presence, and active chart-pattern scan state. Signals now uses `aria-haspopup="dialog"` and `aria-expanded` derived from the actual settings-dialog flag, **not** `aria-pressed`; screenshot menu uses `aria-expanded` derived from its actual open state. Existing onClick/title/style/text untouched.
2. **Modified** `src/components/ChartToolDock.tsx`: `ToolButton` exposes pressed state only when `toggle` is explicitly set. Direct drawing-mode selectors, drawing lock, Favorites toolbar, and Magnet are true toggles; one-shot Properties/Undo/Remove/Delete/Clear/Reset actions keep native button semantics without misleading pressed state. Existing grouped tools retain pressed/expanded semantics. Dock expand/collapse gets truthful `aria-expanded` and accessible names. No visual layout/redesign.
3. **Created** `src/components/__tests__/toolbarToggleStatesB17.test.tsx`: seven SSR state tests for both Volume/Adj values, Candles presence, Signals dialog open/closed, screenshot expansion, chart-pattern active state, drawing dock toggles versus actions, and keyboard-readable dock controls. Controlled mock state ensures SSR tests exercise requested combinations.
4. **Created** `docs/changes/2026-11-08_1746_IST_B17_TOOLBAR_TOGGLE_ACCESSIBILITY.md`: maintained IST change record.

## Behavior changed / preserved

- **Changed:** Assistive technologies can query truthful pressed/expanded states. Toolbar and drawing-dock visual layout, exact `Adj` label/width, all CSS/theme styling, callbacks, scan/detection logic, chart and pattern data, and persisted settings remain unchanged.
- **Preserved:** chart state and canvas computation, existing modes, selected drawing behavior, chart scan and signal dialogs, custom formula, compare overlays, local storage and normal screenshots. No dependencies, backend, native code, database or packaging changes.

## Actual CI/testing evidence

- **First code/tests head** `af91b0131314a9b2469ab2d4e5db25a94b64a9e8`: [CI #42478974214](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42478974214), full Vitest FAIL with 4 new SSR fixture assertions (1,581 passed / 1 skipped), TypeScript FAIL from fixture `null` drawing-tool type. SSR uses Zustand initial snapshot, so mutating live Zustand state does not affect its rendered output; production component changes were not implicated. Vite renderer build PASSED.
- **Focused test correction** `ae024904d670a1f93c215098c6dddf6602683ffd`: replace incorrect SSR state manipulation with deterministic module selector mocks and valid fixture types. No production code changes.
- **Corrected code/tests CI** [#42479231768](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42479231768) **SUCCESS** from actual GitHub job steps/logs: `npm ci` PASS; full `npm test` **236 test files passed / 1 skipped, 1,585 tests passed / 1 skipped / 0 failed**; B17 **7/7**, prior adjusted-toolbar suite **2/2**, `npm run typecheck:renderer` PASS, `npm run build:renderer` PASS (Vite 4.46 seconds).
- **Final-head gate:** Re-run CI on the documentation commit below; prior passing run is not sufficient by itself.

## Risks and outstanding manual acceptance

- SSR accessibility tests verify native markup and state mapping; real Windows keyboard/screen-reader navigation and seven-theme visual spot checks are not performed. Dynamic state changes in a mounted browser session are not separately proven by SSR.
- No Tauri/Rust checks, Windows portable build, or real market data/database operations. The baseline single skipped Vitest remains.
- Drawing dock selected-state semantics remain unchanged for group-mode buttons; only one-shot action `aria-pressed` removal is intentional.

## Rollback

Before merge, abandon draft PR #87; `main` is untouched. If merged under separate approval, revert only B17 after confirming intervening changes. No database or storage migration required.

## Next checkpoint

Verify full renderer CI at final documented PR head, update issues #46 and #28, keep PR draft/unmerged, proceed to B19 independently. No B13 or B19 source may be merged in this task.
