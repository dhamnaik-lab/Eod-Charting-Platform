# CA Phase 5E1 FIX1 — active Legacy Split/Bonus enablement gate R1

**IST timestamp:** 2026-09-30 23:34:09 IST

## Objective
Make the existing persisted default-OFF Split/Bonus family setting the actual gate on the active Legacy `prepareCorporateActionPendingImports` auto-approval call.

## Previous limitation
The active Legacy Prepare path called `autoApproveCorporateActionImports` for validated Split/Bonus rows independently of `corporate_actions.auto_approval.split_bonus.enabled`. The Phase-5C Normal Workflow setting therefore did not control the currently routed Legacy Prepare path.

## Files changed
- `src/features/corporateActions/legacy/corporateActionImportOperations.ts`
- `src/features/corporateActions/__tests__/corporateActionPendingPreparation.test.ts`
- `src/features/corporateActions/__tests__/corporateActionOfficialImportsFix2.test.ts`

## Final implementation
Legacy Prepare reads the existing Split/Bonus setting only when there is a validated auto-approval scope. FIX1 keeps that read-only contract narrow: it calls `getSetting` directly with the shared setting key and passes the value through the shared fail-closed parser; no `setSetting` capability is added. Missing/false/unrecognized values are OFF. Setting read errors fail closed to OFF without blocking existing manual Apply. A stale request after the setting read stops before Safe V2 execution. Only explicit `true` permits the existing Safe V2 backend call.

## Behaviour preserved
RootApp routing unchanged; Safe V2 backend unchanged; Phase-5A lock unchanged; Quick Resolve and scan behavior unchanged; manual Apply preserved; `PENDING_ISIN_MISMATCH`, R1-B4 and Phase-5C Normal Workflow behavior preserved. No DB access/write, approval, live setting write, Git, network or app launch occurred.

## Validation
- candidate Legacy focused: 4 files / 35 tests PASS;
- candidate Phase-5C regression: 6 files / 47 tests PASS;
- candidate TypeScript and Vite PASS;
- post-install Legacy focused + Phase-5C regression + TypeScript + Vite PASS;
- complete post-install source authority: 572/572 exact.

## Backup / rollback
Pre-edit backup: `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260930_232952_CA_PHASE5E1_ACTIVE_LEGACY_SB_GATE`. Roll back the three files above from that backup if this bounded gate must be reverted.

## Authority
Post-install Legacy owner SHA256: `7E3C4EC64FD3D2A24B44579FFEBA72F1831836232868073863D2A898AD301B81`.

## Next step
Do not change the live Split/Bonus setting yet. Rehearse the **actual active Legacy Prepare orchestration** on an isolated TEST-DB copy with the gate OFF and ON before any live enablement.
