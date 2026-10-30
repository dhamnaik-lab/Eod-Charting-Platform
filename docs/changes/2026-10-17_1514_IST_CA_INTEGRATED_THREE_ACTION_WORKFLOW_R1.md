# Integrated Corporate Actions — Three-Action Workflow R1

IST timestamp: 2026-10-17_1514_IST

## Objective
Preserve existing active Corporate Actions window and add the approved Fetch from Officials → Load & Validate → Approve Ready routine in one integrated implementation. No intermediate sub-phases.

## Previous limitation
Future ex-dates and missing ex-date EOD could appear ready; an optional Split/Bonus auto-approval occurred during Load; dividends without stored factors could not produce EOD readiness observations.

## Implementation
- Normal CA Load explicitly excludes automatic approval even if the legacy setting is enabled; advanced maintenance is otherwise preserved.
- Upcoming ex-date remains scheduled. Date/bar readiness is rechecked by Rust immediately before ordinary official import approval.
- Dividend/Rights scans may establish local EOD availability without a stored theoretical factor; financial terms remain with existing backend owner.
- Opening the normal review displays local EOD wait states. On database change, the open review revalidates without committing approvals.
- Fetch default includes upcoming 30 calendar days, while user-selected dates remain supported.
- Existing SQLite transactional savepoints, raw EOD immutability and database-change chart/cache refresh remain the owners; no second adjustment engine is added.

## Files changed (exact source identities)
- src/components/DatabaseToolsDialogs.tsx: PRE 61802F27F9E1417A211E13DC0EF73612AB3600F15F7CA4501BFAD4B5D7DED9BB; POST B2E38184F76422440E05996275FDE2CB12D47FF2DC79D10D7695470425B958A3
- src/features/corporateActions/legacy/corporateActionImportOperations.ts: PRE 7E3C4EC64FD3D2A24B44579FFEBA72F1831836232868073863D2A898AD301B81; POST 17EB976C90CE1215520819C921A46271BA4F11FB5C7196C2174A8F54C4BA4EE1
- src/features/corporateActions/corporateActionValidation.ts: PRE 9A71B0BF0100C0E02309DDFDD8CF03518A0174F468B97EB936944E7D4C8510F7; POST 4DEC37F684299B3472F94A3490C3FAB12A6AAA498432646AC9A02533DC3D3B8A
- src/features/corporateActions/corporateActionBulkApproval.ts: PRE B5F9C1426B11894DC55094B7A7DD93E771AC247CDB72E923FC902F5D16B17839; POST B3BE018071CC76DC10A499E2D9AD7481A2BB6CA57EDD031328651E54B21901ED
- src/features/corporateActions/__tests__/corporateActionPendingPreparation.test.ts: PRE AA8A6CB3D31A8B2286A1111039F329E14B7CCC53535CD9DA27D5BE361EF34D8F; POST 3A297A34E7455F256105A74D6FF1077A18AFE3BF202FA5570EFE0C25056DB2BF
- src/features/corporateActions/__tests__/corporateActionValidation.test.ts: PRE CBDA0EE4EEBB6ED5C8CE8EFA9B228A7575D68D69DD422885F620088D788B2AB4; POST 9DA414B82C3A8549C784948EF5426D5A70AE0E6BA13ADDFCDA809DEB106587F1
- src/features/corporateActions/__tests__/corporateActionOfficialApprovalUx.test.ts: PRE EC4B4BCF14526114856960DA10FA7F81790EE138673FCE19E58BE36A119168C2; POST 21E2DEB4C180C505E34D5FBC59B23B9540CC830F8CDAA40ED09862FADCDA7E56
- src-tauri-shell/src/database/corporate_action_imports.rs: PRE B187CD15A9E36AE16418C066DA579BBEF7947A998DF9A0858E9E6ABE0C835CFB; POST 112BF787350198B161B2E215A613B8BF5084F11CAA8374684DAD6701AC4A8496

## Behavior preserved
- Active DatabaseToolsDialogs window, navigation and advanced maintenance UI.
- Price, corporate-action ledger, identity proof, source evidence and existing exception rules.
- No raw .eod history rewrite; manual confirmation before ordinary batch approval.
- P5 external JavaScript execution remains disabled and sandbox authority remains unverified.

## Native validation
- renderer-typecheck: exit=0; output_SHA256=1AFE5B2747D23C8B96F0DA1111BF18D14AC211FFFEB4BAAE922BCE9F5D807409
- corporate-actions-vitest: exit=0; output_SHA256=11EDC2EC8CCFA2FB33725DA371CBBD021DD89A7CFF52AC8D73DEA2617EE50BD4
- renderer-vite-build: exit=0; output_SHA256=E09ABE6474C433A81CFE7429026B46DAF7B8AD133587F52BF7E57B5574389899
- rust-normal-ca-tests: exit=0; output_SHA256=6520540F7C7F61A3020496FE8598523FB87EE682978855D01F56E641ADE0C67D
- rust-cargo-check: exit=0; output_SHA256=E0B0A5B49BAFB7CB330C4B1BE64DD9573B08008433BAC60BB072AC44411502F0

## Risks and limitations
- The manual desktop chart-refresh checkpoint and full portable Windows executable build are not covered by this automated source gate.
- Quote data quality, exchange corrections and non-trading-session anomalies remain evidence-driven; missing data stays blocked.
- No standalone CA ledger restore UI was added; pre-existing transaction/savepoint and recovery evidence are preserved.
- This test/build runner does not connect to or alter a production EOD database, fetch official feeds, run a production app, or activate plugins.

## Rollback
Restore the eight changed files and HANDOFF.md from the verified task-owned standard project backup; remove only this newly created change record after ensuring hashes match.

## Source/evidence authority
Accepted P1/P2 three-file authority, accepted P5-FINAL closeout and CA-P4B read-only reconciliation identities are pinned by toolkit contract and native source preflight.
