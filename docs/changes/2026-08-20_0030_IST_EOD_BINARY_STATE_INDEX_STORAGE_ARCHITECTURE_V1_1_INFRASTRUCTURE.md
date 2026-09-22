# EOD Binary State Index Storage Architecture V1.1 — State Index Infrastructure

**Date:** 2026-08-20  
**Scope:** V1.1 only  
**Runtime acceleration enabled:** No  
**Canonical `.eod` format changed:** No  
**Bhavcopy behavior changed:** No

## Purpose

V1.1 introduces the isolated backend infrastructure required for the approved Storage Architecture V1 design:

- a dedicated `eod_binary_state.sqlite` sidecar schema;
- `VERIFIED`, `DIRTY`, and `UNKNOWN` state types;
- `AUTO`, `FAST`, and `FULL_VERIFY` mode types for later stages;
- canonical physical `.eod` inspection for bootstrap/rebuild;
- atomic bootstrap publication using `bootstrap_status`;
- a metadata-only filesystem census;
- per-symbol trust reconciliation that rejects file size/mtime/path mismatches;
- focused temporary-database tests;
- an explicit ignored real-database bootstrap audit test.

V1.1 does **not** connect this state index to Bhavcopy, Quote Editor, Manual Import, recovery, chart reads, or the UI.

## Source basis

Preflight ZIP:

```text
storage-architecture-v1-1-source-preflight_20260820_002754.zip
SHA-256 53AE53CF47E17ABECD8E855CF7926D9F3985FE506CDE0D3636864FDA791CDDDD
```

Audited source identity:

```text
src-tauri-shell/src/database.rs
32846FD475D921D47B989985CC6602DB90A99A96BD1C83D6FA475308A7C7A683

src-tauri-shell/src/database/binary_eod.rs
1D6AD4520D3496EF033BEF7D86465181E7207053AD3D26DC5D7AE4F4C1AFD02F

src-tauri-shell/src/database/eod_data.rs
C4E50217E37F7EC5C67FC1E2F8943854E8C54B0DFA1288BE13954E3C7F8E0D1B

src-tauri-shell/Cargo.toml
D1199096F9EA2548FD011BC120ABD15407849A75D9AAA14240DF1D250A020D42
```

## Source changes

### New

```text
src-tauri-shell/src/database/eod_binary_state.rs
src-tauri-shell/src/database/eod_binary_state/tests.rs
```

Responsibilities:

- sidecar open/create;
- schema version 1;
- bootstrap metadata;
- canonical `.eod` inspection;
- state rebuild;
- trusted-state load;
- filesystem census;
- census mismatch invalidation;
- focused tests.

### Modified

```text
src-tauri-shell/src/database.rs
```

Change:

```rust
pub mod eod_binary_state;
```

No other production module is modified in V1.1.

## Sidecar trust contract

Sidecar path:

```text
<active database folder>\eod_binary_state.sqlite
```

The sidecar is derived acceleration state only. `.eod` files remain canonical.

A freshly created sidecar begins:

```text
schema_version = 1
index_generation = 0
bootstrap_status = INCOMPLETE
```

A rebuild first persists `INCOMPLETE`, physically inspects the canonical `.eod` set, then publishes all rows and `COMPLETE` in one final SQLite transaction. A failed rebuild therefore leaves the sidecar untrusted.

`load_verified()` returns no trusted rows while bootstrap is incomplete.

## Bootstrap physical inspection

For each canonical `.eod` file V1.1 validates:

- binary header format through `BinaryEodFile::open`;
- file length equals `HEADER_SIZE + record_count * RECORD_SIZE`;
- first and last record dates can be read when records exist;
- first date is not greater than last date;
- file modification timestamp is representable in SQLite;
- path is under the selected database folder.

The state key is derived from the canonical exchange folder and `.eod` filename. V1.1 deliberately does not require the fixed-width header symbol field to equal the full filename because the binary header stores at most 32 symbol bytes while valid index names can exceed that length.

## Filesystem census

The census opens no `.eod` contents. It compares:

```text
relative_path
file_length
file_mtime_ns
existence
```

A `VERIFIED` row remains trusted only when these values match. Any changed/missing indexed file becomes `UNKNOWN`. `DIRTY` and `UNKNOWN` rows are never returned in the trusted snapshot.

New physical files not yet present in the sidecar make the snapshot unhealthy; they are not guessed or auto-promoted.

## Real database proof

The ignored test:

```text
v11_real_database_bootstrap_audit
```

runs only when explicitly invoked with:

```text
EOD_BINARY_STATE_AUDIT_FOLDER
EOD_BINARY_STATE_EXPECTED_FILES
```

It rebuilds the sidecar from the actual `.eod` database, reconciles a census, and requires:

```text
bootstrap complete
healthy
indexed == verified
dirty == 0
unknown == 0
indexed == independently counted physical .eod files
```

This test writes only the derived sidecar. It does not write any `.eod` file.

## Validation gates

Focused:

```powershell
cargo test --manifest-path .\src-tauri-shell\Cargo.toml eod_binary_state -- --nocapture
```

Broader backend/Tauri:

```powershell
& ".\scripts\validate-change.ps1" `
    -Profile tauri `
    -Paths @(
        "src-tauri-shell/src/database.rs",
        "src-tauri-shell/src/database/eod_binary_state.rs",
        "src-tauri-shell/src/database/eod_binary_state/tests.rs",
        "docs/superpowers/specs/2026-08-19-eod-binary-state-index-storage-architecture-v1-design.md",
        "docs/superpowers/plans/2026-08-19-eod-binary-state-index-storage-architecture-v1-implementation-plan.md",
        "docs/changes/2026-08-20_0030_IST_EOD_BINARY_STATE_INDEX_STORAGE_ARCHITECTURE_V1_1_INFRASTRUCTURE.md"
    )
```

V1.2 must not begin until V1.1 focused tests, Tauri validation, and real-database bootstrap/census proof pass.

## Rollback

Rollback restores the exact pre-V1.1 `database.rs` and removes the new module. The sidecar is optional derived state and may remain; pre-V1.1 source ignores it. The rollback script provides an explicit `-RemoveStateSidecar` switch if removal is desired while the application is closed.
