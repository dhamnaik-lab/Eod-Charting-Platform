# UX audit W4 | Movers And Sidebar

17 November 2026 at 11:52 IST. Worktree base `3950985f7c47bc60ff87728a60245a3cc62bf55d`.

Backups in candidate `backups/` include pre_opencode_changes_20261117_115134_ux_f30_f36_f37. The worktree carries an uncommitted diff; review and reverse the corresponding bounded diff for rollback.

## F-30 | Market Movers Full View drops Volume Surge tab and the entire control bar

src/features/marketMovers/MarketMoversFullView.tsx:245. Full View now offers Volume Surge and exchange selection using existing store/snapshot. Full shared controls (threshold/search/filter parity) remain outstanding.

Changed paths include `src/features/marketMovers/MarketMoversFullView.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f30-after.log [npm.cmd test -- src/features/marketMovers/__tests__; Tests  16 passed (16)].

Disposition is `DEFERRED_WITH_REASON`. Candidate visual acceptance is pending.

## F-36 | Sidebar active panel is ephemeral; collapse state is persisted but panel selection is not

src/store/workspaceStore.ts:63. Stores a validated panel ID with default Symbols and no workspace migration. Existing collapsed and pinned keys remain independent.

Changed paths include `src/store/workspaceStore.ts`, `src/components/Sidebar.tsx`, `src/store/__tests__/workspaceSidebarPanel.test.ts`.

Focused evidence under `tmp/ux-audit-evidence` has f36-after.log [npm.cmd test -- src/store/__tests__/workspaceSidebarPanel.test.ts src/features/watchlists/__tests__/sidebarListWindow.test.ts; Tests  11 passed (11)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-37 | Clicking Market Movers portal controls on document.body slams the sidebar shut

src/RootApp.tsx:355. Main collapse reacts only to actual DOM descendants; React portal mouse events outside main cannot collapse it.

Changed paths include `src/RootApp.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f37-after.log [npm.cmd test -- src/features/marketMovers/__tests__ src/components/__tests__/NativeEditableContextMenu.test.ts; Tests  19 passed (19)] | corrected-build-renderer.log [npm.cmd run build:renderer; Exit code: 0].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.
