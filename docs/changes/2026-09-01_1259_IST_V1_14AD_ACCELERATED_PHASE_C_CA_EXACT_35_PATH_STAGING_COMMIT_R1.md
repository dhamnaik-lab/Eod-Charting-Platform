# V1.14AD Accelerated Phase C — Exact 35-Path CA Staging + Commit R1

## IST timestamp
2026-09-01 12:59:19.654
 IST

## Objective
Promote the exact Phase B R1C-validated 35-path Corporate Action tree into the real Git index and create one verified commit using compare-and-swap branch promotion.

## Previous defect or limitation
Phase B R1C validated exact combined tree 6bc7dd2b393b3baf78ff97539c9eb7b8c8f42c77 with all 15 frontend/Rust/Cargo/Tauri gates passing while real CA staging and commit remained blocked pending this transaction.

## Files changed
- Commit source paths: exactly 35 Corporate Action authority paths from the Phase B matrix.
- Working source bytes modified by this transaction: none.
- Database modified: none.
- Package/build executed: none.
- Documentation created: docs\changes\2026-09-01_1259_IST_V1_14AD_ACCELERATED_PHASE_C_CA_EXACT_35_PATH_STAGING_COMMIT_R1.md

## Final implementation
- Parent HEAD: 24f198553e5ad5fcce46395e067628d44ded9c00
- Validated combined tree: 6bc7dd2b393b3baf78ff97539c9eb7b8c8f42c77
- New commit: 2103e9ffcaaad28bd903c9cb71310316c68f2ffd
- Changed path count: 35
- Pre-stage index SHA-256: 99717042080DFD31972C74D3449441F64C9BF273BEEF9B42849A4C0E7D6BA3E4
- Post-stage/post-commit index SHA-256: 56E103DBBE2B24FFC4EAAA14870BE246D67A8ED3904F8DC0AD14305F1C446FA7
- Phase B R1C evidence ZIP SHA-256: 1FB3A2FAE4C2ABCEB49DE5130DB5146CA48D5EADC6064CD8C6E8A87696C4FCCE
- Commit title: feat: integrate validated V1.14AD corporate actions
- Commit body: Promote the exact validated 35-path Corporate Action candidate after accelerated Phase B R1C completed all 15 validation gates.

## Validation commands / actual results
- Phase B R1C evidence classification + 15/15 command authority: PASS
- Exact 35-path matrix/path set: PASS
- Durable R4 payload -> exact 35 blob OIDs: PASS
- Real staged path count 35: PASS
- Real staged mode/blob/stage entries: PASS
- git diff --cached --check: PASS
- git write-tree = 6bc7dd2b393b3baf78ff97539c9eb7b8c8f42c77: PASS
- Commit object tree/parent/path/blob/message verification before branch move: PASS
- Compare-and-swap update-ref: PASS
- Index clean relative new HEAD: PASS
- Working 35-path bytes/uiStore/syncedCrosshair/sentinels preserved: PASS
- Guarded live NSE DB family unchanged: PASS

## Behaviour deliberately preserved
No out-of-scope working-tree changes were staged or committed. The pre-existing working uiStore difference remains outside the commit. No database write or packaging operation was performed.

## Risks or limitations
This commit promotes only the already validated Phase B tree. Portable packaging and manual runtime smoke remain Phase D/E work.

## Rollback guidance
Before later work, the branch can be moved from 2103e9ffcaaad28bd903c9cb71310316c68f2ffd back to 24f198553e5ad5fcce46395e067628d44ded9c00 and the byte-exact pre-transaction index backup restored from E:\TA Projects\EOD Charting Platform Source Audit\V114AD_ACCELERATED_PHASE_C_CA_EXACT_35_PATH_STAGING_COMMIT_R1_20260901_125919_654\real-index-before-phase-c.bin. This runner automatically performs that rollback if any gate fails before successful completion.
