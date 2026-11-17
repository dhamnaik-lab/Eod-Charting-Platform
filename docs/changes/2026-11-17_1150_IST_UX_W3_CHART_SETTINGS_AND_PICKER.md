# UX audit W3 | Chart Settings And Picker

17 November 2026 at 11:50 IST. Worktree base `3950985f7c47bc60ff87728a60245a3cc62bf55d`.

Backups in candidate `backups/` include pre_opencode_changes_20261117_114928_ux_f17_f20. The worktree carries an uncommitted diff; review and reverse the corresponding bounded diff for rollback.

## F-17 | chartColorsCustomized: true is a one-way trap — no Reset to Theme anywhere

src/components/SettingsDialog.tsx:849. Stages palette colors and resets chartColorsCustomized to false. Existing Save/Cancel and backend profile contract are reused.

Changed paths include `src/components/SettingsDialog.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f17-after.log [npm.cmd test -- src/features/app/__tests__/themeSystemAudit.test.ts src/features/charts/__tests__/chartSettingsDraftF14.test.ts; Tests  72 passed (72)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.

## F-20 | Indicator Picker: no keyboard navigation, no category filter chips, search is substring-only

src/components/IndicatorPickerDialog.tsx:178. Adds arrow navigation and selected-row scroll, retains Enter to add, existing category rails and favorites, and matches multi-term queries.

Changed paths include `src/components/IndicatorPickerDialog.tsx`.

Focused evidence under `tmp/ux-audit-evidence` has f20-after.log [npm.cmd test -- src/indicators/__tests__/indicatorFavoritesB24.test.ts src/indicators/__tests__/studyAsSourceUiB13.test.tsx src/features/app/__tests__/indicatorSettingsDialogFocusB18.test.tsx; Tests  25 passed (25)].

Disposition is `FIXED_AND_VALIDATED`. Candidate visual acceptance is pending.
