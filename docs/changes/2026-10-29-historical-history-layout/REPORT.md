# Historical history layout and IST display

Approved scope: expand the legacy history list, prevent the Historical Outcome
heading from wrapping, and display legacy saved times in IST with UTC available.

- Legacy history fills the available Recent Applied content area when there is
  no selected completed-run report. Beside a completed report, its list retains
  the compact height limit. The saved expand/collapse preference is preserved.
- The Historical Outcome column has a 100-pixel minimum width and does not wrap.
- SQLite timestamps without a timezone are read as UTC and displayed explicitly
  in Asia/Kolkata (IST). Hover over a saved time for its UTC tooltip. Screen
  readers receive both values. Missing or invalid values remain visible without
  inventing a saved time. Stored timestamps and effective dates are unchanged.
- Apply authority, run receipts, backend code and database contents are untouched.

Changed renderer files:
`src/features/corporateActions/identity/HistoricalApplyHistory.tsx` and
`src/features/corporateActions/identity/identityImportWorkspace.css`.
Timezone coverage was added to the existing `historicalIdentityReporting.test.tsx`.

Pre-edit backup:
`backups/pre_opencode_changes_20261029_232822_historical_history_layout`.

Validation:
- PASS: focused Vitest reporting/search/workspace checks, 19 tests across 3 files.
- PASS: `scripts/validate-change.ps1 -Profile renderer` with the three changed
  source/test paths (renderer typecheck and whitespace).
- PASS (user screenshot, 29 October 2026 at 23:51 IST): Recent Applied legacy
  history fills the available list area; saved times display as
  `29/10/2026, 21:27:57 IST`; search and column headings remain visible.
- NOT TESTED by this screenshot: mouse/keyboard scrolling, UTC hover tooltip,
  Historical Outcome heading, report/legacy layout when a full run receipt is
  selected, and settings restoration after a complete restart.
- No release build, live Apply, commit, push or background server was performed
  by the agent. The earlier automated results above were not rerun for this
  documentation update.

## Desktop screenshot acceptance

[User-provided Recent Applied screenshot](recent-applied-desktop.png).

The screenshot shows 250 persisted legacy rows and zero completed runs with
receipts. This is expected for changes saved before the new receipt feature:
legacy history is visible, while an original full run receipt is not invented.
It does not demonstrate a new Apply or live coloured progress. No repeat Apply
is needed; the earlier fresh preview showed no actionable changes.

Remaining checks: hover over a saved time to inspect its UTC tooltip; open
Historical identity and select Skipped to inspect the single-line Outcome
heading; verify scrolling and restart persistence. Confirmation, coloured live
progress and a new full run receipt await a future legitimate actionable run.
