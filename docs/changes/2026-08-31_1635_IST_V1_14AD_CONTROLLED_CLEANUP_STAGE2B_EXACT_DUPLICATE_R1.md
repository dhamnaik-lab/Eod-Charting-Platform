# V1.14AD Controlled Cleanup Stage-2B Exact Duplicate R1

## IST timestamp
2026-08-31 16:35:30.273 IST

## Objective
Delete only the directory side of the 34 Stage-1B content-proven directory/ZIP duplicates while retaining every paired ZIP, all 248 unresolved/preserve items, all accepted KEEP authorities, project source, HEAD, and the real Git index.

## Previous defect or limitation
Stage-1B analyzed all 282 REVIEW_REQUIRED items and proved 34 directory/ZIP pairs were exact content duplicates by relative file path, file size, and SHA-256. It deliberately did not authorize deletion. Stage-2B is limited to those exact 34 directory-side candidates; supersession families, mismatches, skipped pairs, and unresolved items remain outside deletion scope.

## Files changed
- Deleted only successfully processed Stage-1B EXACT_DIRECTORY_ZIP_DUPLICATE directory candidates listed below.
- Retained every paired ZIP.
- Created this Markdown report: docs\changes\2026-08-31_1635_IST_V1_14AD_CONTROLLED_CLEANUP_STAGE2B_EXACT_DUPLICATE_R1.md
- Created external Stage-2B evidence under: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_CONTROLLED_CLEANUP_STAGE2B_EXACT_DUPLICATE_R1_20260831_163530_273
- No source/config file edited.
- No Git index entry changed.
- No commit, database operation, or app/package operation performed.

## Authority
- Stage-1B reports ZIP SHA-256: FEED92D1F6392821BF02FF210C2E9DC2424DF703AE4D2ADC68477FD52F94EC32
- Stage-1B candidate count: 34
- Stage-1B unresolved/preserve count: 248
- Stage-1B candidate bytes: 554873618
- Proposed prerequisite-parent tree OID preserved: 4df9ff9cba0f34d82b092833e41cba2761d994e3

## Pre-delete revalidation
All 34 candidate pairs were revalidated live before any deletion. Required proof for every pair: PAIR_CONTENT_HASH_MATCH_REQUIRED — exact relative file path, size, and SHA-256 parity. Directory and ZIP reparse points were rejected. Delete/keep paths had to be direct children of the same approved root (	mp or Source Audit).

## Deletion results
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\bhavcopy-multidate-symbol-batching-audit-v1_20260819_194528 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\bhavcopy-multidate-symbol-batching-audit-v1_20260819_194528.zip — 989693 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-current-state-audit_20260817_123325 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\corporate-action-current-state-audit_20260817_123325.zip — 91668413 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-identity-audit_20260816_020709 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\corporate-action-identity-audit_20260816_020709.zip — 1065884 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-isin-bootstrap-audit_20260816_120625 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\corporate-action-isin-bootstrap-audit_20260816_120625.zip — 1268373 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-review-audit_20260816_012113 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\corporate-action-review-audit_20260816_012113.zip — 889836 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-11-post_20260817_142307 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-11-post_20260817_142307.zip — 92084527 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-12-1-final_20260818_011520_117 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-12-1-final_20260818_011520_117.zip — 458944 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-12-pass1_20260817_160148 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-12-pass1_20260817_160148.zip — 92311331 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-13a-preview_20260818_102638_150 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-13a-preview_20260818_102638_150.zip — 88403033 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-13b-1-preflight_20260818_144646_557 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-13b-1-preflight_20260818_144646_557.zip — 88396498 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-9-2-apply_20260816_151440 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-9-2-apply_20260816_151440.zip — 16118 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-9-2-preview_20260816_145246 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-9-2-preview_20260816_145246.zip — 542646 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-9-2-preview_20260816_154908 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-9-2-preview_20260816_154908.zip — 262810 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\eod-full-integrity-audit_20260820_025715 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\eod-full-integrity-audit_20260820_025715.zip — 66348 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\eod-six-file-tail-forensic-audit_20260820_022957 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\eod-six-file-tail-forensic-audit_20260820_022957.zip — 851822 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\eod-structural-integrity-audit_20260820_020622 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\eod-structural-integrity-audit_20260820_020622.zip — 1853 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\quote-editor-display-all-load-count-rev2-current-source_20260821_141706 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\quote-editor-display-all-load-count-rev2-current-source_20260821_141706.zip — 306077 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\quote-editor-exchange-filter-audit-preflight_20260821_020824 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\quote-editor-exchange-filter-audit-preflight_20260821_020824.zip — 1472835 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\storage-architecture-audit-v1_20260819_162141 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\storage-architecture-audit-v1_20260819_162141.zip — 2177429 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\storage-architecture-v1-1-source-preflight_20260820_002754 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\storage-architecture-v1-1-source-preflight_20260820_002754.zip — 405697 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\storage-architecture-v1-2-shadow-source-preflight_20260820_111420 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\storage-architecture-v1-2-shadow-source-preflight_20260820_111420.zip — 566447 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\v1-14ad-ca-staging-preflight-r1a-r3_20260831_011938_593 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\v1-14ad-ca-staging-preflight-r1a-r3_20260831_011938_593.zip — 903861 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\v1-3-rev2-exact-current-source_20260820_190927 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\v1-3-rev2-exact-current-source_20260820_190927.zip — 432849 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\v1-4-append-newest-fast-classification-source-preflight_20260821_001542 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\v1-4-append-newest-fast-classification-source-preflight_20260821_001542.zip — 607502 bytes
- DELETED: E:\TA Projects\EOD Charting Platform\tmp\v1-5-current-quotes-source_20260821_205359 — retained ZIP E:\TA Projects\EOD Charting Platform\tmp\v1-5-current-quotes-source_20260821_205359.zip — 60370 bytes
- DELETED: E:\TA Projects\EOD Charting Platform Source Audit\bhavcopy-prefilter-preflight_20260821_174559 — retained ZIP E:\TA Projects\EOD Charting Platform Source Audit\bhavcopy-prefilter-preflight_20260821_174559.zip — 508882 bytes
- DELETED: E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-24_024712_IST — retained ZIP E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-24_024712_IST.zip — 16795207 bytes
- DELETED: E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-25_001225_IST — retained ZIP E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-25_001225_IST.zip — 16797580 bytes
- DELETED: E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-28_141317_IST — retained ZIP E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-28_141317_IST.zip — 16988072 bytes
- DELETED: E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-29_233003_IST — retained ZIP E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-29_233003_IST.zip — 17614039 bytes
- DELETED: E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-31_000303_IST — retained ZIP E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-31_000303_IST.zip — 17638159 bytes
- DELETED: E:\TA Projects\EOD Charting Platform Source Audit\v1-6-incremental-state-publication-preflight_20260822_011046 — retained ZIP E:\TA Projects\EOD Charting Platform Source Audit\v1-6-incremental-state-publication-preflight_20260822_011046.zip — 1012196 bytes
- DELETED: E:\TA Projects\EOD Charting Platform Source Audit\v1-7-checkpoint-durability-preflight_20260822_110432 — retained ZIP E:\TA Projects\EOD Charting Platform Source Audit\v1-7-checkpoint-durability-preflight_20260822_110432.zip — 1291013 bytes
- DELETED: E:\TA Projects\EOD Charting Platform Source Audit\v1-7b-checkpoint-concurrency-benchmark_20260822_144707 — retained ZIP E:\TA Projects\EOD Charting Platform Source Audit\v1-7b-checkpoint-concurrency-benchmark_20260822_144707.zip — 17274 bytes

## Actual validation results
- Expected deletion candidates: 34
- Deleted count: 34
- Bytes reclaimed: 554873618
- Reclaimed GiB: 0.517
- Retained ZIPs SHA-256 unchanged: 34 / 34
- Remaining unresolved/preserve authority paths expected: 248
- HEAD before: f4278bc62649552f119fa6438b688a10dccef25e
- HEAD after: f4278bc62649552f119fa6438b688a10dccef25e
- Real Git index SHA-256 before: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Real Git index SHA-256 after: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Real Git staged path count after: 0

## Postflight errors
- None.

## Classification
STAGE_2B_EXACT_34_DUPLICATE_DIRECTORIES_DELETE_COMPLETE

## Risks or limitations
- Directory deletion is destructive; paired ZIPs are retained as the exact content duplicate authority.
- ZIP/content equivalence does not preserve directory ACLs, filesystem timestamps, or empty directories; Stage-1B deletion authority was intentionally based on file content evidence.
- The remaining 248 unresolved/preserve items are untouched and still require separate review if more cleanup is desired.
- Supersession-family membership alone was not used as deletion authority.

## Rollback guidance
There is no automatic rollback for deleted directories. Restore a deleted directory only by extracting/copying from its retained exact paired ZIP or from an external backup. Do not modify project source or Git history as a cleanup rollback method.
