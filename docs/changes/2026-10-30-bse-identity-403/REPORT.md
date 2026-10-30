# BSE Identity master HTTP 403 recovery

The reported error is from the official Active List of Scrips CSV download,
before Preview or Apply. The Identity master downloader used direct reqwest
only; the app's existing bounded native browser collector was not connected to
this path. No production database changes are needed to repair transport.

## Changes

- New `bse_identity_imports/master_transport.rs` keeps direct HTTP first and
  recovers only HTTP 403 through the existing controlled native browser download
  collector. Other HTTP failures, including 429, are not silently retried through
  another transport. Network failures and invalid HTTP 200 payloads stay errors.
- Browser scope accepts only the exact official Equity List of Scrips endpoint
  for Active, Delisted or Suspended. It rejects changed origins, insecure URLs,
  extra/duplicate query parameters and cross-status requests. It uses the
  canonical official List_Scrips page with the collector's isolated profile,
  bounded response size, timeout, serialization and verified cleanup.
- All three responses must validate as CSV before publishing a new combined
  source. Active population must still be at least 1,000. HTML/refusal responses,
  malformed CSV and payloads over 8 MiB are rejected. Unsupported configured URLs
  are not replaced by an automatic default URL.
- Successful bundles use a unique source filename, create-new partial staging,
  sync and rename. Previous saved sources are not overwritten. A failed bundle
  fetch publishes no partial source. Later write failures may retain their owned
  `.partial` file as diagnostic material rather than making it a usable CSV.
- Runtime logs identify browser recovery, and the download result reports how
  many lifecycle sources required it. Preview, reviewed Apply, run receipts,
  financial approvals, market-data files and NSE downloads are unchanged.

Two parser defects were found while testing the complete bundle. The downloader
uses `CURRENT` as its canonical Active tag, but the parser did not recognise that
tag; it now does. BSE's empty trailing unnamed CSV fields could also shift the
appended lifecycle value away from its header. Only empty overflow is trimmed;
missing fields and non-empty overflow are rejected. Regression checks retain the
Active/Delisted/Suspended distinction instead of weakening the population gate.

## Scope and backup

Runtime changes: `database/bse_identity_imports.rs`, the new master transport
module and its tests. The existing `bhavcopy/bse_price_history.rs` collector has
only three Rust visibility changes so this internal source adapter can reuse it;
its browser lifecycle, permissions and accepted download implementations were
not rewritten. No new IPC or arbitrary browser fetch endpoint is exposed.

Scoped backup:
`backups/pre_opencode_changes_20261030_003242_bse_identity_403_transport`.
Existing dirty worktree changes are preserved. No commit or push was performed.

## Validation

- PASS: 5 focused deterministic transport/parser tests; 1 explicit native proof
  test is ignored in ordinary runs. Tests cover exact endpoint/status scope,
  403-only routing, refusal/invalid/oversized responses, lifecycle alignment,
  minimum population, complete bundle persistence and failed-bundle preservation.
- The initial test compile used the wrong local constructor name (`default`
  instead of `defaults`); corrected. A complete-bundle test then exposed the
  existing CURRENT normalisation defect; corrected and checks passed.
- PASS: isolated live native proof, 20.99 seconds on 30 October 2026 at about
  00:48 IST. All three direct requests required browser recovery. The validated
  merged master contains 5,123 active, 4,604 delisted and 1,222 suspended symbols.
  Source CSV bytes and SHA-256 hashes are retained, along with the combined CSV.
  [Native proof](native-proof-1793301499842650400/proof.json) explicitly records
  `databaseOpened: false` and `databaseApplied: false`.
- PASS: BSE identity module, 24 tests and 1 explicitly ignored native proof (the
  proof above was run separately). Existing Bhavcopy browser-fallback adjacency:
  6 passed and its separate live Bhavcopy proof ignored. No NSE runtime changes.
- BUILD-01 initially held the native dispatch while another Cargo build was
  active. It resumed after the target was free; no build was interrupted or
  shared-target policy bypassed.
- NOT TESTED: this change in the user's rebuilt portable UI. No live market
  database Apply, financial approval, raw-price write, release/portable build,
  commit, push or background server was performed by the agent.

The proof reports 10,967 per-source symbol rows before cross-lifecycle merging.
The final counts above use the existing current-first lifecycle precedence and
symbol deduplication, giving 10,949 merged symbols. No raw source is discarded
from the retained evidence. The download proof does not approve a BSE Apply plan
or establish event-date identity. Exact per-source row counts/hashes are in the
[source summary](native-proof-1793301499842650400/source-summary.json).

## Desktop check

After the user's normal portable rebuild, select BSE and choose Refresh & Preview.
If direct access returns 403, browser recovery should happen inside the app.
Only a fully validated three-status bundle is made available to Preview. Do not
Apply merely to test this download; review any new plan separately.

If the browser is also refused, the app must show the combined error and retain
the previous source. It must not claim refresh success or substitute stale data
as newly fetched data. Source diagnostics' existing direct HTTP health probes are
unchanged; transport recovery is part of Refresh, not a false healthy HTTP result.
