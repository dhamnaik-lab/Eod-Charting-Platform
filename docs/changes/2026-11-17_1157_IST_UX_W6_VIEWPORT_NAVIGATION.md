# UX audit W6 | Viewport Navigation

17 November 2026 at 11:57 IST. Worktree base `3950985f7c47bc60ff87728a60245a3cc62bf55d`.

Backups in candidate `backups/` include pre_opencode_changes_20261117_115646_ux_f42_f43. The worktree carries an uncommitted diff; review and reverse the corresponding bounded diff for rollback.

## F-42 | Wheel zoom ignores the cursor pivot — zoom anchors to the right edge, not the mouse

src/engine/ChartEngine.ts:980. Wheel cursor retains the same logical bar pixel until viewport limits clamp. Button/key zoom still anchors the right edge.

Changed paths include `src/engine/ChartEngine.ts`, `src/engine/ScaleManager.ts`, `src/engine/__tests__/ScaleManager.test.ts`.

Focused evidence under `tmp/ux-audit-evidence` has f42-before.log [npm.cmd test -- src/engine/__tests__/ScaleManager.test.ts; Tests  1 failed | 8 passed (9)] | f42-f43-after.log [npm.cmd test -- src/engine/__tests__/ScaleManager.test.ts src/engine/__tests__/ChartLayerPartition.test.ts src/engine/__tests__/auditFrameScheduling.test.ts; Tests  14 passed (14)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-43 | Kinetic scroll computes inertia against a stale axis width and wrong pane IDs

src/engine/ChartEngine.ts:4706. Inertia consumes the same cached-or-current overlay render scale as pointer interactions and no longer substitutes pane override keys for pane IDs.

Changed paths include `src/engine/ChartEngine.ts`.

Focused evidence under `tmp/ux-audit-evidence` has f42-f43-after.log [npm.cmd test -- src/engine/__tests__/ScaleManager.test.ts src/engine/__tests__/ChartLayerPartition.test.ts src/engine/__tests__/auditFrameScheduling.test.ts; Tests  14 passed (14)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.
