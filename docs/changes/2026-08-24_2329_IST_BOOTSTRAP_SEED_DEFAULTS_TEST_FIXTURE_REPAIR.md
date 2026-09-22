# Bootstrap seed_defaults test-fixture repair

**IST timestamp:** 2026-08-24 23:29:48 IST

## Objective

Repair the two narrow seed_defaults unit-test fixtures so they provide every table seed_defaults currently requires, without changing production bootstrap behavior.

## Previous defect or limitation

setup_test_db() created settings and watchlists only. seed_defaults() now also calls seed_market_holidays(), whose production prerequisite table market_holidays is created by run_migrations(). The narrow fixture therefore failed with `no such table: market_holidays`.

## Files changed

- src-tauri-shell\src\database\bootstrap.rs (test fixture only)

## Final implementation

- Added the production-compatible minimal `market_holidays` table definition to `setup_test_db()`.
- Did not change `seed_defaults()`, `seed_market_holidays()`, migrations, holiday data, or production initialization order.

## Validation commands

- `cargo test --manifest-path src-tauri-shell\Cargo.toml test_seed_defaults_ -- --nocapture`
- `cargo test --manifest-path src-tauri-shell\Cargo.toml`
- `cargo check --manifest-path src-tauri-shell\Cargo.toml`

## Actual validation results

- Isolated seed-default tests: test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 340 filtered out; finished in 0.03s
- Full Rust suite: test result: ok. 341 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 61.59s
- Cargo check: PASS

## Source identity

- bootstrap.rs before SHA-256: 2462F151F199C58895BB70EFFE698650967D3665242B71099D341D83626EA9DC
- bootstrap.rs after SHA-256: 2AC2ECF008735D6F41CD3795D0C4EFB97FD12D247B0AB5FF66A1B6DE008C0DDB
- V1.14T corporate_action_imports.rs unchanged SHA-256: 7481A3B7B695F3AE70A978C707352E2B8DDEEC0A121BAB23E54FAF3CBECE5EFD
- V1.14T focused tests unchanged SHA-256: D3CEC09D8813ADD1A560F4B385488522405809A3F872D0867FCB7292CBCDC397

## Risks or limitations

- This is a test-fixture correction only. It does not alter runtime bootstrap behavior.
- The fixture intentionally remains minimal rather than invoking the entire migration pipeline.

## Rollback guidance

Restore: E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14t-ordinary-equivalent-dedupe_20260824_183351_460\source-before-stage3b-r1\bootstrap.rs
Expected pre-repair bootstrap.rs SHA-256: 2462F151F199C58895BB70EFFE698650967D3665242B71099D341D83626EA9DC

## Production-data safety

- No production database was opened by this repair script.
- No production database write, Corporate Action approval, Quick Resolve, deletion, or five-row repair was performed.
