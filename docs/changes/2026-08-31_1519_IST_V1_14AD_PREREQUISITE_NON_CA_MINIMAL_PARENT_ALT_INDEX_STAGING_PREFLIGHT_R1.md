# V1.14AD Prerequisite Non-CA Minimal Parent Alternate-Index Staging Preflight R1

## IST timestamp
2026-08-31 15:19:30.207 IST

## Objective
Prove that the R1F-validated minimal prerequisite non-CA parent can be represented as an exact two-file staged tree using a disposable GIT_INDEX_FILE without modifying the real Git index or working source.

## Previous defect or limitation
R1F validated the exact two-file behavioral candidate with all four historical targeted Rust tests and the complete 179-test Rust suite, but real staging remained blocked because the candidate exists as selected hunks inside working files that contain additional unrelated changes. Full-file git add would therefore overstage unrelated source.

## Files changed by this preflight
- This Markdown report only: docs\changes\2026-08-31_1519_IST_V1_14AD_PREREQUISITE_NON_CA_MINIMAL_PARENT_ALT_INDEX_STAGING_PREFLIGHT_R1.md
- No project source/config file was edited.
- No real Git index entry was added or changed.
- No commit was created.

## Final implementation
- Verified exact R1F reports ZIP SHA-256: 41827C7C7BAC9495077FBB0F1D87CB23CC81AFE4A05668ABA61ECE00B05701C3.
- Verified R1F validated classification, exact patch SHA-256, exact two candidate paths, four targeted test exit codes, and full 179-test Rust success.
- Created an external shared no-checkout Git repository at exact HEAD f4278bc62649552f119fa6438b688a10dccef25e so candidate blob/tree writes never touch the real repository object database.
- Initialized a disposable alternate Git index from exact HEAD inside that external Git repository.
- Applied the R1F patch with git apply --cached only while GIT_INDEX_FILE pointed to the disposable index.
- Verified exact two-path staged scope and exact staged Git blob OIDs against R1F candidate-file-identities.json.
- Verified git diff --cached --check.
- Created the exact proposed prerequisite-parent tree without a commit.
- Deleted the alternate index and disposable shared Git repository, then reverified the real index/source authority.

## Proposed parent authority
- HEAD parent: f4278bc62649552f119fa6438b688a10dccef25e
- Proposed parent tree OID: 4df9ff9cba0f34d82b092833e41cba2761d994e3
- Minimal patch SHA-256: 041EB81E55A29364112555A1CF0A328D3BF9E40DBC7970EE8D3C1BFCCDF8EC34
- Candidate files:
- src-tauri-shell/src/bhavcopy.rs: 98a318850eb481d8420b8f097bd6689079da70f4
- src-tauri-shell/src/database/bootstrap.rs: 79ae5511d14670e4f74b5db47a4e832d80207754

## Validation commands
- git rev-parse HEAD
- git diff --cached --name-only --  (real index before/after)
- git clone --shared --no-checkout --no-tags (external disposable Git repository)
- git read-tree f4278bc62649552f119fa6438b688a10dccef25e  (alternate index only inside disposable Git repository)
- git apply --cached --check ... (alternate index only)
- git apply --cached ... (alternate index only)
- git diff --cached --name-only f4278bc62649552f119fa6438b688a10dccef25e -- (alternate index only)
- git diff --cached --check f4278bc62649552f119fa6438b688a10dccef25e -- (alternate index only)
- git ls-files --stage -- (alternate index only)
- git write-tree (alternate index only)
- git diff-tree ... f4278bc62649552f119fa6438b688a10dccef25e 4df9ff9cba0f34d82b092833e41cba2761d994e3
- SHA-256 checks for real index, current source sentinels, R1F ZIP, and R1F patch.

## Actual validation results
- R1F four targeted tests: PASS by exact R1F evidence.
- R1F full Rust suite: 179 passed / 0 failed by exact R1F evidence.
- R1F cargo fmt --check: exit 1, recorded as non-gating pre-existing formatting drift.
- Alternate staged path count: 2
- Alternate staged blob parity with R1F: PASS
- Proposed parent tree OID: 4df9ff9cba0f34d82b092833e41cba2761d994e3
- Real Git index SHA-256 before: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Real Git index SHA-256 after: 3B1C9A68BB53674F5B84CF649F3CD676BF801A6156E97CAB7D2BCFECA624891A
- Real Git index unchanged and clean: PASS
- HEAD unchanged: PASS
- Current source sentinels unchanged: PASS

## Classification
PREREQUISITE_NON_CA_MINIMAL_PARENT_ALT_INDEX_PREFLIGHT_VALIDATED__EXACT_2_FILES__REAL_INDEX_UNCHANGED__REAL_STAGING_STILL_BLOCKED

## Risks or limitations
- This proves staging/tree determinism only; it does not create or authorize a real staged index or commit.
- cargo fmt --check remains non-gating because formatting drift exists outside the selected behavioral hunks; formatting was deliberately not mixed into the prerequisite parent.
- The current working copies of the two files contain additional changes, so future real promotion must apply the exact validated patch hunks to the real index rather than stage whole files.

## Rollback guidance
Delete this report and the corresponding external Source Audit preflight directory if the preflight evidence is discarded. No source, real-index, database, application, or Git-history rollback is required.
