# Identity F1-R1 — Current Authority Handoff

**Status:** CURRENT HANDOFF / F1 RESOLVED  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Current source authority

`src-tauri-shell\src\database\nse_identity_imports.rs`

SHA-256:

`3124B827AFDB79A3F5ADFC2947B30C373FBD6F98FC7292E3DAF2E3AC864B9E3D`

## What changed

Only NSE delisted-workbook discovery semantics changed.

Current discovery no longer trusts the first `.xlsx` URL on the NSE delisting page.

It scans candidates and accepts only a workbook whose URL/anchor context proves actual-delisted company semantics. Proposed-delisting candidates are rejected. If no actual-delisted candidate can be proven, the existing fallback URL is preserved.

## Validation authority

RED evidence SHA-256:

`EA77B3C3270B32535DDD85D6398C7664D9D1B5E87361624DE28E16254CF1FF0E`

GREEN evidence SHA-256:

`BCC45CE85908248EF28EBEECA8E3B6EB8AC0D8284F8C09A30CA817BA4215ED6E`

GREEN:

- focused semantic tests 5/5 PASS;
- NSE delisted regression 7/7 PASS;
- full NSE Identity Rust tests 31/31 PASS;
- offline cargo check PASS.

## ER0 findings after F1-R1

```text
F1  RESOLVED
F2  OPEN / DEFERRED
F3  OPEN / DEFERRED
F4  OPEN
F5  OPEN
ER1 NOT STARTED
```

Do not treat F1-R1 as authorization to implement F2-F5 or ER1.

The original ER0-R1 risk-freeze document remains unchanged as historical audit evidence. This F1-R1 authority supersedes only the current status of F1.
