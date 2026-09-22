# Identity F4-R1 — Current Authority Handoff

**Status:** CURRENT HANDOFF / F4 RESOLVED  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Current source authorities

```text
nse_identity_imports.rs
B5EDDFD1A31161C66DCDB23B11B9A19C4C14756F178B65F2FA39A0DBCF64380B

bse_identity_imports.rs
9896449ADA61EDB2D8301EC4AF013978EF8880435CFB906E25357A9E4D5ED565

official_source_urls.rs
2540D12AD94AC71C60196138290C75C757E43A9D602900127F8A9CB43CC33FF7
```

## What changed

F4-R1 installs a hard severe-truncation floor of:

`1000`

NSE:

- official Equity source must contain at least 1000 supported current rows before final source write;
- current Preview/Apply must contain at least 1000 normalized supported current symbols before plan construction.

BSE:

- official combined lifecycle source must contain at least 1000 unique CURRENT symbols before final source write;
- current Preview/Apply must contain at least 1000 unique CURRENT symbols before plan construction;
- DELISTED/SUSPENDED rows cannot satisfy the CURRENT minimum.

Failures use:

`SOURCE_POPULATION_SANITY_REJECTED`

## Validation authority

RED evidence SHA-256:

`7E7A72D0830C7141A83A2125B2FC111A77C22B9D7F12342CEC1E96FD1B5B4AA6`

GREEN evidence SHA-256:

`C2EAB6F5BC51A9CBD678F30E38445D871A842B8D0204923FAFF6211602333E81`

GREEN:

- focused F4 population tests 5/5 PASS;
- NSE Identity tests 31/31 PASS;
- BSE Identity tests 5/5 PASS;
- offline cargo check PASS.

No external network test was executed in F4-R1.

## ER0 findings after F4-R1

```text
F1  RESOLVED
F2  OPEN / DEFERRED
F3  OPEN / DEFERRED
F4  RESOLVED
F5  RESOLVED
```

Do not treat F4-R1 as authorization to implement F2/F3 or the broader ER1 source-health architecture.

Recommended next bounded finding, if separately approved:

`F3 — BSE parser tolerance vs intended accepted BSE contract`
