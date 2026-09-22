# V1.14AD Cumulative Baseline Disposable Compile/Test Validation R1

IST timestamp: 2026-08-29 23:01:24 +05:30 IST

## Objective

Validate the exact isolated cumulative Corporate Action baseline after correcting the compile-proven four-field database.rs dependency closure and ensuring the renderer dist is built before Tauri Rust compilation.

## Previous limitation

The first disposable compile/test run proved two concrete blockers: database.rs omitted four Corporate Action contract fields that accepted corporate_action_imports.rs requires, and Rust compilation ran before the configured ../dist frontend existed. The failed run otherwise preserved live state and validated the Cargo patch.

## Files changed

- Live production source/test files: none.
- Live Cargo.toml/Cargo.lock: none.
- Live package.json/package-lock.json: none.
- Live Git index: none.
- Disposable validation tree: copied from exact R3 assembly, then only the accepted Cargo patch and exact four-field database.rs dependency-closure patch were applied before tests.
- Generated validation-only node_modules/dist: external disposable tree only.
- Rust target output: dedicated external CARGO_TARGET_DIR only.

## Final implementation

R1 re-verifies the R3 authority, binds to the exact failed-run evidence, copies the original R3 assembly to a new external tree, applies only the accepted sha2 Cargo patch plus the exact database.rs four-field closure, installs frontend dependencies, builds renderer dist, then runs locked/offline Cargo metadata, focused V1.14AD tests, the full Rust suite serially, cargo check, Vitest, and renderer typecheck.

## Failed-run authority

- Failed validation ZIP SHA-256: EA0275E176252CA523EAB6D725BDAB9819041B84D61FC33F364EC78009B4DB3F.
- Failed focused Rust compile exit: 101 after Cargo metadata exit 0.
- Failure contract: missing renderer dist plus the four database.rs contract fields corrected by this R1.

## Validation commands

- npm ci --no-audit --no-fund
- npm run build:renderer
- cargo metadata --format-version 1 --locked --offline
- cargo test --locked --offline ... v114ad_ -- --test-threads=1
- cargo test --locked --offline ... -- --test-threads=1
- cargo check --locked --offline
- npm test
- npm run typecheck:renderer

## Actual validation results

- Classification: CA_CUMULATIVE_BASELINE_COMPILE_TEST_VALIDATION_BLOCKED
- Corrected database.rs SHA-256: 0B1CB3E9BD9500A9D30B1AC02E51FE792166779242B7BAD74B2075F04179ECC7
- Database closure patch SHA-256: E69C07BE850D92061D9AE0E8F96E7932F9A378ADEAA26E4D5E011F9FA6DAC203
- npm ci exit: 0
- Renderer pre-Rust build exit: 1
- Cargo metadata exit: -999
- Focused V1.14AD test exit: -999
- Focused V1.14AD exactly four passed: False
- Focused V1.14AD summary: 
- Full Rust serial test exit: -999
- Full Rust summary: 
- Cargo check exit: -999
- npm test exit: -999
- Vitest summary: 
- Renderer typecheck exit: -999
- R3 source assembly unchanged after validation: True
- Corrected database.rs intact after validation: True
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

V1_14AD_CUMULATIVE_BASELINE_DISPOSABLE_COMPILE_TEST_VALIDATION_R1_COMPLETE
