# Corporate Actions classic workspace — 23 October 2026

## Scope and backup

Implemented the user-approved classic desktop layout in `E:\TA Projects\EOD Charting Platform`.
Pre-edit backup: `backups/pre_opencode_changes_20261023_165300_ca_classic_workspace_ui`.
Existing unrelated working-tree changes were preserved. No backend, database, raw EOD, financial approvals, builds, packaging or commits were performed in this UI task.

## Changes

- `src/components/DatabaseToolsDialogs.tsx`: normal CA entry now uses compact Actions / View / Reports / Tools / Help menus. Existing source collection, preparation, approval confirmation, backend rechecks and chart-refresh handlers remain connected. Default window is 1120 × 740; minimum remains 620 × 460.
- `src/features/corporateActions/workspace/CorporateActionClassicWorkspace.tsx`: two fixed toolbar rows, native filters/search, sortable and resizable table, virtual rows, optional inspector and slim activity/status bar. Narrow windows move fetch dates into a disclosure and allow horizontal table/filter scrolling without stacking extra toolbar rows.
- `workspace/corporateActionClassicWorkspace.css`: scoped classic styling using existing theme variables. Normal list height is independent of report content.
- `workspace/corporateActionClassicModel.ts`: presentation grouping/filtering/sorting. Exact witnessed Split + Bonus pairs can share a display event; both import IDs remain intact. Ambiguous pairs stay separate; any blocked component keeps the combined event unselectable.
- `__tests__/corporateActionClassicModel.test.ts`: grouping evidence boundaries and filtered Ready ID scope.

Reports open in separate, focus-trapped overlays. Details use a right inspector on wide windows or an overlay on smaller windows. Existing Manual Entry, Identity Import, official CSV/settings, Historical Backfill, Scan Database, Review Issues and the advanced review workspace remain available through Tools.

Approval receives only the table's filtered Ready IDs, intersected again with the existing authoritative eligibility gate before the unchanged draft/confirmation/write path. Ready is never approved automatically. Fetch is disabled in Approved view; Load Approved uses the existing read path. Selection updates use one Set copy for bulk operations. Ctrl+F, table arrows/Home/End, Space selection and Enter details are available; column resizing also supports keyboard arrows.

## Validation

- **PASS** `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-change.ps1 -Profile renderer -Paths src/components/DatabaseToolsDialogs.tsx`: renderer TypeScript and scoped whitespace checks.
- **PASS** focused Vitest run: **6 files / 43 tests**, including ClassicModel, OfficialApprovalUx, PendingPreparation, DividendExplicitApprovalR1, AllTypeReadinessSummary and NormalApprovalAdapter. `--exclude 'tmp/**'` excluded archived fixtures.
- **PASS** browser visual review using the actual new components inside the existing FloatingWindow with explicitly synthetic data. Wide 1586 × 992 queue retained 810px table area. Observed smaller 1072 × 800 queue retained 603px table area; minimum 620 × 460 retained 264px, with horizontal scrolling.
- **PASS** filtered approval preview: BAJFINANCE offered exactly two Ready IDs, 5 and 17. This was a non-writing preview confirmation.
- **PASS** 32,000 synthetic actions: 36 table body rows rendered near the top and 27 near the end; bulk Ready selection yielded 21,333 IDs. This verifies rendering/selection behavior, not backend validation speed.
- **PASS** report opening/Escape and responsive details; wide inspector preserved the 810px table height.
- One preview-only React createRoot warning appeared during hot module replacement; the fixture was subsequently reloaded. No production runtime error was established by that warning.

See [visual QA](2026-10-23_CA_CLASSIC_UI_DESIGN_QA.md) and [implementation screenshot](assets/ca-classic-20261023/implemented-1586x992.png).

## Remaining acceptance

No native rebuild was run. Verify the rebuilt Tauri application on the user's temporary database: Fetch → Load & Validate → review filtered Ready scope → deliberate approval → chart refresh. Browser evidence is presentation-level and does not establish native financial write or live official-feed acceptance. Backend validation speed and unresolved source/identity/EOD evidence are unchanged by this UI task.
