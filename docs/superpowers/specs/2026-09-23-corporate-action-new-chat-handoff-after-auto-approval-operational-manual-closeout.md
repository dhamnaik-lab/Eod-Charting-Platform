# Corporate Action New-Chat Handoff — After Auto-Approval R1 Operational / Manual Closeout

**Date:** 23 September 2026 (IST)
**Repository:** `E:\TA Projects\EOD Charting Platform`

## Read this first

Current Auto-Approval authority:

`docs\superpowers\specs\2026-09-23-corporate-action-auto-approval-r1-operational-manual-closed-current-authority.md`

## Current state

**CA Auto-Approval R1 is CLOSED / CURRENT for NSE Split + Bonus only.**

Accepted standard portable:

- build: `20260923.001421`
- EXE SHA-256: `238A6FFD41052F8E9DA6AF129118CB24EF42909F0B1809B8EB9423943DA74DFC`

Accepted manual TEST-DB evidence:

- SHA-256: `5B83B332EFD0BF9DBBE50DC23579B836C30C449345098D36AEA29DFDC6C402D8`
- authorized DB: `E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse`
- one `Load & Prepare`: PASS
- `Auto-Approval Safe V1`: confirmed
- new approvals on idempotent replay: `0`
- six prior accepted mappings: preserved
- `AUTO_APPROVAL_SAFE_V1` audit rows: `6`
- forbidden target decisions: `0`
- protected semantic PRE/POST: exact
- binary EOD PRE/POST: exact
- source: `561`, protected source: `555`

Current six mappings:

- `12685 -> 451` KSB BONUS
- `16093 -> 414` BBOX BONUS
- `22969 -> 335` NAVA BONUS
- `24025 -> 11417` GAYAPROJ SPLIT
- `36026 -> 11419` SOTL BONUS
- `42274 -> 11418` PARSVNATH SPLIT

Finalized source/package authority remains:

- Snapshot V3: `Eod Charting Platform Source Code 2026-09-23_113448_IST.zip`
- Snapshot SHA-256: `819F1DFA39B22F960455520A0EA6CF2CE6D632B663C6B4009B33F6CA64591EA7`
- Git commit/remote-main authority recorded by finalization evidence: `25b186587f416ba7c3ea556c1ddda433239e8f1d`

## Preserve

Do not change or bypass without a separately authorized task:

- `AUTO_APPROVAL_SAFE_V1` NSE Split/Bonus-only boundary;
- STRONG MATCH >= 0.95 requirement;
- machine-proven identity requirement;
- manual approval workflow;
- `PENDING_ISIN_MISMATCH` boundary;
- AUTO-ID1 closed/current authority;
- 20MICRONS transition closed/current authority;
- raw-price adjustment-on-read behavior.

## Still deferred / not authorized

- Dividend auto-approval;
- Rights auto-approval;
- BSE auto-approval;
- compound-action auto-approval;
- manual/ISIN/price exception provenance for auto-approval;
- any generalized exceptional approval path.

## Important historical note

A manual-acceptance harness once carried stale swapped expectations for SOTL and PARSVNATH. The accepted current authority is **SOTL 36026 -> 11419** and **PARSVNATH 42274 -> 11418**. That incident was a harness defect, not an authorization to alter production mappings.

## Next task

Start only one newly authorized bounded Corporate Action problem at a time. Do not rerun the closed Auto-Approval R1 acceptance unless a later regression or explicit re-certification task requires it.
