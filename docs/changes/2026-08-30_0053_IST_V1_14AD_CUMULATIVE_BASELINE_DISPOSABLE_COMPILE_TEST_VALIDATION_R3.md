# V1.14AD Cumulative Baseline Disposable Compile/Test Validation R3

IST timestamp: 2026-08-30 00:53:15 +05:30 IST

## Objective

Validate the cumulative Corporate Action baseline after replacing the fragmented UI reconstruction with one exact cumulative `DatabaseToolsDialogs.tsx` dependency-closure patch derived from the verified 2026-08-29 23:30 IST source snapshot.

## Previous defect or limitation

R2 applied the accepted Cargo patch, the four-field `database.rs` closure, and the first bounded UI closure successfully. `npm ci` passed, but the renderer build stopped before typecheck/Rust because two additional malformed Corporate Action JSX regions remained in the R3 assembly: `renderPriceExceptionPanel` and `renderImportsTab`. Dependency tracing also identified the exact state, derived-row, formatter, and style declarations required by those current functions.

## Files changed

- Live project source/configuration: none.
- Live Git index: none.
- Production database: not supplied.
- Portable packaging: not performed.
- Disposable validation tree only:
  - `src-tauri-shell/Cargo.toml`
  - `src-tauri-shell/Cargo.lock`
  - `src-tauri-shell/src/database.rs`
  - `src/components/DatabaseToolsDialogs.tsx`

## Final implementation

The cumulative R3 UI closure contains only approved Corporate Action units from the exact fresh source snapshot:

- exact `renderResolvePanel`
- exact `renderPriceExceptionPanel`
- exact `renderImportsTab`
- price-exception state (`priceExceptionImportId`, `priceExceptionReason`)
- identity-review derived rows (`identityReviewImportRows`, `recommendedIdentityImportRows`)
- `formatCorporatePrice`, `formatCorporatePercent`, and `formatCorporateConfidence`
- nine direct Corporate Action styles: the six R2 styles plus `corporateIdentityCompareGridStyle`, `corporateIdentityCardStyle`, and `corporateIdentityValueRowStyle`

The validator removes those approved units, restores the three exact assembly-R3 function bodies, and requires byte-identical assembly-R3 `DatabaseToolsDialogs.tsx`. This proves no unrelated current UI bytes enter the candidate.

## Validation commands

- `npm ci --no-audit --no-fund`
- TypeScript static syntax + candidate-only missing-name comparison against the fresh source authority
- `npm run build:renderer`
- `npm run typecheck:renderer`
- `cargo metadata --format-version 1 --locked --offline`
- focused `cargo test --locked --offline ... v114ad_ -- --test-threads=1`
- full `cargo test --locked --offline ... -- --test-threads=1`
- `cargo check --locked --offline`
- `npm test`

## Actual validation results

- Classification: CA_CUMULATIVE_BASELINE_COMPILE_TEST_VALIDATION_BLOCKED
- npm ci exit: 0
- TSX static dependency-closure check exit: 0
- renderer build exit: 0
- renderer typecheck exit: 2
- cargo metadata exit: -999
- focused V1.14AD exit: -999
- focused V1.14AD exactly four passed: False
- focused summary: 
- full Rust serial exit: -999
- full Rust summary: 
- cargo check exit: -999
- npm test exit: -999
- Vitest summary: 
- assembly-R3 source tree unchanged: True
- candidate hashes intact: True
- `dist/index.html` present: True
- live source tree unchanged: True
- live source status unchanged: True
- live sensitive hashes intact: True
- live Git index clean: True

## Behavior deliberately preserved

Every `DatabaseToolsDialogs.tsx` byte outside the approved cumulative Corporate Action units remains at the assembly-R3 baseline. Existing live working-tree changes are preserved. The accepted Cargo and `database.rs` corrections are reused unchanged. No live SQLite path is passed to validation, and no package/portable build is performed.

## Risks or limitations

A subsequent compiler or test failure may reveal another dependency-closure omission in another shared integration file. R3 stops at the first failing governed gate rather than broadening the cumulative baseline speculatively.

## Rollback guidance

No production rollback is required because validation R3 changes only an external disposable tree plus this audit report. Delete the external validation-R3 directory to discard build/test artifacts.

## Recommended next step

Investigate the first blocked validation-R3 gate before staging or packaging.

## Status

V1_14AD_CUMULATIVE_BASELINE_DISPOSABLE_COMPILE_TEST_VALIDATION_R3_COMPLETE
