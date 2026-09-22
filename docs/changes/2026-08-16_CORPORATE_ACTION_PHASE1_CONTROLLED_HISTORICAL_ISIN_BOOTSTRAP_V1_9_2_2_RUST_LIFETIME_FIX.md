# Corporate Action Phase 1 V1.9.2.2 — Rust Lifetime Compatibility Fix

## Scope

Narrow compile-only compatibility correction for V1.9.2.1.

The two SQLite loaders in `historical_isin_bootstrap.rs` returned the terminal `statement.query_map(...).collect(...)` expression directly. Rust correctly rejected that shape with `E0597` because the mapped-row temporary could be dropped after the local prepared statement.

V1.9.2.2 binds each collected result to a local `rows` variable and returns `Ok(rows)`, matching the existing working rusqlite pattern already used in `corporate_action_imports.rs`.

## Preserved behavior

- Candidate set remains the reviewed 283 V1.9.1.1 `BOOTSTRAP_SAFE` imports.
- Expected unchanged-state dedupe remains 281 unique historical-ISIN tuples.
- No Corporate Action approval is added.
- No factor, price exception, or raw EOD mutation is added.
- Preview remains zero-write against a private DB+WAL snapshot.
- Apply still requires the exact READY Preview manifest, verified backup, direct hash gates, and one Rust transaction.
- The strict historical-ISIN writer still has no unrelated import-promotion side effect.

## Validation gate

Run the package again with `-RunValidation`. The script must complete focused V1.9.2 Rust tests, regression suites, renderer checks, and `tauri:check`, then stop before live Preview.
