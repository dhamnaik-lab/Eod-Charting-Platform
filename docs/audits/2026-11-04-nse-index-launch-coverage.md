# NSE index launch-to-present coverage — 4 November 2026

5 November follow-up added Midcap 100 and Smallcap 100 to the historical fallback.
The table below preserves the 4 November audit snapshot. See the new response
evidence, admission dates and native checks in the [fallback expansion record](../changes/2026-11-05_NSE_MIDCAP_SMALLCAP_HISTORY.md).

All 28 requested cash indices have bars in both databases. **Full coverage from launch is unproven for all 28.** Production ends on **26 October 2026** for all 28, while the separate test database has bars through **4 November 2026**. The retained official 3 November daily archive has usable OHLC for every index in scope, so **each production series has at least one confirmed missing session after its stored end**. The test database is a separate, deliberately sparse fixture.

Official factsheets gave an explicit launch date for **25 of 28**. The three open dates are **NIFTY IT, NIFTY 500 and NIFTY Midcap 50**. Their factsheets leave the launch field blank. A February 1999 notice establishes that the S&P CNX 500 already existed by then. The app's fallback admission date does not establish when that index launched. [NSE historical data](https://niftyindices.com/reports/historical-data) · [S&P CNX 500 notice](https://www.niftyindices.com/Press_Release/ind_prs25021999.pdf)

## Per-index results

- **Official OHLC** means the earliest usable row found in the retained responses inspected. It is an observed date, with no claim that the provider's series starts there. 2010 rows came from retained historical responses. The 2026 rows came from the retained daily archive.
- **Production / test** show the first physical bar and number of distinct dates after joining only the app's registered aliases. Counts include the one structurally stored Smallcap 100 bar flagged below.
- **Peer gaps** count dates between the first and last production bar on which another index in this 28-index audit has a stored bar. They are candidates for calendar and source reconciliation.
- **Source gaps** count retained official OHLC dates absent from production through 26 October 2026, including dates before its first bar. All 28 also lack the separately confirmed 3 November bar in production. A zero only applies to the sampled official responses.

| Cash index | App key | Official launch | Earliest retained official OHLC | Production first / dates | Peer gaps | Source gaps | Test first / dates |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| NIFTY 50 | `NIFTY` | [1996-04-22](https://www.niftyindices.com/Factsheet/ind_nifty50.pdf) | 2010-01-04 | 2000-01-03 / 4,154 | 20 | 4 | 2010-01-04 / 521 |
| NIFTY Bank | `BANKNIFTY` | [2003-09-15](https://www.niftyindices.com/Factsheet/ind_nifty_bank.pdf) | 2010-01-04 | 2010-01-04 / 4,112 | 23 | 0 | 2010-01-04 / 521 |
| NIFTY Midcap Select | `MIDCPNIFTY` | [2021-09-14](https://www.niftyindices.com/Factsheet/Factsheet_NiftyMidcapSelect.pdf) | 2026-11-03 | 2022-01-10 / 1,157 | 20 | 0 | 2026-09-01 / 44 |
| NIFTY Financial Services | `FINNIFTY` | [2011-09-07](https://www.niftyindices.com/Factsheet/ind_Nifty_Financial_Services.pdf) | 2026-11-03 | 2012-02-27 / 3,562 | 37 | 0 | 2026-09-01 / 44 |
| NIFTY Next 50 | `NIFTYNEXT50` | [1996-12-24](https://www.niftyindices.com/Factsheet/ind_next50.pdf) | 2010-01-04 | 2010-01-04 / 4,091 | 44 | 0 | 2010-01-04 / 521 |
| NIFTY IT | `NIFTYIT` | [Open](https://www.niftyindices.com/Factsheet/ind_nifty_it.pdf) | 2010-01-04 | 2011-01-03 / 3,842 | 42 | 251 | 2010-01-04 / 521 |
| NIFTY Auto | `NIFTYAUTO` | [2011-07-12](https://www.niftyindices.com/Factsheet/ind_nifty_auto.pdf) | 2026-11-03 | 2012-02-21 / 3,560 | 43 | 0 | 2026-09-01 / 44 |
| NIFTY Metal | `NIFTYMETAL` | [2011-07-12](https://www.niftyindices.com/Factsheet/ind_nifty_metal.pdf) | 2026-11-03 | 2012-02-21 / 3,573 | 30 | 0 | 2026-09-01 / 44 |
| NIFTY Pharma | `NIFTYPHARMA` | [2005-07-01](https://www.niftyindices.com/Factsheet/ind_nifty_pharma.pdf) | 2026-11-03 | 2012-02-21 / 3,556 | 47 | 0 | 2026-09-01 / 44 |
| NIFTY FMCG | `NIFTYFMCG` | [1999-09-22](https://www.niftyindices.com/Factsheet/ind_nifty_FMCG.pdf) | 2026-11-03 | 2012-02-21 / 3,568 | 35 | 0 | 2026-09-01 / 44 |
| NIFTY PSU Bank | `NIFTYPSUBANK` | [2007-08-30](https://www.niftyindices.com/Factsheet/ind_nifty_psu_bank.pdf) | 2026-11-03 | 2012-02-21 / 3,561 | 42 | 0 | 2026-09-01 / 44 |
| NIFTY Private Bank | `NIFTYPRIVATEBANK` | [2016-01-05](https://www.niftyindices.com/Factsheet/ind_nifty_private_bank.pdf) | 2026-11-03 | 2016-03-14 / 2,576 | 38 | 0 | 2026-09-01 / 44 |
| NIFTY Realty | `NIFTYREALTY` | [2007-08-30](https://www.niftyindices.com/Factsheet/ind_nifty_realty.pdf) | 2026-11-03 | 2012-02-21 / 3,561 | 42 | 0 | 2026-09-01 / 44 |
| NIFTY Energy | `NIFTYENERGY` | [2005-07-01](https://www.niftyindices.com/Factsheet/ind_nifty_energy.pdf) | 2026-11-03 | 2012-02-21 / 3,561 | 42 | 0 | 2026-09-01 / 44 |
| NIFTY Oil & Gas | `NIFTYOILGAS` | [2020-01-15](https://www.niftyindices.com/Factsheet/Factsheet_nifty_oil_and_gas.pdf) | 2026-11-03 | 2021-08-09 / 1,266 | 16 | 0 | 2026-09-01 / 44 |
| NIFTY Healthcare | `NIFTYHEALTHCAREINDEX` | [2020-11-18](https://www.niftyindices.com/Factsheet/Factsheet_Nifty_Healthcare_Index.pdf) | 2026-11-03 | 2021-08-09 / 1,262 | 20 | 0 | 2026-09-01 / 44 |
| NIFTY Consumer Durables | `NIFTYCONSUMERDURABLES` | [2020-01-15](https://www.niftyindices.com/Factsheet/Factsheet_nifty_consumer_durables.pdf) | 2026-11-03 | 2021-08-09 / 1,263 | 19 | 0 | 2026-09-01 / 44 |
| NIFTY Infrastructure | `NIFTYINFRASTRUCTURE` | [2007-08-07](https://www.niftyindices.com/Factsheet/ind_nifty_infra.pdf) | 2026-11-03 | 2012-02-21 / 3,560 | 43 | 0 | 2026-09-01 / 44 |
| NIFTY Media | `NIFTYMEDIA` | [2011-07-19](https://www.niftyindices.com/Factsheet/ind_nifty_media.pdf) | 2026-11-03 | 2012-02-21 / 3,569 | 34 | 0 | 2026-09-01 / 44 |
| NIFTY 100 | `NIFTY100` | [2005-12-01](https://www.niftyindices.com/Factsheet/ind_nifty_100.pdf) | 2010-01-04 | 2010-01-04 / 4,088 | 47 | 0 | 2010-01-04 / 521 |
| NIFTY 200 | `NIFTY200` | [2011-07-19](https://www.niftyindices.com/Factsheet/ind_nifty_200.pdf) | 2026-11-03 | 2012-02-21 / 3,557 | 46 | 0 | 2026-09-01 / 44 |
| NIFTY 500 | `NIFTY500` | [Open](https://www.niftyindices.com/Factsheet/ind_nifty_500.pdf) | 2010-01-04 | 2011-01-03 / 3,793 | 91 | 251 | 2010-01-04 / 521 |
| NIFTY Midcap 50 | `MIDCAP50` | [Open](https://www.niftyindices.com/Factsheet/ind_nifty_midcap50.pdf) | 2026-11-03 | 2012-02-21 / 3,543 | 60 | 0 | 2026-09-01 / 44 |
| NIFTY Midcap 100 | `NIFTYMIDCAP100` | [2005-07-18](https://www.niftyindices.com/Factsheet/ind_niftymidcap100.pdf) | 2026-11-03 | 2012-02-21 / 3,073 | 530 | 0 | 2026-09-01 / 44 |
| NIFTY Midcap 150 | `NIFTYMIDCAP150` | [2016-04-01](https://www.niftyindices.com/Factsheet/ind_Nifty_Midcap_150.pdf) | 2026-11-03 | 2019-01-14 / 1,886 | 29 | 0 | 2026-09-01 / 44 |
| NIFTY Smallcap 100 | `SMALLCAP100` | [2011-03-30](https://www.niftyindices.com/Factsheet/ind_niftysmallcap100.pdf) | 2026-11-03 | 2012-02-21 / 3,082 | 521 | 0 | 2026-09-01 / 44 |
| NIFTY Smallcap 250 | `NIFTYSMALLCAP250` | [2016-04-01](https://www.niftyindices.com/Factsheet/ind_Nifty_Smallcap_250.pdf) | 2026-11-03 | 2019-01-14 / 1,879 | 36 | 0 | 2026-09-01 / 44 |
| NIFTY Microcap 250 | `NIFTYMICROCAP250` | [2021-05-10](https://www.niftyindices.com/Factsheet/Factsheet_Nifty_Microcap_250_Index.pdf) | 2026-11-03 | 2022-01-10 / 1,157 | 20 | 0 | 2026-09-01 / 44 |

## What can be backfilled with current evidence

- **Confirmed missing observations.** Retained source responses identify 251 missing 2010 dates each for NIFTY IT and NIFTY 500 in production, plus four missing NIFTY 50 dates through the production cutoff. The retained evidence JSON lists the source dates and local date sets for reconciliation. These observations are evidence for planning, not authorization to import.
- **Largest internal gaps to qualify.** Midcap 100 has 530 peer-session candidates and Smallcap 100 has 521. Investigate both series' historical identities and compare the gaps with official rows before proposing an import.
- **Existing history quality.** Across 49 production files and 28 test files in scope, no registered aliases overlapped on a date and no OHLC alias conflicts were found. One stored Smallcap 100 bar in `CNXSMALLCAP` on **2015-08-20** has close **5,549.30** below low **5,550.50**. Compare it with the official source before any repair.
- **Acquisition scope.** Current automatic historical fallback covers NIFTY 50, Bank, Next 50, 100, 500 and IT. The remaining 22 can enter Bhavcopy via daily archive rows when available. Completing their history needs per-index source identity and date qualification. Cash index launch dates exclude pre-launch calculated values, even where an official series starts at an earlier base date.
- **Calendar limit.** The production database has an accepted NSE holiday snapshot for 2026 only. The test database has none. The peer comparison cannot detect dates missing from every series. A complete launch-to-present claim requires a dated session calendar with special sessions and per-index source comparisons. The report leaves that claim open for all 28.

## Method and reproducibility

Opened `EOD DATABASE/market-data.sqlite3` and `New Database/market-data.sqlite3` read-only. Both returned zero NSE_INDEX rows in SQLite `eod_prices`. Inspected 85,412 production and 4,094 test binary records with exact metadata owners and registered alias families. Checked binary signature, exchange, scale, file size, header identity, increasing dates, OHLC geometry and alias overlap. The retained 3 November CSV and historical response bytes referenced by normalized receipts were checked against their SHA-256 hashes. Older retained NIFTY 50 responses with close-only observations did not count as OHLC evidence.

The inspection script, input-file hashes, exact observed date sets, receipt paths and gap candidates are under `tmp/fixtures/2026-11-04-nse-index-coverage/` in `inspect.py` and `coverage.json`. The source-code alias registry is `src-tauri-shell/src/database/index_aliases.rs`. Official factsheets are linked per row. The official historical page provides the next source comparison route. This review used retained quotations and did not download new price histories or modify either database.
