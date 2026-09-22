# V1.14AD Cumulative Baseline Disposable Compile/Test Validation

IST timestamp: 2026-08-29 19:28:54 +05:30 IST

## Objective

Validate the exact isolated cumulative Corporate Action baseline by combining the verified R3 assembled source tree with the independently accepted two-file sha2 Cargo contextual patch, then running governed Rust and frontend compile/test validation outside the live project worktree.

## Previous limitation

The cumulative Corporate Action source attribution and dependency preflight were complete, but the isolated baseline had not yet been compiled or tested as a complete candidate. R1A established the exact Cargo.toml/Cargo.lock delta required for the accepted source without authorizing whole-file promotion of the current live Cargo files.

## Files changed

- Live production source/test files: none.
- Live Cargo.toml/Cargo.lock: none.
- Live package.json/package-lock.json: none.
- Live Git index: none.
- Disposable validation tree: copied from exact R3 assembly, then only the accepted Cargo patch was applied before tests.
- Generated validation-only node_modules/dist: external disposable tree only.
- Rust target output: dedicated external CARGO_TARGET_DIR only.

## Final implementation

The validation operator first re-verifies every raw Git blob in the R3 head tree against the locked Git HEAD object IDs, proves that all non-baseline R3 assembly files remain byte-identical to HEAD, checks all 34 baseline critical files, copies the assembly to a new external tree, and applies only the accepted sha2 Cargo patch. It then runs full locked/offline Cargo metadata, focused V1.14AD tests, the full Rust suite serially, cargo check, npm ci, the frontend Vitest suite, renderer typecheck, and renderer production build.

## Validation commands

- cargo metadata --format-version 1 --locked --offline
- cargo test --locked --offline ... v114ad_ -- --test-threads=1
- cargo test --locked --offline ... -- --test-threads=1
- cargo check --locked --offline
- npm ci --no-audit --no-fund
- npm test
- npm run typecheck:renderer
- npm run build:renderer

## Actual validation results

- Classification: CA_CUMULATIVE_BASELINE_COMPILE_TEST_VALIDATION_BLOCKED
- Cargo metadata exit: 0
- Focused V1.14AD test exit: 101
- Focused V1.14AD exactly four passed: False
- Focused V1.14AD summary: 
- Full Rust serial test exit: -999
- Full Rust summary: 
- Cargo check exit: -999
- npm ci exit: -999
- npm test exit: -999
- Vitest summary: 
- Renderer typecheck exit: -999
- Renderer build exit: -999
- R3 source assembly unchanged after validation: True
- Validation tracked/source integrity clean: True
- Live source tree unchanged: True
- Live targeted source status unchanged: True
- Live sensitive hashes intact: True
- Live Git index clean after validation: True

## Behavior deliberately preserved

- Existing live working-tree behavior and unrelated uncommitted changes.
- Exact current live Cargo and npm manifest bytes.
- Exact R3 cumulative baseline source authority.
- Production database state; no production database path is passed to any validation command.
- Existing packaging output; portable packaging is deliberately excluded from this gate.

## Risks or limitations

- npm ci may use the network and npm cache, but all installation/build output remains in the external disposable validation tree.
- Rust tests may create their own temporary or in-memory test databases as part of the existing test suite; no production database is supplied.
- This gate does not stage or commit files and does not build a portable package.

## Rollback guidance

No production rollback is required. Delete the external validation run directory to discard build/test artifacts. The live project source/config/index is expected to remain unchanged.

## Recommended next step

Investigate the first blocked validation gate before any staging or packaging operation.

## Status

V1_14AD_CUMULATIVE_BASELINE_DISPOSABLE_COMPILE_TEST_VALIDATION_COMPLETE
