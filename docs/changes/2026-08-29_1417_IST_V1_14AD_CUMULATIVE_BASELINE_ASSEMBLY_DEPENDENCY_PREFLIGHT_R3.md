# V1.14AD Cumulative Baseline Assembly + Dependency Preflight R3

**IST timestamp:** 2026-08-29 14:17:08 +05:30 IST

## Objective

Preserve the proven raw-Git-blob/external baseline assembly, apply exactly one disposable-only EOF hygiene byte, correct Rust module and crate dependency classification, and isolate any genuine build-manifest dependency before compile/test validation.

## Previous defect / limitation

R2 assembled and hash-verified the baseline correctly but its analyzer reported one real whitespace defect, 27 false unresolved Rust modules, and eight apparent missing Rust crates. The Rust module resolver used the source parent rather than the Rust file-module directory, and the crate scanner treated local modules as external crates while destructively changing underscores to hyphens.

## Files inspected

- Exact reconstruction ZIP/patch/result manifest/25-path allowlist.
- Exact R2 assembly manifest, dependency graph, manifest audit, whitespace evidence, summary and state.
- Verified source snapshot.
- Live/current `Cargo.toml` and `Cargo.lock` identities.
- `src/features/corporateActions/corporateActionCompoundValidation.ts` exact PRE bytes.

## Files created

- External raw-blob `head-tree` and disposable `assembled-baseline-tree`.
- Corrected assembly/dependency evidence under this run's reports directory.
- `39-disposable-one-byte-hygiene.json` documenting PRE/POST one-byte normalization.
- This mandatory `docs\\changes` report and compact reports ZIP.

## Files modified

- **Live production/source/config/test files: none.**
- **Live Git index: unchanged.**
- Disposable baseline only: `corporateActionCompoundValidation.ts` loses exactly one redundant terminal LF.
- `Cargo.toml` and `Cargo.lock` are inspected only; neither is promoted or changed.

## Final implementation

- Rust `mod foo;` resolution now follows Rust file-module layout: `database.rs` -> `database/foo.rs` and `corporate_action_imports.rs` -> `corporate_action_imports/foo.rs`.
- Bare Rust `use name::...` roots are classified as local when they resolve to a child/sibling/crate-root project module.
- Cargo dependency names are compared with hyphen/underscore canonical equivalence without rewriting evidence names.
- Exactly one disposable-only LF is removed from `corporateActionCompoundValidation.ts` under locked PRE/POST SHA-256 identities.
- The analyzer intentionally leaves Git-HEAD `Cargo.toml`/`Cargo.lock` in the assembled baseline so a genuine CA manifest dependency remains visible.

## Validation commands / evidence

- Exact Git HEAD and clean live index guards.
- Exact R2 and reconstruction artifact SHA-256 guards.
- Raw Git blob HEAD materialization with object-ID verification.
- Final contextual patch check/apply with anti-skip guard and exact shared-file hashes.
- `git diff --no-index --check` after one-byte disposable hygiene.
- Corrected TypeScript/Rust direct dependency scan.
- `cargo metadata --no-deps --format-version 1 --locked --offline` on the disposable baseline only.

## Actual validation results

- Whitespace clean: True.
- Disposable hygiene: 1 file / 1 byte.
- Hygiene POST SHA-256: `E482352BBA472B8705C978FC0530DE8B65412BA7B01CBC16B9004F9271D3524F`.
- Unresolved local dependencies: 0.
- Missing Node packages: 0.
- False Rust missing candidates eliminated: 7.
- Genuine missing Rust crates: 1 — `sha2`.
- Cargo metadata exit: 0.

## Classification

**CA_CUMULATIVE_BASELINE_ASSEMBLED__CARGO_SCOPE_AUDIT_REQUIRED**

Static dependency analysis is otherwise clean, but the CA baseline imports sha2 while Git-HEAD Cargo.toml does not declare it. Cargo.toml/Cargo.lock attribution must be isolated before compile/test validation.

## Behavior deliberately preserved

- Exact accepted Corporate Action production/test bytes in the live project.
- Exact live `Cargo.toml` and `Cargo.lock` bytes.
- All unrelated working-tree changes.
- Live Git index.
- Production database family and build/package outputs.

## Risks / limitations

- No Rust compilation, Vitest, TypeScript typecheck or Tauri build is run in R3.
- The baseline cannot proceed to compile/test validation while its Git-HEAD Cargo manifest lacks a crate imported by accepted Corporate Action source.
- Current `Cargo.toml`/`Cargo.lock` contain other accumulated changes, so whole-file promotion is not authorized by this audit.

## Recommended next step

Run a read-only `Cargo.toml` / `Cargo.lock` scope audit against Git HEAD to isolate the exact CA-required `sha2` dependency hunks and lockfile closure before adding them to the disposable cumulative baseline.

**git add is intentionally not executed.**

## Rollback guidance

No live rollback is required. Delete the external R3 run directory to remove the disposable baseline. The verified source snapshot remains the recovery authority.

## Status

**V1_14AD_CUMULATIVE_BASELINE_ASSEMBLY_DEPENDENCY_PREFLIGHT_R3_COMPLETE**
