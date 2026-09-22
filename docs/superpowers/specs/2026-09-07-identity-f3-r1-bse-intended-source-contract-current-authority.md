# Identity F3-R1 — BSE Intended Source Contract Current Authority

**Status:** CURRENT AUTHORITY / F3 RESOLVED  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Scope

This authority closes **ER0-R1-F3 only**:

> The current BSE parser previously tolerated sources that omitted metadata headers required by the intended accepted BSE source contract.

F1, F4 and F5 remain resolved. F2 remains unchanged/open/deferred.

## TDD authority

RED evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_F3_R1_BSE_SOURCE_CONTRACT_RED_2026-09-07_184546_IST_evidence.zip`

SHA-256:

`ACF2302651F933F4CDDC98E012DE49F92368CA7150D226CEBF4394837A05473D`

RED demonstrated the exact parser-tolerance gap:

- 2 compatibility tests PASS;
- 5 intended required-header tests FAIL.

GREEN evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_F3_R1_BSE_SOURCE_CONTRACT_GREEN_2026-09-07_191849_IST_evidence.zip`

SHA-256:

`1CCC18C5C544180794016B1C85170AD3611EE86A6CF860C2ED08B8F19B1FF321`

Accepted GREEN validation:

- focused F3 BSE source-contract tests: 7/7 PASS;
- F4 population-sanity regression filter: 5/5 PASS;
- full BSE Identity Rust test module: 5/5 PASS;
- offline `cargo check`: PASS;
- no project database schema/data change;
- no external network test;
- no source-control command.

The existing unused `apply_nse_current_universe_sync_internal` warning remains unrelated.  
`nse_official_redirect_policy` remains unused only in test builds; normal `cargo check` does not report that warning.

## Current production source authority

`src-tauri-shell\src\database\bse_identity_imports.rs`

`CD6EA4BE7A697BCADF1940D663CBADD1C78B48FBCD1AC8241AB667B939955B0E`

Preserved current authorities:

`src-tauri-shell\src\database\nse_identity_imports.rs`

`B5EDDFD1A31161C66DCDB23B11B9A19C4C14756F178B65F2FA39A0DBCF64380B`

`src-tauri-shell\src\database\official_source_urls.rs`

`2540D12AD94AC71C60196138290C75C757E43A9D602900127F8A9CB43CC33FF7`

## BSE source-contract authority

Before parsing rows, BSE current-source input must contain at least one accepted header alias for each of these five semantic groups:

```text
1. Security Id / Scrip Id
2. Security Code
3. Security Name
4. Group
5. ISIN
```

`Status` remains optional.

If a required semantic header group is absent, fail closed with:

`BSE_SOURCE_CONTRACT_REJECTED`

## Frozen accepted aliases

### Security Id / Scrip Id

```text
securityid
scripid
securitysymbol
symbol
scripname
```

### Security Code

```text
securitycode
scripcode
code
```

### Security Name

```text
securityname
issuername
nameofcompany
companyname
name
```

### Group

```text
group
groupname
groupcode
series
```

### ISIN

```text
isin
isinno
isinnumber
```

### Optional Status aliases

```text
lifecyclestatus
status
listingstatus
scripstatus
```

Header matching continues to use the existing normalized-header behavior.

## Preserved parser behavior

F3-R1 deliberately changes **header-level source acceptance only**.

It does not tighten row-level completeness semantics.

Therefore:

- frozen header aliases remain accepted;
- extra/unrecognized columns remain ignored;
- Status remains optional;
- row-level blank Security Code/Name/Group/ISIN tolerance is unchanged;
- lifecycle-status classification is unchanged;
- symbol normalization/deduplication is unchanged;
- F4 population sanity remains unchanged;
- F5 runtime provenance remains unchanged.

This distinction is intentional:

```text
source contract
= required semantic columns must exist

row completeness
= separate concern, not changed by F3-R1
```

## Compatibility classification

```text
same required semantic fields under frozen aliases
→ COMPATIBLE

same semantics but provider renames/removes required headers outside frozen aliases
→ ADAPTER_REQUIRED

provider changes the meaning or availability of required BSE identity fields
→ SEMANTIC_CONTRACT_CHANGE
```

Extra presentation columns alone remain compatible.

## Preserved boundaries

No F3-R1 change was made to:

- database schema/data;
- NSE source/parser behavior;
- F1 NSE delisted semantic selection;
- F4 current-population sanity;
- F5 official-host enforcement;
- source URL storage/editing;
- BSE row-level completeness ratios;
- BSE historical parity/production promotion;
- broader ER1 architecture;
- source-control state.

## Relationship to ER0-R1

The original ER0-R1 risk documentation remains historical evidence and is not rewritten.

Current finding status:

```text
F1 NSE delisted semantic selection
→ RESOLVED by F1-R1

F2 NSE company-name official history coverage
→ OPEN / DEFERRED

F3 BSE parser tolerance vs intended contract
→ RESOLVED by F3-R1

F4 source population sanity
→ RESOLVED by F4-R1

F5 official-host enforcement
→ RESOLVED by F5-R1
```

Only F2 remains open from the ER0-R1 findings.

This closeout does not itself authorize F2 implementation or the broader ER1 source-health architecture.
