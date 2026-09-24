# Corporate Action Auto-Approval R1 — Operational / Manual Closed Current Authority

**Authority date:** 23 September 2026 (IST)
**Workstream:** EOD Charting Platform
**Authorized root:** `E:\TA Projects\EOD Charting Platform`

## Status

**CA Auto-Approval R1 = CLOSED / CURRENT for the approved operational scope.**

This document is the additive current-status authority after successful source/runtime acceptance, finalized standard-portable publication, and the separately gated standard-portable manual TEST-DB acceptance.

It does not rewrite or invalidate the earlier FIX6 source/runtime closeout. It closes the remaining manual/operational acceptance gate.

## Approved functional scope

The closed/current Auto-Approval authority remains exactly:

- exchange: **NSE only**;
- action types: **Split + Bonus only**;
- matching threshold: **STRONG MATCH >= 0.95**;
- identity requirement: **machine-proven identity only**;
- policy/audit marker: **`AUTO_APPROVAL_SAFE_V1`**;
- approval mutation: existing Corporate Action approval writer reused;
- existing manual approval workflow preserved.

The following are **not** authorized by this closeout and remain separately gated:

- Dividend auto-approval;
- Rights auto-approval;
- BSE auto-approval;
- compound-action auto-approval;
- manual-resolution provenance as auto-approval proof;
- ISIN-mismatch exception approval as auto-approval proof;
- price-validation exception approval as auto-approval proof;
- any broader exceptional approval path.

## Current accepted source/runtime authority

The accepted implementation authority remains the FIX6 source/runtime closeout and finalized source state:

- live source files: **561**;
- protected source files: **555**;
- production source preserved through final portable finalization and manual acceptance;
- AUTO-ID1 remains **CLOSED / CURRENT**;
- 20MICRONS historical-ISIN transition authority remains **CLOSED / CURRENT**;
- `PENDING_ISIN_MISMATCH` boundary remains preserved;
- existing manual approval remains preserved;
- raw-price adjustment-on-read behavior remains preserved.

Prerequisite FIX6 documents remain unchanged:

- `docs\changes\2026-09-22_1917_IST_CA_AUTO_APPROVAL_R1_FIX6_POST_RECOVERY_FINAL_CLOSEOUT.md`
- `docs\superpowers\specs\2026-09-22-corporate-action-auto-approval-r1-final-closeout-current-authority.md`
- `docs\superpowers\specs\2026-09-22-corporate-action-new-chat-handoff-after-auto-approval-r1.md`

## Finalized standard portable authority

Accepted standard Windows portable:

- path: `E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- build: **`20260923.001421`**
- EXE SHA-256: **`238A6FFD41052F8E9DA6AF129118CB24EF42909F0B1809B8EB9423943DA74DFC`**
- pristine portable ZIP SHA-256: **`3472C57D3A993080748BE22B6CBE7333CD4C57574C9094D365A4B079473A91C2`**

Finalization evidence:

- `E:\TA Projects\EOD Charting Platform\tmp\EOD_STANDARD_PORTABLE_FINALIZATION_R1_FIX4_2026-09-22_235906_IST_1bdcae56_evidence.zip`
- SHA-256: **`4AEC853093DF59797ADD89BCF28124144291D95B55F9E0D7E6E7855AE208396A`**

Finalization publication authority recorded by that accepted evidence:

- commit: **`25b186587f416ba7c3ea556c1ddda433239e8f1d`**;
- remote main: **`25b186587f416ba7c3ea556c1ddda433239e8f1d`**;
- tree: **`f5023368a7df907f7e1bab79e9610558d2077332`**;
- final Git status: clean.

This operational closeout performs **no Git action** and does not create a later Git authority.

## Snapshot V3 authority

Current self-contained Snapshot V3 remains:

- `E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-09-23_113448_IST.zip`
- SHA-256: **`819F1DFA39B22F960455520A0EA6CF2CE6D632B663C6B4009B33F6CA64591EA7`**
- copied files: **1381 / 1381**;
- missing: **0**;
- unexpected: **0**;
- hash mismatches: **0**;
- protected source: **555**.

This documentation-only closeout does not create a replacement snapshot.

## Accepted standard-portable manual TEST-DB evidence

Authorized TEST database:

`E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse`

Excluded operational database:

`D:\TA Projects\EOD Charting Platform DATABASE\EOD DATABASE\Nse`

Accepted manual evidence:

- `E:\TA Projects\EOD Charting Platform\tmp\CA_AUTO_APPROVAL_STANDARD_PORTABLE_MANUAL_FIX1_2026-09-23_130610_IST_evidence.zip`
- SHA-256: **`5B83B332EFD0BF9DBBE50DC23579B836C30C449345098D36AEA29DFDC6C402D8`**
- PRE DB-family backup SHA-256: **`CC2CE0FCBD11F334A8A2D20D4EF37382523E09354AB2AE8C908F71ED0289C1AE`**

The manual checkpoint proved:

- finalized build `20260923.001421` was the executable under test;
- the authorized E: NSE TEST database was used;
- `Load & Prepare` was run exactly once;
- completion explicitly contained **`Auto-Approval Safe V1`**;
- idempotent result `approved/linked 0` was accepted because FIX6 had already committed the six eligible outcomes;
- Fetch was not used;
- Apply Selected / Apply All Ready were not used;
- no exception approval or manual resolution was used;
- the application closed normally before POST verification.

## Six accepted current mappings

The accepted current mapping authority is:

| Import ID | Symbol | Action | Canonical corporate_action ID |
|---:|---|---|---:|
| 12685 | KSB | BONUS | 451 |
| 16093 | BBOX | BONUS | 414 |
| 22969 | NAVA | BONUS | 335 |
| 24025 | GAYAPROJ | SPLIT | 11417 |
| 36026 | SOTL | BONUS | 11419 |
| 42274 | PARSVNATH | SPLIT | 11418 |

The final manual evidence records **6 `AUTO_APPROVAL_SAFE_V1` audit rows** and **0 forbidden target decisions**.

The previously observed SOTL/PARSVNATH swapped expectation belonged only to an external manual-acceptance harness. The retained TEST-DB evidence established the current canonical mappings above; production data did not require repair for that harness defect.

## PRE / POST preservation from the manual acceptance

POST verification proved:

- complete source authority preserved: **561 source files**;
- protected source authority preserved: **555 files**;
- certified portable files preserved exactly;
- complete binary EOD tree preserved exactly;
- SQLite schema preserved;
- protected CA/identity semantic tables preserved PRE/POST;
- six target import rows preserved;
- six target decision histories preserved;
- forbidden target decisions: **0**;
- runner live-SQLite opens: **0**;
- runner Git actions: **0**;
- runner network actions: **0**;
- automatic DB restore: **not performed / not required**.

`corporate_action_scan_results` changed from **11,360** to **11,466** rows during the one authorized `Load & Prepare`; this is accepted scan-metadata refresh and is outside the protected semantic-table equality set.

## Operational conclusion

The full approved Auto-Approval R1 chain is now closed:

1. Design R1 — accepted.
2. Source implementation — accepted.
3. Automated TDD/regressions — accepted.
4. Controlled real TEST-DB source/runtime acceptance — accepted.
5. Standard Windows portable refresh/finalization — accepted.
6. Finalized standard-portable manual TEST-DB acceptance — accepted.
7. **Operational/manual closeout — CLOSED / CURRENT by this authority.**

No repeat `Load & Prepare`, source implementation, build, portable refresh, Snapshot, Git publication, or DB mutation is required for this closeout.

## Next-gate rule

Any further Corporate Action automation must start as a new bounded task and must not silently inherit authority beyond the closed R1 scope. In particular, Dividend, Rights, BSE, compound actions, and exceptional approval paths require separate design/validation/acceptance authority.
