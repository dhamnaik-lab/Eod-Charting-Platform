# Gann Analysis Overlay Artifact Fix

- **IST timestamp:** 2026-09-18 02:44:50 +05:30
- **Workstream:** EOD Charting Platform
- **Root:** `E:\TA Projects\EOD Charting Platform`
- **Source authority:** `Eod Charting Platform Source Code 2026-09-18_003722_IST.zip`
- **Source authority SHA256:** `263A1405D5E4A3D51C4156D0D53D6526A53E059001293A06469D0F5411AF9E52`
- **Mode:** bounded Gann analysis-overlay artifact correction

## Objective

Remove the Antigravity-era automatic Gann Price-Time analysis artifacts without altering normal user Gann drawing tools or the Gann calculation engine.

## Previous defect / limitation

The bundled Gann Price-Time analysis plugin defaulted enabled and `ChartCanvas` evaluated it with a null plugin-enable map, so saved application plugin settings were ignored. The Gann engine callback was rendered after ordinary drawings against full overlay-canvas dimensions, allowing rays/cycles to cross into indicator panes. Changing/removing the callback did not explicitly dirty the engine, so immediate clean repaint was not guaranteed.

## Files changed

- `src\plugins\analysis\gannPriceTime\gannPlugin.ts`
- `src\features\app\appSettingsService.ts`
- `src\components\ChartCanvas.tsx`
- `src\engine\ChartEngine.ts`
- `src\plugins\analysis\gannPriceTime\__tests__\gannOverlayIntegration.test.ts`

## Final implementation

- Gann Price-Time analysis plugin defaults **disabled** until explicitly enabled.
- `ChartCanvas` reads the persisted `pluginEnabled` map and subscribes to successful app-settings writes, so enabling/disabling the plugin applies live.
- Gann callback removal/change marks the chart engine dirty for immediate repaint.
- Gann analysis callback is clipped to `layout.chartWidth Ã— pricePane.plotHeight` and receives those price-plot dimensions instead of full-canvas dimensions.
- Normal Gann Fan / Gann Box / drawing persistence, drawing deletion, and Gann calculation mathematics are unchanged.

## Behaviour preserved

- all ordinary chart drawings and their persistence;
- Gann drawing tools (`gann`, `gannBox`);
- Gann Price-Time calculation engine and overlay renderer formulas;
- scanner, DNN, alerts, indicators, chart navigation and Identity ER0â€“ER4 authority;
- no database, Rust/Tauri backend, network, Git/source-control, or package dependency change.

## Validation commands / results

- Genuine focused RED on pre-change sandbox: PASS — expected non-zero exit on pre-change sandbox; Gann disabled-by-default contract failed as intended (01-focused-red.log)
- Focused GREEN (`gannOverlayIntegration`, existing `gannEngine`, `pluginRegistry`): PASS — exit 0 (02-focused-green.log)
- Full Vitest regression suite in candidate sandbox: PASS — exit 0 (03-full-vitest.log)
- Renderer TypeScript typecheck in candidate sandbox: PASS — exit 0 (04-renderer-typecheck.log)
- Renderer Vite build in candidate sandbox: PASS — exit 0 (05-renderer-build.log)
- Candidate protected-source authority: PASS — 548/548 exact
- Installed protected-source authority: PASS — 548/548 exact
- Post-install focused GREEN: PASS — exit 0 (06-post-install-focused-green.log)

## Risks / limitations

- This task corrects the Gann analysis-overlay lifecycle and clipping only; it does not redesign Gann calculations.
- If an operator had explicitly saved `gann-price-time=true`, the overlay remains enabled by design until disabled in Settings â†’ Plugins.
- No portable Windows executable is built in this bounded source correction; manual visual confirmation belongs to the next application build/manual checkpoint if desired.

## Rollback guidance

Use the bounded pre-change backup ZIP produced by the runner. Restore the four replaced source files, remove `src\plugins\analysis\gannPriceTime\__tests__\gannOverlayIntegration.test.ts`, and remove this change record. Then verify the accepted 547-file protected-source authority.

## Relevant evidence

- Pre-change protected source: 547 files exact.
- Post-change protected source: 548 files exact.
- Runner evidence ZIP: `E:\TA Projects\EOD Charting Platform\tmp\GANN_ARTIFACT_FIX_2026-09-18_024450_IST_evidence.zip`
- Backup ZIP: `E:\TA Projects\EOD Charting Platform\tmp\GANN_ARTIFACT_FIX_PRECHANGE_BACKUP_2026-09-18_024450_IST.zip`
- Backup SHA256: `FE83B76285DA33CD57513E839A4D386C3DA239A7B87F87971EEC382B869C9791`

