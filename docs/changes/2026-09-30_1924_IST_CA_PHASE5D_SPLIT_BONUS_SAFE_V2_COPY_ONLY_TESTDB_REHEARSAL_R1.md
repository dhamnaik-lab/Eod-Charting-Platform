# CA Phase 5D Split/Bonus Safe V2 copy-only TEST-DB rehearsal R1

**IST timestamp:** 2026-09-30 19:24:28 IST

## Objective
Rehearse the accepted Normal Workflow Split/Bonus Safe V2 family against an isolated raw copy of the authorized TEST DB/EOD authority before any live family enablement.

## Source authority
- live source remained exact Phase-5C 572-file authority;
- live dist remained exact 30-file authority;
- Phase-5B Rust owners remained byte-identical to accepted Safe V2 evidence;
- no live source installation or modification occurred.

## Rehearsal copy
Authorized source root: `E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse`.
Excluded root: `D:\TA Projects\EOD Charting Platform DATABASE\EOD DATABASE\Nse`.
Stable-copy authority contained 7431 DB/EOD files. DB/EOD bytes were excluded from the evidence ZIP and the isolated copy was deleted after rehearsal.

## Normal Workflow gate
The exact Phase-5C focused frontend suite passed 6 files / 47 tests, including default-OFF setting, ON scoping, backend reason propagation, stale-cycle protection, exception-only Review and manual Approval preservation.

## Safe V2 policy probes
Existing production tests passed: Phase5B Safe V2 8/8, typed preflight 1/1, Safe-V1 regression 11/11, R1-B4 4/4, Phase5A lock 3/3. These freeze near-unity k=0.40, G=7, cross-action exclusion and preserved safety contracts.

## Copy-only deterministic cases
- eligible split -> new canonical;
- eligible bonus -> linked existing canonical;
- eligible split at exactly G=7;
- near-unity Bonus 1:20 no-move -> SKIPPED with backend reason;
- G=8 split -> SKIPPED with backend reason;
- same-date Split + Dividend peer -> SKIPPED with backend reason.

First pass: requested=6, eligible=3, autoApproved=2, linkedExisting=1, skipped=3, failed=0, canonicalDelta=2, SafeV2DecisionDelta=3.

Replay: requested=6, alreadyApproved=3, skipped=3, failed=0; canonical and Safe-V2 audit counts remained unchanged.

## Behaviour preserved
Split/Bonus live family setting remains default OFF. Live DB writes=0; live setting changes=0; live approvals=0; raw live EOD unchanged; Phase5A lock / Phase5B Safe V2 / R1-B4 / PENDING_ISIN_MISMATCH / Quick Resolve / AUTO-ID1 remain preserved.

## Boundaries
Source changes=0 / live DB writes=0 / live family enablement=0 / Git=0 / network=0. Stop before live enablement.

## Next step
Phase 5D copy-only rehearsal is accepted only if evidence closes with all gates PASS. Any live Split/Bonus enablement requires separate explicit authorization.
