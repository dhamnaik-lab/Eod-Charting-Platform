# V1.14AD Controlled Cleanup Inventory R1

## IST timestamp
2026-08-31 15:38:27.036 IST

## Objective
Inventory project tmp and Source Audit top-level contents before any cleanup, classify every item as KEEP, DELETE_CANDIDATE, or REVIEW_REQUIRED, and quantify potential disk reclamation while preserving the real Git index, source authority, R1F authority, and alternate-index preflight authority.

## Previous defect or limitation
Several disposable validation generations produced large cargo-target/worktree/evidence directories. Earlier cleanup was intentionally deferred until the prerequisite parent candidate and alternate-index staging preflight reached stable accepted checkpoints. Deleting tmp or Source Audit wholesale is unsafe because both locations can contain durable audit evidence.

## Files changed
- This Markdown report only inside the project: docs\changes\2026-08-31_1538_IST_V1_14AD_CONTROLLED_CLEANUP_INVENTORY_R1.md
- External inventory reports under: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_CONTROLLED_CLEANUP_INVENTORY_R1_20260831_153827_036
- No source/config file edited.
- No real Git index entry changed.
- No cleanup target deleted or moved.

## Final implementation
- Verified exact HEAD: f4278bc62649552f119fa6438b688a10dccef25e.
- Verified real Git index SHA-256 before inventory: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A.
- Verified current source sentinels.
- Verified R1F reports ZIP SHA-256: 41827C7C7BAC9495077FBB0F1D87CB23CC81AFE4A05668ABA61ECE00B05701C3.
- Verified alternate-index preflight reports ZIP SHA-256: B89BFA5E37050CE5C3E8306740935914743C6407A9553D7318D947FCF31009AD.
- Preserved proposed prerequisite-parent tree OID: 4df9ff9cba0f34d82b092833e41cba2761d994e3.
- Inventoried top-level items under project tmp and Source Audit before creating this inventory audit directory.
- Measured recursive file counts, directory counts, reparse points, and bytes without traversing directory reparse points.
- Classified all inventoried items using conservative explicit rules.
- No deletion was performed.

## Inventory results
- Total top-level items: 294
- KEEP: 5 items / 0.012 GiB
- DELETE_CANDIDATE: 7 items / 3.753 GiB
- REVIEW_REQUIRED: 282 items / 19.456 GiB
- Total inventoried bytes: 23.221 GiB
- Potential reclaimable bytes from DELETE_CANDIDATE only: 4030281119

## Largest DELETE_CANDIDATE preview
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_PREREQUISITE_NON_CA_PARENT_BASELINE_EVIDENCE_CAPTURE_R1_20260831_102902_197 — 2.33 GiB — Known superseded/failed disposable V1.14AD audit generation; deletion requires Stage 2 authorization.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_PREREQUISITE_NON_CA_MINIMAL_PARENT_CANDIDATE_R1C_20260831_124746_375 — 0.285 GiB — Known superseded/failed disposable V1.14AD audit generation; deletion requires Stage 2 authorization.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_PREREQUISITE_NON_CA_MINIMAL_PARENT_CANDIDATE_R1E_20260831_141437_344 — 0.285 GiB — Known superseded/failed disposable V1.14AD audit generation; deletion requires Stage 2 authorization.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_PREREQUISITE_NON_CA_MINIMAL_PARENT_CANDIDATE_R1B_20260831_121255_882 — 0.285 GiB — Known superseded/failed disposable V1.14AD audit generation; deletion requires Stage 2 authorization.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_PREREQUISITE_NON_CA_MINIMAL_PARENT_CANDIDATE_R1A_20260831_120346_658 — 0.285 GiB — Known superseded/failed disposable V1.14AD audit generation; deletion requires Stage 2 authorization.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_PREREQUISITE_NON_CA_MINIMAL_PARENT_CANDIDATE_R1_20260831_113417_790 — 0.285 GiB — Known superseded/failed disposable V1.14AD audit generation; deletion requires Stage 2 authorization.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_PREREQUISITE_NON_CA_MINIMAL_PARENT_CANDIDATE_R1D_20260831_134647_642 — 0 GiB — Known superseded/failed disposable V1.14AD audit generation; deletion requires Stage 2 authorization.

## Largest REVIEW_REQUIRED preview
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_LATEST_INTEGRATION_R1A_20260830_140903_183 — 3.83 GiB — Not part of the narrowly approved cleanup rules; preserve until reviewed.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_CT_R4_20260830_013853_716 — 3.313 GiB — Not part of the narrowly approved cleanup rules; preserve until reviewed.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_CT_20260829_192854_718 — 2.264 GiB — Not part of the narrowly approved cleanup rules; preserve until reviewed.
- E:\TA Projects\EOD Charting Platform\tmp\v1-14ad-cumulative-baseline-assembly-preflight_20260829_131004_393 — 0.57 GiB — Project tmp item is not automatically disposable; inspect before deletion.
- E:\TA Projects\EOD Charting Platform Source Audit\V1.14AD_Cumulative_Baseline_Assembly_Preflight_R1_20260829_132927_835 — 0.57 GiB — Not part of the narrowly approved cleanup rules; preserve until reviewed.
- E:\TA Projects\EOD Charting Platform Source Audit\V1.14AD_Cumulative_Baseline_Assembly_Preflight_R2_20260829_134808_791 — 0.569 GiB — Not part of the narrowly approved cleanup rules; preserve until reviewed.
- E:\TA Projects\EOD Charting Platform Source Audit\V1.14AD_Cumulative_Baseline_Assembly_Preflight_R3_20260829_141708_934 — 0.569 GiB — Not part of the narrowly approved cleanup rules; preserve until reviewed.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_CT_R3_20260830_005315_532 — 0.432 GiB — Not part of the narrowly approved cleanup rules; preserve until reviewed.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_CT_R2_20260830_001525_431 — 0.431 GiB — Not part of the narrowly approved cleanup rules; preserve until reviewed.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_CT_R1_20260829_230124_137 — 0.431 GiB — Not part of the narrowly approved cleanup rules; preserve until reviewed.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_CA_STAGING_PREFLIGHT_R1A_R1_20260830_223940_277 — 0.286 GiB — Not part of the narrowly approved cleanup rules; preserve until reviewed.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_R1B_R1_WATCHLIST_TIMEOUT_20260830_190238_060 — 0.165 GiB — Not part of the narrowly approved cleanup rules; preserve until reviewed.
- E:\TA Projects\EOD Charting Platform Source Audit\V114AD_LATEST_INTEGRATION_R1_20260830_132637_722 — 0.165 GiB — Not part of the narrowly approved cleanup rules; preserve until reviewed.
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ad-c2-r2-targeted-provenance_20260828_095250_094 — 0.162 GiB — Project tmp item is not automatically disposable; inspect before deletion.
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ad-c2-r2-r1-corrected-provenance_20260828_101325_656 — 0.161 GiB — Project tmp item is not automatically disposable; inspect before deletion.
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ad-c2-r1-live-drift-forensic_20260828_022659_124 — 0.16 GiB — Project tmp item is not automatically disposable; inspect before deletion.
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14f-3-post-audit_20260823_193822_540 — 0.16 GiB — Project tmp item is not automatically disposable; inspect before deletion.
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-13c-1-2-1-post-audit_20260819_003421_289 — 0.159 GiB — Project tmp item is not automatically disposable; inspect before deletion.
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-13c-1-2-post-audit_20260819_001653_901 — 0.159 GiB — Project tmp item is not automatically disposable; inspect before deletion.
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ab-b-current-validator-replay_20260826_142433_688 — 0.147 GiB — Project tmp item is not automatically disposable; inspect before deletion.
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14b-event-time-identity_20260819_012118_954 — 0.112 GiB — Project tmp item is not automatically disposable; inspect before deletion.
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-backward-normalization-audit_20260820_003039_347 — 0.092 GiB — Project tmp item is not automatically disposable; inspect before deletion.
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14g-rebaseline_20260823_223743_891 — 0.088 GiB — Project tmp item is not automatically disposable; inspect before deletion.
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14o-official-symbol-provenance_20260824_144512_161 — 0.087 GiB — Project tmp item is not automatically disposable; inspect before deletion.
- E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-12-pass1_20260818_004434 — 0.086 GiB — Project tmp item is not automatically disposable; inspect before deletion.

## Validation commands / checks
- git rev-parse --show-toplevel
- git rev-parse HEAD
- git diff --cached --name-only --
- SHA-256 of the real Git index before/after inventory
- SHA-256 of current source sentinels
- SHA-256 of R1F reports authority ZIP
- SHA-256 of alternate-index preflight reports authority ZIP
- Recursive read-only filesystem size/file-count inventory

## Actual validation results
- HEAD unchanged: PASS
- Real Git index clean before/after: PASS
- Real Git index SHA-256 before: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Real Git index SHA-256 after: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Current source sentinels unchanged: PASS
- Deletion performed: NO
- Classification: STAGE_1_INVENTORY_ONLY__NO_DELETION_PERFORMED
- Stage 2 deletion authorization: BLOCKED

## Risks or limitations
- DELETE_CANDIDATE is a recommendation for Stage 2 review, not authorization to delete.
- REVIEW_REQUIRED items are intentionally preserved until their role is understood.
- Directory content hashes are not calculated; directories are represented by path, counts, bytes, timestamps, and reparse/error metadata. Top-level files up to 268435456 bytes are SHA-256 hashed.
- Reparse-point directories are counted but not traversed to prevent accidental traversal outside the intended roots.

## Rollback guidance
No cleanup rollback is required because this stage deletes nothing. If this inventory evidence itself is discarded, remove its external audit directory and this Markdown report only after a later continuity decision explicitly authorizes that removal.
