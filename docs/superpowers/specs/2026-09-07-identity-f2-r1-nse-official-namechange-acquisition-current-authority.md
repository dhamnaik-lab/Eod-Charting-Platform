# Identity F2-R1 — NSE Official Company-Name Change Acquisition Current Authority

**Status:** CURRENT AUTHORITY / F2-R1 CLOSED / F2 PARTIALLY RESOLVED  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Scope

This authority closes **F2-R1 acquisition coverage only**.

The accepted F2-R1 correction adds official acquisition of NSE company-name history:

`https://nsearchives.nseindia.com/content/equities/namechange.csv`

into the managed NSE Identity archive.

F2-R1 does **not** authorize or perform Historical Preview/Apply automatically.

The remaining F2 scope is **F2-R2 — Official historical consumption using the existing reviewed I4 authority path**.

## TDD authority

RED evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_F2_R1_NSE_NAMECHANGE_RED_2026-09-07_203133_IST_evidence.zip`

SHA-256:

`6A05F97BAE99245BD90293CC7BCD42ABBA5E8CF58842A59E0035FA25ED6AB845`

RED proved the official acquisition/result contracts were absent.

GREEN evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_F2_R1_NSE_NAMECHANGE_GREEN_2026-09-07_230917_IST_evidence.zip`

SHA-256:

`B053134A31C806122E04B162E61173BA7959C40FFA0E81417326E79627082110`

Accepted GREEN validation:

- focused F2-R1 acquisition tests: 5/5 PASS;
- F5 runtime provenance regression: 5/5 PASS;
- F4 population regression: 5/5 PASS;
- existing NSE Identity Rust test module: 31/31 PASS;
- offline `cargo check`: PASS;
- renderer TypeScript typecheck: PASS;
- no external network test;
- no Identity database mutation from Refresh;
- no source-control command.

## Current production authorities

`src-tauri-shell\src\database\official_source_urls.rs`

`0102C1EE65113D60E77E2BE2F9A61FCCD15C1C5FF693234D52A6C890FA25CBE8`

`src-tauri-shell\src\database\nse_identity_imports.rs`

`C5E37DD182B3B91690397E6B7D401A8B5C31FE4002D7490A2A629FE9BEE7AE54`

`src-tauri-shell\src\database.rs`

`D3FCB170E5EB32CF7E55FFEB3DA334068F8D53FCFEB898938BD54FE1EC358FEF`

`src\types\desktop.ts`

`E7986D81E2A7B1768B843CFD97AAE44C9B683F0BCEF0EA3DE6B94421B7623569`

`src\components\DatabaseToolsDialogs.tsx`

`FE7B6D8395906D9DEA017986E08A2596173D745594E59F0259785C983A3FAFB5`

Preserved BSE authority:

`src-tauri-shell\src\database\bse_identity_imports.rs`

`CD6EA4BE7A697BCADF1940D663CBADD1C78B48FBCD1AC8241AB667B939955B0E`

## F2-R1 official-source contract

Default official company-name source:

`https://nsearchives.nseindia.com/content/equities/namechange.csv`

The source is represented in the official URL contract as:

`nseCompanyNameChangeUrl`

Saved override behavior remains consistent with the existing official-source URL system.

F5 runtime NSE provenance applies to the new source:

```text
HTTPS required
+
exact approved NSE host required
+
redirect target checked
+
final response URL checked
```

## Managed acquisition flow

```text
Official Refresh
→ fetch namechange.csv
→ F5 runtime provenance enforcement
→ validate bytes with existing I4 name-change parser
→ only after validation:
   write managed file
→ report file path + row count
```

Managed target:

`NSE\Identity\CompanyNameChanges\nse_identity_company_name_changes.csv`

The validation reuses existing I4 parser semantics for:

```text
NCH_SYMBOL
NCH_PREV_NAME
NCH_NEW_NAME
NCH_DT
```

Malformed provider data fails before final managed source write.

## Download-result / UI authority

The NSE current-master download result now includes:

```text
companyNameChangeFilePath
companyNameChangeRowsRead
```

The existing Official Source URLs dialog exposes:

`Company name change CSV`

The Refresh status surface reports the downloaded company-name source path and row count.

## Critical authority boundary

F2-R1 is acquisition only:

```text
Refresh official files
≠
Preview Historical Identity
≠
Apply Reviewed Historical Identity
```

Refresh does not mutate Identity history or current Identity state merely because official company-name evidence was downloaded.

The existing I4 reviewed plan / reviewed SHA / atomic Apply authority remains unchanged.

## Preserved boundaries

F2-R1 does not change:

- automatic Historical Preview/Apply behavior;
- I4 reviewed historical Apply authority;
- database schema;
- Identity database state during Refresh;
- F1 NSE delisted semantic selection;
- F3 BSE source contract;
- F4 source population sanity;
- F5 official-host enforcement semantics;
- BSE behavior;
- broader ER1 source-health architecture;
- source-control state.

## ER0-R1 finding status after F2-R1

```text
F1  RESOLVED / CLOSED
F2  PARTIALLY RESOLVED
    F2-R1 official acquisition          CLOSED
    F2-R2 official historical consumption OPEN / NOT STARTED
F3  RESOLVED / CLOSED
F4  RESOLVED / CLOSED
F5  RESOLVED / CLOSED
```

F2 is not fully closed until the separately approved F2-R2 authority is completed.

This closeout does not itself authorize F2-R2 or broader ER1 work.
