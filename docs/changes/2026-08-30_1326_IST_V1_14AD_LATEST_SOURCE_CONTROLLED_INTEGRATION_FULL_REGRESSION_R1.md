# V1.14AD Latest-Source Controlled Integration + Full Regression Validation R1

IST timestamp: 2026-08-30 13:26:37 IST

## Objective

Validate the proven V1.14AD Corporate Action cumulative source against the latest verified EOD Charting Platform source rather than continuing to repair the older assembly-R3 baseline.

## Previous defect or limitation

R4 proved the Corporate Action frontend/type/Cargo/Rust dependency closures and the focused V1.14AD tests, but its full Rust suite stopped on four failures in older bhavcopy/bootstrap code. Those files were not R4-modified paths. The latest verified source already contains the later bhavcopy and bootstrap repairs, the Official Watchlist split architecture, and the Vitest tmp-discovery hygiene.

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

No assembly-R3 or R4 source patches were replayed. The exact latest verified snapshot was copied to an external validation directory and validated as-is. The authority gate proved that the latest source already contains the sha2 dependency, Rust Corporate Action scan/recommendation fields, current DatabaseToolsDialogs dependency closures, frontend scan/recommendation fields, V1.14AD production source/tests, repaired bootstrap fixtures, bhavcopy fixes, Vitest tmp exclusion, and Official Watchlist split configuration.

## Validation commands and actual results

- npm ci: 0
- npm run typecheck:renderer: 0
- npm run build:renderer: 0
- Official Watchlist/chunk preservation gate: 0
- cargo metadata --locked --offline: 101
- focused V1.14AD Rust: -999 / exact four passed = False
- bhavcopy holiday sentinel: -999
- BSE UDiff sentinel: -999
- bootstrap seed-default sentinels: -999
- full Rust serial suite: -999
- cargo check --locked --offline: -999
- npm test: -999
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

This gate validates the latest verified source and proves no older baseline overlay is required. It does not stage or commit files, and it does not build the Windows portable package. Controlled CA-only staging still requires a separate attribution/staging gate so unrelated current working-tree changes are not accidentally included.

## Rollback guidance

No production rollback is required. Delete the external validation directory to discard build/test artifacts. The live project source/config is not modified by this validation.

## Recommended next step

Investigate the first failed latest-source validation gate. Do not stage or package.

## Status

V1_14AD_LATEST_SOURCE_CONTROLLED_INTEGRATION_FULL_REGRESSION_R1_COMPLETE
