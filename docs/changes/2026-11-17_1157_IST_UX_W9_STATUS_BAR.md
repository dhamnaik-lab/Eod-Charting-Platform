# UX audit W9 | Status Bar

17 November 2026 at 11:57 IST. Worktree base `3950985f7c47bc60ff87728a60245a3cc62bf55d`.

Backups in candidate `backups/` include pre_opencode_changes_20261117_115728_ux_f68_f72. The worktree carries an uncommitted diff; review and reverse the corresponding bounded diff for rollback.

## F-68 | Status bar re-renders every second with literal hex colours — battery and noise

src/components/StatusBar.tsx:90. Clock ticks isolated to a child and timezone/cadence preserved. Transition warning dot uses a theme token.

Changed paths include `src/components/StatusBar.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f68-after.log [npm.cmd test -- src/components/__tests__/StatusBarIstClock.test.ts src/components/__tests__/StatusBarWorkspaceAutosaveError.test.tsx src/features/app/__tests__/reducedMotionB26.test.ts; Tests  9 passed (9)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.
