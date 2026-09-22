# Identity F2-R1 — Current Authority Handoff

**Status:** CURRENT HANDOFF / F2-R1 CLOSED / F2-R2 REMAINS  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Current production authorities

```text
official_source_urls.rs
0102C1EE65113D60E77E2BE2F9A61FCCD15C1C5FF693234D52A6C890FA25CBE8

nse_identity_imports.rs
C5E37DD182B3B91690397E6B7D401A8B5C31FE4002D7490A2A629FE9BEE7AE54

database.rs
D3FCB170E5EB32CF7E55FFEB3DA334068F8D53FCFEB898938BD54FE1EC358FEF

desktop.ts
E7986D81E2A7B1768B843CFD97AAE44C9B683F0BCEF0EA3DE6B94421B7623569

DatabaseToolsDialogs.tsx
FE7B6D8395906D9DEA017986E08A2596173D745594E59F0259785C983A3FAFB5

bse_identity_imports.rs
CD6EA4BE7A697BCADF1940D663CBADD1C78B48FBCD1AC8241AB667B939955B0E
```

## F2-R1 accepted behavior

Official NSE Refresh now includes:

`https://nsearchives.nseindia.com/content/equities/namechange.csv`

Managed target:

`NSE\Identity\CompanyNameChanges\nse_identity_company_name_changes.csv`

Before final write:

- F5 NSE provenance is enforced;
- existing I4 company-name parser validates the downloaded bytes.

Download result/UI accounting now exposes:

```text
companyNameChangeFilePath
companyNameChangeRowsRead
Company name change CSV
```

## Authority boundary

F2-R1 does not automatically Preview or Apply historical Identity.

```text
Official Refresh
→ acquire validated evidence only

Historical Preview/Apply
→ remains explicit reviewed I4 authority
```

## Validation

RED evidence SHA-256:

`6A05F97BAE99245BD90293CC7BCD42ABBA5E8CF58842A59E0035FA25ED6AB845`

GREEN evidence SHA-256:

`B053134A31C806122E04B162E61173BA7959C40FFA0E81417326E79627082110`

GREEN:

- F2 focused tests 5/5 PASS;
- F5 provenance 5/5 PASS;
- F4 population 5/5 PASS;
- NSE Identity 31/31 PASS;
- offline cargo check PASS;
- renderer TypeScript typecheck PASS.

## ER0-R1 status

```text
F1  RESOLVED
F2  PARTIAL
    R1 acquisition CLOSED
    R2 official historical consumption OPEN / NOT STARTED
F3  RESOLVED
F4  RESOLVED
F5  RESOLVED
```

Recommended next bounded work, only if separately approved:

`F2-R2 — expose existing reviewed I4 Historical Preview/Apply in Official mode using the managed source root`
