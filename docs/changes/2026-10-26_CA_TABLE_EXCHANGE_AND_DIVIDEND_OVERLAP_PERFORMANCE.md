# Table exchange filter and overlapping Dividend dependency work

## Subsequent native evidence and pause — 26 October 2026

See [the later CA checkpoint](2026-10-26_CA_PAUSE_DATABASE_PRIORITY_HANDOFF.md) for the user-run
16m28s validation, 4,288 persisted approvals, native exchange-filter observations,
and remaining progress/history defects. CA is now paused for the database issue.
The implementation/test receipts below remain historical; specific Stage 2A
blocker acceptance and unchanged native warm performance remain unverified.


Date: 26 October 2026 IST. Root: `E:\TA Projects\EOD Charting Platform`.

## Native evidence supplied by the user

The latest rebuilt app completed Load & Validate in 18m24s (91/91 batches):
33,971 loaded imports, 33,944 shown events, 4,288 Ready actions, 9,023 Dividend
policy evaluations, 4,274 eligible, 4,749 ineligible, zero reused, no approvals.
An earlier screenshot showed 3m36s at 1/91. These are full workflow observations,
not isolated backend batch timings. They do not identify how much time was spent
in initial preparation versus policy evaluation or renderer work.

The user confirmed this was the first completed run after rebuilding. Zero reuse
is consistent with the required new policy fingerprint seed; native no-change
reuse and warm performance remain unmeasured. The screenshots do not independently
accept the Stage 2A non-ordinary-security blockers, since those cases are not shown.

## Table filter

- Added **Table exchange: All exchanges / NSE / BSE** beside the existing table
  filters. Default All preserves the previous display. It filters the loaded
  queue locally, composes with search/status/type/view and does not Fetch or scan.
- The existing source-exchange control remains separate. Changing the table
  filter does not change source collection scope or discard loaded records.
- Shown/Ready/Selected counts and both approval menu scopes use the filtered
  events. Changing exchange clears selection and the pending confirmation through
  the existing filter-change handler; hidden exchange IDs cannot remain approved
  by an old selection. The scroll position resets, and Clear all filters resets
  the table exchange too. Local filtering remains available during validation.

## Bounded backend improvement

The former scale fixture used 100 events sharing one dependency group. A new
fixture exercises 100 distinct symbols, a common event date and private historical
rows, revealing repeated work in overlapping dependency groups and peer checks.

- `BatchInputs` now reads and hashes each SQLite dependency record once per batch,
  then combines complete typed row digests for the exact existing group membership.
  Column names, all field contents and absent rows remain dependencies. Query
  failures do not publish partial cached proof. The cache dies with the batch's
  IMMEDIATE transaction; no SQLite proof is trusted across calls.
- Dividend prepared-scope policy reuses same-date peer lists and effective event
  identities only when already inside a transaction, for that invocation alone.
  Self-exclusion, peer ordering and policy decisions remain unchanged. Standalone
  and financial-writer policy calls use fresh reads. The eligibility body was
  compared with the pre-edit backup: only the peer-reader call differs; the reviewed
  wrapper/body remain pinned by the existing renderer bridge checksum test.
- Database lineage, identity/source content, actual price contents, external file
  rechecks, date buckets, explicit approval and transactional writers remain intact.
  No schema/index migration, persistent cross-call memo or policy relaxation.

These changes alter dependency fingerprints and require a new seed validation.
This is a measured improvement to selected work, not a claim that all native
latency is explained or resolved.

## Controlled measurements and validation

Command: `cargo test --manifest-path src-tauri-shell/Cargo.toml dividend_incremental_overlapping_groups_benchmark -- --ignored --nocapture`.
Fixture: disposable SQLite, 33,971 imports, 33,871 canonical rows, 100 distinct
symbols, 100 eligible events, retained evidence and local SQL bars. Warm measurement
closes and reopens the connection. Identical fixture/command before and after.

| Implementation | Cold batch | Reopened warm batch | Warm reused | Warm full policy |
| --- | ---: | ---: | ---: | ---: |
| Before | 16.228s | 5.484s | 100 | 0 |
| After | 11.755s | 4.864s | 100 | 0 |

Cold elapsed time decreased about 28%; warm about 11%. Both runs returned identical
cold/warm dispositions and all 100 eligible. These are local debug fixture samples,
not an extrapolation to the user's 91-batch native workflow.

PASS, serial focused Rust checks:
- `dividend_incremental_`: 17 tests; the two explicit benchmarks ignored in this
  regression run (the new benchmark was run separately above).
- `dividend_policy_r1_`: 22 tests.
- `dividend_prepared_scope_r1_`: 11 tests.

PASS: 32 renderer tests across ClassicModel, QuickSearch and DividendPreparedScopeTauriBridge;
focused TypeScript program for the changed UI/model/tests (zero diagnostics);
scoped whitespace, cache-module formatting, and the final reviewed policy pin.
New tests cover exchange/approval filtering without queue loss, overlapping-row
read counts, witness changes/arrival, and peer-cache equivalence/self-exclusion.

Existing source files were patched after normal pre-edit backups:
- `backups/pre_opencode_changes_20261026_141511_ca_table_exchange_overlap_perf`
- `backups/pre_opencode_changes_20261026_142040_ca_peer_policy_before_edit`
- `backups/pre_opencode_changes_20261026_142705_ca_policy_test_before_edit`

Changed implementation: ClassicWorkspace/ClassicModel; Dividend validation cache
and auto-approval policy read helpers. Focused model/search/bridge tests and the
incremental test file accompany them. Handoff/inventory record the change.

NOT RUN: live database scan/mutation, Fetch, approvals, desktop build/package,
native UI acceptance, full validation profiles, commit or push. The user rebuilds.
After rebuilding, observe one completed seed run followed by an immediate unchanged
run; record elapsed time and reused/full-policy counts separately. Do not replay
previous approvals. Native table-filter/approval-scope acceptance remains pending.
