# Canonical Documentation Reconciliation — 2026-08-17

## Scope

Documentation-only Option-A reconciliation of the maintained/current-authority project documents. Six materially stale canonical root documents are updated. `REQUIREMENTS.md`, `AGENTS.md`, and every pre-existing `docs/changes/*` evidence file are preserved. No runtime source, database, build, or Git operation is part of this change.

## Basis

- Fresh source snapshot: `Eod Charting Platform Source Code 2026-08-17_014948_IST`.
- Uploaded snapshot ZIP SHA-256: `443bfb62aad39f1ccb25055425a86e8752a7487bf771a904cbabfb91bc650653`.
- Supplied snapshot file count: 683.
- The approved reconciliation design and plan were copied by the user under `docs/superpowers/` after the source snapshot.

## Current State Recorded

- W1.1 Rust warning hygiene: CLOSED.
- W1.2 Vite ESM/CJS deprecation cleanup: CLOSED.
- W1.3 Official Watchlists lazy-data split: CLOSED.
- W1.4/W1.4-B1 chart-runtime static partition: CLOSED.
- Accepted production chunks: `feature-chart-canvas` ~204.45 kB, `feature-chart-core` ~297.28 kB, `feature-chart-analysis` ~164.40 kB, `vendor-technicalindicators` ~19.81 kB, and `feature-official-watchlists` ~55.08 kB.
- No application JavaScript chunk exceeds 500 kB; circular-chunk and Vite CJS Node API deprecation warnings are absent.
- `npm run tauri:portable:win` passed. Portable executable SHA-256: `07889C39B81D0F61D32A41C29FD9C7CBF210E6DE61BFB469D61F71D90DAB6281`.
- User manual smoke test passed.

## Corporate Actions Boundary

- V1.9.2 handled 283 authorized `BOOTSTRAP_SAFE` imports at the identity-evidence layer and deduplicated them to 281 exact-date historical ISIN tuples.
- V1.9.2 did **not** approve Corporate Actions.
- V1.9.2.3 was reporting/source-only and performed no database operation.
- Historical residual evidence for the next audit is 9 `COMPANY_IDENTITY_MISMATCH`, 3 `CONFLICTING_ISIN_HISTORY`, and 49 earlier `NO_CANDIDATE`, plus the live post-bootstrap PENDING / READY / approved population. These are not assumed current counts.

## Warning-Cleanup Closure

The warning-cleanup sequence W1.1 through W1.4-B1 is recorded as complete. The clean portable build/manual PASS state is the accepted technical baseline before Corporate Actions work resumes.

## Git Boundary

Git status/normalization is intentionally deferred. This reconciliation does not run Git and does not mix repository-history cleanup with Corporate Actions. Verified source snapshots, pre-change backups, and SHA-256 guards remain the current safety mechanism.

## Files Changed

- `README.md`
- `HANDOFF.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `docs/changes/2026-08-17_CANONICAL_DOCUMENTATION_RECONCILIATION.md` (new)
- `docs/superpowers/plans/2026-08-17-canonical-documentation-reconciliation-plan.md` (approved plan; already copied by the user or installed byte-identically by the guarded package)

## Validation

Package construction validates the fresh-snapshot basis hashes, the canonical content contract, preservation of `REQUIREMENTS.md` / `AGENTS.md` and historical `docs/changes/*`, runtime/config sentinel hashes, and the documentation-only changed-file allow-list. The guarded Windows wrapper repeats those checks against the live project and then runs `scripts/check-doc-references.ps1`. The report itself does not claim a live-project validation result before that wrapper is run.

## Next Step

Run a fresh **read-only Corporate Actions current-state audit** against the live database/workbench. Measure current PENDING / READY / approved / identity-residual populations before designing any further approval, Quick Resolve, bootstrap, or repair phase. Keep Git deferred during that audit. Gann fidelity/acceptance remains future drawing-family work after the Corporate Actions checkpoint.
