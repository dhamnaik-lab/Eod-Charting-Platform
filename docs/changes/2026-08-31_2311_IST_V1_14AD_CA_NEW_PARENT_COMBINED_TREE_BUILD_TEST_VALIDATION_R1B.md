# V1.14AD CA New-Parent Combined-Tree Build/Test Validation R1A

## IST timestamp
2026-08-31 23:11:51.145 IST

## Objective
Materialize the exact structurally revalidated Corporate Action tree d893be3f79e83446b7f04c371bc0bb5282d92efd on prerequisite parent efa30d64d1aa56758dbd35d012502ad92676559d in a disposable external worktree and execute fresh frontend/Rust compile and regression validation before any real CA staging.

## Previous defect or limitation
Gate-2 R1A was blocked before materialization because its default failed-R1 provenance path incorrectly named the prior R1 evidence ZIP as ...-r1a-reports-only.zip; the actual failed R1 artifact is ...-r1-reports-only.zip with SHA-256 2126A07C61ACA78FD8BBBD903D0606DB92094290E7D68651E2D1652368F20C0F. This R1B changes only that provenance filename while preserving the R1A filter-aware materialization and cleanup hardening.

The historical R4 cumulative CA baseline was blocked by exactly four prerequisite bhavcopy/bootstrap tests. Those prerequisite hunks are now committed in parent efa30d64d1aa56758dbd35d012502ad92676559d. Structural revalidation R1B proved the exact 35 accepted CA blobs can be combined with that parent into deterministic tree d893be3f79e83446b7f04c371bc0bb5282d92efd without touching the real repository. Fresh build/test validation of that exact combined tree was still required.

## Files changed
- Project source/config: none.
- Real Git index/branch: none.
- Created this validation report: docs\changes\2026-08-31_2311_IST_V1_14AD_CA_NEW_PARENT_COMBINED_TREE_BUILD_TEST_VALIDATION_R1B.md
- Created external reports under: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_CA_NEW_PARENT_COMBINED_TREE_BUILD_TEST_VALIDATION_R1B_20260831_231151_145
- Disposable combined-tree worktree, npm dependencies, renderer dist and cargo target are removed with bounded retry/attribute-clearing cleanup.

## Exact implementation
- Verified R1B reports ZIP SHA-256: A1C72B71166AC51930595C3DBADD9A9B945C0FE1B088EB479C14CC10E521EE58.
- Verified failed Gate-2 R1 reports ZIP SHA-256: 2126A07C61ACA78FD8BBBD903D0606DB92094290E7D68651E2D1652368F20C0F.
- Verified R1B structural classification, exact 35-path matrix, and proposed tree OID.
- Recreated the exact 35 accepted blob objects from durable R4 baseline bytes inside a disposable shared clone only.
- Rebuilt and required exact combined tree OID d893be3f79e83446b7f04c371bc0bb5282d92efd.
- Materialized that exact index with checkout-index; Windows worktree EOL/filter transformations are verified using path-aware Git clean identity rather than raw no-filter worktree bytes.
- Reverified all 35 CA materialized files by path-aware/filter-normalized Git blob identity and preserved prerequisite bhavcopy/bootstrap parent blobs.
- Used external CARGO_TARGET_DIR: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_CA_NEW_PARENT_COMBINED_TREE_BUILD_TEST_VALIDATION_R1B_20260831_231151_145\cargo-target.
- Ran fresh validation gates sequentially; stopped on first command failure.

## Validation commands and actual results
- npm-ci: exit=0, duration=189.75s, PASS=True
- npm-test-full: exit=1, duration=10.3s, PASS=False

## Postflight
- HEAD before: efa30d64d1aa56758dbd35d012502ad92676559d
- HEAD after: efa30d64d1aa56758dbd35d012502ad92676559d
- Real index SHA-256 before: E3C5AA0EBED9AE344AEA37817EBEE743C3A77BD4463A8B7ACB0D442D739A1E86
- Real index SHA-256 after: E3C5AA0EBED9AE344AEA37817EBEE743C3A77BD4463A8B7ACB0D442D739A1E86
- Working source sentinels unchanged: PASS
- Guarded live NSE DB family unchanged: PASS
- Validation cleanup: PASS

## Classification
CA_NEW_PARENT_COMBINED_TREE_BUILD_TEST_BLOCKED__DO_NOT_STAGE

## Risks or limitations
- No portable Windows package or manual runtime smoke is part of this gate.
- cargo fmt historical drift is not changed or normalized by this validation.
- Real CA staging remains blocked even on PASS until this evidence is reviewed and an exact real-index staging operation is separately approved.

## Rollback guidance
No source/Git/database rollback is required because this gate is disposable and does not mutate project source, the real index, branch history, or the guarded live database family. Remove this report and its external audit directory only if the validation evidence is deliberately discarded.
