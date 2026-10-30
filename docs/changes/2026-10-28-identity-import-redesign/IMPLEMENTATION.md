# Identity Import redesign and Phase 1B receipt

28 October 2026. Implemented; native visual/keyboard acceptance remains open.

## Result

- Current universe, Historical identity (NSE), and Source diagnostics are separate
  workspace views. Current preview/search occupy the primary area. Each preview
  retains its own visible review footer and Apply handler.
- Source health initially displays the selected exchange; All exchanges remains
  available. The health-check command still checks all configured sources and
  does not refresh saved import files. Summaries label last-check time and saved
  source availability separately; unknown availability is not reported as healthy.
- Compact semantic source rows open an evidence inspector. Structured fields show
  status, URLs, hash, observed columns and retained capture path. Raw JSON is behind
  a disclosure. Recovery, candidate review, promotion and rollback remain available
  under source maintenance in diagnostics.
- Current preview rows have a details dialog showing company, ISIN, series,
  proposed status, matching identifier and reason. Existing focus-managed dialogs
  are reused. Tabs implement arrow/Home/End navigation. Native acceptance is still
  required to verify these interactions in the rebuilt app.
- Unloaded, loaded-empty and filtered-empty previews have distinct messages.
  Manual-source empty states direct the user to Preview Changes. Database changes
  clear displayed current/historical previews as well as their existing authority.
- No automatic source checking, refreshing, identity Apply or financial approval
  was introduced. Refresh and Preview remain explicit actions.

## Confirmed source correction

Added only the observed `OLD NAME OF THE COMPANY` and `NEW NAME OF THE COMPANY`
aliases to the existing company-name parser. The exact retained 240588-byte
response is the regression fixture
`src-tauri-shell/src/database/fixtures/nse_namechange_20261028.csv`.
SHA-256: `ca456bf37b8d8e715708f1df04089fe09f7418275764d105351c5d9742cfac9f`.
All **2332** rows pass the corrected parser. Competing columns, blank required
values and malformed dates remain errors. This is parser acceptance of the saved
response, not a fresh online health assessment or certification of a full import.

## Source scope and preservation

Modified `src/components/DatabaseToolsDialogs.tsx` to connect the existing handlers
to focused components under `src/features/corporateActions/identity/`:
`IdentityImportWorkspace.tsx`, `IdentitySourceHealth.tsx`, `IdentityPreviewTable.tsx`,
`identityImportModel.ts`, and `identityImportWorkspace.css`.
Backend edits are limited to company-name aliases and regression tests in
`nse_identity_imports.rs`, plus the exact-byte fixture.

Compared against the pre-edit backup: historical preview, historical Apply, source
refresh, current preview/Apply dispatch, reviewed-readiness predicates, and exchange/
source authority invalidation sections are unchanged. Results and source hashes
are in `implementation-evidence.json`. Identity and financial approval remain
separate; no approval policy or adjustment writer was edited.

## Backups

- `backups/pre_opencode_changes_20261028_212104_identity_import_redesign_phase1b`
- `backups/pre_opencode_changes_20261028_213330_identity_redesign_test_contracts`

The second backup precedes updates to existing layout-contract tests. Tests for the
superseded inline grid now cover compact diagnostics and the workspace arrangement.
Historical source contract reads normalize CRLF/LF rather than depending on Windows
line endings. Reviewed-authority assertions remain enforced.

## Validation

- **PASS:** shared Cargo wrapper Preview, then Run of
  `test identity_change_csv_compatibility_tests`: 8 tests, 0 failed;
  compile/link 45.21s, tests 0.09s. Includes the entire retained official response.
- **PASS:** 13 focused Identity Import UI/contract files, **70 tests**;
  structured result saved in `identity-tests.json`.
- **PASS:** renderer profile: TypeScript and scoped whitespace checks.
- **PASS:** comparison of the six protected handler/authority sections against backup.
- Documentation references and final scoped whitespace are checked at handoff.
- **NOT TESTED:** actual rebuilt desktop workflow, graphical acceptance, viewport/
  scaling acceptance, focus restoration and full keyboard traversal.

Initial test outcomes were not all passing: the first Rust compile caught a new
assertion comparing a stored date string to a date object; corrected before the
passing run. Initial UI regression checks reported nine failures for superseded
layout/copy assertions and a CRLF-sensitive marker; their relevant contracts were
updated or retained, then the final run passed. One generated edit introduced two
non-UTF8 characters; corrected and checked against the backup before final checks.

The temporary sample-data browser preview is retained under `preview/` as a local
verification harness. In-app browser CDP navigation and focus initialization timed
out before the page loaded. No screenshot or browser interaction is claimed as
accepted. The temporary Vite server on port 5175 was stopped. The harness is not a
standalone deployed page and must be served from the repository with Vite.

No live database reads/writes, official downloads, identity application, CA approvals,
release builds, portable staging, commits or pushes occurred. No deep web search
was needed: the retained official response directly demonstrated the schema issue.

## Desktop acceptance after the user's portable rebuild

1. Open Identity Import at 1280x720 and 1920x1080; check Windows scaling and 200% zoom.
   Confirm search, preview and the review footer remain reachable.
2. Check initial, loaded-empty, populated, filtered-empty and failed-preview states.
   Confirm disabled Apply explanations and manual-source instructions.
3. Run Check Source Health. NSE company-name parsing should pass for the captured
   schema. A different/new source failure remains a visible error with evidence.
   Confirm BSE results remain available through All exchanges without affecting
   the selected-exchange totals.
4. Open Details for a failed source and a preview row. Verify Escape, tab trapping,
   close/focus restoration, structured evidence and collapsed raw JSON.
5. Check Current universe and Historical identity independently. Confirm preview
   alone never applies changes; verify stale/source-switch authority resets using
   a guarded test database. Do not apply changes to production merely for UI QA.
6. Inspect source maintenance review/history and explicit promotion/rollback gates.
   Confirm they remain accessible without displacing the primary preview workspace.
