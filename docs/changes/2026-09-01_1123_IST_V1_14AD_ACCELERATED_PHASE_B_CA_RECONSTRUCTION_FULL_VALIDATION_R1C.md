# V1.14AD Accelerated Phase B — CA Reconstruction + Full Validation R1C

## IST timestamp
2026-09-01 11:23:57.565
 IST

## Objective
Reconstruct the exact accepted 35-path Corporate Action payload on the new synced-crosshair prerequisite parent and execute the structural, frontend, Rust, Cargo and Tauri validation gates in one disposable phase before any real CA staging.

## Previous defect or limitation
The prior Gate-2 combined-tree run on parent efa30d64d1aa56758dbd35d012502ad92676559d was blocked only by the stale synced-crosshair frontend test contract. That test correction is now committed as parent 24f198553e5ad5fcce46395e067628d44ded9c00. R1 initially over-constrained the live working tree by requiring working uiStore.ts to equal committed HEAD even though uiStore.ts is outside the 35-path CA scope and the disposable candidate is built from committed HEAD. R1A instead captures and preserves any pre-existing working uiStore drift byte-for-byte while validating the committed-parent uiStore identity inside the disposable candidate. R1A then assumed every CA path existed in both parents; this is invalid for CA-added files. R1B performs presence-aware parent-preimage comparison so absent/absent is valid, present/present requires the exact same blob OID, and any presence mismatch fails closed. R1B then reconstructed exact tree 6bc7dd2b393b3baf78ff97539c9eb7b8c8f42c77, but the full frontend suite had one non-CA uiStore persistence test exceed the ordinary 5000ms Vitest timeout at 5197ms while the other 227 tests passed. R1C performs three focused default-timeout reproductions before rerunning the full suite; no timeout is raised and no source test is edited.

## Files changed
- Runtime/source/config: none.
- Real Git index/history: none.
- Documentation: docs\changes\2026-09-01_1123_IST_V1_14AD_ACCELERATED_PHASE_B_CA_RECONSTRUCTION_FULL_VALIDATION_R1C.md
- External evidence: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_ACCELERATED_PHASE_B_CA_RECONSTRUCTION_FULL_VALIDATION_R1C_20260901_112357_565
- Persistent external Cargo build cache retained at: E:\TA Projects\EOD Charting Platform Validation Cache\cargo-v114ad-ca-e41e7e8363d0

## Structural result
- Parent HEAD: 24f198553e5ad5fcce46395e067628d44ded9c00
- Parent tree: e82bca95738fedf5858151d38200251274fafaeb
- Accepted CA path count: 35
- Prior accepted combined tree: d893be3f79e83446b7f04c371bc0bb5282d92efd
- Prior combined-tree replay: d893be3f79e83446b7f04c371bc0bb5282d92efd
- New combined tree: 6bc7dd2b393b3baf78ff97539c9eb7b8c8f42c77
- Alternate-index SHA-256: 320D409CDDF7485933AFF4A15513CDA4FFB9FD3EA2697258260A85B065E3EFF0
- Working uiStore differs from committed parent: True
- Working uiStore blob captured/preserved: 56aaf1fecee6819acc84d0dae015cb73d9b5ab40
- Committed parent uiStore blob used by disposable candidate: 82f14d6faa06e5bcd2b44a568712ffbccfd0b6ae
- All 35 CA parent preimages unchanged across prerequisite commit: PASS (11 present / 24 absent in both parents)

## Validation commands and actual results
- npm-ci: exit=0, duration=169.08s, PASS=True
- uiStore-focused-1: exit=0, duration=9.78s, PASS=True
- uiStore-focused-2: exit=0, duration=3.04s, PASS=True
- uiStore-focused-3: exit=0, duration=2.4s, PASS=True
- npm-test-full: exit=0, duration=9.31s, PASS=True
- renderer-typecheck: exit=0, duration=10.22s, PASS=True
- renderer-build: exit=0, duration=8.4s, PASS=True
- prereq-bhavcopy-holiday: exit=0, duration=1845.03s, PASS=True
- prereq-bhavcopy-udiff: exit=0, duration=46.02s, PASS=True
- prereq-bootstrap-existing: exit=0, duration=1.57s, PASS=True
- prereq-bootstrap-missing: exit=0, duration=1.22s, PASS=True
- v114ad-focused-rust: exit=0, duration=1.33s, PASS=True
- full-rust-serial: exit=0, duration=50.63s, PASS=True
- cargo-check: exit=0, duration=258.82s, PASS=True
- tauri-check: exit=0, duration=48.9s, PASS=True

## Postflight
- Real HEAD unchanged: PASS
- Real index byte-identical and clean: PASS
- Current source/syncedCrosshair/uiStore preserved: PASS
- Guarded live NSE DB family unchanged: PASS
- Disposable validation worktree cleanup: PASS
- Persistent Cargo target cache intentionally retained outside source directories.

## Classification
V114AD_ACCELERATED_PHASE_B_CA_35_PATH_RECONSTRUCTION_FULL_VALIDATION_PASSED__REAL_STAGING_STILL_BLOCKED

## Risks or limitations
- No real Corporate Action staging or commit is performed or authorized by this phase.
- No portable Windows package or manual runtime smoke is part of Phase B.
- Cargo formatting drift is not normalized by this validation.
- The persistent Cargo target directory is disposable build cache and can be removed after V1.14AD closeout.

## Rollback guidance
No source/index/history/database rollback is required because Phase B is disposable. Remove the external audit directory and persistent Cargo cache only if the evidence/cache is deliberately discarded.
