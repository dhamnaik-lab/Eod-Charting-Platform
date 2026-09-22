# Identity Recovery & AI Handoff Export — New-Chat Handoff

**Status:** CURRENT HANDOFF / R1 ACCEPTED  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Current workflow

```text
Corporate Actions / Identity
→ Identity Import
→ ?
→ Identity Import Info
→ Recovery & AI Handoff
```

Exports:

```text
Export Source Recovery Brief
Export Identity Investigation Brief
Export Recovery Guide
```

Use **Source Recovery Brief** when an official NSE/BSE URL stops working.

## Current authority

- `DatabaseToolsDialogs.tsx` — `F3886CE568B2726CDA93472B995A8643287C2B32FBC8422015093F7C1BFC681A`
- `identityRecoveryDocuments.ts` — `F80BABCF1C9FAEC01AE9F76A9B18EE333D526EDE1A5C72F53E16E0BBA88A3CE6`
- `rawMarkdown.d.ts` — `BB3FE833B4113BBD30109A6E752627BCD088945B7F1D0650E323998141193722`
- Source Recovery Brief — `06D7F5574D9B9D288AFB3DC89D34DCCAD3107E6AFDFEA78E67621BA3AAA3932F`
- Identity Investigation Brief — `98DC99958285507DAF155E20B2190648F3CC5F26FC14E672E2390A5E1CB0BD03`
- Recovery Guide — `1C236AFE396C78F7559AAEBFC91E8D2E17B7E024EA5BF17DC4846F9F19CF27D1`
- focused export test — `74CDFE50D5D00887B2AAF2220EA508E78B83CD6790BAC38D0030EA1B3C04197C`

## Automated evidence

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_RECOVERY_AI_HANDOFF_EXPORT_R1_2026-09-06_173411_IST_evidence.zip`

SHA-256:

`B339D066DB0BDE36F26FA840FA73896896A377CDBF5AE6B5E0FE2E3475B88163`

## Portable authority

Portable SHA-256:

`1B10964A6405843AA3DD29164D7FD25A3B5D8887EEFF76D10C0835BDA3406A87`

Manual UI/export acceptance was completed against this rebuilt portable.

## Boundaries

This feature performs no:

- database read/write for export;
- web browsing;
- AI API call;
- automatic source replacement;
- direct Identity Apply;
- new Rust command;
- I3/I4 bypass.

External research produces candidates only. Existing reviewed Preview/Apply remains the write boundary.

Future ER0+ work remains separately documented and separately approved.
