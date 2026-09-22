# V1.14AD Prerequisite Non-CA Minimal Parent Commit R1

## IST timestamp
2026-08-31 17:54:02.663 IST

## Objective
Create the exact validated two-file prerequisite non-CA parent commit from the already staged real-index tree, fully verify the commit object before branch movement, atomically advance the current branch, and stop before any Corporate Action revalidation or staging.

## Previous defect or limitation
Direct Corporate Action commit on the old HEAD was rejected because prerequisite non-CA changes were required first. R1F validated the minimal two-file prerequisite behavior, alternate-index preflight proved the exact proposed tree, and real-index staging promotion staged that exact tree without changing current working source. This step converts only that validated staged tree into the required parent commit.

## Files/history changed
- Created commit: efa30d64d1aa56758dbd35d012502ad92676559d
- Parent: f4278bc62649552f119fa6438b688a10dccef25e
- Tree: 4df9ff9cba0f34d82b092833e41cba2761d994e3
- Branch advanced atomically: refs/heads/gemini-release-qa-20260512
- Commit contains exactly two paths:
  - src-tauri-shell/src/bhavcopy.rs
  - src-tauri-shell/src/database/bootstrap.rs

- No working source/config file was edited by this commit operation.
- No additional path was staged.
- The real index bytes were unchanged by branch advancement and are clean relative to the new HEAD.

## Commit message
- Subject: fix: establish bhavcopy/bootstrap prerequisite baseline
- Body: Validated minimal non-CA prerequisite parent before corporate-action revalidation.

## Upstream authority
- R1F reports ZIP SHA-256: 41827C7C7BAC9495077FBB0F1D87CB23CC81AFE4A05668ABA61ECE00B05701C3
- Alternate-index preflight reports ZIP SHA-256: B89BFA5E37050CE5C3E8306740935914743C6407A9553D7318D947FCF31009AD
- Real-index staging promotion reports ZIP SHA-256: D729F9089CAFB0067B182615EB3456432DDD0B7B44D02C00196986F257944C24
- Validated patch SHA-256: 041EB81E55A29364112555A1CF0A328D3BF9E40DBC7970EE8D3C1BFCCDF8EC34
- Validated tree OID: 4df9ff9cba0f34d82b092833e41cba2761d994e3
- Pre-commit staged index SHA-256: E3C5AA0EBED9AE344AEA37817EBEE743C3A77BD4463A8B7ACB0D442D739A1E86

## Exact committed blob OIDs
- src-tauri-shell/src/bhavcopy.rs : 98a318850eb481d8420b8f097bd6689079da70f4
- src-tauri-shell/src/database/bootstrap.rs : 79ae5511d14670e4f74b5db47a4e832d80207754

## Validation commands
- git symbolic-ref -q HEAD
- git rev-parse HEAD
- git write-tree
- git diff --cached --name-only <old-head> --
- git ls-files --stage --
- git diff --cached --check <old-head> --
- git commit-tree <tree> -p <old-head> -m <subject> -m <body>
- git cat-file -t/-p <new-commit>
- git show -s --format=%T/%P/%s/%B <new-commit>
- git diff-tree --no-commit-id --name-only -r <old-head> <new-commit> --
- git update-ref <branch-ref> <new-commit> <old-head>
- git diff --cached --name-only -- after branch movement
- SHA-256 verification of real index and current working source before/after

## Actual validation results
- New commit OID: efa30d64d1aa56758dbd35d012502ad92676559d
- Commit object type: commit
- Commit parent exact: PASS
- Commit tree exact: PASS
- Commit message exact: PASS
- Commit changed path count: 2
- Commit changed path set exact: PASS
- Branch ref old-value guard: PASS
- HEAD after update-ref: efa30d64d1aa56758dbd35d012502ad92676559d
- HEAD parent: f4278bc62649552f119fa6438b688a10dccef25e
- HEAD tree: 4df9ff9cba0f34d82b092833e41cba2761d994e3
- Cached diff after commit: empty PASS
- Real index SHA-256 before commit: E3C5AA0EBED9AE344AEA37817EBEE743C3A77BD4463A8B7ACB0D442D739A1E86
- Real index SHA-256 after commit: E3C5AA0EBED9AE344AEA37817EBEE743C3A77BD4463A8B7ACB0D442D739A1E86
- Real index bytes unchanged by commit: PASS
- Working source/config sentinels byte-identical: PASS
- index.lock absent: PASS

## Classification
PREREQUISITE_NON_CA_MINIMAL_PARENT_COMMIT_CREATED__CA_REVALIDATION_REQUIRED

## Risks or limitations
- git commit-tree/update-ref intentionally bypass normal git commit hooks; all prerequisite validation and staged-tree verification were performed before branch movement.
- Current working copies still contain unrelated unstaged changes beyond this commit; those remain untouched.
- Corporate Action staging/commit is not authorized by this commit. The accepted CA scope must now be rebased/revalidated against new parent efa30d64d1aa56758dbd35d012502ad92676559d.
- CA_REVALIDATION_REQUIRED before any CA real-index promotion.

## Rollback guidance
A rollback must be separately reviewed. The pre-commit staged index backup is retained at: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_PREREQUISITE_NON_CA_MINIMAL_PARENT_COMMIT_R1_20260831_175402_663\pre-commit-real-index.index. The original pre-staging clean index backup remains at: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_PREREQUISITE_NON_CA_MINIMAL_PARENT_REAL_INDEX_STAGING_PROMOTION_R1_20260831_172755_760\real-index-before-stage2-parent-promotion.index. Do not use broad reset/restore/checkout operations because the working tree contains unrelated current changes.
