# B19 — Sidebar region rendering error containment and recovery

- **IST timestamp:** 2026-11-08 18:00 IST (UTC+05:30)
- **Authorized workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform` (GitHub-only; local checkout and database not accessed)
- **Verified source authority:** GitHub `main` `c6646d0a8d2be8c7c3bc5cd9496c0b38dd0e1295`
- **Tracking:** [B19 issue #48](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/48), [master register #28](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/28), [draft PR #88](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/88)
- **Batch:** B13 and B17 already implemented in independently verified, still-unmerged draft PRs #86/#87. B19 is one independent bounded task; **no merges authorized**.

## Objective / original defect

A Sidebar React render exception could unmount the application region and chart interface instead of being handled locally. The existing `ErrorBoundary` class already catches render errors and offers Retry, but its normal fallback is a centered, fixed overlay designed for tools. That presentation would obstruct charts and not reserve Sidebar layout space. The fix is to isolate Sidebar without wrapping the chart, Toolbar or resize handle.

## Files inspected

- `src/RootApp.tsx`: Sidebar element, parent flex layout, sidebar collapse/resize controls, other app regions and existing CommandPalette boundary.
- `src/components/ErrorBoundary.tsx`: existing render error capture, logging, default fixed fallback and reset behavior.
- `src/components/LazyToolBoundary.tsx`: reload-only fallback for cached dynamic import failures; intentionally left unchanged.
- `src/components/Sidebar.tsx`: collapsed 34px rail, width/resize layout and pointer/keyboard handlers.
- `src/features/app/__tests__/lazyToolBoundary.test.tsx`: existing tool fallback contracts; regression suite retained.

## Files modified / created

1. **Modified** `src/components/ErrorBoundary.tsx`: add an optional `renderFallback(retry, error)` callback used only by opt-in consumers. Its Retry closure resets `hasError` and `error`. The existing static fallback and fixed overlay default remain unchanged.
2. **Created** `src/components/SidebarRegionBoundary.tsx`: wrap Sidebar in the shared boundary and provide a local, accessible `role="alert"` panel with **Retry Sidebar**. On success, return children directly with no additional DOM wrapper. On failure, reserve Sidebar width (minimum 220px for an actionable collapsed fallback) and leave other regions visible.
3. **Modified** `src/RootApp.tsx`: wrap only `<Sidebar />` with `<SidebarRegionBoundary width={sidebarWidth} collapsed={sidebarCollapsed}>`. Existing resize handle, main, toolbar, chart tiles, sheet tabs, menus and actions remain outside the boundary.
4. **Created** `src/features/app/__tests__/sidebarRegionBoundaryB19.test.tsx`: six focused SSR/error-state/structure cases, including no-wrapper success, accessible inline failure, collapsed Retry usability, error-state reset contract, preservation of default ErrorBoundary overlay, and root region isolation.
5. **Created** `docs/changes/2026-11-08_1800_IST_B19_SIDEBAR_REGION_ERROR_RECOVERY.md`: this IST change record.

## Exact behavior change / preservation

- **Changed:** a Sidebar *render-time* exception can display a local recovery panel instead of propagating through the chart workspace. The user can retry rendering Sidebar without reloading the entire application. In a collapsed failure the fallback expands to minimum width so Retry stays usable.
- **Preserved:** successful Sidebar DOM and dimensions (no new wrapper), normal collapse/pin/resize, chart and toolbar rendering, chart gestures, data, selections, saved sheets, CommandPalette fallback, existing lazy-tool reload behavior, all calculations and settings. The default ErrorBoundary fallback remains unchanged for every other consumer.
- **Scope limit:** React error boundaries do **not** catch exceptions in asynchronous callbacks or event handlers. No change is made to async error handling, ChartCanvas boundary, Toolbar boundary, DB, Rust, packaging or dependencies.

## Validation performed — actual command/log evidence

Code and focused regression commit `8cb94604eb90c056e314b62394ce7d0f5619c838`: [GitHub Actions #42480431030](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42480431030) **SUCCESS**, confirmed through GitHub jobs and full CI output:
- `npm ci`: PASS.
- `npm test`: PASS — **236 test files passed, 1 skipped; 1,584 tests passed, 1 skipped, 0 failed**.
- New B19 unit/SSR suite **6/6 PASS**; existing lazy-tool boundary suite **5/5 PASS**.
- `npm run typecheck:renderer`: PASS.
- `npm run build:renderer`: PASS, Vite build completed in 5.15 seconds.

**Final-head CI required:** run and independently verify again after this documentation-commit SHA; do not extrapolate the above run.

## Risks / limitations / validation not performed

- Tests simulate `ErrorBoundary.getDerivedStateFromError`, callback reset, fallback markup, RootApp structural placement and existing lazy boundary contracts. The test runner is Node SSR; it does **not** mount a real DOM and deliberately throw a live Sidebar child under React's browser reconciliation. That requires Windows/manual UI acceptance, including Sidebar Retry recovery with chart and Toolbar remaining interactive.
- No real Windows keyboard/mouse/screen-reader/theme checks, native Tauri/Rust check, portable Windows package or database test executed. One pre-existing Vitest skip remains; no tests disabled.
- If the child repeatedly throws, the Retry attempt may fail again; the error is still isolated. No error callback automatically suppresses or alters chart state.

## Rollback

Before merge: close draft PR #88 without integrating. After separate user-approved merge: revert only B19 merge commit after reviewing intervening changes. No schema or data migration involved.

## Required closure steps

Verify full CI on final documented PR head, confirm B13/B17/B19 changed-file sets are independent, update issue #48 and master register #28, and leave all three PRs draft/unmerged until **separate batch merge authorization**. No unrelated audit task to start.

## B13+B17+B19 combined integration checkpoint — 2026-11-08 19:04 IST

- User explicitly approved merging the independent B13, B17, B19 PRs sequentially with an integration CI gate before B19.
- B13 PR #86 was merged at `c7e2f42cb8d7f00fdf512063000ed68948947aa8`, verifying identical Git tree to its original tested PR head.
- B17 PR #87 was merged at `53110f820d806fd89265ae5b10045f16be193024`, verifying all four changed blobs identical to its original tested PR head.
- This documentation-only commit on B19 is deliberately intended to retrigger the existing GitHub `pull_request` renderer CI against updated `main` `53110f820d806fd89265ae5b10045f16be193024`. The workflow tests the combined GitHub synthetic merge of all three tasks.
- **Integration result at this checkpoint: pending.** Before B19 merge, verify actual final CI success for full Vitest, TypeScript and Vite build; the synthetic merge's first parent must equal updated main and second parent must equal final B19 head. After squash merge, verify final `main` Git tree equals the synthetic tested merge tree. No CI result is assumed here.
