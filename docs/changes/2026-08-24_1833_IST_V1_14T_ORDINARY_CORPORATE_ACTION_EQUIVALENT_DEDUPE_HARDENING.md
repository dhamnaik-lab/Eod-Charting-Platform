# V1.14T Ordinary Corporate Action Equivalent-Dedupe Hardening

**IST timestamp:** 2026-08-24 18:33:51 IST

## Objective

Route ordinary Corporate Action CSV and official API ingestion through the existing evidence-aware equivalent-event store so an equivalent event preserves new provenance evidence instead of creating another import row.

## Previous defect or limitation

The historical backfill path already performed exact-key duplicate detection, equivalent-event matching, and evidence attachment. The ordinary CSV and ordinary official-fetch paths called insert_import_candidate() directly and therefore bypassed that equivalent-event/evidence-attachment contract.

## Files changed

- src-tauri-shell\src\database\corporate_action_imports.rs
- src-tauri-shell\src\database\corporate_action_imports\v114t_tests.rs

## Final implementation

- Renamed the existing internal evidence-aware store to store_import_candidate_evidence_aware().
- Routed ordinary CSV ingestion through the shared store.
- Routed ordinary official API ingestion through the shared store.
- Preserved the existing public result shape by counting EvidenceAttached as rows_duplicate/no-new-row in ordinary result objects.
- Added focused V1.14T regression tests for both call sites and the two audited ANDHRAPAP equivalence shapes.

## Validation commands

Stage 1 only applied the source/test patch. GREEN validation has not yet been executed.

Planned next commands:

- cargo test --manifest-path src-tauri-shell\Cargo.toml v114t_ -- --nocapture
- cargo test --manifest-path src-tauri-shell\Cargo.toml phase5b_ -- --nocapture
- cargo test --manifest-path src-tauri-shell\Cargo.toml phase3_import_atomicity_ -- --nocapture
- cargo test --manifest-path src-tauri-shell\Cargo.toml -- --nocapture
- cargo check --manifest-path src-tauri-shell\Cargo.toml

## Actual validation results

- V1.14T-A RED gate completed before this patch: 2 core equivalence tests passed and the ordinary-routing contract failed as expected.
- Stage 1 source/test patch: applied with exact pre-source SHA-256 guard.
- GREEN/regression/build validation: NOT YET RUN.

## Risks or limitations

- This phase changes source only. It does not repair the five existing production duplicate imports.
- Ordinary result structs still do not expose a separate rows_evidence_attached field; compatibility is preserved by using the existing rows_duplicate no-new-row counter.
- Full Rust regression and cargo check remain mandatory before V1.14T can be considered validated.

## Rollback guidance

Restore the backup source at: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14t-ordinary-equivalent-dedupe_20260824_183351_460\source-before\corporate_action_imports.rs
Remove src-tauri-shell\src\database\corporate_action_imports\v114t_tests.rs.
Expected pre-V1.14T source SHA-256: 2E05315FA4BF7FE78F28E787EDD2BD9A1FEF23FB06CAB66CC79C8EDE9A1B5CFB

## Source identity

Before SHA-256: 2E05315FA4BF7FE78F28E787EDD2BD9A1FEF23FB06CAB66CC79C8EDE9A1B5CFB
After SHA-256: 7481A3B7B695F3AE70A978C707352E2B8DDEEC0A121BAB23E54FAF3CBECE5EFD
V1.14T test file SHA-256: D3CEC09D8813ADD1A560F4B385488522405809A3F872D0867FCB7292CBCDC397

## Production-data safety

- No production database was opened by this Stage 1 script.
- No production database write was performed.
- No Apply, approval, Quick Resolve, deletion, or five-row repair was performed.

## V1.14T Final Validation Completion

**Finalized:** 2026-08-24 23:29:48 IST

- V1.14T targeted GREEN: 3 passed, 0 failed.
- Phase 5B equivalence regression: 5 passed, 0 failed.
- Phase 3 import atomicity regression: 4 passed, 0 failed.
- Phase 6A historical-store regression: 3 passed, 0 failed.
- Initial full-suite attempt isolated two stale bootstrap seed-default fixture failures (`market_holidays` missing).
- Stage 3A reproduced those two failures independently and cargo check passed.
- Bootstrap fixture repair isolated tests: test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 340 filtered out; finished in 0.03s
- Final full Rust suite: test result: ok. 341 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 61.59s
- Final cargo check: PASS.
- Final corporate_action_imports.rs SHA-256: 7481A3B7B695F3AE70A978C707352E2B8DDEEC0A121BAB23E54FAF3CBECE5EFD
- Final v114t_tests.rs SHA-256: D3CEC09D8813ADD1A560F4B385488522405809A3F872D0867FCB7292CBCDC397
- Final bootstrap.rs SHA-256: 2AC2ECF008735D6F41CD3795D0C4EFB97FD12D247B0AB5FF66A1B6DE008C0DDB

V1.14T source hardening is validated. No production database repair was performed by V1.14T.
