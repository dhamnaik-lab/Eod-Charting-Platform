# V1.14W Stack-Safe Hash Repair and Private-Copy Dry-Run Validation

**IST timestamp:** 2026-08-25 09:29:00 IST

## Objective

Correct the V1.14W real maintenance-path stack overflow caused by a fixed 1 MiB hash buffer on the main-thread stack, prove the fix RED-to-GREEN, and complete serial regression plus exact private-copy real-data dry-run validation. No unrelated binary_eod correction is included.

## Previous validation limitation

The prior C2 real maintenance executable terminated with STATUS_STACK_OVERFLOW before dry-run output. Source tracing showed sha256_file allocated [0u8; 1024 * 1024] as a fixed local array and run_maintenance immediately invoked it through load_authority(). Existing unit tests did not exercise the real maintenance entry path. Separately, the default-parallel V1.7A instrumentation failure remains classified as test isolation interference because the exact test, V1.7A serial group, and full serial suite pass.

## Files changed

- src-tauri-shell\src\database\corporate_action_imports\five_pair_consolidation.rs — moved the 1 MiB SHA-256 buffer from a fixed stack array to a heap-backed Vec.
- src-tauri-shell\src\database\corporate_action_imports\v114w_tests.rs — added a regression source-contract test for stack-safe hashing.
- Validation evidence and this report were created under tmp and docs\changes.

## Validated source identities

- main.rs: 605B3681626224FAB25FA7CE885811B452DB62DEA4E3DEB26010B36B5CBDA22B
- database.rs: 1042D77B3CE8E1458376E10DE724DE40E666E51336B3C5101C6885DD9D462F99
- corporate_action_imports.rs: 0C795DFEE660BE254B25F29D5DBB8476C117D9C64DCBB60901982AB61C132425
- five_pair_consolidation.rs: 05B1C226B30A60DF874EB365E5879117A05B99DCB7FA7834F0C5EAF0990BFF56
- v114w_tests.rs: 7B0C5394182CD8CD7722B6E210BB8726A1C5E19840649332D990778C967823AF

## Validation commands and actual results

- Stack-buffer TDD RED: expected failure confirmed; log E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14w-c3-stack-safe-validation_20260825_092900_689\reports\v1-14w-c3-stack-buffer-red.log
- Stack-buffer GREEN: test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 357 filtered out; finished in 0.32s
- Exact V1.7A test isolated: test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 357 filtered out; finished in 11.77s
- V1.7A group serial: test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 354 filtered out; finished in 3.82s
- V1.14W targeted: test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 342 filtered out; finished in 0.60s
- V1.14T regression: test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 355 filtered out; finished in 0.04s
- Phase 5B regression: test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 353 filtered out; finished in 0.01s
- Phase 3 atomicity: test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 354 filtered out; finished in 0.08s
- Phase 6A regression: test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 355 filtered out; finished in 0.13s
- Full Rust suite serial: test result: ok. 357 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 160.39s
- cargo check: PASS
- Exact private-copy V1.14W maintenance run: PASS

## Dry-run result

- Targets deleted on private copy: 5
- Evidence rows re-parented: 5
- Evidence rows preserved: 10
- Canonical owners preserved: 5
- Corporate Action 10947 unchanged: True
- Protected scans unchanged: True
- quick_check: ok
- foreign_key_check violations: 0
- Post-state fingerprint: 8953723E83FE67351C6463A9D856A4B28C230D7088C22C638A815B44E110967B
- Apply-plan fingerprint: B926042A76323C273C48BFD5A21C60D609F78091EC6B3111EE47DE788EC4CB96

## Safety

- Live database family matched the accepted V1.14V manifest before snapshot capture.
- Rust opened and mutated only the private snapshot.
- Live DB/WAL/SHM hashes remained unchanged through the dry run.
- Live database writes: 0.
- Live Apply capability: 0.
- V1.14W-C3 grants no production Apply authorization.

## Risks or limitations

- The validated transaction has only been committed against an exact private copy. Production Apply remains a separate explicitly authorized phase.
- The C3 hash-buffer fix changes allocation location only; SHA-256 algorithm, 1 MiB buffer size, and file-read semantics are preserved.
- The existing V1.7A sync-instrumentation test has parallel-suite isolation interference and should be corrected separately; V1.14W did not modify that subsystem.
- Any live database-family or relevant-state/schema fingerprint change requires a fresh preflight before production Apply.

## Rollback guidance

- To roll back the C3 source correction, restore five_pair_consolidation.rs from E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14w-c3-stack-safe-validation_20260825_092900_689\source-before-stack-safe-fix\five_pair_consolidation.rs and v114w_tests.rs from E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14w-c3-stack-safe-validation_20260825_092900_689\source-before-stack-safe-fix\v114w_tests.rs.
- Pre-fix module SHA-256: D34C889D9B19497A706FEFFD763F75DA25C507382B835A732D3F03E22E36F20A.
- Pre-fix test SHA-256: 4CB6D9EE5206C1E7A4E6D5114E7CD1086B0E7D1C62B18B481201645BEE383033.
- V1.14W-C3 makes no production database mutation.
- Future live Apply must use a separately verified full pre-write DB-family backup.
