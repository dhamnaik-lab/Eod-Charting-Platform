# V1.14Y Approved Validation Hydration R6 Completion

**IST timestamp:** 2026-08-26 01:12:42 +05:30 IST

## Objective

Complete V1.14Y automated validation after R5 was blocked by Vitest discovering stale test copies under tmp.

## Previous defect or limitation

R5 completed V1.14Y targeted GREEN, Phase 1 validation regression, V1.14X regression, and V1.7A regression. Its full Vitest invocation then discovered stale copied tests under tmp. The real source officialWatchlistDataSplit test passed, while a historical tmp copy failed because its copied generated data and split-official-watchlist-data.mjs helper were absent.

## Files changed

- No production source file changed in R6.
- This completion report is added under docs\\changes.

## Final implementation being validated

- Approved Split/Bonus rows hydrate latest completed official_imports validation evidence using targeted import IDs.
- Targeted calls are batched at 500 IDs.
- Existing non-targeted scan-list behavior remains unchanged.
- No database mutation, approval change, or scan rerun is part of V1.14Y hydration.

## Validation commands

- npm test -- src/features/corporateActions/__tests__/corporateActionValidation.test.ts --exclude tmp/**
- npm test -- --exclude tmp/**
- npm run typecheck:renderer
- npm run build:renderer
- cargo check --manifest-path src-tauri-shell\\Cargo.toml
- cargo test --manifest-path src-tauri-shell\\Cargo.toml

## Actual validation results

- R5 targeted V1.14Y GREEN: PASS, 2 passed / 0 failed.
- R5 Phase 1 price-validation gate: PASS, 2 passed / 0 failed.
- R5 V1.14X regression: PASS, 11 passed / 0 failed.
- R5 V1.7A regression: PASS, 5 passed / 0 failed.
- R6 focused Corporate Action Vitest, source-only: PASS.
- R6 full Vitest, source-only: PASS.
- Renderer TypeScript typecheck: PASS.
- Renderer production build: PASS.
- cargo check: PASS.
- Full Rust default-parallel: test result: ok. 371 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 47.19s

## Behaviour deliberately preserved

- Existing Split/Bonus validation classification and approval policy.
- Existing database content and scan rows.
- Existing V1.14X consolidation state.
- Existing V1.7A-P2 parallel-test isolation fix.
- Historical tmp audit/snapshot evidence was not deleted or modified.

## Risks or limitations

- The project-wide default npm test command still needs a separate test-hygiene hardening if tmp directories are to remain inside the project root indefinitely.
- R6 uses Vitest's additive --exclude tmp/** option to validate the actual source tree without treating historical tmp snapshots as live tests.
- Manual UI smoke testing remains required for ANDHRAPAP Approved validation display.

## Rollback guidance

- R6 changed no production source, so no R6 source rollback is required.
- V1.14Y pre-change rollback files remain in the original V1.14Y-B source-before directory.
