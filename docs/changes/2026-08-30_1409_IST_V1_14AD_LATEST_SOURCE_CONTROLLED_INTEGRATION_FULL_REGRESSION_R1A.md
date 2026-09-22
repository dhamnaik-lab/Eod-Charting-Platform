# V1.14AD Latest-Source Controlled Integration + Full Regression Validation R1A

IST timestamp: 2026-08-30 14:09:03 IST

## Objective

Validate the proven V1.14AD Corporate Action cumulative source against the latest verified EOD Charting Platform source rather than continuing to repair the older assembly-R3 baseline.

## Previous defect or limitation

R1 proved that the latest verified source already contains the complete Corporate Action dependency closure, passed renderer typecheck/build, and preserved the Official Watchlist split. R1 then stopped at cargo metadata --locked --offline because dbus v0.9.12 was not present in the local Cargo cache. Source/configuration remained byte-identical to the verified latest snapshot.

## Source authority

- Latest snapshot: E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-29_233003_IST
- Full snapshot: 765 files / 17614039 bytes / AFAC76737DA873345B299F89EE704CA7FFAE8EDC0FCF57B31AD92DFFD9D59725
- Build-relevant source/config subset: 508 files / 12758215 bytes / AE5906759852FC585D0D121D8F635DBEBF8D117913F921AEE22E84CA82DEE520
- Live source/config matched that snapshot before validation.
- Integration decision: NO_SOURCE_OVERLAY_REQUIRED__LATEST_SNAPSHOT_ALREADY_CONTAINS_PROVEN_CA_CLOSURES

## Files changed

- Production/live source code: none.
- Production/live configuration: none.
- Git index: none.
- Production database: not opened or supplied.
- Portable/package output: not built.
- External disposable validation tree only: node_modules, dist and external Cargo target build/test artifacts.
- This timestamped docs\changes report.

## Final implementation

No assembly-R3 or R4 source patches are replayed. R1A copies the exact latest verified snapshot to a fresh external validation directory, runs the frontend gates, then executes cargo fetch --locked only to populate Cargo's external package cache. Immediately afterward it proves Cargo.toml, Cargo.lock, the entire 508-file build-relevant candidate subset, and the live source/configuration remain unchanged before restoring Cargo offline mode and continuing the full Rust/Vitest regression chain.

## Validation commands and actual results

- npm ci: 0
- npm run typecheck:renderer: 0
- npm run build:renderer: 0
- Official Watchlist/chunk preservation gate: 0
- cargo fetch --locked: 0
- post-fetch Cargo/source immutability gate: 0
- Cargo.toml pre/post fetch SHA-256: D1199096F9EA2548FD011BC120ABD15407849A75D9AAA14240DF1D250A020D42 / D1199096F9EA2548FD011BC120ABD15407849A75D9AAA14240DF1D250A020D42
- Cargo.lock pre/post fetch SHA-256: 68A14D7A9C904F0C981BC6529E82C439B2352EABBF2AA8BE221F7F79FCA778C5 / 68A14D7A9C904F0C981BC6529E82C439B2352EABBF2AA8BE221F7F79FCA778C5
- cargo metadata --locked --offline: 0
- focused V1.14AD Rust: 0 / exact four passed = True
- bhavcopy holiday sentinel: 0
- BSE UDiff sentinel: 0
- bootstrap seed-default sentinels: 0
- full Rust serial suite: 0
- cargo check --locked --offline: 0
- npm test: 1
- live Git index clean after validation: True
- final classification: LATEST_SOURCE_CA_INTEGRATION_VALIDATION_BLOCKED

## Behavior deliberately preserved

- Latest-source bhavcopy behavior.
- Repaired bootstrap market_holidays test fixture.
- Official Watchlist W1.3 source split and Vite chunk partition.
- Vitest tmp/** exclusion.
- All current source/config bytes outside build outputs.
- No production database or portable build activity.

## Risks or limitations

This gate permits network access only for cargo fetch --locked to populate Cargo's package cache. Dependency resolution remains lockfile-bound, and source/lock immutability is revalidated before offline Cargo commands. It does not stage or commit files, open the production database, or build the Windows portable package.

## Rollback guidance

No production rollback is required. Delete the external validation directory to discard build/test artifacts. The live project source/config is not modified by this validation.

## Recommended next step

Investigate the first failed latest-source validation gate. Do not stage or package.

## Status

V1_14AD_LATEST_SOURCE_CONTROLLED_INTEGRATION_FULL_REGRESSION_R1A_COMPLETE
