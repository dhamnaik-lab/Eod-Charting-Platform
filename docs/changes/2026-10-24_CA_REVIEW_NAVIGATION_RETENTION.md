# Corporate Actions review retention during navigation

Backup: `backups/pre_opencode_changes_20261024_021626_ca_review_navigation`.

The Pending and Approved views shared importRows. Loading Approved or Review Issues replaced the Pending list and cleared current Dividend results. Returning to Pending called full preparation. Separately, database-change notifications automatically reran preparation while the review section was visible.

`src/components/DatabaseToolsDialogs.tsx` now retains a Pending review snapshot in the mounted window, including rows, scans, errors, identity hints, Dividend diagnostics/scope, progress and summary. Approved and read-only issue-list loads preserve this snapshot. Returning from Approved or advanced sections restores it only for the same database and preparation generation. Selections and approval confirmations are cleared on restoration. Navigation does not start validation; if no valid snapshot exists, the user is prompted to run Load & Validate explicitly.

Database-change notifications invalidate readiness and confirmation without launching a scan. Explicit preparation and other row-replacing operations invalidate the snapshot; changing databases clears it. This is session navigation retention, not disk persistence, resumable batch checkpoints, or permission to reuse stale approval authority. Closing/unmounting the window still invalidates the current-cycle report.

PASS: 39 focused tests across workspace, normal approval and Dividend prepared-scope orchestration. The initial test run had one source-boundary assertion failure because it included the adjacent database-change effect; the test now isolates preparation and checks navigation restoration and invalidation independently.

PASS: scoped `scripts/validate-change.ps1 -Profile renderer`: renderer typecheck and whitespace check. Native navigation acceptance requires rebuilding. No source database or financial adjustments were changed. The separate duplicate-rename-edge regression causing batch 74 failure and missing live DELPHIFX historical witnesses remain unresolved by this change.
