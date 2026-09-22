# Identity F1-R1 — NSE Delisted Semantic Selection Current Authority

**Status:** CURRENT AUTHORITY / F1 RESOLVED  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Scope

This authority closes **ER0-R1-F1 only**:

> NSE delisted workbook discovery previously selected the first HTTPS `.xlsx` candidate from the configured NSE delisting page without proving that the candidate represented companies actually delisted from NSE.

F2, F3, F4, F5 and ER1+ remain unchanged and open/deferred according to the existing ER0-R1 authority.

## TDD authority

RED evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_F1_R1_NSE_DELISTED_RED_2026-09-07_140450_IST_evidence.zip`

SHA-256:

`EA77B3C3270B32535DDD85D6398C7664D9D1B5E87361624DE28E16254CF1FF0E`

RED proved:

- proposed-delisting first / actual-delisted second incorrectly selected proposed;
- proposed-only incorrectly selected proposed rather than fallback;
- opaque actual-delisted link was missed when an earlier proposed link existed;
- processing-status workbook could outrank the actual-delisted workbook.

GREEN evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_F1_R1_NSE_DELISTED_GREEN_2026-09-07_143849_IST_evidence.zip`

SHA-256:

`BCC45CE85908248EF28EBEECA8E3B6EB8AC0D8284F8C09A30CA817BA4215ED6E`

Accepted GREEN validation:

- focused semantic-selection tests: 5/5 PASS;
- NSE delisted regression filter: 7/7 PASS;
- full NSE Identity Rust test module: 31/31 PASS;
- offline `cargo check`: PASS;
- pre-existing `apply_nse_current_universe_sync_internal` unused-function warning remains non-fatal and unrelated.

## Current production source authority

`src-tauri-shell\src\database\nse_identity_imports.rs`

Preimage:

`2E05EF2050179305223A95F10CD0B3B2DE894F9615A78991E2D93F6ADD7542AB`

Current postimage:

`3124B827AFDB79A3F5ADFC2947B30C373FBD6F98FC7292E3DAF2E3AC864B9E3D`

## Current discovery behavior

The previous behavior:

```text
NSE delisting page
→ first HTTPS .xlsx
→ use candidate
```

is no longer current authority.

Current behavior:

```text
NSE delisting page
→ percent-decode page
→ scan XLSX candidates in order
→ inspect candidate URL + enclosing anchor semantics
→ require actual-delisted company semantics
→ reject proposed-delisting semantics
→ accept first provable actual-delisted candidate
→ if none is provable, use existing configured fallback
```

The selector requires semantic terms equivalent to:

- `delisted`;
- `company` or `companies`;

and rejects candidates containing:

- `proposed`.

Opaque workbook URLs are accepted when the enclosing anchor text proves the actual-delisted meaning.

A processing-status workbook does not qualify as actual-delisted authority.

## Preserved boundaries

No change was made to:

- NSE delisted workbook XLSX parser;
- NSE delisted fallback URL;
- NSE Equity/SME master parsing;
- NSE symbol/name history parsing;
- I3 reviewed Preview/Apply authority;
- I4 historical reviewed/atomic Apply authority;
- `official_source_urls.rs`;
- BSE Identity parsing or behavior;
- UI;
- database schema/data;
- official-host enforcement;
- population-sanity rules;
- ER1+ source-health/recovery implementation;
- source-control state.

## Relationship to ER0-R1

The original ER0-R1 risk document remains historical evidence and is not rewritten.

For current status:

```text
ER0-R1-F1
NSE delisted workbook semantic-selection risk
→ RESOLVED by F1-R1
```

The remaining ER0-R1 findings retain their prior status:

```text
F2 NSE company-name official history coverage
→ OPEN / DEFERRED

F3 BSE parser tolerance vs intended contract
→ OPEN / DEFERRED

F4 source population sanity
→ OPEN / intended for early ER1 health work

F5 official-host enforcement
→ OPEN / intended for early ER1 provenance work
```

ER1 is not started or authorized by this closeout.
