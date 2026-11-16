# Trial — Workspace-level Auto-Tile with six visible charts

- **IST timestamp:** 2026-11-16 14:16:23 (UTC+05:30)
- **Active workstream:** EOD Charting Platform
- **Authorized Windows root:** `E:\TA Projects\EOD Charting Platform`
- **Source:** draft integration PR #111 at `cc5709a8344bab7b8f79e43fc32d59b57368462e`
- **Trial branch:** `trial/f52-workspace-auto-tile-six-20261116`
- **GitHub main:** remains unchanged

## Objective / previous defect
The previous layout derived from the active chart's `layoutMode`, so activating a chart or opening a new tab could collapse Auto-Tile into Single. Four charts could use an unbalanced three-plus-one arrangement. Ordinary clicks should never maximize a chart.

## Files changed / final implementation
- `src/RootApp.tsx`: workspace-owned mode, capped visible tiles, width-responsive geometry and explicit maximized header.
- `src/components/TileHeader.tsx`: explicit Maximize/Restore and Close controls; clicking the chart or header activates only.
- `src/features/charts/chartAutoTileLayout.ts`: pure visible-chart selector and balanced layouts 1, 2, 3, 2×2, 3+2, 3×2.
- `src/features/charts/chartTabSessionController.ts`, `src/store/chartStore.ts`, `src/store/chartStoreTypes.ts`: independent workspace layout and temporary maximized chart ID.
- `src/features/workspace/workspacePersistence.ts`, `src/features/workspace/chartSnapshotHydrationService.ts`: v1 backward-compatible workspace layout persistence/restoration, preserving legacy tab and sheet fields.
- `src/features/workspace/chartRuntimeController.ts`, `src-tauri-shell/src/main.rs`: native menu state follows workspace mode, native Layout menu offers Single and Auto-Tile.
- `src/features/charts/__tests__/chartTileActivationLayoutF52.test.ts`, `src/features/charts/__tests__/chartAutoTileLayout.test.ts`, `src/features/workspace/__tests__/workspacePersistence.test.ts`: focused layout/legacy regression tests.
- This change record.

## Behavior changed
Auto-Tile is independent of chart selection; tiling is automatically recomputed as tabs open/close or chart-area width changes. Up to six tabs are displayed in the grid while all tabs remain open; when the active chart lies beyond the initial six, it replaces the sixth visible tile. Explicit Maximize/Restore temporarily shows a chart full-area and returns to the tiled layout.

## Behavior preserved
Existing instrument data, chart tab IDs/order, volume legend, chart settings, CA/identity baseline corrections, saved sheets/chart content, database routines, and other PR #111 behavior. Legacy per-tab layout values remain in persisted version-1 workspaces for compatibility, but the new workspace-owned mode controls the view.

## Validation commands and results
- Exact source baseline verified against GitHub PR #111 before patch generation.
- GitHub Renderer CI: **PASS**, [run #43834341709](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43834341709), at commit `b6644b0f77d3828fc9b5f000d425818437080f42`. `npm test`: **1,861 passed, 1 skipped, 0 failed** (268 test files passed, 1 skipped), including new layout/regression tests. `npm run typecheck:renderer`: **PASS**. `npm run build:renderer`: **PASS**, Vite built in **6.81 s**. Separate focused CLI run not executed; new focused suites participated in full Vitest. Original code/test commit `590e3e2a9b49b3b2a4416108448f0c9c567fbaf1`. This follow-up updates documentation only.
- Rust/Tauri checks: **NOT RUN** in GitHub renderer-only CI. Real Windows native build remains required.
- Native Windows portable build and actual-database visual smoke test: **NOT RUN**. User will perform after Codex fetches trial.
- No Windows Sandbox, synthetic native test database or production DB access was used.

## Risks / limitations
Native Rust menu change needs real Windows build verification. Legacy sheet modes are retained but cannot override the workspace arrangement. Layout max state is temporary and not persisted. Older tile variants remain accepted at the command/API boundary but normalize to Auto-Tile. Replacing the sixth visible tile when there are more than six tabs is a deliberate behavior requiring operator acceptance.

## Rollback
Keep PR #111 at `cc5709a8344bab7b8f79e43fc32d59b57368462e` unchanged. If trial fails, do not merge it; return to the existing integration branch and preserve saved database/workspace backup. No database migration is run.

## Next step
Run combined renderer CI and the actual portable Windows build/visual smoke test after source fetch. Merge only with separate user approval.
