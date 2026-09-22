# Historical Corporate Actions Backfill Phase Plan

Date: 2026-06-26

## Current Status

- Phase 5 multi-symbol batch backfill is complete and verified for the first controlled workflow.
- `scripts/validate-change.ps1 -Profile corporate-actions` passed on 2026-06-25, including the targeted corporate-action tests, renderer typecheck, Tauri compile check, Rust format check, and whitespace check.
- Portable visual QA passed for the previously missing multi-source / long-locator evidence case using an isolated synthetic QA row.
- Portable UI QA passed for Phase 5 on 2026-06-26 using the rebuilt portable app: a three-symbol batch persisted one run-history row, and `Load Runs` refreshed the displayed run list with inline timestamp/count feedback.
- The next remaining delivery phase is Phase 6, priority-universe expansion.
- The phase descriptions below are retained as the historical implementation plan.

## Purpose

This document defines the phased plan for backfilling older split and bonus history that is missing from the current `Official Imports` pipeline.

It exists because the current live official fetch path is useful for recent corporate actions, but it is not complete enough for deep historical capital-action coverage across NSE/BSE symbols.

## Problem Statement

The current active official-import workflow uses:

- NSE warm-up plus `https://www.nseindia.com/api/corporates-corporateActions`
- BSE warm-up plus `https://api.bseindia.com/BseIndiaAPI/api/DefaultData/w`

That path is correct for the current app, but it is not a full historical capital-actions archive.

Observed result in the active local DB:

- `KOTAKBANK` currently shows only:
  - `2010-09-13` split
  - `2015-07-08` bonus
  - `2026-01-14` split
- older public-history bonus rows for Kotak are missing from `corporate_action_imports`
- the same sparsity pattern appears more broadly in the current NSE import set

This is not only an ISIN-matching issue.

Historical ISIN support is now better than before, but it cannot recover rows that the source never returned.

## Non-Negotiable Constraints

- Keep raw local `.eod` price history immutable.
- Keep `corporate_actions` as the canonical approved/manual table.
- Keep `corporate_action_imports` as the review-first staging table.
- Do not auto-approve backfilled rows.
- Do not overwrite current `instruments.isin` blindly from historical evidence.
- Preserve the active Tauri-only runtime path under `src-tauri-shell`.
- Preserve the current split/bonus approval flow and current dividend/rights review-first flow unless a later product decision expands them.

## Current Baseline

The repository already has:

- official fetch into `corporate_action_imports`
- manual promotion into `corporate_actions`
- `instrument_identity_history`
- `instrument_isin_history`
- `PENDING_ISIN_MISMATCH` review handling
- unresolved recheck using identity history and ISIN evidence

That means the missing capability is not the review model. The missing capability is a durable deep-history source path for older split and bonus records.

## In Scope

- historical split backfill
- historical bonus backfill
- historical identity / ISIN evidence required to review those rows safely
- symbol-scoped and later batch-scoped historical backfill runs

## Out Of Scope For The First Delivery

- dividend historical backfill
- rights historical backfill
- automatic approval
- raw price mutation
- large UI redesign
- replacing the existing official recent-history fetch path

## Source Strategy

The backfill must use a source-priority model instead of treating every source as equally authoritative.

### Priority tiers

1. Current structured exchange APIs
   - `NSE_API`
   - `BSE_API`
   - use for recent/review workflow as today

2. Historical exchange evidence
   - BSE historical corporate-action pages or exportable exchange data if machine-usable
   - NSE archive circulars when they directly prove split/bonus and related identity facts

3. Issuer investor-relations evidence
   - only for manual exception handling
   - should not become the primary automated source

4. Secondary public-history sites
   - useful for audit and proof cases
   - should not become canonical automated import sources

### Important source rule

The implementation must preserve source provenance.

If different official pages disagree on ISIN or event wording, the system must store that evidence explicitly instead of flattening it into one silent overwrite.

## Phase Overview

### Phase 0 - Freeze Current Contract

Goal:

- document and preserve the current official-import contract before adding deep-history behavior

Deliverables:

- repo-truth docs updated
- this phase plan checked in
- no code changes required beyond docs

Exit criteria:

- future sessions can start from a stable written plan instead of rediscovering the scope

### Phase 1 - Source Spike On Known Symbols

Goal:

- prove which historical sources are usable enough for automation

Pilot symbols:

- `KOTAKBANK`
- `INFY`
- `WIPRO`
- `BAJFINANCE`
- `HDFCBANK` as a control case

Tasks:

- compare current imported split/bonus rows against:
  - live NSE API results
  - machine-usable BSE historical corp-actions data if available
  - NSE archive circular evidence where relevant
- note where older split/bonus rows exist publicly but are absent from the active import table
- note where historical ISIN values differ from current DB identity values

Deliverables:

- a source-spike audit note
- a symbol-by-symbol source usability verdict

Exit criteria:

- one or more historical source paths are proven usable enough for automation
- weak or browser-only sources are explicitly rejected before coding

### Phase 2 - Historical Evidence Data Model

Goal:

- store backfill evidence without polluting canonical approved actions

Recommended additions:

- a new evidence table for historical import proof, for example:
  - `corporate_action_import_evidence`

Suggested fields:

- `id`
- `import_id`
- `source_code`
- `source_locator`  -- URL, local file path, archive document path, or similar locator
- `captured_at`
- `symbol_seen`
- `isin_seen`
- `company_name_seen`
- `action_type_seen`
- `event_date_seen`
- `factor_seen`
- `raw_reference`
- `note`

Reason:

- the system already has real identity drift across time
- source provenance must survive later review and debugging

Exit criteria:

- imported historical rows can carry attached proof instead of a single flattened source string

### Phase 3 - Backend Pilot Command For One Symbol

Goal:

- implement the narrowest safe automation slice first

Recommended first command:

- `backfill_historical_capital_actions_for_symbol(exchange, symbol, from_date, to_date, bse_scrip_code?)`

Behavior:

- collect symbol aliases from `instrument_identity_history`
- fetch older split/bonus evidence for the current symbol plus aliases
- normalize candidate rows
- insert review rows into `corporate_action_imports`
- attach evidence rows
- never auto-approve

Current implementation status:

- **implemented, narrow pilot**
- current target exchange support: `NSE` only
- current official source adapters:
  - symbol-scoped NSE structured API using `symbol=`
  - optional BSE deep-history structured API using explicit `bse_scrip_code`
- current duplicate policy:
  - exact same-source duplicates are skipped
  - equivalent existing import rows from another source keep their current row
    and receive new evidence instead of a second review row
- current usability upgrade:
  - `Official Imports` now exposes a compact `Historical NSE` pilot row so the
    backend pilot can be run from the app without a manual bridge call
  - when the optional BSE scrip code is left blank, the pilot now tries a
    conservative same-ISIN lookup against the current `BSE` instrument table
    before falling back to NSE-only coverage
- current limitation:
  - deeper history still depends on what the official source actually returns,
    so the command reports coverage warnings instead of pretending all older
    rows are recoverable already

Important behavior:

- exact duplicate rows must not be recreated
- existing approved rows must not be overwritten
- historical ISIN differences must stay reviewable, not silently “fixed”

Exit criteria:

- one symbol can be backfilled safely into the existing review queue

### Phase 4 - Resolver And Review Integration

Goal:

- make historical backfill rows understandable and reviewable inside the current UI

Tasks:

- extend resolver messages for historical-source rows where needed
- expose source/evidence metadata in the review flow if current columns are insufficient
- preserve existing `Approved`, `Review Queue`, and `Review Issues` separation

Current implementation status:

- **implemented, narrow review-evidence slice**
- import list rows now include evidence count, distinct evidence source codes, and latest capture/locator/note context
- `Official Imports`, `Review Issues`, and the existing resolve panel expose that provenance without adding a new approval workflow
- resolver guidance now states which attached evidence sources support the selected import row
- validation checkpoint: corporate-actions validation passed on 2026-06-25, and portable-runtime visual QA verified the missing long-locator / multi-source evidence rendering case

Important constraint:

- do not widen this into a new approval workflow

Exit criteria:

- a reviewer can see what was backfilled, why it matched, and which source proved it

### Phase 5 - Multi-Symbol Batch Backfill

Goal:

- scale from one-symbol proof to a controlled backlog run

Recommended additions:

- batch command, for example:
  - `backfill_historical_capital_actions_batch(...)` (**first backend/bridge slice implemented and validated on 2026-06-25**)
- run tracking table for historical backfill jobs (**implemented and validated on 2026-06-25**)
- per-symbol coverage tracking for backfill progress (**implemented and validated on 2026-06-25**)
- read/list command for persisted run history (**implemented and validated on 2026-06-25**)
- minimal Official Imports UI for controlled symbol-list batches and compact run-history display (**implemented and validated on 2026-06-25**)

Current implementation status:

- **complete for the first controlled batch workflow**
- first slice adds a typed batch command that reuses the Phase 3 single-symbol command path
- one batch uses one common NSE/date window and up to 25 normalized symbols with optional per-symbol BSE scrip codes
- per-symbol failures are captured in the batch result and persisted unless `stopOnError` is requested
- persistent run and symbol rows are now written for every batch run
- `list_historical_capital_action_backfill_runs` returns recent run summaries with hydrated symbol rows for future UI display
- `Official Imports` now exposes a minimal batch-symbol textarea, stop-on-error toggle, run action, latest batch result, and compact run-history panel
- portable UI QA passed on 2026-06-26 after the `Load Runs` action was verified to refresh run history with visible inline status
- `scripts/validate-change.ps1 -Profile corporate-actions` passed on 2026-06-25 with 36 corporate-action tests

Reason:

- current fetch coverage is date-range based
- historical split/bonus backfill is symbol-scoped and source-scoped

Exit criteria:

- the system can backfill a controlled symbol set without reprocessing the same evidence endlessly

### Phase 6 - Priority Universe Expansion

Goal:

- backfill the symbols that matter most first

Current implementation status:

- **implemented, curated batch-source slice**
- `Official Imports` now has `Current Chart` and `Watchlist` buttons that populate the Phase 5 batch textarea from NSE symbols already loaded in the app
- `Official Imports` now also has a `Sparse History` button backed by read-only `list_historical_capital_action_sparse_candidates`
- sparse candidates rank active NSE symbols with unresolved split/bonus review rows first, then long-history symbols with fewer than two known split/bonus actions/imports
- `Official Imports` now also has an `Old Aliases` button backed by read-only `list_historical_capital_action_alias_candidates`
- old-alias candidates rank active NSE symbols with identity-history old symbols by earliest alias date and alias count
- portable UI QA passed on 2026-06-27 for `Old Aliases`: it populated 25 NSE symbols, a user-run batch completed 25/25 with 0 failed and 0 errors, and run history showed persisted run #4
- `Official Imports` now also has a `Major Liquid` button backed by read-only `list_historical_capital_action_major_liquid_candidates`
- major-liquid candidates rank active NSE symbols by average recent local traded value from `eod_prices` and require at least 20 recent bars
- source buttons do not run the batch automatically; users still review the list and press `Run Batch`
- review-first behavior is unchanged: no auto-approval, no canonical action mutation, and no raw `.eod` price mutation
- `scripts/validate-change.ps1 -Profile corporate-actions` passed on 2026-06-27 with 37 corporate-action tests
- portable UI QA passed on 2026-06-27: `Sparse History` populated 25 NSE symbols, a user-run batch completed 25/25 with 0 failed and 0 errors, and run history showed the persisted run #3
- `scripts/validate-change.ps1 -Profile corporate-actions` passed again on 2026-06-27 with 38 corporate-action tests after adding `Old Aliases`
- `scripts/validate-change.ps1 -Profile corporate-actions` passed on retry on 2026-06-27 with 39 corporate-action tests after adding `Major Liquid`

Recommended ordering:

1. symbols already showing unresolved or sparse capital-action history
2. symbols with known old aliases
3. major long-history liquid symbols
4. wider NSE universe
5. BSE-first-only exceptions later

Exit criteria:

- the most user-visible historical gaps are removed before full-universe cleanup begins

### Phase 7 - Audit, Metrics, And Hardening

Goal:

- verify that the backfill improved historical coverage without degrading review quality

Metrics to track:

- new split rows found
- new bonus rows found
- rows inserted into review queue
- rows auto-resolved vs still unresolved
- rows approved after review
- symbols whose first known split/bonus date moved earlier

Hardening checks:

- duplicate prevention
- source-provenance preservation
- exact-symbol ISIN mismatch remains reviewable
- no raw price mutation

Exit criteria:

- the backfill path is repeatable and its effect is measurable

## Recommended First Implementation Slice

Implement only this first:

1. source spike completion for the pilot symbols
2. historical evidence table
3. single-symbol backend backfill command
4. pilot run for:
   - `KOTAKBANK`
   - `INFY`
   - `WIPRO`

This is the lowest-risk path.

## What Should Not Happen First

Do not start with:

- full-universe backfill
- UI-first batch tooling
- silent ISIN overwrite of current instruments
- secondary public-history sites as canonical automation input
- dividend/rights expansion in the same first pass

## Validation Expectations

For backend implementation phases:

- `cargo fmt --manifest-path src-tauri-shell/Cargo.toml`
- `cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check`
- `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture`
- `npm run typecheck:renderer`
- `npm run tauri:check`
- `git diff --check`

For docs-only phases:

- `git diff --check`

## Practical Success Definition

This initiative is successful when:

- old split/bonus rows missing from the current recent-history API can still be surfaced for review
- the app stores the proof for why those rows were imported
- identity drift across time is handled explicitly
- approval remains manual
- raw price data remains untouched

## Original Immediate Next Step (Historical)

The original sequencing instruction was to proceed with **Phase 1 only**:

- prove the historical source stack on a small symbol set
- reject weak sources before adding schema or commands
