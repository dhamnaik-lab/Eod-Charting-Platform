# Historical Apply reporting, categories and saved display settings

Implemented 29 October 2026. User portable rebuild and native acceptance remain
pending. No live Apply, reversal, financial approval, release build, commit or push
was performed by this task. The existing wheel fix is accepted by the user's
explicit confirmation in this phase.

## What happened to the user's accidental Apply

Read-only persisted evidence confirms 44 new NSE historical identity rows at
`2026-10-29 15:57:57` UTC (21:27:57 IST): 14 SYMBOL_CHANGE, 17 NAME_CHANGE and
13 BOTH. AMIRCHAND is inactive/OLD_SYMBOL; AEROPLANE is active/CURRENT. The
AMIRCHAND -> AEROPLANE transition is persisted with effective date 2026-07-20.

The old application did not save historical run receipts, so the screenshot's
disabled button and stale preview wording were insufficient to establish status.
The database now proves the identity rows exist; it cannot reconstruct the old
confirmation, exact reviewed hash or complete run receipt. They are exposed as
legacy persisted history, never fabricated completed-run receipts.

The live `corporate_actions` and `corporate_action_event_identity_resolutions`
tables match the retained pre-apply snapshot. Both original AMIRCHAND/AEROPLANE
raw-price files match their pre-apply hashes. Three later additions to
`corporate_action_import_decisions` are BSE_SECURITY_CODE_RESOLUTION metadata
decisions at 16:12:03 UTC, after the NSE history rows; no earlier decision rows
were removed. Do not describe the entire import-decision table as unchanged.

See [read-only audit](completed-apply-audit.json) and
[reproduction script](audit_completed_apply.py). Connections used URI mode=ro,
query_only and explicit read transactions; total_changes=0.

## Apply safety and status

The old Historical handler had no confirmation dialog, despite its UI wording.
The handler now requires a full-plan confirmation with database destination,
symbol/name/combined counts and current-universe effects. Cancelling saves
nothing and leaves the preview available. Confirmation precedes authority
consumption and the write call; double clicks are blocked while busy.

Already-applied or zero-change plans are blocked in the renderer. The backend
also rejects zero-change Apply and retains source/database/SHA rechecks. Historical
review hashing is now `NSE_HISTORICAL_IDENTITY_PLAN_V3_REVIEWED_CURRENT_EFFECTS`.
A fresh preview is required after rebuilding.

A regression exposed that the previous I4 execution upserted the master before
calculating current-universe effects, hiding real metadata changes. I4 now builds
the reviewed current-universe plan before its single canonical write. This keeps
master-only imports working and makes the zero-change guard accurate. The older
transaction-aware upsert helpers are retained but no longer used by I4.

Operation-ID-scoped progress travels from Rust through `src/platform/*` to the
renderer. Checking is indeterminate; source processing is counted up to 95%;
committing is 99%; 100% is emitted only after a successful commit. The existing
blue/running, green/completed and red/error styles are reused. Post-commit cache,
snapshot or chart-refresh failures are warnings about a saved database, not a
false failed Apply. Result/progress updates are discarded when their database
context is no longer current.

After saving, the table labels newly inserted rows APPLIED, the footer says
Completed, and another Apply requires a new reviewed preview. An empty actionable
plan says Up to date. The Errors view says No errors in this preview when its
underlying error count is zero.

## Recent Applied

A new Identity Import tab reads completed historical run summaries, then loads
one complete report on selection. Lists are bounded to the most recent 50 runs;
full report rows are not sent for every run at once. Selected reports show counts,
applied rows, duplicates/skips, current-universe effects, source paths, source
hashes, reviewed plan hash, run ID and completion time. No Apply footer is exposed
in Recent Applied, and a saved report never grants current approval authority.

Future receipts are stored in `historical_identity_apply_runs`, with exact new
history-row IDs linked by `historical_identity_apply_run_rows`. Receipt creation,
links and identity/master changes share the same commit/rollback boundary. Read
commands use read-only connections and do not create tables in older databases.

The tab separately shows the most recent 250 legacy persisted rows, with a symbol,
name/date search. It explicitly states that these rows lack full run receipts.
This includes the user's already-completed 44 rows. No synthetic receipt or
live migration was written for that earlier run.

## Category filter and display persistence

Category options are All, Equity (including SME), ETF, Mutual funds, Debt/Bonds,
REIT/InvIT and Unknown. Classification is display metadata attached after the
decision inputs are prepared; it does not change identity matching, financial
approval, source filtering or the reviewed plan hash.

Evidence comes from exact membership in the saved NSE equity/SME master and
explicit category wording in saved official name rows for the exact symbol.
Conflicting or unsupported rows stay Unknown. No ticker-pattern or series-only
guess is used, and no extra category source downloads were added. Categories
describe current/source evidence, not proven event-date identity. The
[official NSE inventory](https://www.nseindia.com/static/market-data/securities-available-for-trading)
also lists separate ETF, listed mutual-fund, debt, REIT and InvIT sources; complete
historical category coverage remains future work rather than an implied result.

Measured on the retained 2761-row preview: 665 equity, 156 ETF, 383 mutual-fund and
1557 Unknown rows. Unknown records remain visible under All/Unknown. Debt and
REIT/InvIT options can legitimately have no supported rows in this snapshot.

Display settings persist locally under versioned keys scoped to database path,
exchange and source mode. Historical and report searches have separate settings.
Saved fields include the selected tab, search text/scope, change type, category,
outcome filter, current-universe search, expanded source/effects/legacy/evidence
sections, selected report and legacy query. Preferences survive fresh previews;
they no longer force Actionable after every preview. Reset search clears search,
scope, type and category while keeping the selected outcome view.

Only whitelisted display fields are restored. Plans, hashes, reviewed authority,
busy/progress/error state and applied results are never restored from preferences.
Blocked storage keeps filters usable for the session and displays a save warning.
This does not persist all settings elsewhere in the application or migrate
preferences when the database path or WebView profile changes.

## Scope, protection and validation

Pre-edit backups:

- `backups/pre_opencode_changes_20261029_213643_historical_reports_preferences`
- `backups/pre_opencode_changes_20261029_214901_historical_reporting_test_contracts`

Runtime changes are confined to the Historical/Identity renderer components and
styles, `DatabaseToolsDialogs.tsx`, desktop/platform types and bridge, the NSE
identity module, new historical reporting/category modules, database result
types and command registration. The general identity writer and chart loader
were not edited. Existing dirty work outside this scope was preserved.

| Check | Result |
| --- | --- |
| Focused Rust reporting tests first | PASS: 3 tests; initial harness compile/link 1m31s |
| Complete NSE identity module, serial | PASS: 121 tests, 2 guarded fixtures ignored; 2.16s execution |
| Explicit guarded retained-copy Apply/report/chart/repeat | PASS: 76.85s execution; receipt links all 44 new history IDs |
| UI/bridge/storage/category/review contracts | PASS: 90 tests across 17 files |
| Renderer typecheck and scoped whitespace | PASS on final renderer/bridge sources |
| Docs reference and whitespace profile | PASS: references and scoped whitespace |
| Rebuilt native confirmation, progress and restart persistence | NOT TESTED; user rebuild required |

Cargo calls used the shared wrapper with Preview before Run, offline/locked
dependencies, one shared target and serial validation. No full workspace test
suite or release build was run. The native copy proof uses
`tmp/nse-historical-repair-fde3f3e95dc4`; retained DB/source/raw fixtures and earlier
proofs were not deleted. See [native summary](native-proof-summary.json) and
[replay log](native-copy-replay.log).

The replay saves 14 symbol + 17 name + 13 combined changes and now accurately
reports one current-universe metadata update. An unchanged repeat has zero new
history/current effects and zero errors. AMIRCHAND resolves AEROPLANE through the
persisted dated transition, with 140 bars ending at close 206.15. Financial table
digests/raw hashes remain unchanged on the isolated copy, inactive out-of-master
records are not revived, and the invalid same-day chain remains rejected.

Failure injection verifies receipt-write and deferred COMMIT failures roll back
identity/master state and never emit completed/100%. Zero-action Apply creates
no receipt. Source/database staleness and malformed-SHA tests remain accepted.

Development failures were resolved before acceptance: the new guard initially
exposed the hidden master-effect counts, renderer setter typing needed to retain
React's functional-update signature, and two source-contract expectations needed
the new progress operation ID and persisted-default model. A helper edit also
introduced Windows-encoding punctuation in two TSX files; those bytes were
repaired to UTF-8 before final checks. Existing holiday-sync warnings and the two
now-unused compatibility upsert helpers were not suppressed.

## Exact user checks

1. Rebuild and start portable. Do not repeat Apply merely to test progress.
2. Open Recent Applied -> Legacy persisted history, search AMIRCHAND. Confirm
   the persisted AMIRCHAND -> AEROPLANE transition dated 2026-07-20. The earlier
   run correctly has no full receipt.
3. Preview Historical Identity again. The completed 44 changes should not be new
   again; check zero new historical changes and inspect any genuinely changed
   current-master effects. Apply should be disabled if the full plan has zero
   actionable changes.
4. Try the category and outcome filters, set a search, expand a section, close and
   reopen the application. Verify the same display choices return in that
   database/exchange/source context. Unknown must remain available.
5. On a future legitimate actionable preview, verify the full-plan confirmation.
   Cancel must write nothing and retain the preview. After deliberate confirmation,
   verify blue counted progress, 99% while committing, green 100% after save and
   the completed result. A refresh warning must not become a failed-save claim.
6. Open the new run in Recent Applied, inspect its hashes/counts/applied rows,
   restart and confirm the durable report remains readable. Saved reports must
   never enable Apply without a new preview.
