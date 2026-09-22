# V1.14AD Compound Equivalent-Event Deduplication

**Original IST source-change timestamp:** 2026-08-26 19:10:51 +05:30 IST
**Reporting correction timestamp:** 2026-08-26 20:50:01 +05:30 IST

## Objective

Prevent same-date Split/Bonus validation from multiplying multiple Corporate Action import rows that are economically equivalent representations of one event after alias/event-symbol projection.

## Previous defect or limitation

V1.14AD-A confirmed COMPOUND_MEMBER_SET_COUNTS_EQUIVALENT_ALIAS_IMPORTS_AS_SEPARATE_ECONOMIC_EVENTS across KSB/KSBPUMPS, BBOX/AGCNET, and NAVA/NBVENTURES. Current compound validation counted two x2 alias imports as separate economic components and therefore expected x4, while existing event-equivalence semantics reduced each pair to one economic x2 event.

## Files changed

- src-tauri-shell\src\database\corporate_action_imports.rs
- src-tauri-shell\src\database\corporate_action_imports\v114ad_tests.rs
- This change report.

## Final implementation

load_same_date_split_bonus_compound_context now:

1. Loads same-date Split/Bonus member economic fields.
2. Preserves effective event-symbol projection.
3. Requires exact equality of action type, record date, ratio values, face values, cash amount, and factor before two rows can be considered duplicate economic representations.
4. Reuses the existing load_event_date_import_identities plus event_date_identities_are_equivalent safeguards.
5. Counts an equivalent economic event only once before compound-factor multiplication.
6. Preserves distinct Split+Bonus events, conflicting ISIN identities, and conflicting factors.

When deduplication leaves one economic member, the existing build_compound_scan_context contract returns no compound context, so normal single-event factor validation remains in force.

## Validation commands

- cargo test --manifest-path src-tauri-shell\Cargo.toml v114ad_duplicate_same_economic_bonus_imports_dedupe_before_compound_factor -- --nocapture
- cargo test --manifest-path src-tauri-shell\Cargo.toml v114ad -- --nocapture
- cargo test --manifest-path src-tauri-shell\Cargo.toml phase1_v17 -- --nocapture
- cargo test --manifest-path src-tauri-shell\Cargo.toml phase5b -- --nocapture
- cargo test --manifest-path src-tauri-shell\Cargo.toml phase1_price_validation_gate -- --nocapture
- cargo test --manifest-path src-tauri-shell\Cargo.toml
- cargo check --manifest-path src-tauri-shell\Cargo.toml

## Actual validation results

- TDD RED (expected failure before production fix): test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 375 filtered out; finished in 0.09s
- V1.14AD focused GREEN: test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 372 filtered out; finished in 0.08s
- Existing compound regression: test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 372 filtered out; finished in 0.00s
- Phase 5B equivalence regression: test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 371 filtered out; finished in 0.01s
- Price-validation gate regression: test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 374 filtered out; finished in 0.01s
- Full Rust suite: test result: ok. 375 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 89.91s
- cargo check: PASS; dev profile completed successfully.
- Production source before SHA-256: 7FF8A707D2AE754324443EA64E6722F9599DF85C4EDBC6466C3B15CB9F168C14
- Production source after SHA-256: 450507EA2E6E195FCA0B654BD359A1E956BC5DBC9F57C81FF08FC215FF5C749B
- V1.14AD test SHA-256: F6CFC767B445AB87F40BA3739401FF51E349F80F8FC7F9783C8ED8596ADF057C
- Live database MAIN/WAL/SHM byte identity during B1: PASS.
- Production SQLite opens/writes by B1: 0.

## Behaviour deliberately preserved

- Genuine same-date Split+Bonus multiplication.
- Existing compound fingerprint construction for remaining genuine compounds.
- Existing event-symbol projection.
- Existing event-date identity semantics.
- Conflicting ISIN fail-closed behavior.
- Conflicting factors remain separate components.
- Split/Bonus price-validation confidence threshold.
- Approval/exception gates.
- Import/evidence provenance.
- Raw binary EOD data and live SQLite state.

## Risks or limitations

- The primary risk is over-deduplication. The implementation therefore requires both exact economic-term equality and existing event-date identity equivalence.
- This B1 stage validates source behavior with in-memory test databases only. The accepted three historical cases still require a private real-data replay in V1.14AD-B2.
- Existing historical scan rows were not rewritten by B1.

## Rollback guidance

Restore:

E:\TA Projects\EOD Charting Platform\tmp\corporate-action-v1-14ad-b1-r1-compound-equivalent-event-dedupe_20260826_191051_600\rollback\corporate_action_imports.rs.pre-v114ad-b1

to:

E:\TA Projects\EOD Charting Platform\src-tauri-shell\src\database\corporate_action_imports.rs

Delete:

E:\TA Projects\EOD Charting Platform\src-tauri-shell\src\database\corporate_action_imports\v114ad_tests.rs

Then rerun the V1.14AD, Phase 5B, compound, price-gate, full Rust, and cargo-check validations.

## Reporting correction note

The original B1 report contained PowerShell backtick-expanded Markdown/control characters and literal validation placeholder names. This correction changes documentation only; it does not rerun or alter the accepted source/test validation.
