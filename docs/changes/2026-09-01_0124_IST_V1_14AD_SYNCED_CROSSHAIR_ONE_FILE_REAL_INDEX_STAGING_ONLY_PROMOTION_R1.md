# V1.14AD Synced Crosshair One-File Real-Index Staging-Only Promotion R1

## IST timestamp
2026-09-01 01:24:25.839 IST

## Objective
Promote the already validated syncedCrosshair prerequisite candidate into the real Git index as exactly one staged path, without creating a commit.

## Previous defect or limitation
R5A validated and evidence-reclassified the one-file test-contract correction, and the alternate-index staging preflight proved the exact resulting tree without touching the real index. Real staging remained separately blocked until explicit approval.

## Files changed
- Runtime/source/config bytes: none
- Database: none
- Package/build output: none
- Real Git index: staged exactly src/engine/__tests__/syncedCrosshair.test.ts
- Documentation: docs\changes\2026-09-01_0124_IST_V1_14AD_SYNCED_CROSSHAIR_ONE_FILE_REAL_INDEX_STAGING_ONLY_PROMOTION_R1.md
- External evidence: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_SYNCED_CROSSHAIR_REAL_INDEX_STAGING_ONLY_R1_20260901_012425_839

## Final implementation / Git state
- Parent HEAD: efa30d64d1aa56758dbd35d012502ad92676559d
- Parent tree: 4df9ff9cba0f34d82b092833e41cba2761d994e3
- Staged path count: 1
- Staged path: src/engine/__tests__/syncedCrosshair.test.ts
- Staged blob OID: 25186f05b83b1bf02c8a13eb155f1c93f91ee91b
- Staged tree OID: e82bca95738fedf5858151d38200251274fafaeb
- Pre-stage index SHA-256: E3C5AA0EBED9AE344AEA37817EBEE743C3A77BD4463A8B7ACB0D442D739A1E86
- Post-stage index SHA-256: 99717042080DFD31972C74D3449441F64C9BF273BEEF9B42849A4C0E7D6BA3E4
- Byte-exact pre-stage index backup: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_SYNCED_CROSSHAIR_REAL_INDEX_STAGING_ONLY_R1_20260901_012425_839\real-index-before-staging.bin
- Byte-exact pre-stage index backup SHA-256: E3C5AA0EBED9AE344AEA37817EBEE743C3A77BD4463A8B7ACB0D442D739A1E86
- Commit created: NO
- Commit authorized: NO

## Validation performed and actual results
- Exact HEAD/tree preflight: PASS
- Exact clean pre-stage index SHA-256: PASS
- R5A authority SHA/classification: PASS
- Alternate-index staging authority SHA/tree/path/blob: PASS
- Current candidate blob before staging: PASS
- Real git add -- src/engine/__tests__/syncedCrosshair.test.ts: EXECUTED
- Real staged path count = 1: PASS
- Real index entry mode/blob/stage = 100644 25186f05b83b1bf02c8a13eb155f1c93f91ee91b 0: PASS
- git diff --cached --check: PASS
- git write-tree = e82bca95738fedf5858151d38200251274fafaeb: PASS
- Candidate working-tree bytes unchanged: PASS
- uiStore bytes unchanged: PASS
- Source sentinels unchanged: PASS
- HEAD unchanged: PASS

## Behaviour deliberately preserved
- No runtime behaviour changed by this staging operation.
- src/store/uiStore.ts was not changed or staged.
- No Corporate Action path was staged.
- No database or package command was executed.
- No commit was created.

## Risks / limitations
The real Git index intentionally contains one staged prerequisite test file. Commit remains blocked until the real-index evidence and this documentation correction are reviewed. If the staged state must be abandoned, restore the byte-exact index backup retained at E:\TA Projects\EOD Charting Platform Source Audit\V114AD_SYNCED_CROSSHAIR_REAL_INDEX_STAGING_ONLY_R1_20260901_012425_839\real-index-before-staging.bin only after confirming HEAD is still efa30d64d1aa56758dbd35d012502ad92676559d.

## Rollback guidance
The pre-stage real index was copied byte-for-byte to E:\TA Projects\EOD Charting Platform Source Audit\V114AD_SYNCED_CROSSHAIR_REAL_INDEX_STAGING_ONLY_R1_20260901_012425_839\real-index-before-staging.bin with SHA-256 E3C5AA0EBED9AE344AEA37817EBEE743C3A77BD4463A8B7ACB0D442D739A1E86. The staging runner automatically restored that backup if a staging/evidence gate failed before completion. After successful staging, do not restore it unless the staged promotion is intentionally abandoned and HEAD remains efa30d64d1aa56758dbd35d012502ad92676559d.