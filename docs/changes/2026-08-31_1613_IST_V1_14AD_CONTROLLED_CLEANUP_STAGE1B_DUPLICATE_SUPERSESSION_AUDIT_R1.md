# V1.14AD Controlled Cleanup Stage-1B Duplicate / Supersession Audit R1

## IST timestamp
2026-08-31 16:13:41.781 IST

## Objective
Analyze the 282 Stage-1 REVIEW_REQUIRED top-level items after successful Stage-2A cleanup, prove exact byte duplicates where possible, identify directory/ZIP content duplicates and timestamp-family supersession candidates, and produce a narrowly reviewable Stage-2B exact-duplicate deletion candidate list without deleting anything.

## Previous defect or limitation
Stage-1 conservatively left 282 items / 19.456 GiB as REVIEW_REQUIRED because project tmp and Source Audit contain both disposable snapshots and durable authority evidence. Stage-2A deleted only the seven already-certified disposable directories and reclaimed 4,030,281,119 bytes. Further cleanup requires content evidence rather than name-only assumptions.

## Files changed
- This Markdown report only inside the project: docs\changes\2026-08-31_1613_IST_V1_14AD_CONTROLLED_CLEANUP_STAGE1B_DUPLICATE_SUPERSESSION_AUDIT_R1.md
- External Stage-1B reports under: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_CONTROLLED_CLEANUP_STAGE1B_DUPLICATE_SUPERSESSION_AUDIT_R1_20260831_161341_781
- No cleanup target deleted, moved, or renamed.
- No source/config file edited.
- No real Git index entry changed.

## Final implementation
- Verified exact Stage-1 reports ZIP SHA-256: 300C124DBC5944F6E353DED6255D027B674368F3ECD2D0FBCFFBC7ED1597CC4F.
- Verified exact Stage-2A reports ZIP SHA-256: 7FCA7CD8BF5AF5BF24DA85EA4F4454FE84D61A46C009CBAF8F06A2586796D9A0 and exact 7-delete / 4030281119-byte completion evidence.
- Reconstructed the current project tmp and Source Audit top-level sets from Stage-1 plus Stage-2A and required exact set equality.
- Preserved R1F, alternate-index preflight, proposed parent tree 4df9ff9cba0f34d82b092833e41cba2761d994e3, parent-baseline review, R2 evidence, Stage-1, Stage-2A, and continuity authorities.
- Detected exact top-level file duplicates only by same size + SHA-256; differently named exact duplicates remain review-only unless normalized duplicate keys match.
- Compared same-name directory/ZIP pairs without extracting them. An EXACT_DIRECTORY_ZIP_DUPLICATE requires every relative file path, file size, and SHA-256 to match. Up to 8 GiB uncompressed per pair is eligible for exact verification.
- Identified timestamp-based supersession families as advisory only; no supersession family by itself authorizes deletion.
- Produced a Stage-2B exact-duplicate candidate list but did not authorize or execute Stage-2B deletion.

## Actual results
- Stage-1 REVIEW_REQUIRED rows analyzed: 282
- Exact file duplicate groups: 0
- Exact directory/ZIP content duplicates: 34
- Directory/ZIP mismatches or skipped pairs: 1
- Supersession families (advisory): 39
- STAGE2B_EXACT_DUPLICATE_DELETE_CANDIDATE items: 34
- Potential exact-duplicate reclaim: 554873618 bytes / 0.517 GiB
- Remaining preserve/unresolved rows: 248

## Stage-2B exact duplicate candidate preview
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-12-pass1_20260817_160148 — keep E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-12-pass1_20260817_160148.zip — 88.03 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-11-post_20260817_142307 — keep E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-11-post_20260817_142307.zip — 87.82 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\corporate-action-current-state-audit_20260817_123325 — keep E:\TA Projects\EOD Charting Platform\tmp\corporate-action-current-state-audit_20260817_123325.zip — 87.42 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-13a-preview_20260818_102638_150 — keep E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-13a-preview_20260818_102638_150.zip — 84.31 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-13b-1-preflight_20260818_144646_557 — keep E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-13b-1-preflight_20260818_144646_557.zip — 84.3 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-31_000303_IST — keep E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-31_000303_IST.zip — 16.82 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-29_233003_IST — keep E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-29_233003_IST.zip — 16.8 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-28_141317_IST — keep E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-28_141317_IST.zip — 16.2 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-25_001225_IST — keep E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-25_001225_IST.zip — 16.02 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-24_024712_IST — keep E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-24_024712_IST.zip — 16.02 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\storage-architecture-audit-v1_20260819_162141 — keep E:\TA Projects\EOD Charting Platform\tmp\storage-architecture-audit-v1_20260819_162141.zip — 2.08 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\quote-editor-exchange-filter-audit-preflight_20260821_020824 — keep E:\TA Projects\EOD Charting Platform\tmp\quote-editor-exchange-filter-audit-preflight_20260821_020824.zip — 1.4 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform Source Audit\v1-7-checkpoint-durability-preflight_20260822_110432 — keep E:\TA Projects\EOD Charting Platform Source Audit\v1-7-checkpoint-durability-preflight_20260822_110432.zip — 1.23 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\corporate-action-isin-bootstrap-audit_20260816_120625 — keep E:\TA Projects\EOD Charting Platform\tmp\corporate-action-isin-bootstrap-audit_20260816_120625.zip — 1.21 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\corporate-action-identity-audit_20260816_020709 — keep E:\TA Projects\EOD Charting Platform\tmp\corporate-action-identity-audit_20260816_020709.zip — 1.02 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform Source Audit\v1-6-incremental-state-publication-preflight_20260822_011046 — keep E:\TA Projects\EOD Charting Platform Source Audit\v1-6-incremental-state-publication-preflight_20260822_011046.zip — 0.97 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\bhavcopy-multidate-symbol-batching-audit-v1_20260819_194528 — keep E:\TA Projects\EOD Charting Platform\tmp\bhavcopy-multidate-symbol-batching-audit-v1_20260819_194528.zip — 0.94 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\v1-14ad-ca-staging-preflight-r1a-r3_20260831_011938_593 — keep E:\TA Projects\EOD Charting Platform\tmp\v1-14ad-ca-staging-preflight-r1a-r3_20260831_011938_593.zip — 0.86 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\corporate-action-review-audit_20260816_012113 — keep E:\TA Projects\EOD Charting Platform\tmp\corporate-action-review-audit_20260816_012113.zip — 0.85 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\eod-six-file-tail-forensic-audit_20260820_022957 — keep E:\TA Projects\EOD Charting Platform\tmp\eod-six-file-tail-forensic-audit_20260820_022957.zip — 0.81 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\v1-4-append-newest-fast-classification-source-preflight_20260821_001542 — keep E:\TA Projects\EOD Charting Platform\tmp\v1-4-append-newest-fast-classification-source-preflight_20260821_001542.zip — 0.58 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\storage-architecture-v1-2-shadow-source-preflight_20260820_111420 — keep E:\TA Projects\EOD Charting Platform\tmp\storage-architecture-v1-2-shadow-source-preflight_20260820_111420.zip — 0.54 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-9-2-preview_20260816_145246 — keep E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-9-2-preview_20260816_145246.zip — 0.52 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform Source Audit\bhavcopy-prefilter-preflight_20260821_174559 — keep E:\TA Projects\EOD Charting Platform Source Audit\bhavcopy-prefilter-preflight_20260821_174559.zip — 0.49 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-12-1-final_20260818_011520_117 — keep E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-12-1-final_20260818_011520_117.zip — 0.44 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\v1-3-rev2-exact-current-source_20260820_190927 — keep E:\TA Projects\EOD Charting Platform\tmp\v1-3-rev2-exact-current-source_20260820_190927.zip — 0.41 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\storage-architecture-v1-1-source-preflight_20260820_002754 — keep E:\TA Projects\EOD Charting Platform\tmp\storage-architecture-v1-1-source-preflight_20260820_002754.zip — 0.39 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\quote-editor-display-all-load-count-rev2-current-source_20260821_141706 — keep E:\TA Projects\EOD Charting Platform\tmp\quote-editor-display-all-load-count-rev2-current-source_20260821_141706.zip — 0.29 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-9-2-preview_20260816_154908 — keep E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-9-2-preview_20260816_154908.zip — 0.25 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\eod-full-integrity-audit_20260820_025715 — keep E:\TA Projects\EOD Charting Platform\tmp\eod-full-integrity-audit_20260820_025715.zip — 0.06 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\v1-5-current-quotes-source_20260821_205359 — keep E:\TA Projects\EOD Charting Platform\tmp\v1-5-current-quotes-source_20260821_205359.zip — 0.06 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform Source Audit\v1-7b-checkpoint-concurrency-benchmark_20260822_144707 — keep E:\TA Projects\EOD Charting Platform Source Audit\v1-7b-checkpoint-concurrency-benchmark_20260822_144707.zip — 0.02 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-9-2-apply_20260816_151440 — keep E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-9-2-apply_20260816_151440.zip — 0.02 MiB
- EXACT_DIRECTORY_ZIP_DUPLICATE: DELETE CANDIDATE E:\TA Projects\EOD Charting Platform\tmp\eod-structural-integrity-audit_20260820_020622 — keep E:\TA Projects\EOD Charting Platform\tmp\eod-structural-integrity-audit_20260820_020622.zip — 0 MiB

## Safety validation
- Project tmp top-level set unchanged: PASS
- Source Audit top-level set unchanged except this audit directory: PASS
- Hard KEEP authorities preserved: PASS
- HEAD unchanged: f4278bc62649552f119fa6438b688a10dccef25e
- Real Git index SHA-256 before: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Real Git index SHA-256 after: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Real Git index staged path count after: 0
- Current source sentinels unchanged: PASS

## Classification
STAGE_1B_READ_ONLY_DUPLICATE_SUPERSESSION_AUDIT_COMPLETE

## Risks or limitations
- Supersession-family membership is advisory only and is not a deletion proof.
- Directory/ZIP pairs larger than the configured exact-pair cap or containing reparse points are preserved for review.
- ZIP comparison proves file-content equivalence; filesystem metadata such as ACLs or empty directories is not treated as content authority.
- Stage-2B deletion remains blocked pending review and explicit approval of the exact candidate manifest.

## Rollback guidance
No cleanup rollback is required because Stage-1B performs no deletion or move. Delete only this report and the external Stage-1B audit directory if the analysis itself is discarded.
