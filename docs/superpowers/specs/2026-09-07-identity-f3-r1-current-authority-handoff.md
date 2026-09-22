# Identity F3-R1 — Current Authority Handoff

**Status:** CURRENT HANDOFF / F3 RESOLVED  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Current source authorities

```text
bse_identity_imports.rs
CD6EA4BE7A697BCADF1940D663CBADD1C78B48FBCD1AC8241AB667B939955B0E

nse_identity_imports.rs
B5EDDFD1A31161C66DCDB23B11B9A19C4C14756F178B65F2FA39A0DBCF64380B

official_source_urls.rs
2540D12AD94AC71C60196138290C75C757E43A9D602900127F8A9CB43CC33FF7
```

## F3-R1 accepted contract

BSE current-source files must expose these five semantic header groups:

```text
Security Id / Scrip Id
Security Code
Security Name
Group
ISIN
```

`Status` remains optional.

Missing required header groups fail closed with:

`BSE_SOURCE_CONTRACT_REJECTED`

Frozen aliases remain accepted and extra columns remain compatible.

Row-level blank-value tolerance and lifecycle semantics are unchanged.

## Validation authority

RED evidence SHA-256:

`ACF2302651F933F4CDDC98E012DE49F92368CA7150D226CEBF4394837A05473D`

GREEN evidence SHA-256:

`1CCC18C5C544180794016B1C85170AD3611EE86A6CF860C2ED08B8F19B1FF321`

GREEN:

- F3 source-contract tests: 7/7 PASS;
- F4 population regression: 5/5 PASS;
- BSE Identity tests: 5/5 PASS;
- offline cargo check PASS.

## ER0 findings after F3-R1

```text
F1  RESOLVED
F2  OPEN / DEFERRED
F3  RESOLVED
F4  RESOLVED
F5  RESOLVED
```

Only F2 remains open.

Do not treat F3-R1 as authorization to implement F2 or the broader ER1 source-health architecture.

Recommended next bounded finding, if separately approved:

`F2 — NSE company-name history official-source coverage`
