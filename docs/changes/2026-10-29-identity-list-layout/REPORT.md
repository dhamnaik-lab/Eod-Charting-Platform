# Identity Import: compact list layout

29 October 2026. Project: `E:\TA Projects\EOD Charting Platform`.

## Screenshot review and saved result

1. [Completed result](provided-01.png): green Completed 100%, one metadata update,
   an Applied filter and a completed footer are visible. Apply is disabled.
2. [Applied details](provided-02.png): REFRACTORY is marked Applied. The dialog
   distinguishes the historical review reason from this run's Before/After status.
3. [List-space issue](provided-03.png): stacked controls, source information,
   operation text, completion banner, counters, search and filters leave roughly
   a third of the usable tab for the table. The desired 70–80% refers to usable
   Identity Import tab height, excluding the app's external menus and taskbar.

Read-only verification of the active EOD DATABASE receipt confirmed:
`2026-10-29T05:03:14.776440800+00:00`, applied=true, update=1 (REFRACTORY),
activate=0, deactivate=0, held=62, outside=990, total result rows=1053.
SQLite used URI mode=ro, query_only=ON and an explicit read transaction;
total_changes=0. See [evidence](evidence.json).

The metadata-field comparison remains incomplete: neither screenshot nor saved
receipt supplies the old/new company-name, ISIN or series values. This layout
change does not invent those values or alter backend reconciliation.

## Implemented layout

- Place title/database and exchange/source selectors on one desktop header row.
- Put tabs, preview actions, Source status and Operation details on one navigation
  row when width permits. Source status uses a native keyboard-accessible details
  disclosure; operation details retains the full existing dialog.
- Keep completion/progress visible in a thin horizontal colored strip. Preserve
  actual progress values, saved timestamp and counts; fix singular "1 change".
- Remove repeated post-apply counter badges. The completion strip retains change
  counts and unchanged count; outcome filters retain held/outside coverage counts.
  Preview counters remain visible before Apply.
- Combine Find / Current Chart with outcome filters. Current Chart has a natural
  non-wrapping width. The table remains the flex-growing area with a sticky header.
- Wrap controls at smaller widths rather than clipping them or forcing a fixed
  percentage that could hide actions. Manual source inputs remain available.

Runtime changes are confined to:
`IdentityImportWorkspace.tsx`, `IdentityPreviewTable.tsx`, `IdentityApplyStatus.tsx`,
`identityImportWorkspace.css`, and their wiring in `DatabaseToolsDialogs.tsx`.
No backend, source health policy, reviewed authority, Apply confirmation, database
write behavior or financial CA approval behavior changed.

Backup: `backups/pre_opencode_changes_20261029_103817_identity_list_area_layout`.

## Verification and limits

- PASS: final renderer typecheck and scoped whitespace validation.
- PASS: final focused Identity UI/bridge suite, 86 tests across 16 files.
- No Rust tests or release builds were needed for this UI-only change.
- Browser visual ratio measurement: BLOCKED. In-app browser navigation timed out
  on CDP Page.navigate; a separate Edge tab also timed out. Neither attempt is a
  visual pass. The 70–80% goal is a layout target, not a measured acceptance result.
- Sample-only [layout fixture](preview/index.html) uses the real components with
  synthetic records and size/state controls. It has no database access or writes.
  Browser measurements must not be treated as native Tauri acceptance.
- The task-owned Vite preview PID 31236 was stopped; port 5175 has no listener.
- No live apply, downloads, commits, pushes or portable staging occurred.

After the user's portable rebuild, check the completed and preview states at the
same maximized window size. The list should occupy roughly 70–80% of the usable
tab, Current Chart should remain on one line, and Source status / Operation details
must open without covering or losing the footer. Check smaller windows and Manual
mode for wrapping and retained controls. A screenshot will establish actual ratio.
