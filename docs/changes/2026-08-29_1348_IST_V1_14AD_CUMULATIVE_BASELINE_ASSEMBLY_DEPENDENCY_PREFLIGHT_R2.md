# V1.14AD Cumulative Baseline Assembly + Dependency Preflight R2

**IST timestamp:** 2026-08-29 13:48:08 +05:30 IST

## Objective

Assemble the exact cumulative Corporate Action source candidate from Git HEAD by overlaying the verified 25 whole-file-safe source/test paths and applying the final positional/contextual shared-file patch, then perform inexpensive dependency and manifest checks before any compile/test gate.

## Previous limitation

Source attribution and nine-file positional reconstruction are closed, but the cumulative baseline had not yet been materialized as one disposable tree. It was therefore not yet proven that the 25 safe files and final shared-file patch form a structurally self-contained candidate against Git HEAD.

The first assembly-preflight harness created its disposable trees under the live project tmp directory. Git therefore discovered the parent worktree and reported a skipped contextual patch with exit code 0, leaving the nested assembly at HEAD bytes. R1 moves both disposable trees outside the live repository and fails on any Git worktree discovery or Skipped patch diagnostic.

R1 then exposed a second materialization defect: git archive HEAD applies working-tree EOL conversion under the repository configuration, so LF Git blobs can become CRLF files before patching. R2 removes git archive entirely and materializes every regular HEAD file from raw git ls-tree -r -z HEAD object identities plus git cat-file blob <oid> bytes, verifying each published file against its Git blob OID.

## Files inspected

- Exact Git HEAD `f4278bc62649552f119fa6438b688a10dccef25e`.
- Exact positional/contextual reconstruction ZIP and final contextual patch.
- Exact nine-file final result-hash manifest.
- Exact 25-path whole-file-safe source/test allowlist.
- Verified 752-file source snapshot.
- Direct TypeScript/Rust local imports, Rust module/include relationships, package.json and Cargo.toml declarations in the disposable assembled baseline.

## Files created

- `head-tree` — disposable exact Git-HEAD archive.
- `assembled-baseline-tree` — exact HEAD plus 25 safe overlays plus final contextual patch.
- Assembly manifest, direct dependency graph, dependency-review CSV, manifest audit, whitespace evidence, Cargo metadata evidence, changed-path list, summary/state, this report, and reports ZIP.

## Files modified

- No production source/config/test file.
- No live-project Git index entry.
- No database.
- No build/package output.

## Final implementation

The audit enumerates exact HEAD entries with `git ls-tree -r -z HEAD`, reads each regular blob using `git cat-file blob <oid>`, verifies its raw Git blob object ID before and after filesystem publication, and builds the external disposable HEAD tree without checkout/archive filters. It clones that raw-byte tree, proves neither disposable tree belongs to any Git worktree, overlays exactly the 25 allowlisted files from the verified source snapshot, applies contextual patch `14011DFB...6BBECD` with verbose anti-skip guards, and validates all resulting shared-file hashes including an explicit `database.rs` proof. It then performs static local-import/module/include resolution, manifest dependency presence checks, an offline locked `cargo metadata --no-deps` parse, and an external no-index whitespace check.

## Validation commands / evidence

- Git HEAD and clean live-project index guard.
- Exact reconstruction ZIP/patch/result-manifest/allowlist/summary/state SHA-256 guards.
- Recomputed verified snapshot file-count/byte-count/tree SHA-256.
- Raw HEAD tree enumeration via `git ls-tree -r -z HEAD` and raw blob reads via `git cat-file blob`.
- Git blob object-ID verification before and after every external HEAD-file write.
- Contextual patch `git apply --check` and disposable apply.
- Exact resulting nine-file SHA-256/length validation.
- `git diff --no-index --check` between exact HEAD and assembled trees.
- Static TypeScript import and Rust module/include resolution.
- Node/Cargo manifest dependency declaration audit.
- `cargo metadata --no-deps --format-version 1 --locked --offline` against the assembled baseline only.

## Actual validation results

- Whole-file overlays: 25.
- Shared files verified: 9.
- Baseline scope: 34.
- Baseline paths differing from HEAD: 33.
- Contextual patch check/apply: 0 / 0.
- Whitespace clean: False.
- Direct local dependency edges: 50.
- Unresolved local dependencies: 27.
- High-risk direct dependency edges: 0.
- Informational changed dependency edges: 11.
- Missing Node packages: 0.
- Missing Rust crates: 8.
- Cargo metadata exit: 0.

## High-risk direct dependency edges

- None.

## Unresolved local dependencies

- `src-tauri-shell/src/database.rs` -> `binary_eod` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `bootstrap` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `bse_identity_imports` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `connection_registry` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `corporate_action_imports` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `eod_data` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `instrument_mutations` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `nse_identity_imports` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `official_source_urls` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `quotes` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `settings` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `storage_mode` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `symbol_search` — RUST_MOD.
- `src-tauri-shell/src/database.rs` -> `watchlists` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `controlled_identity_repair` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `event_identity_authority` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `event_identity_maintenance` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `event_identity_resolution` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `five_pair_consolidation` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `five_pair_consolidation_apply` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `historical_isin_bootstrap` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `repair_preview` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `v114ad_tests` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `v114t_tests` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `v114w_tests` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `v114x_tests` — RUST_MOD.
- `src-tauri-shell/src/database/corporate_action_imports.rs` -> `v114y_tests` — RUST_MOD.

## Classification

**CA_CUMULATIVE_BASELINE_ASSEMBLED__WHITESPACE_PREFLIGHT_BLOCKED**

The exact assembled baseline contains whitespace errors relative to Git HEAD.

## Behavior deliberately preserved

- Live working-tree source/config/test bytes.
- Live Git index.
- All unrelated current working-tree changes.
- Existing portable/build outputs.
- Production database family.

## Risks / limitations

- This gate is structural only. `cargo metadata` parses manifests but does not compile Rust.
- TypeScript imports are resolved statically but no TypeScript typecheck or Vitest execution occurs here.
- A clean dependency preflight authorizes only the next disposable compile/test gate; it does not authorize staging.

## Recommended next step

Review and resolve the dependency-preflight findings before any compile/test or staging gate.

**git add is intentionally not executed in the live project.**

## Rollback guidance

No production rollback is required. Delete this run directory to remove the disposable assembly. The verified 752-file source snapshot remains the source recovery authority.

## Status

**V1_14AD_CUMULATIVE_BASELINE_ASSEMBLY_DEPENDENCY_PREFLIGHT_R2_COMPLETE**
