# Identity F5-R1 — Current Authority Handoff

**Status:** CURRENT HANDOFF / F5 RESOLVED  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Current source authorities

```text
official_source_urls.rs
2540D12AD94AC71C60196138290C75C757E43A9D602900127F8A9CB43CC33FF7

nse_identity_imports.rs
E6DB2DC15C0FC6E9FF5BB4EE6653E5DD72CDD4C1511A58B1919F89C073425DDB

bse_identity_imports.rs
518123F411AD39843AF6031C00D00FC90EDC03C4D5708937D21312A9CC5866E9
```

## What changed

Runtime official-source downloads now enforce:

```text
HTTPS
+ exact approved exchange host
+ redirect-target validation
+ final-response URL validation
```

NSE allowed hosts:

`nseindia.com`, `www.nseindia.com`, `nsearchives.nseindia.com`, `archives.nseindia.com`

BSE allowed hosts:

`bseindia.com`, `www.bseindia.com`, `api.bseindia.com`

Unknown/HTTP/lookalike sources fail closed with:

`OFFICIAL_SOURCE_PROVENANCE_REJECTED`

Saved `officialSourceUrls.v1` overrides are not rewritten.

## Validation authority

RED evidence SHA-256:

`C45B7E30C4A56DF661FBFE41599F78A0C04B813C4CED049781733EC999BD4941`

GREEN evidence SHA-256:

`8C57D04B587ADCE040BF657FC92AF9D0F84D970FAA742DCD5838CE8049F46278`

GREEN:

- focused provenance tests 5/5 PASS;
- NSE Identity tests 31/31 PASS;
- BSE Identity tests 5/5 PASS;
- offline cargo check PASS.

No external network test was executed in F5-R1.

## ER0 findings after F5-R1

```text
F1  RESOLVED
F2  OPEN / DEFERRED
F3  OPEN / DEFERRED
F4  OPEN
F5  RESOLVED
```

Do not treat F5-R1 as authorization to implement F2-F4 or the broader ER1 phase.

Recommended next bounded issue, if separately approved:

`F4 — source population sanity / truncation detection`
