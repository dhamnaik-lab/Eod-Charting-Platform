# F-52 — Tiled chart activation preserves visible layout

- **Timestamp (IST):** 2026-11-15 22:40 (UTC+05:30)
- **Workstream:** EOD Charting Platform, `E:\\TA Projects\\EOD Charting Platform`
- **Repository:** `dhamnaik-lab/Eod-Charting-Platform`
- **Source authority:** `main` commit `ca1cd936350faaa2e8eb23ea6d1de08c0dd979ae`
- **Implementation branch:** `fix/f52-tile-activation-20261115`
- **Audit reference:** 2026-11-15 Deep Review & UX Audit, finding F-52

## Objective

Prevent the active tiled chart workspace from reverting to the single-chart layout when an operator clicks an inactive tile.

## Previous limitation and reproduction

`RootApp.tsx` derives the visible layout from `activeTab.layoutMode`. New chart tabs initialize `layoutMode: 'single'`. The existing tile capture handler called `activateChartTab(tab.id)` without transferring the current tile layout. Selecting a tile whose saved mode was `single` therefore switched the root render to the single-chart branch.

This is a source-level reproduction of the state transition, not a recorded Windows visual reproduction.

## Files changed

1. `src/RootApp.tsx` — tile activation supplies the visible layout mode.
2. `src/features/charts/chartTabSessionController.ts` — optionally transfers the provided tile layout to the selected tab in the same store update as activation.
3. `src/store/chartStoreTypes.ts` — optional tile layout argument on the existing chart activation action.
4. `src/features/charts/__tests__/chartTileActivationLayoutF52.test.ts` — focused regressions for four tile modes, ordinary tab switching, duplicate tile-header activation, unknown tab and data hydration.
5. This change record.

## Final implementation

The tiled-grid click handler calls `activateChartTab(tab.id, layoutMode)`. The session controller copies that layout to the selected tab **only when an override was explicitly supplied**. The existing no-override call continues to activate a tab without altering any saved layout mode. No new workspace state, storage format or dependency is introduced.

## Accepted behaviour preserved

- Ordinary chart-tab navigation reads each tab's existing saved layout mode.
- Explicit layout selection continues to update only the active tab.
- Chart-tab creation, duplication, closing, saved sheets and workspace persistence remain unchanged.
- Existing activation UI reset and instrument hydration paths remain in place.
- No database, Rust backend, packaging scripts or source-control settings were changed.
- Other audit findings are out of scope.

## Validation commands and actual results

| Check | Command or evidence | Actual result |
| --- | --- | --- |
| GitHub source authority | Connected repository metadata and latest commit search | Confirmed `main` source authority at `ca1cd936...` before implementation |
| Focused Vitest | `npm test -- src/features/charts/__tests__/chartTileActivationLayoutF52.test.ts` | **PASS within CI full suite:** 8 F-52 tests passed; focused command not separately executed |
| Related chart regressions | `npm test -- src/features/charts/__tests__/chartRequestConsistency.test.ts` | **PASS within CI full suite**; no separate focused command executed |
| Renderer typecheck | `npm run typecheck:renderer` | **PASS**, GitHub Renderer CI run 43739742067 |
| Renderer build | `npm run build:renderer` | **PASS**, Vite built in 5.41 seconds, CI run 43739742067 |
| Broader regression | `npm test` | **PASS**, 260 test files passed, 1 skipped; 1,801 tests passed, 1 skipped (CI run 43739742067) |
| Windows native/portable | `npm run tauri:portable:win` plus manual tile-selection checkpoint | **Not executed**; requires authorized Windows environment |
| Remote branch/source diff | GitHub compare of baseline to branch | **PASS:** 5 changed files (3 production, 1 test, 1 documentation), ahead by 5 baseline commits, behind 0 when checked |

GitHub Actions evidence: [Renderer CI run 43739742067](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43739742067), run #108, **completed successfully** for the production/test source at commit `1f656dfb41c5478d20592acc7f8ea4585bd2654f`. The subsequent change-record-only update does not alter application source or test code. No Windows/native/portable build or manual visual acceptance has been performed.

## Risks / limitations

- Tile activation now persists the current workspace tile mode into the selected tab; this is necessary for consistent tile rendering but intentionally changes that tab's saved layout mode.
- Selecting a tab through the ordinary chart tab strip still restores that tab's original saved mode, including `single`. This is **deliberately preserved** outside the F-52 tile-click scope.
- The tile header issues an existing second activation on click bubbling. A focused regression covers the layout staying intact after both calls; native UI acceptance remains pending.
- GitHub-only changes must not be mistaken for a pulled or validated Windows local checkout.

## Rollback

Do not merge this branch if the regression checks or Windows visual checkpoint fail. Remove the optional tile-mode activation change from the three production files and the focused test, restoring the exact source content from baseline commit `ca1cd936350faaa2e8eb23ea6d1de08c0dd979ae`. Preserve unrelated changes and the audit record separately.

## Evidence

- Baseline: `ca1cd936350faaa2e8eb23ea6d1de08c0dd979ae`
- Branch: `fix/f52-tile-activation-20261115`
- Connected GitHub source files and commit history; additional CI and Windows evidence pending.
