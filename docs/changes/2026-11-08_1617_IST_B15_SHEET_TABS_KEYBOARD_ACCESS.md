# B15 — Keyboard-accessible SheetTabs

- **Timestamp:** 2026-11-08 16:17 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform` (GitHub-only)
- **Source authority:** GitHub `main` `ed8cd93e614aaff864d12f5da0aab3742eeb8745`
- **Tracking:** [B15 #44](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/44), [master #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #84](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/84)

## Objective / previous defect

The existing sheet selectors were pointer-clickable `div` elements without keyboard focus or Enter/Space activation. Inner sheet Delete buttons were already separately clickable. Accepted chart-tab activation, selected sheet data, double-click rename and create/delete dialogs must be preserved.

## Files modified and created

1. `src/components/SheetTabs.tsx`: Add `role="button"`, `tabIndex={0}`, accessible label and `aria-pressed` indicating selected sheet. Enter/Space invoke the **same** selection callback as pointer clicks and call `preventDefault` to avoid page scroll. The key handler ignores bubbled events originating from the nested Delete button. Existing click, double-click rename, create/delete buttons and state operations are left in place.
2. `src/styles/global.css`: Add scoped `.sheet-tab-activation:focus-visible` ring using existing `--focus-ring`/accent theme token, with inset outline to remain visible within clipped tab strip. No other global styling changed.
3. `src/components/__tests__/sheetTabsKeyboardB15.test.tsx`: 11 generated tests covering SSR focus/accessible selection state, Enter/Space, other keys, nested button suppression, existing rename/create/delete affordances, and CSS focus ring.
4. `src/features/app/__tests__/themeContrast.test.ts`: Broaden outdated exact focus-ring consumer count to minimum baseline count; addition of one legitimate sheet focus selector must not fail theme coverage. Contrast thresholds, palette assertions and theme identities unchanged.
5. `docs/changes/2026-11-08_1617_IST_B15_SHEET_TABS_KEYBOARD_ACCESS.md`: this IST change record.

## Exact behavior changed / preserved

- **Changed:** Keyboard users can tab to sheet-selection wrappers and activate them with Enter/Space; screen readers can determine the active sheet; keyboard focus is visibly outlined.
- **Preserved:** Pointer clicks, separate Delete button action, double-click sheet rename, modal Save/Cancel semantics, chart-tab activation, sheet load sequencing, in-memory and persisted sheet data, existing tab geometry, themes, and chart/indicator numerical behavior.
- No new dependencies, backend, database calls, Rust/native changes, or temp/build files in source directories.

## Actual validation evidence

- **Initial code/test head:** `ab4e6c4817b71cd5916a2b3ddb20c760922cf3ad`, [CI run #42472622638](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42472622638): Vitest **FAIL** (1 failure, 1,564 passes, 1 skip); TypeScript and build PASS. New 11 B15 tests passed. Existing `themeContrast.test.ts` assumed exactly 4 focus-ring CSS occurrences; the new valid scoped focus rule increased this count to 5. This was not a runtime bug.
- **Focused test maintenance:** `85744ff516e7fb1c8dbf39bd722650501997e002` changes only the brittle count assertion to require **at least 4**, leaving all seven-theme contrast checks intact.
- **Corrected code/test head:** [CI #42472782154](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42472782154) **SUCCESS**, confirmed job steps and logs: `npm ci` PASS; `npm test` PASS, **233 test files passed / 1 skipped, 1,565 tests passed / 1 skipped / 0 failures**; B15 focused **11/11**, theme contrast **9/9**, chart sheet workspace service **3/3**; `npm run typecheck:renderer` PASS; `npm run build:renderer` PASS (Vite 5.29 seconds).
- **Final-head CI pending:** recheck GitHub Actions against the documentation-commit SHA separately.

## Risks / manual checkpoints

- Keyboard behavior is covered by direct event-handler unit tests plus SSR semantics and CSS source checks. A real browser/Windows Tab → Enter/Space → Delete → double-click test, focus visibility across all seven themes and saved-sheet reopen must still be performed manually. The tests do not claim full browser DOM user-event simulation.
- Existing one skipped Vitest remains skipped; no tests removed or disabled.
- Source-only GitHub edit; local checkout, DB and native/portable build not accessed.

## Rollback

Before merge, abandon draft PR #84 and leave `main` unchanged. If merged later under separate approval, revert only the B15 commit after checking intervening changes. No sheet data migration involved.

## Next step

Verify full CI on documented PR head, update B15 and master register, leave draft PR unmerged. Then start B20 as the next independent bounded task.
