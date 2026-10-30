# Independent saved source history — 29 October 2026

Fixed the empty expanded **Advanced source maintenance and version history** section.
The source-history reader is now outside the replacement-candidate-only panel.

## Behavior

- Select a configured source for the selected exchange, then choose
  **Load / Refresh History**. Uses the existing platform `listOfficialSourceHistory`
  command; no replacement discovery or online health check is required.
- Displays current URL/version/revision and saved version/review entries with
  active/historical state, decisions, hashes, parent/result versions and operator notes.
- Distinct instructions, loading, loaded-empty and error states prevent a blank
  section or a failed read being reported as no saved history.
- **Reload Source List** retries the existing configuration loader if necessary.
- Source selection, configuration changes and unmount invalidate pending reads.
  The component is keyed to database and exchange so results do not cross contexts.
- History is displayed as evidence, not current approval authority. Existing
  replacement discovery, reviewed promotion, rollback and post-health retry remain
  in the original recovery panel with their existing gates and handlers unchanged.

## Files and backup

Added `IdentitySourceHistory.tsx` and `sourceHistoryLoader.ts` under
`src/features/corporateActions/identity/`, plus `identitySourceHistory.test.tsx`.
`src/components/DatabaseToolsDialogs.tsx` gains the component import and independent
reader mount, with an explanation when no replacement review is loaded.

Pre-edit backup:
`backups/pre_opencode_changes_20261029_022147_identity_independent_source_history`.

## Checks

- PASS: 15 focused history/workspace tests, including stale-response rejection,
  late errors after invalidation, retry, unloaded versus empty/error states, saved
  review/provenance rendering and independent mounting before candidate-only UI.
- PASS: 78 Identity Import tests across 14 files (including the focused checks).
- PASS: renderer profile, TypeScript and scoped whitespace.
- Documentation references and final whitespace checked at handoff.
- Native rebuilt-desktop interaction: NOT TESTED. User portable rebuild required.

No backend source edits, live database operations, official source requests,
financial/identity approvals, replacement promotions, release builds or commits
were performed. No running preview server was started for this fix.

After rebuilding, expand the section, select a source and load history. Confirm
the saved entries appear without running replacement discovery; also check the
no-history, reload and source-switch states. No Apply is required for this check.
