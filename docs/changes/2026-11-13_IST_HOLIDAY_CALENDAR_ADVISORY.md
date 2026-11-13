# HOL-07 — the holiday calendar is advisory, never a gate

- Timestamp (IST): 2026-11-13
- Root: `E:\TA Projects\EOD Charting Platform`
- Directive (user): *"Market Holidays calendar should not block data to downloads"* and *"if data not found and it is week off then it should show that day or find from holiday logs"*.

## Behaviour change

Before: a weekday holiday produced `Exchange holiday (Name)` and **no request was made**. A wrong or stale row could therefore silently suppress a real session — the `2023-09-28` failure mode.

After:

| Day | Behaviour |
| --- | --- |
| Special session (Muhurat, DR, Budget Saturday) | **Attempted** — overrides everything, including weekends |
| Weekend | **Skipped** (structural), with the holiday name attached when the exchange calls that date a holiday |
| Weekday holiday | **Attempted** — the calendar never blocks a download |
| Weekday, no data returned | Logged, then explained by the calendar (see below) |

`create_calendar_skip_result` now returns `None` for every weekday. The calendar's only remaining job in the planner is diagnostic.

## Diagnostics added

1. **`No-data review` line** at the end of every batch (`finish_batch_progress` → `no_data_annotation_line`):
   `No-data review: 28 date/exchange pairs - 14 on a calendar holiday, 14 not on any calendar holiday (source gaps). Holidays: … Gaps: …`
   This is what separates "the exchange was closed" from "the source is missing data" — previously both read `No data available`.
2. **`reconcile_holiday_failure`** — a failed download on a calendar-holiday date is reclassified as an expected skip (`Exchange holiday (Name); no source file published`), so a closed day is never counted as a failed job. The download is still attempted; only the classification changes.
3. **`calendar_date_key`** — index results carry a decorated date (`2026-01-15 archive`), which made the calendar lookup miss and misreported 14 index holidays as gaps. The key strips the decoration.

## Verified against a real 2026 run (`New Database`, 2026-01-01 → 2026-11-12)

| Check | Result |
| --- | --- |
| Calendar loaded | 0 `no official snapshot` lines |
| Holidays not blocking | `non-trading calendar days: 352` = weekends only (88 × 4) |
| Review line | 28 pairs → 14 holiday / 14 gap |
| Weekend holidays shown | 12 × `Weekend (…); Exchange holiday (…)` |
| Imported count | `Imported 231 (226 partial)` |
| Incomplete tile | 226 |
| `CALENDAR CONTRADICTION` | 0 |

Defects found by that run and fixed here: holiday failures counted as failures (28 of 45), and index holiday dates misreported as gaps (14).

## Tests

Rewritten to the new contract rather than deleted:

- `weekday_holiday_never_blocks_a_download` — holiday row present, weekday still planned; weekends still skip; a special session overrides a Sunday.
- `holiday_failure_is_reclassified_as_an_expected_skip` — closed day becomes a skip; a failure on a trading day stays a failure.
- `decorated_index_dates_still_resolve_to_the_calendar` — `"2026-01-15 archive"` resolves.
- The two planner calendar tests and the BSE 2011 evidenced-holiday test now assert the date is **planned**, not skipped.

`bhavcopy::` **171 passed / 0 failed / 4 ignored**.

## Consequences and limits

- Every holiday weekday in a range now costs one real request (~14–20 per year). `non-trading calendar days` counts weekends only.
- `CALENDAR CONTRADICTION` is now effectively unreachable through the skip path; the review line replaces it as the calendar-quality signal.
- The `No-data review` wiring into `finish_batch_progress` is not unit-tested (it needs an `AppHandle` to emit); the helper logic is covered indirectly.
- The run reported 17 trading-day failures overall. The recorded exchange figures use a different or unreconciled count, so they cannot be treated as a breakdown of those 17. The NSE Indices historical fallback acquired zero rows for every index in this run. An earlier run reported four.
