# Identity F4-R1 — 1000-Row Population Sanity Current Authority

**Status:** CURRENT AUTHORITY / F4 RESOLVED  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Scope

This authority closes **ER0-R1-F4 only**:

> Syntactically valid but severely truncated current-source files could previously pass weak population checks and reach source acceptance / current-universe plan construction.

F1 and F5 remain resolved. F2 and F3 remain unchanged/open/deferred according to the existing ER0-R1 authority.

## TDD authority

RED evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_F4_R1_POPULATION_SANITY_RED_2026-09-07_172810_IST_evidence.zip`

SHA-256:

`7E7A72D0830C7141A83A2125B2FC111A77C22B9D7F12342CEC1E96FD1B5B4AA6`

RED proved the NSE/BSE current-population sanity validation APIs did not exist.

GREEN evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_F4_R1_POPULATION_SANITY_GREEN_2026-09-07_180645_IST_evidence.zip`

SHA-256:

`C2EAB6F5BC51A9CBD678F30E38445D871A842B8D0204923FAFF6211602333E81`

Accepted GREEN validation:

- focused 999/1000 population contract tests: 5/5 PASS;
- full NSE Identity Rust test module: 31/31 PASS;
- full BSE Identity Rust test module: 5/5 PASS;
- offline `cargo check`: PASS;
- no project database schema/data change;
- no external network test;
- no source-control command.

The existing unused `apply_nse_current_universe_sync_internal` warning remains unrelated.  
`nse_official_redirect_policy` remains unused only in test builds; normal `cargo check` does not report that warning.

## Current production source authorities

`src-tauri-shell\src\database\nse_identity_imports.rs`

`B5EDDFD1A31161C66DCDB23B11B9A19C4C14756F178B65F2FA39A0DBCF64380B`

`src-tauri-shell\src\database\bse_identity_imports.rs`

`9896449ADA61EDB2D8301EC4AF013978EF8880435CFB906E25357A9E4D5ED565`

F5 shared provenance authority remains:

`src-tauri-shell\src\database\official_source_urls.rs`

`2540D12AD94AC71C60196138290C75C757E43A9D602900127F8A9CB43CC33FF7`

## F4-R1 population contract

The accepted severe-truncation floor is:

`1000`

### NSE

Official Equity download:

```text
parse downloaded Equity source
→ count supported Equity/current rows
→ require >= 1000
→ only then write final managed source file
```

Current-universe Preview/Apply:

```text
load Equity + optional SME current source
→ normalize/filter/deduplicate supported current symbols
→ require >= 1000
→ only then construct current-universe plan
```

If the current supported population is below 1000, fail closed with:

`SOURCE_POPULATION_SANITY_REJECTED`

### BSE

Official lifecycle download:

```text
download Active + Delisted + Suspended
→ build combined lifecycle CSV in memory
→ parse/deduplicate using the production BSE parser
→ count unique CURRENT symbols
→ require >= 1000 CURRENT symbols
→ only then write final managed lifecycle source
```

Current-universe Preview/Apply:

```text
parse supplied lifecycle master
→ deduplicate by symbol/lifecycle authority
→ count CURRENT / DELISTED / SUSPENDED
→ require >= 1000 CURRENT symbols
→ only then construct current-universe plan
```

Delisted and Suspended populations do not compensate for an undersized CURRENT population.

Examples:

```text
NSE 999 supported current symbols
→ REJECT

NSE 1000 supported current symbols
→ ACCEPT population gate

BSE 999 CURRENT + 5000 DELISTED + 5000 SUSPENDED
→ REJECT

BSE 1000 CURRENT
→ ACCEPT population gate
```

## Error authority

Severe population truncation is reported using:

`SOURCE_POPULATION_SANITY_REJECTED`

This gate is a source-plausibility control. It does not by itself certify source completeness, correctness, freshness, semantics or provenance.

## Preserved boundaries

F4-R1 does not add or change:

- database schema/data;
- F5 runtime official-host enforcement;
- F1 NSE delisted workbook semantic selection;
- source URL editing/storage;
- NSE/BSE field completeness ratios;
- dynamic prior-source percentage/delta comparisons;
- historical population baselines or population storage;
- NSE company-name automatic source coverage;
- BSE intended metadata contract hardening;
- BSE historical parity/production acceptance;
- source-control state.

The BSE file parser was factored so the same production parsing/deduplication logic can operate on the in-memory official combined CSV before final file write. This is part of the F4-R1 pre-write gate and does not change the accepted BSE field-alias/lifecycle semantics.

Existing small regression fixtures were expanded in test-only helpers to satisfy the new production minimum; this is test support and not a production bypass.

## Relationship to ER0-R1

The original ER0-R1 risk document remains historical evidence and is not rewritten.

Current finding status:

```text
F1 NSE delisted semantic selection
→ RESOLVED by F1-R1

F2 NSE company-name official history coverage
→ OPEN / DEFERRED

F3 BSE parser tolerance vs intended contract
→ OPEN / DEFERRED

F4 source population sanity
→ RESOLVED by F4-R1

F5 official-host enforcement
→ RESOLVED by F5-R1
```

The broader ER1 source-health architecture is not automatically authorized by this closeout.
