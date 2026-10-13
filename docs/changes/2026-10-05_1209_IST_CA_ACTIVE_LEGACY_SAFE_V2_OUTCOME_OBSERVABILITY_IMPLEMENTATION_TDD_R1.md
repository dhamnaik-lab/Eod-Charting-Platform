# CA_ACTIVE_LEGACY_SAFE_V2_OUTCOME_OBSERVABILITY_IMPLEMENTATION_TDD_R1

IST timestamp: 2026-10-05T12:09:43+05:30

## Objective and authorized root

`E:\TA Projects\EOD Charting Platform`. Present the active Legacy preparation's
existing Safe-V2 results without changing evaluation, approval policy or persistence.
Authority: `Eod Charting Platform Source Code 2026-10-05_114016_IST.zip`,
SHA256 `64B39B44D925ABE6F2A4C0E9E4464FA23A00437A4620366BB6A0AA49ACA82E4D`.
No older runtime or source snapshot is substituted.

## Previous limitation

The Legacy preparation already returns `autoApproval` with counters, dispositions and
exact reasons. The dialog previously displayed only the final aggregate message and
preparation errors; skipped reasons in that returned object were not presented.
A valid zero-approval batch is not a Safe-V2 malfunction and must not be changed into
an automatic approval to make the UI appear successful.

## Files changed

- `src/components/DatabaseToolsDialogs.tsx` (only production change).
- `src/features/corporateActions/__tests__/corporateActionPendingPreparation.test.ts`
  (two assertions for exact SKIPPED disposition/reason propagation).
- `src/features/corporateActions/__tests__/corporateActionSafeV2OutcomeObservability.test.ts`
  (new 22-case handler, JSX and wiring regression).
- This change record.

## Final implementation

Store the returned result in ephemeral dialog state bound to the captured database
path and preparation generation. Display only a completed idle preparation from that
same context. Derive a memoized ID-to-reason map from SKIPPED dispositions only.
Show the existing backend counters in a separate, wrapping compact status line.
In expanded pending rows, show the exact SKIPPED reason as escaped JSX text, preserving
its whitespace. Existing FAILED preparation errors retain precedence.
Clear presentation state when preparation begins/fails, database context resets,
the dialog closes, rows reload, or manual Apply starts/fails. Stale/cancelled responses
cannot publish an outcome because the existing continuation fence is checked first.
No historical reason is reconstructed, no secondary evaluator is added, and no new
backend call or persistence facility is introduced.

## Behavior preserved

Manual Apply checkbox and batch eligibility predicates are unchanged. SKIPPED is
informational, not a new manual-Apply veto. The existing final `Prepared ...
Auto-Approval Safe V2 approved/linked ...` message remains orchestration-owned and
byte-identical in the unchanged Legacy owner. RootApp/routing, Rust, desktop types,
Tauri bridge, setting gates, k=0.40, G=7, same-date exclusions, R1-B4 identity/provenance,
manual/exception paths, and other action families remain untouched.
Phase5E4 network gate remains **OPEN / UNSATISFIED / DEFERRED**. Existing cycle and
Sandbox enablement authorities remain consumed. No EOD launch, Prepare, database
access, Git, Windows settings or network retrieval is authorized by this delivery.

## Validation commands and actual local results

- Approved source ZIP SHA256 and CRC: PASS; 1,444 files / 23,651,614 bytes.
- `npm ci --offline --ignore-scripts --no-audit --no-fund --cache /root/.npm`:
  FAIL, `ENOTCACHED` for locked zustand package. No online retry or version substitution.
- TypeScript 5.8.3 syntax parser (local installed compiler, not the project's locked
  5.9.3): zero parse diagnostics for the production and two test files.
- Supplemental Node 22.16.0 adapter executing the new test file with TypeScript
  transpilation and Node's test API: RED 19 failed / 3 preservation checks passed;
  GREEN 22 passed / 0 failed. These are extracted real-handler/JSX-prop tests, NOT
  Vitest and NOT a browser visual test.
- Node controller selftests: 9/9 PASS. These validate gates using fixtures, not product
  integration or Windows installation.
- Source comparison: only one existing production file and one existing test file
  changed; every other original source file remains byte-identical.

## Required target-host gates (not run in generation environment)

Use only existing package-lock-matching dependencies. In a run-owned snapshot workspace:
existing focused baseline; canonical new-test RED (19 feature failures and 3 preserved
checks); canonical new-test GREEN (22/22); seven-file focused regression; every current
Corporate Actions test file; TypeScript `--noEmit`; Vite frontend build into run tmp.
Only after these pass and the live source is still exact, install three source/test
files. Then re-run focused CA tests and typecheck and verify the entire protected
source population. No Rust build, Tauri runtime, installer or portable build.
The controller appends actual target results to this record on successful installation.

## Risks and limitations

The dialog is large; the delta is deliberately local. Reasons may be technical and
are displayed verbatim, without wording reinterpretation. They are intentionally not
available after restart/reload without a fresh authoritative result. A cancelled
in-flight batch is not represented as a completed result. Counts describe the returned
Safe-V2 batch, not every pending row in the UI. A manual visual checkpoint remains
unperformed; do not launch EOD or consume a Prepare cycle solely to inspect this UI.
Full Vitest/typecheck/Vite and Windows PowerShell parsing have not passed here and
must not be inferred from syntax checks, ZIP integrity or supplemental tests.

## Backup and rollback guidance

The target controller uses the existing `scripts/create-project-backup.ps1` with only
the two replaced paths; it parses that helper before execution and verifies both
backup hashes. The general validation script is not used because it dispatches Git
and Rust outside this authorization. On post-install validation failure, restore only
run-owned candidate bytes from the verified backup and remove only the run-created
test. Unexpected concurrent bytes are left untouched and reported for manual review.
A failed or interrupted run must be reviewed before retry. The immutable input ZIP
and all existing acceptance evidence remain unchanged.

## FIX2-RESUME2 validation-contract metadata correction

Parent FIX2 evidence SHA256: E6DB95EBBA64D4E9AF70B3A9BDB2E59DFACAEAE6C09A9C9154B0C394D34CBAC2.
The exact patched observability test already passed GREEN 22/22, focused 83/83, full CA 285/285, project TypeScript typecheck and Vite build. The controller then stopped before backup/install because FIX2 updated the test SHA256 in contract.json but left its byte length at 16321; the exact patched test is 16324 bytes. RESUME2 corrects only that contract byte-length metadata while reusing the exact patched test from parent evidence. Product/UI bytes are unchanged. The original controller reruns every baseline/TDD/regression/typecheck/build gate before installation.
Network gate remains OPEN / UNSATISFIED / DEFERRED.

## Target-host validation receipt

IST: 2026-10-05T13:49:18.778+05:30

- 01-baseline-focused: {"files":6,"tests":61}
- 02-red-observability: {"tests":22,"passed":3,"failed":19}
- 03-green-observability: {"tests":22,"passed":22,"failed":0}
- 04-focused-regression: {"files":7,"tests":83}
- 05-full-ca-regression: {"files":46,"tests":285}
- typecheck: PASS
- vite: PASS
- 09-post-install-focused: {"files":7,"tests":83}
- Post-install focused: PASS
- Post-install typecheck: PASS
- Protected source population after install: 594 exact
- Backup: E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261005_134856_CA_SAFE_V2_OBSERVABILITY_R1
- Evidence: E:\TA Projects\EOD Charting Platform\tmp\CA_OBS_R1_RESUME2_2026-10-05_134751_IST_00f45acf\evidence
- Manual visual checkpoint: NOT RUN; no EOD launch authorized.
