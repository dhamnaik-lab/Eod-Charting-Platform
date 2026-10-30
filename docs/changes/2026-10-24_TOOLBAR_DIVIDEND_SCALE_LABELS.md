# Dividend controls and scale labels

Date: 24 October 2026.
Backup: `backups/pre_opencode_changes_20261024_011026_toolbar_dividend_scale_labels`.

Removed the TRI button and its dividend subscriptions from `src/components/Toolbar.tsx`. Kept Adj as the existing Raw/Adjusted shortcut. Dividend and Rights preferences remain in Chart > Adjustments and Scale Settings, affecting prices in Adjusted mode only. No backend adjustment, financial approval, default preference or price-loading behavior changed.

Updated `src/components/ChartSettingsMenu.tsx` so only the selected Regular/Logarithmic mode renders the Active badge. User screenshots demonstrated that switching scale mode already worked; this is a text-only correction.

Adjusted the existing toolbar tests in `src/components/__tests__/ToolbarAdjustedControls.test.tsx` for removal of TRI while preserving Adj.

- PASS: renderer typecheck through `scripts/validate-change.ps1 -Profile renderer`.
- FAIL: that profile's workspace-wide whitespace check found pre-existing trailing whitespace at README.md:21. Unrelated user work was left untouched.
- PASS: focused Vitest run for ToolbarAdjustedControls and ChartSettingsMenu, 2 files / 4 tests.
- PASS: scoped `git diff --check` for changed tracked source files; new report/test files inspected separately.

No native rebuild was run for this UI change. The running portable app will show it after rebuilding. Native dividend-value acceptance and Already Processed classification remain pending from the Corporate Actions task.
