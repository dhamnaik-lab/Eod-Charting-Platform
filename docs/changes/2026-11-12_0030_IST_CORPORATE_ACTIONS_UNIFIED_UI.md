# Unified Corporate Actions and Identity

**Recorded 12 November 2026 at 00:30 IST.** Implementation and verification took place in `E:\TA Projects\EOD Charting Platform`.

## Scope and source

The clean local `main`, the local `origin/main` reference and a read-only query of GitHub `refs/heads/main` all resolved to `19518fbcf721c27a891098824cca3cabe42f33fb` before edits. This was the baseline for the [feature-parity matrix](CORPORATE_ACTIONS_UNIFIED_UI_PARITY.md). The older commit cited in the task was historical context.

Inspected RootApp, DatabaseToolsDialogs, uiStore, the menu router, Command Palette, the window store and floating window, the Corporate Actions workspace, workflow, legacy operations, maintenance, reconciliation and identity modules, the existing Vitest suites, and the relevant Desktop API and Rust command contracts. The original dialog owned the working operations behind several menus and subviews. The standalone Actions workspace and Maintenance navigation foundation lacked parts of the production workflow.

## Implementation

- **Actions** presents the existing queue with official NSE/BSE fetch, cancellation, Load & Validate, evidence and readiness filters, and explicit selected or filtered-Ready approval. It uses the existing import, identity, compound-event, Dividend, stale-generation and post-approval chart refresh operations.
- **Identity & History** embeds the working NSE and BSE current and historical import, reviewed preview/apply, source health and configuration, source history, rollback review, receipts and recovery exports. The existing identity review context continues to cancel pending confirmations when the database, source or section changes.
- **History & Reports** provides pending/deferred records, approved source records, saved chronological approvals, validation activity and Dividend blocker reports, and scoped reconciliation preflight with CSV/TXT export. History tables have no approval commands and their selection controls are disabled. Approved loads discard results from superseded requests or database generations.
- **Maintenance** presents the existing manual actions and identity corrections, official fetch/CSV and force refresh, historical backfill, database scans, issue resolution and specialist verification panels. Specialist and normal review share one operation controller.

The native menu and Command Palette reach the same window state. The unified workspace replaces the legacy menubar and top-level dialog rendering. Maintenance-specific global store state and the separate minimized-window identity were removed. The floating window opens centered within the viewport, supports minimize, repeat-open focus and resize, and unregisters on close. The active window reuses the shared service modules. The standalone workflow prototype remains in source outside the active route.

The change adds a request fence to prevent a completed fetch from launching another exchange after a close or database change. Fetch also invalidates old preparation and clears stale validation progress so its own terminal status stays visible. The existing fetch cancellation command serves both Actions and specialist fetch. The queue toolbar, table headers, selection and status strip use the app's theme tokens for readable text in the native dark theme.

Rust commands, IPC contracts, database schemas, financial factors, identity matching, eligibility rules and packaging were untouched. The production Load & Validate path still passes `explicitApprovalOnly: true`. No financial approvals or live database operations were performed during verification.

## Files and rollback

- Runtime integration is in `src/components/DatabaseToolsDialogs.tsx`, `src/components/Sidebar.tsx`, `src/store/uiStore.ts`, `src/features/corporateActions/workspace/` and `src/features/corporateActions/maintenance/CorporateActionMaintenanceWorkspace.tsx`.
- Focused regression updates are under `src/features/corporateActions/__tests__/`. The change record and matrix are in `docs/changes/`. The current architecture, handoff and phase tracker record the new entry and remaining acceptance.
- Pre-edit copies are in `backups/pre_opencode_changes_20261112_000326_ca_unified_ui`, `backups/pre_opencode_changes_20261112_000918_ca_unified_followup`, `backups/pre_opencode_changes_20261112_001034_ca_unified_sidebar`, `backups/pre_opencode_changes_20261112_001320_ca_unified_identity_tests` and `backups/pre_opencode_changes_20261112_003506_ca_unified_theme_tokens`. One test, `corporateActionManualCheckpointCorrection.test.tsx`, was missed in the pre-edit backup selection. Its exact Git baseline was recovered separately in the fixture evidence with SHA-256 `B8D4AE5DD04A3BB4E6226FCB904582CCDCFB64BA658BDBBEFF2C24F1635DDBF9`.
- For source rollback, compare the listed working-tree changes with the baseline and restore only the reviewed affected paths after rollback approval. Rebuild from the reverted renderer. Rollback requires no database migration or data restore.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck:renderer` | PASS |
| `npm test -- src/features/corporateActions/__tests__ --reporter=dot` | PASS. 575 tests across 74 files |
| `npm test` | PASS. 1,787 passed, one skipped |
| `npm run build:renderer` | PASS |
| `scripts/Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction check` then `-Mode Run -CargoAction check` | PASS. Offline locked equivalent of the Tauri Cargo check, using shared `target` |
| `scripts/Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction build` then `-Mode Run -CargoAction build` | PASS. Shared-target debug executable |
| `node .\tmp\fixtures\ca-unified-ui-20261112\browser-smoke.mjs` | PASS. Seven browser checkpoints using mocked Tauri IPC |
| `node .\tmp\fixtures\ca-unified-ui-20261112\native-smoke.mjs` | PASS. Seven checkpoints using actual Tauri IPC in WebView2 against a separate fixture database |
| `scripts/validate-change.ps1 -Profile docs` and `git diff --check` | PASS. Documentation references and whitespace |

The browser fixture confirmed one window, NSE/BSE dispatch and cancellation, Load & Validate, read-only deferred history, approved records and pagination, reconciliation controls, BSE preview and Cancel, the maintenance routes, and unchanged chart tabs on close and reopen. No live exchange request was made. The fixture first caught an old validation status masking the fetch cancellation result. The final run exercised the corrected status and verified that the second exchange was skipped.

The native fixture opened through Command Palette, reached each section, loaded and validated an empty queue, ran an official scan, and reopened the same minimized window. Ctrl+F focused queue search and the keyboard resize handle changed the window bounds. The final native capture was reviewed visually. Computed default dark-theme contrast was at least 4.5:1 for the toolbar, table header and status strip.

The BSE preview rejected a one-row source under the existing population check. A 1,000-row synthetic BSE master previewed successfully. Cancel saved no receipt. Confirmed Apply saved one receipt for 1,000 activations and left the financial approval query empty. Maintenance staged one synthetic Bonus through CSV import and rejected the duplicate. Load & Validate and read-only reconciliation accounted for that record on the isolated database. The debug app used separate application and WebView2 profiles. It wrote its routine startup logs to the existing runtime log location.

Evidence is retained under `tmp/fixtures/ca-unified-ui-20261112/`, including the fixture source, both runners, browser and native results, screenshots, and `source-files-changed.txt`.

- `browser-results.txt` SHA-256 `F0128C26958D61A2E85C6D222F58CCDF17E55D1FA68A694F569B1946AE1AFC44`
- `native-results.txt` SHA-256 `48321C3A175011B4B73EC99E0031C3555425F6707611FD756D9A5581E21B4238`
- `actions-native.png` SHA-256 `7EE520FE195A7FF336B983EC5AA36CB26911C0165EFB82430CB84D7B6D491AFA`
- `target/debug/eod-charting-platform-shell.exe` SHA-256 `6F3A0573795E7F267C5B77C06CF8BED9BFAA8D4F27C9948D66C49FB77F468755`

## Acceptance boundary

The [operator acceptance follow-up](2026-11-12_0057_IST_CORPORATE_ACTIONS_OPERATOR_ACCEPTANCE.md) records the populated debug-fixture results and staged portable build. Runtime verification of the portable executable remains open.
