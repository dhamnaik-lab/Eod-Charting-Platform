# PR #116 independent-audit corrections

17 November 2026, 13:23 IST. Candidate branch `codex/ux-audit-completion-20261117`, published input `a40bf6142f00cf0ce724cad2e98172b252595691`, base `3950985f7c47bc60ff87728a60245a3cc62bf55d`.

## Objective and result

- **IA-01 / F-05.** Verified that ChartEngine compacts large signed volume-derived labels and Renderer accepts the pane tick formatter. ChartEngine still computes one axis width from price and expanded indicator panes. The compact formatting remains in place. F-05 is partially resolved and its remaining geometry work is recorded as `ARCHITECTURE_APPROVAL_PENDING`. A per-pane design must account for aligned plot regions, hit testing, scale interactions, crosshair, screenshots, and resizing.
- **IA-02 / F-10.** The on-screen overlay previously rendered all study and compare items after export support expanded the dataset. It now slices the shared item list to the accepted five and counts omitted items. The full snapshot sent to the screenshot renderer, its pane-capacity limit, and study actions are preserved.
- **IA-03 / F-37.** Sidebar is a React sibling of main. The Market Movers filters and context menu mount in document.body and retain Sidebar ancestry for React events. Mounted fixture evidence covers editing filters, Cancel, Apply, context-menu selection and a true click in main. The unpinned sidebar stayed open for portal events and collapsed for the main click. RootApp, Sidebar and MarketMoversPanel needed no application change.
- **IA-04 / F-43.** Kept kinetic scrolling. Clean cached state can supply the scale; an invalidated or size-mismatched cache can rebuild render state and remeasure labels on the animation path. Actual frame time on long history remains pending and is on the operator checklist.

The [final report](../audits/2026-11-17-ux-audit-completion/FINAL_REPORT.md) records the 76-item disposition totals, source hashes, portable hashes and operator checklist. The pasted findings were used because the standalone audit reference was unavailable in the checked paths.

## Files and behavior

- Changed `src/components/ChartPriceLegendOverlay.tsx` and its existing regression `src/components/__tests__/ChartPriceLegendOverlay.test.tsx`.
- Added `scripts/test-market-movers-sidebar.mjs` and the HTML and TSX fixture under `src/features/marketMovers/__tests__`. The harness builds the fixture with the repository's existing Vite and runs it through a loopback server and a new Chromium profile. Market data is fixture-only, with desktop bootstrap and instrument opening stubbed.
- Inspected `ChartEngine.ts`, `Renderer.ts`, `ChartPriceLegendOverlay.tsx`, `chartScreenshotLegendRenderer.ts`, `RootApp.tsx`, `Sidebar.tsx`, `MarketMoversPanel.tsx`, existing tests, package scripts, original report, tracker, and W2/W4 records.
- Updated the report, tracker, source manifest, handoff and phase tracker, and added a separate portable manifest. Original executable and prior manifest remain available for comparison.

## Checks

- `npm.cmd test -- src/components/__tests__/ChartPriceLegendOverlay.test.tsx src/features/charts/__tests__/chartScreenshotLegendRenderer.test.ts` reproduced an eight-row on-screen legend with 1 failed and 11 passed. After the change all 12 passed, including shallow export overflow and existing indicator actions.
- `npm.cmd test -- src/engine/__tests__/VolumePaneReadouts.test.ts src/engine/__tests__/ChartMarketPriceFormatting.test.ts src/engine/__tests__/auditFrameScheduling.test.ts src/engine/__tests__/ScaleManager.test.ts` passed 17 tests.
- `node scripts/test-market-movers-sidebar.mjs <chromium-executable> <new-scratch-workspace>` passed the mounted scenario. The first browser harness timed out before the scenario ran. The bundled harness then exposed a fixture volume below the existing filter threshold. The corrected fixture passed with the same application event code. Create a marked scratch directory using `scripts/Invoke-EOD-TmpLifecycle.ps1 -Action Create -Tag ia03_browser`.
- Full Windows checks and packaging are recorded in the final report. The runtime-relevant correction is in the renderer, so this run used a Tauri compile check and portable build alongside the renderer regression. The original candidate's targeted Rust check results remain in its original evidence table.

## Risks and rollback

Native visual acceptance and long-history pan/resize timing are pending. The first build's portable and the primary checkout were preserved. Based on pre-edit backup `backups/pre_opencode_changes_20261117_131438_pr116_independent_audit`, review and reverse the scoped follow-up diff if needed and select the earlier portable executable. The new launcher uses its own portable state. Production databases were outside validation.
