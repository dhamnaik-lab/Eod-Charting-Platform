# V1.14AD Synced Crosshair Exact One-File Prerequisite Commit R1A

## IST timestamp
2026-09-01 02:01:45.132 IST

## Objective
Commit the already-validated syncedCrosshair test-contract correction as an exact one-file prerequisite parent before rebuilding the 35-path Corporate Action candidate.

## Previous defect or limitation
The parent test expected synced crosshair and symbol-link state to start true even though uiStore runtime defaults are false. The validated correction resets the shared store before each test and asserts the actual false-to-true-to-false lifecycle. The first R1 commit-gate attempt stopped before branch promotion because a PowerShell -join expression was bound as a command parameter; fail-closed rollback restored the exact parent HEAD and staged index before this R1A retry.

## Files changed
- Commit source path: src/engine/__tests__/syncedCrosshair.test.ts
- Runtime source/config changed: none
- Documentation created after commit: docs\changes\2026-09-01_0201_IST_V1_14AD_SYNCED_CROSSHAIR_EXACT_ONE_FILE_PREREQUISITE_COMMIT_R1A.md

## Final implementation
- Parent commit: efa30d64d1aa56758dbd35d012502ad92676559d
- New commit: 24f198553e5ad5fcce46395e067628d44ded9c00
- New tree: e82bca95738fedf5858151d38200251274fafaeb
- Candidate blob: 25186f05b83b1bf02c8a13eb155f1c93f91ee91b
- Changed path count: 1
- Commit title: test: align synced crosshair store defaults
- Commit body: Reset shared uiStore state before synced-crosshair tests and align initial assertions with false runtime defaults.

## Validation commands / actual results
- Pre-commit staged path count: 1 / PASS
- Pre-commit staged blob/tree identity: PASS
- git diff --cached --check: PASS
- commit object parent/tree/path/blob/message verification before ref move: PASS
- update-ref exact-old-HEAD compare-and-swap: PASS
- Post-commit staged path count relative new HEAD: 0 / PASS
- Post-commit index tree: e82bca95738fedf5858151d38200251274fafaeb / PASS
- Post-commit index SHA-256: 99717042080DFD31972C74D3449441F64C9BF273BEEF9B42849A4C0E7D6BA3E4 / PASS
- Candidate/uiStore/source sentinels unchanged: PASS
- R5A validated frontend evidence retained: focused 2/2; isolated full frontend 29 files / 196 tests; renderer typecheck/build PASS

## Behaviour changed
Test contract only: deterministic uiStore reset and expectations aligned with existing false runtime defaults.

## Behaviour deliberately preserved
Runtime uiStore defaults and application behavior are unchanged. Corporate Action source is not part of this commit.

## Risks or limitations
No new runtime validation is performed during this commit gate because the exact committed blob is the previously validated R5A candidate. The 35-path Corporate Action tree must now be reconstructed and freshly validated against this new parent.

## Rollback guidance
If this commit must be reverted before subsequent work, move refs/heads/gemini-release-qa-20260512 back from 24f198553e5ad5fcce46395e067628d44ded9c00 to efa30d64d1aa56758dbd35d012502ad92676559d and restore the byte-exact pre-commit index backup if the old staged state is required.

## Recommended next step
Freshly reconstruct the accepted 35-path Corporate Action payload against new parent 24f198553e5ad5fcce46395e067628d44ded9c00, then rerun structural and combined-tree build/test gates before any CA staging.
