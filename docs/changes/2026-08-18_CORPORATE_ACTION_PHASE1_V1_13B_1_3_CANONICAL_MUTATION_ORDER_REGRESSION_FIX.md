# Corporate Action Phase 1 — V1.13B-1.3 Canonical Mutation Order Regression Fix

Date: 2026-08-18

## Scope

Test-only correction inside `controlled_identity_repair.rs`.

Production code before `#[cfg(test)]` is byte-for-byte unchanged from V1.13B-1.2.

## RED evidence

Windows focused test result:

- 14 passed
- 1 failed
- failing test: `v113b1_write_outputs_are_filesystem_only`

Observed first CSV mutation import ID: `42274`  
Incorrect expected ID in the regression: `12841`

## Root cause

V1.13B-1 intentionally reproduces the accepted V1.13A.2 mutation-plan ordering by sorting each semantic mutation by its canonical SHA-256 key.

The accepted order begins with `PARSVNATH / import 42274` and ends with `TITAN / import 12841`.

The V1.13B-1.2 regression incorrectly assumed authorization-list order instead of canonical mutation-plan order.

## Correction

The regression now verifies that every CSV row preserves the corresponding canonical `manifest.mutation_plan` row:

- row count matches the manifest;
- flattened `authorizedImportIds` matches the manifest row;
- flattened `evidenceSourceIds` matches the manifest row;
- canonical boundary checks confirm first row `42274 / V112-EVID-0027`;
- final row `12841 / V112-EVID-0001`.

No production ordering logic is changed.

## Hash authority

V1.13B-1.2 source SHA-256: `a6b06af6ec05fff82e51d49c536a1699a248379c58a5535df65ddb3aeffbb444`  
V1.13B-1.3 source SHA-256: `e198948c5650d5fd1864f5f9363567ff94783a5381df701129acd924fa7d6ace`  
Production-prefix SHA-256 (unchanged): `3a5b6b959ecb9ef612bc01e2c9150e08c0450b4aa5e213ace2b5fcc59e230745`

## Safety

- live database operations: 0
- Corporate Action writes: 0
- Quick Resolves: 0
- production writer behavior changes: 0
- Git operations: 0
