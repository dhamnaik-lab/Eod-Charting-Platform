# Corporate Action Phase 1 — V1.14E.2 Focused Rustfmt Validation Compatibility

**Date:** 2026-08-19 IST  
**Mode:** SOURCE FORMATTING + VALIDATION COMPATIBILITY ONLY  
**Live database tranche:** NOT APPLIED  
**Mutation authorization:** NONE

## Failure reviewed

The V1.14E source payload installed successfully and all 19 installed-source/package authority
checks passed. Validation then stopped at:

```text
cargo fmt --manifest-path src-tauri-shell/Cargo.toml --check
```

The command checks the entire Rust crate. The accepted source already contains rustfmt drift in
unrelated files such as `bhavcopy.rs`, `bhavcopy_recovery.rs`, `binary_eod.rs`,
`manual_import_recovery.rs`, and `plugin_data.rs`, so the whole-crate gate cannot distinguish
pre-existing formatting debt from V1.14E changes.

The same output also showed ordinary rustfmt differences in the three new V1.14E modules.

## Narrow correction

V1.14E.2 changes exactly three production source files:

```text
src-tauri-shell/src/database/corporate_action_imports/event_identity_authority.rs
src-tauri-shell/src/database/corporate_action_imports/event_identity_resolution.rs
src-tauri-shell/src/database/corporate_action_imports/event_identity_maintenance.rs
```

Their payloads are reconstructed from the exact Windows `cargo fmt --check` diff:

```text
authority module   : 3 rustfmt hunks
resolution module  : 3 rustfmt hunks
maintenance module : 11 rustfmt hunks
```

No business logic, authority JSON, shared Rust module, TypeScript, React, or canonical project
documentation is changed.

## Validation policy correction

The compatibility runner does **not** use whole-crate `cargo fmt --check`.

It runs:

```text
rustfmt --edition 2021 --check
```

against only the exact three new V1.14E modules, then resumes the originally planned validation:

1. focused `v114e` Rust tests;
2. compound scanner regressions;
3. targeted scanner loader regression;
4. event-identity renderer test;
5. renderer typecheck;
6. Tauri/cargo compile check.

This leaves unrelated pre-existing formatting debt untouched.

## Authority preservation

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
