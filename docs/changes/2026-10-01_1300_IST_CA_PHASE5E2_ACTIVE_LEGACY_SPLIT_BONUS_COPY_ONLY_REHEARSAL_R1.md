# CA Phase 5E2 — active Legacy Split/Bonus copy-only rehearsal R1

**IST timestamp:** 2026-10-01 13:00:06 IST

## Objective
Rehearse the installed Phase-5E1 active Legacy `prepareCorporateActionPendingImports` gate against isolated copies of the authorized TEST DB/EOD authority with Split/Bonus automatic approval OFF and ON before any live enablement.

## Source authority
- live source remained exact Phase-5E1 FIX1 572-file authority;
- live dist remained exact 30-file authority;
- active Legacy owner remained `src/features/corporateActions/legacy/corporateActionImportOperations.ts` SHA256 `7E3C4EC64FD3D2A24B44579FFEBA72F1831836232868073863D2A898AD301B81`;
- no production source installation or modification occurred.

## Rehearsal authority
Authorized source root: `E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse`.
Excluded root: `D:\TA Projects\EOD Charting Platform DATABASE\EOD DATABASE\Nse`.
Each controlled state was captured separately under writer-excluding raw handles; the live SQLite DB was never opened by the rehearsal. Stable authority contained 7431 DB/EOD files. Raw DB/EOD bytes were excluded from evidence and copy directories were removed.

## OFF state
The real active Legacy preparation function completed with its persisted family gate false. Safe V2 call count was 0; validated Split/Bonus rows remained pending/manual; existing manual Apply language remained available; canonical and Safe-V2 audit counts did not change.

## ON state
The same active Legacy preparation function read true and invoked the real production Safe V2 backend on the isolated copy. First pass: requested=6, eligible=3, autoApproved=2, linkedExisting=1, skipped=3, failed=0. Canonical delta=2 and Safe-V2 decision delta=3.

A second active Legacy preparation pass processed only the three remaining exceptions and produced requested=3, skipped=3, failed=0 with no additional canonical/audit writes. Direct Safe-V2 replay over the original six returned alreadyApproved=3, skipped=3 with zero additional canonical/audit writes.

## Safety reasons preserved
- near-unity discriminator reason contains `k=0.40`;
- G=8 case is rejected because Safe V2 requires evidence within 7 calendar days;
- same-date Dividend peer remains excluded.

## Validation
- current Legacy focused regression: 4 files / 35 tests PASS;
- Phase-5C regression: 6 files / 47 tests PASS;
- isolated active-Legacy OFF integration: 1/1 PASS;
- isolated active-Legacy ON integration + orchestration replay: 1/1 PASS;
- production Rust policy gates: Safe V2 8/8, typed preflight 1/1, Safe V1 11/11, R1-B4 4/4, Phase-5A lock 3/3 PASS;
- live TEST DB/EOD authority pre=post exact; live source/dist exact.

## Behaviour preserved
Live Split/Bonus setting unchanged/default OFF; live DB writes=0; production approvals=0; RootApp unchanged; Safe V2 backend unchanged; manual Apply preserved; `PENDING_ISIN_MISMATCH`, Quick Resolve, R1-B4 and Phase-5A lock preserved. Git=0 / network=0.

## Risks / limitations
This is a controlled copy-only integration rehearsal. It does not authorize a live family-setting change and does not constitute a live production approval run.

## Rollback
No product source or live database rollback is required because product/source changes=0 and live DB/settings remained byte-identical. Remove this documentation record if the Phase-5E2 acceptance itself must be withdrawn.

## Next step
Stop before live enablement. Any change of `corporate_actions.auto_approval.split_bonus.enabled` in the live TEST DB requires a new explicit authorization.
