# Current Handoff

## Saved Identity report polish - 30 October 2026

**Native report display, outcome filters, hover evidence and clipboard success
confirmed by user screenshots/pasted values; restart persistence confirmed by the
user.** The earlier blanket native deferral is superseded for these checks.
No new Apply, build or live test is required to repeat this evidence.

The user rebuilt portable successfully without warnings after the 14-warning
Rust cleanup; portable staging verified SHA-256
`D09ADFF66F7B2E75DB14B18F616E4364887BFFBD85484031D7E102D50394FD10`.
Native screenshots around 13:04–13:09 IST show saved BSE name-history run
`bse-names-1793339595079957000` (11:23:15 IST): Applied 2 / All 2,845 /
Skipped 1,310 / Duplicates 1,533. Counts reconcile and remain unchanged between
outcome views. Applied reasons say Saved company-name history; hover preserves
the original review reason. Expanded source/plan evidence is readable.

Search `kei` in All shows three matches, including ENKEI, while full-run counts
stay unchanged. The user pasted the full source path including its original
Windows extended-path prefix and both hashes; these match the displayed evidence.
The friendly path omits the prefix, and native source-path copy success feedback
is visible. App restart display-preference persistence is user-reported working.
The earlier 1,531-name run remains listed; the separate Current universe history
empty state does not indicate loss of company-name reports.

Limits: search combined with a non-All outcome filter, the clarified Corporate
Actions validation notice, native clipboard denial/failure handling and other
NSE/current-universe routes are not established by these screenshots. Keep their
automated coverage distinct from native acceptance; do not infer financial
approval or new live-data acceptance. Existing intermediate-progress limits remain.

Prior automated evidence remains: 41 focused UI tests, renderer typecheck,
CSS/docs/whitespace checks and an isolated production-component preview using
synthetic rows/mock clipboard. This update changes documentation only; no app
validation, backend/DB/receipt changes, live Apply or portable build was run.
See [scope, evidence and remaining limits](docs/changes/2026-10-30-identity-report-polish/REPORT.md).

## Identity Apply confirmation replacement - 30 October 2026

User rejected the generic `tauri.localhost says` confirmation popup. Replaced all
four Identity Apply confirmations (NSE/BSE Current universe, NSE historical, BSE
company-name history) with one themed in-app modal: visible database, full-plan
counts/scope and explicit Save/Apply plus Cancel controls. BSE's button names the
new-name count; duplicates/skipped/held remain separately labelled unchanged.
Cancel is initially focused; Escape/Close cancel and preserve preview. Pending
confirmation is invalidated by database/source/plan/view changes or unmount and
cannot be accepted twice. Backend writes/rechecks/receipts remain unchanged.

PASS: 50 focused UI/gate tests, renderer typecheck, CSS parsing, documentation
references and scoped whitespace/UTF-8 checks. Isolated interactive
component/CSS preview verified default focus, Tab trapping, Escape/Enter cancel,
focus restoration and visible actions at 1280x720 and 800x500. The preview has no
database bridge; no live Apply occurred. Temporary server/tab/viewport override
were closed/reset. The user's later native screenshots now show the replacement
dialog and successful BSE name Apply, green 100% completion, APPLIED rows and a
disabled Apply control. Read-only persisted evidence confirms run
`bse-names-1793339156414000500`, saved 30 October 2026 at 11:15:56 IST: 1,531 new
names, two duplicates, 1,310 skipped, zero held. All 1,531 receipt events match
saved name-only history/provenance; zero mismatches/dangling keys; audit writes
zero. Later user screenshots also confirm native Recent Applied and expanded
run evidence for that receipt. Intermediate progress and app restart persistence
remain unverified. This closeout did not repeat Apply or change runtime code.
See [implementation, screenshots and validation](docs/changes/2026-10-30-identity-confirmation/REPORT.md).

## BSE company-name Historical identity - 30 October 2026

User explicitly selected company-name history first; Security ID history remains
held pending separately verified dated evidence. BSE Historical now has its own
Refresh BSE Sources, Preview Historical Identity, source disclosure/manual CSV,
search/outcome/category controls, status/footer, confirmed Apply and Recent Applied
name-only receipts. This supersedes the unsupported BSE Historical description
in the earlier shared-exchange checkpoint below. NSE behavior remains unchanged.

Official BSE company-name page/API were inspected and captured before parsing:
2,843 API rows, 2,824 page-export rows; 19 API-only records, no CSV-only records.
Official refresh uses the exact observed all-history API, with 403-only native
recovery, strict schema/population/hash validation and unique staged sources.
Preview opens read-only; exact BSE security-code matches only. Missing/ambiguous
codes and future dates do not become guessed trading IDs. Confirmed Apply rechecks
source, destination and database fingerprint in one transaction, saves name-only
history plus receipt, and reports 100% only after COMMIT. Instrument names/IDs,
lifecycle, raw prices and financial approvals are unchanged by this name importer.
Source categories without explicit supporting wording remain Unknown.

PASS: six new Rust tests; 30 affected BSE tests (two native proofs ignored by
default); separately run final native name-source proof (3.70 s, no DB access).
PASS: renderer typecheck, 46 focused UI/bridge/report tests and new-module Rust
format checks. Documentation references and final whitespace checks are included
in the closeout report.
Native BSE Refresh, Preview, maximized-window spacing, confirmation and completed
Apply are confirmed by user screenshots plus the read-only persisted receipt audit.
Restart preference persistence, post-fix floating/NSE layouts, native report-polish
acceptance and intermediate progress remain unverified;
do not Apply live just to test. No agent release build, live Apply, raw write,
financial approval, commit or push by this phase.
See [scope, evidence, safeguards and checks](docs/changes/2026-10-30-bse-name-history/REPORT.md).

Later native screenshots confirm BSE Refresh (2,843 source rows) and Preview
(1,531 new names, two duplicates, 1,310 skipped, zero held); they do not establish
Apply acceptance on their own; the later Apply audit above supplies that evidence.
A CSS-only follow-up adds an 8 px inset to the shared NSE/BSE
Identity workspace and prevents its title wrapping in floating windows. Existing
table scrolling and footer CSS are preserved. On 30 October 2026, the user supplied
the updated maximized BSE screenshot and confirmed "Correct now": the inset,
single-line title, filters, table and footer spacing are accepted for that view.
This closes the reported edge-spacing defect; it does not prove other layouts,
scroll interaction, preference persistence or Apply. See the report's
[retained acceptance screenshot](docs/changes/2026-10-30-bse-name-history/native-spacing-accepted-20261030.png).

## Native chart checks closed - 29 October 2026

The user rebuilt/restarted and supplied native screenshots confirming the reported
axis/tool-overlay fixes and successful raw/adjusted reload notifications without
the previous failure toast. The later settled startup screenshot shows green
`EOD DATABASE` and range `1991-01-02` to `2026-10-26`; the user reports that the
temporary `Loading DB...` state clears after a few seconds. No status fix is needed.
The reported UI issues are closed. Rapid-toggle stress, database-switch/pending-read
races and comparison failure injection remain automated-only; full history
completeness is not established by these screenshots. See the
[native closeout and preserved evidence](docs/changes/2026-10-29_CHART_NATIVE_ACCEPTANCE_CLOSEOUT.md).
No next implementation task has been selected; wait for the user's next scope.

## Adjustment-mode reload race - 29 October 2026

User authorized the fix with a pre-edit backup. The `default_price_mode` preference
save no longer invalidates chart price caches; other mutations still do. Adjustment
reload batches now prioritize the active tab and stop older queued work after a
new mode replaces it. Typed stale-read cancellations retry once only while the
owning tab/database/mode remains current; obsolete reads cannot publish. Comparison
hydration propagates cancellations and real failures instead of silently returning
empty history. A mode confirmation appears only after the open instrument tabs
have loaded that mode; the toolbar describes a requested mode truthfully while
its prices have not loaded. Genuine background-tab errors identify that context.
PASS: 37 focused tests across IPC freshness, request ownership/mode queues and
toolbar controls; renderer typecheck and scoped whitespace. Pre-edit backup:
`backups/pre_opencode_changes_20261029_163343_adjusted_mode_reload_race`.
See [the implementation report](docs/changes/2026-10-29_ADJUSTED_MODE_RELOAD_RACE_FIX.md).
User native screenshots now confirm ordinary Adj OFF/ON reload completion with
WIPRO retained and no superseded-request failure toast. Rapid-toggle stress is
covered by automated tests, not explicitly attested by the user's screenshots.
No backend/data modification, release build, commit or push occurred.

## Chart date axis and tool-status overlay - 29 October 2026

The next 13 native screenshots confirm daily/weekly density, collision removal
and tool-status removal. Follow-up for monthly image 11 removes its separate
36-candle year-only cutoff: monthly axes now select month/quarter/half-year/year
labels from pixel spacing, with month names (no day numbers) at close zoom.
Image 6's April-to-June sequence is explained by the current WIPRO `.eod` file:
its adjacent dates are 2025-04-30 and 2025-06-02, with no May 2025 bars. This is
not label suppression; no data or date-spacing change was made.
PASS: 29 focused tests and renderer checks; actual monthly aggregation/calendar
replay and browser-axis evidence are recorded in
[the monthly follow-up](docs/changes/2026-10-29_MONTHLY_AXIS_DENSITY_AND_MAY_LABEL_REVIEW.md).
The user's later four native screenshots confirm the monthly quarter/half-year
labels, yearly spacing and crosshair date formats. This reported axis issue is closed.

Native screenshots confirm the tool-status badge is absent and starting years
no longer overlap. A remaining 1,104-to-1,237-slot density transition was reproduced
with the existing WIPRO calendar at 1,395 CSS pixels. Follow-up now uses equal
48px month/quarter spacing, a half-year step before years, and calendar-only
ticks on coarse views (removing isolated sampled/future month labels).
PASS: 22 focused chart tests, renderer typecheck/whitespace, and browser-canvas
inspection using actual WIPRO tick positions. Installed AmiBroker 6.20.1 notes
and official help were inspected as reference; AmiBroker itself was unchanged.
See [the follow-up report](docs/changes/2026-10-29_CHART_AXIS_DENSITY_FOLLOWUP.md).
The user's next rebuild/screenshots confirmed these daily/weekly improvements.

Removed the persistent lower-left tool-status/instruction badge for every tool.
Date labels now follow pixel-based calendar density and a shared collision layout;
the renderer uses actual font metrics after edge clamping. Real year transitions
have priority over first-point context, with month/day detail appearing as zoom
permits. Bar/date coordinates and drawing geometry are unchanged.
PASS: 20 focused tests, renderer typecheck/scoped whitespace, and actual-module
browser-canvas inspection; the temporary tab/server were stopped. Evidence is in
[the implementation report](docs/changes/2026-10-29_CHART_TIME_AXIS_AND_TOOL_OVERLAY.md).
The earlier rebuild included this and the request-consistency fixes below.
No data/backend operations or release build occurred during that work.

## Chart history request consistency - 29 October 2026

User clarified this is a history-loading/display regression investigation, not
a data-loss or backfill task, and approved the deeper audit's corrections.
Implemented generation-safe, database-scoped caches; real forced refresh through
both layers; shared tab/request ownership guards; pinned backend folder/connection;
strict binary decoding; visible hydration errors and truthful loaded-mode flags;
and the tiled-header index gap guard. Existing data, drawing geometry and price
adjustment/approval rules are preserved. No historical source route was changed.
Read-only selected-data parity: 3,622 NIFTY bars match direct JSON versus the
actual TypeScript decoder in raw and adjusted modes; all five checked source-file
hashes remain unchanged. Rust module: 24 passed/2 explicit ignored; explicit
read-only capture: 1 passed. Final selected renderer/parity tests: 47/47 PASS;
renderer typecheck, scoped whitespace and test-source formatter checks PASS.
Native limitations and evidence are
recorded in [the implementation report](docs/changes/2026-10-29_CHART_HISTORY_REQUEST_CONSISTENCY.md).
The user has since rebuilt/restarted and supplied the scoped native chart checks
above. Full history completeness and deliberate pending-read/database-switch race
acceptance remain unverified natively. No download, data repair, agent-run release
build, commit or push occurred during this work.

## NSE Index historical alias resolution - 29 October 2026

The NIFTY screenshot gap was traced to separate SPCNXNIFTY/CNXNIFTY/NIFTY
binary histories without identity links. A shared explicit index registry now
joins available history on chart reads and normalizes future imports consistently.
No data files are rewritten. Conflicting overlapping bars fail with date/symbol
evidence; exact-symbol reads and existing identity events remain available. Long
index gaps suppress misleading change figures. Prefilter logs now distinguish
exchange-day status from per-index coverage and disclose the 31-date scan limit.
PASS: alias tests 11/11; chart-loader tests 24 passed/1 existing ignored; NSE Index
tests 3/3; renderer tests 6/6 and typecheck. A read-only probe found 3,622 available
NIFTY records, no conflicts across 26 stored alias families, and unchanged hashes
for all 65 inspected files. Check details and pending native acceptance are recorded
in [the implementation report](docs/changes/2026-10-29_NSE_INDEX_ALIAS_HISTORY.md).
User's rebuilt screenshots show stored 2012 alias history without a download,
but exposed the React legend's independent open-price fallback. The visible
`ChartPriceLegendOverlay` now has the same missing-reference guard; 9/9 focused
component tests, renderer typecheck and scoped whitespace PASS. Follow-up details
are in the report. A further user
portable rebuild/restart is required for this UI correction. Historical completeness
is not inferred from the visible viewport; no backfill or data repair is authorized
as part of this correction. See the newer request-consistency checkpoint above.

## BSE Identity master HTTP 403 recovery - 30 October 2026

User reported `BSE Active master download failed: HTTP 403` from official
LitsOfScripCSVDownload before Preview/Apply. Identity master now has direct-first,
403-only recovery through the existing bounded native browser download collector,
with exact Active/Delisted/Suspended endpoint scopes and complete CSV/population
validation. It publishes a unique staged source only after all three statuses
pass; it does not overwrite the prior saved master or apply database changes.

Complete-bundle checks also fixed canonical CURRENT parsing and empty unnamed CSV
overflow shifting the lifecycle tag. Missing/non-empty overflow still fails.
PASS: 5 focused deterministic transport/parser tests, 24 BSE identity tests and
6 existing Bhavcopy fallback adjacency tests. Isolated live native proof passed
in 20.99 seconds: browser recovery for all three official sources, producing a
merged master with 5,123 active / 4,604 delisted / 1,222 suspended symbols. Raw
source hashes and proof are retained under the report's native-proof directory;
no market database was opened/applied. Source counts retain the existing
current-first deduplication policy; the proof does not approve an Apply plan.
BUILD-01 initially held dispatch for another active build; it resumed after the
target was free, without interrupting a build or bypassing shared-target policy.
See the [BSE transport report](docs/changes/2026-10-30-bse-identity-403/REPORT.md)
for scope, backup, validation and remaining desktop checks. No live Apply,
financial approval, raw-price write, release build, commit or push by this phase.

## Shared NSE/BSE Identity Import workflow - 30 October 2026

User approved correcting the NSE-only interaction/reporting workflow. Both
Current universe paths now require a matching actionable reviewed preview and
explicit full-plan confirmation; they share renderer progress, committed status
and refresh-warning handling. BSE adds transactional receipts and operation-scoped
progress; both backends reject zero changes and destination database changes.
NSE additionally rechecks its fingerprint inside the write transaction.

Recent Applied includes Current universe receipts for both exchanges, preserving
BSE official IDs/codes. NSE historical receipts/legacy history remain available.
BSE Historical identity displays its unsupported-coverage explanation with no
Apply action. No BSE historical adapter or speculative identity/category mapping
was added. Existing exchange-specific lifecycle/matching rules are preserved;
BSE no-op counts now match COALESCE writes and already-saved inactive statuses.
Switching exchange/source retains its saved search preference.

PASS: 19 BSE identity tests, 122 NSE identity tests (2 ignored), and 102 UI/bridge
tests. Native/restart/network/real-receipt acceptance requires the user's portable
rebuild and a future legitimate Apply; do not apply live just for testing. No live
database Apply, raw write, financial approval, release build, commit or push.
See the [exchange workflow report](docs/changes/2026-10-30-exchange-identity-workflow/REPORT.md)
for backups, exact boundaries, validation and desktop acceptance steps.

## Historical identity receipts, preferences and categories - 29 October 2026

User approved categories/persistence and requested Recent Applied plus coloured
progress after accidentally clicking Historical Apply. Read-only live audit
confirms 44 saved NSE rows (14 symbol/17 name/13 BOTH) at 15:57:57 UTC, with
AMIRCHAND inactive OLD_SYMBOL and AEROPLANE active CURRENT. Old application had
no Historical confirmation dialog or run receipt; this gap is now repaired.
No live Apply/reversal was performed by this phase. Raw files/financial-action
records match the pre-apply snapshot; three later BSE metadata decisions are
separately identified in the audit, not attributed to the NSE run.

New Historical confirmation, zero-action/backend guard, truthful post-commit
status/progress and same-transaction receipts. Recent Applied reads summaries,
one selected full report, and a separate searchable legacy section (no fabricated
run receipts). Read endpoints are read-only. Tables are created only during a
future deliberate Apply. Display settings persist per DB path/exchange/source;
restored preferences never restore Apply authority. Categories use saved source
evidence with explicit Unknown; coverage is intentionally incomplete.

V3 reviewed policy now computes current-master effects before its single write;
the old pre-upsert hid real metadata effects and broke a zero-action guard.
Retained-copy proof: 44 history changes + 1 current metadata update; repeat zero
new changes/effects/errors, 140 native bars, durable receipt links all 44 IDs.
Financial/raw digests unchanged on the copy; strict same-day routing still fails.
PASS: 121 NSE Rust tests, explicit native replay, 90 UI/bridge tests and renderer
typecheck. User confirms prior mouse-wheel fix works. Later user screenshots
show category filtering, AMIRCHAND-to-AEROPLANE saved history, zero-action Apply
disabled, and legacy history in Recent Applied. Native confirmation, coloured
live progress, a new full run receipt and restart persistence remain unverified;
wait for a future legitimate change rather than repeating Apply for testing.
No release build, commit, push or preview server from this phase.

Layout follow-up: the user screenshot at 23:51 IST confirms expanded legacy
list height, visible search/headings and `29/10/2026, 21:27:57 IST` saved times.
UTC hover, the Historical Outcome heading, scrolling after this layout change,
and layout beside a full run receipt are not established by that screenshot.
Focused checks passed: 19 UI tests, renderer typecheck and whitespace. Evidence
and remaining desktop checks are in the
[history layout report](docs/changes/2026-10-29-historical-history-layout/REPORT.md).

Scope, backups, audit/proof files and exact native checks:
[historical reporting receipt](docs/changes/2026-10-29-historical-reporting/REPORT.md).

## Historical identity search and scrolling - 29 October 2026

User native preview now matches 14 symbol + 17 name + 13 combined new changes,
zero errors. UI-only review improvement: extracted IdentityHistoricalPreview,
added scoped old/current symbol/name/date search, change-type filter, shown/total
counts, Reset/Escape and in-list Ctrl+F. Existing outcome filters are preserved.
One native scroll region replaces nested page/body scrolling; search/filter
controls stay fixed and semantic headers are sticky. Current-universe effects
remain accessible under a disclosure. Apply still uses the full reviewed plan;
no backend/authority/DB/raw-price behavior changed.

PASS: 80 focused identity tests across 15 files; renderer typecheck and whitespace.
Actual browser wheel verification BLOCKED: in-app and Edge navigation timed out.
The temporary Vite server was stopped; port 5189 has zero listeners. Native wheel
and search acceptance remain NOT TESTED until the user rebuilds portable.
Backup, affected files, fixture and exact native checks:
[search/scroll receipt](docs/changes/2026-10-29-historical-search-scroll/REPORT.md).

## NSE historical identity repair - 29 October 2026

Implemented generic I4 component reconciliation in `nse_identity_imports.rs` and
new `nse_identity_imports/historical_reconciliation.rs`: explicit no-op skips,
exact dated component duplicate handling and missing-component-only writes.
Historical metadata preserves inactive targets; current master controls current
activation. Accepted rename old rows receive OLD_SYMBOL atomically. Reviewed plan
policy V2 requires a fresh preview; source/context gates and strict dated routing
remain intact. General identity/chart writers were not edited in this phase.

Retained-copy proof: baseline 10 errors -> zero; 14 symbol + 17 name + 13 combined
new history rows commit successfully. Repeat: zero new changes/errors. Nine old
symbols, including AMIRCHAND, become inactive OLD_SYMBOL; held count 62 -> 53,
outside coverage 990. Zero unsupported inactive-record reactivations. Native old
AMIRCHAND request resolves AEROPLANE, 140 bars ending 2026-10-26 close 206.15.
Financial table digests/raw hashes unchanged; same-day invalid chain still fails.
PASS: 115 NSE tests (serial and default concurrency), guarded native Apply/repeat,
16 price-loader tests and 12 reviewed-Apply UI contracts. Two guarded NSE fixtures
remain ignored in ordinary runs; the repair fixture was explicitly executed.

Live read-only recheck: AMIRCHAND still active/CURRENT, matching history count zero,
total_changes=0. No live Apply, financial approval, release build, commit or push.
User must rebuild portable, review a fresh Historical identity preview and choose
explicit reviewed Apply. Rebuilt chart title/count acceptance remains NOT TESTED.
The remaining 53 held records need separate evidence, not automatic deactivation.
Backup, retained fixture, commands and receipt:
[historical repair report](docs/changes/2026-10-29-historical-identity-repair/REPORT.md).

## AMIRCHAND read-only identity investigation - 29 October 2026

Official NSE circular CML75196 confirms AMIRCHAND -> AEROPLANE effective
2026-07-20. Saved symbol-change CSV already contains it; current master lists
AEROPLANE. Both DB instrument rows are active with the same full ISIN, but no
matching persisted identity-history edge exists. Current-universe lifecycle uses
persisted history, while chart loading includes same-ISIN files and can retain the
old requested title. Raw files split correctly: old 72 records ending July 17,
new 68 starting July 20 and ending October 26 (close 206.15). Screenshot says 148
bars versus 140 distinct raw dates: count discrepancy remains unverified.
Nine of the 62 covered absences have direct current-master successor candidates in
the saved official CSV. Only AMIRCHAND's separate circular was researched. Recommend
repairing generic historical identity import and reviewed persistence; do not
hardcode a symbol mapping or weaken guards. SQLite mode=ro/query_only/read transaction,
total_changes=0. No runtime edits, tests, previews, applies or raw rewrites occurred.
See [investigation, proof and next phase](docs/audits/2026-10-29-amirchand-identity/REPORT.md).

## Identity Import zero-action Apply gate - 29 October 2026

NSE Current universe Apply now requires a nonzero activate/update/deactivate count
as well as the existing reviewed preview authority. Informational-only previews
say Up to date - nothing to apply; held/outside-coverage rows remain inspectable.
The handler also refuses zero-action or already-applied results before invoking
Apply. PASS: 91 focused UI/bridge tests; renderer/docs checks in the linked receipt.
No backend changes, database writes or portable builds. User rebuild required.
See [scope, backup and checks](docs/changes/2026-10-29_IDENTITY_ZERO_ACTION_APPLY.md).

## Identity Import list-area compaction - 29 October 2026

User screenshots plus a read-only saved receipt confirm the new terminal apply UI:
one REFRACTORY update, 62 held, 990 outside coverage, no deactivations. The next
UI-only patch consolidates header/navigation, folds source/status detail, slims the
completion strip, and combines Find with outcome filters. List area targets 70-80%
of usable desktop tab height. Current Chart no longer wraps. No backend/apply or
approval rules changed. Backup and focused checks are recorded in the report.
Actual rendered ratio/native visual acceptance remains pending: both local browser
navigation attempts timed out. The temporary Vite preview was stopped. User portable
rebuild required. Old/new metadata-field comparison remains a separate backend gap.
See [receipt, screenshots, scope and acceptance](docs/changes/2026-10-29-identity-list-layout/REPORT.md).

## NSE Current universe apply status and receipts - 29 October 2026

Added counted backend progress (below 100 until commit), a green completion result,
Applied/Held/Outside-coverage result filters, and atomic saved apply receipts under
Source diagnostics. The footer no longer describes a committed run as a preview.
Screen refresh failures are separate from successful database commits. History
uses a read-only connection and never supplies apply authority. Old runs are not
backfilled. Screenshot total is 291 changes; Activate 30 includes the 7 new rows.
PASS: 105 NSE Identity Rust tests (1 existing ignored), 86 UI/bridge tests. Final
renderer/UI checks are recorded in the linked receipt. User portable rebuild and
native visual acceptance remain required. No live apply, downloads or release build.
See [scope, backups, checks and acceptance](docs/changes/2026-10-29_IDENTITY_APPLY_STATUS_AND_HISTORY.md).

## NSE lifecycle coverage — Phase 1, 29 October 2026

Implemented the first remediation from the identity audit. Absent NSE instruments
outside the equity/SME source's supported series are OUTSIDE_COVERAGE; unexplained
covered absences are REVIEW_REQUIRED. Both remain ACTIVE and are excluded from
the deactivation writer. OLD_SYMBOL requires a non-self, unique dated transition
path to a current-master successor; name/ISIN-only hints are insufficient. Covered
explicit delisting remains supported. Plan policy V2_COVERAGE invalidates old SHAs.

PASS: 39 Rust tests including a read-only SQLite snapshot replay, 78 UI tests and
renderer checks. On the snapshot: 3200 current symbols; activate 29, update 259,
deactivate 0; 990 outside coverage and 62 held for review, all ACTIVE. No live data
changes, source downloads, approvals or release build occurred. User portable
rebuild and fresh preview are required. The ten historical errors remain for the
separate no-op/transition/same-day chronology phases; this is not complete CA closure.
See [backup, scope, fixture retention and validation](docs/changes/2026-10-29_NSE_LIFECYCLE_COVERAGE_PHASE1.md).

## Independent saved source history — 29 October 2026

Fixed the blank advanced-maintenance dropdown with a source selector and explicit
Load / Refresh History, outside replacement discovery. The reader uses the existing
history platform command and shows versions/review decisions plus provenance.
Loading, empty/error states and stale asynchronous response invalidation are covered.
Database/exchange keys reset the reader; existing reviewed recovery handlers and
approval gates are unchanged. PASS: 78 Identity Import tests across 14 files and
renderer checks. Native acceptance is NOT TESTED; user portable rebuild required.
No live DB/source/approval operations or release build occurred. See
[receipt and backup](docs/changes/2026-10-29_IDENTITY_INDEPENDENT_SOURCE_HISTORY.md).

## Identity Import redesign and Phase 1B — 28 October 2026

Implemented the approved preview-first workspace: Current universe, Historical
identity (NSE), and Source diagnostics; visible per-view Apply footer; compact source
rows with a separate structured evidence inspector; raw JSON collapsed. Existing
reviewed handlers, fingerprints and confirmation gates remain in place. Database
changes clear displayed identity previews. Source maintenance remains in diagnostics.

The retained HTTP-200 company-name response confirms the missing aliases
`OLD NAME OF THE COMPANY` / `NEW NAME OF THE COMPANY`. Both are now supported;
all 2332 rows in the exact-byte fixture pass. PASS: 8 focused Rust tests, 70 UI
tests across 13 files, renderer typecheck/whitespace, protected-handler comparison.
No live DB operations/downloads/Apply/approval or release build occurred.
The browser preview could not load because CDP navigation/focus calls timed out;
the temporary Vite server was stopped. Native graphical/keyboard acceptance is
NOT TESTED. The user must rebuild portable before using the changes.
See [implementation, backups, evidence and acceptance checklist](docs/changes/2026-10-28-identity-import-redesign/IMPLEMENTATION.md).

## NSE Identity company-name diagnostics — Phase 1A, 28 October 2026

Approved diagnostic instrumentation is implemented in the existing Source Health
and Refresh paths. Failed company-name responses retain exact bytes plus a JSON
receipt under `reference-data/NSE/Identity/Diagnostics/`, separate from saved import
files. UI evidence exposes the capture path, headers, hash, status and validation
context; missing columns and blank record values have distinct error details.
Acceptance rules and explicit identity/financial approval gates are preserved.
No live source fetch or database operation occurred during implementation.
The actual failing response remains unknown until the user rebuilds portable and
runs Check Source Health. Do not guess a Phase 1B schema fix from synthetic tests.
See [Phase 1A behavior, checks and native acceptance](docs/changes/2026-10-28_CA_IDENTITY_PHASE1A_DIAGNOSTICS.md).

## NSE Identity Import CSV header compatibility — 27 October 2026

Corrected the confirmed `Invalid NSE identity date: EFFECTIVE DATE` failure:
Identity Import and CA symbol-change parsing now share modern/legacy header aliases
and reject competing columns. Headerless Identity Import archives remain supported.
Company-name loading accepts explicit symbol/old/new/effective-date columns alongside
legacy `NCH_*`; malformed dates and missing values still fail closed. The actual
company-name response from the user's health screenshot was unavailable locally,
so native acceptance of that response remains open. PASS: 22 focused tests; one
explicit disposable-copy audit ignored. No live fetch/import, identity application,
CA scan/approval or build occurred. Saved-master freshness rules are unchanged;
the user rebuilds portable, then checks Source Health and previews through the
existing Identity Import workflow. See [scope, checks and limits](outputs/2026-10-27-nse-identity-csv-fix/REPORT.md).

## Simple Bhavcopy UI and automatic BSE browser transport fallback — 27 October 2026

User approved restoring the familiar Date Range / Update / Full History → **Start Download** workflow. The separate browser checkbox, codes, scope selector, source-only button and result panel are removed. Existing URL overrides and source alternatives remain first; normal BSE equity/index source errors can invoke an internal browser retry of official daily sources. NSE retains its existing URL alternatives. 403 is now a blocked-source error rather than the same outcome as a 404; confirmed missing sources do not trigger browser retries. Browser sessions are serialized and a per-run circuit stops browser attempts after refusal/repeated errors, while direct URL alternatives remain active.

New `bhavcopy/bse_browser_fallback.rs` handles official candidate/API filename indirection, payload shape, filename/date/origin restrictions, ZIP/CSV decoding and index normalization. Recovered daily-source CSV follows the existing staged importer and its durability/identity/series guards. The verified browser lifecycle is shared through a scoped request trait in `bse_price_history.rs`; Corporate Actions code is unchanged. The security-wise historical API is retained internally for evidence/diagnostics but is NOT silently treated as a complete Bhavcopy or converted to current ticker identities/zero-volume quotations. This does not invent unavailable historical archives or guarantee listing-to-present history.

Keep the preceding SQLite contention, worker-join, terminal progress, separate skip-count and local-date fixes. No live database changes are authorized during development/testing. Source backup: `backups/pre_opencode_changes_20261027_105140_automatic-bse-browser-fallback`. Validation/build receipt and remaining native visual acceptance: `outputs/automatic-bse-fallback-20261027/REPORT.md`. Earlier manual-browser UI instructions below are historical checkpoints superseded by this section.

## Bhavcopy history choice, SQLite contention and terminal state — 27 October 2026

User authorized a focused correction while keeping the verified browser collector. No live database updates are authorized during development/testing. The download-only BSE browser option is now available in Date Range and Full History; Full History resolves 1990-01-01 through the current local calendar day, independently of saved manual dates. It remains explicitly security-only, monthly, file-only and subject to the existing 50,000-window cap. Indices remain on their separate route; the archive action is explicitly labelled **Download & Import Bhavcopy**. Skips are shown separately from imported jobs.

Batch planning prepares the database once; staging uses existing read/write connections without schema/bootstrap work. One prepared result-log connection is reused under the writer lock. SQLite BUSY/LOCKED log writes have bounded retries; persistent failures remain errors. New `bhavcopy/batch_runtime.rs` owns stop/join cleanup on all exits, including result-log failures; unfinished network operations finish within existing request/retry bounds before the error returns. Binary worker caps, recovery journals, durability and financial approval rules are unchanged.

`src/features/bhavcopy/downloadRunState.ts` makes the command promise own progress lifetime. Both batch branches explicitly start and settle chart progress; late progress events cannot resurrect stopped runs. The runtime controller uses the same transition helper. Source backup: `backups/pre_opencode_changes_20261027_003345_bhavcopy-history-lifecycle-fix`. Validation, executable receipt and remaining native acceptance are recorded in `outputs/bhavcopy-history-lifecycle-20261027/REPORT.md`. The exact external/internal connection that held the user's earlier lock is not established by that log.

## Hide BSE T+0 instruments in normal search — 26 October 2026

User approved hiding BSE `#` instruments while preserving their data. `src/components/CommandPalette.tsx` now filters BSE symbols ending in `#` from normal symbol/command search and the palette's recent list before applying the exchange filter and display limit. The symbol-search subtitle explains the filter. The full Symbols browser, stored recents, existing chart tabs, instrument identities, ingestion and database remain unchanged. Source backup: `backups/pre_opencode_changes_20261026_234742_hide-bse-t0-search`. Renderer validation and updated executable build are recorded in `outputs/bse-t0-search-20261026/REPORT.md`; native visual acceptance remains a separate check.

## Manual BSE history source download — 26 October 2026

User selected **EOD Chart → Download Bhavcopy → Date Range**. The opt-in **BSE security-wise historical download** saves official T+1 source JSON, review CSV and SHA-256 manifests outside the database. It supports explicit six-digit codes and read-only lookup of known BSE codes. It never invokes Bhavcopy ingestion, identity reconciliation, Corporate Actions, or approval. User's current no-database-update boundary remains in force.

New backend: `src-tauri-shell/src/bhavcopy/bse_price_history.rs`; commands are registered through `bhavcopy/mod.rs` and `main.rs`. The browser lifecycle is adapted from the existing CA collector without changing CA modules. Requests are serial, split at calendar-month boundaries, limited to 8 MiB per response and 60 seconds; HTTP 403 or three consecutive failures stop the run. The native proof discovered that a broad full-year request silently returns only 31 records, so annual request windows were rejected before delivery. Completed files survive cancellation. Date/code/settlement checks reject mismatched responses; unknown volumes remain blank; incomplete/invalid OHLC rows are held in source JSON. Neither current ticker labels nor same-price observations are used as historical identity proof. T+0 and indices retain existing routes; all known codes is not the historical BSE universe.

Renderer changes are in `BhavcopyDownloadWindow.tsx`, the desktop bridge/types, and `src/features/bhavcopy/bseHistoryDownload.ts`. Pre-edit source backup: `backups/pre_opencode_changes_20261026_231505_bse-history-date-range`. Validation and native proof results are recorded in `outputs/bse-date-range-history-20261026/REPORT.md`. Desktop visual acceptance is a separate check; no normal app/database launch is required by the isolated source proof.

## BSE securities and indices history build — 26 October 2026

User authorized all available official BSE history through today, securities and
indices. A backed-up live backfill has completed through 2026-10-26 in the existing
single `EOD DATABASE` root. Status is PARTIAL official coverage, not all-history
complete: 26 known security trading sessions remain unavailable, 70 of 149 index
range exports were unavailable, and legacy numeric-code to ticker identity chains
were not guessed. Public securities archive routes were checked for every calendar
date from 1990-01-01; retained source coverage starts 2006-03-01 (5,098 sessions).
Complete published index OHLC starts 1991-01-02; earlier/other incomplete OHLC rows
remain in retained sources without fabricated candles. Current daily snapshots
supplement index range exports from 2024-12-26. Three conflicting OHLC rows and 49
conflicting volume rows from daily sources were held; the latter were reversed to
the preceding range-export state with a normal journaled 49-row import receipt.
All 16,715,161 eligible security source rows, 156,551 range-index rows and 45,774
admitted daily-index rows compare exactly to stored raw records. Source guards,
normal price-store permit/recovery, two binary workers and immediate historical
durability were retained. NSE raw files/metadata and 27 protected financial/settings
tables are unchanged; no financial approvals occurred. Existing 754 NSE files with
duplicate dates are unchanged and separately recorded, not repaired in this scope.
Current BSE ISIN updates came through normal dated official ingestion; CCAVENUE's
current ISIN now reflects 26 October, but its earlier transition boundary remains
unresolved. The preceding repair checkpoint's "unchanged" claim was at that time.
Source changes: `bhavcopy/ingestion.rs` protects newer BSE ISIN metadata during old
backfill; `bhavcopy/tests.rs` adds a chronological regression and explicit ignored,
guarded native maintenance runner. Focused debug/release tests and native imports
passed; installed desktop application rebuild/visual acceptance remain NOT_TESTED.
Full pre-build data copy: `backups/bse-build-before-20261026`.
Pre-edit source copy: `backups/pre_opencode_changes_20261026_195405_bse-history-build`.
Detailed scope, receipts and unresolved coverage: `outputs/bse-completion-20261026/REPORT.md`.
No commits, pushes or background import jobs remain. Corporate Actions stay paused.

## BSE settlement chart separation and bounded ISIN correction — 26 October 2026

User approved the next repair after the symbol-format audit. BSE `#` identifiers
are official T+0 symbols and must remain separate from regular T+1 price histories.
`src-tauri-shell/src/database/eod_data.rs` now filters cross-cycle alias/history
and same-ISIN candidates, with a second guard in the raw/hybrid price loader.
Same-cycle dated renames remain supported. PASS: 3 new regressions; module checks
16 passed / 0 failed / 1 existing manual acceptance ignored. Desktop rebuild and
visual acceptance are NOT_TESTED; existing binaries do not contain this source fix.
After exact official before/on-event identity proof and a guarded copy rehearsal,
13 BSE current ISINs were corrected in one live metadata-only transaction; 26 dated
identity observations were added without promoting CA imports. All protected table
hashes and all 25,347 raw-file sizes/mtimes were unchanged. Independent read-only
verification and SQLite quick_check passed. CCAVENUE remains unchanged: its
2026-10-13 event-date Bhavcopy has no row for code 539807, so the boundary is unresolved.
Database backup: `backups/bse-isin-confirmed-20261026/market-data.before.sqlite3`.
Source/handoff pre-edit backup: `backups/pre_opencode_changes_20261026_192536_bse-settlement-chart-routing`.
Receipt and remaining scope: `outputs/2026-10-26-symbol-format-audit/IMPLEMENTATION.md`.
No financial approvals, raw-price writes, Bhavcopy imports, commits or pushes.

## Single database root cleanup — 26 October 2026

User-authorized relocation completed with the app closed: active root is now
`E:\TA Projects\EOD Charting Platform\EOD DATABASE`, display name `EOD DATABASE`.
The previous `Nse` contents are directly in that root; the application profile's
database registry now points there. No financial actions were replayed.
Full pre-move backup: `backups/pre_opencode_changes_20261026_184815_database-root-cleanup/database-before`.
Its `archived-artifacts` sibling preserves the outer legacy `NSE.sqlite3` family,
three historical binary-state copies, and the empty former `Nse` folder.
PASS: all 25,365 original files backed up and SHA-256 verified; moved/archived
data files unchanged, with only the manifest label intentionally updated.
PASS: SQLite quick checks on disposable copies of main and binary-state databases,
including existing WAL. Native desktop reopening remains NOT_TESTED.
Evidence: `outputs/database-root-cleanup-20261026.json` and
`outputs/database-root-cleanup-20261026-integrity.json`. Corporate Actions remain paused.

## Database issue first; Corporate Actions paused — 26 October 2026

The database folder issue was addressed in the cleanup checkpoint above.
Do not resume CA implementation until the user reprioritizes that work.
Latest user approval is persisted: 4,288 actions (NSE 4,274 Dividends + 8 Splits +
3 Bonuses; BSE 1 Split + 2 Bonuses). Do not replay them. Native approval/refresh
completed in 16m32s; 13,735 related events refreshed. The footer only reported
the Dividend subtotal. Pending CA work: truthful live progress, combined result
summary, Checking-state investigation, stale timer labelling and history paging.
Native seed validation was 16m28s; unchanged warm performance remains unmeasured.

This checkpoint supersedes older current-status claims below.
See [CA resume checkpoint](docs/changes/2026-10-26_CA_PAUSE_DATABASE_PRIORITY_HANDOFF.md).

## Table exchange filter and overlapping Dividend work — 26 October 2026

User's latest native seed run completed 91/91 in 18m24s: 9,023 policy evaluations,
4,274 eligible / 4,749 ineligible, zero reused, 4,288 total Ready; no approvals.
User confirms no subsequent unchanged run yet, so native warm reuse is unmeasured.
Added a separate local Table exchange filter (All/NSE/BSE), including visible
approval scopes, selection/confirmation clearing and Clear all filters support.
Optimized repeated dependency-row hashing and same-date peer identity reads within
the existing transaction/batch only. Unchanged policy, external rechecks and writers.
New 100-distinct-symbol disposable benchmark: cold 16.228s → 11.755s; reopened warm
5.484s → 4.864s, all 100 reused, zero full policy evaluations. Not native projections.
PASS: 50 focused Rust tests, explicit benchmark, 32 renderer tests, scoped typecheck
and formatting/whitespace. No live scan/mutation/approval, desktop build/package,
commit or push. The user rebuilds; changed fingerprints require fresh seeding, then
an unchanged repeat for native reuse/timing acceptance. See the
[implementation/evidence record](docs/changes/2026-10-26_CA_TABLE_EXCHANGE_AND_DIVIDEND_OVERLAP_PERFORMANCE.md).

## Stage 2A Split/Bonus terms safeguards — 26 October 2026

First bounded slice implemented: shared negative rules block non-ordinary
securities, mixed capital reduction and unsafe/conflicting ratios before ordinary
Split/Bonus preparation or approval. Pending legacy eligibility is revoked while
preserving manual identity/source evidence; approved rows remain untouched.
Ordinary Split/Bonus, standalone consolidation and existing compound preparation
are preserved. PASS: 51 focused Rust tests, focused formatting/whitespace checks;
3 explicit audits/benchmark remain ignored.
The new guard is included in the Dividend policy fingerprint, requiring one fresh
seed validation after rebuild. No live data/approval, desktop build/package,
commit or push. The user rebuilds; native acceptance remains pending.
See [scope, checks and limits](docs/changes/2026-10-26_CA_STAGE2A_SPLIT_BONUS_TERMS.md).
Identity resolution, duplicate reconciliation and Demerger policy remain separate.

## Dividend compatibility performance correction — 26 October 2026

The first incremental implementation failed native performance: cancelled at
24/91 after 25m09s, with no completed new Dividend approval evidence published.
Corrected repeated broad queries/source parsing/context/file reads with shared
per-batch lookup maps and dependency groups, preserving a separate external
content/date recheck and the IMMEDIATE transaction. Diagnostic calls no longer
rerun general migrations/backfills. No persistent schema change or guard removal.

Controlled disposable benchmark (33,971 imports, 33,871 canonical rows, 100 related
events): cold 58.982s → 1.209s; reopened/no-change 56.875s → 1.038s, all 100 reused,
zero full policy evaluations. These are synthetic measurements, not native timing.
PASS: 15 incremental + 39 policy/bridge/history Rust tests, the explicit benchmark,
75 renderer tests, scoped typecheck/whitespace and focused Rust formatting. See the
[performance correction record](docs/changes/2026-10-26_CA_DIVIDEND_COMPATIBILITY_PERFORMANCE_FIX.md)
for exact scope, checks and limits. The user rebuilds; native corrected acceptance
remains pending. Changed dependency fingerprints require one fresh seed validation.
No live scan/data mutation, approval, desktop build/package, commit or push.

## Dividend incremental validation — 26 October 2026 (bounded slice)

Backend-owned immutable checkpoints/current pointers now compare import/evidence,
identity/source, date-valid price contents, related canonical/manual state,
policy/scope code and database lineage before reusing Dividend outcomes. Only
stale/uncached IDs run full policy; compatible blockers are reusable too. P1
renderer reports are never reuse authority, so the user's rebuild needs one fresh
seeding validation. UI/report counts distinguish reuse from full-policy work.
PASS: 50 focused Rust tests (11 incremental, 13 prepared-scope/bridge, 22 policy,
4 history), 75 focused renderer tests, scoped renderer typecheck/whitespace and
new-module formatting. Disposable restart reuse performed zero policy evaluations.
See [implementation and validation](docs/changes/2026-10-26_CA_DIVIDEND_INCREMENTAL_VALIDATION.md)
and [dependency contract](outputs/2026-10-26_CA_DIVIDEND_INCREMENTAL_DEPENDENCY_CONTRACT.md).
Financial approval rechecks and the targeted post-approval workflow are preserved.
No live migration/scan/approval, desktop build, packaging, commit or push was run.
Native incremental acceptance/timing remain pending; the user rebuilds.

P1 native persistence/reopen is now PASS from user-supplied evidence: 9,023 results
(4,274 eligible, 4,749 ineligible, zero failed), 91/91 batches in 13m48s; after
restart Loaded 0, Reports reopened 400/9,023 saved rows without scanning. This does
not establish native incremental Load & Validate acceptance.

## P0 and bounded P1 persistent validation history implemented — 26 October 2026

The P0 ownership/schema map and first additive P1 slice are implemented. Dividend prepared-scope outcomes now save one immutable database-bound activity header plus import-level disposition/reason/evidence snapshots in a separate Rust transaction owner; paged read-only APIs reopen the latest saved report from Reports without Fetch, scans or writers. Saved `ELIGIBLE` remains historical evidence only and never reconstructs Ready/write-stage authority. New UTC instants are validated as UTC and displayed through the existing explicit Asia/Kolkata formatter. Existing legacy timestamps are untouched. PASS: four focused Rust disposable SQLite tests, 55 focused renderer tests, renderer typecheck, Rust formatting and scoped whitespace. No live database migration, live scan, approval, raw-price write, build or packaging was run. See [P0 ownership/migration note](outputs/2026-10-25_CA_P0_PERSISTENCE_OWNERSHIP_AND_MIGRATION.md) and [P1 change record](docs/changes/2026-10-26_CA_PERSISTENT_VALIDATION_HISTORY_P1.md).

Remaining P1 work includes Fetch/non-Dividend/cancelled-before-outcome lifecycle coverage; P2 general exports remain separate. The newer bounded Dividend reuse slice and P1 native reopen acceptance are recorded above; broader P3 revision/identity scheduling is still incomplete. Keep the 500-ID reconciliation export separate.

## Quick search native observations recorded — 25 October 2026

Local quick search matches only symbol/company/ISIN/BSE code and ranks exact symbols before prefixes and broader matches. PASS: 34 focused tests, renderer typecheck and scoped whitespace. After the user's rebuild, screenshots confirm HDBFS/hdb/hDbFs return the same 2 events, `ici` excludes unrelated source-text matches, ICICIGI returns 1 Ready event, and `ICICI` places exact 2001/2000 rows before newer prefixes. Full ISIN INE005A01011 matches the displayed Details value and returns 2 ICICI events; a nonsense query gives 0 shown/0 Ready with No matching events. Loaded stays 33,971, with the completed scan unchanged. User explicitly confirms Esc and × work. Whitespace padding, exact BSE-code lookup and measured typing speed remain unverified natively. The user specifically confirmed the value of the Details option; retain its source, ISIN and blocker explanations. No financial or data writes during implementation or screenshot review. See [search contract and native evidence](docs/changes/2026-10-25_CA_QUICK_SEARCH.md).

## Targeted approval refresh observed natively — 25 October 2026

The intermediate automatic full Load & Validate after approval is superseded: keep the full queue, reconcile exact stored rows in the affected symbol/full-ISIN group, recheck that group only, and retain unrelated verified readiness. Old confirmations expire; uncertain writes/refreshes remain invalidated. PASS: 88 focused tests, renderer typecheck and scoped whitespace. User screenshots after their rebuild show ICICIGI 1/1 committed with 2 related events refreshed in 4 seconds, then HDBFS 1/1 committed with 3 related events in 2 seconds; loaded 33,973 → 33,972 → 33,971 and Ready 4,290 → 4,289 → 4,288. No 91-batch rescan; HDBFS search and clearing search preserve the full queue; evidence-blocked rows remain blocked. The separate `ici` source-text false-match prompted the quick-search improvement above. See [refresh implementation and native evidence](docs/changes/2026-10-25_CA_POST_APPROVAL_QUEUE_REFRESH.md).

Earlier user screenshots also show HEGAM import 44439 (22 July 2026, Rs 3.40) committed and recorded in Recent approved actions at 17:43:54 IST, plus its native chart dividend marker. These establish the selected approval/report/chart-event path, not an adjusted/unadjusted July 21–22 price comparison or independent post-approval raw-price hash verification. Split approval, exhaustive/bulk acceptance and automatic fresh BSE master transport remain separate open boundaries. Identity Import stays advanced maintenance/recovery; normal Fetch → Load & Validate → explicit Approve Ready remains unchanged. The agent must not replay these user-performed approvals.

## Verified event-time price routing — 25 October 2026

Implemented an additive, read-only stable-full-ISIN event-price proof from retained official dated chains and exact fresh event witnesses. Shared by preparation, missing-window scanning and the guarded official writer; routed Dividend/Rights factors cannot borrow unrelated same-ISIN prices. Existing narrow identity-mismatch proof/manual behavior preserved; no identity migration or active-flag changes. PASS: focused Rust policy/writer/identity/scanner/math regressions, 43 frontend preservation tests and final-code guarded-copy audit. Of 91 candidates, 40 routes verify and 36 Dividends pass all production gates: HEGAM 18, GUJENERGY 10, DIGISPICE 5, ONIDA 3. All 36 simulated writes succeeded then forcibly rolled back; all copy tables and 43 original/copied price hashes unchanged. HEGAM July chart path checked in production code. Two routed Splits were not financially exercised; remaining identity/cash/peer blockers were not forced Ready. No live approvals/data writes or build. Rebuild/native observation remains deferred; subsequent fresh Load & Validate can consume retained evidence without mandatory refetch. See [contract, validation and receipts](docs/changes/2026-10-25_CA_EVENT_PRICE_ROUTE.md).

## Queue Exchange, history paging and HEGAM evidence — 25 October 2026

Implemented sortable/resizable Exchange in the main queue, newest-ex-date default/reset and 200-row Load more/Refresh in Recent approved actions. Preserved exact approval guards; no live financial or identity writes. PASS: 28 focused frontend tests, renderer typecheck and scoped whitespace; no Rust changes/build. Read-only lookup found the retained, hash-verified NSE CSV does contain HEG → HEGAM effective September 22, 2026, but local identity history has no transition. HEGAM stays blocked; governed routing/reconciliation of that retained evidence needs a separate focused implementation and copy validation. User screenshot confirms July dividend is blocked and recent approvals display with Exchange; newly added queue/paging UI awaits rebuild/native observation. See [changes, evidence and limits](docs/changes/2026-10-25_CA_EXCHANGE_HISTORY_PAGING.md).

## Ready/approval guard alignment and reports implemented — 24 October 2026

Implemented shared writer EOD readiness in Dividend R1, failed-row details with positively confirmed rollback wording, read-only last-scan/failure reports, and Reports → Recent approved actions (latest 200 persisted approvals, newest approval first). Approval attempts also invalidate the navigation Ready cache; historical report snapshots never authorize writes. PASS: 103 focused Rust tests, 20 frontend tests, renderer typecheck and scoped whitespace. Initial global wrapper whitespace check hit unrelated README trailing whitespace, preserved. No live approvals/data edits or build. Session scan reports are not disk receipts; saved approval history remains database-backed. Rebuild/native observation and fresh Load & Validate are next; BSE transport acceptance remains separate. See [implementation and measured checks](docs/changes/2026-10-24_CA_READY_GUARD_AND_APPROVAL_REPORTS.md).

## All Ready approval failure diagnosed — 24 October 2026

Guarded-copy production-writer diagnostic PASS: reconstructed first 100 eligible Dividends produced 99 transaction-local approvals and one HEGAM failure (import 44439, July 22, Rs 3.40); all rolled back, all main-table and price hashes unchanged. R1 preview accepts HEG's same-ISIN prices, while the ordinary writer requires HEGAM/event-time dated routing; no dated identity history exists for this pair. Do not weaken the writer or retry live All Ready. Runtime fix remains unimplemented: align readiness with writer checks, preserve failed-row details and read-only report history. Only an opt-in diagnostic test/module hook and this evidence record were added in this investigation. See [diagnosis and validation](outputs/ca-dividend-approval-diagnostic-20261024.md).

## User-approved live BSE metadata recovery — 24 October 2026

Applied the audited metadata-only delta after explicit user approval and a verified SQLite online backup. PASS: preparation, exact-plan rehearsal, one guarded live transaction and independent read-only verification. Filled 4,716 blank instrument codes; recovered 124/145 unmatched BSE imports; 21 evidence-blocked rows remain. Added 124 identity-only audit decisions. Protected hashes confirm no financial, approval, quotation, original source-evidence, instrument identity/lifecycle or other table changes. Backup and complete receipts: [live recovery record](outputs/ca-bse-live-recovery-20261024/README.md). Reopen EOD and Load & Validate (no Fetch or rebuild needed for this saved data recovery). Automatic fresh master collection is still unaccepted; do not confuse the successful one-off recovery with a transport fix.

## BSE missing security-code mapping — 24 October 2026 (live acceptance blocked)

Implemented exact official-ticker/full-ISIN metadata mapping, offline identity retry across unresolved/review/unsupported rows without clearing separate blocks, and retained-code presentation. Follow-up fixed the exact canonical page (`List_Scrips`, without `.html`) and allowed only empty trailing CSV fields. One live response retained 5,120 official master rows. Guarded fresh-copy audit PASS: 4,716 code-only instrument updates; 124/145 unmatched imports recovered, 21 remain evidence-blocked. Repeated final master collection attempts still timed out, including the normal master-first workflow; stop retrying and do not weaken guards. Hold rebuild for this fix: automatic fresh collection is NOT accepted. These implementation/audit runs did not change live data; the separately authorized live recovery is recorded above. See [implementation, audit and failure receipts](docs/changes/2026-10-24_CA_BSE_SECURITY_CODE_MAPPING.md).

## BSE automatic official fetch — 24 October 2026

Normal BSE Fetch now automatically falls back from direct HTTP to isolated native WebView2 collection, in seven-day windows with cancellation and persisted completed coverage. No manual CSV is required for this route. PASS: production-route live test (33 recent rows, 3 historical rows, empty periods, cached retry, cancellation), focused Rust tests, production Cargo check, renderer typecheck and 27 focused frontend tests. Live test used isolated in-memory SQLite: zero approvals/canonical actions; no live database changes. Rebuild and normal desktop UI acceptance remain pending; full 1990–2026 coverage was not tested. See [implementation, evidence and limits](docs/changes/2026-10-24_CA_BSE_AUTOMATIC_BROWSER_FETCH.md).

## Verified existing Dividend presentation — 24 October 2026

Implemented read-only Already Processed classification in the active classic queue and normal review adapter, requiring exact source/current identity proof, one matching canonical action, an approved source link, chart inclusion and matching historical factor. No approval fields or canonical rows are changed. PASS: 2 backend tests, guarded four-record actual-price audit, 26 frontend tests and scoped renderer validation. User screenshots establish old-symbol routing and March 2016 dividend behavior; other dates have production-code acceptance, not individual native screenshots. New classification UI requires rebuild/observation and valid evidence in the live database; source rows were not migrated or approved. See [proof, checks and limits](docs/changes/2026-10-24_CA_EXISTING_DIVIDEND_CLASSIFICATION.md).

## Dividend witness provenance fixed — 23 October 2026

Dividend R1 now selects one exact fresh official capture over matching backfills without changing evidence, and rejects conflicting/multiple independent fresh witnesses. PASS: 22 policy tests, 9 chain tests and guarded copy audit. All 39 audited identities reconcile; the four now pass the source gate but remain excluded because matching canonical dividends already exist under EBIXFOREX (IDs 10199, 9769, 8699, 7991; applied timestamps 10 June 2026). Source DB/EOD unchanged; no new approvals or rebuild. Next seam is existing-action linkage/ledger and renamed-symbol chart-routing audit before duplicate classification changes. See [fix and canonical matches](docs/changes/2026-10-23_CA_WITNESS_PROVENANCE_SELECTION.md).

## Four official witnesses recovered — 23 October 2026

Live NSE API returned all four exact historical DELPHIFX Dividend rows; response bytes/hash/manifest retained. A new guarded copy recovered all 39 audited identities (35 existing pair + 4 dated chain), with no financial approvals. The four newly recovered rows remain ineligible because Dividend R1 counts both legacy backfilled and fresh evidence under its exact-one-witness rule. Next focused seam: provenance-aware source-witness selection, retaining originals and strict rejection of conflicting independent witnesses. Runtime and source DB unchanged; no rebuild. See [collection/audit and remaining source gate](docs/changes/2026-10-23_CA_FOUR_OFFICIAL_ANNOUNCEMENT_WITNESSES.md).

## Dated symbol-chain contract checkpoint — 23 October 2026

Implemented the approved separate retained-source/provenance contract: explicit NSE Fetch collects the official symbol-change CSV; offline preparation and Dividend R1 independently recheck dated chains and exact announcement witnesses. No sealed authority or financial approval behavior was relaxed. Nine new contract tests and the focused resolver/recheck/Dividend regressions passed. A fresh guarded copy reconciled 35/39 via the existing pair proof; the new path recovered zero because the remaining four only have backfilled announcement evidence. Source candidates remain 7,847. No rebuild or source DB writes. See [implementation and evidence limits](docs/changes/2026-10-23_CA_DATED_SYMBOL_CHAIN_CONTRACT.md).

## Multi-step evidence checkpoint — 23 October 2026

Official NSE CSV now independently confirms WEIZFOREX → EBIXFOREX (2020-03-20) → DELPHIFX (2021-09-01); all four remaining Dividend dates precede the first edge. Raw source/manifest retained in `tmp/ca-multistep-chain-evidence-20261023`. The old referenced CSV path is missing and the new full-file hash differs from the sealed source. No runtime or source DB changes were made. A new multi-step proof/provenance contract is required; implementation scope and the major-change stop boundary are recorded in [evidence/plan](docs/changes/2026-10-23_CA_MULTISTEP_CHAIN_EVIDENCE_AND_IMPLEMENTATION_PLAN.md). Source candidates remain 7,847; no new Ready claim, approval or rebuild.

## Verified identity pair checkpoint — 23 October 2026

Fixed false ambiguity between a sealed, fingerprint-verified current-symbol resolution and its explicitly named inactive event symbol with exact dated ISIN history. A guarded disposable-copy audit reconciled 35/39 affected Dividends to Pending (candidate count 7,847 → 7,882), with zero approvals. Four longer DELPHIFX/EBIXFOREX/WEIZFOREX-chain events remain unresolved. This does not supply broad historical ISIN periods or a fresh Ready count. Source DB and EOD untouched; no rebuild. See [change/evidence record](docs/changes/2026-10-23_CA_VERIFIED_RENAME_PAIR_RECONCILIATION.md).

## Latest UI checkpoint — 23 October 2026

Follow-up: classic Types now supports checkboxes and All / Split + Bonus / Dividends / None presets. Fetch date scope is clarified; Load & Validate still covers all outstanding pending dates. Focused renderer checks and 30 tests passed. See [scope/results review](docs/changes/2026-10-23_CA_TYPE_QUICK_FILTERS_AND_SCOPE_REVIEW.md). Searchable symbol selection, explicit period validation and the lower Ready-count investigation remain proposed work.

CA classic workspace implemented after pre-edit backup: compact menus/two toolbars, virtual table, separate reports, responsive details and exact filtered Ready approval scope. Focused renderer validation and 43 tests passed; native rebuild/manual acceptance remains pending. Existing unrelated work is preserved. See [change record](docs/changes/2026-10-23_CA_CLASSIC_WORKSPACE_UI.md) and [visual QA](docs/changes/2026-10-23_CA_CLASSIC_UI_DESIGN_QA.md). Earlier acceptance statements below retain their original dates.

<!-- EOD-CANONICAL-STATUS-2026-10-17-R1 -->
## Current verified platform and Corporate Actions status — 17 October 2026 IST

**Integrated Corporate Actions R1:** approved normal workflow `Fetch from Officials → Load & Validate → Approve Ready`, implemented in the existing CA window without replacing advanced maintenance. Load does not automatically approve Split/Bonus. Future ex-dates remain scheduled and local EOD readiness must be satisfied before explicit operator approval; the backend rechecks readiness at approval. Existing adjustment ledger/transactions and chart-refresh hooks are preserved, but production write/refresh behavior has **not** been manually accepted.

**Current acceptance boundary (17 October 2026 IST):** source-integrated and native-validation **PASS** (62/62 focused Vitest, 2/2 focused Rust tests, renderer typecheck, frontend Vite build, offline Cargo check). Two isolated Windows release builds also **PASS**; the static-CRT EXE has no direct/delay VC runtime imports. **Desktop CA UI and chart-refresh acceptance remain NOT VERIFIED:** the first disposable Sandbox run lacked Visual C++ CRT DLLs, the static-CRT attempt then lacked WebView2 Runtime. Operator stopped; no manual CA pass, no real NSE/BSE network-fetch pass, no production CA write acceptance, and no portable installation acceptance.

**Plugin P5-FINAL:** metadata-only import/discovery/reload architecture is closed with third-party external JavaScript evaluation and activation still **DISABLED**. C2 did not prove production guest process/IPC isolation; no plugin activation is permitted by the CA documents. The three previously unattributed P1/P2 files were accepted by exact isolated reconstruction on 17 October.

**Still open:** actual normal desktop workflow observation; official-feed integration under separately authorized network conditions; non-destructive/controlled approval and chart/cache refresh manual verification; optional portable Windows packaging. No further test environment redesign or production database modification is implied by this documentation update.

**Evidence:** P1/P2 three-file authority 4B97997A5B55DE56…; native CA 762203D79459BC29…; first stopped desktop 8A41ADAF68C9BF4A…; static CRT stopped desktop 46D6BEA22CB1083A…. Full SHA256 identities and limitations are in the new docs reconciliation record.

**Next step:** first complete current canonical documentation. Subsequent normal Windows desktop observations require separate explicit approval. Preserve the existing workflow and production profile.
<!-- END-EOD-CANONICAL-STATUS-2026-10-17-R1 -->

<!-- STANDALONE-PLUGIN-ARCHITECTURE-P1-P3-2026-10-16:BEGIN -->
## Standalone External Plugin Architecture and SDK — P1–P3 status

- **Design boundary:** The EOD Charting Platform remains the protected core. Plugin Manager owns generic lifecycle controls; each plugin owns its own menu-opened interface and settings. External developers should integrate through the SDK and host interfaces rather than editing platform core code.
- **P1/P2 implemented components (reported, not independently reaccepted here):** `src/plugins/pluginHost.ts`, `src/plugins/types.ts`, `src/plugins/pluginLoader.ts`, `src/engine/ChartEngine.ts`, `src/components/SettingsDialog.tsx`, and `src-tauri-shell/src/plugin_data.rs` provide extension registrations, loading and user-facing controls. The SDK is in `packages/eod-plugin-sdk/` with a development sample plugin.
- **P3 accepted import-cycle fix (15 October 2026):** `src/plugins/hostRuntime.ts` owns the shared runtime singleton. Plugin registries, dynamic indicator registrations and scanners integrate through the lightweight host. The accepted P3 evidence records renderer typecheck PASS, six focused Vitest suites **22/22 PASS**, and renderer Vite build PASS; see `docs/changes/2026-10-15_1740_IST_P3_PLUGIN_IMPORT_CYCLE_LEAN_FIX_R1.md`.
- **P4 boundary:** This section records implementation state and verified P3 evidence. It does **not** establish a full installed external-plugin lifecycle, production/manual activation, security review or portable Tauri build. Existing charts, CA functionality and database behavior remain protected. Corporate Actions write activation is not authorized here.
<!-- STANDALONE-PLUGIN-ARCHITECTURE-P1-P3-2026-10-16:END -->


<!-- BHAVCOPY-MODULAR-REFACTOR-PHASES-1-TO-9-2026-10-15:BEGIN -->
## Completed — Bhavcopy Modular Architectural Refactor Phases 1–9 (2026-10-15 00:50 IST)

- **Classification:** `MODULAR_CODE_HYGIENE_AND_ARCHITECTURE_REFACTOR__ALL_VALIDATION_GATES_PASSED`
- **Historical plan reference (unavailable in the project root and docs tree as checked 16 October 2026 IST):** BHAVCOPY_MODULAR_REFACTOR_PLAN.md — reference retained for provenance; not an active file dependency.
- **Core Outcome:** Decomposed the ~7,980-line monolithic `src-tauri-shell/src/bhavcopy.rs` into a structured, highly maintainable subpackage (`src-tauri-shell/src/bhavcopy/`) with zero regressions and 100% backward compatibility for all 8 public Tauri IPC commands.

### Module Topology:
1. **`src-tauri-shell/src/bhavcopy/mod.rs` (1,118 lines):**
   - Public facade: `download_bhavcopy` (single) and `download_bhavcopy_batch` (batch).
   - Task worker pools, channel coordination, and batch planning execution.
2. **`src-tauri-shell/src/bhavcopy/types.rs` (246 lines):**
   - Core domain types: `BhavcopySettings`, `BatchDownloadConfig`, `DownloadResult`, `DownloadTask`, `StagedDownload`, `AppResult<T>`.
3. **`src-tauri-shell/src/bhavcopy/settings.rs` (194 lines):**
   - Persistent settings commands: `get_bhavcopy_default_templates`, `get_bhavcopy_settings`, `save_bhavcopy_settings`.
   - Settings validation, default configurations, and series exclusion normalizers.
4. **`src-tauri-shell/src/bhavcopy/transport.rs` (193 lines):**
   - HTTP/1.1 client configuration, connection pooling (10s idle, max 4 per host), session warming, candidate streaming, and causal error chain diagnostics.
5. **`src-tauri-shell/src/bhavcopy/calendar.rs` (455 lines):**
   - Market holiday commands: `list_market_holidays`, `add_market_holiday`, `delete_market_holiday`.
   - Special trading session overrides (Muhurat, disaster-recovery sessions), date math, 18:00 IST evening probe cutoff.
6. **`src-tauri-shell/src/bhavcopy/sources/` (308 lines):**
   - `sources/mod.rs`: `Candidate`, `CandidateKind`, `apply_template`.
   - `sources/nse.rs`: NSE Equity & Index candidate generators and referer headers.
   - `sources/bse.rs`: BSE Equity (UDiFF & legacy ZIP) & BSE Index candidate generators and referer headers.
7. **`src-tauri-shell/src/bhavcopy/parsers/` (722 lines):**
   - `parsers/zip.rs`: Bounded ZIP archive extractor with 128 MB security guard.
   - `parsers/json.rs`: BSE Index Arch JSON & NSE historical API row normalizers.
   - `parsers/csv.rs`: NSE/BSE UDiFF CSV parser, legacy EQ parser, IndexSummary parser.
   - `parsers/mod.rs`: `ParsedBhavcopyRow`, `ParsedBhavcopyFile`, duplicate symbol-date row detection.
8. **`src-tauri-shell/src/bhavcopy/ingestion.rs` (3,409 lines):**
   - SQLite download log tracking, transactions, and storage mode pre-filter queries.
   - Durability-governed binary writer pool (`write_bhavcopy_binary_records_parallel` preserving 2-worker default and 4-worker maximum cap).
   - Recovery journal session lifecycle: `prepare_bhavcopy_recovery_session`, `capture_recovery_binary_baselines`, `recover_pending_bhavcopy_sessions`, background checkpoint worker.
   - Fast-path baseline classification & shadow inspection engine.
9. **`src-tauri-shell/src/bhavcopy/tests.rs` (1,478 lines):**
   - Isolated unit tests covering parser parity, shadow classification, durability baselines, date window boundaries, and candidate URL templates.

### Validation Passed:
- `cargo test --bin eod-charting-platform-shell -- bhavcopy::tests::`: **50/50 PASS** (0.77s, 0 compiler warnings).
- `npm run typecheck:renderer`: **PASS** (0 errors).
<!-- BHAVCOPY-MODULAR-REFACTOR-PHASES-1-TO-9-2026-10-15:END -->

<!-- TECH-AUDIT-PHASES-1-TO-5C-2026-10-14:BEGIN -->
## Completed — Technical Audit & Internal Hardening Phases 1A-5C (2026-10-14 19:10 IST)

- **Classification:** `INTERNAL_PERFORMANCE_STORAGE_IPC_AND_SECURITY_HARDENING__ALL_VALIDATION_GATES_PASSED`
- **Report:** `docs/changes/2026-10-14_1910_IST_TECHNICAL_AUDIT_PHASES_1_TO_5C_COMPLETE.md`

### Key Deliverables:
1. **Multi-Layer Canvas & Memory Lifecycle (Phases 1A & 1B):**
   - Reused `cachedRenderState` in `ChartEngine.getPointerState()` and isolated crosshair/synced-crosshair/drawing-preview repaints strictly to `overlayCanvas` (`src/engine/ChartEngine.ts`, `src/components/ChartCanvas.tsx`, `src/engine/__tests__/ChartLayerPartition.test.ts`).
   - Added `blur`, `pointercancel`, and window close/minimize/maximize drag-listener teardown in `src/components/FloatingWindow.tsx` and `src/components/common/useDraggableFloatingWindow.ts`; zeroed detached `<canvas>` buffers on `unmount()`.
2. **Windows Storage Lock Resilience & Single-Handle Reuse (Phase 1C):**
   - Eliminated duplicate `OpenOptions::open` calls in `src-tauri-shell/src/database/binary_eod.rs` (`upsert_single_record_by_date` & `rewrite_from_first_incoming_record`) and added bounded retry backoff for transient Windows `ERROR_SHARING_VIOLATION` (`os error 32`) and `os error 5` in `binary_eod.rs` and `src-tauri-shell/src/bhavcopy_recovery.rs`.
3. **Full-Series FNV-1a Indicator Cache & Scanner Throughput (Phases 2A & 2B):**
   - Replaced 2-endpoint bar checks in `src/indicators/registry.ts` with an O(N) FNV-1a checksum (`getBarsMutationSignature`) and recursive upstream cache keys (`getChainedIndicatorCacheKey`).
   - Bounded historical pattern evaluation sliding window to 260 bars in `src/plugins/scanner/chartPatternEvaluation.ts`, yielded to the event loop every 8 symbols in `src/plugins/scanner/scannerRunner.ts`, and hoisted `get_price_storage_mode` out of the per-symbol loop in `src-tauri-shell/src/database/daily_market_snapshot.rs`.
4. **Packed 64-Byte Binary Bar IPC, 48-Symbol LRU Cache & Security Hardening (Phases 2C, 3A, 4, 5B & 5C):**
   - Added `get_eod_data_binary` in `src-tauri-shell/src/database/eod_data.rs` and `decodeBinaryEodBars` in `src/platform/binaryEodDecoder.ts` (`src/platform/__tests__/binaryEodDecoder.test.ts`), paired with a 48-entry LRU cache and mutation invalidation in `src/platform/tauriDesktop.ts`.
   - Enabled `is_html_response()` across all exchanges and capped ZIP extraction at 128 MB in `src-tauri-shell/src/bhavcopy.rs`; guarded `open_external` and `fetch_official_watchlist_source` in `src-tauri-shell/src/main.rs`; enabled a production CSP in `src-tauri-shell/tauri.conf.json`; resolved all 7 Rust compiler warnings.
<!-- TECH-AUDIT-PHASES-1-TO-5C-2026-10-14:END -->

<!-- MED02-BSE-TRANSPORT-RESILIENCE-2026-10-14:BEGIN -->
## Completed — MED-02 BSE Scraping Fragility & Transport Resilience (2026-10-14 16:25 IST)

**Classification:** `BUG_FIX_AND_TRANSPORT_HARDENING__ALL_VALIDATION_GATES_PASSED`
**Scope:** Hardened BSE Bhavcopy and BSE Index download pipelines to eliminate scraping fragility, Akamai anti-bot 403 retry amplification, and TCP connection resets.

### Key Deliverables:
1. **BSE Index Candidate Prioritization (`bhavcopy.rs`):**
   - Promoted the direct static CSV endpoint (`https://www.bseindia.com/bsedata/Index_Bhavcopy/IndexSummary_{ddmmyyyy}.csv`) to Candidate #0.
   - Demoted the WAF-blocked `api.bseindia.com` endpoints to fallback status, avoiding 6 failed requests per index date.
2. **HTTP 403 Anti-Bot Protection (`bhavcopy.rs`):**
   - Stopped exponential backoff retries on HTTP 403 Forbidden responses in `fetch_candidate_bytes`. 403 now immediately returns `Ok(None)`, preventing Akamai rate-limiting and connection resets (`WSAECONNRESET`).
3. **HTTP/1.1 Transport & Connection Pool Tuning (`bhavcopy.rs`):**
   - Configured `reqwest::ClientBuilder` with `.http1_only()` to prevent Akamai EdgeSuite HTTP/2 ALPN multiplexing stream drops and resets.
   - Added `.pool_idle_timeout(StdDuration::from_secs(10))` and reduced `.pool_max_idle_per_host(4)` to avoid worker threads reusing stale/closed TCP sockets.
4. **Body Streaming Retry & Causal Error Diagnostics (`bhavcopy.rs`):**
   - Replaced immediate `?` on `response.bytes()` with retry handling and exponential backoff so transient connection drops during payload download can recover cleanly.
   - Enriched error messages with full `std::error::Error::source(&error)` causal chain for diagnostic visibility.
5. **Modern Referer Routing (`bhavcopy.rs`):**
   - Updated `bhavcopy_referer_for_exchange` for `BSE` to `https://www.bseindia.com/download/BhavCopy/Equity/` and `BSEINDEX` to `https://www.bseindia.com/bsedata/Index_Bhavcopy/`.
   - Explicitly wired `BSE_INDEX_ARCHIVE_PAGE_URL` for `IndexArchDailyAllPar` archive requests.
6. **Primary Candidate Error Preservation (`bhavcopy.rs`):**
   - Tracked `primary_hard_error` on Candidate #0 in `stage_single_download` and `download_single` (`process_download_task`) so transient errors on primary endpoints are accurately diagnosed rather than masked by legacy fallback failures.
7. **Default Settings Templates Alignment (`bhavcopy.rs`):**
   - Aligned `get_bhavcopy_default_templates` to list working modern direct endpoints first for both BSE Equity and BSE Index.
8. **Automated Unit Tests:**
   - Updated `test_bse_candidates_follow_working_cutover_and_index_archive_sources` (PASS).
   - Added `test_bhavcopy_referer_for_exchange_bse_endpoints` (PASS).

Validation:
- `cargo test test_bse_candidates`: PASS (1/1 passed)
- `cargo test test_bhavcopy_referer`: PASS (1/1 passed)
- `cargo test bhavcopy::tests::test_bse`: PASS (6/6 passed)
- `npm run typecheck:renderer`: PASS (0 errors)
<!-- MED02-BSE-TRANSPORT-RESILIENCE-2026-10-14:END -->

<!-- REVERSE-SPLIT-CONSOLIDATION-2026-10-14:BEGIN -->
## Completed — Reverse Split & Consolidation Adjustment Support (2026-10-14 01:12 IST)

**Classification:** `FEATURE_AND_PARSER_EXPANSION__ALL_VALIDATION_GATES_PASSED`
**Scope:** Implemented official purpose parser and review view-model support for reverse stock splits and share consolidations (face-value increases and ratio contractions with share factor $< 1.0$).

### Key Deliverables:
1. **Official Purpose Parser (`corporate_action_imports.rs`):**
   - Added support for `CONSOLIDATION`, `CONSOLIDATE`, and `REVERSE SPLIT` markers alongside existing split/sub-division keywords.
   - Enhanced face value parsing: when new face value $>$ old face value (e.g. ₹1 to ₹10), calculates `factor = old_fv / new_fv = 0.1` and `price_factor = 10.0`.
   - Inverted ratio normalization: automatically swaps announcements like "10:1" to "1:10" (`num = 1.0`, `den = 10.0`) when marked as consolidation so downstream `num / den` yields `0.10` consistently.
   - Removed dead-code "Consolidation not yet supported" guardrails.
   - Updated `compound_action_primary_type` to recognize consolidation markers so compound actions (e.g. consolidation + dividend) are correctly flagged for user review.
2. **Review View Model & UI Presentation (`corporateActionEconomicEventViewModel.ts`):**
   - In `buildComponents`, actions with `type === 'SPLIT'` and `shareFactor < 1.0` are explicitly labeled as `'Consolidation'`.
   - Added `CONSOLIDATION` to `ACTION_ORDER` and `actionLabel` dictionary.
3. **Automated Unit & Backend Tests:**
   - Rust unit tests in `corporate_action_imports.rs`:
     - `parses_consolidation_face_value_factor`: PASS (₹1 to ₹10 $\to 0.1$, ₹2 to ₹10 $\to 0.2$).
     - `parses_consolidation_ratio_and_reverse_split`: PASS (`1:5` $\to 0.2$, `10:1` swapped $\to 0.1$, `Reverse Split 1:10` $\to 0.1$).
     - `compound_action_catches_consolidation_with_dividend`: PASS.
   - Frontend unit tests in `corporateActionEconomicEventViewModel.test.ts`:
     - `labels SPLIT with shareFactor < 1.0 as Consolidation in components and actionLabel`: PASS.

Validation:
- `npm run typecheck:renderer`: PASS (0 errors)
- `npx vitest run corporateActionEconomicEventViewModel`: PASS (94 test files, 1129/1129 passed)
- `cargo test corporate_action_imports::tests::parses_consolidation`: PASS (2/2 passed)
- `cargo test compound_action_catches_consolidation_with_dividend`: PASS (1/1 passed)
- `cargo test parser_guardrail`: PASS (6/6 passed)
- `npm run tauri:check`: PASS (0 errors)
<!-- REVERSE-SPLIT-CONSOLIDATION-2026-10-14:END -->

<!-- TOOLBAR-ADJ-TRI-CONTROLS-2026-10-14:BEGIN -->
## Completed — Toolbar Capital Adjustment (Adj) & Dividend Total Return (TRI) Controls (2026-10-14 00:09 IST)

**Classification:** `FEATURE_AND_UI_ERGONOMICS__ALL_VALIDATION_GATES_PASSED`
**Scope:** Exposed independent `Adj` (Split & Bonus capital adjustments) and `TRI` (Cash Dividend total return index) toggle buttons in the persistent top toolbar dock (`Toolbar.tsx`).

### Key Deliverables:
1. **Capital Adjustment (`Adj`) Toggle (`Toolbar.tsx`):**
   - Directly toggles `adjustedMode` via `useChartStore((state) => state.setAdjustedMode)`.
   - Visual active styling (`var(--accent)` border and soft background) indicates when price data is adjusted for Splits and Bonuses.
   - Descriptive tooltips explain current and next state clearly.
2. **Total Return Index (`TRI`) Toggle (`Toolbar.tsx`):**
   - Directly toggles `includeDividendAdjustments` via `useChartStore((state) => state.setIncludeDividendAdjustments)`.
   - Automatically enables `adjustedMode` when turned on if the chart was previously in raw mode.
   - Distinct active styling indicates when Cash Dividends are incorporated into historical bars.
3. **Automated Unit Tests (`ToolbarAdjustedControls.test.tsx`):**
   - Verifies explicit titles, store subscriptions, and click toggle contracts.

Validation:
- `npm run typecheck:renderer`: PASS (0 errors)
- `npm run test -- ToolbarAdjustedControls`: PASS (2/2 tests passed)
- `npm run test -- components`: PASS (7 test files, 22/22 tests passed)
<!-- TOOLBAR-ADJ-TRI-CONTROLS-2026-10-14:END -->


<!-- CORPORATE-ACTIONS-CHECKPOINT-2026-10-13:BEGIN -->
## Completed — Corporate Actions Safe V2 Split/Bonus, Shared Operation Lock & Dividend Prepared Scope Checkpoint (2026-10-13 23:58 IST)

**Classification:** `GIT_CHECKPOINT__VALIDATION_PASSED`
**Commit:** `0cd6917`
**Checkpoint Tag:** `checkpoint-corporate-actions-safe-v2-complete`
**Scope:** Reconciled, audited, validated, and committed all pending Corporate Actions backend and frontend work spanning Phase 5A–5E, Simple Cash Dividend prepared scope, transaction owner, and shared price store operation lock.

### Summary of Staged & Committed Scope:
- **Rust Backend**:
  - `price_store_operation_lock.rs`: Non-reentrant mutual exclusion across Bhavcopy writes, manual imports, quote mutations, and corporate actions.
  - `auto_approval.rs`: Safe V2 empirical scan evaluation ($\ge 0.95$ confidence), policy executor, and simple cash dividend write stage.
  - `simple_cash_dividend_evidence.rs` & `simple_cash_dividend_transaction_owner_tests.rs`: Defensive single-purpose grammar classifier, previous close basis validation, and transaction rollback ownership.
  - `corporate_action_imports.rs`: Integration of auto-approval pipelines, identity repairs, and reconciliation preflight.
- **Frontend / Renderer**:
  - `CorporateActionNormalWorkflowWorkspace.tsx`: Safe V2 opt-in settings toggle, load-and-process workflow, and exception-focused review cards.
  - `corporateActionDividendPreparedScope.ts` & orchestration: Cryptographic prepared scope builder with SHA-256 fingerprinting.
  - `corporateActionImportOperations.ts` & adapter: Safe chunked batching for validation scans and review hydration.
- **Validation Passed**:
  - `npm run typecheck:renderer`: PASS (0 errors)
  - `npm run test -- corporateAction`: PASS (51 test files, 363/363 unit tests)
  - `cargo test auto_approval`: PASS (90/90 tests)
  - `cargo test simple_cash_dividend`: PASS (59/59 tests)
  - `cargo test price_store_operation_lock`: PASS (3/3 tests)
  - `npm run tauri:check`: PASS (0 errors)
<!-- CORPORATE-ACTIONS-CHECKPOINT-2026-10-13:END -->


<!-- UI-MODERNIZATION-CHECKPOINT-2026-10-13:BEGIN -->
## Completed — UI Modernization, Dedicated Symbol Search, Color Toolbox & Ergonomics Commit (2026-10-13 23:25 IST)

**Classification:** `GIT_CHECKPOINT__VALIDATION_PASSED`
**Commit:** `0e444c5`
**Checkpoint Tag:** `checkpoint-ui-modernization-complete`
**Scope:** Staged and committed all completed UI modernization, dedicated symbol search, unified color toolbox, plugin host, and workspace ergonomics enhancements from today's work, leaving dirty Corporate Actions files intact.

### Summary of Staged & Committed Scope:
- Dedicated Symbol Search (`CommandPalette.tsx`, `chartSearchController.ts`) with `S` hotkey and synchronous state persistence.
- Unified Color Toolbox (`ColorToolbox.tsx`, `colorUtils.ts`, 8 dialog consumers).
- Plugin Host architecture and sandbox fault isolation (`pluginHost.ts`, `gannPlugin.ts`, `registry.ts`).
- Workspace ergonomics: auto zoom reset across timeframes, numeric sheet persistence, collapsible Favorites category in sidebar, compact status bar, and toolbar cluster grouping.
- Associated documentation reports in `docs/changes/`.
<!-- UI-MODERNIZATION-CHECKPOINT-2026-10-13:END -->

<!-- LAYOUT-MODE-PERSISTENT-CHROME-AND-TF-CLEANUP-2026-10-13:BEGIN -->
## Completed — Layout Mode Persistent Chrome, Right Tool Dock & Timeframe Cleanup (2026-10-13 20:35 IST)

**Classification:** `UI_AND_WORKFLOW_POLISH__ALL_VALIDATION_GATES_PASSED`
**Scope:** Preserved the global top Header dock (`Toolbar`) and right-rail drawing `ChartToolDock` across all layout modes; streamlined tile headers by removing duplicate timeframe docks; added active chart visual outline/glow; and enabled click-to-activate with eager tab hydration.

### Key Deliverables:
1. **Persistent Top Header Dock (`RootApp.tsx`):**
   - Unlocked `<Toolbar />` from the single-mode ternary so the main toolbar (timeframes `D W M Q Y`, chart types, volume, indicators, alerts, scanners) stays permanently visible and controls the currently active chart in all layout modes.
2. **Persistent Right Tool Dock (`RootApp.tsx`):**
   - Wrapped the entire chart workspace row with `<ChartToolDock />` so drawing tools (trendlines, pitchforks, Fibonacci, markers, channels) remain permanently accessible on the right rail in both single and tiled modes.
3. **Active Tile Distinction & Click-to-Activate (`RootApp.tsx` & `ChartCanvas.tsx`):**
   - Dynamic `tileCellStyle(isActive)` with `1px solid var(--accent)` border and subtle inset glow for the active chart pane.
   - `onMouseDownCapture` on the canvas and `onClickCapture` on the tile container immediately switch the active chart on pointer click.
4. **Clean, Streamlined Tile Headers (`TileHeader.tsx`):**
   - Removed redundant `D W M Q Y` timeframe button group from tile headers.
   - Preserved Symbol, Exchange badge, Last Price, and Daily Change (+/-%).
   - Added an active accent dot indicator to the focused tile header.
5. **Eager Background Tab Hydration (`chartTabSessionController.ts`):**
   - When switching to a tiled layout mode (`mode !== 'single'`), automatically queues sequential data hydration for unhydrated tabs so visible tiles immediately display their price bars without showing "No chart data loaded".

Validation:
- `npm run typecheck:renderer`: PASS (0 errors)
- `npm run test -- chart`: PASS (16/16 test files, 100/100 unit tests passed)

Full report: `docs/changes/2026-10-13_2035_IST_LAYOUT_MODE_PERSISTENT_CHROME_AND_TIMEFRAME_CLEANUP.md`
<!-- LAYOUT-MODE-PERSISTENT-CHROME-AND-TF-CLEANUP-2026-10-13:END -->

<!-- SHEET-TABS-NUMERIC-CHIP-SIZING-2026-10-13:BEGIN -->
## Completed — SheetTabs Numeric Chip Sizing & Typography Polish (2026-10-13 18:15 IST)

**Classification:** `UI_AND_WORKFLOW_POLISH__ALL_VALIDATION_GATES_PASSED`
**Scope:** Fixed oversized sheet tab chips and improved numeric typography/readability in `SheetTabs.tsx`.

### Key Deliverables:
1. **Numeric Sheet Label Formatting (`SheetTabs.tsx`):**
   - Formatted default sheet names (`Sheet 1`, `Sheet 2`, etc.) to show only the digit (`1`, `2`, ...) while preserving custom renamed titles.
2. **Compact Chip Layout:**
   - Reduced `minWidth` from `84px` to `32px` (`inline`) and padding from `0 10px` to `0 6px`.
   - Centered label text with `justifyContent: 'center'` and `textAlign: 'center'`.
3. **Readable Bold Typography:**
   - Boosted font size from unreadable `9px` to crisp `12px` (`inline`) with `fontWeight: 700` (active) / `600` (inactive) and `lineHeight: 1`.
4. **Action Buttons Proportions:**
   - Sized close button to `12px` × `12px` with flex centering and subtle resting opacity.
   - Sized new sheet `+` button to `22px` height, `22px` minWidth, and `14px` font size.

Validation:
- `npm run typecheck:renderer`: PASS (0 errors)
- `npm run test -- Tab`: PASS (8/8 tests passed)
<!-- SHEET-TABS-NUMERIC-CHIP-SIZING-2026-10-13:END -->

<!-- THEME-CLEANUP-2026-10-13:BEGIN -->
## Completed — Deprecated Theme Removal (2026-10-13 18:05 IST)

**Classification:** `TECHNICAL_CLEANUP_AND_THEME_AUDIT__ALL_VALIDATION_GATES_PASSED`
**Scope:** Completely removed three deprecated themes from application code and styles:
- `Amber-Noir Pro` (`bloomberg-pro`)
- `Orderflow Cyber` (`orderflow-dark`)
- `Terminal Pro Dark` (`terminal-pro-dark`)

### Key Deliverables:
1. **Theme Registry Cleanup (`themeService.ts`):**
   - Removed definitions from `APP_THEME_IDS`, `APP_THEME_OPTIONS`, and `CHART_THEMES`.
2. **CSS Palette Removal (`global.css`):**
   - Removed `[data-theme='bloomberg-pro']`, `[data-theme='orderflow-dark']`, and `[data-theme='terminal-pro-dark']` variable blocks.

Validation:
- `npm run typecheck:renderer`: PASS (0 errors)
- `npm run test`: PASS (164/164 test suites, 1,043/1,043 unit tests passed)
<!-- THEME-CLEANUP-2026-10-13:END -->

<!-- LIGHT-THEME-GRID-FIX-2026-10-13:BEGIN -->
## Completed — Light Theme Grid Line & Crosshair Preservation Fix (2026-10-13 15:25 IST)

**Classification:** `THEME_FIDELITY_AND_VISUAL_POLISH__ALL_VALIDATION_GATES_PASSED`
**Scope:** Preserved native subtle grid lines (`rgba(203, 213, 225, 0.35)`) and crosshair on light themes by guarding against global dark fallback settings (`#1e2a3a` / `#5588aa`).

### Key Deliverables:
1. **Theme-Aware Default Preservation (`themeService.ts`):**
   - In `getChartTheme`, checks if incoming custom colors match default dark fallbacks (`#1e2a3a` for grid, `#5588aa` for crosshair).
   - Automatically preserves the theme's native grid and crosshair, eliminating harsh dark solid bars from light themes (`classic-light`, `deep-light`).
2. **Automated Regression Test (`ChartTheme.test.ts`):**
   - Added unit test asserting `classic-light` retains native subtle grid and crosshair while preserving custom candle colors.
3. **Git Checkpoint:** `checkpoint-light-theme-grid-restored` (`02f34b8`).

Full report: `docs/changes/2026-10-13_1525_IST_LIGHT_THEME_GRID_LINE_PRESERVATION_FIX.md`
<!-- LIGHT-THEME-GRID-FIX-2026-10-13:END -->

<!-- CODE-PROTECTION-AND-DISPLAY-SYNC-2026-10-13:BEGIN -->
## Completed — Code Protection & Display Sync Architectural Hardening (2026-10-13 14:30 IST)

**Classification:** `ARCHITECTURE_HARDENING_AND_ANTI_REGRESSION__ALL_VALIDATION_GATES_PASSED`
**Scope:** Established compile-time contract locks, added regression test for custom theme persistence, created modular `useChartDisplaySync` hook, and tagged git checkpoints.

### Key Deliverables:
1. **Strict TypeScript Interface Enforcement (`types.ts` & `ChartEngine.ts`):**
   - Made `theme: ChartTheme` and `visualSettings: ChartVisualSettings` strictly required on `ChartEngineConfig`.
   - Removed empty-object constructor fallback (`config: ChartEngineConfig = {}` &rarr; `config: ChartEngineConfig`) in `ChartEngine.ts`.
   - Prevents silent fallback to `DARK_THEME` during refactors: missing properties now trigger immediate compile-time errors in `npm run typecheck:renderer`.
2. **Automated Theme Regression Test (`ChartTheme.test.ts`):**
   - Added unit test asserting that custom candle, wick, and volume colors survive `resolveChartTheme` untouched.
3. **Modular Display Synchronization Hook (`useChartDisplaySync.ts`):**
   - Created dedicated `src/features/charts/useChartDisplaySync.ts` requiring all display properties (`theme`, `visualSettings`, `timeframe`, `chartType`, `showVolume`, etc.).
   - Replaced 11 unbundled, vulnerable `useEffect` blocks in `ChartCanvas.tsx` with a single type-checked `useChartDisplaySync(...)` call, completely isolating display wiring from canvas interaction logic.
4. **Git Checkpoints Established:**
   - `checkpoint-contracts-locked` (`bf2e20e`)
   - `checkpoint-display-sync-hardened` (`da0fb03`)

Full report: `docs/changes/2026-10-13_1430_IST_CODE_PROTECTION_AND_DISPLAY_SYNC_HARDENING.md`
<!-- CODE-PROTECTION-AND-DISPLAY-SYNC-2026-10-13:END -->

<!-- DEDICATED-SYMBOL-SEARCH-2026-10-13:BEGIN -->
## Completed — Dedicated Symbol Search Mode & SQLite Search Controller Wiring (2026-10-13 12:25 IST)

**Classification:** `SEARCH_ARCHITECTURE_AND_UX_POLISH__ALL_VALIDATION_GATES_PASSED`
**Scope:** Fixed search controller bug where SQLite symbol results were dropped; added dedicated Symbol Search mode via `S` hotkey; added exchange filter pills and recent symbols fallback.

### Key Deliverables:
1. **Search Controller Bug Fix (`chartSearchController.ts`):**
   - Synchronously updates `state.searchQuery` before triggering `searchChartSymbols` so returning results match `state.searchQuery`, preventing silent drops.
2. **Dedicated Symbol Search Mode (`uiStore.ts` & `CommandPalette.tsx`):**
   - Single-key `S` opens the palette directly in `'symbol'` mode.
   - Command/action rows are suppressed; up to 35 matching instruments are displayed.
   - When the query is empty, displays **Recently Viewed Symbols** for zero-keystroke `S` &rarr; `↓` &rarr; `Enter` switching.
3. **Exchange Filtering & Series Badging:**
   - Interactive filter pills (`[All Exchanges]`, `[NSE]`, `[BSE]`) toggled by mouse or `Tab` key.
   - Displays official security series badges (e.g. `EQ`, `BE`, `SM`).
4. **Fixed Size & Movable Window:**
   - Stable fixed dimensions (`580px` × `480px`) with `flex: 1` auto-scrolling results list.
   - Draggable header bar via `useDraggableFloatingWindow` with localStorage position persistence.
   - Removed redundant `ESC` badge from header close group.

Full report: `docs/changes/2026-10-13_1225_IST_DEDICATED_SYMBOL_SEARCH_AND_SEARCH_CONTROLLER_FIX.md`
<!-- DEDICATED-SYMBOL-SEARCH-2026-10-13:END -->

<!-- WORKFLOW-AND-UI-POLISH-2026-10-13:BEGIN -->
## Completed — Numeric Sheets, Timeframe Polish, Auto Zoom Reset, Collapsible Favorites & 'S' Key Symbol Search (2026-10-13 11:45 IST)

**Classification:** `UI_AND_WORKFLOW_POLISH__ALL_VALIDATION_GATES_PASSED`
**Scope:** Numeric sheet tabs, timeframe dock label removal and full-name tooltips, automatic viewport zoom reset across timeframe change, collapsible Favorites section in indicator sidebar, and single-key `S` symbol search trigger.

### Key Deliverables:
1. **Numeric Sheet Names:**
   - [`src/components/SheetTabs.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/SheetTabs.tsx): Defaults new sheets to numbers (`1`, `2`, ...). Formats existing `Sheet <n>` / `Sheet<n>` to `<n>` while retaining custom user titles.
   - [`src/features/workspace/workspacePersistence.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/features/workspace/workspacePersistence.ts): Persisted sheet fallback defaults to `${index}`.
2. **Timeframe Dock Polish:**
   - [`src/components/ChartHeader.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/ChartHeader.tsx): Removed the `TF` label before timeframe buttons; updated button hover tooltips to full names (`Daily`, `Weekly`, `Monthly`, `Quarterly`, `Yearly`).
   - [`src/components/TileHeader.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/TileHeader.tsx): Multi-chart tile header timeframe tooltips updated to match.
3. **Timeframe Change Auto Zoom Reset:**
   - [`src/features/charts/chartTabStateMutationService.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/features/charts/chartTabStateMutationService.ts): `applyTimeframeToTab` now resets viewport zoom via `createDefaultViewport` instead of carrying over previous bar span. Switching from Yearly to Daily displays a fresh 120-bar right-aligned view without manual zoom reset.
   - [`src/features/charts/__tests__/chartTabStateMutationService.test.ts`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/features/charts/__tests__/chartTabStateMutationService.test.ts): Unit tests updated and passing.
4. **Collapsible Favorites in Indicator Sidebar:**
   - [`src/components/Sidebar.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/Sidebar.tsx): Added persistent collapsible state for `★ Favorites` with `►`/`▼` toggle button, matching other indicator subcategories.
5. **`S` Single-Key Symbol Search:**
   - [`src/components/CommandPalette.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/CommandPalette.tsx): Pressing `S` anywhere while viewing charts opens Command Palette with instant search focus. Input targets and dialogs guarded; `Ctrl+S` preserved.
   - [`src/components/KeyboardShortcutsDialog.tsx`](file:///e:/TA%20Projects/EOD%20Charting%20Platform/src/components/KeyboardShortcutsDialog.tsx): Added `S` to shortcut reference table.

Full report: `docs/changes/2026-10-13_1145_IST_NUMERIC_SHEETS_TF_DOCK_ZOOM_RESET_COLLAPSIBLE_FAVORITES_AND_S_KEY_SEARCH.md`
<!-- WORKFLOW-AND-UI-POLISH-2026-10-13:END -->

<!-- TECHNICAL-AND-UX-AUDIT-PHASES-1-2-3:BEGIN -->
## Completed — Technical and UX Audit Phases 1, 2, and 3 (2026-10-12 22:45 IST)

**Classification:** `TECHNICAL_AND_UX_AUDIT__PHASES_1_2_3_COMPLETED__ALL_VALIDATION_GATES_PASSED`
**Scope:** Performance optimization, UI modernization (left tool dock, status bar, toolbar), and formal plugin architecture with sandboxed fault isolation.

### Phase 1: Quick Wins & Performance
- **Dependency Pruning:** Removed `axios`, `unzip-stream`, `@types/unzip-stream` from `package.json`.
- **Idle Redraw Guard:** Added `isOverlayDirty` in `ChartEngine.ts` to stop 60–144Hz RAF redraws when the chart is idle.
- **Hover State Isolation:** `setTabHoverBar` returns existing reference when bar date and close price are unchanged; `updateActiveTab` maintains `chartTabs` array identity when active tab is unchanged, eliminating re-render cascades across `RootApp`.
- **Canvas Hook Splitting:** Split mega-`useEffect` in `ChartCanvas.tsx` into targeted hooks (`[bars]`, `[renderDrawings]`, `[overlays]`, `[visibleEvents]`, `[compareOverlays]`, `[volumeProfileEnabled, signalRules]`).

### Phase 2: UI Modernization & Docking Realignment
- **Right-Rail Tool Dock:** Anchored `ChartToolDock` on the right-hand rail adjacent to the price scale in `RootApp.tsx` and `ChartToolDock.tsx` (border left, flyout leftward into canvas). Prevents visual congestion and double-rail clutter alongside the left collapsible sidebar.
- **Status Bar Modernization (`StatusBar.tsx`):** Height increased to 24px, font to 11px; added status dot for DB state, mono range badges, exchange/symbol tag, bar counter, and IST clock badge.
- **Toolbar Streamlining (`Toolbar.tsx` & `ChartHeader.tsx`):** Grouped toolbar controls into 4 logical clusters (Timeframe | Chart Type & Volume | Indicators & Signals | Pattern Scanners); harmonized button heights to 24–26px; removed redundant nested box styling in inline timeframes.
- **Price Legend Candle Date:** Added active/resting candle date (`bar.date`) at the head of the price legend in `ChartPriceLegendOverlay.tsx` and `ChartEngine.ts`. Enables reading candle dates directly without requiring crosshair hover.
- **Tool Shortcuts Alignment, Engine Disentanglement & Global Keydown Routing:** Wired `X` to toggle Crosshair (`'crosshair'` vs `'cursor'`); preserved `H` as single-key toggle for Horizontal Line (`'hline'`). Disentangled engine crosshair rendering in `src/engine/ChartEngine.ts` by explicitly excluding `'hline'` from `shouldDrawCrosshair`, eliminating vertical time rays, date badges, and intersection dots when placing horizontal price levels. Added global `window.addEventListener('keydown')` in `ChartCanvas.tsx` (guarded against input/dialog targets) and pointerdown auto-focus so hotkeys fire reliably across the entire chart window without requiring manual Tab focus. Documented in `KeyboardShortcutsDialog.tsx`.
- **Scale Settings Context Menu Dynamic Placement:** Fixed right-click scale settings menu in `ChartCanvas.tsx` by calculating available vertical space and dynamically flipping direction to `'up'` when clicked near the bottom of the price scale, eliminating viewport `overflow: hidden` truncation and squished 180px `maxHeight`. Set anchor offset to `layout.axisWidth + 8` so the menu opens into the plot canvas adjacent to the scale without obscuring price digits or the tool dock.

### Phase 3: Formal Plugin Architecture & Web Worker Sandboxing
- **Plugin Lifecycle & Context Contracts (`src/plugins/types.ts`):** Added `PluginContext`, `ChartPluginLifecycle` (`init`, `destroy`, `onBarsUpdated`, `onInstrumentChanged`), `PluginRuntimeInfo`, `PluginLogEntry`.
- **Plugin Host & Fault Isolation (`src/plugins/pluginHost.ts`):** New `PluginHost` managing registration, lifecycle execution, and error boundaries. Traps plugin exceptions in `lastError` and isolated logs without disrupting chart rendering.
- **Registry Integration (`src/plugins/registry.ts`):** Exported singleton `pluginHost`, preserving 100% backward compatibility for `SettingsDialog` and scanner consumers.
- **Plugin Unit Tests (`src/plugins/__tests__/pluginHost.test.ts`):** Added 7 comprehensive tests covering lifecycle, event dispatch, fault isolation, and logging.

### Validation Gates

| Gate | Result |
|---|---|
| `npm run typecheck:renderer` | ✅ 0 errors |
| `npx vitest run <6 test files>` | ✅ 21/21 PASS |
| `npm run build:renderer` | ✅ Production Vite build passed (5.10s) |

Full report: `docs/changes/2026-10-12_2245_IST_TECHNICAL_AND_UX_AUDIT_PHASES_1_2_3_COMPLETION.md`
<!-- TECHNICAL-AND-UX-AUDIT-PHASES-1-2-3:END -->

<!-- GANN-PLUGIN-IMPLEMENTATION:BEGIN -->
## Completed — Gann Price-Time Analysis Plugin (2026-09-14 01:12 IST)

**Classification:** `GANN_PRICE_TIME_PLUGIN_IMPLEMENTED__ALL_VALIDATION_GATES_PASSED`
**Plugin ID:** `gann-price-time` · **Type:** `indicator` · **Status:** `bundled` · `defaultEnabled: true`

The Gann Price-Time Analysis subsystem plugin is fully implemented, registered, and validated directly in the platform source tree. No external dependencies. No database writes. Frozen Fibonacci tools (F1E.1) untouched. Guarded Vite chunks unchanged.

### Files created — `src/plugins/analysis/gannPriceTime/`

- `types.ts` — pure TypeScript contracts (`GannBar`, `GannPivot`, `GannAngleRay`, `SquareOfNineLevel`, `GannCycleSignal`, `GannSetup`, `GannPluginOptions`, `GannCoordinateMapper`)
- `engine.ts` — pure computational engine: Wilder ATR · centred-window pivot detection · Square of Nine harmonic levels · 2×1/1×1/1×2 angle rays · 45/90/180/360-bar time cycles with 5-bar breakout confirmation
- `canvasOverlay.ts` — Canvas 2D renderer; all paths in `ctx.save()`/`ctx.restore()`
- `gannPlugin.ts` — `RegisteredPlugin` manifest
- `__tests__/gannEngine.test.ts` — 28/28 deterministic unit tests PASS

### Surgical platform edits

- `src/engine/ChartEngine.ts` — added `setGannOverlayCallback()` public seam; callback fires at end of `renderOverlay()` before `ctx.restore()`
- `src/plugins/registry.ts` — +1 import, +1 `BUILT_IN_PLUGINS` entry
- `src/components/ChartCanvas.tsx` — `useEffect([bars])` computes `GannSetup` and registers the overlay callback
- `vitest.config.ts` — replaced overly-broad `**/analysis/**` exclude with `**/EOD Charting Platform Source Audit/**`

### Validation gates

| Gate | Result |
|---|---|
| `npx vitest run gannEngine.test.ts` | ✅ 28/28 PASS |
| `npx tsc -p tsconfig.json --noEmit` | ✅ 0 errors |
| `npm run build:renderer` | ✅ All guarded chunks under 500 kB |
| `cargo check` | ✅ Exit 0 — pre-existing warnings only |

Full report: `docs/changes/2026-09-14_0112_IST_GANN_PRICE_TIME_PLUGIN_IMPLEMENTATION.md`
No real Git staging performed.
<!-- GANN-PLUGIN-IMPLEMENTATION:END -->

<!-- V2-P0-SECURITY-LISTING-PRICE-STREAM:BEGIN -->
## Approved future architecture — Security / Listing / Price-Stream V2

**Status: DOCUMENTATION FROZEN / APPROVED FUTURE ARCHITECTURE / IMPLEMENTATION NOT STARTED.**

V2 is a bounded future redesign of the instrument/price identity and binary-storage keying layer for **NSE, BSE, NSE_INDEX, and BSE_INDEX**. It introduces `security_id`, `listing_id`, and `price_stream_id`, exchange-specific NSE Series/BSE Group classification, EOD2 shadow storage, and the invariant that Index Series is **not applicable** rather than `No series`.

Current production authority is unchanged: **EOD1 + Generation 6 + current SQLite/current runtime behavior**. No V2 reader/writer/schema migration has been promoted.

Authoritative V2-P0 documents:

- `docs/architecture/SECURITY_LISTING_PRICE_STREAM_V2_ARCHITECTURE_R1.md`
- `docs/architecture/EOD2_PRICE_STREAM_STORAGE_SPEC_R1.md`
- `docs/architecture/SECURITY_IDENTITY_V2_MIGRATION_AND_COMPATIBILITY_R1.md`
- `docs/plans/SECURITY_LISTING_PRICE_STREAM_V2_IMPLEMENTATION_PLAN_R1.md`
- `docs/architecture/decisions/ADR-001-security-listing-price-stream-identity.md` through `docs/architecture/decisions/ADR-006-corporate-action-security-boundary.md`

Evidence binding: 2026-09-06 source snapshot SHA-256 `1E45A2F8CF8D0C69ABA1E4813B46018EA57ED72A8D9F0191DAA1F0F2056539A0`; R2 evidence ZIP SHA-256 `0992F1DDBA3CA33181FB916020D1738761AB5000D127DD037A8A3AF96E557DF5`; R3 evidence ZIP SHA-256 `403E75701DA18EBB662E8D600192F83EF7019E12BE1F59F512E8ADFC176548E4`.
<!-- V2-P0-SECURITY-LISTING-PRICE-STREAM:END -->


<!-- R1A-R3-CONTINUITY-UPDATE:BEGIN -->
## Current active handoff — R1A-R4-R2 preflight closed; parent-baseline review required (2026-08-31 02:02:16 IST)

- Exact 35-path CA alternate-index scope: **VALIDATED / CLOSED**.
- Raw staged-blob verification: **PASS**.
- 24 snapshot whole-file blobs + 1 exact hygiene blob: **PASS**.
- 10 special/shared hashes and exact 10-path remainder: **PASS**.
- Strict staged whitespace check: **GREEN**.
- Full 508-file live-source postflight: **PASS**.
- Real Git index SHA unchanged and clean: **PASS**.
- HEAD unchanged: **PASS**.
- Real staging performed: **NO**.
- Current authorization: `readyForRealStaging = false`.
- Next phase: **PARENT_BASELINE_REVIEW_REQUIRED**.
- Do not run real `git add` or commit yet.

Read `docs\CURRENT_WORK_STATUS.md` for exact evidence, parent-baseline questions, and remaining sequence.
<!-- R1A-R3-CONTINUITY-UPDATE:END -->
## Current active handoff — V1.14AD controlled staging preflight (2026-08-31 00:25:09 IST)

<!-- CURRENT-WORK-STATUS-MIRROR:BEGIN -->

**Primary operational status:** `docs\CURRENT_WORK_STATUS.md`
**Current source snapshot:** `E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-31_000303_IST`
**Build-relevant authority:** `9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D`

### Completed

- Latest-source CA integration decision: `NO_SOURCE_OVERLAY_REQUIRED__LATEST_SNAPSHOT_ALREADY_CONTAINS_PROVEN_CA_CLOSURES`.
- R1A: renderer typecheck/build, Watchlist split preservation, focused V1.14AD Rust, bhavcopy/bootstrap sentinels, full Rust **375 passed / 0 failed / 1 ignored**, and Cargo check all passed.
- R1B-R1: Watchlist deterministic test timeout corrected in one test file; focused test passed 3/3; full Vitest passed **632/632**; renderer typecheck/build and Watchlist chunk preservation passed.
- Fresh 2026-08-31 snapshot confirms the build-relevant source/config remains **508 files / 12,758,223 bytes / `9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D`**.

### Current task

**Controlled Corporate Action Staging Preflight** using an external alternate Git index/object store. Intended staged source/test/config scope is exactly **35 paths**. Real Git staging is not authorized.

### Current blocker

Latest external operator (not retained in the clean source tree): V1.14AD-Controlled-CA-Staging-Preflight-R1A-R2.ps1
SHA-256: `F30C8E8755B4FCE31DDCF000B368EA8E14E938D601E2AF96FC046CF270703CAD`

The R1A-R2 run reached strict staged-whitespace GREEN and raw-stage verification logic, then failed at the final helper result emission:

`NameError: name 'out' is not defined`

`mode_stagecheck(..., out_s)` is missing `out = pathlib.Path(out_s).resolve()` before `emit(out, result)`.

### Exact next action

Fix only that helper output-variable binding, rerun the alternate-index preflight from a fresh external index, require final stagecheck/postflight artifacts, independently audit the reports ZIP, then update `docs\CURRENT_WORK_STATUS.md` before proceeding.

### Remaining boundary

Even after a successful alternate-index preflight:

`readyForRealStaging = false`

until `PARENT_BASELINE_REVIEW_REQUIRED` / commit ordering is explicitly resolved.

**Do not:** broad-stage shared files, commit, replay old R3/R4 assembly, replace current Watchlist split files, package, or use production SQLite during this staging audit.

<!-- CURRENT-WORK-STATUS-MIRROR:END -->

## Immediate handoff — V1.14M three-row repair closed

<!-- CA-V1.14M.2-AUG24-CANONICAL-CLOSURE -->

> **Corporate Action exact three-row repair closure — 24 August 2026.**
> V1.14M.2 independently re-derived the committed V1.14M.1.1 state from a fresh private read-only snapshot and returned **`FULL_SUCCESS`**. The exact three-row production-candidate repair workstream is therefore **`CLOSED / FULL_SUCCESS`**. This closes only this audited three-row repair tranche; it does not declare all Corporate Action work complete.

- Production Corporate Action source SHA-256: `2e05315fa4bf7fe78f28e787edd2bd9a1fef23fb06cab66cc79c8ede9a1b5cfb`.
- Final repaired imports: `43286 PDSL / INE111Q01013`, `43419 ANDHRAPAP / INE435A01028`, `43501 AVANTIFEED / INE871C01012`.
- All three remain `PENDING_ISIN_MISMATCH` and unapproved; the historical official event ISINs are preserved.
- Old dedupe keys are absent; each new production dedupe key has exactly one owner.
- Target post-state fingerprint: `829f70a4714b24516282399c1ba880c87c0e733841d589a3745a106592ff532a`.
- Non-target import fingerprint: `ef1450c462e1192664ed7c0adad472cb27e79529a88e4d2a7c81c8fec270258a`.
- Protected-table fingerprint: `252c70ac7231c288320b24916ec640cad1c741c4095bbe32efafcffc69f2bbd4`.
- Schema-safety fingerprint: `64246fe499d3093a52901bcddd26447e350cd08eb7457f80227fdd56715a10f2`.
- V1.14M Apply-plan fingerprint: `5981c3ebd141f443af2cf38f69ae3f704c04f97abb039973a45c44635b089f98`.
- V1.14M mutation fingerprint: `153f999d2087d396943cabffadbd3b33817055f2b1874975fb7b8d7c23723821`.
- Independent V1.14M.2 post-audit fingerprint: `817d6bbccbc02fee7b8e28770616f76eb46723c5f273763573ea9dcf6c78daa2`.
- V1.14M.2 report ZIP SHA-256: `d56b3038d55e310ff3555c3821d620c47ab37f56e1b97f5863847d74baf92e99`.
- Integrity: `quick_check=ok`; foreign-key violations `0`; V1.14M.2 database writes `0`.

### Operator handoff

No further database gate is required for this exact three-row repair. After this documentation closeout is verified, normal application operation may resume. Future Corporate Action work must start from the closed fingerprints above and must not reinterpret these three imports as approved Corporate Actions; they remain reviewable `PENDING_ISIN_MISMATCH` imports.

## Current objective

Maintain the warning-clean V1.7D Tauri 2 EOD Charting Platform from fresh source snapshot `Eod Charting Platform Source Code 2026-08-22_211417_IST` (uploaded ZIP SHA-256 `1A8F96F4BB339AE9FD1A7995F36A7D3CA4668244D3F3DC0772E6FE19D8ADC81D`). The accepted current Quote Editor UX is the embedded in-app `FloatingWindow`; the separate native/taskbar WebviewWindow experiment is rejected and fully rolled back.

The storage closeout currently comprises:

- Generation-6 binary-state sidecar with V1.3 baseline and V1.4 APPEND_NEWEST fast paths;
- V1.5 Quote Editor `download_log` invalidation;
- V1.6 localized sidecar invalidation and post-checkpoint incremental VERIFIED publication;
- V1.7A immediate new/full-file durability plus checkpoint phase/latency telemetry;
- V1.7C checkpoint cap 2;
- V1.7D binary import/write cap 2 while binary coverage prefilter remains 4.

Current runtime-validation portable SHA-256: `7C3E92E77ABBAD314F795C73577AED453E4641E6EB9C557C689019F14091847B`. Embedded Quote Editor smoke test passed. The final post-documentation portable build is still required.

Current operational database state is integrity-checked but not fully reconciled: Generation 6 is `COMPLETE`, sidecar has 24,535 VERIFIED / 0 DIRTY / 0 UNKNOWN, physical `.eod` census is 24,536, and recovery sessions are zero. The exact one-row gap is a separate read-only audit; do not rebuild or repair it during documentation/final-build work.

Immediate sequence:

1. apply the August 22 canonical documentation reconciliation;
2. build the final portable executable and record its hash;
3. on the next genuine trading day, capture the full Bhavcopy log to validate V1.7D two-worker import responsiveness/performance;
4. separately identify/reconcile the one missing state row through a read-only evidence-first audit.

Corporate Actions, Gann fidelity, and Git housekeeping retain their prior governed boundaries and must not be mixed into this closeout.

## Accepted Chart Viewport & Zoom Preservation Baseline (August 19, 2026 — confirmed working)

- **Root cause fixed**: `buildInstrumentLoadStartTab` zeroes `viewport → {0, 0}` for new instruments before the async data fetch. The previous implementation of `applyEodResultToTab` read from the already-zeroed loading-state tab, so the condition `tab.viewport.endIndex > tab.viewport.startIndex` was always `0 > 0 = false`, silently falling back to `createDefaultViewport`. The pre-load viewport was never preserved.
- **Symbol Viewport & Zoom Retention**: `loadInstrument` in `chartInstrumentCompareController.ts` now snapshots all tab viewports synchronously before `buildInstrumentLoadStartTab` zeroes them. The snapshot is passed as optional `previousViewport` to `applyEodResultToTab`, which uses `isViewportMeaningful(previousViewport)` to decide whether to restore or default. Switching symbols via watchlists, sidebar, search palette, or hotkeys now correctly preserves the user's horizontal zoom span and right-edge offset.
- **Timeframe & Chart Type Viewport Anchoring**: `applyTimeframeToTab` → `remapViewportAcrossTimeframe` was already structurally correct. It was silently falling back to `createDefaultViewport` because after a symbol switch the stored viewport was `{0, 0}` (from the broken symbol path above). With the symbol fix in place, the store always holds a meaningful viewport for the remap to anchor from.
- **Dynamic Price Scale Auto-Fit**: Stale manual price scale overrides (`paneScaleOverrides.price`) are cleared on instrument switch so the new symbol auto-scales to its own range.
- **Verification**: 111 test files / 637 tests PASS, `npm run typecheck:renderer` PASS (exit 0).
- **Files changed**: `src/features/charts/chartInstrumentHydrationService.ts` (+1 optional param `previousViewport` to `applyEodResultToTab`), `src/features/charts/chartInstrumentCompareController.ts` (viewport snapshot before first setState, passed through to `applyEodResultToTab`).

## Accepted Future Date Axis Year Label Fix (August 19, 2026)

- **Root cause**: `collectBoundaryTicks` and `averageBoundaryGapPx` in `ScaleManager.ts` hard-capped their scan at `bars.length - 1`, so year/month boundary ticks were never generated for future bar slots. `getPreviousBarLogicalDate` returned `null` for any future index (`index > bars.length - 1`), making year-boundary comparison against `null` unreliable for future indices. Result: when the viewport extended into the future zone past a year boundary, the current year label was repeated instead of showing the correct next year.
- **Fix**: Three targeted patches in `src/engine/ScaleManager.ts` only (~6 lines):
  - `collectBoundaryTicks`: `realEnd` now uses the caller-provided `end` (already capped at `bars.length + 500`) instead of `Math.min(end, bars.length - 1)` — boundary ticks are now generated across the full visible range including future slots.
  - `averageBoundaryGapPx`: same `realEnd` fix — boundary mode resolver is accurate when the viewport is mostly future bars.
  - `getPreviousBarLogicalDate`: guard relaxed from `index > bars.length - 1 → null` to `index <= 0 → null`; now delegates to `getLogicalDateForIndex` for all indices, which correctly extrapolates future dates from the last real bar.
- **Verification**: 111 test files / 637 tests PASS, `npm run typecheck:renderer` PASS (exit 0).
- **File changed**: `src/engine/ScaleManager.ts` only.


## Accepted Official Watchlist & Sector Universe Expansion Baseline (August 16, 2026)

- **BSE Stocks by Sector Universe** (`src/features/watchlists/bseSectorUniverseWatchlistData.generated.ts`): Added 6th official source tab with 13 official BSE macro-economic sector groups covering 1,527 BSE-listed equity stocks (*Commodities, Consumer Discretionary, Diversified, Energy, FMCG, Financial Services, Healthcare, Industrials, IT, Other / Diversified, Services, Telecom, Utilities*).
- **Automated Universe Refresh CLI** (`scripts/refresh-sector-universe.mjs`): Standalone on-demand script to fetch live feeds from `www.bseindices.com` and generate updated sector universe catalogs (`--source nse|bse|all`).
- **BSE Sectors & Indices Catalog Expansion** (`src/features/watchlists/officialWatchlistData.generated.ts`): Expanded BSE Sectors to 27 groups, BSE Indices to 15 groups (including fully populated BSE 500 with 501 members), disentangled BSE Power (Code: 69) and Energy (Code: 90), and whitelisted `www.bseindices.com` in backend fetch handler.
- **Manual-Only Trigger Contract**: Preserved strict user-initiated updates (zero silent background network calls on app open).
- **Verification**: 70/70 tests passed across `src/features/watchlists/`, 105 test files passing across project, `npm run typecheck:renderer` passed, `npm run tauri:check` passed. Pre-edit backup created at `backups/pre_opencode_changes_20260816_163511_bse-stocks-by-sector-universe`.

## Current source of truth

- Live project root: `E:\TA Projects\EOD Charting Platform`.
- Documentation basis snapshot: `Eod Charting Platform Source Code 2026-08-22_211417_IST`.
- Uploaded basis ZIP SHA-256: `1A8F96F4BB339AE9FD1A7995F36A7D3CA4668244D3F3DC0772E6FE19D8ADC81D`.
- Snapshot file count: 721 before this reconciliation.
- Active renderer: `src/`; active Rust backend: `src-tauri-shell/`.
- Typed renderer/backend seam: `src/platform/*` and `src/types/desktop.ts`.
- Cargo output: repository-root `target/` via `.cargo/config.toml`.
- Canonical release executable: `target\release\eod-charting-platform-shell.exe`.
- Portable destination: `release\tauri-portable-win\EOD Chart Portable`.
- Current runtime-validation portable SHA-256: `7C3E92E77ABBAD314F795C73577AED453E4641E6EB9C557C689019F14091847B`.

## Accepted Warning-Cleanup Baseline (August 22, 2026)

- W1.1–W1.4-B1 remains closed.
- Final Rust warning reconciliation is also closed: production `cargo check`, Rust test compilation, and Tauri compile check pass with `RUSTFLAGS=-D warnings`.
- No blanket `#[allow(dead_code)]` was added; unused release-only state/bootstrap surface was removed or test-gated without changing Generation 6, durability, or worker policy.
- Accepted renderer chunks after the embedded Quote Editor rollback build: `feature-chart-canvas` ~206.72 kB, `feature-chart-core` ~298.43 kB, `feature-chart-analysis` ~164.40 kB, `vendor-technicalindicators` ~19.81 kB, `feature-official-watchlists` ~55.08 kB.
- Runtime-validation portable build/manual smoke test: PASS; executable SHA-256 `7C3E92E77ABBAD314F795C73577AED453E4641E6EB9C557C689019F14091847B`.
- Evidence: `docs/changes/2026-08-22_2114_IST_STORAGE_QUOTE_EDITOR_WARNING_CLEANUP_CLOSEOUT.md`.

## Corporate Actions V1.12.1 Closeout / V1.13 Boundary

- V1.11 controlled approval approved exactly 283 authorized READY rows and left exactly 111 identity blockers.
- V1.12/V1.12.1 researched and classified all 111 residuals. Accepted result: 14 SAFE future-write candidates and 97 manual/unresolved.
- Final states: 10 `SAFE_OFFICIAL_EXTERNAL_EVIDENCE`, 4 `SAFE_RENAME_OR_RESTRUCTURE`, 49 `MANUAL_COMPANY_IDENTITY_REVIEW`, 5 `CONFLICT_UNRESOLVED`, 42 `NO_EVIDENCE_FOUND`, 1 `DATA_INTEGRITY_ANOMALY`.
- V1.12.1 final verification: 111/111, 22/22 package/regression tests, live DB/WAL/SHM unchanged, database writes 0, identity/history writes 0, Corporate Action approvals 0, Quick Resolves 0.
- V1.13 implementation has not started. Its approved scope is strict two-stage identity repair: exact 14 SAFE identity/history evidence writes only, followed by an independent read-only status recheck/post-audit. The other 97 rows remain untouched.

## Repository Maintenance Boundary

Git status/normalization remains intentionally deferred. Do not mix Git cleanup with the next Corporate Actions audit. Until a separate Git-maintenance phase is approved, source snapshots plus SHA-256 package/source guards remain the recovery baseline.

## Accepted August 20–22 storage and Quote Editor baseline

- Bhavcopy binary import/write cap = 2; read-only coverage prefilter cap = 4; deferred checkpoint cap = 2.
- New/full-file writes sync before rename; only durable-journal existing-file APPEND_NEWEST may defer sync.
- Checkpoint telemetry exposes verify/sync/publish and p50/p95/max.
- V1.5/V1.6 Quote Editor mutations invalidate download metadata and only affected state rows; zero-row operations preserve state.
- Quote Editor exchange scope defaults to ALL and includes NSE/NSE-INDEX/BSE/BSE-INDEX/reserved MCX; ALL loads report per-exchange counts.
- Quote Editor remains in-app `FloatingWindow`; native child-window experiment is rejected/rolled back.
- Genuine 2026-08-21 import succeeded 4/4 with 8,810 source rows, 23 new files, and 8,783 APPEND_NEWEST files. That run occurred before V1.7D import cap 2, so next genuine-day validation is still required.
- Current one-row physical/index gap is non-blocking but unresolved; keep it separate from UI/docs/final-build work.

## Accepted import/recovery baseline

### Manual Import Recovery and identity boundary

- Binary Manual Import uses durable, database-bound recovery sessions with manifest/journal integrity and newest-first persisted history.
- Session-specific Undo removes only proven inserted rows, restores overwrite before-images, preserves conflicting later edits, and may remove only provenance-proven session-created placeholder symbols.
- Quotation Editor deletion is quote-only. Removing the final quote does not delete instrument identity.
- Do not synthesize BSE symbols from `SC_NAME`, `SC_SHORT_NAME`, or company-name text. Legacy historical files may preserve official numeric `SC_CODE`; alpha resolution is a separate audited identity task.
- Keep NSE equity ingestion broad across supported equity/trade-for-trade/SME series and filter normal browsing in Symbols/sidebar; configured government-security exclusions are separate.

### Bhavcopy Phase 2B.1 and interrupted checkpoint resume

- Protected imports persist exact pre-mutation binary boundaries and a SHA-256 protected recovery manifest before mutation.
- Exact APPEND_NEWEST tail verification rejects unknown later dates, changed same-date rows, malformed headers/scale, and journal mismatch.
- Fast deferred-checkpoint resume accepts only `APPLIED` and `CHECKPOINTING`; other recovery states retain conservative handling.
- The August 12 restart case proved why this matters: the earlier sequential 8,570-file checkpoint took `1,057,829 ms` (about 17m38s) after the session resumed through the checkpoint path.

### Bhavcopy Phase 2C

- Current binary import/write concurrency is capped at 2 workers. The August 13 evidence below is the historical 4-worker baseline; binary coverage prefilter remains independently capped at 4.
- Only recovery-journal-governed existing-file `APPEND_NEWEST` writes may defer physical `sync_data()`.
- `REWRITE_TAIL`, `UPDATE_EXISTING`, `INSERT_HISTORICAL`, recovery replay, and Manual Import remain immediately durable.
- August 13 production import: 8,453 rows, 8,449 symbols, 43 new files, 8,406 APPEND_NEWEST files, 0 binary errors, 0 foreground `sync_data()` calls, 8,406 deferred syncs, and 57,456 ms binary-write wall time.
- Exchange results for that run: BSE 4,972 rows; BSE Index 77 rows; NSE 3,404 rows; NSE Index source unavailable for 2026-08-13.

### Bhavcopy Phase 2D background checkpoint

- After a successful buffered import, retained APPEND_NEWEST durability work is scheduled as a blocking background task rather than deferred to the next normal Bhavcopy run.
- Physical checkpointing remains fail-closed: journal/binary verification precedes `sync_data()`. Current checkpoint concurrency is capped at 2 workers; the August 13 evidence below is the historical 4-worker baseline.
- Process-local lifecycle serialization prevents foreground/background checkpoint/recovery races. A Bhavcopy operation started while the background checkpoint is still running may wait for that lifecycle lock; the supplied runtime acceptance did not exercise that exact concurrent-start case.
- Production Phase 2D runtime: session `20260813T110934.752306Z-p18044-0`, 8,406 APPEND_NEWEST files, 4 workers, start 16:40:39, complete 16:42:44, `elapsedMs=125405` (about 2m05s).
- Against the prior 8,570-file sequential checkpoint at `1,057,829 ms`, the observed elapsed time was about 8.44x faster / 88.1% lower. Workloads are close but not identical, so treat the percentage as operational evidence rather than a microbenchmark.
- The next Update at 16:45 completed in about two seconds with 0 jobs and did not perform a long retained-session recovery/checkpoint.

### Update cutoff, calendar safety, and source classification

- Automatic `Update` probes only through the previous calendar day before 18:00 local time; at/after 18:00 it may probe the current day. Manual Date Range and Full History are unchanged.
- Calendar precedence is special trading session first, then weekend, then known exchange holiday, then normal source probing. Special-session rules are exchange-aware for NSE/NSE Index and BSE/BSE Index.
- Date-by-date weekend/holiday logs remain visible. A date that reached the downloader and has no source is reported as unavailable/missing rather than being invented as a holiday.
- BSE/BSE Index HTML-instead-of-CSV responses are soft candidate mismatches. Soft mismatch text cannot overwrite a genuine hard candidate error; terminal SKIP is allowed only when no hard error remains.
- Final Rust validation after the candidate-classification correction: focused regression 1/1 PASS, Bhavcopy filter 50/50 PASS, `cargo check` PASS. The rebuilt current-day run then completed 3 success / 17 skipped / 0 failed with 8,453 imported rows. Because BSE Index data had become available, the exact all-soft terminal branch was not re-triggered in that rebuilt runtime run.

### Date Range prefilter

- Prefilter Range Scan V1 retains metadata-vs-binary reconciliation, the 80% usable-coverage threshold, the 31-target-date cap, fail-closed I/O behavior, and a maximum of 4 read workers.
- Trigger baseline for eight target dates: NSE 523,371 ms across 7,132 files; BSE 171,131 ms across 16,722 files.
- First optimized runtime: NSE 147,048 ms; BSE 77,687 ms, with the same eight already-imported dates preserved.
- Later same-range runtime: NSE 18,669 ms; BSE 2,593 ms; NSE Index 294 ms; BSE Index 27 ms. File-system/OS caching materially affects absolute timings, so the later 23-second planning stage is not a guaranteed cold-run figure.
- Prefilter V2/persistent coverage indexing is not currently justified. Reopen only if repeated real cold runs again become operationally unacceptable.

## Historical BSE/BSE Index acceptance retained

- BSE historical Equity/Index October-2023 coverage was runtime-tested successfully.
- BSE Index `IndexArchDailyAllPar` preserves literal `DD/MM/YYYY` query dates.
- Previously missing 2023-09-08, 14, 20, and 25 each imported 57 BSE Index rows; aggregate 4 success, 0 failed, 228 rows.
- A later July-2026 BSE/BSE Index missing-date backfill completed 12/12 jobs with 53,813 rows and 0 failures; its slower binary work used conservative rewrite/historical paths and is not a Phase 2C regression.


## Accepted Fibonacci baseline

- The Fibonacci family is **COMPLETE / CLOSED** at this checkpoint. The production group contains eleven Fibonacci kinds: `fib`, `fibExtension`, `trendFibExtension`, `fibChannel`, `fibTimeZone`, `fibTimeExtension`, `fibCircles`, `fibSpiral`, `fibArcs`, `fibWedge`, and `fibFan`.
- Fibonacci Retracement retains the accepted corrected orientation/plotting and full level authority. Trend-Based Fib Extension remains the reference-working three-anchor implementation.
- Fib Circles and Fib Speed Resistance Arcs are manually accepted.
- Fib Wedge retains the accepted data-space-first rule: stored bar/price anchors -> canonical wedge curves in data coordinates -> project sampled points through the current viewport. Do not restore screen-authored ellipse geometry.
- Fib Spiral is accepted on the restored **F1D.1** geometry. Counterclockwise, color/style, persisted same-timeframe perpendicular basis, and same-timeframe zoom stability are retained. The F1D.2 absolute-time/timeDeltaMs experiment was rejected because it distorted coarse timeframes and was rolled back; do not reintroduce it.
- Persisted kind `fibFan` now uses the accepted F1E Fib Speed Resistance Fan geometry. Its public metadata title is still `Fibonacci Fan`; this is a naming/compatibility detail, not a separate accepted geometry. F1E.1 builds each visible ray from the exact projected apex and Fibonacci price/time target, extends that projected ray for clipping, and shares canonical geometry with hit-testing.
- Completed Fibonacci geometry is a protected regression baseline during Gann work.

## Accepted Indicator Engine Baseline (118 Modular Indicators)

- The indicator subsystem is **COMPLETE & DECENTRALIZED** with a 1-file-per-indicator modular architecture under `src/indicators/standard/` and `src/indicators/community/`.
- All **47 missing standard TradingView indicators** across 5 batches are implemented, registered, and verified with dedicated test suites (`IndicatorsBatch1` through `IndicatorsBatch5`).
- **20 top high-value Community indicators** across two batches are implemented and tested (`IndicatorsCommunity.test.ts` and `IndicatorsCommunityBatch2.test.ts`):
  - Batch 1: `UT_BOT`, `WADDAH_ATTAR`, `SQUEEZE_MOMENTUM`, `WAVETREND`, `QQE_MOD`, `CHANDELIER_EXIT`, `SSL_CHANNEL`, `RIPSTER_EMA_CLOUDS`, `ALPHA_TREND`, `VFI`, `HALF_TREND`, `LINREG_CHANNEL`.
  - Batch 2: `SUPERTREND_AI`, `ORDER_BLOCKS`, `FVG`, `MARKET_CIPHER_B`, `RANGE_FILTER_DW`, `DONCHIAN_RIBBON`, `TRENDLINES_BREAKS`, `CM_VIX_FIX`.
- Full UI integration with typed schemas in `IndicatorSettingsDialog.tsx`, search catalog and label formatters in `catalog.ts`, and the **Hybrid Indicator Window** in `IndicatorPickerDialog.tsx` (top search + segmented master tabs, 9-category left navigation rail, 1-click `[+]` add buttons, favorite `★` pinning persistence, and right preview card).
- **Draggable Floating Window Architecture**: Reusable hook `src/components/common/useDraggableFloatingWindow.ts` and `FloatingDialogShell.tsx` provide smooth draggable titlebars, boundary clamping, and session position memory.
- **Zero-Blur Chart Visibility**: All dialogs (`IndicatorPickerDialog.tsx`, `IndicatorSettingsDialog.tsx`, `ChartDrawingPropertiesDialog.tsx`) use ultra-light clear overlays without blur, keeping price candles, indicators, and chart drawings 100% sharp and visible underneath.
- Sidebar organized into 'Price' and 'Pane' placement groups with 9 collapsible/expandable subcategories (`src/indicators/catalog.ts`, `src/components/Sidebar.tsx`).
- Total verification: 101 test files, 570 unit tests passing (`indicatorCatalogSubcategories.test.ts`, `useDraggableFloatingWindow.test.ts`). Full details documented in `docs/indicator-catalog.md`.

## Accepted Japanese Candlestick Patterns Baseline (44 Patterns, 3 Categories)

- The Japanese Candlestick Pattern Engine is **COMPLETE & PARITY-VERIFIED** under `src/engine/candlestick/` and `src/engine/Patterns.ts`.
- All **44 official TradingView candlestick patterns** are implemented and explicitly categorized into:
  - **Single-Candle Patterns (15)**: Doji, Dragonfly/Gravestone Doji, Doji Stars, Hammer, Inverted Hammer, Hanging Man, Shooting Star, Marubozu White/Black, Spinning Tops, Long Shadows.
  - **Two-Candle Patterns (15)**: Bullish/Bearish Engulfing, Harami, Harami Cross, Piercing Line, Dark Cloud Cover, Tweezer Top/Bottom, Kicking, Windows, On Neck.
  - **Multi-Candle Patterns (14)**: Morning/Evening Stars, Morning/Evening Doji Stars, Abandoned Babies, 3 White Soldiers, 3 Black Crows, Tri-Star, Rising/Falling Three Methods, Tasuki Gaps.
- Exact PineScript $C\_$ property vectorization (14 EMA body smoothing, shadow domination ratios, trend slope filters, range invariants).
- **Directional Colors & Label Spacing**: Bullish patterns render in emerald green (`#22c55e`), Bearish in coral red (`#ef4444`), and Neutral in amber (`#f59e0b`), with high-contrast text and 15px clearance above/below wicks.
- **Persistence & 1-Click Toolbar Toggle**: Pattern selections and colors persist via `src/features/candlestick/candlestickSettingsService.ts`. The top toolbar `Toolbar.tsx` provides a 1-click `Candles` toggle button (1st click scans and plots patterns, 2nd click removes, active blue accent styling). Redundant button removed from `ChartToolDock.tsx`.
- UI integration with categorized pattern picker sections in `IndicatorSettingsDialog.tsx` and "Select All / Clear" helpers per category.
- Total verification: 98 test files, 556 unit tests passing (`CandlestickPatterns.test.ts`, `candlestickSettingsService.test.ts`).

## Accepted Sidebar Suite, Quick Symbol Switcher & Global Hotkeys Baseline (August 17, 2026)

- **Command Palette Smooth Keyboard Scrolling** (`src/components/CommandPalette.tsx`): Attached dynamic element refs and automated `scrollIntoView({ block: 'nearest' })` on <kbd>↑</kbd> and <kbd>↓</kbd> keyboard navigation, ensuring selection highlight and viewport remain perfectly in sync.
- **Silent Timeframe Hotkeys** (`src/RootApp.tsx`): Streamlined single-key timeframe shortcuts (<kbd>D</kbd>, <kbd>W</kbd>, <kbd>M</kbd>, <kbd>Q</kbd>, <kbd>Y</kbd>) to execute instantly and silently without intrusive popup toast notifications, relying on top toolbar active button highlights.
- **Sidebar Watchlists Tab Space & Submenu Refinements** (`src/components/Sidebar.tsx`):
  - **Reclaimed Vertical Sidebar Space**: Removed redundant bulky `Source linked` and `Last synced` banner boxes from the sidebar; embedded sync status and timestamp directly into the `Update` button's tooltip.
  - **Seamless "Add to Watchlist" Submenu**: Eliminated hover-gap mouseleave race conditions via a seamless hitbox bridge and added the "Add to Watchlist ▾" submenu to both the Symbols panel and the Watchlists panel context menus.
  - **Inline Quick-Add Input & Sorting**: Maintained inline search with debounced dropdown and 1-click A-Z/Z-A sorting.
- **Chart Double-Click Auto-Scale Alignment** (`src/engine/ChartEngine.ts`):
  - **Price / Indicator Scale Auto-Fit**: Double-clicking the right Y-axis price scale or any indicator pane's Y-axis immediately resets manual vertical stretch/compression overrides (`paneScaleOverrides[paneId] = null`), returning that pane to dynamic Auto-Fit.
  - **Protected Chart Canvas**: Double-clicking inside the main chart plot area (candles/canvas) no longer forcibly resets the horizontal viewport, preventing disruption to active zoom/pan navigation.
  - **Time Axis Reset**: Double-clicking the bottom Date/Time axis resets horizontal viewport to default.
- **Verification**: All 111 test files passing, `npm run typecheck:renderer` PASS.

## Accepted Floating Windows & Left Sidebar Rail Dock Baseline (August 15, 2026)

- **Left Sidebar Navigation Rail Minimized Dock** (`src/components/Sidebar.tsx`): Minimized windows dock cleanly at the bottom of the left rail (`SYM`, `IND`, `WL`, `MOV`). Provides dedicated domain icon badges (`🔍` Scanner, `📥` Bhavcopy, `⭐` Watchlists, `📊` Indicators, `🔔` Alerts, `📝` Quote Editor, `🏢` Corporate Actions, `⚙` Settings), active green status dots, 1-click restore/focus, and right-click quick close. Frees up 100% of the chart canvas, date axis, volume histogram, and sheet tabs.
- **Fail-Safe Fallback Dock** (`src/components/WindowTray.tsx`): Discreet bottom-left floating dock renders only when the sidebar is completely hidden via the View menu.
- **Favorite Tools Floating Toolbar Mobility** (`src/components/FavoriteToolsToolbar.tsx`): Updated to `position: 'fixed'` and mounted at application root (`src/RootApp.tsx`), enabling unrestricted drag mobility across all app regions, sidebars, headers, and tabs without canvas clipping.
- **Indicators & Studies Floating Window** (`src/components/IndicatorPickerDialog.tsx`): Registered in `useWindowStore` with `FloatingWindow.tsx` (`960 × 620`); removed modal backdrop so clicking/panning on the chart canvas does not close the window.
- **Manage Watchlists Floating Window** (`src/components/WatchlistManagerDialog.tsx`): Converted to `FloatingWindow.tsx` (`780 × 580`), removing blocking modal backdrops to enable side-by-side watchlist editing while monitoring live charts.
- Total verification: 103 test files, 578 unit tests passing.

## Accepted Drawing Templates & Favorite Quick Toolbar Baseline

- **Drawing Templates Engine** (`src/features/drawings/drawingTemplates.ts`): Persistent template management system allowing users to save, name, apply, and designate default visual styles per drawing tool kind directly from `ChartDrawingPropertiesDialog.tsx`. Verified with dedicated unit tests (`drawingTemplates.test.ts`).
- **Floating Favorite Tools Toolbar** (`src/components/FavoriteToolsToolbar.tsx`): Draggable floating quick toolbar with active tool highlight, keyboard shortcuts, and horizontal/vertical layout toggle.
- **Interactive Star Toggles** (`src/components/ChartToolDock.tsx`): ⭐ star icons next to all tools in flyouts to pin/unpin favorites directly into the floating toolbar, with a dedicated dock toggle button.
- Total verification: 98 test files, 556 unit tests passing.

## Current non-blocking boundaries

- The next genuine trading-day Bhavcopy log is required to validate the V1.7D two-worker binary import policy; do not manufacture the workload through Quote Editor deletion.
- Checkpoint synthetic benchmark and real full-market evidence disagree; retain two workers for now and judge only from comparable workload telemetry.
- Generation 6 currently has one physical `.eod` file without a sidecar row. SQLite integrity is `ok`; per-symbol fallback remains safe. Exact key/cause/reconciliation are pending read-only audit.
- Large backward historical fills can remain slower because conservative mutations sync immediately. Prefer chronological oldest-to-newest loading when practical.
- BSE historical alpha-symbol resolution remains a separate identity audit.
- No Prefilter V2/provider redesign is planned without new measured evidence.

## Files to inspect first for Bhavcopy maintenance

1. `AGENTS.md`
2. `HANDOFF.md`
3. `REQUIREMENTS.md`
4. `src-tauri-shell/src/bhavcopy.rs`
5. `src-tauri-shell/src/bhavcopy_recovery.rs`
6. `src-tauri-shell/src/database/binary_eod.rs`
7. `src-tauri-shell/src/database/eod_binary_state.rs`
8. `src-tauri-shell/src/database/quotes.rs`
9. `src/components/DatabaseToolsDialogs.tsx`
10. `src/features/quoteEditor/quoteEditorExchangeScope.ts`
11. `docs/changes/2026-08-22_2114_IST_STORAGE_QUOTE_EDITOR_WARNING_CLEANUP_CLOSEOUT.md`
12. `docs/changes/2026-08-12_2102_IST_BHAVCOPY_INTERRUPTED_CHECKPOINT_RESUME_FIX_V1.md`
13. `docs/changes/2026-08-12_2353_IST_BHAVCOPY_PHASE2D_BACKGROUND_CHECKPOINT_V1.md`
14. `docs/changes/2026-08-13_0030_IST_BHAVCOPY_UPDATE_SAME_DAY_CUTOFF_V1.md`
15. `docs/changes/2026-08-13_0232_IST_BHAVCOPY_CALENDAR_SAFETY_V1_1.md`
16. `docs/changes/2026-08-13_1305_IST_BHAVCOPY_PREFILTER_RANGE_SCAN_V1.md`
17. `docs/changes/2026-08-13_1555_IST_BHAVCOPY_BSE_INDEX_CANDIDATE_CLASSIFICATION_V1_1.md`

## Files to inspect first for Gann work

1. `AGENTS.md`
2. `HANDOFF.md`
3. `src/components/DrawingToolGroups.ts`
4. `src/engine/DrawingMetadata.ts`
5. `src/engine/DrawingAdvancedGeometry.ts`
6. `src/engine/DrawingStyleSchema.ts`
7. `src/engine/Renderer.ts`
8. `src/engine/ChartEngine.ts`
9. `src/engine/types.ts`
10. `src/engine/__tests__/DrawingS23Contracts.test.ts` and Gann-relevant drawing tests
11. `docs/changes/2026-08-13_2105_IST_FIBONACCI_FINAL_DOCUMENTATION_RECONCILIATION_V1.md`

## Exact next step

Apply the August 22 documentation-only reconciliation and run the documentation reference/consistency checks. Then perform the final portable build and record its executable SHA-256.

On the next genuine trading day, send the complete Bhavcopy log from planning through background checkpoint completion. Confirm `Bhavcopy binary write stats: workers 2`, checkpoint `workers 2`, imported row/path counts, sync counts, and phase telemetry. Do not use Quote Editor to create an artificial workload.

After the release/build gate, run a separate read-only one-row binary-state gap audit. Do not rebuild, republish, or edit live data until the exact missing exchange/symbol and cause are identified.

Corporate Actions, Gann fidelity, and Git maintenance retain their prior governed boundaries.

<!-- V1.13-FINAL-CLOSEOUT:BEGIN -->
## Corporate Actions Phase 1 — V1.13 six-row identity repair closeout (2026-08-19)

### Current Corporate Actions handoff

The authorized six-row V1.13B-1 historical-ISIN repair is closed at `FULL_SUCCESS`.

**Closed tranche**
- Import 42274 PARSVNATH → history row 11602
- Import 19888 SBIN → history row 11603
- Import 24224 HINDCOMPOS → history row 11604
- Import 24025 GAYAPROJ → history row 11605
- Import 23036 BAJFINANCE → history row 11606
- Import 12841 TITAN → history row 11607

**Preserved boundary**
- Corporate Action imports/status were not promoted.
- Quick Resolve count: 0.
- Approval count: 0.
- Protected imports remain unresolved/unapproved: 819, 19896, 19973, 19977, 22969, 41025, 41574, 42863.

**Next Corporate Actions work**
Start a new read-only classification/design phase for the eight protected imports only. Do not reuse or rerun the closed six-row Apply. Keep successor/restructure cases separate from stale-association cases and from missing historical-symbol evidence.
<!-- V1.13-FINAL-CLOSEOUT:END -->


<!-- CA-R1A-2026-09-24:BEGIN -->
## Corporate Actions — Reconciliation R1-A current handoff (24 September 2026)

Current authority: `docs/superpowers/specs/2026-09-24-corporate-action-reconciliation-r1a-current-authority.md`.

- Fresh source snapshot: `Eod Charting Platform Source Code 2026-09-24_201002_IST.zip`
- Snapshot SHA-256: `B4C3E9AB71B79B2E3F9B0A703E43EF68F56B0DC89B655244BBC606634AF03719`
- Accepted live source: **569**
- Protected source: **563**
- R1-A source + copy-local acceptance: **CLOSED / CURRENT**
- 112-row accounting: **112/112**
- R1-A repair writes: **0**
- R1-A CA approvals: **0**
- R1-B deterministic repairs/TDD: **NOT STARTED**
- R1-C controlled TEST-DB apply/portable acceptance: **NOT STARTED**

Exact next bounded task: R1-B date-valid historical-symbol evidence reconciliation, beginning with imports 819, 19896 and 22888 as fixtures for one general evidence-backed rule. Do not hard-code symbol exceptions and do not broaden into price-data/no-active-candidate repair classes in the first slice.

Read next: `docs/superpowers/specs/2026-09-24-corporate-action-new-chat-handoff-after-r1a.md`.
<!-- CA-R1A-2026-09-24:END -->

<!-- P5-FINAL-FAIL-CLOSED-PLUGIN-CA-HANDOFF-R1:2026-10-17 -->
## P5-FINAL — Plugin closeout / CA handoff (safe deferred-activation)

- **Classification:** PLUGIN_P5_FINAL_FAIL_CLOSED_INFRASTRUCTURE_CLOSED_EXTERNAL_JS_ACTIVATION_DEFERRED.
- **Acceptance:** metadata-only external plugin discovery/import/reload; external JavaScript must not auto-evaluate or activate. Built-in plugins, SDK contracts, package installation/recovery and other accepted behavior preserved by anchored source identities and native regression gates.
- **Security:** C2 only demonstrated a disposable about:blank guest with opaque origin and NO_BRIDGE; no guest IPC rejection, CPU/memory/process containment or network denial was proven. Do NOT enable unrestricted external plugin JavaScript or grant new IPC permissions.
- **CA resumption:** Plugin work no longer requires active CA to stay paused. The NEXT CA TASK is read-only reconciliation of the October 16 protected-source drift inventory; CA status/authority must not be promoted and no CA database/writes/tests are authorized by this handoff.
- **Evidence/record:** docs/changes/2026-10-17_1148_IST_P5FINAL_FAIL_CLOSED_PLUGIN_CLOSEOUT_CA_HANDOFF_R1.md.


<!-- CA-P4B-P1P2-THREE-FILE-AUTHORITY-2026-10-17 -->
## CA-P4B — P1/P2 three-file source authority accepted (documentation-only)

- **Classification:** `P1P2_RECONSTRUCTED_THREE_FILE_AUTHORITY_ACCEPTED_CA_WRITE_BLOCK_PRESERVED`.
- **Authority:** original P1/P2 source backups and unchanged implementation toolkits were replayed offline; reconstructed POST bytes matched the 17 Oct snapshot and prior CA 637-path live scan. User approved accepting these exact identities on 17 Oct 2026 IST.
- **src/engine/ChartEngine.ts** (P1): SHA256 D242DCADB94C48D284F3D7E90E07AAC95B2054E036E9809E5173C39BA30F3132.
- **src/plugins/analysis/gannPriceTime/gannPlugin.ts** (P1): SHA256 9DD43623FBA00F8025271D7E09DC53D6D4D2DFB246E8BD9136C187BDB723208F.
- **src/platform/types.ts** (P2): SHA256 0669E880939D94C092488C47334F280FBAA120BD9BC004A3C85969F7741914FA.
- This is an explicit *reconstructed* authority acceptance, **not** a claim that original P1/P2 POST SHA256 receipts were found. Prior historical evidence and failed runs remain unchanged.
- **Preserve:** accepted chart and Gann overlay behavior, CA write bridge, built-in plugins, P5-FINAL closeout. External plugin JavaScript stays disabled; isolation remains unverified.
- **CA status:** three historical source-identity blockers reconciled for planning; this does **not** authorize CA code changes, Prepare, approvals, production DB access or writes. Separate CA implementation approval and focused validation are required.
- **Record:** docs/changes/2026-10-17_1352_IST_P1P2_THREE_FILE_SOURCE_AUTHORITY_ACCEPTANCE_R1.md.


## 2026-10-17_1514_IST — Integrated CA normal three-action workflow
- Verified source: 8 modified files, P1/P2/P5 identities preserved.
- Normal workflow: Fetch from Officials → Load & Validate → explicit Approve Ready.
- Validation: see `docs/changes/2026-10-17_1514_IST_CA_INTEGRATED_THREE_ACTION_WORKFLOW_R1.md`. No automatic approval, raw EOD rewrite or external plugin activation.
- Portability build/manual desktop chart refresh: separate manual checkpoint, not claimed PASS.


## 2026-10-18_0423_IST — CA Three-Action Completion Lean R1
- Active CA control labels and policy aligned to Fetch from Officials -> Load & Validate -> explicit Approve Ready; existing execution and storage contracts unchanged.
- Focused tests/build/candidate portable validation receipts: EOD_CA_THREE_ACTION_COMPLETION_R1. Working portable release is untouched. See docs/changes/2026-10-18_0423_IST_CA_THREE_ACTION_COMPLETION_LEAN_R1.md.
- Real official Fetch, production approvals and active chart-refresh manual acceptance remain NOT VERIFIED.
