# V1.14AD Synced Crosshair Real-Index Staging Report Correction R1A

## IST timestamp
2026-09-01 01:39:57.988 IST

## Objective
Correct the R1 real-index staging Markdown evidence so all recorded Git/index/evidence values are concrete rather than unresolved PowerShell variable tokens, without changing staged or source state.

## Previous defect or limitation
The R1 staging operation itself completed with exact one-path index evidence, but its generated Markdown report contained unresolved tokens such as $CandidatePath, $ExpectedHead, $actualTree, and $indexBackupPath. The JSON summary and staging evidence contained the concrete values; only the Markdown documentation required correction.

## Files changed
- Rewritten documentation: docs\changes\2026-09-01_0124_IST_V1_14AD_SYNCED_CROSSHAIR_ONE_FILE_REAL_INDEX_STAGING_ONLY_PROMOTION_R1.md
- Created correction documentation: docs\changes\2026-09-01_0139_IST_V1_14AD_SYNCED_CROSSHAIR_REAL_INDEX_STAGING_REPORT_CORRECTION_R1A.md
- Runtime/source/config: none
- Real Git index: unchanged
- Database/build/package: none

## Final implementation
- R1 report original SHA-256: D32CA5B03D4E8EA630B9C70628B112C9CABEF7FD0E90AE9D18051FCE0B3133F3
- R1 report corrected SHA-256: BE6C2B3258705E9FC471B63083D067D1C831BFC858DDA931E8FD5C7172629F8E
- Original R1 report backup: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_SYNCED_CROSSHAIR_REAL_INDEX_STAGING_REPORT_CORRECTION_R1A_20260901_013957_988\reports\original-r1-report-before-correction.md
- Staged path remains: src/engine/__tests__/syncedCrosshair.test.ts
- Staged blob remains: 25186f05b83b1bf02c8a13eb155f1c93f91ee91b
- Staged tree remains: e82bca95738fedf5858151d38200251274fafaeb
- Real index SHA-256 remains: 99717042080DFD31972C74D3449441F64C9BF273BEEF9B42849A4C0E7D6BA3E4
- Commit created: NO
- Commit authorized: NO

## Validation commands / checks
- git rev-parse HEAD
- git rev-parse <HEAD>^{tree}
- Get-FileHash on real .git/index
- Get-FileHash on byte-exact pre-stage index backup
- Get-FileHash on R5A / alternate-index / R1 staging authority ZIPs
- git diff --cached --name-only --
- git ls-files --stage -- src/engine/__tests__/syncedCrosshair.test.ts
- git diff --cached --numstat -- src/engine/__tests__/syncedCrosshair.test.ts
- git diff --cached --check
- git write-tree
- SHA-256 checks for candidate, uiStore, and source sentinels
- unresolved-token scan of corrected R1 Markdown

## Actual validation results
- Exact HEAD/tree: PASS
- Real post-stage index SHA-256 99717042080DFD31972C74D3449441F64C9BF273BEEF9B42849A4C0E7D6BA3E4: PASS
- Pre-stage byte-exact backup SHA-256 E3C5AA0EBED9AE344AEA37817EBEE743C3A77BD4463A8B7ACB0D442D739A1E86: PASS
- R5A evidence authority: PASS
- Alternate-index evidence authority: PASS
- R1 staging evidence authority: PASS
- Exact staged path count = 1: PASS
- Exact staged entry = 100644 25186f05b83b1bf02c8a13eb155f1c93f91ee91b 0 src/engine/__tests__/syncedCrosshair.test.ts: PASS
- Exact staged numstat = 15 insertions / 7 deletions: PASS
- git diff --cached --check: PASS
- git write-tree = e82bca95738fedf5858151d38200251274fafaeb: PASS
- Corrected R1 report contains no known unresolved staging variable tokens: PASS
- Source/uiStore/sentinels preserved: PASS

## Behaviour deliberately preserved
- Staged application/test content is unchanged.
- No new path is staged.
- src/store/uiStore.ts remains unstaged and unchanged.
- No Corporate Action path is staged.
- No commit is created.
- No database, build, test, or package command is run.

## Risks or limitations
This R1A changes documentation bytes only. The real Git index remains intentionally staged with the one prerequisite test and commit remains blocked pending evidence review.

## Rollback guidance
To roll back only this documentation correction, restore docs\changes\2026-09-01_0124_IST_V1_14AD_SYNCED_CROSSHAIR_ONE_FILE_REAL_INDEX_STAGING_ONLY_PROMOTION_R1.md from E:\TA Projects\EOD Charting Platform Source Audit\V114AD_SYNCED_CROSSHAIR_REAL_INDEX_STAGING_REPORT_CORRECTION_R1A_20260901_013957_988\reports\original-r1-report-before-correction.md and delete docs\changes\2026-09-01_0139_IST_V1_14AD_SYNCED_CROSSHAIR_REAL_INDEX_STAGING_REPORT_CORRECTION_R1A.md plus the external R1A audit directory. Do not restore the pre-stage Git index backup unless intentionally abandoning the already-approved staging promotion and only after confirming HEAD remains efa30d64d1aa56758dbd35d012502ad92676559d.
