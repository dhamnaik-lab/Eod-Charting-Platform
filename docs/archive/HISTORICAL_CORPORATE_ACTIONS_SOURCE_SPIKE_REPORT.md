# Historical Corporate Actions Source Spike Report

Date: 2026-06-12

## Goal

Complete Phase 1 of the historical corporate-actions backfill plan:

- test real source coverage on a small symbol set
- separate source-history gaps from resolver/ISIN problems
- decide which source paths are strong enough for automation

## Scope

Pilot symbols:

- `KOTAKBANK`
- `INFY`
- `WIPRO`
- `BAJFINANCE`
- `HDFCBANK`

This is a read-mostly source audit only.

No code or database behavior changed in this phase.

## Method

The spike used:

1. the active local database:
   - `EOD DATABASE\Nse\market-data.sqlite3`
2. the live NSE structured corporate-actions endpoint already used by the app
3. official identity/reference pages where needed
4. secondary public-history pages only as cross-check evidence, not as canonical import sources

## Current Active Source Path Under Test

The current app fetches recent official corporate actions through:

- NSE warm-up + `https://www.nseindia.com/api/corporates-corporateActions`
- BSE warm-up + `https://api.bseindia.com/BseIndiaAPI/api/DefaultData/w`

The question for this phase was whether those sources are enough for deep split/bonus history.

## Symbol Findings

### Summary Table

| Symbol | Local split/bonus rows | First local split/bonus | Live NSE split/bonus rows | Verdict |
| --- | ---: | --- | ---: | --- |
| `KOTAKBANK` | 3 | `2010-09-13` | 3 | Deep-history gap exists |
| `INFY` | 4 | `2006-07-13` | 4 | Deep-history gap exists |
| `WIPRO` | 4 | `2010-06-15` | 4 | Deep-history gap exists |
| `BAJFINANCE` | 3 | `2016-09-08` | 3 | Source looks complete for split/bonus; identity drift remains |
| `HDFCBANK` | 3 | `2011-07-14` | 3 | Source looks complete for split/bonus; identity drift remains |

### KOTAKBANK

Local DB currently has:

- `2010-09-13` split
- `2015-07-08` bonus
- `2026-01-14` split

Live NSE API returned the same capital-action set and no older bonus rows.

Cross-check history shows older Kotak bonuses before 2010:

- `1994`
- `2004`
- `2005`

Conclusion:

- the current structured source path is missing older Kotak bonus history
- this is a source-history gap, not only a resolver problem

Identity note:

- local DB current instrument ISIN: `INE237A01036`
- live NSE API historical Kotak rows returned: `INE237A01010`
- Kotak investor page currently states demat ISIN: `INE237A01028`

This is the clearest proof that historical provenance must be preserved instead of flattening identity into one current ISIN field.

### INFY

Local DB and live NSE API both show capital-action history starting only from:

- `2006-07-13` bonus

Cross-check history shows older Infosys capital actions before 2006, including:

- bonus rows in `1994`, `1997`, `1999`, `2004`
- split in `2000`

Conclusion:

- the current structured source path is materially incomplete for older Infosys split/bonus history

### WIPRO

Local DB and live NSE API both show capital-action history starting only from:

- `2010-06-15` bonus

Cross-check history shows older Wipro capital actions before 2010, including:

- bonus in `2005`
- split in `1999`

Conclusion:

- the current structured source path is materially incomplete for older Wipro split/bonus history

### BAJFINANCE

Local DB and live NSE API agree on the current split/bonus set:

- `2016-09-08` combined bonus/split event
- `2025-06-16` split
- `2025-06-16` bonus

Cross-check history did not reveal an older missing split/bonus backlog for this symbol.

Conclusion:

- this is a useful control case
- current source coverage for split/bonus looks sufficient here
- the remaining issue is historical ISIN drift, not missing capital-action rows

Identity note:

- local current instrument ISIN: `INE296A01032`
- live NSE historical capital-action rows: `INE296A01016`

### HDFCBANK

Local DB and live NSE API agree on the current split/bonus set:

- `2011-07-14` split
- `2019-09-19` split
- `2025-08-26` bonus

Cross-check history did not reveal an older missing split/bonus backlog for this symbol.

Conclusion:

- this is a second useful control case
- current source coverage for split/bonus looks sufficient here
- the remaining issue is historical ISIN drift, not missing capital-action rows

Identity note:

- local current instrument ISIN: `INE040A01034`
- live NSE historical capital-action rows: `INE040A01018`

## Source Verdicts

### 1. NSE structured corporate-actions API

Verdict:

- **usable for recent/review workflow**
- **not sufficient as the only deep-history split/bonus source**

Reason:

- it correctly returns recent and medium-history capital actions
- it demonstrably misses older split/bonus history for at least `KOTAKBANK`, `INFY`, and `WIPRO`

Use going forward:

- keep as the current recent-history source
- do not rely on it alone for historical backfill

### 2. NSE archive circulars

Verdict:

- **usable as official supporting evidence for specific actions**
- **not yet proven as a complete symbol-queryable backfill feed**

Reason:

- search can find specific circulars proving corporate actions
- current phase did not establish a durable searchable index/workflow that can replace a master history feed

Use going forward:

- use for confirmation and evidence attachment
- do not treat as the first bulk discovery source

### 3. BSE public corporate-actions pages

Verdict:

- **not yet approved for automation**

Reason:

- the public stock corp-actions page is reachable in a browser-style request
- static fetch inspection did not expose historical action rows or a stable direct data endpoint in this phase
- machine-usable extraction is therefore still unproven

Use going forward:

- keep as a candidate for a later source spike
- do not build the backfill around it yet

### 4. Secondary public-history pages

Verdict:

- **useful for audit and proof cases**
- **not canonical automated import input**

Reason:

- they clearly expose older split/bonus rows that are absent from the current structured source path
- they are still secondary, not exchange-system truth

Use going forward:

- use to prioritize symbols and validate that a source gap really exists
- do not auto-import from them as canonical data

## Phase 1 Conclusion

Phase 1 is complete.

The source spike proves:

1. the missing old Kotak rows are not a Kotak-only anomaly
2. historical ISIN handling and historical row discovery are separate problems
3. the current structured NSE/BSE feed path should remain the recent-history source
4. a separate deep-history split/bonus backfill source path is required
5. `BAJFINANCE` and `HDFCBANK` are good control symbols because they show identity drift without obvious split/bonus history loss

## Recommended Next Step

Proceed to **Phase 2 and Phase 3 together**, but only in the narrowest safe shape:

1. add a historical evidence table
2. add a single-symbol backend backfill command
3. pilot it first on:
   - `KOTAKBANK`
   - `INFY`
   - `WIPRO`

Do not start with batch backfill.

## Reference URLs

Official / primary:

- NSE structured corporate actions API:
  - `https://www.nseindia.com/api/corporates-corporateActions`
- NSE symbol change archive:
  - `https://nsearchives.nseindia.com/content/equities/symbolchange.csv`
- Kotak investor information:
  - `https://www.kotak.com/en/investor-relations/investor-information/investor-info.html`
- Example NSE archive circulars:
  - `https://nsearchives.nseindia.com/content/circulars/CMPT72256.pdf`
  - `https://nsearchives.nseindia.com/content/circulars/FAOP65352.pdf`

Secondary cross-checks used for gap confirmation:

- Kotak bonus history:
  - `https://www.moneycontrol.com/company-facts/kotakmahindrabank/bonus/KMB/`
- Kotak split history:
  - `https://www.moneycontrol.com/company-facts/kotakmahindrabank/splits/KMB/`
- Infosys bonus history:
  - `https://www.moneycontrol.com/company-facts/infosys/bonus/IT/`
- Infosys split history:
  - `https://www.moneycontrol.com/company-facts/infosys/splits/IT/`
- Wipro bonus history:
  - `https://www.moneycontrol.com/company-facts/wipro/bonus/W/`
- Wipro split history:
  - `https://www.moneycontrol.com/company-facts/wipro/splits/W/`
- Bajaj Finance bonus history:
  - `https://www.moneycontrol.com/company-facts/bajajfinance/bonus/BAF/`
- Bajaj Finance split history:
  - `https://www.moneycontrol.com/company-facts/bajajfinance/splits/BAF/`
- HDFC Bank bonus history:
  - `https://www.moneycontrol.com/company-facts/hdfcbank/bonus/HDF01/`
- HDFC Bank split history:
  - `https://www.moneycontrol.com/company-facts/hdfcbank/splits/HDF01/`
