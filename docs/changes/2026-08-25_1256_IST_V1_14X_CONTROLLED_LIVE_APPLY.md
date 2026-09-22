# V1.14X Controlled Live Corporate Action Consolidation Apply

**IST timestamp:** 2026-08-25 12:56:53 +05:30 IST

## Objective

Execute the explicitly authorized exact five-pair live Corporate Action consolidation using the V1.14W Apply-plan lock, verified pre-write database-family backup, immediate transaction, and post-write audit.

## Previous defect or limitation

Five historical duplicate import rows remained after ingestion hardening. V1.14W proved the exact evidence-preserving consolidation on a private copy and V1.14X-B implemented the guarded live path without executing it.

## Files changed

- Production source files: none in V1.14X-C.
- Live database: exact five-pair consolidation committed.
- Backup directory created: E:\TA Projects\EOD Charting Platform\backups\corporate-action-v1-14x-prewrite_20260825_125653_162
- Validation evidence created under: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14x-live-apply_20260825_125653_162\reports

## Final implementation

- V1.14W Apply-plan fingerprint: B926042A76323C273C48BFD5A21C60D609F78091EC6B3111EE47DE788EC4CB96
- Pre-state fingerprint: 1094511FFFAA18AA338A1A45EBAB3D2D2641AA68A210069E7CF3FF412D929E7B
- Schema fingerprint: C700F5B8622FFEA89569E6B5AF514A189229E3F338BE46056DC15CF8D6D173D7
- Required and observed post-state fingerprint: 8953723E83FE67351C6463A9D856A4B28C230D7088C22C638A815B44E110967B
- Backup manifest SHA-256: B4458C010DE0E793626580327DE2F72904E736AD0EEB1B11EB9856B40FE2E925
- Compiled maintenance binary SHA-256: BB5D5D09D6E8923E66CBD7E46140C74111C0A421FB115B50712219782242B759
- Transaction mode: TransactionBehavior::Immediate
- Targets deleted: 5
- Evidence rows re-parented: 5
- Evidence rows preserved: 10
- Canonical owners preserved: 5
- Corporate Action 10947 preserved: yes
- Protected scans 1736/4670/5353 preserved: yes

## Validation commands

- cargo build --manifest-path src-tauri-shell\\Cargo.toml
- Direct V1.14X maintenance executable invocation with exact authority, Apply-plan, backup manifest, and authorization token
- Rust post-commit quick_check / foreign_key_check / post-state fingerprint validation
- Independent Python audit against a private post-commit MAIN/WAL copy

## Actual validation results

- Exact source hashes: PASS
- Stage-B GREEN evidence: PASS
- Pre-write live family equals accepted V1.14V family: PASS
- Pre-write MAIN/WAL/SHM backup verification: PASS
- Rust live Apply result: COMMITTED_POST_AUDIT_PASS
- Rust quick_check: ok
- Rust foreign_key_check violations: 0
- Independent private post-audit: PASS
- Final live family quiescent after Apply: PASS

## Risks or limitations

- The existing unrelated V1.7A parallel-test isolation defect remains outside this change.
- The pre-write backup must be retained until the live application is reopened and functional behavior is manually smoke-tested.

## Rollback guidance

- No automatic restore was performed.
- Verified pre-write recovery material is at E:\TA Projects\EOD Charting Platform\backups\corporate-action-v1-14x-prewrite_20260825_125653_162
- See E:\TA Projects\EOD Charting Platform\backups\corporate-action-v1-14x-prewrite_20260825_125653_162\RESTORE-INSTRUCTIONS.txt
- Restore MAIN + WAL as a pair only after an explicit rollback decision; do not restore SHM.
