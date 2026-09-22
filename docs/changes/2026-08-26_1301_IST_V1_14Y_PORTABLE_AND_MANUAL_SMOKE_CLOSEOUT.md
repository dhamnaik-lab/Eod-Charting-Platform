# V1.14Y Approved Validation Hydration — Portable and Manual Smoke Closeout

**IST timestamp:** 2026-08-26 13:01:30 +05:30 IST

## Objective

Close V1.14Y after automated source validation, Windows portable rebuild, Approved-view manual validation, and ANDHRAPAP chart smoke testing.

## Previous defect or limitation

Approved Split/Bonus rows could display NOT VALIDATED even when a persisted current MATCHED validation result existed. The Approved view depended on whichever scan results happened to be present in the renderer cache rather than hydrating authoritative persisted validation evidence for the loaded approved imports.

## Files changed by V1.14Y

- src-tauri-shell\\src\\database.rs
- src-tauri-shell\\src\\database\\corporate_action_imports.rs
- src-tauri-shell\\src\\database\\corporate_action_imports\\v114y_tests.rs
- src\\types\\desktop.ts
- src\\components\\DatabaseToolsDialogs.tsx

## Final implementation

- CorporateActionScanListInput accepts optional targeted import IDs.
- Targeted scan-list mode returns the latest result per requested import from COMPLETED official_imports runs.
- Existing non-targeted scan-run/search/limit behavior remains unchanged.
- Approved Split/Bonus rows hydrate persisted validation evidence in batches of 500.
- Cached validation rows are replaced for each requested approved import ID, including IDs without a qualifying result.
- No scan rerun, approval mutation, or database repair is required.

## Final source identities

- corporate_action_imports.rs: 7FF8A707D2AE754324443EA64E6722F9599DF85C4EDBC6466C3B15CB9F168C14
- database.rs: 26E213E92D0D58C5AD5E40E174788CA486DCA67EAED53D4F9B265512E2AA665D
- desktop.ts: 86CA99006D77872271655D06C54D21CF2CAE08987F9960A6091D8C9727A27A22
- DatabaseToolsDialogs.tsx: 1CEFF93CBBDCDC394BB7E9644864C2CA91B2CE888331E510D545C3A9D3F36816
- v114y_tests.rs: 527F368EDC2938BE8393FC9AE8FEB5E08417A1265DD7C223507272D81DA63117
- binary_eod.rs preserved V1.7A-P2: 1DD7CB201E7A7A514263E530426DD0C3C032FFE4ACDA9EA282CEED3F7D927397

## Automated validation

- V1.14Y targeted GREEN: 2 passed / 0 failed.
- Phase 1 price-validation regression: 2 passed / 0 failed.
- V1.14X regression: 11 passed / 0 failed.
- V1.7A regression: 5 passed / 0 failed.
- Focused Corporate Action Vitest: 10 passed / 0 failed.
- Full source-tree Vitest: 110 test files, 632 tests passed / 0 failed.
- Renderer TypeScript typecheck: PASS.
- Renderer production build: PASS; 742 modules transformed.
- cargo check: PASS.
- Full Rust default parallel: 371 passed / 0 failed / 1 ignored.
- R6 evidence report: E:\TA Projects\EOD Charting Platform\docs\changes\2026-08-26_0112_IST_V1_14Y_APPROVED_VALIDATION_HYDRATION_R6_COMPLETION.md

## Windows portable rebuild

- Command: npm run tauri:portable:win
- Vite renderer build: PASS; 742 modules transformed.
- Tauri/Rust optimized release build: PASS.
- Portable root: E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable
- Portable executable: E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe
- Portable executable SHA-256: EAA9119B5DE2D3F2571BFECA1ACF9DAB2D7E3DBAC0362C6F31A3544F34DCCDB7

## Manual UI validation

Manual checks were performed in the rebuilt portable application on 2026-08-26 IST.

Approved Corporate Actions view for NSE:ANDHRAPAP showed the 2024-09-11 split as:

- Action: SPLIT
- Face value: 10 -> 2
- Share multiplier: x5.000000
- Price multiplier: x0.200000
- Validation: STRONG MATCH
- Confidence: 99.06%
- Approval: APPROVED
- The prior NOT VALIDATED presentation was no longer present.

## Manual chart smoke

- NSE:ANDHRAPAP daily chart loaded successfully.
- 1,621 bars were displayed over the visible 2020-2026 history.
- Split corporate-action marker was available/enabled.
- Historical adjusted-price continuity appeared intact across the September 2024 split.
- No obvious 5x discontinuity was visible.

## Behaviour deliberately preserved

- Split/Bonus price-validation classification and approval policy.
- Dividend/rights approval policy.
- Existing scan rows and approval records.
- V1.14X five-pair consolidation state.
- V1.7A-P2 thread-local test-isolation fix.
- Raw EOD data and existing Corporate Action adjustment factors.
- Historical tmp audit/snapshot evidence.

## Risks or limitations

- Manual chart/UI validation is observational and is not an automated screenshot assertion.
- Approved lists above 500 Split/Bonus rows require multiple read-only targeted backend calls.
- Plain npm test may still discover historical tests under tmp; R6 validated the actual source tree using Vitest --exclude tmp/**. Permanent test-discovery hygiene is a separate debt item.

## Rollback guidance

- Restore the exact pre-V1.14Y source backups retained by the original V1.14Y-B run.
- Remove src-tauri-shell\\src\\database\\corporate_action_imports\\v114y_tests.rs if fully reverting V1.14Y.
- Rebuild the portable package after source rollback.
- No database rollback is required because V1.14Y validation hydration performs no database mutation.

## Final status

**V1.14Y APPROVED VALIDATION HYDRATION: CLOSED / VALIDATED / PORTABLE REBUILT / MANUAL UI AND CHART SMOKE PASS**
