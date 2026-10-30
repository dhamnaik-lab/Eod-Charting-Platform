# NSE Current universe: disable zero-change Apply

The user's rebuilt-app screenshots showed all 3,201 current instruments unchanged,
62 held and 990 outside coverage, but Apply was enabled. The informational rows
must remain inspectable without appearing to authorize a write.

## Change

- NSE Current universe Apply now requires an unapplied preview with a nonzero
  activate, update or deactivate count, in addition to the existing reviewed SHA,
  database and source-context checks. New instruments are already included in the
  backend activate count; informational row counts do not enable Apply.
- A zero-change preview says **Up to date — nothing to apply.** The footer explains
  that held/outside-coverage rows remain unchanged and available for review.
- The Apply handler defensively returns before the platform request for zero-change
  or already-applied results. Search filters never decide eligibility; counts come
  from the full reviewed preview.
- BSE, historical identity, backend writers, existing receipts, raw prices and
  financial CA approval behavior are unchanged. No live Apply or source fetch ran.

Files: `src/features/corporateActions/identity/identityImportModel.ts`,
`src/components/DatabaseToolsDialogs.tsx`, and the focused
`identityNoActionApply.test.ts` test file.

Backup: `backups/pre_opencode_changes_20261029_172620_identity_zero_action_apply`.

## Checks

- PASS: 91 focused Identity UI/bridge tests across 17 files, including unloaded,
  informational-only, each actionable count and already-applied results.
- PASS: renderer typecheck, scoped whitespace and live documentation-reference checks.
- No Rust changes or Rust compilation needed. No release/portable build, commit,
  push or database mutation was performed.
- Native acceptance of the new footer text/button requires the user's portable
  rebuild. Preview an unchanged source: Apply must be disabled while Details and
  search remain usable. An actionable preview must retain its existing authority
  and confirmation requirements.
