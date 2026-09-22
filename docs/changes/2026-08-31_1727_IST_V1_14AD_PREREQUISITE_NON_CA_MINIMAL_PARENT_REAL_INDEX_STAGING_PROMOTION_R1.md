# V1.14AD Prerequisite Non-CA Minimal Parent Real-Index Staging Promotion R1

## IST timestamp
2026-08-31 17:27:55.760 IST

## Objective
Promote the R1F-validated and alternate-index-preflighted minimal prerequisite non-CA parent into the real Git index by applying only the exact validated patch hunks, while leaving current working source byte-identical and stopping before commit.

## Previous defect or limitation
The current working copies of bhavcopy.rs and database/bootstrap.rs contain additional unrelated changes beyond the validated prerequisite hunks. Whole-file git add would therefore overstage unrelated source. R1F proved the exact two-file behavioral candidate and full 179-test Rust suite; alternate-index preflight proved the exact staged blobs and proposed parent tree 4df9ff9cba0f34d82b092833e41cba2761d994e3 without touching the real index.

## Files changed by this promotion
- Real Git index: intentionally staged exactly two paths listed below.
- This Markdown report: docs\changes\2026-08-31_1727_IST_V1_14AD_PREREQUISITE_NON_CA_MINIMAL_PARENT_REAL_INDEX_STAGING_PROMOTION_R1.md
- No project source/config working file was edited by the promotion.
- No commit was created.

## Upstream authority
- HEAD: f4278bc62649552f119fa6438b688a10dccef25e
- R1F reports ZIP SHA-256: 41827C7C7BAC9495077FBB0F1D87CB23CC81AFE4A05668ABA61ECE00B05701C3
- Alternate-index preflight reports ZIP SHA-256: B89BFA5E37050CE5C3E8306740935914743C6407A9553D7318D947FCF31009AD
- Validated patch SHA-256: 041EB81E55A29364112555A1CF0A328D3BF9E40DBC7970EE8D3C1BFCCDF8EC34
- Validated proposed parent tree OID: 4df9ff9cba0f34d82b092833e41cba2761d994e3

## Exact staged paths and blob OIDs
- src-tauri-shell/src/bhavcopy.rs: 98a318850eb481d8420b8f097bd6689079da70f4
- src-tauri-shell/src/database/bootstrap.rs: 79ae5511d14670e4f74b5db47a4e832d80207754

## Validation commands
- git diff --cached --name-only f4278bc62649552f119fa6438b688a10dccef25e --
- git apply --cached --check --whitespace=nowarn <validated patch>
- git apply --cached --whitespace=nowarn <validated patch>
- git diff --cached --check f4278bc62649552f119fa6438b688a10dccef25e --
- git ls-files --stage --
- git write-tree
- SHA-256 verification of working source sentinels before/after
- SHA-256 verification of the real index before/after

## Actual validation results
- Staged path count: 2
- Staged path set: exact PASS
- Staged blob parity with R1F: PASS
- git diff --cached --check: PASS
- Staged tree OID: 4df9ff9cba0f34d82b092833e41cba2761d994e3
- Staged tree equals validated proposed parent tree: PASS
- Real index SHA-256 before: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Real-index rollback backup SHA-256: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Real index SHA-256 after intentional staging: E3C5AA0EBED9AE344AEA37817EBEE743C3A77BD4463A8B7ACB0D442D739A1E86
- Working source/config sentinels byte-identical: PASS
- HEAD unchanged: PASS
- Commit created: NO

## Classification
REAL_INDEX_EXACT_2_FILE_PREREQUISITE_PARENT_STAGED__COMMIT_NOT_AUTHORIZED

## Risks or limitations
- The real index is now intentionally non-clean with exactly two validated staged paths. Do not run whole-file git add, reset, restore, checkout, or unrelated staging commands before the staged-state review/commit decision.
- Current working copies of the two Rust files still contain additional unstaged changes beyond the staged prerequisite hunks; this is intentional.
- cargo fmt --check historical drift remains outside this prerequisite parent and was not staged.
- The pre-staging raw index backup is retained externally at: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_PREREQUISITE_NON_CA_MINIMAL_PARENT_REAL_INDEX_STAGING_PROMOTION_R1_20260831_172755_760\real-index-before-stage2-parent-promotion.index

## Rollback guidance
Before commit, restore the retained raw index backup only through a separately reviewed rollback operation. Do not use broad reset/restore commands because the working tree contains unrelated current changes.
