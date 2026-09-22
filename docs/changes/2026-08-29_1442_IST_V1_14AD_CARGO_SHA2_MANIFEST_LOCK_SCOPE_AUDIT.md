# V1.14AD Cargo sha2 Manifest / Lockfile Scope Audit

**IST timestamp:** 2026-08-29 14:42:57 +05:30 IST

## Objective

Isolate the exact Cargo.toml and Cargo.lock delta required by the cumulative Corporate Action baseline's direct `sha2` imports without promoting unrelated manifest or lockfile drift.

## Previous limitation

The R3 cumulative baseline assembled cleanly except for one genuine build-manifest blocker: accepted Corporate Action Rust modules directly import `sha2` while Git HEAD Cargo.toml does not declare it. Current Cargo.toml and Cargo.lock are modified in the working tree, so whole-file promotion cannot be assumed safe.

## Files inspected

- Exact R3 reports ZIP, summary, manifest dependency audit and state.
- Git HEAD and current `src-tauri-shell/Cargo.toml`.
- Git HEAD and current `src-tauri-shell/Cargo.lock`.

## Files created

- Exact HEAD/current Cargo manifest copies and diffs.
- Synthetic `HEAD + sha2 = 0.10` Cargo.toml.
- Offline Cargo-resolved sha2-only Cargo.lock.
- Candidate-to-current remainder diffs.
- Context-rich HEAD-to-sha2-only Cargo manifest/lock patch when resolution succeeds.
- Cargo metadata evidence, scope summary/state, this report and reports ZIP.

## Files modified

- No live Cargo.toml.
- No live Cargo.lock.
- No production source/test file.
- No live Git index entry.
- No database or build/package output.

## Final implementation

The audit reads exact Git HEAD manifest/lock blobs, adds only the already-verified current declaration `sha2 = 0.10` to a disposable HEAD Cargo.toml, runs offline `cargo metadata --no-deps` so Cargo updates only the external candidate lockfile, then reruns metadata with `--locked --offline` to prove the generated lock is stable. A contextual patch is generated from exact HEAD bytes to this independently resolved sha2-only candidate and replayed against a second standalone HEAD sandbox.

## Validation commands

- `git show HEAD:src-tauri-shell/Cargo.toml` / `Cargo.lock`.
- `cargo metadata --no-deps --format-version 1 --offline` in an external minimal package sandbox.
- `cargo metadata --no-deps --format-version 1 --locked --offline` against the generated candidate.
- Standalone `git apply --check` and `git apply` of the generated Cargo contextual patch.

## Actual validation results

- Classification: **CA_CARGO_SHA2_SCOPE_CONTEXTUAL_PATCH_REQUIRED**.
- Cargo version: `cargo 1.95.0 (f2d3ce0bd 2026-03-21)`.
- Current Cargo.toml semantic delta only sha2: False.
- Candidate Cargo.toml SHA-256: `A4231F9AD2D201DA4D933D8BEF5159938C7226DF59C8A734FDF7905EDDFB83F3`.
- Candidate Cargo.lock SHA-256: `7918E7D71F3E33308011B77491B236BE7CFD2D7AD438A3428D2DDE8AEFD186BD`.
- Contextual patch SHA-256: `50EAD3164EB0D89737D72800C4A144B4E9AD906C260091E20FA1EDD099509520`; check/apply 0/0.

## Behavior deliberately preserved

- Git HEAD authority remains unchanged.
- Current live Cargo.toml/Cargo.lock bytes remain unchanged.
- R3 cumulative CA source candidate is not compiled or mutated by this gate.
- Unrelated current working-tree changes remain untouched.

## Risks / limitations

- Offline Cargo resolution is intentionally constrained to locally available registry/index data. If it cannot resolve the exact dependency, the audit blocks rather than using network access.
- A valid sha2-only patch authorizes only the next disposable cumulative-baseline compile/test gate; it does not authorize live staging.

## Recommended next step

Apply only the generated contextual sha2 Cargo patch to the disposable cumulative baseline, then run the compile/test validation gate. Do not promote the current Cargo files wholesale.

## Rollback guidance

No production rollback is required. This audit creates external disposable files only and leaves live Cargo manifests/index untouched.

## Status

**V1_14AD_CARGO_SHA2_MANIFEST_LOCK_SCOPE_AUDIT_COMPLETE**
