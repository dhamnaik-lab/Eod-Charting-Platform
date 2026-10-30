# NSE historical identity reconciliation repair - 29 October 2026

Implemented and verified on retained copies. Live historical identity Apply and
rebuilt desktop acceptance remain pending. No commit, push, release build or
portable staging was performed.

## Problem and bounded change

The saved official NSE CSV already contains AMIRCHAND -> AEROPLANE effective
2026-07-20, but the live database has no persisted transition. Historical Preview
was blocked by ten errors elsewhere in the archive: unchanged source entries,
already represented components and a stored same-day rename chain. This prevented
reviewing and committing the valid dated changes together.

The I4 importer now reconciles exact components before calling the general
identity writer:

- Identical old/new source symbols or names become explicit skipped rows.
- An existing dated BOTH event covers its symbol and name components. Separate
  persisted component rows can cover a combined source entry.
- If only one component is missing, only that component is written.
- Name-event duplicate coverage requires a matching symbol scope or a unique,
  strictly increasing persisted dated path. Name/ISIN equality alone is insufficient.
- Historical metadata preserves target activity. New historical targets default
  inactive until the current master authorizes activation. Accepted old rename
  rows receive OLD_SYMBOL inside the same savepoint.
- The reviewed plan version is now
  `NSE_HISTORICAL_IDENTITY_PLAN_V2_COMPONENT_RECONCILIATION`, requiring a fresh
  preview after rebuilding. Existing source hashes, database-context checks,
  rollback and explicit reviewed Apply remain in force.

No company-specific runtime mapping was added. The general chart resolver and
general identity writer were not edited. Financial approval, raw prices, source
URLs and schema are unchanged.

## Retained evidence

Pre-edit backup:
`backups/pre_opencode_changes_20261029_185203_nse_historical_reconciliation`.

Guarded retained fixture:
`tmp/nse-historical-repair-fde3f3e95dc4`.
It contains the SQLite snapshot, saved official sources, source-hash receipt,
two byte-identical raw-price copies and native replay results. Each Apply replay
creates a second, uniquely named SQLite copy. Do not automatically delete these
fixtures or older failed-run evidence.

The baseline snapshot SHA-256 stayed unchanged after native preview rollback:
`d9e943c3c737cb41e9a789948fc00d96edde4117a96695d9255939c8389201bc`.

| Native historical preview | Baseline | Repaired copy |
| --- | ---: | ---: |
| Can apply | false | true |
| New symbol changes | 16 | 14 |
| New name changes | 19 | 17 |
| New combined changes | 16 | 13 |
| Duplicate source entries | 1325 | 1337 |
| Skipped source entries | 1375 | 1380 |
| Error entries | 10 | 0 |

All 2761 source entries remain accounted for. The repaired copy commits 44 new
history records. An unchanged repeat proposes zero new symbol/name/combined
changes and zero errors. Current-universe results after Apply and on repeat have
53 held and 990 outside-coverage rows. The nine direct successor candidates from
the investigation become inactive OLD_SYMBOL records; covered active absences
fall from 62 to 53. None of the previously inactive symbols absent from the
current master is reactivated.

The native chart loader, querying the applied copy with the old AMIRCHAND request,
resolves AEROPLANE through the persisted 2026-07-20 transition and returns 140 bars,
ending 2026-10-26 at close 206.15. Raw file hashes and logical digests of
`corporate_actions`, `corporate_action_import_decisions` and
`corporate_action_event_identity_resolutions` are unchanged.

The previously stored same-day SGBNOV23 chain is still rejected by the strict
chart chronology guard. Recognizing its exact source event as already persisted
does not repair the chain or make it valid routing evidence.

Final live read-only check used SQLite URI mode=ro, query_only and an explicit
read transaction: total_changes=0. AMIRCHAND remains active/CURRENT with zero
matching history edges, confirming no live repair was applied. Original raw
files still match the copied hashes.

See [final evidence](final-evidence.json), [baseline errors](baseline-summary.json),
[summary reproduction](summarize_proof.py), [snapshot creation](create_fixture.py)
and [raw-copy preparation](add_raw_fixture.py). The final native proof is
`tmp/nse-historical-repair-fde3f3e95dc4/apply-proof-1793282666668011500.json`.

## Validation

All Cargo calls used `scripts/Invoke-EOD-SharedCargo.ps1`, Preview before Run,
the shared project target, offline/locked dependencies and serial commands.

| Check | Result |
| --- | --- |
| `test database::nse_identity_imports:: -- --nocapture --test-threads=1` | PASS: 115 passed, 2 intentionally ignored; 1.96s test execution |
| Same module with default test concurrency | PASS: 115 passed, 2 ignored; 0.50s |
| `test guarded_historical_fixture_replay -- --ignored --nocapture --test-threads=1`, pinned fixture + apply stage | PASS: native preview/Apply/chart/repeat; 70.84s |
| `test database::eod_data::tests -- --nocapture` | PASS: 16 passed, 1 existing ignored |
| Vitest historical/current reviewed-Apply authority contracts | PASS: 12 tests across 2 files |
| `python docs/changes/2026-10-29-historical-identity-repair/summarize_proof.py` | PASS: copy/live protection assertions |
| `validate-change.ps1 -Profile docs` with scoped paths | PASS: references and whitespace |
| Rebuilt portable workflow and screenshot acceptance | NOT TESTED; user rebuild required |

During development, the helper initially used an unsupported rusqlite method;
that test query was corrected. The new inactive-record fixture initially lacked
the financial-read table schema and was completed before acceptance. One resolver
comparison assertion failed in an earlier concurrent run; it subsequently passed
in both final serial and concurrent runs, with no resolver semantics changed.
Retained logs include those failures. Existing holiday-sync compiler warnings
were left untouched. Focused harness compilation/linking ranged from about
25 to 64 seconds during implementation; it was not a release build.

## User acceptance steps

1. Rebuild and start the portable Windows app from this source.
2. Open Identity Import -> NSE -> Official -> Historical identity and choose
   Preview Historical Identity. With this exact saved source/database snapshot,
   expect zero errors and 14 symbol + 17 name + 13 combined new changes.
   Changed sources or database state can legitimately change these counts.
3. Inspect the dated AMIRCHAND -> AEROPLANE entry and the full proposed plan.
   Explicitly Apply Reviewed Historical Identity only after reviewing it.
4. Preview again: expect zero new historical changes and zero errors. Check the
   Current universe preview: the tested copy has 53 held, 990 outside coverage
   and no proposed changes. These informational rows remain available for review.
5. Reopen/reload the AMIRCHAND chart. Verify canonical AEROPLANE identity and
   price continuity. The tested raw snapshot contains 140 distinct daily bars;
   the earlier screenshot's 148 count still requires rebuilt desktop checking.

The remaining 53 covered absences need their own evidence investigation. This
patch does not resolve or authorize changes to those records.
