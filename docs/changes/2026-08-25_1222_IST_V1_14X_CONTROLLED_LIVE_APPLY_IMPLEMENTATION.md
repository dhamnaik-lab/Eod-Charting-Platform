# V1.14X Controlled Live Apply Implementation

**IST timestamp:** 2026-08-25 12:22:33 IST

## Objective

Implement the separately authorized exact five-pair controlled live Corporate Action consolidation Apply, bound to the validated V1.14W Apply-plan and post-state fingerprints.

## Previous defect or limitation

V1.14W deliberately exposes private-copy dry-run only. V1.14X-A proved no live Apply maintenance path existed.

## Files changed

- src-tauri-shell\src\database\corporate_action_imports\five_pair_consolidation_apply.rs — new controlled live Apply orchestration.
- src-tauri-shell\src\database\corporate_action_imports\five_pair_consolidation.rs — exposes reusable exact-state helpers and supports required transaction behavior/fingerprint locks.
- src-tauri-shell\src\database\corporate_action_imports.rs — registers/re-exports V1.14X.
- src-tauri-shell\src\database.rs — re-exports V1.14X runner.
- src-tauri-shell\src\main.rs — dispatches V1.14X before V1.14W and normal startup.

## Final implementation

- Requires --maintenance-corporate-action-v114x --mode apply and exact token V1.14X_LIVE_APPLY_AUTHORIZED.
- Requires exact C3 V1.14W Apply-plan manifest SHA/fingerprint and exact post-state fingerprint.
- Requires exact V1.14V live path/family before SQLite open.
- Requires a verified independent pre-write backup manifest covering main, WAL, and forensic SHM; recovery policy is main+WAL only.
- Uses TransactionBehavior::Immediate.
- Revalidates exact pre-state/schema inside the write transaction.
- Reuses the V1.14W five-pair mutation and protected-state validation logic.
- Requires exact post-state and Apply-plan fingerprints before commit.
- Performs post-commit quick_check, foreign_key_check, and post-state fingerprint audit.
- Emits committed-failure markers rather than silently treating post-commit reporting/audit failures as rollback-safe.

## Validation commands

- cargo test --manifest-path src-tauri-shell\Cargo.toml v114x_ -- --nocapture
- cargo test --manifest-path src-tauri-shell\Cargo.toml v114w_ -- --nocapture
- cargo test --manifest-path src-tauri-shell\Cargo.toml v114t_ -- --nocapture
- cargo test --manifest-path src-tauri-shell\Cargo.toml -- --test-threads=1
- cargo check --manifest-path src-tauri-shell\Cargo.toml

## Actual validation results

V1.14X targeted GREEN: test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 358 filtered out; finished in 0.08s

V1.14W regression: test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 353 filtered out; finished in 0.11s

V1.14T regression: test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 366 filtered out; finished in 0.05s

Full Rust serial suite: test result: ok. 368 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 92.58s

Cargo check: PASS

## Risks or limitations

- Stage B does not execute the live Apply or open the production database.
- The existing V1.7A parallel-test isolation issue remains separate; full regression is intentionally serialized.
- Live execution remains gated on a fresh quiescent-family check and verified pre-write backup.

## Rollback guidance

- Restore main.rs, database.rs, corporate_action_imports.rs, and five_pair_consolidation.rs from E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14x-targeted-green_20260825_122233_662\source-before.
- Delete five_pair_consolidation_apply.rs.
- V1.14X-A test registration/file remain valid TDD evidence.

