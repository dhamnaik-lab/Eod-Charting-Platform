# Historical NSE OHLC depth for the 28 requested indices — 5 November 2026

This is a source audit of **historical dates**. The existing NSE historical endpoint
returned usable daily open, high, low and close for **all 28 requested indices**.
Across **83 historical windows**, it returned **9,727 distinct index/date candles**.
Of these, **6,441** dates were absent for the corresponding index in the 4 November
production snapshot. The latest requested window ends in 2022. The audit does not
estimate an all-years total from the sample.

## What the historical results establish

- **NIFTY 500:** 147 usable candles in the 1999 window, beginning 7 June. The
  2000 and 2005 samples also contain complete candles. The app's 2010 limit holds
  **648** confirmed missing sampled dates below that limit.
- **NIFTY IT:** the 2003 response switches from close-only to usable OHLC on
  **25 August**. The 2004 and 2005 samples contain OHLC from their first returned
  dates. **839** confirmed missing sampled dates fall below the app's 2010 limit.
- **NIFTY Bank:** the launch-year and 2004 samples were close-only. The 2005
  sample has **141** complete candles starting **9 June**. All **880** valid
  sampled dates are absent from the production snapshot.
- **Midcap 150 and Smallcap 250:** the 2016 and 2018 windows were close-only.
  Both supplied **236** usable 2019 candles beginning **14 January**. The
  2017 and launch-to-present continuity questions remain open.
- **Midcap 100 and Smallcap 100:** the current historical request names returned
  empty datasets in the tested older windows. Midcap 100 first returned usable
  data on **9 November 2015** in the tested windows. Smallcap 100 first returned
  usable data on **1 April 2016**. The production snapshot already has earlier
  bars for both, so these endpoint results do not set a lower bound on existing
  daily archive or legacy-name coverage.

## All 28 indices

**First and last OHLC** bound the observed dates across sampled windows. Years
between those dates were not necessarily queried. **OHLC** counts unique usable
dates. **Close-only** counts unique dates with a valid close and no usable candle
in the retained responses. **Missing** compares sampled usable dates with the
4 November production snapshot. **App fallback** lists the current source floor
for the automatic route. Archive-only indices can still enter via daily files.

| Index | App key | First OHLC observed | Last OHLC observed | OHLC | Close-only | Missing in production snapshot | App fallback floor |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| NIFTY 50 | `NIFTY` | 1996-04-22 | 2000-12-29 | 424 | 0 | 404 | 1996-04-22 |
| NIFTY Bank | `BANKNIFTY` | 2005-06-09 | 2009-12-31 | 880 | 441 | 880 | 2003-09-15 |
| NIFTY Midcap Select | `MIDCPNIFTY` | 2022-01-10 | 2022-12-30 | 243 | 0 | 1 | 2021-09-14 |
| NIFTY Financial Services | `FINNIFTY` | 2012-02-27 | 2012-12-31 | 212 | 117 | 3 | 2011-09-07 |
| NIFTY Next 50 | `NIFTYNEXT50` | 1996-12-24 | 2009-12-31 | 490 | 0 | 490 | 1996-12-24 |
| NIFTY IT | `NIFTYIT` | 2003-08-25 | 2010-12-31 | 1,091 | 1,149 | 1,091 | 2010-01-01 |
| NIFTY Auto | `NIFTYAUTO` | 2011-10-03 | 2012-12-31 | 311 | 56 | 98 | Archive only |
| NIFTY Metal | `NIFTYMETAL` | 2011-10-03 | 2012-12-31 | 311 | 56 | 98 | Archive only |
| NIFTY Pharma | `NIFTYPHARMA` | 2011-01-31 | 2011-12-30 | 228 | 144 | 228 | Archive only |
| NIFTY FMCG | `NIFTYFMCG` | 2011-01-31 | 2011-12-30 | 228 | 90 | 228 | Archive only |
| NIFTY PSU Bank | `NIFTYPSUBANK` | 2011-01-31 | 2011-12-30 | 228 | 104 | 228 | Archive only |
| NIFTY Private Bank | `NIFTYPRIVATEBANK` | 2016-03-14 | 2017-12-29 | 446 | 47 | 4 | Archive only |
| NIFTY Realty | `NIFTYREALTY` | 2011-01-03 | 2011-12-30 | 247 | 85 | 247 | Archive only |
| NIFTY Energy | `NIFTYENERGY` | 2011-01-31 | 2011-12-30 | 228 | 144 | 228 | Archive only |
| NIFTY Oil & Gas | `NIFTYOILGAS` | 2021-08-09 | 2021-12-31 | 100 | 387 | 0 | Archive only |
| NIFTY Healthcare | `NIFTYHEALTHCAREINDEX` | 2021-08-09 | 2021-12-31 | 100 | 178 | 0 | Archive only |
| NIFTY Consumer Durables | `NIFTYCONSUMERDURABLES` | 2021-08-09 | 2021-12-31 | 100 | 387 | 2 | Archive only |
| NIFTY Infrastructure | `NIFTYINFRASTRUCTURE` | 2011-01-03 | 2012-12-31 | 498 | 101 | 285 | Archive only |
| NIFTY Media | `NIFTYMEDIA` | 2011-10-03 | 2012-12-31 | 311 | 51 | 98 | Archive only |
| NIFTY 100 | `NIFTY100` | 2005-12-01 | 2009-12-31 | 264 | 0 | 264 | 2005-12-01 |
| NIFTY 200 | `NIFTY200` | 2011-10-03 | 2012-12-31 | 311 | 51 | 98 | Archive only |
| NIFTY 500 | `NIFTY500` | 1999-06-07 | 2010-12-31 | 900 | 0 | 900 | 2010-01-01 |
| NIFTY Midcap 50 | `MIDCAP50` | 2011-06-07 | 2012-12-31 | 392 | 0 | 182 | Archive only |
| NIFTY Midcap 100 | `NIFTYMIDCAP100` | 2015-11-09 | 2016-12-30 | 283 | 0 | 189 | 2005-07-18 |
| NIFTY Midcap 150 | `NIFTYMIDCAP150` | 2019-01-14 | 2019-12-31 | 236 | 441 | 4 | 2016-04-01 |
| NIFTY Smallcap 100 | `SMALLCAP100` | 2016-04-01 | 2016-12-30 | 186 | 0 | 185 | 2011-03-30 |
| NIFTY Smallcap 250 | `NIFTYSMALLCAP250` | 2019-01-14 | 2019-12-31 | 236 | 441 | 2 | 2016-04-01 |
| NIFTY Microcap 250 | `NIFTYMICROCAP250` | 2022-01-10 | 2022-12-30 | 243 | 0 | 4 | Archive only |

## What the app can use now

Of the 6,441 confirmed sampled gaps, **2,926** pass the current automatic fallback
catalog and date-floor checks. Another **1,487** are below the NIFTY IT and NIFTY
500 floors, and **2,028** belong to the 16 indices that currently use the daily
archive route only. These categories describe code admission and stored date
coverage. A subsequent import still needs the normal calendar, identity and
additive checks. This audit changed neither the catalog nor any stored prices.

## Evidence and limits

The probe used the same [NSE historical index route](https://www.nseindia.com/reports-indices-historical-index-data)
as the app, with explicit index names and windows no longer than one calendar
year. It tested the launch year or a documented probe boundary, then an older
checkpoint year. Additional annual windows narrowed selected transitions. For
IT, 500 and Midcap 50, the first probe boundary was not treated as a verified
launch date. The earlier [launch audit](2026-11-04-nse-index-launch-coverage.md)
links the factsheets and records the on-disk coverage baseline.

All 83 responses returned HTTP 200. Rows were checked for matching identities,
in-range dates, positive finite values, OHLC geometry, and duplicate dates.
The calculation excluded three otherwise unusable rows. No conflicting valid
OHLC duplicates remained. Two response abbreviations were reconciled using NSE
references and the exact requested names. This offline reconciliation did not
add app aliases. [Private Bank broadcast name](https://nsearchives.nseindia.com/web/mediaattachment/2026-05/Snapshot_MDR_RT_CM_v1.33.pdf) ·
[Infrastructure legacy identifier](https://www.nseindia.com/static/products-services/equity-derivatives-niftyinfrastructure) ·
[Official index renaming](https://www.niftyindices.com/docs/default-source/press-release-upload/ind_prs22092015.pdf)

The exact windows, returned labels, raw response SHA-256 hashes, valid date sets
and production gap lists are in `tmp/fixtures/2026-11-05-nse-historical-depth/`.
Use `reconciled.json` for the validated totals. The raw probe receipts retain the
initial pre-reconciliation labels. Any full-series claim needs a comparison for
the remaining years against an official trading calendar. Close-only dates stay
separate from OHLC and empty results establish only the outcome of that request.
