# UX-11 — Delete Databases modal keyboard focus

**IST:** 2026-11-05 11:36 IST (UTC+05:30)
**Workstream root:** `E:\TA Projects\EOD Charting Platform`
**GitHub base:** `main` @ `47e2843433734da43bf40c95c281fb1225ea12bc`
**Branch:** `fix/ux11-delete-database-focus-20261105`

## Objective and prior limitation
The destructive Delete Databases dialog lacked a programmatic dialog role/name, initial keyboard focus, Tab wrap, Escape handling, and focus restoration. This could leave keyboard focus on the application behind the modal, or allow Tab to escape the dialog.

## Changed source
- Modified: `src/components/DeleteDatabaseDialog.tsx`
- New: `src/features/app/modalFocusNavigation.ts` (pure tab-wrap decision helper)
- New: `src/features/app/__tests__/modalFocusNavigation.test.ts` (seven focused cases)
- This maintained source-change note.

## Implementation
- Set `role="dialog"`, `aria-modal="true"`, and accessible name and warning description IDs.
- Focus the existing Close control when opening and restore focus to the prior, still-connected element on unmount.
- Wrap Tab / Shift+Tab at the first and last enabled dialog controls. If no controls are available during an in-progress delete, keep focus on the dialog container.
- Escape delegates to the existing `requestClose` safety guard; it **cannot dismiss an in-progress deletion**.
- Reuse the existing deletion handler without changing confirmation text, disabled state, partial success, retry, or backend API calls.

## Behavior preserved
- The explicit `DELETE` confirmation requirement.
- Sequential deletion, pending/deleted path tracking, retry safeguards, failure reporting and deletion-in-progress protection.
- All database operations and data files, existing visual layout/styles, and window show/hide conditions.
- No new dependencies, no Rust/Tauri, database, other app tool, or local working source changes.

## Validation evidence and limitations
- Verified GitHub `main` SHA and inspected the active Delete Database dialog plus adjacent dialog patterns before editing: **PASS (source inspection)**.
- Verified added dialog attributes, focus hooks and preservation of deletion guards against the edited source: **PASS (static checks)**.
- Seven focused test cases authored: **NOT EXECUTED**.
- Focused Vitest, TypeScript typecheck, Vite build, Windows keyboard/manual acceptance: **NOT RUN**.
- Keyboard accessibility needs actual Windows Tab/Shift+Tab/Escape and confirmation-busy-state smoke checks. Never use a production database for deletion tests.
- Repo change documentation belongs here; full validation logs, backups, test reports and a final evidence ZIP must be kept under `root\tmp` and `$HOME\Downloads`, not `docs`.

## Rollback
Close the unmerged PR, or revert the narrowly scoped PR after merge; restore only affected source using the project backup/evidence package. Do not pull blindly into the dirty working tree.
