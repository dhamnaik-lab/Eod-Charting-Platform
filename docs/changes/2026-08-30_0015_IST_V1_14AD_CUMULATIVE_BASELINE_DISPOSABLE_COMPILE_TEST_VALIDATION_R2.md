# V1.14AD Cumulative Baseline Disposable Compile/Test Validation R2

IST timestamp: 2026-08-30 00:15:25 +05:30 IST

## Objective

Validate the cumulative Corporate Action baseline after adding only the approved Corporate Action UI dependency closure in `src/components/DatabaseToolsDialogs.tsx`: the exact fresh-snapshot `renderResolvePanel` plus exactly six direct supporting style declarations.

## Previous defect or limitation

R1 successfully applied the accepted Cargo patch and four-field `database.rs` dependency closure, and `npm ci` passed. The renderer build then stopped before Rust validation because the R3 `DatabaseToolsDialogs.tsx` reconstruction contained an incomplete Corporate Action identity-review panel with malformed JSX.

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

The R2 UI closure replaces only `renderResolvePanel` with the exact implementation from the verified 2026-08-29 23:30 IST source snapshot and adds exactly six missing styles: `corporateIdentityStatusRowStyle`, `corporateResolveSectionStyle`, `corporateResolveSearchResultsStyle`, `corporateEvidenceDetailsStyle`, `corporateEvidenceSummaryToggleStyle`, and `corporateEvidenceDetailsBodyStyle`. The validator proves that removing these seven approved units from the candidate and restoring the R3 function yields byte-identical R3 `DatabaseToolsDialogs.tsx`.

## Validation commands

- `npm ci --no-audit --no-fund`
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
- renderer build exit: 1
- renderer typecheck exit: -999
- cargo metadata exit: -999
- focused V1.14AD exit: -999
- focused V1.14AD exactly four passed: False
- focused summary: 
- full Rust serial exit: -999
- full Rust summary: 
- cargo check exit: -999
- npm test exit: -999
- Vitest summary: 
- R3 source assembly unchanged: True
- candidate hashes intact: True
- `dist/index.html` present: False
- live source tree unchanged: True
- live source status unchanged: True
- live sensitive hashes intact: True
- live Git index clean: True

## Behavior deliberately preserved

All bytes outside the seven approved UI units remain at the R3 baseline. Existing live working-tree changes are preserved. The accepted Cargo and `database.rs` corrections are reused unchanged. No live SQLite path is passed to validation, and no package/portable build is performed.

## Risks or limitations

A further compiler or test failure may reveal another dependency-closure omission. R2 intentionally stops at the first failing governed gate rather than broadening the baseline speculatively.

## Rollback guidance

No production rollback is required because R2 changes only an external disposable validation tree plus this audit report. Delete the external R2 validation directory to discard validation artifacts.

## Recommended next step

Investigate the first blocked R2 gate before staging or packaging.

## Status

V1_14AD_CUMULATIVE_BASELINE_DISPOSABLE_COMPILE_TEST_VALIDATION_R2_COMPLETE
