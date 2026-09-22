# V1.14W five-pair consolidation Rust maintenance implementation

**IST timestamp:** 2026-08-25 01:55:28 IST

## Objective

Implement the approved Rust maintenance path for the exact five Corporate Action consolidations while keeping V1.14W restricted to private-copy dry-run only.

## Previous defect or limitation

V1.14U proved the transaction using a Python simulation and V1.14V proved the exact live state, but the application source had no maintainable Rust transaction path for the exact five evidence-preserving consolidations.

## Files changed

- src-tauri-shell\src\database\corporate_action_imports\five_pair_consolidation.rs — new dry-run-only maintenance implementation and behavioral tests.
- src-tauri-shell\src\database\corporate_action_imports.rs — registered/re-exported the maintenance module; V1.14W RED tests remain registered.
- src-tauri-shell\src\database.rs — re-exported the maintenance runner.
- src-tauri-shell\src\main.rs — added explicit maintenance CLI dispatch before normal application startup.

## Final implementation

- Accepts only --maintenance-corporate-action-v114w with --mode dry-run.
- Requires the exact private-copy acknowledgement token.
- Locks the V1.14U plan, V1.14V manifest, relevant-state, schema, authority-file, and manifest-file identities.
- Rejects the V1.14V live database path and canonical aliases to that live path.
- Requires private main+WAL hashes/lengths to match the accepted V1.14V family before SQLite open.
- Revalidates exact imports, evidence, dependencies, Corporate Action 10947, scans 1736/4670/5353, relevant-state fingerprint, schema fingerprint, quick_check, and foreign_key_check before mutation.
- In one transaction, re-parents exactly five target evidence rows, proves each target then has zero dependencies, and deletes exactly five target imports.
- Verifies all five owners and all ten evidence rows are preserved, protected action/scans are unchanged, relevant table counts are bounded, quick_check is ok, and foreign_key_check is empty before commit.
- Exposes no live Apply mode.

## Validation commands

cargo test --manifest-path src-tauri-shell\Cargo.toml v114w_ -- --nocapture",
    ",
    

TARGETED GREEN CONFIRMED: 15 passed, 0 failed. Cargo exit code: 0. Log: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14w-targeted-green_20260825_015528_335\reports\v1-14w-b-targeted-green.log

## Risks or limitations

- V1.14W is intentionally private-copy dry-run only; it does not authorize or implement live Apply.
- Full Rust regressions and the real V1.14V private-copy dry run remain separate gates after targeted GREEN.

## Rollback guidance

Restore main.rs from: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14w-targeted-green_20260825_015528_335\source-before-stage-b\main.rs
Restore database.rs from: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14w-targeted-green_20260825_015528_335\source-before-stage-b\database.rs
Restore corporate_action_imports.rs from: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14w-targeted-green_20260825_015528_335\source-before-stage-b\corporate_action_imports.rs
Delete: src-tauri-shell\src\database\corporate_action_imports\five_pair_consolidation.rs

## Production-data safety

- Stage B source patch does not open the production/live database.
- Unit tests use in-memory SQLite fixtures only.
- Production database writes: 0.
- Live Apply capability: 0.


## V1.14W-C3 Stack-Safe Final Validation

**Finalized:** 2026-08-25 09:29:00 IST

- Exact V1.7A failing test isolated: test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 357 filtered out; finished in 11.77s
- V1.7A group serial: test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 354 filtered out; finished in 3.82s
- V1.14W targeted: test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 342 filtered out; finished in 0.60s
- V1.14T regression: test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 355 filtered out; finished in 0.04s
- Phase 5B regression: test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 353 filtered out; finished in 0.01s
- Phase 3 atomicity: test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 354 filtered out; finished in 0.08s
- Phase 6A regression: test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 355 filtered out; finished in 0.13s
- Full Rust suite serial: test result: ok. 357 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 160.39s
- cargo check: PASS
- Exact private-copy real-data dry run: PASS
- Post-state fingerprint: 8953723E83FE67351C6463A9D856A4B28C230D7088C22C638A815B44E110967B
- Apply-plan fingerprint: B926042A76323C273C48BFD5A21C60D609F78091EC6B3111EE47DE788EC4CB96
- Live database writes: 0
- Live Apply capability: 0
- Existing V1.7A parallel-test isolation issue recorded separately; no binary_eod source change in V1.14W.
