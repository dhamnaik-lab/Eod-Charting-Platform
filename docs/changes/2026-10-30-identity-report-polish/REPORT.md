# Saved Identity report UI polish

30 October 2026 — `E:\TA Projects\EOD Charting Platform`.

User approved four presentation improvements after the successful BSE name Apply
and native Recent Applied screenshots. This phase changes renderer presentation
and display preferences only. It does not rewrite a receipt, reapply a plan,
alter a source, or change backend identity/approval logic.

**Status: native saved-report display/filter/hover and clipboard success confirmed;
restart persistence confirmed by the user.** Search with a non-All outcome filter,
validation-notice wording and clipboard failure behavior retain the limits below.
This documentation update adds no runtime change, application test, live Apply,
portable build or scheduled follow-up.

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
- At initial implementation closeout, native portable polish/clipboard/restart
  checks were deferred. The later user evidence below supersedes that blanket
  deferral for the demonstrated behavior; clipboard failure remains untested.

## Earlier native evidence

The user's Recent Applied screenshots already confirm the pre-polish saved run
`bse-names-1793339156414000500`, 1,531 names at 11:15:56 IST, with source/plan hashes
matching the earlier [read-only persisted audit](../2026-10-30-bse-name-history/native-apply-audit-20261030.json).
Those screenshots close the earlier native report-viewing gap. The subsequent
polish evidence below concerns the newer two-name run and preserves this earlier
receipt acceptance.

## Native user acceptance — 30 October 2026

Evidence is the user's screenshots and pasted clipboard values supplied in this
chat, around 13:04–13:09 IST, plus their explicit report that display preferences
survive an app restart. No independent new DB audit or native execution was run
by the agent for this update.

- PASS, user build log: renderer and Rust release build succeeded without warnings;
  portable executable verification reported SHA-256
  `D09ADFF66F7B2E75DB14B18F616E4364887BFFBD85484031D7E102D50394FD10`.
- PASS, screenshots: newer saved run `bse-names-1793339595079957000`, saved at
  11:23:15 IST, shows Applied 2 / All 2,845 / Skipped 1,310 / Duplicates 1,533.
  Visible-row summaries follow the selected outcome; counts remain full-run counts.
  The totals reconcile: 2 + 1,310 + 1,533 = 2,845.
- PASS, screenshots: applied rows use Saved company-name history and original
  review reasons remain available on hover. Skipped/duplicate reasons are visible.
- PASS, screenshots: search `kei` in All returns three matches, including ENKEI,
  without changing the outcome counts. This does not prove search intersection
  with a non-All outcome filter.
- PASS, screenshots/pasted text: source path and source/plan hashes are readable;
  the display omits the Windows extended-path prefix while the copied path retains
  the original prefix. Native source-path copy success feedback is visible. The
  pasted source hash is
  `c2207bf427ce41f9fbb2508dbdaa0dcf09b0ff40dff52d275db1e1d590576b83`;
  the pasted reviewed plan hash is
  `a1f9315f43a0762c8557439c66f33ed945b32f08d37a4b2deafb5b8363795548`.
  Both match the displayed evidence. This verifies copying, not an independent
  recalculation of source-file or plan hashes.
- PASS, user report: display preferences survive closing/reopening the app.
- The earlier 11:15:56 IST, 1,531-name run remains listed. The separate Current
  universe apply-history empty state does not describe company-name history.

## Remaining native limits

- Search combined with a non-All outcome filter and the clarified Corporate
  Actions validation reminder were not shown. Their existing automated checks
  remain separate evidence.
- Native clipboard rejection/failure behavior and other NSE/current-universe
  routes are not established by these BSE screenshots. Do not deliberately cause
  a failure or repeat an Apply solely to close this saved-report checkpoint.
- Existing intermediate-progress and other native route limits remain unchanged.
  These report checks provide no new Corporate Actions approval authority.

No application source, backend, database or receipt was changed in this acceptance
update. No new application tests, live Apply, portable build, commit or push was
performed as part of this documentation update.
