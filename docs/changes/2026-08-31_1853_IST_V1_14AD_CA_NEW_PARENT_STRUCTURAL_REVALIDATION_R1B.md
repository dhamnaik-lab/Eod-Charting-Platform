# V1.14AD CA New-Parent Structural Revalidation R1B

## IST timestamp
2026-08-31 18:53:40.632 IST

## Objective
Revalidate the previously accepted exact 35-path Corporate Action raw-blob candidate against the new prerequisite-parent commit efa30d64d1aa56758dbd35d012502ad92676559d without touching the real index or working source.

## Previous limitation
The old exact-35 CA alternate-index authority was validated on parent f4278bc62649552f119fa6438b688a10dccef25e. Commit efa30d64d1aa56758dbd35d012502ad92676559d now establishes the required two-file bhavcopy/bootstrap prerequisite parent, so the CA candidate must be freshly rebased/revalidated before any real CA staging or commit.

## Authority chain
- Old CA parent: f4278bc62649552f119fa6438b688a10dccef25e
- New prerequisite parent: efa30d64d1aa56758dbd35d012502ad92676559d
- New prerequisite-parent tree: 4df9ff9cba0f34d82b092833e41cba2761d994e3
- Prior CA R1A-R4-R2 reports ZIP SHA-256: 8312FFFE190A4F036721B0B675638165BCD96241F7959F44B57BF38B9BE51031
- Prerequisite-parent commit reports ZIP SHA-256: 7F8868077F887072AF2918AE13FD67F3A2F475D0FF4DF12746FA21A6D3EFB61F
- Exact CA raw blob count: 35
- Proposed combined CA tree OID: d893be3f79e83446b7f04c371bc0bb5282d92efd

## Final implementation
- Verified the prerequisite-parent commit changed exactly bhavcopy.rs and database/bootstrap.rs, neither in the 35-path CA scope.
- Verified every one of the 35 CA-scope parent preimages is identical between old and new parent.
- Recovered all 35 accepted CA byte payloads from the surviving V114AD_CT_R4 compile/test-proven baseline and verified exact byte size + SHA-256. Regenerated Git blob OIDs inside the disposable clone were required to match the historical accepted OIDs.
- Rebuilt the exact 35-blob CA candidate on new parent inside an external shared Git repository and disposable GIT_INDEX_FILE.
- Verified exact 35 staged paths, exact blob OIDs, stage-0 mode 100644, and strict git diff --cached --check.
- Verified the proposed combined CA tree differs from new parent by exactly the 35 CA paths.
- Verified prerequisite-parent bhavcopy/bootstrap blobs are preserved unchanged in the proposed CA tree.
- Deleted the disposable clone/index and reverified the real repository/source state.

## Actual validation results
- Structural CA rebase: PASS
- CA path count: 35
- Parent-preimage continuity: PASS
- Durable R4 baseline byte size/SHA-256 verification + regenerated blob-OID parity: PASS
- Proposed CA tree OID: d893be3f79e83446b7f04c371bc0bb5282d92efd
- Real index SHA-256 before: E3C5AA0EBED9AE344AEA37817EBEE743C3A77BD4463A8B7ACB0D442D739A1E86
- Real index SHA-256 after: E3C5AA0EBED9AE344AEA37817EBEE743C3A77BD4463A8B7ACB0D442D739A1E86
- Real index staged path count after: 0
- Working source sentinels unchanged: PASS

## Classification
CA_NEW_PARENT_STRUCTURAL_REVALIDATION_PASSED__EXACT_35_BLOBS__BUILD_TEST_REQUIRED__REAL_STAGING_BLOCKED

## Risks / limitations
- This is structural/blob revalidation only. It does not prove the combined new-parent + CA tree compiles or passes frontend/Rust tests.
- CA real staging remains blocked until a disposable materialization of the exact proposed tree passes fresh build/test validation.
- Historical cargo fmt drift remains outside this structural gate.

## Rollback guidance
No rollback is required because this stage modifies no project source, real index, branch, database, or application state. Delete only this report and its external audit directory if the evidence is later superseded.
