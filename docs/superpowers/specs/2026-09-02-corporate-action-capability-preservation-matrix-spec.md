# Corporate Action Capability Preservation Matrix Specification

**Status:** APPROVED SPECIFICATION — TASK 5A NOT YET AUTHORIZED  
**Approved:** 2026-09-02 13:26 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Purpose

Task 5A must create an exhaustive map from the OLD Corporate Action UI to the approved reconstruction architecture before further implementation.

The matrix must account for every user-triggerable control, workflow, row action, bulk action, persisted setting, export, controlled override, and Corporate Action API dependency.

## Authorities

- OLD behavioral archive: `90dd5cf0-8ec0-48c4-a1b1-a17dac2de3fa.zip` / `ABEC169DD675B3AB319451BB95C152D9A24328F22F105D6495F5EC1157543581`
- FRESH current-source archive: `b5b0f03a-f754-4d52-9657-3b2197673da6.zip` / `37437F713C20FD4C6419FFEA5D711C2108A82188678FDB697BB3B2AE79118C8F`
- `src/components/DatabaseToolsDialogs.tsx` continuity SHA-256: `1CEFF93CBBDCDC394BB7E9644864C2CA91B2CE888331E510D545C3A9D3F36816`

Task 5A inventories the FRESH current implementation and uses OLD to prove pre-modernization capability continuity.

## Files to inspect first

- `src/components/DatabaseToolsDialogs.tsx`
- `src/RootApp.tsx`
- `src/store/uiStore.ts`
- `src/platform/tauriDesktop.ts`
- `src/platform/types.ts`
- `src/types/desktop.ts`
- `src/features/corporateActions/**`
- `src-tauri-shell/src/database/corporate_action_imports.rs`
- `src-tauri-shell/src/database/corporate_action_imports/**`

Task 5A is read-only with respect to these files.

## Required matrix columns

| Column | Meaning |
|---|---|
| `capabilityId` | stable unique ID |
| `legacyArea` | Manual / Identity / Imports / Scan / Issues / Resolve / Configuration |
| `legacySubarea` | exact functional subarea |
| `controlType` | button/input/checkbox/select/filter/row/bulk/modal/export |
| `visibleLabel` | exact or normalized visible label |
| `sourcePath` | current source path |
| `sourceAnchor` | existing handler/control/function |
| `handler` | current callback/function |
| `apiMethods` | exact desktop API calls |
| `storeState` | relevant UI/store state |
| `persistedSetting` | setting key or `NONE` |
| `writeRisk` | `READ_ONLY`, `PREVIEW`, `WRITE`, `CONTROLLED_OVERRIDE` |
| `businessCapability` | user outcome |
| `approvedDisposition` | one allowed disposition |
| `targetWorkspace` | Normal / Maintenance / Automatic |
| `targetSection` | approved destination |
| `automaticStage` | Fetch/Load/Review/Approve/`NONE` |
| `parityEvidence` | test/log/manual scenario |
| `migrationStatus` | `LEGACY_ONLY`, `DUAL_WIRED`, `MIGRATED`, `RETIRED_AFTER_PARITY` |
| `notes` | caveat or `NONE` |

No required field may be blank.

## Allowed dispositions

Exactly one:

- `NORMAL_WORKFLOW`
- `MAINTENANCE`
- `AUTOMATIC_APPLICATION_RESPONSIBILITY`

Controlled exceptions, forced acquisition, ambiguous identity repair, and specialist overrides may not be classified as automatic.

## Known minimum legacy inventory

This list is a sentinel, not the exhaustive result.

### Top-level areas

- Manual Entry
- Identity Import
- Official Imports
- Scan Database
- Review Issues

### Manual

- Split
- Bonus
- Dividend
- Rights Issue
- Name Change
- Symbol Change
- Symbol + Name Change
- effective/record date
- ISIN
- ratio
- old/new face value
- old/new symbol
- old/new/current name
- note
- volume/delivery adjustment

### Identity

- Official source URLs
- Download NSE Master
- Download NSE De-listed
- Preview NSE
- Apply NSE
- Download BSE Master
- Preview BSE
- Apply BSE
- Archive Root
- Preview Sync
- Apply Sync
- Import NSE Identity
- current-universe filters/preview

### Official Imports — Review

- Review / Fetch & Import / Historical Backfill
- Review Queue / Approved
- Load / Load More
- Validate Split/Bonus
- Resolve Multiple
- Check Identity Recommendations
- Approve All Recommended Identities
- Select/Clear Ready
- Approve Selected
- Approve All Ready
- row-level Quick Resolve / Review Identity / Validate / Review Price / Approve where present

### Fetch

- exchange
- From / To
- action filters
- Fetch Official
- Force Re-fetch
- Browse
- Import CSV

### Historical Backfill

- single NSE symbol
- optional BSE scrip code
- Backfill History
- batch list
- Stop on error
- Run Batch
- Load Runs
- Current Chart
- Watchlist
- Sparse History
- Old Aliases
- Major Liquid

### Scan

- Scan Official
- Blind Scan
- Load Results
- Load More
- filters

### Issues / Resolve / Exceptions

- Load Imports / More Imports
- Recheck Selected
- Quick Resolve Selected
- Save 1 Active / Multiple / No Active / No Hint
- Load Scan / More Scan
- All Matching export / cancel
- Recheck Identity
- Confirm Recommended Identity
- Confirm Suggested Match
- Confirm Selected Match
- Approve Historical ISIN Exception
- Approve with Price Validation Exception
- required exception reason
- manual candidate search
- evidence comparison

## Known minimum API surface

Task 5A must map all 35 observed API methods or prove a method is shared/non-user-triggered:

- `applyBseCurrentUniverseSync`
- `applyCorporateAction`
- `applyNseCurrentUniverseSync`
- `approveCorporateActionImport`
- `approveCorporateActionImportWithIsinMismatch`
- `approveCorporateActionImportWithPriceValidationException`
- `approveCorporateActionImports`
- `approveRecommendedCorporateActionIsinMismatches`
- `backfillHistoricalCapitalActionsBatch`
- `backfillHistoricalCapitalActionsForSymbol`
- `downloadBseCurrentUniverseMaster`
- `downloadNseCurrentUniverseMaster`
- `downloadNseDelistedWorkbook`
- `fetchOfficialCorporateActions`
- `getSetting`
- `importCorporateActionsCsv`
- `importNseIdentityArchive`
- `listCorporateActionEventIdentities`
- `listCorporateActionImportResolutionHints`
- `listCorporateActionImports`
- `listCorporateActionScanResults`
- `listHistoricalCapitalActionAliasCandidates`
- `listHistoricalCapitalActionBackfillRuns`
- `listHistoricalCapitalActionMajorLiquidCandidates`
- `listHistoricalCapitalActionSparseCandidates`
- `onCorporateActionProgress`
- `pickCsvFiles`
- `previewBseCurrentUniverseSync`
- `previewNseCurrentUniverseSync`
- `quickResolveCorporateActionImport`
- `recheckCorporateActionImports`
- `resolveCorporateActionImport`
- `runCorporateActionScan`
- `saveTextExport`
- `setSetting`

## Completeness gates

Task 5A passes only when:

- every discovered user-triggerable control has a matrix row;
- every known minimum control is found or has an evidence-backed explanation;
- every observed API method is mapped or explicitly classified;
- every persisted CA setting is recorded;
- every controlled override is Maintenance;
- every automatic classification is proven deterministic from existing behavior;
- allowed dispositions contain no extra values;
- `unclassifiedCount = 0`;
- `lostCount = 0`;
- `retiredBeforeParityCount = 0`;
- no source implementation is changed.

## Required Task 5A outputs

Project docs:

- `docs/superpowers/specs/2026-09-02-corporate-action-capability-preservation-matrix.md`
- `docs/changes/<TASK5A_IST>_CORPORATE_ACTION_UI_UX_RECONSTRUCTION_TASK5A_CAPABILITY_INVENTORY.md`

External evidence under:

`E:\TA Projects\EOD Charting Platform Source Audit\CA_UX_RECONSTRUCTION_TASK5A_CAPABILITY_INVENTORY_<IST>\`

Evidence should include matrix CSV/JSON, control inventory, API inventory, persisted-setting inventory, summary JSON, and reports-only ZIP with SHA-256.

## Safety

Task 5A must not edit source, backend, package files, live DB/WAL/SHM, Git index, or Git history. No Git staging/commit/merge/reset/checkout/restore.

PowerShell runners must not use the PowerShell `else` keyword.

## Success classification

`CORPORATE_ACTION_UI_UX_RECONSTRUCTION_TASK5A_CAPABILITY_INVENTORY_PASSED__100_PERCENT_DISPOSITION_COVERAGE__IMPLEMENTATION_NOT_AUTHORIZED`

Success still stops for review. Task 5B is not automatically authorized.
