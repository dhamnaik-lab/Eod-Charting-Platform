# F-52 / F-01 / F-14 and CA/Identity baseline test integration

- **IST timestamp:** 2026-11-16 12:28:40 (UTC+05:30)
- **Workstream:** EOD Charting Platform
- **Authorized Windows root:** `E:\TA Projects\EOD Charting Platform`
- **GitHub:** `dhamnaik-lab/Eod-Charting-Platform`
- **Integration branch:** `integration/f52-f01-f14-ca-identity-20261116`
- **Base (unchanged main):** `42ae31bae7937dde944c87a997b94da933ad1a0b`
- **Operator acceptance:** pending, no approval to merge into main

## Objective

Combine the three previously implemented chart audit fixes and two independently checked test-expectation corrections in one draft integration branch for desktop portable smoke testing.

## Previous defect / limitation

- F-52: clicking a nonactive tiled chart can collapse layout to Single.
- F-01: price legend lacks selected-bar OHLCV volume.
- F-14: Chart Settings Cancel previously did not discard already-applied chart preference changes.
- Two unrelated full Vitest failures on the unchanged main relate to CA Rights readiness and identity rollback confirmation test expectations.
- The F-52 source predates the latest main; blindly using its entire RootApp or chartStoreTypes blobs would overwrite later accepted changes.

## Files changed and implementation

Original PR source files/tests/change records were included without modification for PRs #104, #108 and #109, plus F-52's new test and change record. F-52's three modified production files were patched onto the verified current main, preserving later main edits:

- `src/RootApp.tsx`: tile click supplies visible layout mode to chart activation.
- `src/features/charts/chartTabSessionController.ts`: optional tile-mode override transferred with tab activation, ordinary activation unchanged.
- `src/store/chartStoreTypes.ts`: optional layout argument for tab activation.
- Original source and tests for F-01 / F-14 plus CA/identity baseline expectation corrections as documented in their original change records.
- New integration change record: this file.

## Source authorities

- F-52 PR #103: `a1e3ee6a12d0b73aebfef6584fc1eaff77c46972`
- F-01 PR #104: `05a66b40149d36ed66b3b93adc36789d54a4febf`
- Regression tests PR #108: `2908f1d02b5f61ba094516e9b8ddb7dcd99029ea`
- F-14 PR #109: `4cc8f80aaccf9bc3013ffc6978a53444d5d4e46d`
- PRs #105, #106, #107 and #110 are not independently included to avoid overlapping validation branches.

## Behaviour preserved

- Current main source outside the 16 original changed files and this documentation file.
- Later main edits to `RootApp.tsx` and `chartStoreTypes.ts`, verified through exact F-52 patch reconstruction.
- Ordinary chart tab switching, settings outside chart-specific staged changes, application storage, database behaviour and packaging scripts.
- No database operations, Rust implementation changes or local Windows repository changes.

## Validation and actual results

- GitHub main and all four PR heads rechecked before integration: matched the full source SHA above.
- All four F-52 patch hunks verified to reproduce original PR source when applied to its original base, with exactly one match each on current main: **PASS**.
- No duplicate target paths among the four selected PRs: **PASS**.
- Existing individual PR CI is recorded in the source change records, but does **not** establish success for this combined integration.
- Combined GitHub CI, focused/full Vitest, typecheck, renderer build: **PENDING at branch creation**; inspect subsequent Actions results.
- Windows desktop build and operator smoke acceptance on actual EOD database: **NOT RUN**; user will perform after Codex brings branch into normal Windows workspace and verifies a database backup.

## Risks / limitations

- F-52 new-tab creation still may switch tiled view to Single. Excluded as a separate bounded issue.
- The combined code has not yet passed integrated CI or desktop operator acceptance.
- UI changes must not be merged into `main` without separate explicit user approval after smoke testing.

## Rollback guidance

Do not merge this integration branch if tests or desktop acceptance fail. Leave main at the verified base and retire the draft integration branch or revert only its isolated commit, preserving the source PR branches and independent evidence. No production database change is authorized.
