# Identity F2-R2 — Current Authority Handoff

**Status:** CURRENT HANDOFF / F2-R2 CLOSED / ER0-R1 FINDINGS F1-F5 RESOLVED  
**Date:** 2026-09-08 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Production authority

Official NSE Historical Identity now uses the managed active-database reference-data root when no explicit archive root is supplied.

Manual mode continues to use the explicit NSE Archive Root.

```text
Official
→ managed reference-data
→ Historical Preview
→ reviewed plan SHA256
→ explicit Apply

Manual
→ explicit NSE Archive Root
→ Historical Preview
→ reviewed plan SHA256
→ explicit Apply
```

Automatic Apply remains disabled.

## Reviewed authority binding

Apply remains bound to:

```text
plan SHA256
active database
source mode
requested archive-root context
```

The existing I4 atomic Preview/Apply authority remains unchanged.

## Current hashes

```text
nse_identity_imports.rs
8CA170743BBD342222641B2478F1622BDF456EAC5516AC79B7A1344D98A9FC83

database.rs
2CC0DCDDBE22E9BAC99285FE85E33BB19BDB2CABF410D47883D064B156F5948B

desktop.ts
FB3D1D65030358D92A1DDF868330CD15D231252505D1C7EFBADBB4752BDBD6AB

DatabaseToolsDialogs.tsx
E07FDCA1664D661FF5F2DC09CBD1B8DAE2B892121E3469DE4CA55DBE3DE6CBAC

corporateActionIdentityOfficialHistoricalConsumption.test.ts
C024CDA38719621B167AAA529F4ACED9C95BE577E49EABEBE14A6E3A005D6FC8

official_source_urls.rs
0102C1EE65113D60E77E2BE2F9A61FCCD15C1C5FF693234D52A6C890FA25CBE8

bse_identity_imports.rs
CD6EA4BE7A697BCADF1940D663CBADD1C78B48FBCD1AC8241AB667B939955B0E
```

## Evidence bindings

```text
F2-R2 RED
7F54BB431CEDAB332008283C0E30F421478A9B3E05981934F79100B414BB98CB

Diagnostic R1
2B8E634EAA9B2D889E8ABAAAD90D79B937CE2822473701CA779E1782F87A8CD5

Diagnostic R2
ACDBC80A84688A7D5012F6EBDA2F15D6BAB47543790DC10C38931EDD6B5E6AC6

F2-R2 GREEN R2
889C53CDE7211DC688DBC814455399769828593260DC8FCAB51984FECC9D8892
```

## Root-cause note

The first GREEN failure was caused by a pre-existing cfg(test) temporary-directory collision.

The test helper now includes process id + timestamp nanoseconds + AtomicU64 sequence and has a permanent concurrent regression test.

Production F2-R2 behavior was unchanged by that test-only repair.

## ER0-R1 status

```text
F1 CLOSED
F2 CLOSED
F3 CLOSED
F4 CLOSED
F5 CLOSED
```

Broader ER1 remains outside this handoff and is not started by this closeout.
