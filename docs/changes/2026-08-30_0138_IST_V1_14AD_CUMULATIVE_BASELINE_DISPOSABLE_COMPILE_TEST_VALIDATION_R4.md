# V1.14AD Cumulative Baseline Disposable Compile/Test Validation R4

IST timestamp: 2026-08-30 01:38:53 +05:30 IST

## Objective

Close the six compile-proven renderer TypeScript contract failures from R3 while preserving the exact assembly-R3 cumulative Corporate Action baseline outside the newly proven dependency units.

## Previous defect or limitation

R3 passed npm install, the static TSX check, and the renderer production build. Full renderer typecheck then failed on six errors: the old `setLoadedImportRows` callback used a two-argument Corporate Action predicate as an `Array.filter` predicate, and assembly-R3 `src/types/desktop.ts` lacked four frontend fields already required by the restored UI and Rust contracts.

## Files changed

- Live source/configuration: none.
- Live Git index: none.
- Production database: not supplied.
- Portable packaging: not performed.
- Disposable validation tree only: Cargo.toml, Cargo.lock, database.rs, DatabaseToolsDialogs.tsx, and src/types/desktop.ts.

## Final implementation

R4 rebuilds from the original exact assembly-R3 tree. It reuses the accepted Cargo and database.rs patches, replaces the cumulative Corporate Action UI patch with one that also contains exact current `setLoadedImportRows`, and applies one exact frontend type patch adding `recommendedIsinException`, `recommendationReason`, and `importIds` to both scan inputs.

The UI scope verifier restores four exact assembly-R3 function bodies and strips the approved state/derived/helper/style units before requiring byte-identical assembly-R3 UI. The type scope verifier restores the three affected interfaces before requiring byte-identical assembly-R3 `src/types/desktop.ts`.

## Validation commands

- npm ci --no-audit --no-fund
- TypeScript static syntax + candidate-only missing-name comparison
- npm run typecheck:renderer
- npm run build:renderer
- cargo metadata --format-version 1 --locked --offline
- focused cargo test ... v114ad_ -- --test-threads=1
- full cargo test ... -- --test-threads=1
- cargo check --locked --offline
- npm test

## Actual validation results

- Classification: CA_CUMULATIVE_BASELINE_COMPILE_TEST_VALIDATION_BLOCKED
- corrected DatabaseToolsDialogs.tsx SHA-256: 25EE0EC647C6FD1DCAEA91301BF73151FF6024F297A80802B9C38C7A86154DE0
- corrected src/types/desktop.ts SHA-256: 1F7E9C59795B9F3E6256444180A5FBDC1404E5862C69F376C61CDADECA38A8C8
- npm ci exit: 0
- static TSX check exit: 0
- renderer typecheck exit: 0
- renderer build exit: 0
- cargo metadata exit: 0
- focused V1.14AD exit: 0
- focused exactly four passed: True
- focused summary: test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 271 filtered out; finished in 0.13s
- full Rust serial exit: 101
- full Rust summary: 
- cargo check exit: -999
- npm test exit: -999
- Vitest summary: 
- assembly-R3 source unchanged: True
- candidate hashes intact: True
- dist/index.html present: True
- live source tree unchanged: True
- live source status unchanged: True
- live sensitive hashes intact: True
- live Git index clean: True

## Behavior deliberately preserved

Every candidate byte outside the five approved paths remains at assembly-R3. Inside DatabaseToolsDialogs.tsx, every byte outside the approved cumulative Corporate Action units remains at assembly-R3. Inside src/types/desktop.ts, every byte outside the three affected interface declarations remains at assembly-R3. Existing live working-tree changes, Cargo/npm manifests, database state, and package output are preserved.

## Risks or limitations

A later Rust or Vitest gate may reveal another compile-proven dependency omission. R4 stops at the first failing governed gate rather than broadening the baseline speculatively. No portable package is built.

## Rollback guidance

No production rollback is required. Delete the external validation-R4 directory to discard build/test artifacts.

## Recommended next step

Investigate the first blocked validation-R4 gate before staging or packaging.

## Status

V1_14AD_CUMULATIVE_BASELINE_DISPOSABLE_COMPILE_TEST_VALIDATION_R4_COMPLETE
