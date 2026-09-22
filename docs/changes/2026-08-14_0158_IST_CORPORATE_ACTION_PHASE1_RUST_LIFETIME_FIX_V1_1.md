# Corporate Action Phase 1 Rust Lifetime Fix V1.1

**IST timestamp:** 2026-08-14 01:58 IST  
**Project:** `E:\TA Projects\EOD Charting Platform`  
**Basis:** Corporate Action Phase 1 Split + Bonus Review Validation V1 already applied to the live project.

## Objective

Correct the Rust borrow-lifetime compile failure exposed by the first V1 validation run, without changing Phase 1 business logic or UI behavior.

## Previous defect

The V1 validation run passed the focused frontend suite (10/10 tests) but Rust compilation failed with `E0597` in `src-tauri-shell/src/database/corporate_action_imports.rs` around the new targeted scan query.

The final expression returned a `MappedRows`-derived temporary whose destructor could outlive the local prepared `statement` binding from the borrow checker's perspective.

Observed failure:

```text
error[E0597]: `statement` does not live long enough
src\database\corporate_action_imports.rs:6491
```

## Files changed

- Modified: `src-tauri-shell\src\database\corporate_action_imports.rs`
- Created: `docs\changes\2026-08-14_0158_IST_CORPORATE_ACTION_PHASE1_RUST_LIFETIME_FIX_V1_1.md`

## Final implementation

Both branches of `load_scan_candidates()` now collect query rows into a local `rows` value before returning:

```rust
let rows = statement
    .query_map(...)?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| error.to_string())?;
Ok(rows)
```

For the targeted-ID branch, the same lifetime-safe pattern ends with `return Ok(rows);`.

This forces the query iterator temporary to be dropped while the prepared statement is still alive, matching the compiler's recommended correction.

## Behavior deliberately preserved

No Phase 1 behavior is changed:

- official Split/Bonus factor remains authoritative;
- targeted Split/Bonus scan behavior is unchanged;
- ordinary approval still requires current `MATCHED` validation;
- exceptional audited approval behavior is unchanged;
- identity/ISIN protection is unchanged;
- genuine ex-date market gaps remain untouched;
- Rights, Dividend and Demerger behavior remains out of scope;
- the read-time Corporate Action adjustment engine is unchanged.

## Validation evidence before V1.1

From the user's V1 apply run:

- Focused Vitest: **PASS — 1 file, 10/10 tests**.
- Rust Corporate Action test command: **FAILED TO COMPILE** with `E0597` before tests executed.
- Later validation gates did not run because the apply script stopped at the Rust failure.

## Validation commands for V1.1

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_imports -- --nocapture
cargo test --manifest-path src-tauri-shell/Cargo.toml eod_data -- --nocapture
npm run typecheck:renderer
npm run build:renderer
npm run tauri:check
```

The V1.1 apply script also reruns the focused Corporate Action Vitest suite before the Rust gates.

## Actual V1.1 validation results

Not yet executed on the user's Windows development environment at package creation time. Do not mark these gates PASS until command output confirms them.

## Risks / limitations

This is intentionally a minimal lifetime correction. It does not alter SQL, candidate filtering, approval policy, adjustment mathematics, database schema, or UI logic.

## Rollback

The V1.1 apply script backs up the current V1 `corporate_action_imports.rs` before replacement. To roll back, restore that file from the generated `tmp\corporate-action-phase1-v1-1-backup_*` directory and remove this V1.1 change report if required.
