# BSE company-name historical importer

Implemented 30 October 2026 at `E:\TA Projects\EOD Charting Platform`.
User selected company-name history first, with Security ID changes held until
separate dated evidence is verified. This supersedes the earlier unsupported
BSE Historical tab; NSE's historical importer remains unchanged.

## Behavior

- BSE Historical now has **Refresh BSE Sources**, **Preview Historical Identity**,
  a separate company-name CSV input in Manual mode, source status, a persistent
  footer, and explicit confirmed **Apply Reviewed Historical Identity**.
- Search supports security code/current ID, old/new names and dates. Outcome,
  search scope and category choices use the existing per-database/exchange/source
  display settings. Categories use explicit source wording only; unproven equity
  membership remains **Unknown**, rather than using ticker patterns/company
  suffixes. Category/search filters never limit Apply.
- Apply saves dated name-only history plus one completed receipt atomically.
  Recent Applied has BSE name receipts, search, selected report/evidence settings,
  source/plan hashes, and IST saved times with UTC hover. Current-universe receipts
  remain in their own collapsible section, leaving the list area for name reports.
- Progress is indeterminate during source checks, counted during writes (at most
  95%), 99% while committing, and 100% only after successful COMMIT. Notification
  failure after commit is a refresh warning. A committed event remains truthful
  if the final reply is lost; retry report retrieval rather than Apply.

## Verified source and boundaries

Official page: [BSE Change of Company Names](https://www.bseindia.com/corporates/comp_name).
Observed all-history API: `https://api.bseindia.com/BseIndiaAPI/api/GetNameChanges_ng/w?year=&String=&Isnew=`.
The native response is `Table[]` containing `Scrip_code` (numeric), `co_oldname`,
`co_newname`, and `effective_date` (for example `03 Jul 2013`). Schema aliases were
not guessed. The parser rejects schema drift, invalid dates/codes, empty names,
HTML/oversized responses and unexpectedly small official populations.

Transport is direct-first with native browser recovery only for HTTP 403. Native
recovery permits the exact observed API/query and official page assets, rejects
query injection/other endpoints, and uses the existing bounded collector and its
cleanup. Refresh writes a unique staged source and hash manifest under
`reference-data/bse/name-history` in the selected database folder. Invalid fetches
do not replace saved sources. Preview requires a valid saved manifest/hash and
uses a read-only connection/transaction; it creates no tables or approvals.
General Source Health still checks its existing source list; name-source validation
is separately explained in the Historical source disclosure.

Matching uses **only exact BSE security code** in `instruments.bse_security_code`.
Missing codes are skipped; multiple matches and future dates are held. Same-name
case/whitespace variants are informational. Apply checks the destination path and
rebuilds the reviewed fingerprint under BEGIN IMMEDIATE. The fingerprint includes
source bytes/path/mode, mapping snapshot, plan and persisted event keys.

New rows in `instrument_identity_history` have exchange BSE, NAME_CHANGE, exact
names/date, and structured source-code/hash provenance. Old/new symbol and ISIN
remain NULL: current database metadata is not borrowed as event-time proof.
`current_symbol` is the exact matched current database ID for lookup only.
`bse_name_history_keys` deduplicates semantic security-code/date/name events;
`bse_name_history_apply_runs` stores complete immutable receipts. These two tables
are created only during deliberate Apply. Receipt summaries are limited to 50;
the selected full report is loaded separately.

This importer does not update current instrument names, trading IDs, lifecycle
flags, raw prices or financial approvals. Current-master reconciliation continues
to own current metadata. BSE published name dates are not advertised as Security
ID transition/ex-date proof. Security ID history remains unimplemented and held.

## Source evidence

- [Final native proof](native-proof-1793304026458197400/proof.json): PASS, 3.70 s,
  386,630 bytes / 2,843 source rows, strict final parser; no database opened/applied.
- [Captured API response](native-proof-1793304026458197400/official-name-history.json):
  SHA-256 `a76264c0b2f085ea0071a7d4a260eb44c2dd4c4618344d0e9895c8fcb8c17a72`.
- [Page-export CSV](page-export-Comp_Name.csv): 2,824 rows;
  SHA-256 `cc49ba95c34bc89d43072e6d60f7e38d9819e7f9bf8f5e60726b15c8cbf198a3`.
  Comparing trimmed code/name/date tuples finds 19 API-only records and zero
  CSV-only records, with eight exact duplicate tuples in each source. The cause
  of the page export omission is not established. Official refresh uses the API;
  manual CSV retains manual provenance. CSV accepts only the verified four headers
  and empty unnamed overflow; non-empty overflow and missing fields fail.
- First discovery capture is also retained under
  `native-proof-1793303233854903400`; deterministic parser tests use those bytes.
  Isolated native profiles are retained as evidence; no logged-in browser profile
  or production database was used.

## Files and preservation

Backend: `bse_identity_imports/name_history.rs` plus focused tests, command exports
in `bse_identity_imports.rs` / `database.rs` and registration in `main.rs`.
The existing transport canonicalizer gains sibling visibility only.
Renderer: `identity/BseNameHistory.tsx`, Historical source slots in
`IdentityImportWorkspace.tsx`, parent wiring in `DatabaseToolsDialogs.tsx`, typed
desktop contracts/platform bridge and focused UI/bridge tests.

Primary pre-edit backup:
`backups/pre_opencode_changes_20261030_010443_bse_company_name_history`.
An additional transport-visibility reference snapshot is retained at
`backups/pre_opencode_changes_20261030_012144_bse_names_transport_visibility`.
The large pre-existing dirty worktree was preserved. No agent release/portable build,
live database Apply, raw-price write, financial approval, commit or push occurred.

## Validation and remaining acceptance

- PASS: 6 new focused Rust tests, including retained real response, read-only
  preview, exact/multiple/unknown code matches, future holds, source/database
  drift, name-only persistence, receipt/progress atomicity, forced rollback and
  unchanged-repeat no-op.
- PASS: affected BSE regression filter, 30 tests; two explicit native proofs are
  ignored by default. Final name-source native proof was run separately and passed.
- PASS: final renderer typecheck/whitespace profile, 46 focused UI/bridge/report
  tests across seven files, new-module Rust format check, documentation references,
  and final scoped whitespace/UTF-8 checks.
- The initial direct Vitest command unintentionally selected old `tmp` source
  snapshots; it was stopped. Corrected runs use the package runner's `--exclude tmp/**`.
  One new timestamp assertion exposed 12-hour display; the implementation now
  reuses the established 24-hour IST/UTC formatter and the corrected test passes.
- PASS, user native screenshots: BSE Refresh saved 2,843 source rows; Preview
  showed 1,531 new names, two duplicates, 1,310 skipped and zero held. These are
  preview counts, not a completed Apply receipt.
- PASS, user visual acceptance on 30 October 2026: after the shared CSS follow-up
  added an 8 px border-box inset and prevented title wrapping, the user supplied
  the [updated maximized BSE screenshot](native-spacing-accepted-20261030.png)
  and confirmed "Correct now". Heading, controls, table and footer are visibly
  inset from the window edges. The reported edge-spacing defect is closed.
  The spacing change also passed CSS parsing/declaration and documentation checks.
- PASS, later user Apply: native confirmation and completed green 100% status,
  APPLIED rows and disabled Apply are visible in the retained screenshots below.
  A separate read-only audit of the manifest-resolved database confirms receipt
  `bse-names-1793339156414000500`, saved 30 October 2026 at 11:15:56 IST, with
  1,531 new names, two duplicates, 1,310 skipped and zero held. All 1,531 events
  match persisted name/date/current-ID fields, security-code/source-hash provenance,
  BSE NAME_CHANGE scope and NULL old/new symbols/ISIN. Zero mismatches or dangling
  keys; zero audit-connection writes. See the [persisted audit](native-apply-audit-20261030.json),
  [native confirmation](native-apply-confirmation-20261030.png) and
  [native completed status](native-apply-completed-20261030.png).
- PASS, subsequent screenshots: native Recent Applied displays the saved run,
  timestamp and expanded source/plan hashes matching the persisted audit. The
  later [report polish](../2026-10-30-identity-report-polish/REPORT.md) preserves that
  receipt and adds counted outcome filters, copyable evidence and saved wording.
- NOT TESTED: post-fix floating-window/NSE layouts, native scroll interaction,
  restart preference persistence, native acceptance of the later report polish and
  intermediate progress percentages. No before/after comparison establishes
  unrelated instrument/price data parity. The agent did not repeat Apply.

Refresh, Preview and the reported spacing correction now have native evidence;
another rebuild is not pending for this documentation closeout. Continue normal
review of the code/date/name evidence, counts and held coverage. Apply only if a
legitimate actionable plan is intentionally accepted; a zero-change preview
correctly disables Apply. The remaining acceptance checks above are separate
from the accepted maximized-window spacing fix.

## Subsequent confirmation UI correction

The user later rejected the generic browser confirmation popup. All Identity
Apply routes now use the [shared in-app confirmation](../2026-10-30-identity-confirmation/REPORT.md)
with explicit destination/counts and Save/Cancel actions. This later runtime
change was subsequently confirmed in the user's native screenshots, followed by
successful BSE Apply and the persisted audit above. The earlier spacing acceptance
remains valid. Native pre-polish report viewing is also confirmed; the later
report-polish and restart checks remain separate.
