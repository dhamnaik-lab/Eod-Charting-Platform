# V1.14AD Cargo sha2 Manifest / Lockfile Scope Audit R1

**IST timestamp:** 2026-08-29 18:03:27 +05:30 IST

## Objective

Correct the prior Cargo scope-audit defect by constructing the exact minimal `sha2` manifest/lock delta and validating the complete dependency graph without `--no-deps`.

## Previous defect or limitation

The previous audit added ``sha2 = "0.10"`` to its synthetic Cargo.toml but left Cargo.lock byte-identical to Git HEAD. Its root package dependency list therefore still omitted ``sha2`` even though the current working-tree lockfile contained that root edge. The previous generated patch changed Cargo.toml only and is not staging authority.

## Files changed

- No live source/configuration file.
- No live Cargo.toml or Cargo.lock.
- No Git index entry.
- Audit evidence/report files only.

## Final implementation

R1 starts from exact Git HEAD Cargo.toml/Cargo.lock bytes, adds only ``sha2 = "0.10"`` to the manifest and only ``"sha2",`` to the root package dependency array in Cargo.lock. It requires all existing package records — including the already-present sha2 0.10.9 package and checksum — to remain byte-semantically unchanged. It then runs full ``cargo metadata --locked --offline`` and ``cargo tree --locked --offline`` in an external disposable package and requires Cargo not to mutate either candidate file.

## Validation commands

- `cargo metadata --format-version 1 --locked --offline`.
- `cargo tree --locked --offline --charset ascii`.
- Standalone `git apply --check` and `git apply` of the exact two-file contextual Cargo patch.

## Actual validation results

- Classification: **CA_CARGO_SHA2_SCOPE_R1_VALIDATION_BLOCKED**.
- Candidate Cargo.toml SHA-256: `A4231F9AD2D201DA4D933D8BEF5159938C7226DF59C8A734FDF7905EDDFB83F3`.
- Candidate Cargo.lock SHA-256: `88C05F566B84F3A2D57E97882AD35323BE2A49B8715FBD38A24063B7DA3853F2`.
- Root dependencies added: sha2.
- Non-root lock package changes: 0.
- `cargo metadata --locked --offline` exit: 0.
- Metadata reports direct sha2 dependency: True.
- `cargo tree --locked --offline` exit: 0.
- Cargo tree contains `sha2 v0.10.9`: False.
- Cargo mutated candidate files: False.
- Contextual patch SHA-256: `FA5BFB023103AFA821141E8D93301459DE135D2481BD0B2522F8F097EE87343E`.
- Contextual patch check/apply: 0 / 0.

## Behavior deliberately preserved

- Git HEAD package versions and every non-root Cargo.lock package record.
- Current live Cargo.toml/Cargo.lock bytes.
- All unrelated working-tree changes.
- No source compilation, tests, database access or packaging.

## Risks or limitations

- This gate validates dependency resolution only; the assembled cumulative baseline still requires its own disposable compile/test validation.
- The current Cargo files contain additional drift and must not be promoted wholesale if the contextual-patch classification is accepted.

## Rollback guidance

No production rollback is required because live project Cargo files and Git index remain unchanged.

## Recommended next step

Resolve the R1 dependency-graph validation blocker before any compile/test or staging operation.

## Status

**V1_14AD_CARGO_SHA2_MANIFEST_LOCK_SCOPE_AUDIT_R1_COMPLETE**
