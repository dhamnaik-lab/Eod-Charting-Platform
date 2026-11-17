# UX audit W5 | Commands And Shortcuts

17 November 2026 at 11:55 IST. Worktree base `3950985f7c47bc60ff87728a60245a3cc62bf55d`.

Backups in candidate `backups/` include pre_opencode_changes_20261117_115450_ux_f27_f28_f29_f67. The worktree carries an uncommitted diff; review and reverse the corresponding bounded diff for rollback.

## F-27 | Command palette omits database, chart and layout commands — it is not a superset of the menu

src/components/CommandPalette.tsx:43. Added direct workspace, chart, settings and database actions. Full command parity and frecency remain tied to F-22.

Changed paths include `src/components/CommandPalette.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f27-f28-f29-f67-after.log [npm.cmd test -- src/components/__tests__/toolbarToggleStatesB17.test.tsx src/features/charts/__tests__/chartKeyboardFocusService.test.ts src/components/__tests__/ChartPaneControlsOverlay.test.tsx; Tests  17 passed (17)].

Disposition is `DEFERRED_WITH_REASON`. Candidate visual acceptance is pending.

## F-28 | Fullscreen hides the menu with no in-app replacement

src/components/Toolbar.tsx:378. Persistent in-app Commands launcher provides an alternative route when the native menu is unavailable. The themed menu proposal is tracked under F-22.

Changed paths include `src/components/Toolbar.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f27-f28-f29-f67-after.log [npm.cmd test -- src/components/__tests__/toolbarToggleStatesB17.test.tsx src/features/charts/__tests__/chartKeyboardFocusService.test.ts src/components/__tests__/ChartPaneControlsOverlay.test.tsx; Tests  17 passed (17)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-29 | Toolbar: dead setLayoutMode , hidden Dividend/Rights gear flags, ~150k-step pattern scan on the main thread

src/components/Toolbar.tsx:148. Removed unused layout subscription. The active-chart scan remains synchronous and shares core scanner logic. Adjustment controls remain in Chart Settings; worker design tracked under F-75.

Changed paths include `src/components/Toolbar.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f27-f28-f29-f67-after.log [npm.cmd test -- src/components/__tests__/toolbarToggleStatesB17.test.tsx src/features/charts/__tests__/chartKeyboardFocusService.test.ts src/components/__tests__/ChartPaneControlsOverlay.test.tsx; Tests  17 passed (17)].

Disposition is `DEFERRED_WITH_REASON`. Candidate visual acceptance is pending.

## F-67 | Keyboard Shortcuts dialog omits half the real bindings (window, tab, Alt+S, layout)

src/components/KeyboardShortcutsDialog.tsx:103. Added verified tab, window, pane and picker bindings. No current Alt+S binding found. Registry-driven discovery remains with F-22.

Changed paths include `src/components/KeyboardShortcutsDialog.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f27-f28-f29-f67-after.log [npm.cmd test -- src/components/__tests__/toolbarToggleStatesB17.test.tsx src/features/charts/__tests__/chartKeyboardFocusService.test.ts src/components/__tests__/ChartPaneControlsOverlay.test.tsx; Tests  17 passed (17)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.
