# HOL-06 — registry-driven official holiday sources (per exchange/year)

- Timestamp (IST): 2026-11-11 02:55
- Root: `E:\TA Projects\EOD Charting Platform`
- Objective: stop the holiday source list being code-pinned, so a new year or a changed exchange URL is data, not a release. Supports the user's Phase 2 request (items 2, 3, 4, 5, 7, 8 of the 11 November holiday spec).

## Live feasibility checked before implementing

| Source | Result |
| --- | --- |
| `https://www.nseindia.com/api/holiday-master?type=trading` | HTTP 200, 35,739 bytes, 12 segment buckets; **`CM` = 20 rows, year 2026** — equals the accepted snapshot (`record_count` 20) |
| `https://www.bseindia.com/markets/MarketInfo/DispNewNoticesCirculars.aspx?page=20251212-8` | HTTP 200; notice renders as text ("Trading Holidays for the Calendar Year 2026", "Republic Day 26-Jan-26 Monday" …) |

NSE is current-year-only; BSE publishes one notice per calendar year, which is archival.

## Schema (additive)

`src-tauri-shell/src/database/bootstrap.rs`, inside the existing idempotent batch:

```sql
holiday_source_registry(
  exchange, year, document_index, url, parser, required_fragments,
  expected_rows, operator_note, updated_at,
  PRIMARY KEY(exchange, year, document_index))
```

`document_index` exists because BSE needs two documents for one year (the annual notice plus an amendment). `parser ∈ {NSE_JSON, BSE_NOTICE_HTML, BSE_AMENDMENT_2026}`. `required_fragments` keeps each document fail-closed by pinning the notice identity that must appear in the response.

Seeded `INSERT OR IGNORE`:
- `NSE 2026 doc 0` — holiday-master JSON, expected 20 rows
- `BSE 2026 doc 0` — notice `20251212-8`, the five identity fragments, expected 19 rows
- `BSE 2026 doc 1` — amendment `20260112-8`, expected 1 row

## Code

`src-tauri-shell/src/bhavcopy/holiday_sync.rs`
- `HolidaySourceRow` now carries `document_index` and `expected_rows`; `SOURCE_COLUMNS` updated.
- `registry_documents(conn, exchange, year)` — every document for one exchange/year in fetch order.
- `parse_bse_notice(bytes, year, required_fragments, expected_rows)` — the generic annual-notice parser. Same token logic as the 2026 parser, but the year gate is gone and the identity fragments plus the expected row count come from the registry, so a new year needs no code.
- `parse_registered_document(bytes, row, year)` — dispatches on the registry `parser` value; `BSE_AMENDMENT_2026` reuses `validate_bse_2026_amendment` and wraps its single row.
- `fetch_exchange_from_registry(client, conn, exchange, year)` — validates each URL, fetches, parses, validates rows, and hashes all documents together.
- `fetch_official` now validates via `validate_holiday_source_url` (https + pinned host + no open redirect) instead of a const allowlist.
- `preview_official_exchange_holidays`: year gate relaxed from `2026..=2100` to `1990..=2100`; **registry presence is now the real year gate** — an unregistered year fails closed with "No official holiday source is registered for {exchange} {year}".
- `fetch_nse` / `fetch_bse` retained as `#[allow(dead_code)]` strict-2026 reference paths for regression comparison.

Commands (already registered in `main.rs`): `list_holiday_source_registry(year?)`, `upsert_holiday_source_url(exchange, year, url, requiredFragments?, operatorNote?)`. Upsert derives the parser from the exchange and writes `document_index 0`; amendments stay seeded.

## Validation

| Command | Result |
| --- | --- |
| `Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction check` | PASS — 8.22s |
| `… test 'bhavcopy::holiday_sync'` | PASS — 10 passed, 0 failed |
| `… test 'bhavcopy::'` | PASS — **159 passed, 0 failed, 4 ignored** (was 155 before HOL-06) |

New tests: URL policy (https/host/redirect), parser derived from exchange, registry defaults additive and idempotent (3 rows, second preparation must not duplicate), and registry-presence-is-the-year-gate (2023/2025 fail closed before any network call).

Two compile failures were caught by `cargo check` and fixed before tests: JSON fragments containing double quotes inside the Rust batch string, and the amendment parser returning one row where a vector was required.

## Backups

- `backups/pre_opencode_changes_20261111_024318_hol06-holiday-source-registry` — `bootstrap.rs`, `holiday_sync.rs`, `main.rs`.
- Note: the earlier Phase 1 edit to `holiday_sync.rs` (one test expectation) was made without that file being in the Phase 1 backup; it is covered from this backup onward.

## UI slice (same day, after the backend)

- New command `list_official_exchange_holidays(year)` returns accepted rows per exchange, because `market_holidays.date` is globally UNIQUE and cannot show two exchanges on the same date.
- Platform bindings added to `DesktopBridgeApi`, the `DesktopApi` Pick union, and `tauriDesktop`: `listOfficialExchangeHolidays`, `listHolidaySourceRegistry`, `upsertHolidaySourceUrl`.
- Market Holiday tab gains a **Calendar year** selector (current year ±5) and a **two-column NSE / BSE official view**: holiday count, the registered source URL per exchange, and the date/name list. An accepted-but-empty year shows "Not yet accepted"; an unregistered year shows "No official source registered" in red instead of pretending the calendar is empty.
- The Sync button now fetches the **selected year** (`Sync Official Holidays (YYYY)`), so a new year is captured from the UI without a release.
- The legacy `market_holidays` table, manual add/delete and the existing preview/accept flow are untouched — additive change, no regression path removed.

## Editable source URL control (same day, final slice)

Each exchange column in the Market Holiday tab now has **Edit source URL** (or **Register source URL** when the year has no row yet):

- one-line URL input, `https` enforced and host limited to nseindia.com / bseindia.com by the backend validator;
- for BSE only, a fragments textarea (one required notice fragment per line) that pins the notice identity so a changed notice fails closed;
- Save calls `upsertHolidaySourceUrl` and refreshes the row in place; backend rejections surface in the tab status line;
- the saved row shows parser, pinning state and `updatedAt`; `row count not pinned` is shown explicitly when `expected_rows` is null;
- a year can therefore be **registered from the UI** — save a URL, then Sync Official Holidays (YYYY) fetches and validates it.

Checks: renderer typecheck PASS; the four existing component suites that cover this window (`BhavcopyMarketHolidayLayoutStatus`, `BhavcopyMarketHolidayRefresh`, `BhavcopyOfficialHolidaySync`, `BhavcopyDownloadRerun`) — **27 passed / 0 failed**.

## Built-in seed purge (user-directed, 11 November 2026)

`DELETE FROM market_holidays WHERE source='BUILTIN'` — **94 rows removed**, executed inside `BEGIN IMMEDIATE`. This also removed the false `2023-09-28 Id-E-Milad` row, which was itself `BUILTIN`, so the outstanding P0b deletion is now done as well.

| After the purge | Value |
| --- | --- |
| `market_holidays` total | 152 → **58** |
| By source | `USER` 58 only |
| By year | 2019: 17 · 2020: 12 · 2021: 13 · 2022: 12 · 2023: 1 · 2024: 3 |
| `2023-09-28` row | **gone** |
| `official_exchange_holidays` | untouched — 40 rows (NSE 20 + BSE 20), 2 snapshots |

Planner effect for a 2023-01-01 → 2024-12-31 NSE run: **205 weekend skips + 4 manual holiday skips + 522 jobs (sum 731)**. Closed weekdays in that range are no longer labelled — they surface as `No data available` until official calendars for 2023–2025 are registered and synced.

Rollback: restore `backups/eod-holidays-purge-builtin-20261111_0312/market-data.sqlite3` (SQLite online backup, 261,201,920 bytes, SHA-256 `88E5EF173B0CF106652066268428C248C522682B082168BE074D0694E85FFE16`).

Residual references to `BUILTIN` after the purge: only the column default in `market_holidays.source` (unused — `add_market_holiday` passes an explicit `'USER'`), documentation comments, and test fixtures. No production lookup reads `BUILTIN` any more.

## Pre-2026 non-official purge (user-directed, 11 November 2026)

`DELETE FROM market_holidays WHERE date < '2026-01-01'` — **58 manual rows removed** (2019: 17, 2020: 12, 2021: 13, 2022: 12, 2023: 1, 2024: 3), executed inside `BEGIN IMMEDIATE`. `market_holidays` is now **empty**.

| Table | After |
| --- | --- |
| `market_holidays` | **0 rows** |
| `official_exchange_holidays` | untouched — 40 rows (NSE 20 + BSE 20, 2026) |
| `official_exchange_holiday_snapshots` | untouched — 2 |
| `holiday_source_registry` | untouched — 3 (NSE 2026, BSE 2026 notice + amendment) |

Consequence: no holiday exists before 2026 in any table. A 2019–2025 range plans **every weekday** and each closed day logs `No data available for this date`, with no holiday label. This is the intended honest state until official calendars for those years are registered and accepted.

Rollback: `backups/eod-holidays-purge-manual-pre2026-20261111_0955/market-data.sqlite3` (261,230,592 bytes, SHA-256 `DCA4552D6EB2A21D3CDBD5D13717D2CB3B37AF1AD70BAC6F4F802181F3D688A4`).

## Market Holiday tab cleanup (same day)

- The legacy table is now labelled **Manual holiday overrides — {year}**, scoped to the selected year, with a **Show all years** toggle and a visible row count. It previously ignored the year selector and rendered every year's rows.
- The accepted-snapshot metadata moved into each exchange column (`Accepted <date> · N records · SHA-256 <prefix>`); the separate cross-year line that always reported the current year is gone.
- The duplicated empty-state banner was removed; the per-exchange columns already state `Not yet accepted for {year}`.
- Note text now states the actual rule: nothing before 2026 is stored unless it came from an official source.
- Two source-inspection assertions were tightened from literal statement text to contract-level regexes: `manualHolidaysForYear = manualShowAllYears ? visibleHolidays` (derivation from the database-scoped list, plus `manualHolidaysForYear.map|filter(` for the render) and `listOfficialExchangeHolidaySnapshots( holidayYear )` with a negative assertion that the wall-clock `new Date().getFullYear()` form is gone. They now survive whitespace and statement-shape changes; they are still string-based because all four Bhavcopy window suites are (and `BhavcopyMarketHolidayRefresh` runs extracted component code in a `node:vm` context, not a DOM). A true rendered-output rewrite would need a React Testing Library harness for those four files — a separate decision, not done here.

## Layout root cause and restructure (11 November 2026)

The tab looked broken for three concrete reasons, not styling taste:

1. `marketHolidayPageStyle` is `display:flex; column; flex:1; overflow:hidden`. With a tall official panel (two columns × 20 rows) plus a table child at `flex: 1 1 0` and a fixed add section, the sum exceeded the window and `overflow:hidden` **clipped the Add form off the bottom** — visible in the reported screenshot.
2. `marketHolidayTableStyle` had `flex: '1 1 0'`, so an empty year (0 manual rows) still **reserved a tall bordered box** with its own scrollbar.
3. The three zones came from three unrelated style sources (an inline-styled div, `marketHolidayTableStyle`, `marketHolidayAddStyle` with a `borderTop`), so they had different borders, padding and hierarchy.

Fix:

- New `marketHolidayScrollBodyStyle` — `flex: 1 1 auto; min-height: 0; overflow-y: auto` — wraps the whole tab body. The page header and the status line stay outside it, so they are always visible.
- New `marketHolidayCardStyle` used by the official calendar card, the sync preview and the manual card; `marketHolidayAddStyle` converted to the same card look (border + radius + padding instead of a `borderTop` divider).
- `marketHolidayTableStyle`: `flex: '0 0 auto'`, `minHeight: 0`, **`maxHeight: 240`**, `overflowY: auto` — sizes to content and caps, instead of growing to fill.
- Card titles added: `Official calendars` / `Accepted exchange data only`, `Manual holiday overrides — {year}`, `Add Holiday`.

The HOL-02 layout regression test asserted the previous contract (`flex: '1 1 0'` table). It was updated to the new contract — a scrolling body plus a capped content-sized table — and renamed accordingly; sticky header, fixed add section and fixed status assertions were preserved.

Checks: renderer typecheck PASS; the four Bhavcopy window suites **27 passed / 0 failed**.

## Manual-only loading (user-directed, 11 November 2026)

Opening the Market Holiday tab no longer fetches anything. Previously three paths loaded automatically: the tab button called `loadHolidays()`, the accepted-snapshot effect ran on `activeTab`, and the official year view ran on `activeTab`. With a Refresh button already present that was duplicate work on every tab click.

- Tab button: switches tab only, with a comment recording that this is deliberate.
- New `holidayRefreshVersion` state (0 = not requested yet). Both official reads and the accepted-snapshot read are gated on `holidayRefreshVersion === 0 || !activeDatabasePath || !api → return`.
- **Refresh** bumps the version and calls `loadHolidays()`. A **year change** also bumps it, so selecting a year loads that year immediately.
- Active-database change still clears all cached rows and status, but no longer reloads; the status now reads `Holiday database changed; press Refresh to load.`
- Initial status message changed from `Open Market Holiday to load the holiday list.` to `Press Refresh to load the holiday list.`

Note: after one Refresh, a **database switch** will still re-run the dependency-driven official reads (because `activeDatabasePath` is a dependency), which is intentional — showing another database's calendar would be worse than a silent read. No network call happens without Sync.

Two HOL-01 tests encoded the old auto-refresh contract and were rewritten: the tab test now asserts the *absence* of auto-load and the presence of the Refresh/version wiring; the database-change test asserts state is cleared **without** calling `loadHolidays()`.

## Historical source probe and older BSE date layout (11 November 2026)

Probed every `official_or_primary_url` in the research package for 2019–2026: **all 16 returned HTTP 200** (8 NSE, 8 BSE). Two blockers surfaced:

1. **NSE history is PDF only.** 2019–2026 NSE annual circulars are `application/pdf` (`CMTR39612`, `CMTR42877`, `CMTR46623`, `CMTR50560`, `CMTR54757`, `CMTR59722`, `CMTR65587`, `CMTR71775`). The `NSE_JSON` parser reads the live `holiday-master` API, not PDFs, so **NSE 2019–2025 cannot be captured without a new PDF parser** — not implemented.
2. **Older BSE notices use a different date layout.** The 2026 notice writes `26-Jan-26`; the 2019–2021, 2023 and 2025 notices write `January 26,2023`. The parser only understood the first form, so those years parsed to zero rows and failed closed.

Fix: `parse_bse_long_date` added, and `parse_bse_notice` now accepts both layouts — it tries `%d-%b-%y` on one token, then a `MonthName D,YYYY` pair. The weekday check, the row-number scan, the `expected_rows` pin and `validate_rows` all still apply, so both formats fail closed identically. Confirmed row counts in the live notices: 2019/2020/2021/2023 = 20 dated entries, 2025 = 19.

Tests added (`hol06_bse_date_formats`): long-layout parsing, 2026 short-layout regression, wrong `expected_rows` rejection, wrong-year rejection, and weekday-mismatch rejection. `bhavcopy::` **162 passed / 0 failed / 4 ignored**.

Two fixture bugs were mine, not the parser's, and are worth remembering: the first fixture emitted `January,26,2023` (comma instead of the notice's space), and the first assertion expected the month inside the name when the month belongs to the date.

**Still open:** BSE **2024** is an outlier — only one long-form date is present in notice `20231212-40`, so that year needs its own inspection. NSE 2019–2025 needs a PDF/text parser before any NSE history can be registered.

## Historical import executed (user-approved, 11 November 2026)

Backup first: `backups/eod-holidays-bse-historical-20261111_1150/market-data.sqlite3` (261,230,592 bytes, SHA-256 `6B86199020975806C1070F2AAC9B732519BDD79779A8EBF892439E276C29FC5D`).

**93 BSE rows written** from the official annual notices, as `official_exchange_holidays` + `official_exchange_holiday_snapshots` (source URL, SHA-256 of the fetched HTML, `accepted_at` UTC, record count): 2019 19, 2020 19, 2021 19, 2023 19, 2025 17. NSE 2026 and BSE 2026 were already accepted. Total official rows 40 → **133**.

Rules used, mirroring `parse_bse_notice`: both date layouts, weekday verified against the parsed date, row number must precede the name, 12–35 rows, in-year only, no duplicate dates. **Muhurat/special-session rows whose weekday label did not match were excluded rather than imported as closures** (2019-10-27, 2020-11-14, 2021-11-04, 2023-11-12) — those are trading sessions, and the planner's special-session table already wins over a holiday row.

**Amendment caught and applied:** the BSE 2023 base notice lists Bakri Id on **2023-06-28**, but notice `20230627-2` states "Current Trading Holiday June 28,2023 / Revised Trading Holiday June 29,2023" as a partial modification of `20221208-31`. `2023-06-28` was therefore removed and `2023-06-29` inserted, with the amendment URL appended to that year's `source_urls`. Without the research package's amendment inventory this would have silently booked a trading day as a holiday.

**Seed export:** `docs/data/market-holidays-official.csv` — 133 rows mirroring the database exactly (`exchange,year,date,name,source_urls,source_sha256,accepted_at_utc,snapshot_record_count`). This is the offline bootstrap for a new database.

**Registry note:** BSE 2019/2020/2021/2023/2025 are deliberately **not** registered as re-syncable sources — a Sync would re-read the base notice and silently restore the pre-amendment 2023-06-28. Each such year needs an amendment-aware parser before it can be re-synced.

## Official-holiday CSV import (11 November 2026)

New-database bootstrap without hand-writing SQL.

**Backend** (`holiday_sync.rs`): `preview_official_holiday_csv(csvText)` and `apply_official_holiday_csv(csvText, sha256)`, registered in `main.rs`.

- `parse_official_holiday_csv` requires `exchange, year, date, name` columns (optional `source_urls`, `source_sha256`), and enforces: exchange ∈ {NSE, BSE}, year 1990–2100, date parses as `YYYY-MM-DD` **and** belongs to that year, non-empty name ≤160 chars, no duplicate `(exchange, date)`, and a plausible **12–35 rows per (exchange, year) block** so a truncated file cannot silently wipe a calendar.
- Preview is a dry run: it reports per-block row counts and how many stored rows each block would replace, plus the CSV SHA-256.
- Apply requires the **same SHA-256**, so the file that is written is exactly the file that was previewed; it then replaces each `(exchange, year)` in one transaction — snapshot (`source_urls` from the CSV or `csv:sha256:<hash>`, `source_sha256`, `accepted_at`, `record_count`) plus rows — and rejects if the CSV grew beyond 2 MB.

**UI**: `Import official CSV` in the Official calendars card header opens a file picker, validates through the backend, shows the per-block preview with what it would replace, and only then offers `Import into database`. Import bumps the refresh version so the columns reload.

**Tests**: `hol06_csv_import` — well-formed block accepted; bad exchange, year/date disagreement, duplicate date, malformed date, missing columns, too-few rows and empty file all rejected. `bhavcopy::` **165 passed / 0 failed / 4 ignored**; renderer typecheck PASS; four Bhavcopy window suites 27/27.

**Seed file**: `docs/data/market-holidays-official.csv` (133 rows) is exactly this format, so a new database can be bootstrapped by selecting it and pressing Import.

## Tab-open performance and read model (11 November 2026)

Opening the Market Holiday tab issued **three separate IPC commands** — `listMarketHolidays`, `listOfficialExchangeHolidaySnapshots` and a `Promise.all` of `listOfficialExchangeHolidays` + `listHolidaySourceRegistry` — each opening its own SQLite connection, and it repeated on every tab entry. That is what made the tab feel slow.

- New `get_holiday_calendar_view(year)` returns `{ officialEntries, sources, snapshots }` from **one** read-only connection in **one** IPC round-trip.
- The tab now loads the **selected/present year from the database on open**, on year change and on Refresh — database reads only. The network path is unchanged: only **Sync Official Holidays** fetches.
- The earlier `holidayRefreshVersion === 0` mount guard was removed: it was introduced to stop auto-loading, but it also stopped the tab showing the current year at all. Opening the tab and pressing Refresh are now both plain reads; only Sync is a network action.

Checks: `bhavcopy::` 165 passed / 0 failed / 4 ignored, renderer typecheck PASS, four Bhavcopy window suites 27/27, docs PASS.

## Not in this slice (still open)

- The editor only manages `document_index 0` (the base document). BSE amendments stay seeded by migration.
- The UI cannot set `expected_rows`; a source registered from the UI has its row count unpinned unless a migration sets it.
- No Rust test for `list_official_exchange_holidays` (thin query; would need an `AppHandle` fixture).
- Per-year registry rows for 2019–2025/2027 are not seeded — BSE notice IDs still need identifying per year.
- The 94 `BUILTIN` rows are still present and inert (Phase 1). Deleting them leaves 2019–2025 and 2027 with manual-only calendars.
- `expected_rows` is enforced for BSE documents only; the NSE JSON path validates year and names but not a row count.
