# B26 — Respect OS reduced-motion preference for Sidebar hover fades

- **IST timestamp:** 2026-11-08 22:05 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform, authorized `E:\TA Projects\EOD Charting Platform` (GitHub-only; no local checkout access)
- **Current main baseline:** `6d7b781f572aa4ff8c1fa8ba1b75c75149fdc024`
- **Tracking:** [B26 issue #55](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/55), [master #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #94](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/94)

## Objective / original defect

The app did not honor `prefers-reduced-motion: reduce` for its global Sidebar background hover transitions, even though reduced motion can be requested through the OS accessibility settings. User authorized a **minimal CSS-only change**. Typography floors, seven themes, layout/density, chart pan/zoom animations, progress updates and broader UI design are outside this bounded task.

## Files inspected

- `src/styles/global.css`: two `transition: background-color 0.1s ease` declarations on `.sidebar-row-shell` and `.sidebar-indicator-row`; no existing `prefers-reduced-motion` rule and no global keyframe animations.
- `src/components/StatusBar.tsx`: progress text and live IST clock; preserve their feedback.
- `src/components/SettingsDialog.tsx`: standard settings and progress states; leave unchanged.
- `src/features/app/__tests__/themeContrast.test.ts`: seven-theme contrast tests.

## Files modified / created

1. **Modified** `src/styles/global.css`: one narrowly scoped `@media (prefers-reduced-motion: reduce)` block targeting **only the two Sidebar hover-transition selectors**, setting `transition: none`. Ordinary media state continues to use the original 100 ms fade, colors and hover appearance.
2. **Created** `src/features/app/__tests__/reducedMotionB26.test.ts`: four focused source-level tests for media-query scoping, normal hover preservation, noninterference with progress and dimensions, and seven theme selectors.
3. **Created** `docs/changes/2026-11-08_2205_IST_B26_REDUCED_MOTION_SIDEBAR_CSS.md`: this IST change record.

## Exact change and preservation

- Under OS reduced motion, Sidebar row hover background color changes immediately; all other states and appearance remain unchanged.
- Under normal OS motion preference, both existing 100 ms transitions remain.
- No universal `* { animation: none !important; }` rule, no typography or layout change, no plugin worker or data access, no new dependencies, no runtime preference storage. Existing seven themes, focus rings, StatusBar progress feedback and chart geometry are preserved.

## Actual validation evidence

Initial source/test head `76fd80656f1325263085d0fde0038965c5410e42`, [GitHub Actions #42500511382](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42500511382) **SUCCESS**: `npm ci` PASS, `npm test` **242 test files passed / one skipped; 1,620 tests passed / one skipped / 0 failures**; B26 **4/4** and theme contrast **9/9**; `npm run typecheck:renderer` PASS; `npm run build:renderer` PASS (Vite 5.22 seconds).

**Final-head validation:** separately verify full CI on the new documentation-commit SHA after this file is created.

## Limitations / manual checkpoints

- Automated tests inspect CSS source; they do not simulate OS reduced-motion flag inside actual Chromium/Tauri. Real Windows UI visual acceptance under motion normal/reduced, all seven themes and 100/125/150% DPI remains to be performed.
- Component-local inline animated behavior and other stylesheets are outside the deliberately narrow requested change. No native Tauri/Rust, Windows portable build, DB test or screenshots performed.
- Existing one skipped Vitest remains skipped. No actual user preference toggle was installed.
- **Rollback:** close draft PR #94 before merge; if later merged after separate authorization, revert only this scoped CSS/test/doc change; no schema/data migration needed.

**Next gate:** verify final documentation-head CI, update issue #55/master #28, leave #94 draft/unmerged. End the approved B16+B22+B26 batch without starting B18/B24/B25.
