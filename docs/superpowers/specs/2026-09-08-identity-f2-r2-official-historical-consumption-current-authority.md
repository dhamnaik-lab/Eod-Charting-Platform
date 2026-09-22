# Identity F2-R2 — Official Historical Consumption Current Authority

**Status:** CURRENT AUTHORITY / F2-R2 CLOSED / F2 FULLY RESOLVED  
**Date:** 2026-09-08 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Scope

This authority closes F2-R2 after verified RED → GREEN R2 implementation.

F2-R2 enables the existing reviewed I4 NSE Historical Identity workflow in **Official** mode by resolving the historical source root from the active database's managed reference-data root.

No automatic Historical Apply is introduced.

## Current F2-R2 behavior

### Official mode

```text
active database
→ <database folder>\reference-data
→ managed NSE Identity archive
→ Historical Preview
→ reviewed plan SHA256
→ explicit Apply Reviewed Historical Identity
→ existing I4 atomic transaction
```

### Manual mode

```text
explicit NSE Archive Root
→ Historical Preview
→ reviewed plan SHA256
→ explicit Apply Reviewed Historical Identity
→ existing I4 atomic transaction
```

The Manual Archive Root remains explicit and authoritative.

## Reviewed Apply authority

Historical Apply remains valid only when the reviewed authority still matches:

```text
plan SHA256
+ active database
+ source mode
+ requested archive-root context
```

A changed source, changed database state, changed source mode, changed requested-root context, or changed plan fingerprint requires a fresh Historical Preview.

## I4 preservation

F2-R2 does not alter the I4 plan-hash semantics or transaction model.

```text
Preview
→ BEGIN IMMEDIATE
→ execute tentative plan
→ ROLLBACK
→ expose review result + plan SHA

Apply
→ recompute same plan
→ verify reviewed SHA
→ COMMIT only on exact match

failure / stale authority
→ ROLLBACK
```

Automatic Apply: **NO**

## TDD authority

RED evidence:

`IDENTITY_F2_R2_OFFICIAL_HISTORICAL_RED_2026-09-07_234122_IST_evidence.zip`

SHA-256:

`7F54BB431CEDAB332008283C0E30F421478A9B3E05981934F79100B414BB98CB`

RED proved that Official mode did not yet provide the managed-root Historical Preview/Apply contract while the Manual Archive Root remained supported.

## First GREEN failure and root cause

The first GREEN candidate reached focused F2-R2/F2-R1/F4/F5 checks but one existing NSE Identity test intermittently reported a stale Historical plan.

Diagnostic R1 showed:

```text
isolated failing test    PASS
full NSE serial          PASS
full NSE parallel        PASS
```

Diagnostic R1 evidence SHA-256:

`2B8E634EAA9B2D889E8ABAAAD90D79B937CE2822473701CA779E1782F87A8CD5`

Diagnostic R2 proved the root cause was a **pre-existing cfg(test) temporary archive-root collision** in `create_temp_archive_root()`.

Observed:

```text
8 of 10 stress runs produced duplicate temporary paths
maximum observed collision count: 7 / 128 concurrent calls
```

Diagnostic R2 evidence SHA-256:

`ACDBC80A84688A7D5012F6EBDA2F15D6BAB47543790DC10C38931EDD6B5E6AC6`

This was classified as a test-fixture concurrency defect, not a production F2-R2 plan-hash regression.

## Test-only collision repair

The cfg(test) helper now uses:

```text
process id
+ SystemTime nanoseconds
+ AtomicU64 sequence
```

A permanent regression test verifies concurrent temporary archive-root uniqueness.

This repair changes test-fixture behavior only.

## GREEN R2 validation

GREEN R2 evidence:

`IDENTITY_F2_R2_OFFICIAL_HISTORICAL_GREEN_R2_2026-09-08_010838_IST_evidence.zip`

SHA-256:

`889C53CDE7211DC688DBC814455399769828593260DC8FCAB51984FECC9D8892`

Accepted validation:

```text
F2-R2 focused Official Historical UI/source contract     6/6 PASS
existing Identity frontend regressions                  15/15 PASS
F2-R2 managed/manual root Rust tests                     2/2 PASS
temp-root uniqueness stress                            10/10 PASS
F2-R1 acquisition regression                            5/5 PASS
F5 provenance regression                                5/5 PASS
F4 population regression                                5/5 PASS
full NSE Identity module, default parallel              32/32 PASS × 3
cargo check --offline                                   PASS
renderer TypeScript typecheck                           PASS
```

No project database command, external network test, or source-control command was used.

## Current source authorities

`src-tauri-shell\src\database\nse_identity_imports.rs`

`8CA170743BBD342222641B2478F1622BDF456EAC5516AC79B7A1344D98A9FC83`

`src-tauri-shell\src\database.rs`

`2CC0DCDDBE22E9BAC99285FE85E33BB19BDB2CABF410D47883D064B156F5948B`

`src\types\desktop.ts`

`FB3D1D65030358D92A1DDF868330CD15D231252505D1C7EFBADBB4752BDBD6AB`

`src\components\DatabaseToolsDialogs.tsx`

`E07FDCA1664D661FF5F2DC09CBD1B8DAE2B892121E3469DE4CA55DBE3DE6CBAC`

Permanent F2-R2 frontend regression:

`src\features\corporateActions\__tests__\corporateActionIdentityOfficialHistoricalConsumption.test.ts`

`C024CDA38719621B167AAA529F4ACED9C95BE577E49EABEBE14A6E3A005D6FC8`

Preserved official-source authority:

`src-tauri-shell\src\database\official_source_urls.rs`

`0102C1EE65113D60E77E2BE2F9A61FCCD15C1C5FF693234D52A6C890FA25CBE8`

Preserved BSE authority:

`src-tauri-shell\src\database\bse_identity_imports.rs`

`CD6EA4BE7A697BCADF1940D663CBADD1C78B48FBCD1AC8241AB667B939955B0E`

## ER0-R1 finding status

After this closeout:

```text
F1  RESOLVED / CLOSED
F2  RESOLVED / CLOSED
    F2-R1 official namechange acquisition     CLOSED
    F2-R2 official historical consumption     CLOSED
F3  RESOLVED / CLOSED
F4  RESOLVED / CLOSED
F5  RESOLVED / CLOSED
```

All ER0-R1 findings F1-F5 are now resolved.

This closeout does not authorize broader ER1 work.
