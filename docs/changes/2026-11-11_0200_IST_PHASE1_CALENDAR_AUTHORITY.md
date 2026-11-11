# HOL-05 (Phase 1) — calendar authority: official only, evidence outranks calendar

- Timestamp (IST): 2026-11-11 01:59
- Root: `E:\TA Projects\EOD Charting Platform`
- Objective: stop the Bhavcopy planner from treating the unverified hardcoded holiday seed as calendar authority, and make a wrong holiday row impossible to apply silently.

## Starting evidence

`2023-09-28` was a real NSE and BSE session that `market_holidays` called Id-E-Milad (`source='BUILTIN'`), so the 2023–2024 repair run skipped it as `Exchange holiday (Id-E-Milad)`.

| Evidence | Result |
| --- | --- |
| `sec_bhavdata_full_28092023.csv` (user-supplied) | 2,492 rows, all `DATE1 = 28-Sep-2023` |
| `cm28SEP2023bhav.csv.zip` (user-supplied) | 2,517 rows, all `TIMESTAMP = 28-SEP-2023` |
| Store bars that date | NSE 2,331, BSE 4,102; session profile matches neighbours |
| OHLC vs source (20MICRONS, SBIN, RELIANCE, TCS, TATASTEEL, INFY) | exact match on all six |
| `prev_close` | source carries values (SBIN 589.75, TCS 3589.30) but every store bar is 0 |

So the bars are correct and the calendar row is wrong. The two supplied PDFs are NSE Clearing circulars about multiple settlements that state "Sep 29, 2023 continues to be a settlement holiday" — a clearing holiday adjacent to the observed date, not a trading-holiday notice.

## Where holiday authority came from

- `official_exchange_holidays` — **official**, but only year **2026** (NSE 20 rows from `api/holiday-master?type=trading`, BSE 20 from notices `20251212-8` / `20260112-8`, accepted 2026-10-28 with URLs + SHA-256).
- `market_holidays source='BUILTIN'` — **hardcoded**, 94 rows for 2023–2027, all inserted `2026-08-09 20:05:07`, never refreshed (`bootstrap.rs:1085`, `HOL-04`).
- `market_holidays source='USER'` — **manual**, 58 rows.

`get_exchange_holiday_name` used official data only when that exchange/year had an accepted snapshot, and otherwise fell back to the hardcoded rows. 2023–2025 and 2027 therefore ran entirely on the frozen seed.

## Change (code only; no data deleted)

`src-tauri-shell/src/bhavcopy/calendar.rs`
- A year without an accepted official snapshot no longer reads `BUILTIN` rows. `get_exchange_holiday_name` returns `load_manual_holiday_name_for_date(...)` — `source='USER'` only — because manual rows are attributable and reviewable.
- The legacy no-schema path still calls `load_holiday_name_for_date` so in-memory fixtures that never ran the additive schema keep working.
- New `is_calendar_skip_contradicted(skip_result, has_stored_bars)`: a date the planner is about to skip as a holiday or weekend must not already hold bars.
- New `has_official_holiday_snapshot(connection, exchange, year)`; BSE is covered through the accepted NSE snapshot for shared cash-market dates, and that is not presented as independent BSE provenance.

`src-tauri-shell/src/bhavcopy/mod.rs`
- Planner logs one line per exchange/year lacking an official snapshot:
  `[NSE] Calendar: no official holiday snapshot for 2023; built-in dates are not used (manual holidays only)`
- Planner applies the guard before pushing a calendar skip. When contradicted it logs
  `[NSE] 2023-09-28: CALENDAR CONTRADICTION - stored bars exist but the calendar says 'Exchange holiday (Id-E-Milad)'; scheduling instead of skipping`
  and falls through to normal planning, so a repair run re-downloads the date.

## Tests

- `hol04_no_official_calendar_preserves_legacy_holiday_lookup` encoded the old contract and was replaced by `phase1_no_official_calendar_ignores_builtin_and_keeps_user`.
- `src-tauri-shell/src/bhavcopy/holiday_sync.rs` → `hol03_snapshot_schema_and_lookup_is_exchange_scoped` asserted `2027-01-15 'Legacy next year'` (BUILTIN) resolved; now asserted `None`.
- Added `phase1_stored_bars_outrank_a_wrong_calendar_row` and `phase1_official_snapshot_presence_is_exchange_and_year_scoped`.

| Command | Result |
| --- | --- |
| `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction check` | PASS — finished in 12.17s |
| `… -CargoAction test -CargoArguments 'bhavcopy::calendar'` | PASS — 7 passed, 0 failed |
| `… -CargoAction test -CargoArguments 'bhavcopy::'` | PASS — **155 passed, 0 failed, 4 ignored** (was 153/4) |

## Measured consequence — read this before the next date-range run

`official_exchange_holidays` covers **2026 only**, so for 2023, 2024, 2025 and 2027 the built-in dates no longer skip anything. A 2023-01-01 → 2024-12-31 run now plans **205 weekend skips + 4 manual holiday skips + 522 jobs** (sum 731), and the 28 built-in holiday weekdays become jobs: `2023-03-07, 2023-03-30, 2023-04-04, 2023-04-07, 2023-04-14, 2023-05-01, 2023-06-29, 2023-08-15, 2023-09-19, 2023-09-28, 2023-10-02, 2023-10-24, 2023-11-14, 2023-11-27, 2023-12-25, 2024-01-26, 2024-03-08, 2024-03-25, 2024-03-29, 2024-04-11, 2024-04-17, 2024-05-01, 2024-06-17, 2024-07-17, 2024-08-15, 2024-10-02, 2024-11-15, 2024-12-25`.

27 of those are genuine closures and will log `No data available for this date` instead of `Exchange holiday (…)`. The 28th is `2023-09-28`, which is the point of the change: it now downloads and receives its real `prev_close`.

This degradation is intentional and loud, not a regression to be worked around: the calendar has no authority for those years until official snapshots exist. Two ways to close it, both needing separate approval:
1. **Corroborated migration** — promote a `BUILTIN` row to `USER` only where the store proves no bars on both exchanges (the 2019–2022 standard). This restores the 27 clean skips and automatically drops `2023-09-28`, which has bars.
2. **Phase 2 official ingestion** — per-year pinned sources, retiring the seed entirely.

## Backups

`backups/pre_opencode_changes_20261111_015539_phase1-calendar-authority` — 3 files (`calendar.rs`, `mod.rs`, `HANDOFF.md`).

## Risks / open items

- The guard depends on planner-side coverage (`storage_mode_load_imported_trade_dates`). `NSE_INDEX` returns empty coverage by design, so the guard is inert for index streams.
- Coverage comes from metadata plus binary reconcile, so a date whose bars exist only outside the planned range cannot be contradicted.
- No official snapshot exists for any year except 2026; 2027 has neither seed authority nor official data.
- The wrong `market_holidays` row for `2023-09-28` is still present and still labelled `BUILTIN`; it is now inert, but should be deleted so the table stops asserting it.
- `prev_close` for the 2,326 NSE bars on `2023-09-28` is still 0 and needs a re-import of that date after the row is removed.
