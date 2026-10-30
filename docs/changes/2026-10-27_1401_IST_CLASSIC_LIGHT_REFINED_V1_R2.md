# Classic Light Refined v1 R2 — Source Change Record

**Prepared in IST:** 2026-10-27 14:01:00 IST  
**Authorized workstream:** EOD Charting Platform  
**Root:** `E:\TA Projects\EOD Charting Platform`  
**Authoritative source ZIP:** `Eod Charting Platform Source Code 2026-10-27_135340_IST.zip`  
**Baseline SHA-256:** `DC607A304E99C873F31C64111DD87E75D3DD1545C51B3DB3571C2B3CC05C2E41`

## Objective
Add `classic-light-refined` as an optional seventh theme and flatten the existing sidebar controls visually for that theme alone. Preserve the six original themes, Charts, Sheets, scanner, market data, plugin infrastructure and newly completed Download Bhavcopy work.

## Previous limitation
Classic Light's existing sidebar buttons have bordered, boxed inline style objects. Existing semantic palette values cannot remove those borders without scoped UI changes. The first attempt rolled back after the full Vitest suite encountered 14 pre-existing Corporate Actions failures. Those 14 named failures were reproduced on an unchanged 02:29 baseline (50 tests: 14 failed, 36 passed; 2 unhandled errors).

## Files changed
- `src/features/app/themeService.ts` — register seventh theme ID/label, preserve exact six previous theme ID/value entries, add a chart palette identical to Classic Light.
- `src/styles/global.css` — add a complete new theme block with a subtle neutral palette; theme-isolated focus and hover styling.
- `src/components/Sidebar.tsx` — only when Refined is active, reuse old rail/header/watchlist button geometry/handlers with no visible boxed borders.
- `src/features/app/classicLightRefined.test.ts` — focused theme and chart override regression tests.
- `docs/changes/2026-10-27_1401_IST_CLASSIC_LIGHT_REFINED_V1_R2.md` — this change record.

## Behavior preserved
- Original six themes and default unchanged.
- `ChartTabs.tsx` and `SheetTabs.tsx` unchanged: no spreadsheet-style sheet replacement, no mini-multi-chart.
- Download Bhavcopy, Rust/Tauri source, corporate actions, scanner, plugin code, databases and settings implementations unchanged.
- Existing app-profile theme string is reused; no new settings schema or database migration.
- No portable Windows executable or `npm run tauri:portable:win` build is authorized or performed.

## Validation and limitations
- **Confirmed locally:** updated snapshot ZIP SHA-256 & CRC; 1,567 entries; identical original three theme source files between 02:29 and 13:53 snapshots; candidate/static syntax and scoped preservation checks (see accompanying receipt).
- **Not run in preparation environment:** full repository typecheck, Vitest, Vite frontend build, Tauri/Rust, manual Windows app screenshots. The Windows R2 runner executes full pre/post Vitest, TypeScript typecheck, targeted tests, and Vite frontend build only after approval.
- **Known red baseline** must be reproduced exactly *before* applying. After applying, no changed/new failed test identities, no added unhandled errors, and exactly four new passing focused tests are allowed. The existing 14 failures remain openly reported as failures.
- **Manual checkpoint:** 100% and 125% DPI, original Classic Light vs new theme; toggle/save/cancel/restart; Sidebar controls and keyboard focus; Chart tabs, Sheets, multi-chart; Bhavcopy basic UI and scanner unchanged. No manual outcome is claimed here.

## Risks
- Existing test suite remains red until Corporate Actions is fixed separately; a no-new-regressions gate is an exception and not a full green result.
- Inline style and CSS interaction requires Windows visual confirmation; chart/sheet colors inherit the selected theme while their components and logic remain unchanged.
- If any protected Bhavcopy files or intended source differ from the 13:53 snapshot, R2 preflight must stop before changes.

## Rollback
Use the externally preserved originals under the Apply runner's reported audit folder; each restored file must match the source manifest hashes. The two added files can be removed only if their content hashes match this package. Preserve logs/evidence. Never overwrite later concurrent changes. The original 13:53 source-only ZIP is the independent restore authority for source, **not** live data or settings.

## Implementation status
This document is staged in a kit. It does not mean the live EOD application is modified or that validation/build passed. Evidence and exact execution results must be attached after running the guarded Windows runner.
