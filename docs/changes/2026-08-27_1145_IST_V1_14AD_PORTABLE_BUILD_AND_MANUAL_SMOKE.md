# V1.14AD Portable Build and Manual Smoke

**IST timestamp:** 2026-08-27 11:45:32 +05:30

## Objective
Finalize the accepted V1.14AD Windows portable build evidence and stage isolated manual acceptance.

## Previous defect or limitation
C1-R3 passed automated validation and built the release, then failed because manual-smoke staging incorrectly treated the V1.14AB 316-symbol replay subset as a universal EOD catalog and required BHARATRAS to be present.

## Files changed
- Portable output was restaged only if the C1-R3 failure rollback had restored an older portable.
- A private manual-smoke database/EOD folder was created under tmp.
- This change report was created.
- Production source, persistent tests, package configuration, and live SQLite were not modified.

## Final recovery
- Reused C1-R3 successful validation/build logs; no Vitest, TypeScript, Cargo, renderer build, or Tauri build rerun.
- Target/portable EXE SHA-256: 9FCFD6D2C4FFE21946659537943A921F73250597740CE9087AD5DBE597ECA07A
- Portable restaged by R4: True
- Repaired cases use exact AB EOD authority.
- BHARATRAS/FCL use read-only filesystem copies from the live binary EOD store.

## Actual validation results
- npm test: PASS 110 files / 632 tests.
- renderer typecheck: PASS.
- V1.14AD Rust: PASS 4/4.
- genuine compound Rust: PASS 4/4.
- Phase 5B: PASS 5/5.
- price gate: PASS 2/2.
- cargo check: PASS.
- renderer release: PASS 742 modules.
- Tauri release build: PASS.
- live MAIN/WAL/SHM unchanged across R4: PASS.
- source/test/package hashes unchanged: PASS.

## Genuine compound control EOD hashes
- BHARATRAS: BBFA115CEE2B42E14ED1A403666BD9D12DE2D5348A5E2CC1BEF034DBAC696BF8
- FCL: 3E87EB895D204AEDC897DF672C8ECC0317A7B8CA6BFAD8AD3D01DBB556F18FD9

## Manual validation status
PENDING.
Private database: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ad-c1-r7-manual-smoke-recovery_20260827_114532_430\manual-smoke-private
Checklist: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ad-c1-r7-manual-smoke-recovery_20260827_114532_430\reports\17-MANUAL-SMOKE-CHECKLIST.txt

## Risks or limitations
- Manual UI acceptance is pending.
- Price Check may mutate only the private manual-smoke copy.
- Existing live scan rows are not rewritten by R4.

## Rollback guidance
If R4 restaged the portable and it is rejected, prior portable backup (when created): E:\TA Projects\EOD Charting Platform\backups\portable-pre-v114ad-c1-r7-recovery_20260827_114532_430
No source/test rollback is required.
