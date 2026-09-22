# Corporate Action Phase 1 — V1.14E.3 Rust Compile Compatibility

**Date:** 2026-08-19 IST  
**Mode:** TWO-FILE COMPILE FIX + VALIDATION CONTINUATION  
**Live database tranche:** NOT APPLIED  
**Mutation authorization:** NONE

## Compiler failures addressed

The V1.14E.2 focused rustfmt gate passed. The subsequent focused Rust compilation then found
four errors representing two root causes.

### 1. Historical-ISIN bootstrap caller was stale

V1.14E changed:

```rust
is_split_bonus_validation_current(
    connection: &Connection,
    import_row: &CorporateActionImportRow,
    validation: &CorporateActionScanResultRow,
) -> AppResult<bool>
```

The existing V1.9.2 bootstrap still called the old two-argument boolean form.

V1.14E.3 changes exactly that call to:

```rust
is_split_bonus_validation_current(connection, &import_row, &validation)?
```

This preserves the V1.9.2 validation gate while allowing event-time identity to participate in
Split/Bonus validation currentness.

### 2. Test-only rusqlite API incompatibility

The V1.14E Preflight no-write regression used:

```rust
connection.total_changes()
```

The project is locked to:

```text
rusqlite = 0.31.0
Cargo.toml SHA-256: d1199096f9ea2548fd011bc120abd15407849a75d9aaa14240df1d250a020d42
Cargo.lock SHA-256: 68a14d7a9c904f0c981bc6529e82c439b2352eabbf2aa8be221f7f79fca778c5
```

The Windows compiler reported that this method is unavailable.

The test now uses the SQLite scalar function through the existing rusqlite query API:

```rust
connection.query_row("SELECT total_changes()", [], |row| row.get(0))
```

Production V1.14E behavior is unchanged; this is only a test helper.

## Exact source surface

Only:

```text
src-tauri-shell/src/database/corporate_action_imports/historical_isin_bootstrap.rs
src-tauri-shell/src/database/corporate_action_imports/event_identity_maintenance.rs
```

are modified.

Pre-fix SHA-256:

```text
historical_isin_bootstrap.rs : fcdd11bacb83ab5b79b07d8cb353b46e86ea5872bbf300618cad236c15547858
event_identity_maintenance.rs: 6924cf831a825a1c4ad188e44f73adc72a5d47cf13f78105254995168cc98621
```

Post-fix SHA-256:

```text
historical_isin_bootstrap.rs : 9ebdedb483a4fe455a7372fb3f288e212be63b0f662e55fec21306f7a998848d
event_identity_maintenance.rs: 0246200c10681648ac5f08ef7200a24a36ad4a920473d036f676acb566a8f206
```

## Authority preserved

```text
Events                  : 184
Chains                  : 44
Candidate ID fingerprint: dafd118bd35acb11076296f24830d5722e3ef1b5715e829c7a1499910845961c
Candidate set fingerprint: 4ab5f8ca1625932e559f5207c1e7a4baa8a4fc84f766c5f449af7ba0cb6135ab
Design authority        : c1d118d3eaa6d4b75c32c3bfa5ed9e538fa2d25e0a84436957c708a8da181c6b
```

## Safety

```text
Production DB opens : 0
Schema writes       : 0
Resolution writes   : 0
Raw import updates  : 0
Decision writes     : 0
Quick Resolves      : 0
Approvals           : 0
Git operations      : 0
```
