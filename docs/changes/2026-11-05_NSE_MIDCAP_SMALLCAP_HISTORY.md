# NSE Midcap 100 and Smallcap 100 historical fallback — 5 November 2026

Bhavcopy now includes both indices in the existing archive-first workflow. When
daily archives or stored bars leave gaps, the app uses the same NSE historical
request path, 366-day request limit, identity checks and additive writes as the
original six indices. The backend log lists the supported names from the catalog.

| Cash index | Request name | Storage key | Earliest admissible date |
| --- | --- | --- | --- |
| NIFTY Midcap 100 | `NIFTY MIDCAP 100` | `NIFTYMIDCAP100` | [18 July 2005](https://www.niftyindices.com/Factsheet/ind_niftymidcap100.pdf) |
| NIFTY Smallcap 100 | `NIFTY SMALLCAP 100` | `SMALLCAP100` | [30 March 2011](https://www.niftyindices.com/Factsheet/ind_niftysmallcap100.pdf) |

One request per index for **8–15 July 2016** returned HTTP 200 and six observations
each. The Midcap response names `NIFTY MIDCAP 100`. The Smallcap response names
`NIFTY SMLCAP 100`, which is now explicitly mapped to `SMALLCAP100`. The original
response bytes are preserved as Rust fixtures with SHA-256 checks. The two
launch-week probes (18–22 July 2005 and 30 March–5 April 2011) returned HTTP 200
with empty datasets. The launch dates are import limits. Coverage from either
launch remains open. Probe receipts and bodies are under
`tmp/fixtures/2026-11-05-nse-index-fallback-qualification/`.

The earlier audit found an invalid `CNXSMALLCAP` bar on 20 August 2015. A stored
invalid OHLC or volume now marks that quotation for review. A competing incoming
observation is held as a conflict and other dates can proceed. Header, scale and
ownership failures still stop ingestion. The invalid production bar was not edited.

Shared Cargo fallback tests passed (21 passed, one retained-copy test skipped).
The captured responses exercise request identity and cross-index rejection. The
legacy-bar regression verifies conflict isolation and unchanged stored bytes.
Renderer typecheck, focused Rust formatting and documentation checks passed.

Native acceptance after the user's portable rebuild should use an isolated copy.
Run **NSE Indices → Date Range → 8–15 July 2016**, then confirm both indices have
six usable observations and the repeat adds none for those index/date pairs. Other
indices may also contribute rows depending on the selected database. Check the
fallback log for both exact index names. No bulk production backfill was performed.
