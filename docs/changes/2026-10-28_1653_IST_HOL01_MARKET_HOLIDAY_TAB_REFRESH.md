# HOL-01 — Market Holiday Tab Refresh and Database-Scoped Results

IST timestamp: 2026-10-28 16:53:55 +05:30
Workstream: E:\TA Projects\EOD Charting Platform
Implementation result: HOL01_APPLIED_FOCUSED_VALIDATION_PASS_MANUAL_PENDING

## Objective and prior limitation
Re-entering the Market Holiday tab previously refreshed only when the existing holidays array was empty. A previously populated list could remain stale. Responses to earlier requests were not database-scoped, potentially adopting old data after a database switch.

## Files changed
- src/components/BhavcopyDownloadWindow.tsx: modified.
- src/components/__tests__/BhavcopyMarketHolidayRefresh.test.ts: created.
- This dated change record: created.

## Implementation
- Re-entering the Market Holiday tab always initiates a read without changing Bhavcopy tab behavior.
- Rows are displayed only when associated with the active chart-store database path.
- Active-database changes clear holiday rows/errors/confirmation and reload when the Holiday tab is active.
- Monotonic request IDs and current-database checks prevent old responses from overwriting newer state.
- Add/delete still use the original desktop API commands and optimistic row updates; completed operations cannot adopt results from an earlier database context.
- Existing backend holiday calendar, downloads, special sessions and database structures are untouched.

## Behavior preserved
- Holiday table, manually triggered Refresh, add/remove/confirmation, existing selected tab and floating-window layout.
- Original Bhavcopy download planning/import, Sidebar, Charts, Sheets and other application features.
- Backend, source settings, Cargo config, app database, shared Cargo target and current portable/release binaries.

## Validation commands and actual results
- 01_hol01_focused_vitest: exit 0; C:\Program Files\nodejs\npm.cmd test -- src/components/__tests__/BhavcopyMarketHolidayRefresh.test.ts
- 02_bhavcopy_renderer_regressions: exit 0; C:\Program Files\nodejs\npm.cmd test -- src/features/bhavcopy/__tests__/bseHistoryDownload.test.ts src/features/bhavcopy/__tests__/downloadRunState.test.ts
- 03_renderer_typecheck: exit 0; C:\Program Files\nodejs\npm.cmd run typecheck:renderer
- 04_renderer_vite_build: exit 0; C:\Program Files\nodejs\npm.cmd run build:renderer -- --outDir E:\TA Projects\EOD Charting Platform\tmp\HOL01\builds\R1_20261028_165355_IST\renderer
- Authoring container: 7/7 focused extracted TypeScript behavioral checks PASS and both touched files parse PASS.
- Rust tests: not run (no Rust/backend changes).
- Full pre-existing Vitest/Rust baseline failures not rerun; focused results do not assert full-suite success.
- Portable build: not run (explicit manual Windows checkpoint required).
- Manual native checkpoint: NOT PERFORMED by this runner.

## Risks and limitations
- Native database-transition behavior still requires a manual check in the active Windows application.
- Users of an existing portable EXE need a separately approved rebuild to run updated renderer code.
- Current typecheck and targeted frontend test results are captured in evidence logs; do not infer other suites pass.

## Rollback
- Restore original window component from verified pre-edit backup: E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261028_165356_HOL01_MARKET_HOLIDAY_REFRESH
- Remove only the newly created focused test file after hash verification.
- Do not delete or restore databases, shared Cargo target, backups, release/portable artifacts, or unrelated docs.

## Authority and hashes
- Source snapshot SHA-256: 8FFCB62773D35BEA02CD7E2433C5597211F440A7C60DEAA97E9B04268CD3EDB3
- Original window SHA-256: C0AB4FA0E72470686F678BC89F516D9D8B1BECD8E3392D6F0A75C53BE08A2675
- Installed window SHA-256: 48700AC3CD154DEC10A30C8D0E8196D749C5BF95050ABBEA88A5E0F6A8F79F7D
- Focused test SHA-256: A4C8AC4AFF6E0A36948F435478B4245746A80223317464C31973D3A8D1EF76C0
