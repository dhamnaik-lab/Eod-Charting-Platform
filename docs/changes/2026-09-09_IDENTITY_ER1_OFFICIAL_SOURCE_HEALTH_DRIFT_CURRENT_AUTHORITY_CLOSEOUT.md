# Identity ER1 — Official Source Health & Drift Current-Authority Closeout

**Date:** 2026-09-09  
**Project:** `E:\TA Projects\EOD Charting Platform`  
**Status:** ER1 CLOSED / CURRENT AUTHORITY FROZEN

## Objective closed

ER1 adds a read-only Official Source Health capability over the accepted ER0-R1 identity-source authorities without changing Preview/Apply ownership or introducing automatic repair.

Current ER1 scope includes:

- one shared read-only Official Source Health result contract;
- seven NSE logical source assessments;
- four BSE logical source assessments;
- reuse of existing F1-F5 provenance / parser / population protections;
- renderer/Tauri bridge;
- operator `Check Source Health` UI;
- deterministic Source Recovery Brief ER1 appendix;
- Source Health table usability repair;
- Identity Import Info / Recovery export UX repair.

## Final certified authority

Final live certification evidence:

`IDENTITY_ER1_F_FINAL_LIVE_2026-09-09_022544_IST_evidence.zip`

SHA-256:

`874A45338D797E2B7EFD417369460B358FCAFCE1671FB6ABCD7E61148988FF80`

UI postimage SHA-256:

`509FE245FCF37585C0CF32183CDAB8FEB58FB20A6712B2287CF4C82565DA7312`

Portable/release executable SHA-256:

`B9DCBEE881B35174E46A8A76099B7217604CCC91A604B906754FF3AE38072096`

The final live-certification run proved:

- exactly 11 logical source rows exported;
- protected SQLite unchanged;
- managed `reference-data` unchanged;
- 33 guarded ER1/UI authorities unchanged;
- release/portable executable parity;
- no automatic Apply, refresh, URL rewrite, parser adapter, or AI recovery authority.

## Live source-health outcome at closeout

The final live run was **DEGRADED**:

- 8 healthy logical sources;
- 3 needs-attention logical sources.

Needs-attention transport failures:

- `BSE_LIST_SCRIPS_REFERER`
- `BSE_LIST_SCRIPS_ACTIVE`
- `BSE_LIST_SCRIPS_DELISTED`

This is external-source evidence only. It does **not** authorize source replacement, URL rewrite, managed-source refresh, database mutation, or automatic repair.

`BSE_LIST_SCRIPS_SUSPENDED` passed in the same run. All seven NSE logical sources passed.

## Authority boundaries preserved

ER1 closeout does not alter:

- ER0-R1 F1-F5 resolved status;
- NSE/BSE identity parsers;
- population thresholds;
- current/historical Preview semantics;
- reviewed Apply authority;
- database schema or data;
- managed reference-data;
- Official Source URL settings;
- production quote/chart behavior.

## Current status

- ER0-R1 F1-F5: **RESOLVED / CLOSED**
- F2-R1 acquisition: **CLOSED**
- F2-R2 official historical consumption: **CLOSED**
- ER1-A through ER1-F: **CLOSED**
- ER1 Source Health / Drift: **CLOSED / CURRENT**
- Broader post-ER1 identity work: **NOT STARTED**

## Operational note

A `DEGRADED` Source Health result is diagnostic evidence. The operator may use the exported Recovery Brief to investigate a replacement official source, but candidate discovery remains separate from approval and application.

## Next safe housekeeping

Create a fresh verified source snapshot before any unrelated toolchain update or broader identity work.
