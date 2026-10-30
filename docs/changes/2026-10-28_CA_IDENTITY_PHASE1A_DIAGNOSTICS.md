# NSE company-name source diagnostics — Phase 1A

Scope: diagnose the failing response through the existing Identity Import workflow.
The actual failing official payload has not been fetched during implementation;
no schema correction is claimed.

## Behavior

- Source Health retains failed company-name response bodies when available and
  exposes the diagnostic under **Show evidence**. Candidate-review assessments
  receive inline diagnostics but do not write captures.
- Refresh retains a rejected company-name response before any validated source
  files are published. HTTP errors with a response body are retained too.
- Captures contain exact `response.bin` bytes and `diagnostic.json` with UTC time,
  request/final URLs, status, SHA-256, byte count, CSV headers and the validation
  error. Record validation errors include CSV position and parsed field values;
  missing-column errors identify the absent column and observed headers.
- Captures use unique directories below the active database's
  `reference-data/NSE/Identity/Diagnostics/`. They are separate from import source
  paths and confer no identity or financial approval authority.
- Retention is capped at 8 MiB per response. Capture failure is reported alongside
  the original source error. A transport failure without a readable body cannot
  retain response bytes. No automatic cleanup is introduced.
- Last valid import files are untouched on company-name rejection. A missing
  required archive still blocks preview; this phase does not bypass it.

Changed runtime files: `nse_identity_imports.rs`, `official_source_health.rs`,
`DatabaseToolsDialogs.tsx`, and `desktop.ts`. Parser acceptance rules, matching,
identity Apply and financial Approve gates remain in place. Broader multi-file
publication atomicity remains outside this phase.

## Validation

- PASS: shared Cargo wrapper Preview and Run for `test company_name_diagnostic_tests
  -- --nocapture`: 4 tests; compile/link 1m47s, execution 0.05s. These cover header
  versus blank-row context, exact byte/hash retention, unique captures, preserved
  saved source, explicit retention failure and HTTP-error rejection.
- PASS: shared Cargo wrapper Preview and Run for
  `test identity_change_csv_compatibility_tests`: 6 tests; compile/link 25.62s,
  execution 0.04s. Modern/legacy aliases, malformed dates, missing values and
  competing columns retain their acceptance behavior.
- PASS: shared Cargo wrapper Preview and Run for `check`: 10.45s. Seven warnings
  were emitted in untouched Bhavcopy and Corporate Actions code.
- PASS: `scripts/validate-change.ps1 -Profile renderer` scoped to the changed
  renderer/types files: TypeScript and whitespace checks.
- PASS: documentation profile, live references and scoped backend/handoff whitespace.
- NOT TESTED: rebuilt desktop layout and actual failing official response.
  No live downloads, database reads/writes, identity application, CA approval,
  release build, portable staging, commit or push occurred.

One initial wrapper invocation using `pwsh -File` failed during argument binding;
no compilation occurred. The corrected `pwsh -Command` invocation passed Preview
and Run. No Cargo target overrides or cleanup were used.

Pre-edit backup: `backups/pre_opencode_changes_20261028_190937_ca_identity_phase1a`.

## Native acceptance

After the user's portable rebuild, run **Check Source Health** in Identity Import.
For a failing company-name source, expand **Show evidence** and inspect the retained
diagnostic path. Compare response bytes with the recorded hash, then determine
whether the failure is an absent header, a blank field, malformed data or transport.
Only that observed evidence should drive Phase 1B's parser decision and fixture.
Refresh is also instrumented, but the health check alone can collect the evidence.
No identity Apply or financial Approve is required for diagnosis.
