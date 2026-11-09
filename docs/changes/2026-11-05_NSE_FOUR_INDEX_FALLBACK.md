# Four more NSE index historical fallback routes — 5 November 2026

Bhavcopy uses the existing daily archive and historical fallback workflow for
12 of the 28 indices in the launch coverage audit. This change adds four routes.
The download log lists the catalog from the backend. The on-screen hint points
to that list so future catalog changes need only one source for the names.

| Index | App storage key | Observed historical response name | Earliest admissible date |
| --- | --- | --- | --- |
| NIFTY Financial Services | `FINNIFTY` | `NIFTY FIN SERVICE` | [7 September 2011](https://www.niftyindices.com/Factsheet/ind_Nifty_Financial_Services.pdf) |
| NIFTY Midcap Select | `MIDCPNIFTY` | `NIFTY MID SELECT` | [14 September 2021](https://www.niftyindices.com/Factsheet/Factsheet_NiftyMidcapSelect.pdf) |
| NIFTY Midcap 150 | `NIFTYMIDCAP150` | `NIFTY MIDCAP 150` | [1 April 2016](https://www.niftyindices.com/Factsheet/ind_Nifty_Midcap_150.pdf) |
| NIFTY Smallcap 250 | `NIFTYSMALLCAP250` | `NIFTY SMLCAP 250` | [1 April 2016](https://www.niftyindices.com/Factsheet/ind_Nifty_Smallcap_250.pdf) |

The historical endpoint returned four complete daily OHLC rows per index for
25–29 May 2026. The observations are dated 25, 26, 27 and 29 May. The production
database's accepted NSE calendar lists 28 May as Bakri Id. All four dates were
absent for these indices in the 4 November production audit snapshot.

The launch-week probes for Financial Services, Midcap 150 and Smallcap 250 each
returned five close-only rows. Midcap Select returned an empty dataset. The
launch dates set admission limits. The fallback holds incomplete OHLC and full
coverage from launch remains unverified. The probe bodies and date-level results
are retained in `tmp/fixtures/2026-11-05-nse-next-four-qualification/`. Four
byte-preserved historical fixtures exercise the actual response parser offline.

Validation passed. Shared Cargo ran 22 fallback tests and the alias registry
uniqueness test. The retained production-copy test was skipped. Renderer
typechecking, focused Rust formatting and documentation checks also passed.

After the user's portable rebuild, use an isolated copy and run **NSE Indices →
Date Range → 25–29 May 2026**. Confirm the four expected dates for each new
index and a repeat with zero additional rows for those same index/date pairs.
Check the log for whether the rows came from daily archives or historical
fallback. A daily archive hit alone verifies ingestion. Historical fallback
acceptance requires a logged historical request for a missing archive row.
