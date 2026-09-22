# EOD Charting Platform — BSE Index Literal-Date URL Fix V1

## Status

**Accepted: code validation PASS and real-date runtime validation PASS.**

Validation after application:

- focused literal-date regression: 1/1 PASS;
- Bhavcopy test filter: 40/40 PASS;
- `cargo check`: PASS.

Runtime acceptance in the rebuilt platform for the four previously missing dates:

- 2023-09-08: 57 rows;
- 2023-09-14: 57 rows;
- 2023-09-20: 57 rows;
- 2023-09-25: 57 rows.

Final run: 4 success, 0 failed, 228 imported rows.

## Scope

Fix only the BSE Index `IndexArchDailyAllPar` historical request construction in
`src-tauri-shell/src/bhavcopy.rs`.

## Evidence and root cause

The standalone EOD Downloader successfully retrieved 57 BSE Index rows for
2023-09-08 from the same official BSE `IndexArchDailyAllPar` endpoint.

The working standalone implementation constructs the query as a raw string with
literal `DD/MM/YYYY` values:

`?fmdt=08/09/2023&index=All&period=D&todt=08/09/2023`

The EOD Charting Platform used `reqwest::Url::query_pairs_mut()` for the same
parameters. That serializes the slash-bearing date as an encoded query value
(e.g. `%2F`). The separate PowerShell diagnostic also encoded the slash date and
received HTTP 200 with an empty JSON array/table on the problematic dates.

The Charting Platform already had the correct BSE Index archive Referer, Accept,
Origin headers and JSON-table normalization. The request-date representation is
the material difference.

## Change

`build_bse_index_archive_url()` now preserves literal slash-form dates and a
regression test asserts both the exact URL and absence of `%2F`.

## Deliberately not changed

- BSE Equity source or symbol mapping.
- NSE/NSE Index sources.
- BSE Index JSON parser and symbol mapping.
- Bhavcopy recovery Phase 2B/2B.1.
- Phase 2C APPEND_NEWEST buffered durability.
- Binary worker count.
- Renderer/UI code.

## Runtime acceptance

The rebuilt application staged and imported all four previously failing dates through the corrected BSE Index path. Each date returned 57 rows and the aggregate run completed with 4 success, 0 failed, and 228 imported rows. This closes the September-2023 BSE Index missing-date defect represented by these four cases.
