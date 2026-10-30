# Saved Identity report UI polish

30 October 2026 — `E:\TA Projects\EOD Charting Platform`.

User approved four presentation improvements after the successful BSE name Apply
and native Recent Applied screenshots. This phase changes renderer presentation
and display preferences only. It does not rewrite a receipt, reapply a plan,
alter a source, or change backend identity/approval logic.

**Status: implemented and checked; native portable acceptance deferred.** The user
will test later. This documentation closeout adds no runtime change, test run,
live Apply or scheduled follow-up.

## Changes

- BSE APPLIED rows say **Saved company-name history**. NSE saved history uses
  past tense in the detail cell. Their original review reasons remain unchanged
  in the receipt and accessible in the tooltip. Preview/skipped/duplicate wording
  stays as recorded. BSE search finds both saved wording and original evidence.
- The display strips Windows extended-path prefixes from drive/UNC paths.
  **Copy** copies the complete original stored path or hash, with success/failure
  feedback and a manual-selection fallback instruction. Source/hash fields wrap
  inside the available width. These controls are shared by NSE/BSE current and
  historical receipts. No path passed to the backend is changed.
- Saved BSE/NSE historical reports default to **Applied**, with counted **All**,
  **Skipped**, and **Duplicates** filters. Held/error buttons appear when relevant.
  Counts describe the whole receipt; outcome/search/type/category filters compose
  only in the display. A validated `reportOutcome` preference is stored in the
  existing per-database/exchange/source report context. It stores no Apply authority.
- Identity workspace translates only the known stale Corporate Actions readiness
  notice into **Corporate Actions validation needs refresh**. Hover/details
  explain that saved Identity reports remain available and that Load & Validate
  is required before approving Corporate Actions. Raw diagnostic text is retained
  in details. Other failures remain visible. Queue readiness invalidation and
  approval safeguards are untouched.

## Files and preservation

Shared presentation/count/path helpers: `identityReceiptPresentation.ts`.
Evidence-copy and outcome controls: `IdentityReceiptControls.tsx`.
Clipboard primitive: `src/platform/clipboard.ts`.
Wiring: `BseNameHistory.tsx`, `HistoricalApplyHistory.tsx`,
`IdentityApplyHistory.tsx`, `IdentityHistoricalPreview.tsx`,
`IdentityImportWorkspace.tsx`, `identityDisplayPreferences.ts` and scoped CSS.
Focused regression coverage: `identityReportPolish.test.tsx`.

Backup: `backups/pre_opencode_changes_20261030_112907_identity_report_ui_polish`.
Existing dirty work was preserved. No database connection, live Apply, raw-price
write, receipt modification, backend edit, release/portable build, commit or push
was performed in this phase.

## Validation

- PASS: 41 focused tests across six files, including nine new tests covering
  past-tense display without receipt mutation, original reasons, path/UNC display,
  copying exact stored values and rejection, counts/filter intersection,
  preference serialization/validation and preserving other failure notices.
  An initial test assertion used an incorrectly escaped Windows path literal;
  it was corrected to a raw string, and the focused run passed.
- PASS: renderer typecheck, scoped CSS parsing, documentation references and
  whitespace/UTF-8 checks.
- PASS: [isolated renderer fixture](report-preview.html) using the actual production
  components/CSS, 2,843 synthetic source rows and a mock report API. No database
  bridge or real receipt is available to this fixture.
  Applied initially shows 1,531 rows; All shows 2,843; Skipped shows 1,310;
  Duplicates shows two, and search intersects that filter. Counts stay full-run
  counts. After reload, the duplicate filter, search text and expanded evidence
  disclosure return. This is browser reload evidence, not native restart acceptance.
- PASS: source path displays without `\\?\`; all three Copy controls are present.
  A separate evidence control with a mock writer copies the full original path,
  including its prefix, and shows both success and simulated denial feedback.
  No user clipboard contents were read or overwritten by this preview check.
- PASS: the clarified validation reminder and original diagnostic both appear in
  operation details. Table scrolling fits the available list area.
  [Saved-report screenshot](saved-report-preview.jpg) is an isolated UI preview.
  The temporary browser tab was closed and localhost server stopped after checks.
- NOT TESTED: this polish in the rebuilt portable app, native Clipboard API
  permissions/failure behavior, and preferences after closing/reopening that app.
  The user rebuilds portable manually. A new Apply is not needed for these checks.

## Earlier native evidence

The user's Recent Applied screenshots already confirm the pre-polish saved run
`bse-names-1793339156414000500`, 1,531 names at 11:15:56 IST, with source/plan hashes
matching the earlier [read-only persisted audit](../2026-10-30-bse-name-history/native-apply-audit-20261030.json).
Those screenshots close the earlier native report-viewing gap. This phase's new
formatting/filter/copy behavior awaits native acceptance after rebuild/restart.

## Deferred user test checklist

When ready, rebuild/restart portable using the existing user workflow, then:

1. Open BSE → Recent Applied and the existing 1,531-name run. Confirm APPLIED rows
   say Saved; the original reason remains on hover, and skipped/duplicate rows
   keep their recorded explanations.
2. Switch Applied / All / Skipped / Duplicates and combine a filter with search.
   Counts remain full-run counts; only visible rows change.
3. Expand evidence. Check the friendly path display and Copy for the full stored
   path/source hash/plan hash; verify native clipboard feedback.
4. Choose a filter/search/disclosure state, close/reopen the app, and confirm
   the same report context restores those display preferences.
5. Confirm the validation notice explicitly refers to Corporate Actions readiness.
   Load & Validate remains required before a later financial approval.

These checks use the existing saved report; no new Apply is required. Native
clipboard, app restart persistence and the new polish remain open until the user
provides evidence. The earlier BSE Apply/receipt/native report evidence remains
accepted; intermediate progress and other native routes retain their stated limits.
